import { z } from "zod";

// Opportunity search schemas using Zod 4 features
export const searchFiltersSchema = z
	.object({
		keyword: z.string().optional(),
		naicsCode: z.string().optional(),
		agency: z.string().optional(),
		postedFrom: z.string().optional(),
		postedTo: z.string().optional(),
		responseDeadlineFrom: z.string().optional(),
		responseDeadlineTo: z.string().optional(),
		setAside: z.string().optional(),
		type: z.string().optional(),
		status: z.string().optional(),
		teamId: z.string().regex(/^\d+$/).transform(Number).optional(),
		limit: z.string().regex(/^\d+$/).transform(Number).optional(),
		offset: z.string().regex(/^\d+$/).transform(Number).optional(),
	})
	.describe("Opportunity search filters");

export const liveSearchSchema = z
	.object({
		keyword: z.string().optional(),
		naicsCode: z.string().optional(),
		agency: z.string().optional(),
		status: z.string().optional(),
		type: z.string().optional(),
		setAside: z.string().optional(),
		postedFrom: z.string().optional(),
		postedTo: z.string().optional(),
		responseDeadlineFrom: z.string().optional(),
		responseDeadlineTo: z.string().optional(),
		limit: z.number().min(1).max(100).default(20),
	})
	.describe("Live opportunity search parameters");

export const opportunityIdSchema = z
	.object({
		id: z
			.string()
			.regex(/^\d+$/, "Opportunity ID must be a number")
			.transform(Number),
	})
	.describe("Opportunity ID parameter");

export const updateDescriptionSchema = z
	.object({
		description: z.string().min(1, "Description is required"),
	})
	.describe("Opportunity description update");

// Filter management schemas
export const filterCriteriaSchema = z
	.object({
		keywords: z.array(z.string()).optional(),
		naicsCodes: z.array(z.string()).optional(),
		agencies: z.array(z.string()).optional(),
		setAsides: z.array(z.string()).optional(),
		types: z.array(z.string()).optional(),
		locations: z.array(z.string()).optional(),
		postedFrom: z.string().optional(),
		postedTo: z.string().optional(),
		responseDeadlineFrom: z.string().optional(),
		responseDeadlineTo: z.string().optional(),
		estimatedValueMin: z.number().min(0).optional(),
		estimatedValueMax: z.number().min(0).optional(),
		classificationCodes: z.array(z.string()).optional(),
	})
	.describe("Filter criteria");

export const filterNotificationSettingsSchema = z
	.object({
		notifyOnNewOpportunities: z.boolean().default(false),
		notifyOnDeadlineReminder: z.boolean().default(false),
		deadlineReminderDays: z
			.array(z.number().int().min(1).max(30))
			.default([7, 3, 1]),
	})
	.describe("Filter notification settings");

export const createFilterSchema = z
	.object({
		name: z
			.string()
			.min(1, "Filter name is required")
			.max(100, "Filter name must be 100 characters or less"),
		description: z
			.string()
			.max(500, "Description must be 500 characters or less")
			.optional(),
		criteria: filterCriteriaSchema,
		teamId: z.number().int().positive().optional(),
		pollingInterval: z.number().int().min(300).max(86400).default(3600), // 5 minutes to 24 hours
		notificationSettings: filterNotificationSettingsSchema.optional(),
	})
	.describe("Filter creation data");

export const updateFilterSchema = z
	.object({
		name: z
			.string()
			.min(1, "Filter name is required")
			.max(100, "Filter name must be 100 characters or less")
			.optional(),
		description: z
			.string()
			.max(500, "Description must be 500 characters or less")
			.optional(),
		criteria: filterCriteriaSchema.optional(),
		pollingInterval: z.number().int().min(300).max(86400).optional(),
		notificationSettings: filterNotificationSettingsSchema.optional(),
		isActive: z.boolean().optional(),
	})
	.describe("Filter update data");

export const filterIdSchema = z
	.object({
		id: z
			.string()
			.regex(/^\d+$/, "Filter ID must be a number")
			.transform(Number),
	})
	.describe("Filter ID parameter");

// Auto-generated TypeScript types using Zod 4's improved inference
export type SearchFiltersRequest = z.infer<typeof searchFiltersSchema>;
export type LiveSearchRequest = z.infer<typeof liveSearchSchema>;
export type OpportunityIdParams = z.infer<typeof opportunityIdSchema>;
export type UpdateDescriptionRequest = z.infer<typeof updateDescriptionSchema>;
export type FilterCriteria = z.infer<typeof filterCriteriaSchema>;
export type FilterNotificationSettings = z.infer<
	typeof filterNotificationSettingsSchema
>;
export type CreateFilterRequest = z.infer<typeof createFilterSchema>;
export type UpdateFilterRequest = z.infer<typeof updateFilterSchema>;
export type FilterIdParams = z.infer<typeof filterIdSchema>;
