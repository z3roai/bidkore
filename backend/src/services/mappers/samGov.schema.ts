import { z } from "zod";

// Strict schema for SAM.gov opportunitiesData item
export const SamGovOpportunitySchema = z.object({
	noticeId: z.string(),
	title: z.string(),
	solicitationNumber: z.string().nullable().optional(),
	fullParentPathName: z.string().nullable().optional(),
	fullParentPathCode: z.string().nullable().optional(),
	postedDate: z.string().nullable().optional(),
	type: z.string().nullable().optional(),
	baseType: z.string().nullable().optional(),
	archiveType: z.string().nullable().optional(),
	archiveDate: z.string().nullable().optional(),
	typeOfSetAsideDescription: z.string().nullable().optional(),
	typeOfSetAside: z.string().nullable().optional(),
	responseDeadLine: z.string().nullable().optional(),
	naicsCode: z.string().nullable().optional(),
	naicsCodes: z.array(z.any()).optional(),
	classificationCode: z.string().nullable().optional(),
	active: z.string().nullable().optional(),
	award: z
		.object({
			number: z.string().nullable().optional(),
			amount: z
				.union([z.number(), z.string()])
				.nullable()
				.optional()
				.transform(val => {
					if (typeof val === "string") {
						const parsed = Number.parseFloat(val);
						return Number.isNaN(parsed) ? undefined : parsed;
					}
					return val;
				}),
			date: z.string().nullable().optional(),
			awardee: z
				.object({
					name: z.string().nullable().optional(),
					ueiSAM: z.string().nullable().optional(),
					location: z
						.object({
							streetAddress: z.string().nullable().optional(),
							streetAddress2: z.string().nullable().optional(),
							city: z
								.object({
									code: z.string().nullable().optional(),
									name: z.string().nullable().optional(),
								})
								.nullable()
								.optional(),
							state: z
								.object({
									code: z.string().nullable().optional(),
									name: z.string().nullable().optional(),
								})
								.nullable()
								.optional(),
							country: z
								.object({
									code: z.string().nullable().optional(),
									name: z.string().nullable().optional(),
								})
								.nullable()
								.optional(),
							zip: z.string().nullable().optional(),
						})
						.nullable()
						.optional(),
				})
				.nullable()
				.optional(),
		})
		.nullable()
		.optional(),
	pointOfContact: z
		.union([
			z.string(),
			z.array(
				z.object({
					type: z.string().nullable().optional(),
					title: z.string().nullable().optional(),
					fullname: z.string().nullable().optional(),
					fullName: z.string().nullable().optional(), // Support both field names
					email: z.string().nullable().optional(),
					phone: z.string().nullable().optional(),
					fax: z.string().nullable().optional(),
					additionalInfo: z
						.array(
							z.object({
								content: z.string().optional(),
							})
						)
						.optional(),
				})
			),
		])
		.nullable()
		.optional(),
	description: z.string().optional(),
	organizationType: z.string().optional(),
	officeAddress: z
		.object({
			city: z.string().nullable().optional(),
			state: z.string().nullable().optional(),
			zip: z.string().nullable().optional(),
			zipcode: z.string().nullable().optional(),
			countryCode: z.string().nullable().optional(),
		})
		.nullable()
		.optional(),
	placeOfPerformance: z
		.object({
			streetAddress: z.string().optional(),
			streetAddress2: z.string().optional(),
			city: z
				.object({
					code: z.string().optional(),
					name: z.string().optional(),
				})
				.optional(),
			state: z
				.object({
					code: z.string().optional(),
					name: z.string().optional(),
				})
				.optional(),
			country: z
				.object({
					code: z.string().optional(),
					name: z.string().optional(),
				})
				.optional(),
			zip: z.string().optional(),
		})
		.nullable()
		.optional(),
	additionalInfoLink: z.string().nullable().optional(),
	uiLink: z.string().optional(),
	// Some SAM.gov fields inconsistently return null; coerce to empty arrays
	links: z
		.preprocess(
			(val: unknown) => (Array.isArray(val) ? (val as unknown[]) : []),
			z.array(z.unknown())
		)
		.optional(),
	resourceLinks: z
		.preprocess(
			(val: unknown) => (Array.isArray(val) ? (val as unknown[]) : []),
			z.array(z.unknown())
		)
		.optional(),
});

export type SamGovOpportunity = z.infer<typeof SamGovOpportunitySchema>;
