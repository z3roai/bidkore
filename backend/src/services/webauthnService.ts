import url from "node:url";

import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";
import type {
	AuthenticationResponseJSON,
	AuthenticatorTransportFuture,
	RegistrationResponseJSON,
} from "@simplewebauthn/typescript-types";

import config from "@/config/env";
import { redisClient } from "@/config/redis";
import type { User } from "@/models";
import WebAuthnCredentialModel from "@/models/WebAuthnCredential";
import loggingService from "@/services/loggingService";

const CHALLENGE_TTL_SECONDS = 10 * 60;

// In-memory fallback stores when Redis is unavailable
const memRegisterChallenges = new Map<string, { challenge: string; expiresAt: number }>();
const memLoginChallenges = new Map<string, { challenge: string; expiresAt: number }>();

const getRpInfo = (
	originOverride?: string
): { rpID: string; origin: string; rpName: string } => {
	const frontendUrl = originOverride ?? config.urls.frontend;
	const originStr = Array.isArray(frontendUrl) ? frontendUrl[0] : frontendUrl;
	let rpID: string;
	try {
		const parsed = new url.URL(originStr);
		rpID = parsed.hostname;
	} catch {
		rpID = "localhost";
	}
	const rpName = "BidKore";
	return { rpID, origin: originStr, rpName } as const;
};

const getRegisterChallengeKey = (userId: string): string =>
	`webauthn:register:challenge:${userId}`;
const getLoginChallengeKey = (userId: string): string =>
	`webauthn:login:challenge:${userId}`;

export interface RegistrationOptionsResult {
	options: Awaited<ReturnType<typeof generateRegistrationOptions>>;
}

export interface AuthenticationOptionsResult {
	options: Awaited<ReturnType<typeof generateAuthenticationOptions>>;
}

export default {
	async generateRegistrationOptionsForUser(
		user: User,
		originOverride?: string
	): Promise<RegistrationOptionsResult> {
		const { rpID, rpName } = getRpInfo(originOverride);
		const existingCredentials = await WebAuthnCredentialModel.findByUserId(
			user.id
		);
        const excludeCredentials = existingCredentials.map(cred => ({
            id: Buffer.from(cred.credentialId).toString("base64url"),
            type: "public-key" as const,
        }));

		loggingService.debug("WebAuthn generateRegistrationOptions - inputs", {
			userId: user.id,
			email: user.email,
			rpID,
			rpName,
			originOverride,
			excludeCount: excludeCredentials.length,
		});
        let options: Awaited<ReturnType<typeof generateRegistrationOptions>>;
		try {
			options = await generateRegistrationOptions({
				rpName,
				rpID,
				userID: isoUint8Array.fromUTF8String(String(user.id)),
				userName: user.email,
				attestationType: "none",
				excludeCredentials,
				authenticatorSelection: {
					residentKey: "preferred",
					requireResidentKey: false,
					userVerification: "preferred",
				},
				timeout: 60_000,
			});
		} catch (err) {
			loggingService.error(
				`WebAuthn generateRegistrationOptions failed: ${
					err instanceof Error ? err.stack : JSON.stringify(err)
				}`
			);
			throw err;
		}

        try {
            await redisClient.setex(
                getRegisterChallengeKey(user.id),
                CHALLENGE_TTL_SECONDS,
                options.challenge
            );
        } catch {
            // Fallback to memory
            memRegisterChallenges.set(user.id, { challenge: options.challenge, expiresAt: Date.now() + CHALLENGE_TTL_SECONDS * 1000 });
            loggingService.warn("Redis unavailable, using in-memory register challenge store");
        }

		return { options };
	},

	async verifyRegistrationResponseForUser(
		user: User,
		credential: RegistrationResponseJSON,
		originOverride?: string
	): Promise<{ verified: true }> {
		const { rpID, origin } = getRpInfo(originOverride);
        let expectedChallenge: string | null = null;
        try {
            expectedChallenge = await redisClient.get(
                getRegisterChallengeKey(user.id)
            );
        } catch {
            // ignore
        }
        if (!expectedChallenge) {
            const mem = memRegisterChallenges.get(user.id);
            if (mem && mem.expiresAt > Date.now()) expectedChallenge = mem.challenge;
        }
		if (!expectedChallenge) {
			throw new Error("Registration challenge not found or expired");
		}

		const verification = await verifyRegistrationResponse({
			response: credential,
			expectedRPID: rpID,
			expectedOrigin: origin,
			expectedChallenge,
		});

		const regInfo = verification.registrationInfo;
		if (!verification.verified || !regInfo) {
			throw new Error("WebAuthn registration verification failed");
		}

		const credentialID: Uint8Array = Buffer.from(
			regInfo.credential.id,
			"base64url"
		);
		const credentialPublicKey: Uint8Array = new Uint8Array(
			regInfo.credential.publicKey
		);
		const counter: number = regInfo.credential.counter ?? 0;
		const { credentialDeviceType } = regInfo;
		const { credentialBackedUp } = regInfo;
		const { aaguid } = regInfo;

		await WebAuthnCredentialModel.create({
			userId: user.id,
			credentialId: Buffer.from(credentialID),
			publicKey: Buffer.from(credentialPublicKey),
			counter,
			transports:
				(credential.response as { transports?: string[] }).transports ?? [],
			credentialDeviceType,
			credentialBackedUp,
			aaguid,
		});

        try {
            await redisClient.del(getRegisterChallengeKey(user.id));
        } catch {
            // ignore
        }
        memRegisterChallenges.delete(user.id);

		return { verified: true } as const;
	},

	async generateAuthenticationOptionsForUser(
		user: User,
		originOverride?: string
	): Promise<AuthenticationOptionsResult> {
		const { rpID } = getRpInfo(originOverride);
        const credentials = await WebAuthnCredentialModel.findByUserId(user.id);
        const allowCredentials = credentials.map(cred => ({
            id: Buffer.from(cred.credentialId).toString("base64url"),
            transports: Array.isArray(cred.transports)
                ? (cred.transports as AuthenticatorTransportFuture[])
                : [],
        }));

		loggingService.debug("WebAuthn generateAuthenticationOptions - inputs", {
			userId: user.id,
			email: user.email,
			rpID,
			originOverride,
			allowCount: allowCredentials.length,
		});

		let options: Awaited<ReturnType<typeof generateAuthenticationOptions>>;
		try {
			options = await generateAuthenticationOptions({
				rpID,
				allowCredentials,
				userVerification: "preferred",
				timeout: 60_000,
			});
		} catch (err) {
			loggingService.error(
				`WebAuthn generateAuthenticationOptions failed: ${
					err instanceof Error ? err.stack : JSON.stringify(err)
				}`
			);
			throw err;
		}

        try {
            await redisClient.setex(
                getLoginChallengeKey(user.id),
                CHALLENGE_TTL_SECONDS,
                options.challenge
            );
        } catch {
            memLoginChallenges.set(user.id, { challenge: options.challenge, expiresAt: Date.now() + CHALLENGE_TTL_SECONDS * 1000 });
            loggingService.warn("Redis unavailable, using in-memory login challenge store");
        }

		return { options };
	},

	async verifyAuthenticationResponseForUser(
		user: User,
		credential: AuthenticationResponseJSON,
		originOverride?: string
	): Promise<{ verified: true }> {
		const { rpID, origin } = getRpInfo(originOverride);
        let expectedChallenge: string | null = null;
        try {
            expectedChallenge = await redisClient.get(
                getLoginChallengeKey(user.id)
            );
        } catch {
            // ignore
        }
        if (!expectedChallenge) {
            const mem = memLoginChallenges.get(user.id);
            if (mem && mem.expiresAt > Date.now()) expectedChallenge = mem.challenge;
        }
		if (!expectedChallenge) {
			throw new Error("Authentication challenge not found or expired");
		}

		try {
			const dbCredentials = await WebAuthnCredentialModel.findByUserId(user.id);

			// Find the credential that matches the authentication response
			const { rawId } = credential as unknown as { rawId?: string };
			if (!rawId) {
				throw new Error("No rawId in authentication response");
			}

			const idBuffer = Buffer.from(rawId, "base64url");
			const matchedCredential = dbCredentials.find(
				c => Buffer.compare(Buffer.from(c.credentialId), idBuffer) === 0
			);

			if (!matchedCredential) {
				throw new Error("Authenticator not registered");
			}

			const verification = await verifyAuthenticationResponse({
				response: credential,
				expectedRPID: rpID,
				expectedOrigin: origin,
				expectedChallenge,
				credential: {
					id: Buffer.from(matchedCredential.credentialId).toString("base64url"),
					publicKey: Buffer.from(matchedCredential.publicKey),
					counter: matchedCredential.counter,
				},
				requireUserVerification: false,
			});

			if (!verification.verified) {
				throw new Error("WebAuthn authentication verification failed");
			}

			const { newCounter } = verification.authenticationInfo;

			await WebAuthnCredentialModel.updateCounter(
				Buffer.from(matchedCredential.credentialId),
				newCounter
			);
            try {
                await redisClient.del(getLoginChallengeKey(user.id));
            } catch {
                // ignore
            }
            memLoginChallenges.delete(user.id);
			return { verified: true } as const;
		} catch (error) {
			loggingService.error("WebAuthn authentication error:", error);
			throw error;
		}
	},
};
