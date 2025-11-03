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

const DEFAULT_SETTINGS = {
	emailNotifications: true,
	pushNotifications: true,
	weeklyDigest: false,
	marketingEmails: false,
	theme: "Light",
	sidebarDisplay: "Expanded",
	language: "English (US)",
	timezone: "Pacific Time (PT)",
	sessionTimeout: true,
} as const;

export type UserSettings = typeof DEFAULT_SETTINGS;

export async function getUserSettings(userId: string): Promise<UserSettings> {
	try {
		if (typeof prisma.userPreferences?.findUnique !== "function") {
			return { ...DEFAULT_SETTINGS };
		}

		const record = (await prisma.userPreferences.findUnique({
			where: { userId },
		})) as UserPreferencesRecord;

		const raw =
			record?.searchPreferences &&
			typeof record.searchPreferences === "object"
				? (record.searchPreferences as Record<string, unknown>)
				: {};

		const keys = Object.keys(DEFAULT_SETTINGS) as (keyof UserSettings)[];
		const merged: Partial<UserSettings> = {};
		for (const key of keys) {
			const value = raw[key as string];
			(merged as Record<string, unknown>)[key] =
				value !== undefined ? value : DEFAULT_SETTINGS[key];
		}

		return merged as UserSettings;
	} catch (error) {
		loggingService.error("Error fetching user settings:", error);
		return { ...DEFAULT_SETTINGS };
	}
}

export async function upsertUserSettings(
	userId: string,
	partial: Partial<UserSettings>
): Promise<UserSettings> {
	try {
		if (
			typeof prisma.userPreferences?.upsert !== "function" ||
			typeof prisma.userPreferences?.findUnique !== "function"
		) {
			return { ...DEFAULT_SETTINGS, ...partial };
		}

		const existing = (await prisma.userPreferences.findUnique({
			where: { userId },
		})) as UserPreferencesRecord;

		const currentPrefs: Record<string, unknown> =
			existing?.searchPreferences &&
			typeof existing.searchPreferences === "object"
				? (existing.searchPreferences as Record<string, unknown>)
				: {};

		const nextSearchPreferences = {
			...currentPrefs,
			...partial,
		};

		await prisma.userPreferences.upsert({
			where: { userId },
			update: { searchPreferences: nextSearchPreferences },
			create: { userId, searchPreferences: nextSearchPreferences },
		});

		const keys = Object.keys(DEFAULT_SETTINGS) as (keyof UserSettings)[];
		const result: Partial<UserSettings> = {};
		for (const key of keys) {
			(result as Record<string, unknown>)[key] =
				nextSearchPreferences[key] ?? DEFAULT_SETTINGS[key];
		}

		return result as UserSettings;
	} catch (error) {
		loggingService.error("Error upserting user settings:", error);
		return { ...DEFAULT_SETTINGS };
	}
}