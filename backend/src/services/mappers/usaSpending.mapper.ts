import {
	type UsaSpendingAward,
	UsaSpendingAwardSchema,
} from "@/services/mappers/usaSpending.schema";

export interface AwardStats {
	count: number;
	medianAmount?: number | null;
	averageAmount?: number | null;
	q1?: number | null;
	q3?: number | null;
	averageOffers?: number | null;
}

export function computeAwardStats(rawAwards: unknown[]): AwardStats {
	const awards: UsaSpendingAward[] = [];
	for (const a of rawAwards) {
		const parsed = UsaSpendingAwardSchema.safeParse(a);
		if (parsed.success) {
			awards.push(parsed.data);
		}
	}

	const amounts = awards
		.map(a => a.award_amount)
		.filter((v): v is number => typeof v === "number" && !Number.isNaN(v))
		.sort((a, b) => a - b);

	const offers = awards
		.map(a => a.number_of_offers_received)
		.filter((v): v is number => typeof v === "number" && !Number.isNaN(v));

	const count = awards.length;
	if (count === 0) {
		return { count: 0 };
	}

	const averageAmount =
		amounts.length > 0
			? amounts.reduce((s, v) => s + v, 0) / amounts.length
			: null;
	let medianAmount: number | null = null;
	if (amounts.length > 0) {
		if (amounts.length % 2 === 1) {
			const midValue = amounts[(amounts.length - 1) >> 1];
			medianAmount = midValue ?? null;
		} else {
			const mid1 = amounts[amounts.length / 2 - 1];
			const mid2 = amounts[amounts.length / 2];
			if (mid1 !== undefined && mid2 !== undefined) {
				medianAmount = (mid1 + mid2) / 2;
			}
		}
	}

	const q1 =
		amounts.length > 0
			? amounts[Math.floor(amounts.length * 0.25)] ?? null
			: null;
	const q3 =
		amounts.length > 0
			? amounts[Math.floor(amounts.length * 0.75)] ?? null
			: null;

	const averageOffers = offers.length
		? Math.round(offers.reduce((s, v) => s + v, 0) / offers.length)
		: null;

	return { count, medianAmount, averageAmount, q1, q3, averageOffers };
}
