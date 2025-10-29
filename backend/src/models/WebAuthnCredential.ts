import type { WebAuthnCredential as PrismaWebAuthnCredential } from "@prisma/client";

import prisma from "@/config/prisma";

export type WebAuthnCredential = PrismaWebAuthnCredential;

export default {
	async create(data: {
		userId: string;
		credentialId: Buffer;
		publicKey: Buffer;
		counter: number;
		transports: string[];
		aaguid?: string | null;
		credentialDeviceType?: string | null;
		credentialBackedUp?: boolean;
	}): Promise<WebAuthnCredential> {
		return prisma.webAuthnCredential.create({
			data: {
				userId: data.userId,
				credentialId: data.credentialId,
				publicKey: data.publicKey,
				counter: data.counter,
				transports: data.transports,
				aaguid: data.aaguid ?? null,
				credentialDeviceType: data.credentialDeviceType ?? null,
				credentialBackedUp: data.credentialBackedUp ?? false,
			},
		});
	},

	async findByUserId(userId: string): Promise<WebAuthnCredential[]> {
		return prisma.webAuthnCredential.findMany({ where: { userId } });
	},

	async findByCredentialId(credentialId: Buffer): Promise<WebAuthnCredential | null> {
		return prisma.webAuthnCredential.findUnique({
			where: { credentialId },
		});
	},

	async updateCounter(credentialId: Buffer, counter: number): Promise<WebAuthnCredential> {
		return prisma.webAuthnCredential.update({
			where: { credentialId },
			data: { counter },
		});
	},

	async deleteForUser(userId: string, credentialId: Buffer): Promise<number> {
		const result = await prisma.webAuthnCredential.deleteMany({
			where: { userId, credentialId },
		});
		return result.count;
	},

	async deleteByIdForUser(userId: string, credentialIdB64: string): Promise<number> {
		const id = Buffer.from(credentialIdB64, "base64url");
		return this.deleteForUser(userId, id);
	},

	async listForUser(userId: string): Promise<WebAuthnCredential[]> {
		return prisma.webAuthnCredential.findMany({
			where: { userId },
			orderBy: { createdAt: "desc" },
		});
	},
};
