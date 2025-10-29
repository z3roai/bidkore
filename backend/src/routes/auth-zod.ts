import type { EmailVerification } from "@prisma/client";
import bcrypt from "bcryptjs";
import { type Request, type Response, Router } from "express";
import jwt from "jsonwebtoken";

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
import { UserRole, VerificationType } from "@/models";
import UserModel from "@/models/User";
import emailVerificationService from "@/services/emailVerificationService";
import loggingService from "@/services/loggingService";

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
	validateRequest(registerSchema),
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { email, password, firstName, lastName } =
				req.body as RegisterRequest;

			// Check if user already exists
			const existingUser = await UserModel.findOne({ where: { email } });
			if (existingUser) {
				res.status(409).json({ error: "User already exists" });
				return;
			}

			// Hash password
			const hashedPassword = await bcrypt.hash(password, 12);

			// Create user
			const user = await UserModel.create({
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
			}

			// Generate token
			const token = generateToken(user.id);

			res.status(201).json({
				message: emailSent
					? "User registered successfully. Please check your email to verify your account."
					: "User registered successfully. Please check your email to verify your account.",
				token,
				user: {
					id: user.id,
					email: user.email,
					firstName: user.firstName,
					lastName: user.lastName,
					role: user.role,
					isActive: user.isActive,
					emailVerified: user.emailVerified,
					avatar: user.avatar,
					lastLoginAt: user.lastLoginAt,
					createdAt: user.createdAt,
					updatedAt: user.updatedAt,
				},
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
	validateRequest(loginSchema),
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { email, password } = req.body as LoginRequest;

			// Find user
			const user = await UserModel.findOne({ where: { email } });
			if (!user) {
				res.status(401).json({ error: "Invalid credentials" });
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

			// Update last login
			await UserModel.update(
				{ lastLoginAt: new Date() },
				{ where: { id: user.id } }
			);

			// Generate token
			const token = generateToken(user.id);

			res.json({
				message: "Login successful",
				token,
				user: {
					id: user.id,
					email: user.email,
					firstName: user.firstName,
					lastName: user.lastName,
					role: user.role,
					isActive: user.isActive,
					emailVerified: user.emailVerified,
					avatar: user.avatar,
					lastLoginAt: user.lastLoginAt,
					createdAt: user.createdAt,
					updatedAt: user.updatedAt,
				},
			});
		} catch (error) {
			loggingService.error("Login error:", error);
			res.status(500).json({ error: "Login failed" });
		}
	}
);

// Verify email endpoint with Zod validation
router.post(
	"/verify-email",
	validateRequest(verifyEmailSchema),
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { token, otp, email } = req.body as VerifyEmailRequest;
			let verification: EmailVerification | null;

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

			if (!verification.userId) {
				res.status(400).json({ error: "Invalid verification data" });
				return;
			}

			// Update user email verification status
			await UserModel.update(
				{ emailVerified: true },
				{ where: { id: verification.userId } }
			);

			// Mark verification as used
			await emailVerificationService.markAsUsed(verification.id);

			res.json({ message: "Email verified successfully" });
		} catch (error) {
			loggingService.error("Email verification error:", error);
			res.status(500).json({ error: "Email verification failed" });
		}
	}
);

// Resend verification endpoint with Zod validation
router.post(
	"/resend-verification",
	validateRequest(resendVerificationSchema),
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { email, includeOTP } = req.body as ResendVerificationRequest;

			// Find user
			const user = await UserModel.findOne({ where: { email } });
			if (!user) {
				res.status(404).json({ error: "User not found" });
				return;
			}

			if (user.emailVerified) {
				res.status(400).json({ error: "Email is already verified" });
				return;
			}

			// Send verification email
			await emailVerificationService.sendVerificationEmail(
				user.id,
				email,
				VerificationType.EMAIL_VERIFICATION,
				includeOTP
			);

			res.json({ message: "Verification email sent successfully" });
		} catch (error) {
			loggingService.error("Resend verification error:", error);
			res.status(500).json({ error: "Failed to send verification email" });
		}
	}
);

// Forgot password endpoint with Zod validation
router.post(
	"/forgot-password",
	validateRequest(forgotPasswordSchema),
	async (req: Request, res: Response): Promise<void> => {
		try {
			const { email, includeOTP } = req.body as ForgotPasswordRequest;

			// Find user
			const user = await UserModel.findOne({ where: { email } });
			if (!user) {
				// Don't reveal if user exists or not for security
				res.json({
					message: "If the email exists, a password reset link has been sent",
				});
				return;
			}

			// Send password reset email
			await emailVerificationService.sendVerificationEmail(
				user.id,
				email,
				VerificationType.PASSWORD_RESET,
				includeOTP
			);

			res.json({ message: "Password reset email sent successfully" });
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
			const { token, otp, email, newPassword } =
				req.body as ResetPasswordRequest;
			let verification: EmailVerification | null;

			if (token) {
				verification = await emailVerificationService.verifyToken(
					token,
					VerificationType.PASSWORD_RESET
				);
			} else if (otp && email) {
				verification = await emailVerificationService.verifyOTP(
					email,
					otp,
					VerificationType.PASSWORD_RESET
				);
			} else {
				res
					.status(400)
					.json({ error: "Either token or OTP with email is required" });
				return;
			}

			if (!verification) {
				res.status(400).json({ error: "Invalid or expired reset code" });
				return;
			}

			if (!verification.userId) {
				res.status(400).json({ error: "Invalid verification data" });
				return;
			}

			// Hash new password
			const hashedPassword = await bcrypt.hash(newPassword, 12);

			// Update user password
			await UserModel.update(
				{ password: hashedPassword },
				{ where: { id: verification.userId } }
			);

			// Mark verification as used
			await emailVerificationService.markAsUsed(verification.id);

			res.json({ message: "Password reset successfully" });
		} catch (error) {
			loggingService.error("Reset password error:", error);
			res.status(500).json({ error: "Password reset failed" });
		}
	}
);

// Get current user endpoint
router.get(
	"/me",
	authenticateToken,
	(req: AuthRequest, res: Response): void => {
		try {
			const { user } = req;
			if (!user) {
				res.status(401).json({ error: "User not authenticated" });
				return;
			}
			res.json({
				user: {
					id: user.id,
					email: user.email,
					firstName: user.firstName,
					lastName: user.lastName,
					role: user.role,
					isActive: user.isActive,
					emailVerified: user.emailVerified,
					avatar: user.avatar,
					lastLoginAt: user.lastLoginAt,
					createdAt: user.createdAt,
					updatedAt: user.updatedAt,
				},
			});
		} catch (error) {
			loggingService.error("Get current user error:", error);
			res.status(500).json({ error: "Failed to get user information" });
		}
	}
);

export default router;
