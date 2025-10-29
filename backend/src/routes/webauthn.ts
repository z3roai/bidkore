import type {
	AuthenticationResponseJSON,
	RegistrationResponseJSON,
} from "@simplewebauthn/typescript-types";
import { Router } from "express";

import {
	webauthnLoginOptionsSchema,
	webauthnLoginVerifySchema,
	webauthnRegisterVerifySchema,
} from "../schemas/webauthn";

import config from "@/config/env";
import { type AuthRequest, authenticateToken } from "@/middleware/auth";
import { validateRequest } from "@/middleware/validation";
import User, { toJSON } from "@/models/User";
import loggingService from "@/services/loggingService";
import webauthnService from "@/services/webauthnService";

const router = Router();

// GET /api/webauthn/register/options - for authenticated users to create a new passkey
router.get(
	"/register/options",
	authenticateToken,
	async (req: AuthRequest, res) => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not authenticated" });
				return;
			}
			try {
				const { options } =
					await webauthnService.generateRegistrationOptionsForUser(
						req.user,
						req.headers.origin
					);
				res.json(options);
			} catch (err) {
				loggingService.error(
					"/webauthn/register/options generation failed:",
					err
				);
				throw err;
			}
		} catch (error) {
			loggingService.error("WebAuthn register options error:", error);
			res
				.status(500)
				.json({ error: "Failed to generate registration options" });
		}
	}
);

// POST /api/webauthn/register/verify - verify registration response
router.post(
	"/register/verify",
	authenticateToken,
	validateRequest(webauthnRegisterVerifySchema),
	async (req: AuthRequest, res) => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not authenticated" });
				return;
			}
			const { credential } = req.body as {
				credential: RegistrationResponseJSON;
			};
			await webauthnService.verifyRegistrationResponseForUser(
				req.user,
				credential,
				req.headers.origin
			);
			res.json({ message: "Passkey registered successfully" });
		} catch (error) {
			loggingService.error("WebAuthn register verify error:", error);
			res.status(400).json({ error: "Failed to verify registration response" });
		}
	}
);

// POST /api/webauthn/login/options - anonymous users request options by email
router.post(
	"/login/options",
	validateRequest(webauthnLoginOptionsSchema),
	async (req, res) => {
		try {
			const { email } = req.body as { email: string };
			const user = await User.findByEmail(email);
			if (!user) {
				res.status(404).json({ error: "User not found" });
				return;
			}
			if (!user.isActive) {
				res.status(401).json({ error: "Account is deactivated" });
				return;
			}
			if (config.auth.allowPasswordless === false) {
				res.status(403).json({
					error: "Passwordless login is disabled by system configuration.",
				});
				return;
			}
			const { options } =
				await webauthnService.generateAuthenticationOptionsForUser(
					user,
					req.headers.origin
				);
			res.json(options);
		} catch (error) {
			loggingService.error("WebAuthn login options error:", error);
			res
				.status(500)
				.json({ error: "Failed to generate authentication options" });
		}
	}
);

// POST /api/webauthn/login/verify - verify login response and return JWT
router.post(
	"/login/verify",
	validateRequest(webauthnLoginVerifySchema),
	async (req, res) => {
		try {
			const { email, credential } = req.body as {
				email: string;
				credential: AuthenticationResponseJSON;
			};
			const user = await User.findByEmail(email);
			if (!user) {
				res.status(404).json({ error: "User not found" });
				return;
			}
			if (!user.isActive) {
				res.status(401).json({ error: "Account is deactivated" });
				return;
			}
			await webauthnService.verifyAuthenticationResponseForUser(
				user,
				credential,
				req.headers.origin
			);
			// Reuse auth token issuance from auth route
			const { default: jwt } = await import("jsonwebtoken");
			const { default: env } = await import("../config/env");
			const token = jwt.sign({ userId: user.id }, env.auth.jwtSecret, {
				expiresIn: "7d",
			});
			res.json({ message: "Login successful", token, user: toJSON(user) });
		} catch (error) {
			loggingService.error("WebAuthn login verify error:", error);
			res
				.status(400)
				.json({ error: "Failed to verify authentication response" });
		}
	}
);

// GET /api/webauthn/credentials - list current user's passkeys
router.get("/credentials", authenticateToken, async (req: AuthRequest, res) => {
	try {
		if (!req.user) {
			res.status(401).json({ error: "User not authenticated" });
			return;
		}
		const creds = await (
			await import("../models/WebAuthnCredential")
		).default.listForUser(req.user.id);
		res.json({
			credentials: creds.map(c => ({
				id: Buffer.from(c.credentialId).toString("base64url"),
				createdAt: c.createdAt,
			})),
		});
	} catch (error) {
		loggingService.error("WebAuthn list credentials error:", error);
		res.status(500).json({ error: "Failed to list credentials" });
	}
});

// DELETE /api/webauthn/credentials/:id - delete a passkey by credential id (base64url)
router.delete(
	"/credentials/:id",
	authenticateToken,
	async (req: AuthRequest, res) => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not authenticated" });
				return;
			}
			const { id } = req.params;
			if (!id) {
				res.status(400).json({ error: "Credential ID is required" });
				return;
			}
			const model = (await import("../models/WebAuthnCredential")).default;
			const deleted = await model.deleteByIdForUser(req.user.id, id);
			if (deleted === 0) {
				res.status(404).json({ error: "Passkey not found" });
				return;
			}
			res.json({ message: "Passkey deleted" });
		} catch (error) {
			loggingService.error("WebAuthn delete credential error:", error);
			res.status(500).json({ error: "Failed to delete credential" });
		}
	}
);

export default router;
