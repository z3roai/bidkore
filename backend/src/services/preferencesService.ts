import type {
	RankingWeights,
	UserSearchPreferences,
} from "../types/canonicalOpportunity";

import prisma from "@/config/prisma";
import loggingService from "@/services/loggingService";

// Type for the UserPreferences record from Prisma
type UserPreferencesRecord = {
	searchPreferences: unknown;
	rankingWeights: unknown;
} | null;

const DEFAULT_WEIGHTS: RankingWeights = {
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
};

export async function getUserPreferences(
	userId: string
): Promise<UserSearchPreferences> {
	try {
		// Guard: if the prisma model is not generated/available, return defaults silently
		if (typeof prisma.userPreferences?.findUnique !== "function") {
			return { rankingWeights: DEFAULT_WEIGHTS };
		}

		const record = (await prisma.userPreferences.findUnique({
			where: { userId },
		})) as UserPreferencesRecord;
		if (!record) {
			return { rankingWeights: DEFAULT_WEIGHTS };
		}
		// Type guard to ensure searchPreferences is a valid object
		const searchPreferences =
			record.searchPreferences && typeof record.searchPreferences === "object"
				? (record.searchPreferences as Partial<UserSearchPreferences>)
				: {};

		// Type guard to ensure rankingWeights is a valid object
		const rankingWeights =
			record.rankingWeights && typeof record.rankingWeights === "object"
				? (record.rankingWeights as Partial<RankingWeights>)
				: {};

		const mergedRankingWeights = {
			...DEFAULT_WEIGHTS,
			...rankingWeights,
		};
		return {
			...searchPreferences,
			rankingWeights: mergedRankingWeights,
		};
	} catch (error) {
		loggingService.error("Error fetching user preferences:", error);
		// Return default preferences if database is unavailable
		return { rankingWeights: DEFAULT_WEIGHTS };
	}
}
