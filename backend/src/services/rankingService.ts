import type {
	CanonicalOpportunity,
	RankedOpportunity,
	RankingWeights,
	UserSearchPreferences,
} from "../types/canonicalOpportunity";

function normalize(value: number, min: number, max: number): number {
	if (Number.isNaN(value) || !Number.isFinite(value)) {
		return 0;
	}
	if (max <= min) {
		return 0;
	}
	return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

function computeTextMatchScore(
	text: string | undefined,
	keyword: string | undefined
): number {
	if (!text || !keyword) {
		return 0;
	}
	const t = text.toLowerCase();
	const k = keyword.toLowerCase();
	if (t.includes(k)) {
		return 1;
	}
	return 0;
}

function daysUntil(dateIso?: string | null): number | null {
	if (!dateIso) {
		return null;
	}
	const d = new Date(dateIso).getTime();
	if (Number.isNaN(d)) {
		return null;
	}
	const now = Date.now();
	return Math.round((d - now) / (1000 * 60 * 60 * 24));
}

function applyWeights(base: number, weight: number): number {
	return base * weight;
}

export function rankOpportunities(
	opportunities: CanonicalOpportunity[],
	options: {
		keyword?: string;
		preferences?: UserSearchPreferences;
		awardStats?: { medianAmount?: number; averageOffers?: number };
	}
): RankedOpportunity[] {
	const weights: RankingWeights = {
		keywordInTitle: 3,
		keywordInDescription: 1,
		naicsExactMatch: 3,
		setAsideMatch: 2,
		recency: 2,
		deadlineProximity: 2,
		hasCoreDocs: 1,
		awardAmountProximity: 2,
		competitionDensity: 1,
		preferenceMatch: 3,
		...(options.preferences?.rankingWeights ?? {}),
	};

	const { keyword } = options;

	const ranked: RankedOpportunity[] = opportunities.map(opp => {
		let score = 0;
		const why: string[] = [];

		const titleMatch = computeTextMatchScore(opp.title, keyword);
		score += applyWeights(titleMatch, weights.keywordInTitle);
		if (titleMatch > 0) {
			why.push("Exact/strong keyword in title");
		}

		const descMatch = computeTextMatchScore(opp.description, keyword);
		score += applyWeights(descMatch, weights.keywordInDescription);
		if (descMatch > 0) {
			why.push("Keyword in description");
		}

		if (
			keyword &&
			opp.naicsCode &&
			options.preferences?.naicsCodes?.includes(opp.naicsCode)
		) {
			score += weights.naicsExactMatch;
			why.push("NAICS matches preference");
		}

		if (
			opp.setAside &&
			options.preferences?.setAsides?.length &&
			options.preferences.setAsides.includes(opp.setAside)
		) {
			score += weights.setAsideMatch;
			why.push("Set-aside matches preference");
		}

		// Recency: newer postedDate is better
		if (opp.postedDate) {
			const days = daysUntil(opp.postedDate);
			if (typeof days === "number") {
				const recencyScore = 1 - normalize(Math.abs(days), 0, 60);
				score += applyWeights(recencyScore, weights.recency);
				if (recencyScore > 0.5) {
					why.push("Recently posted");
				}
			}
		}

		// Deadline proximity: nearer but not past
		const d = daysUntil(opp.responseDeadline);
		if (typeof d === "number" && d >= 0) {
			const deadlineScore = 1 - normalize(d, 0, 30);
			score += applyWeights(deadlineScore, weights.deadlineProximity);
			if (deadlineScore > 0.5) {
				why.push("Upcoming deadline");
			}
		}

		// Attachments heuristic
		if (opp.hasAttachments) {
			score +=
				weights.hasCoreDocs * Math.min(1, (opp.attachmentsCount ?? 1) / 3);
			why.push("Has attachments");
		}

		// Award proximity to median
		if (
			typeof opp.estimatedValue === "number" &&
			options.awardStats?.medianAmount
		) {
			const diff = Math.abs(
				opp.estimatedValue - options.awardStats.medianAmount
			);
			const prox =
				1 - normalize(diff, 0, Math.max(options.awardStats.medianAmount, 1));
			score += applyWeights(prox, weights.awardAmountProximity);
			if (prox > 0.5) {
				why.push("Estimated value near market median");
			}
		}

		// Competition proxy (if available)
		if (typeof options.awardStats?.averageOffers === "number") {
			const comp = options.awardStats.averageOffers;
			const density = 1 - normalize(comp, 1, 10); // fewer offers → higher score
			score += applyWeights(density, weights.competitionDensity);
			if (density > 0.5) {
				why.push("Lower expected competition");
			}
		}

		// Agency/NAICS preferences boosts
		if (
			options.preferences?.agencyCodes?.length &&
			opp.agencyCode &&
			options.preferences.agencyCodes.includes(opp.agencyCode)
		) {
			score += weights.preferenceMatch;
			why.push("Preferred agency");
		}

		return { ...opp, score, whyRanked: why };
	});

	return ranked.sort((a, b) => b.score - a.score);
}
