export interface CanonicalOpportunity {
	noticeId: string;
	title: string;
	description?: string;
	agencyName?: string;
	agencyCode?: string;
	naicsCode?: string;
	classificationCode?: string;
	solicitationNumber?: string;
	postedDate?: string;
	responseDeadline?: string | null;
	status?: string;
	setAside?: string;
	setAsideDescription?: string;
	type?: string;
	baseType?: string;
	archiveType?: string;
	archiveDate?: string;
	location?: string;
	estimatedValue?: number | null;
	uiLink?: string;
	pointOfContact?: string;
	hasAttachments?: boolean;
	attachmentsCount?: number;
	historicalAwardsCount?: number;
	averageHistoricalAwardAmount?: number;
	competitionAverageOffers?: number;
}

export interface RankingWeights {
	keywordInTitle: number;
	keywordInDescription: number;
	naicsExactMatch: number;
	setAsideMatch: number;
	recency: number;
	deadlineProximity: number;
	hasCoreDocs: number;
	awardAmountProximity: number;
	competitionDensity: number;
	preferenceMatch: number;
}

export interface RankedOpportunity extends CanonicalOpportunity {
	score: number;
	whyRanked: string[];
}

export interface UserSearchPreferences {
	naicsCodes?: string[];
	agencyCodes?: string[];
	setAsides?: string[];
	regions?: {
		country?: string;
		state?: string;
		city?: string;
		zip?: string;
		radiusMiles?: number;
	}[];
	budgetBands?: { min?: number; max?: number }[];
	excludedTerms?: string[];
	queryExpansionEnabled?: boolean;
	rankingWeights?: Partial<RankingWeights>;
}
