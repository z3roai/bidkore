import { z } from "zod";

// User management schemas using Zod 4 features
export const updateProfileSchema = z
	.object({
		firstName: z
			.string()
			.min(1, "First name is required")
			.max(50, "First name must be 50 characters or less")
			.optional(),
		lastName: z
			.string()
			.min(1, "Last name is required")
			.max(50, "Last name must be 50 characters or less")
			.optional(),
	})
	.describe("User profile update data");

export const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, "Current password is required"),
		newPassword: z.string().min(6, "Password must be at least 6 characters"),
	})
	.describe("Password change data");

export const userIdSchema = z
	.object({
		id: z.string().uuid("User ID must be a valid UUID"),
	})
	.describe("User ID parameter");

// Auto-generated TypeScript types using Zod 4's improved inference
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;
export type UserIdParams = z.infer<typeof userIdSchema>;
