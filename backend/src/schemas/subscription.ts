import { z } from "zod";

// Subscription management schemas using Zod 4 features
export const createSubscriptionSchema = z
	.object({
		userId: z.number().int().positive("User ID must be a positive integer"),
		planType: z.enum(["free", "premium", "enterprise"]),
		price: z.number().min(0, "Price must be non-negative").optional(),
		currency: z.string().length(3, "Currency must be 3 characters").optional(),
		paymentMethod: z.string().optional(),
		features: z.record(z.string(), z.any()).optional(),
	})
	.describe("Subscription creation data");

export const updateSubscriptionSchema = z
	.object({
		planType: z.enum(["free", "premium", "enterprise"]).optional(),
		price: z.number().min(0, "Price must be non-negative").optional(),
		currency: z.string().length(3, "Currency must be 3 characters").optional(),
		paymentMethod: z.string().optional(),
		features: z.record(z.string(), z.any()).optional(),
		autoRenew: z.boolean().optional(),
	})
	.describe("Subscription update data");

export const subscriptionIdSchema = z
	.object({
		id: z
			.string()
			.regex(/^\d+$/, "Subscription ID must be a number")
			.transform(Number),
	})
	.describe("Subscription ID parameter");

// Auto-generated TypeScript types using Zod 4's improved inference
export type CreateSubscriptionRequest = z.infer<
	typeof createSubscriptionSchema
>;
export type UpdateSubscriptionRequest = z.infer<
	typeof updateSubscriptionSchema
>;
export type SubscriptionIdParams = z.infer<typeof subscriptionIdSchema>;
