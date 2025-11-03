import { z } from "zod";

// Team management schemas using Zod 4 features
export const createTeamSchema = z
	.object({
		name: z
			.string()
			.min(1, "Team name is required")
			.max(100, "Team name must be 100 characters or less"),
		description: z
			.string()
			.max(500, "Description must be 500 characters or less")
			.optional(),
		purpose: z
			.string()
			.min(1, "Purpose is required")
			.max(200, "Purpose must be 200 characters or less"),
	})
	.describe("Team creation data");

export const updateTeamSchema = z
	.object({
		name: z
			.string()
			.min(1, "Team name is required")
			.max(100, "Team name must be 100 characters or less")
			.optional(),
		description: z
			.string()
			.max(500, "Description must be 500 characters or less")
			.optional(),
		purpose: z
			.string()
			.min(1, "Purpose is required")
			.max(200, "Purpose must be 200 characters or less")
			.optional(),
		isActive: z.boolean().optional(),
	})
	.describe("Team update data");

export const teamIdSchema = z
	.object({
		id: z.string().regex(/^\d+$/, "Team ID must be a number").transform(Number),
	})
	.describe("Team ID parameter");

export const inviteTeamMemberSchema = z
	.object({
		email: z.string().email("Invalid email format"),
		role: z.enum(["owner", "admin", "member"]),
		customMessage: z
			.string()
			.max(200, "Custom message must be 200 characters or less")
			.optional(),
	})
	.describe("Team member invitation data");

export const updateTeamMemberRoleSchema = z
	.object({
		role: z.enum(["owner", "admin", "member"]),
	})
	.describe("Team member role update data");

// Auto-generated TypeScript types using Zod 4's improved inference
export type CreateTeamRequest = z.infer<typeof createTeamSchema>;
export type UpdateTeamRequest = z.infer<typeof updateTeamSchema>;
export type TeamIdParams = z.infer<typeof teamIdSchema>;
export type InviteTeamMemberRequest = z.infer<typeof inviteTeamMemberSchema>;
export type UpdateTeamMemberRoleRequest = z.infer<
	typeof updateTeamMemberRoleSchema
>;
