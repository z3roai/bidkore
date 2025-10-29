import { z } from "zod";

import { TeamRole } from "@/models";

export const addMemberSchema = z.object({
	userId: z.string(),
	role: z.enum(["owner", "admin", "member"]).optional(),
});

export const inviteMembersSchema = z.object({
	invitations: z
		.array(
			z.object({
				email: z.string().email(),
				role: z.enum(["owner", "admin", "member"]),
				customMessage: z.string().max(500).optional(),
			})
		)
		.min(1)
		.max(50),
});

export const bulkInviteSchema = z.object({
	emails: z.array(z.string().email()).min(1).max(50),
	defaultRole: z.enum(["owner", "admin", "member"]),
	customMessage: z.string().max(500).optional(),
});

export const teamWizardSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
	purpose: z.string().min(1).max(500),
	suggestedRoles: z
		.array(
			z.object({
				email: z.string().email(),
				suggestedRole: z.enum(["owner", "admin", "member"]).transform(role => {
					switch (role) {
						case "owner":
							return TeamRole.OWNER;
						case "admin":
							return TeamRole.ADMIN;
						case "member":
							return TeamRole.MEMBER;
						default:
							return TeamRole.MEMBER;
					}
				}),
				confidence: z.number().min(0).max(1),
				reasoning: z.string(),
			})
		)
		.optional(),
	invitations: z
		.array(
			z.object({
				email: z.string().email(),
				role: z.enum(["owner", "admin", "member"]).transform(role => {
					switch (role) {
						case "owner":
							return TeamRole.OWNER;
						case "admin":
							return TeamRole.ADMIN;
						case "member":
							return TeamRole.MEMBER;
						default:
							return TeamRole.MEMBER;
					}
				}),
				customMessage: z.string().max(500).optional(),
			})
		)
		.max(50)
		.optional(),
	confirmCreation: z.boolean().optional(),
});

export const chatMessageSchema = z.object({
	message: z.string().min(1).max(2000),
	messageType: z.enum(["text", "system", "notification"]).optional(),
	replyTo: z.string().optional(),
	metadata: z.object({}).optional(),
});
