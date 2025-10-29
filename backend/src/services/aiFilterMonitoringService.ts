import type { Prisma } from "@prisma/client";

import type { FilterData } from "@/services/filterService";
import loggingService from "@/services/loggingService";

// Extended FilterData interface for AI-specific properties
interface AIFilterData extends FilterData {
	naturalLanguageDescription?: string;
}

export interface AIFilterMetrics {
	filterId: string;
	filterName: string;
	isAIGenerated: boolean;
	naturalLanguageLength: number;
	criteriaComplexity: number;
	pollingFrequency: number;
	successRate: number;
	opportunityCount: number;
	lastPolledAt: Date | null;
	createdAt: Date;
	performanceScore: number;
}

// Type for cached metrics with timestamp
interface CachedAIFilterMetrics extends AIFilterMetrics {
	_cachedAt: number;
}

// Type for criteria object - handles Prisma JsonValue
type FilterCriteria = Prisma.JsonValue;

// Type for trends object
interface FilterTrends {
	avgSuccessRate: number;
	avgPollingFrequency: number;
	avgCriteriaComplexity: number;
}

export interface PerformanceReport {
	totalFilters: number;
	aiGeneratedFilters: number;
	avgPerformanceScore: number;
	topPerformers: AIFilterMetrics[];
	underPerformers: AIFilterMetrics[];
	recommendations: string[];
	trends: {
		avgSuccessRate: number;
		avgPollingFrequency: number;
		avgCriteriaComplexity: number;
	};
}

class AIFilterMonitoringService {
	private readonly metricsCache = new Map<string, CachedAIFilterMetrics>();
	private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
	private readonly TOP_PERFORMER_THRESHOLD = 0.8;
	private readonly UNDER_PERFORMER_THRESHOLD = 0.3;

	/**
	 * Collects comprehensive metrics for AI-generated filters
	 */
	collectAIFilterMetrics(filter: FilterData): AIFilterMetrics {
		const cacheKey = filter.id;
		const cached = this.metricsCache.get(cacheKey);

		if (cached && this.isCacheValid(cached)) {
			// Return the cached metrics without the _cachedAt property
			const { _cachedAt, ...metrics } = cached;
			return metrics;
		}

		const aiFilter = filter as AIFilterData;
		const isAIGenerated = Boolean(aiFilter.naturalLanguageDescription);
		const naturalLanguageLength =
			aiFilter.naturalLanguageDescription?.length ?? 0;

		// Calculate criteria complexity
		const criteriaComplexity = this.calculateCriteriaComplexity(
			filter.criteria
		);

		// Calculate polling frequency (polls per day)
		const pollingFrequency =
			(filter.searchCount ?? 0) > 0 && filter.lastPolledAt
				? (filter.searchCount ?? 0) /
				  Math.max(this.getDaysSince(filter.lastPolledAt), 1)
				: 0;

		// Calculate success rate
		const successRate =
			(filter.searchCount ?? 0) > 0
				? (filter.opportunityCount ?? 0) / (filter.searchCount ?? 0)
				: 0;

		// Calculate performance score (0-1)
		const performanceScore = this.calculatePerformanceScore({
			successRate,
			pollingFrequency,
			criteriaComplexity,
			opportunityCount: filter.opportunityCount ?? 0,
		});

		const metrics: AIFilterMetrics = {
			filterId: filter.id,
			filterName: filter.name,
			isAIGenerated,
			naturalLanguageLength,
			criteriaComplexity,
			pollingFrequency,
			successRate,
			opportunityCount: filter.opportunityCount ?? 0,
			lastPolledAt: filter.lastPolledAt ?? null,
			createdAt: filter.createdAt ?? new Date(),
			performanceScore,
		};

		// Cache the metrics
		const cachedMetrics: CachedAIFilterMetrics = {
			...metrics,
			_cachedAt: Date.now(),
		};
		this.metricsCache.set(cacheKey, cachedMetrics);

		return metrics;
	}

	/**
	 * Generates comprehensive performance report
	 */
	generatePerformanceReport(filters: FilterData[]): PerformanceReport {
		const allMetrics = filters.map(filter =>
			this.collectAIFilterMetrics(filter)
		);

		const aiGeneratedMetrics = allMetrics.filter(m => m.isAIGenerated);
		const avgPerformanceScore =
			allMetrics.reduce((sum, m) => sum + m.performanceScore, 0) /
			allMetrics.length;

		// Identify top and under performers
		const topPerformers = allMetrics
			.filter(m => m.performanceScore >= this.TOP_PERFORMER_THRESHOLD)
			.sort((a, b) => b.performanceScore - a.performanceScore)
			.slice(0, 10);

		const underPerformers = allMetrics
			.filter(m => m.performanceScore <= this.UNDER_PERFORMER_THRESHOLD)
			.sort((a, b) => a.performanceScore - b.performanceScore)
			.slice(0, 10);

		// Calculate trends
		const trends = {
			avgSuccessRate:
				allMetrics.reduce((sum, m) => sum + m.successRate, 0) /
				allMetrics.length,
			avgPollingFrequency:
				allMetrics.reduce((sum, m) => sum + m.pollingFrequency, 0) /
				allMetrics.length,
			avgCriteriaComplexity:
				allMetrics.reduce((sum, m) => sum + m.criteriaComplexity, 0) /
				allMetrics.length,
		};

		// Generate recommendations
		const recommendations = this.generateRecommendations(allMetrics, trends);

		const report: PerformanceReport = {
			totalFilters: filters.length,
			aiGeneratedFilters: aiGeneratedMetrics.length,
			avgPerformanceScore,
			topPerformers,
			underPerformers,
			recommendations,
			trends,
		};

		// Log the report
		loggingService.info("AI Filter Performance Report Generated", {
			reportSummary: {
				totalFilters: report.totalFilters,
				aiGeneratedFilters: report.aiGeneratedFilters,
				avgPerformanceScore: report.avgPerformanceScore,
				topPerformersCount: report.topPerformers.length,
				underPerformersCount: report.underPerformers.length,
			},
		});

		return report;
	}

	/**
	 * Tracks AI filter performance during polling
	 */
	trackPollingPerformance(
		filter: FilterData,
		result: { newOpportunities: number; totalOpportunities: number }
	): void {
		const aiFilter = filter as AIFilterData;
		const isAIGenerated = Boolean(aiFilter.naturalLanguageDescription);

		if (isAIGenerated) {
			const metrics = this.collectAIFilterMetrics(filter);

			loggingService.info("AI Filter Polling Performance", {
				filterId: filter.id,
				filterName: filter.name,
				naturalLanguageLength: metrics.naturalLanguageLength,
				criteriaComplexity: metrics.criteriaComplexity,
				newOpportunities: result.newOpportunities,
				totalOpportunities: result.totalOpportunities,
				performanceScore: metrics.performanceScore,
				pollingTime: Date.now() - (filter.lastPolledAt?.getTime() ?? 0),
			});

			// Update cache with new data
			this.metricsCache.delete(filter.id);
		}
	}

	/**
	 * Validates AI filter consistency
	 */
	validateAIFilterConsistency(filters: FilterData[]): {
		inconsistentFilters: { filter: FilterData; issues: string[] }[];
		recommendations: string[];
	} {
		const inconsistentFilters: { filter: FilterData; issues: string[] }[] = [];
		const recommendations: string[] = [];

		for (const filter of filters) {
			const aiFilter = filter as AIFilterData;
			if (!aiFilter.naturalLanguageDescription) continue;

			const issues = this.getFilterConsistencyIssues(aiFilter);

			if (issues.length > 0) {
				inconsistentFilters.push({ filter, issues });
			}
		}

		if (inconsistentFilters.length > 0) {
			recommendations.push(
				"Review AI-generated filters for consistency issues"
			);
			recommendations.push(
				"Consider implementing automatic criteria regeneration"
			);
		}

		if (inconsistentFilters.length > filters.length * 0.1) {
			recommendations.push(
				"High inconsistency rate detected - review AI generation process"
			);
		}

		return { inconsistentFilters, recommendations };
	}

	/**
	 * Helper to check consistency issues for a single filter
	 */
	private getFilterConsistencyIssues(aiFilter: AIFilterData): string[] {
		const issues: string[] = [];
		const { criteria, naturalLanguageDescription } = aiFilter;
		let hasValidCriteria = false;

		if (criteria && typeof criteria === "object" && !Array.isArray(criteria)) {
			hasValidCriteria = Object.values(criteria).some(value => {
				if (Array.isArray(value)) return value.length > 0;
				if (typeof value === "string") return value.trim().length > 0;
				if (typeof value === "number") return value > 0;
				if (typeof value === "boolean") return true;
				if (value instanceof Date) return true;
				return false;
			});
		} else if (Array.isArray(criteria)) {
			hasValidCriteria = criteria.length > 0;
		}

		if (!hasValidCriteria) {
			issues.push("Natural language exists but criteria is empty");
		}

		if (
			criteria &&
			typeof criteria === "object" &&
			!Array.isArray(criteria) &&
			"keywords" in criteria &&
			Array.isArray(criteria["keywords"])
		) {
			const missingKeywords = criteria["keywords"]
				.filter((keyword): keyword is string => typeof keyword === "string")
				.filter(
					keyword =>
						!naturalLanguageDescription
							?.toLowerCase()
							.includes(keyword.toLowerCase())
				);

			if (missingKeywords.length > 0) {
				issues.push(
					`Keywords [${missingKeywords.join(
						", "
					)}] not found in natural language`
				);
			}
		}

		return issues;
	}

	/**
	 * Calculates criteria complexity score
	 */
	private calculateCriteriaComplexity(criteria: FilterCriteria): number {
		if (!criteria || typeof criteria !== "object" || criteria === null) {
			return 0;
		}

		// Handle Prisma JsonValue which can be null, string, number, boolean, array, or object
		if (Array.isArray(criteria)) {
			return Math.min(criteria.length * 0.1, 1);
		}

		if (typeof criteria === "object") {
			let complexity = 0;

			// Count non-empty fields
			const fields = Object.values(criteria);
			const nonEmptyFields = fields.filter(value => {
				if (Array.isArray(value)) {
					return value.length > 0;
				}
				if (typeof value === "string") {
					return value.trim().length > 0;
				}
				if (typeof value === "number") {
					return value > 0;
				}
				if (typeof value === "boolean") {
					return true;
				}
				if (value instanceof Date) {
					return true;
				}
				return false;
			});

			complexity += nonEmptyFields.length * 0.1;

			// Add complexity for array fields
			const arrayFields = fields.filter(Array.isArray);
			complexity += arrayFields.reduce(
				(sum, arr) => sum + arr.length * 0.05,
				0
			);

			// Add complexity for date ranges
			const dateFields = fields.filter(value => value instanceof Date);
			complexity += dateFields.length * 0.2;

			return Math.min(complexity, 1); // Cap at 1
		}

		return 0;
	}

	/**
	 * Calculates overall performance score
	 */
	private calculatePerformanceScore(metrics: {
		successRate: number;
		pollingFrequency: number;
		criteriaComplexity: number;
		opportunityCount: number;
	}): number {
		const {
			successRate,
			pollingFrequency,
			criteriaComplexity,
			opportunityCount,
		} = metrics;

		// Weighted scoring
		const successWeight = 0.4;
		const frequencyWeight = 0.2;
		const complexityWeight = 0.2;
		const opportunityWeight = 0.2;

		// Normalize opportunity count (log scale)
		const normalizedOpportunities = Math.min(
			Math.log10(opportunityCount + 1) / 3,
			1
		);

		const score =
			successRate * successWeight +
			Math.min(pollingFrequency / 2, 1) * frequencyWeight +
			criteriaComplexity * complexityWeight +
			normalizedOpportunities * opportunityWeight;

		return Math.min(Math.max(score, 0), 1);
	}

	/**
	 * Generates recommendations based on metrics
	 */
	private generateRecommendations(
		metrics: AIFilterMetrics[],
		trends: FilterTrends
	): string[] {
		const recommendations: string[] = [];

		if (trends.avgSuccessRate < 0.1) {
			recommendations.push(
				"Low success rate across filters - consider reviewing criteria quality"
			);
		}

		if (trends.avgPollingFrequency > 2) {
			recommendations.push(
				"High polling frequency detected - consider optimizing intervals"
			);
		}

		if (trends.avgCriteriaComplexity < 0.3) {
			recommendations.push(
				"Low criteria complexity - consider adding more specific filters"
			);
		}

		const aiFilters = metrics.filter(m => m.isAIGenerated);
		if (aiFilters.length > 0) {
			const avgAIPerformance =
				aiFilters.reduce((sum, m) => sum + m.performanceScore, 0) /
				aiFilters.length;
			if (avgAIPerformance < 0.5) {
				recommendations.push(
					"AI-generated filters underperforming - review natural language processing"
				);
			}
		}

		return recommendations;
	}

	/**
	 * Gets days since a given date
	 */
	private getDaysSince(date: Date): number {
		return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
	}

	/**
	 * Checks if cached metrics are still valid
	 */
	private isCacheValid(cached: CachedAIFilterMetrics): boolean {
		return Boolean(
			cached._cachedAt && Date.now() - cached._cachedAt < this.CACHE_TTL
		);
	}

	/**
	 * Clears expired cache entries
	 */
	clearExpiredCache(): void {
		const now = Date.now();
		for (const [key, value] of Array.from(this.metricsCache.entries())) {
			if (now - value._cachedAt > this.CACHE_TTL) {
				this.metricsCache.delete(key);
			}
		}
	}
}

export default new AIFilterMonitoringService();
