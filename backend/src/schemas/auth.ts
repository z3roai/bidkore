import { z } from "zod";

// Common validation patterns
const emailSchema = z.string().email("Invalid email format");
const passwordSchema = z
	.string()
	.min(6, "Password must be at least 6 characters");
const nameSchema = z
	.string()
	.min(1, "Name is required")
	.max(50, "Name must be 50 characters or less");
const otpSchema = z.string().length(6, "OTP must be exactly 6 characters");

// Authentication schemas using Zod 4 features
export const registerSchema = z
	.object({
		email: emailSchema,
		password: passwordSchema,
		firstName: nameSchema,
		lastName: nameSchema,
		turnstileToken: z.string().optional(),
	})
	.describe("User registration data");

export const loginSchema = z
	.object({
		email: emailSchema,
		password: z.string().min(1, "Password is required"),
		turnstileToken: z.string().optional(),
	})
	.describe("User login credentials");

export const verifyEmailSchema = z
	.object({
		token: z.string().optional(),
		otp: otpSchema.optional(),
		email: emailSchema.optional(),
	})
	.refine(data => data.token ?? data.otp, {
		message: "Either token or OTP must be provided",
		path: ["token"],
	})
	.describe("Email verification data");

export const resendVerificationSchema = z
	.object({
		email: emailSchema,
		includeOTP: z.boolean().default(false),
	})
	.describe("Resend verification email request");

export const forgotPasswordSchema = z
	.object({
		email: emailSchema,
		includeOTP: z.boolean().default(false),
	})
	.describe("Forgot password request");

export const resetPasswordSchema = z
	.object({
		token: z.string().optional(),
		otp: otpSchema.optional(),
		email: emailSchema.optional(),
		newPassword: passwordSchema,
	})
	.refine(data => data.token ?? (data.otp && data.email), {
		message: "Either token or (OTP and email) must be provided",
		path: ["token"],
	})
	.describe("Reset password data");

// Auto-generated TypeScript types using Zod 4's improved inference
export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type VerifyEmailRequest = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationRequest = z.infer<
	typeof resendVerificationSchema
>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;
