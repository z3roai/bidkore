import { z } from "zod";

export const generateProposalSchema = z.object({
	opportunityId: z.string().uuid("Invalid opportunity ID format"),
});

export const updateProposalSchema = z.object({
	title: z.string().min(1, "Title is required").max(500).optional(),
	sections: z
		.object({
			executiveSummary: z.string().optional(),
			technicalApproach: z.string().optional(),
			pastPerformance: z.string().optional(),
			keyPersonnel: z.string().optional(),
			managementPlan: z.string().optional(),
		})
		.optional(),
	status: z
		.enum(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "REJECTED"])
		.optional(),
});

export const generateSectionSchema = z.object({
	sectionName: z.enum([
		"executiveSummary",
		"technicalApproach",
		"pastPerformance",
		"keyPersonnel",
		"managementPlan",
	]),
	opportunityId: z.string().uuid("Invalid opportunity ID format"),
	existingContent: z.string().optional(),
});

export const improveTextSchema = z.object({
	text: z.string().min(10, "Text must be at least 10 characters"),
	opportunityId: z.string().uuid().optional(),
	sectionType: z.string().optional(),
});

export const extractRequirementsSchema = z.object({
	opportunityId: z.string().uuid("Invalid opportunity ID format"),
});

export const proposalIdSchema = z.object({
	id: z.string().uuid("Invalid proposal ID format"),
});

export type GenerateProposalInput = z.infer<typeof generateProposalSchema>;
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;
export type GenerateSectionInput = z.infer<typeof generateSectionSchema>;
export type ImproveTextInput = z.infer<typeof improveTextSchema>;
export type ExtractRequirementsInput = z.infer<
	typeof extractRequirementsSchema
>;
export type ProposalIdInput = z.infer<typeof proposalIdSchema>;
