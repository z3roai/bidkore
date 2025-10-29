import bcrypt from "bcryptjs";
import { type Request, type Response, Router } from "express";
import jwt from "jsonwebtoken";

import {
	authLimiter,
	passwordResetLimiter,
	resendVerificationLimiter,
} from "../middleware/rateLimiting";
import {
	type ForgotPasswordRequest,
	forgotPasswordSchema,
	type LoginRequest,
	loginSchema,
	type RegisterRequest,
	registerSchema,
	type ResendVerificationRequest,
	resendVerificationSchema,
	type ResetPasswordRequest,
	resetPasswordSchema,
	type VerifyEmailRequest,
	verifyEmailSchema,
} from "../schemas";

import config from "@/config/env";
import { authenticateToken, type AuthRequest } from "@/middleware/auth";
import { createError } from "@/middleware/errorHandler";
import { validateRequest } from "@/middleware/validation";
import type { EmailVerificationType } from "@/models";
import { VerificationType } from "@/models/EmailVerification";
import User, { toJSON, UserRole } from "@/models/User";
import emailService from "@/services/emailService";
import emailVerificationService from "@/services/emailVerificationService";
import loggingService from "@/services/loggingService";
import turnstileService from "@/services/turnstileService";

const router = Router();

// Generate JWT token
const generateToken = (userId: string): string => {
	const secret = config.auth.jwtSecret;
	if (!secret) {
		throw createError("JWT secret not configured", 500);
	}
	return jwt.sign({ userId }, secret, { expiresIn: "7d" });
};

// Register endpoint with Zod validation
router.post(
	"/register",
	authLimiter,
	validateRequest(registerSchema),
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { email, password, firstName, lastName, turnstileToken } =
				req.body as RegisterRequest;

			// Validate Turnstile token if provided
			if (turnstileToken) {
				const isTurnstileValid = await turnstileService.verifyToken(
					turnstileToken,
					req.ip
				);
				if (!isTurnstileValid) {
					res.status(400).json({ error: "Invalid security verification" });
					return;
				}
			} else if (turnstileService.isConfigured()) {
				// If Turnstile is configured but no token provided, require it
				res.status(400).json({ error: "Security verification required" });
				return;
			}

			// Check if user already exists
			const existingUser = await User.findOne({ where: { email } });
			if (existingUser) {
				res.status(409).json({ error: "User already exists" });
				return;
			}

			// Hash password
			const hashedPassword = await bcrypt.hash(password, 12);

			// Create user
			const user = await User.create({
				email,
				password: hashedPassword,
				firstName,
				lastName,
				role: UserRole.FREE,
				emailVerified: false,
			});

			// Send verification email
			let emailSent = false;
			try {
				await emailVerificationService.sendVerificationEmail(
					user.id,
					email,
					VerificationType.EMAIL_VERIFICATION,
					true // Always include OTP for email verification
				);
				emailSent = true;
				loggingService.info(`Verification email sent to ${email}`);
			} catch (emailError) {
				loggingService.error("Failed to send verification email:", emailError);
				// Don't fail registration if email sending fails
			}

			// Generate token
			const token = generateToken(user.id);

			res.status(201).json({
				message: emailSent
					? "User registered successfully. Please check your email to verify your account."
					: "User registered successfully. Email verification will be sent shortly.",
				token,
				user: toJSON(user),
				emailVerificationRequired: true,
				emailSent,
			});
		} catch (error) {
			loggingService.error("Registration error:", error);
			res.status(500).json({ error: "Registration failed" });
		}
	}
);

// Login endpoint with Zod validation
router.post(
	"/login",
	authLimiter,
	validateRequest(loginSchema),
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { email, password, turnstileToken } = req.body as LoginRequest;

			// Validate Turnstile token if provided
			if (turnstileToken) {
				const isTurnstileValid = await turnstileService.verifyToken(
					turnstileToken,
					req.ip
				);
				if (!isTurnstileValid) {
					res.status(400).json({ error: "Invalid security verification" });
					return;
				}
			} else if (turnstileService.isConfigured()) {
				// If Turnstile is configured but no token provided, require it
				res.status(400).json({ error: "Security verification required" });
				return;
			}

			// Find user
			const user = await User.findOne({ where: { email } });
			if (!user) {
				res
					.status(404)
					.json({ error: "User not found", code: "USER_NOT_FOUND" });
				return;
			}

			// Check password
			const isValidPassword = await bcrypt.compare(password, user.password);
			if (!isValidPassword) {
				res.status(401).json({ error: "Invalid credentials" });
				return;
			}

			// Check if user is active
			if (!user.isActive) {
				res.status(401).json({ error: "Account is deactivated" });
				return;
			}

			// If TOTP is enabled, require TOTP before issuing final token
			const totpEnabled = user.totpEnabled === true;
			if (totpEnabled) {
				// Generate a temporary verification token (instead of storing password client-side)
				const totpVerificationToken = generateTotpVerificationToken(
					user.id,
					user.email
				);

				res.status(200).json({
					message: "Additional verification required",
					requiresTOTP: true,
					verificationToken: totpVerificationToken,
					availableMFA: { totp: true, webauthn: true },
					user: toJSON(user),
				});
				return;
			}

			// Update last login
			await User.update(
				{ lastLoginAt: new Date() },
				{ where: { id: user.id } }
			);

			// Generate token
			const token = generateToken(user.id);

			res.json({
				message: "Login successful",
				token,
				user: toJSON(user),
				requiresTOTP: false,
				availableMFA: { totp: totpEnabled, webauthn: true },
			});
		} catch (error) {
			loggingService.error("Login error:", error);
			res.status(500).json({ error: "Login failed" });
		}
	}
);

// Generate temporary TOTP verification token (for secure password handling)
const generateTotpVerificationToken = (
	userId: string,
	email: string
): string => {
	const secret = config.auth.jwtSecret;
	if (!secret) {
		throw createError("JWT secret not configured", 500);
	}
	// Short-lived token (5 minutes) for TOTP verification only
	return jwt.sign({ userId, email, purpose: "totp_verification" }, secret, {
		expiresIn: "5m",
	});
};

// Verify temporary TOTP verification token
const verifyTotpVerificationToken = (
	token: string
): { userId: string; email: string } | null => {
	const secret = config.auth.jwtSecret;
	if (!secret) {
		throw createError("JWT secret not configured", 500);
	}
	try {
		const decoded = jwt.verify(token, secret) as {
			userId: string;
			email: string;
			purpose: string;
		};
		if (decoded.purpose !== "totp_verification") {
			return null;
		}
		return { userId: decoded.userId, email: decoded.email };
	} catch {
		return null;
	}
};

// Complete TOTP login endpoint (supports both password and temporary token)
router.post(
	"/login-totp",
	authLimiter,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { email, password, token, verificationToken } = req.body as {
				email: string;
				password?: string;
				token: string;
				verificationToken?: string;
			};

			let user: Awaited<ReturnType<typeof User.findOne>>;

			// Verify credentials using either password or verification token
			if (verificationToken) {
				// Verify using temporary token (more secure)
				const tokenData = verifyTotpVerificationToken(verificationToken);
				if (!tokenData || tokenData.email !== email) {
					res
						.status(401)
						.json({ error: "Invalid or expired verification token" });
					return;
				}

				// Find user by ID from token
				user = await User.findOne({ where: { id: tokenData.userId } });
				if (!user) {
					res.status(404).json({ error: "User not found" });
					return;
				}
			} else if (password) {
				// Legacy: Verify using password (less secure, for backward compatibility)
				user = await User.findOne({ where: { email } });
				if (!user) {
					res.status(404).json({ error: "User not found" });
					return;
				}

				const isValidPassword = await bcrypt.compare(password, user.password);
				if (!isValidPassword) {
					res.status(401).json({ error: "Invalid credentials" });
					return;
				}
			} else {
				res
					.status(400)
					.json({ error: "Either password or verification token is required" });
				return;
			}

			// Check if user is active
			if (!user.isActive) {
				res.status(401).json({ error: "Account is deactivated" });
				return;
			}

			// Check if TOTP is enabled
			if (!user.totpEnabled || !user.totpSecret) {
				res.status(400).json({ error: "TOTP is not enabled for this user" });
				return;
			}

			// Import TOTP service
			const totpService = (await import("../services/totpService")).default;

			// Verify TOTP token
			const verificationResult = totpService.verifyToken(
				user.totpSecret,
				token,
				user.totpBackupCodes
			);

			if (!verificationResult.valid) {
				res.status(401).json({ error: "Invalid TOTP token" });
				return;
			}

			// If backup code was used, update the user's backup codes
			if (verificationResult.backupCodeUsed) {
				await User.update(
					{ totpBackupCodes: { set: user.totpBackupCodes } },
					{ where: { id: user.id } }
				);
			}

			// Update last login
			await User.update(
				{ lastLoginAt: new Date() },
				{ where: { id: user.id } }
			);

			// Generate token
			const jwtToken = generateToken(user.id);

			res.json({
				message: "Login successful",
				token: jwtToken,
				user: toJSON(user),
			});
		} catch (error) {
			loggingService.error("TOTP login error:", error);
			res.status(500).json({ error: "Login failed" });
		}
	}
);

// Get current user profile
router.get(
	"/me",
	authenticateToken,
	(req: AuthRequest, res: Response): void => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			// Debug: Log user data to see current role
			loggingService.debug("User data from /auth/me:", {
				id: req.user.id,
				email: req.user.email,
				role: req.user.role,
				firstName: req.user.firstName,
				lastName: req.user.lastName,
			});

			res.json({
				user: toJSON(req.user),
			});
		} catch (error) {
			loggingService.error("Get profile error:", error);
			res.status(500).json({ error: "Failed to get profile" });
		}
	}
);

// Upgrade to premium (placeholder for payment integration)
// NOTE: This endpoint is disabled - use Stripe payment flow instead
// router.post('/upgrade', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     if (!req.user) {
//       res.status(401).json({ error: 'User not found' });
//       return;
//     }

//     if (req.user.role === UserRole.PREMIUM || req.user.role === UserRole.ADMIN) {
//       res.status(400).json({ error: 'User already has premium access' });
//       return;
//     }

//     // In a real application, you would integrate with a payment processor here
//     await req.user.update({ role: UserRole.PREMIUM });

//     res.json({
//       message: 'Account upgraded to premium successfully',
//       user: toJSON(req.user),
//     });
//   } catch (error) {
//     console.error('Upgrade error:', error);
//     res.status(500).json({ error: 'Upgrade failed' });
//   }
// });

// Verify email endpoint with Zod validation
router.post(
	"/verify-email",
	validateRequest(verifyEmailSchema),
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { token, otp, email } = req.body as VerifyEmailRequest;
			let verification: EmailVerificationType | null;

			if (token) {
				verification = await emailVerificationService.verifyToken(
					token,
					VerificationType.EMAIL_VERIFICATION
				);
			} else if (otp && email) {
				verification = await emailVerificationService.verifyOTP(
					email,
					otp,
					VerificationType.EMAIL_VERIFICATION
				);
			} else {
				res
					.status(400)
					.json({ error: "Either token or OTP with email is required" });
				return;
			}

			if (!verification) {
				res.status(400).json({ error: "Invalid or expired verification code" });
				return;
			}

			// Update user email verification status
			if (!verification.userId) {
				res.status(400).json({ error: "Invalid verification data" });
				return;
			}
			await User.update(
				{ emailVerified: true },
				{ where: { id: verification.userId } }
			);

			// Mark verification as used
			await emailVerificationService.markAsUsed(verification.id);

			res.json({
				message: "Email verified successfully",
			});
		} catch (error) {
			loggingService.error("Email verification error:", error);
			res.status(500).json({ error: "Email verification failed" });
		}
	}
);

// Resend verification email endpoint with Zod validation
router.post(
	"/resend-verification",
	resendVerificationLimiter,
	validateRequest(resendVerificationSchema),
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { email, includeOTP } = req.body as ResendVerificationRequest;

			// Find user
			const user = await User.findOne({ where: { email } });
			if (!user) {
				res.status(404).json({ error: "User not found" });
				return;
			}

			if (user.emailVerified) {
				res.status(400).json({ error: "Email is already verified" });
				return;
			}

			// Additional anti-spam check: Check if user was created recently
			const userCreatedAt = new Date(user.createdAt);
			const now = new Date();
			const timeSinceCreation = now.getTime() - userCreatedAt.getTime();
			const oneMinute = 60 * 1000; // 1 minute in milliseconds

			// Prevent resending verification emails for accounts created less than 1 minute ago
			if (timeSinceCreation < oneMinute) {
				res.status(429).json({
					error:
						"Please wait a moment before requesting another verification email",
					retryAfter: Math.ceil((oneMinute - timeSinceCreation) / 1000),
				});
				return;
			}

			// Log the resend attempt for monitoring
			loggingService.info(
				`Resend verification requested for user: ${email}, IP: ${req.ip}`
			);

			// Send verification email
			await emailVerificationService.sendVerificationEmail(
				user.id,
				email,
				VerificationType.EMAIL_VERIFICATION,
				includeOTP
			);

			res.json({
				message: "Verification email sent successfully",
			});
		} catch (error) {
			loggingService.error("Resend verification error:", error);
			res.status(500).json({ error: "Failed to resend verification email" });
		}
	}
);

// Request password reset endpoint with Zod validation
router.post(
	"/forgot-password",
	passwordResetLimiter,
	validateRequest(forgotPasswordSchema),
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { email } = req.body as ForgotPasswordRequest;

			// Find user
			const user = await User.findOne({ where: { email } });
			if (!user) {
				// Don't reveal if user exists or not for security
				res.json({
					message: "If the email exists, a password reset link has been sent",
				});
				return;
			}

			// Generate secure reset token
			const resetToken = jwt.sign(
				{
					userId: user.id,
					email: email,
					type: "password_reset",
				},
				config.auth.jwtSecret,
				{ expiresIn: "15m" } // 15 minutes expiry
			);

			// Create reset URL
			const resetUrl = `${config.urls.frontend}/reset-password?token=${resetToken}`;

			// Send password reset email with link
			await emailService.sendPasswordResetEmail(
				email,
				user.firstName,
				user.lastName,
				resetUrl
			);

			res.json({
				message: "If the email exists, a password reset link has been sent",
			});
		} catch (error) {
			loggingService.error("Forgot password error:", error);
			res.status(500).json({ error: "Failed to send password reset email" });
		}
	}
);

// Reset password endpoint with Zod validation
router.post(
	"/reset-password",
	validateRequest(resetPasswordSchema),
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { token, newPassword } = req.body as ResetPasswordRequest;

			if (!token) {
				res.status(400).json({ error: "Reset token is required" });
				return;
			}

			// Verify JWT token
			let decoded: { userId: string; type: string; email: string };
			try {
				decoded = jwt.verify(token, config.auth.jwtSecret) as {
					userId: string;
					type: string;
					email: string;
				};
			} catch {
				res.status(400).json({ error: "Invalid or expired reset token" });
				return;
			}

			// Validate token payload
			if (decoded.type !== "password_reset" || !decoded.userId) {
				res.status(400).json({ error: "Invalid reset token" });
				return;
			}

			// Find user
			const user = await User.findByPk(decoded.userId);
			if (!user) {
				res.status(400).json({ error: "User not found" });
				return;
			}

			// Hash new password
			const hashedPassword = await bcrypt.hash(newPassword, 12);

			// Update user password
			await User.update(
				{ password: hashedPassword, lastPasswordChangeAt: new Date() },
				{ where: { id: decoded.userId } }
			);

			res.json({
				message: "Password reset successfully",
			});
		} catch (error) {
			loggingService.error("Reset password error:", error);
			res.status(500).json({ error: "Password reset failed" });
		}
	}
);

export default router;
