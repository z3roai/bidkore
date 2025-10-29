import { z } from "zod";

export const UsaSpendingAwardSchema = z.object({
	id: z.string(),
	award_id: z.string().optional(),
	recipient_name: z.string().optional(),
	recipient_uei: z.string().optional(),
	recipient_duns: z.string().optional(),
	award_amount: z.number().optional(),
	award_type: z.string().optional(),
	date_signed: z.string().optional(),
	naics_code: z.string().optional(),
	naics_description: z.string().optional(),
	place_of_performance: z
		.object({
			state_name: z.string().optional(),
			city_name: z.string().optional(),
			country_name: z.string().optional(),
		})
		.optional(),
	funding_agency: z
		.object({ name: z.string().optional(), code: z.string().optional() })
		.optional(),
	awarding_agency: z
		.object({ name: z.string().optional(), code: z.string().optional() })
		.optional(),
	description: z.string().optional(),
	contract_award_type: z.string().optional(),
	competition_type: z.string().optional(),
	number_of_offers_received: z.number().optional(),
	small_business_competitive: z.boolean().optional(),
	set_aside_type: z.string().optional(),
	sub_agency: z.string().optional(),
	prime_awardee: z
		.object({ name: z.string().optional(), uei: z.string().optional() })
		.optional(),
	sub_awardee: z
		.object({ name: z.string().optional(), uei: z.string().optional() })
		.optional(),
});

export type UsaSpendingAward = z.infer<typeof UsaSpendingAwardSchema>;
