import rateLimit from "express-rate-limit";

import config from "@/config/env";

// Rate limiter for resend verification emails
export const resendVerificationLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 3, // Maximum 3 resend attempts per 15 minutes per IP
	message: {
		error:
			"Too many verification email requests. Please wait 15 minutes before trying again.",
		retryAfter: 15 * 60, // seconds
	},
	standardHeaders: true,
	legacyHeaders: false,
	skipSuccessfulRequests: false, // Count all requests, not just failed ones
	keyGenerator: req => {
		// Use IP + email combination for more granular rate limiting
		const email = (req.body as { email?: string }).email ?? "unknown";
		return `${req.ip}-${email}`;
	},
});

// Rate limiter for general auth operations (login, register, etc.)
export const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: config.nodeEnv === "development" ? 50 : 10, // More lenient in development
	message: {
		error:
			"Too many authentication attempts. Please wait 15 minutes before trying again.",
		retryAfter: 15 * 60,
	},
	standardHeaders: true,
	legacyHeaders: false,
	skipSuccessfulRequests: true, // Only count failed attempts
});

// Rate limiter for password reset requests
export const passwordResetLimiter = rateLimit({
	windowMs: 60 * 60 * 1000, // 1 hour
	max: 3, // Maximum 3 password reset requests per hour per IP
	message: {
		error:
			"Too many password reset requests. Please wait 1 hour before trying again.",
		retryAfter: 60 * 60,
	},
	standardHeaders: true,
	legacyHeaders: false,
	skipSuccessfulRequests: false,
	keyGenerator: req => {
		const email = (req.body as { email?: string }).email ?? "unknown";
		return `${req.ip}-${email}`;
	},
});
