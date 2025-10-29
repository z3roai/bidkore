import { type Request, type Response, Router } from "express";
import { z } from "zod";

import { type AuthRequest, authenticateToken } from "@/middleware/auth";
import { validateRequest } from "@/middleware/validation";
import User, { type UserUpdateInput } from "@/models/User";
import loggingService from "@/services/loggingService";
import totpService from "@/services/totpService";

// import { createError } from "../middleware/errorHandler";

const router = Router();

// Schema for TOTP verification request
const verifyTOTPSchema = z.object({
	token: z.string().min(6, "Token must be at least 6 characters"),
});

// Schema for TOTP enable request (secret optional; server prefers stored secret)
const enableTOTPSchema = z.object({
	secret: z.string().min(1).optional(),
	token: z.string().min(6, "Token must be at least 6 characters"),
	backupCodes: z.array(z.string()).min(1, "Backup codes are required"),
});

// Schema for TOTP disable request
const disableTOTPSchema = z.object({
	password: z.string().min(1, "Password is required"),
	token: z.string().min(6, "Token must be at least 6 characters"),
});

// Schema for TOTP verification during login
const loginTOTPSchema = z.object({
	email: z.string().email("Invalid email"),
	password: z.string().min(1, "Password is required"),
	token: z.string().min(6, "Token must be at least 6 characters"),
});

/**
 * GET /api/totp/setup
 * Generate TOTP secret and QR code for setup
 */
router.get(
	"/setup",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			// Check if TOTP is already enabled
			const currentUser = req.user as unknown as UserWithTOTP;
			if (currentUser.totpEnabled) {
				res.status(400).json({ error: "TOTP is already enabled" });
				return;
			}

			// Reuse existing pending secret if present; otherwise generate and persist
			let secretToUse = currentUser.totpSecret;
			let qrCodeUrl: string;
			if (secretToUse) {
				qrCodeUrl = await totpService.generateQRCode(
					secretToUse,
					req.user.email
				);
				loggingService.debug("TOTP setup reused", {
					userId: req.user.id,
					secretLength: secretToUse.length,
					secretFp: totpService.fingerprintSecret(secretToUse),
				});
			} else {
				const { secret, qrCodeUrl: qrCodeUrlFromSetup } =
					await totpService.setupTOTP(req.user.email);
				secretToUse = secret;
				qrCodeUrl = qrCodeUrlFromSetup;
				await User.update(
					{
						totpSecret: secretToUse,
						totpEnabled: false,
					} as unknown as UserUpdateInput,
					{ where: { id: req.user.id } }
				);
				loggingService.debug("TOTP setup generated", {
					userId: req.user.id,
					secretLength: secretToUse.length,
					secretFp: totpService.fingerprintSecret(secretToUse),
				});
			}

			const backupCodes = totpService.generateBackupCodes();
			res.json({
				secret: secretToUse,
				qrCodeUrl,
				backupCodes,
			});
		} catch (error) {
			loggingService.error("TOTP setup error:", error);
			res.status(500).json({ error: "Failed to setup TOTP" });
		}
	}
);

/**
 * POST /api/totp/verify
 * Verify TOTP token during setup
 */
router.post(
	"/verify",
	authenticateToken,
	validateRequest(verifyTOTPSchema),
	(req: AuthRequest, res: Response): void => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const { token } = req.body as { token: string };

			// Verify the token against the secret
			const userSecret = (req.user as unknown as UserWithTOTP).totpSecret ?? "";
			const isValid = userSecret
				? totpService.verifyTOTP(userSecret, token)
				: false;

			if (!isValid) {
				res.status(400).json({ error: "Invalid TOTP token" });
				return;
			}

			res.json({ message: "TOTP token verified successfully" });
		} catch (error) {
			loggingService.error("TOTP verification error:", error);
			res.status(500).json({ error: "Failed to verify TOTP token" });
		}
	}
);

/**
 * POST /api/totp/enable
 * Enable TOTP for the user
 */
router.post(
	"/enable",
	authenticateToken,
	validateRequest(enableTOTPSchema),
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const { secret, token, backupCodes } = req.body as {
				secret?: string;
				token: string;
				backupCodes: string[];
			};

			// Prefer the stored secret to avoid mismatches; fallback to body for backward compatibility
			const providedSecret = secret;
			const secretToUse =
				(req.user as unknown as UserWithTOTP).totpSecret ?? providedSecret;
			if (!secretToUse) {
				loggingService.warn("TOTP enable failed: missing secret", {
					userId: req.user.id,
				});
				res.status(400).json({
					error: "TOTP setup not initialized. Please start setup again.",
				});
				return;
			}

			// Verify the token (drift-compensating)
			const storedFp = totpService.fingerprintSecret(secretToUse);
			const bodyFp = providedSecret
				? totpService.fingerprintSecret(providedSecret)
				: null;
			const secretMismatch = Boolean(providedSecret && bodyFp !== storedFp);
			loggingService.debug("TOTP enable attempt", {
				userId: req.user.id,
				secretLength: secretToUse.length,
				secretFp: storedFp,
				bodySecretLength: providedSecret?.length,
				bodySecretFp: bodyFp,
				secretMismatch,
				tokenLength: String(token).length,
				secondsRemaining: totpService.getRemainingTime(),
			});
			const verification = totpService.verifyToken(secretToUse, token, []);
			if (!verification.valid) {
				const diag = totpService.diagnoseVerification(secretToUse, token);
				const preview = totpService.previewTokens(secretToUse);
				loggingService.warn("TOTP enable failed: invalid token", {
					userId: req.user.id,
					secondsRemaining: totpService.getRemainingTime(),
					delta: diag.delta,
					window: diag.window,
					previewNowLength: String(preview.now).length,
					secretMismatch,
				});
				res.status(400).json({ error: "Invalid TOTP token" });
				return;
			}

			// If verification succeeded with large drift compensation, log the skew
			const driftCheck = totpService.diagnoseVerification(
				secretToUse,
				token,
				240
			);
			if (driftCheck.delta !== null && Math.abs(driftCheck.delta) > 2) {
				loggingService.warn("TOTP enable succeeded with drift compensation", {
					userId: req.user.id,
					skewStepsUsed: driftCheck.delta,
				});
			}

			// Update user with TOTP data
			await User.update(
				{
					totpSecret: secretToUse,
					totpEnabled: true,
					totpBackupCodes: { set: backupCodes },
				} as unknown as UserUpdateInput,
				{ where: { id: req.user.id } }
			);

			loggingService.info(`TOTP enabled for user: ${req.user.email}`);

			res.json({
				message: "TOTP enabled successfully",
				backupCodes,
			});
		} catch (error) {
			loggingService.error("TOTP enable error:", error);
			res.status(500).json({ error: "Failed to enable TOTP" });
		}
	}
);

/**
 * POST /api/totp/disable
 * Disable TOTP for the user
 */
router.post(
	"/disable",
	authenticateToken,
	validateRequest(disableTOTPSchema),
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const { password, token } = req.body as {
				password: string;
				token: string;
			};

			// Verify password
			const bcrypt = await import("bcryptjs");
			const isValidPassword = await bcrypt.default.compare(
				password,
				req.user.password
			);
			if (!isValidPassword) {
				res.status(400).json({ error: "Invalid password" });
				return;
			}

			// Verify TOTP token
			const userSecret = (req.user as unknown as UserWithTOTP).totpSecret ?? "";
			const isTokenValid = totpService.verifyToken(
				userSecret,
				token,
				(req.user as unknown as UserWithTOTP).totpBackupCodes
			);
			if (!isTokenValid.valid) {
				res.status(400).json({ error: "Invalid TOTP token" });
				return;
			}

			// Disable TOTP
			await User.update(
				{
					totpSecret: null,
					totpEnabled: false,
					totpBackupCodes: { set: [] },
				} as unknown as UserUpdateInput,
				{ where: { id: req.user.id } }
			);

			loggingService.info(`TOTP disabled for user: ${req.user.email}`);

			res.json({ message: "TOTP disabled successfully" });
		} catch (error) {
			loggingService.error("TOTP disable error:", error);
			res.status(500).json({ error: "Failed to disable TOTP" });
		}
	}
);

/**
 * GET /api/totp/status
 * Get TOTP status for the user
 */
router.get(
	"/status",
	authenticateToken,
	(req: AuthRequest, res: Response): void => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const u = req.user as unknown as UserWithTOTP;
			res.json({
				totpEnabled: u.totpEnabled,
				backupCodesCount: (u.totpBackupCodes || []).length,
			});
		} catch (error) {
			loggingService.error("TOTP status error:", error);
			res.status(500).json({ error: "Failed to get TOTP status" });
		}
	}
);

/**
 * POST /api/totp/verify-login
 * Verify TOTP token during login
 */
router.post(
	"/verify-login",
	validateRequest(loginTOTPSchema),
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { email, password, token } = req.body as {
				email: string;
				password: string;
				token: string;
			};

			// Find user
			const user = await User.findByEmail(email);
			if (!user) {
				res.status(404).json({ error: "User not found" });
				return;
			}

			// Verify password
			const bcrypt = await import("bcryptjs");
			const isValidPassword = await bcrypt.default.compare(
				password,
				user.password
			);
			if (!isValidPassword) {
				res.status(401).json({ error: "Invalid credentials" });
				return;
			}

			// Check if TOTP is enabled
			const uLogin = user as unknown as UserWithTOTP;
			if (!uLogin.totpEnabled || !uLogin.totpSecret) {
				res.status(400).json({ error: "TOTP is not enabled for this user" });
				return;
			}

			// Verify TOTP token
			const verificationResult = totpService.verifyToken(
				uLogin.totpSecret,
				token,
				uLogin.totpBackupCodes
			);

			if (!verificationResult.valid) {
				res.status(401).json({ error: "Invalid TOTP token" });
				return;
			}

			// If backup code was used, update the user's backup codes
			if (verificationResult.backupCodeUsed) {
				await User.update(
					{
						totpBackupCodes: { set: uLogin.totpBackupCodes },
					} as unknown as UserUpdateInput,
					{ where: { id: user.id } }
				);
			}

			res.json({ message: "TOTP verification successful" });
		} catch (error) {
			loggingService.error("TOTP login verification error:", error);
			res.status(500).json({ error: "Failed to verify TOTP token" });
		}
	}
);

export default router;

type UserWithTOTP = {
	id: number;
	email: string;
	password: string;
	role: string;
	avatar?: string | null;
} & {
	totpSecret: string | null;
	totpEnabled: boolean;
	totpBackupCodes: string[];
};
