import entityManagementService, {
	type EntityInfo,
} from "./entityManagementService";
import usaspendingService, {
	type USAspendingAward,
} from "./usaspendingService";

import { redisClient } from "@/config/redis";
import insightsEngine, {
	type OpportunityInsights,
} from "@/services/insightsEngine";
import loggingService from "@/services/loggingService";
import openaiService from "@/services/openaiService";
import samGovService, { type SAMOpportunity } from "@/services/samGovService";
import attachmentService from "./attachmentService";
import descriptionRewritingService from "./descriptionRewritingService";

export interface EnhancedOpportunity {
	// Original SAM.gov data
	samData: SAMOpportunity;

	// Enhanced data from other APIs
	historicalAwards: USAspendingAward[];
	entityInfo: EntityInfo | null;

	// Computed insights
	insights: OpportunityInsights;

	// Metadata
	enhancementTimestamp: string;
	dataSources: string[];
	confidenceScore: number;
}

export interface EnhancementOptions {
	includeHistoricalData?: boolean;
	includeEntityInfo?: boolean;
	includeInsights?: boolean;
	maxHistoricalAwards?: number;
	cacheResults?: boolean;
	cacheTTL?: number; // Time to live in seconds
}

class DataEnhancementService {
	private readonly DEFAULT_CACHE_TTL = 900; // 15 minutes
	private readonly MAX_CONCURRENT_REQUESTS = 5;
	private readonly REQUEST_TIMEOUT = 30000; // 30 seconds

	// Real-time statistics tracking
	private enhancementStats = {
		totalEnhanced: 0,
		totalEnhancementTime: 0,
		cacheHits: 0,
		cacheMisses: 0,
		apiCallStats: {
			samGov: { calls: 0, failures: 0, avgResponseTime: 0 },
			usaspending: { calls: 0, failures: 0, avgResponseTime: 0 },
			entityManagement: { calls: 0, failures: 0, avgResponseTime: 0 },
			insightsEngine: { calls: 0, failures: 0, avgResponseTime: 0 },
		},
	};

	async enhanceOpportunities(
		opportunities: SAMOpportunity[],
		options: EnhancementOptions = {}
	): Promise<EnhancedOpportunity[]> {
		const startTime = Date.now();
		const {
			includeHistoricalData = true,
			includeEntityInfo = true,
			includeInsights = true,
			maxHistoricalAwards = 20,
			cacheResults = true,
			cacheTTL = this.DEFAULT_CACHE_TTL,
		} = options;

		loggingService.info(
			`Enhancing ${opportunities.length} opportunities with options:`,
			options
		);

		const enhancedOpportunities: EnhancedOpportunity[] = [];

		// Process opportunities in batches to avoid overwhelming APIs
		const batchSize = Math.min(
			this.MAX_CONCURRENT_REQUESTS,
			opportunities.length
		);

		for (let i = 0; i < opportunities.length; i += batchSize) {
			const batch = opportunities.slice(i, i + batchSize);

			const batchPromises = batch.map(async opportunity => {
				try {
					return this.enhanceSingleOpportunity(opportunity, {
						includeHistoricalData,
						includeEntityInfo,
						includeInsights,
						maxHistoricalAwards,
						cacheResults,
						cacheTTL,
					});
				} catch (error: unknown) {
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					loggingService.error(
						`Failed to enhance opportunity ${opportunity.noticeId}:`,
						errorMessage
					);

					// Return basic enhancement if full enhancement fails
					return this.createBasicEnhancement(opportunity);
				}
			});

			const batchResults = await Promise.allSettled(batchPromises);

			batchResults.forEach((result, index) => {
				if (result.status === "fulfilled") {
					enhancedOpportunities.push(result.value);
				} else {
					const opportunity = batch[index];
					if (opportunity) {
						loggingService.error(
							`Batch enhancement failed for opportunity ${opportunity.noticeId}:`,
							result.reason
						);
						// Add basic enhancement as fallback
						enhancedOpportunities.push(
							this.createBasicEnhancement(opportunity)
						);
					}
				}
			});

			// Add delay between batches to respect rate limits
			if (i + batchSize < opportunities.length) {
				await new Promise(resolve => setTimeout(resolve, 1000));
			}
		}

		const duration = Date.now() - startTime;

		// Update statistics
		this.enhancementStats.totalEnhanced += enhancedOpportunities.length;
		this.enhancementStats.totalEnhancementTime += duration;

		loggingService.info(
			`Enhanced ${enhancedOpportunities.length} opportunities in ${duration}ms`
		);

		return enhancedOpportunities;
	}

	private async enhanceSingleOpportunity(
		opportunity: SAMOpportunity,
		options: EnhancementOptions
	): Promise<EnhancedOpportunity> {
		const cacheKey = this.generateCacheKey(opportunity, options);

		// Check cache first
		if (options.cacheResults) {
			const cachedResult = await this.getFromCache(cacheKey);
			if (cachedResult) {
				loggingService.debug(
					`Cache hit for opportunity ${opportunity.noticeId}`
				);
				loggingService.debug("Cached insights analysis:", {
					noticeId: opportunity.noticeId,
					hasInsights: !!cachedResult.insights,
					hasRewrittenDescription:
						!!cachedResult.insights?.rewrittenDescription,
					hasAttachmentAnalysis: !!cachedResult.insights?.attachmentAnalysis,
					hasAttachmentLinks: !!cachedResult.insights?.attachmentLinks,
					attachmentLinksCount:
						cachedResult.insights?.attachmentLinks?.length || 0,
				});

				// Check if cached insights need enhanced features update
				if (
					cachedResult.insights &&
					!cachedResult.insights.rewrittenDescription
				) {
					loggingService.debug(
						"Updating cached insights with enhanced features:",
						{
							noticeId: opportunity.noticeId,
						}
					);

					// Generate enhanced analysis features for cached insights
					const [rewrittenDescription, attachmentAnalysis, attachmentLinks] =
						await Promise.allSettled([
							descriptionRewritingService.rewriteDescription(
								opportunity.description || "",
								opportunity.title || "",
								opportunity.naicsCode,
								opportunity.fullParentPathName
							),
							attachmentService.analyzeAttachments(opportunity),
							attachmentService.generateAttachmentLinks(opportunity),
						]);

					// Update cached insights with enhanced features
					cachedResult.insights = {
						...cachedResult.insights,
						...(rewrittenDescription.status === "fulfilled" && {
							rewrittenDescription: rewrittenDescription.value,
						}),
						...(attachmentAnalysis.status === "fulfilled" && {
							attachmentAnalysis: attachmentAnalysis.value,
						}),
						attachmentLinks:
							attachmentLinks.status === "fulfilled"
								? attachmentLinks.value
								: [],
					};

					// Update cache with enhanced insights
					await this.setCache(
						cacheKey,
						cachedResult,
						options.cacheTTL || this.DEFAULT_CACHE_TTL
					);
				}

				return cachedResult;
			}
		}

		const enhancementStartTime = Date.now();

		// Extract key identifiers
		const { naicsCode } = opportunity;
		const agencyCode = this.extractAgencyCode(opportunity);
		const contractorUei = this.extractContractorUei(opportunity);

		// Parallel data collection with timeout
		const dataPromises = [];

		if (options.includeHistoricalData && naicsCode != null) {
			dataPromises.push(
				this.trackApiCall("usaspending", () =>
					this.withTimeout(
						usaspendingService.getSimilarAwards(
							naicsCode,
							agencyCode,
							options.maxHistoricalAwards
						),
						this.REQUEST_TIMEOUT
					)
				).catch((error: unknown) => {
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					loggingService.warn(
						`Failed to get historical awards for ${opportunity.noticeId}:`,
						errorMessage
					);
					return [];
				})
			);
		} else {
			dataPromises.push(Promise.resolve([]));
		}

		if (options.includeEntityInfo && contractorUei != null) {
			dataPromises.push(
				this.trackApiCall("entityManagement", () =>
					this.withTimeout(
						entityManagementService.getEntityByUei(contractorUei),
						this.REQUEST_TIMEOUT
					)
				).catch((error: unknown) => {
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					loggingService.warn(
						`Failed to get entity info for ${opportunity.noticeId}:`,
						errorMessage
					);
					return null;
				})
			);
		} else {
			dataPromises.push(Promise.resolve(null));
		}

		// Wait for data collection
		const [historicalAwards, entityInfo] = await Promise.all(dataPromises);

		// Generate insights
		let insights: OpportunityInsights;
		if (options.includeInsights) {
			try {
				loggingService.debug(
					"Attempting to generate AI insights for opportunity:",
					{
						noticeId: opportunity.noticeId,
						title: opportunity.title,
					}
				);
				insights = await this.trackApiCall("insightsEngine", () =>
					this.withTimeout(
						insightsEngine.generateInsights(opportunity),
						this.REQUEST_TIMEOUT
					)
				);
				loggingService.debug("Successfully generated AI insights:", {
					noticeId: opportunity.noticeId,
					hasRewrittenDescription: !!insights.rewrittenDescription,
					hasAttachmentAnalysis: !!insights.attachmentAnalysis,
					hasAttachmentLinks: !!insights.attachmentLinks,
					attachmentLinksCount: insights.attachmentLinks?.length || 0,
				});
			} catch (error: unknown) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				loggingService.warn(
					`Failed to generate insights for ${opportunity.noticeId}:`,
					errorMessage
				);
				loggingService.debug("Falling back to basic insights due to error:", {
					noticeId: opportunity.noticeId,
					error: errorMessage,
				});
				insights = this.createBasicInsights(opportunity);
			}
		} else {
			loggingService.debug("Using basic insights (includeInsights=false):", {
				noticeId: opportunity.noticeId,
			});
			insights = this.createBasicInsights(opportunity);
		}

		// Ensure proper types for the enhanced opportunity
		const typedHistoricalAwards = Array.isArray(historicalAwards)
			? historicalAwards
			: [];
		const typedEntityInfo = entityInfo as EntityInfo | null;

		const enhancedOpportunity: EnhancedOpportunity = {
			samData: opportunity,
			historicalAwards: typedHistoricalAwards,
			entityInfo: typedEntityInfo,
			insights,
			enhancementTimestamp: new Date().toISOString(),
			dataSources: this.getDataSources(options),
			confidenceScore: this.calculateConfidenceScore(
				typedHistoricalAwards,
				typedEntityInfo,
				insights
			),
		};

		// Cache the result
		if (options.cacheResults) {
			await this.setCache(
				cacheKey,
				enhancedOpportunity,
				options.cacheTTL ?? this.DEFAULT_CACHE_TTL
			);
		}

		const duration = Date.now() - enhancementStartTime;

		loggingService.debug(
			`Enhanced opportunity ${opportunity.noticeId} in ${duration}ms`
		);

		return enhancedOpportunity;
	}

	private createBasicEnhancement(
		opportunity: SAMOpportunity
	): EnhancedOpportunity {
		return {
			samData: opportunity,
			historicalAwards: [],
			entityInfo: null,
			insights: this.createBasicInsights(opportunity),
			enhancementTimestamp: new Date().toISOString(),
			dataSources: ["SAM.gov Opportunities API"],
			confidenceScore: 20,
		};
	}

	private createBasicInsights(
		opportunity: SAMOpportunity
	): OpportunityInsights {
		loggingService.debug("Creating basic insights for opportunity:", {
			noticeId: opportunity.noticeId,
			title: opportunity.title,
			hasDescription: !!opportunity.description,
			hasUiLink: !!opportunity.uiLink,
			hasLinks: !!opportunity.links,
			hasResourceLinks: !!opportunity.resourceLinks,
		});
		//! TODO: Need to use the actual data to generate the insights
		return {
			opportunity,
			winProbability: {
				score: 50,
				factors: {
					competitionLevel: 50,
					agencyPreference: 50,
					historicalSuccess: 50,
					setAsideAdvantage: 50,
					timingAdvantage: 50,
				},
				recommendations: ["Limited data available for analysis"],
			},
			awardAmountPrediction: {
				estimatedMin: this.extractEstimatedValue(opportunity) ?? 0,
				estimatedMax: this.extractEstimatedValue(opportunity) ?? 0,
				estimatedAverage: this.extractEstimatedValue(opportunity) ?? 0,
				confidence: 20,
				factors: {
					historicalAverage: 0,
					agencySpendingPattern: 0,
					naicsCodeAverage: 0,
					setAsideImpact: 1,
				},
			},
			competitionAnalysis: {
				expectedBidders: 5,
				competitionDensity: "Medium" as const,
				competitionTypes: {},
				setAsideTypes: {},
				smallBusinessAdvantage: false,
				recommendations: ["Limited competition data available"],
			},
			agencyInsights: {
				spendingTrend: "Stable" as const,
				averageAwardSize: 0,
				preferredContractors: [],
				typicalTimeline: 30,
				pastBehavior: ["No historical data available"],
				recommendations: ["Research agency preferences"],
			},
			teamingOpportunities: {
				primeContractors: [],
				subcontractors: [],
				jointVentures: [],
				recommendedPartners: [],
				totalEligibleContractors: 0,
			},
			marketIntelligence: {
				marketSize: 0,
				growthTrend: "Stable" as const,
				growthRate: 0,
				keyPlayers: [],
				emergingTrends: ["No historical data available"],
				riskFactors: ["Limited data for risk assessment"],
				opportunities: [],
			},
			entityEligibility: {
				isEligible: false,
				requirements: [],
				certifications: [],
				socioeconomicAdvantages: [],
				complianceStatus: "Assessment required",
			},
			recommendations: {
				bidStrategy: ["Prepare standard proposal"],
				teamingStrategy: ["Consider teaming opportunities"],
				pricingStrategy: ["Develop competitive pricing"],
				timelineStrategy: ["Meet all deadlines"],
				riskMitigation: ["Identify and mitigate risks"],
			},
			dataFreshness: {
				lastUpdated: new Date().toISOString(),
				dataSources: ["SAM.gov Opportunities API"],
				confidenceLevel: 20,
			},
			// Add enhanced analysis features
			rewrittenDescription: (() => {
				const rewritten = {
					originalDescription: opportunity.description || "",
					rewrittenDescription: opportunity.description || "",
					keyPoints: ["Standard government procurement opportunity"],
					technicalRequirements: [],
					complianceRequirements: [],
					performanceCriteria: [],
					riskFactors: [],
					opportunityHighlights: [],
				};
				loggingService.debug("Generated rewrittenDescription:", {
					noticeId: opportunity.noticeId,
					hasOriginalDescription: !!rewritten.originalDescription,
					hasRewrittenDescription: !!rewritten.rewrittenDescription,
				});
				return rewritten;
			})(),
			attachmentAnalysis: (() => {
				const analysis = {
					hasAttachments: false,
					attachmentCount: 0,
					criticalAttachments: [],
					allAttachments: [],
					reviewPriority: ["No attachments available"],
					complianceRequirements: [],
					technicalSpecifications: [],
					evaluationCriteria: [],
				};
				loggingService.debug("Generated attachmentAnalysis:", {
					noticeId: opportunity.noticeId,
					hasAttachments: analysis.hasAttachments,
					attachmentCount: analysis.attachmentCount,
				});
				return analysis;
			})(),
			attachmentLinks: (() => {
				const links = opportunity.uiLink ? [opportunity.uiLink] : [];
				loggingService.debug("Generated attachmentLinks:", {
					noticeId: opportunity.noticeId,
					linkCount: links.length,
					links,
				});
				return links;
			})(),
		};
	}

	private extractAgencyCode(opportunity: SAMOpportunity): string | undefined {
		return opportunity.fullParentPathCode;
	}

	private extractContractorUei(_opportunity: SAMOpportunity): string | null {
		// This would need to be extracted from opportunity data
		// For now, return null as we don't have contractor info in basic opportunity
		return null;
	}

	private extractEstimatedValue(opportunity: SAMOpportunity): number | null {
		if (opportunity.award && typeof opportunity.award === "object") {
			const award = opportunity.award as Record<string, unknown>;
			return (award["value"] as number) ?? (award["amount"] as number) ?? null;
		}
		return null;
	}

	private getDataSources(options: EnhancementOptions): string[] {
		const sources = ["SAM.gov Opportunities API"];

		if (options.includeHistoricalData) {
			sources.push("USAspending.gov API");
		}

		if (options.includeEntityInfo) {
			sources.push("SAM.gov Entity Management API");
		}

		if (options.includeInsights) {
			sources.push("Insights Engine");
		}

		return sources;
	}

	private calculateConfidenceScore(
		historicalAwards: USAspendingAward[],
		entityInfo: EntityInfo | null,
		insights: OpportunityInsights
	): number {
		let score = 20; // Base score for SAM.gov data

		if (historicalAwards.length > 0) {
			score += Math.min(30, historicalAwards.length * 3);
		}

		if (entityInfo) {
			score += 20;
		}

		if (insights.dataFreshness.confidenceLevel > 50) {
			score += 30;
		}

		return Math.min(100, score);
	}

	private generateCacheKey(
		opportunity: SAMOpportunity,
		options: EnhancementOptions
	): string {
		const keyComponents = [
			opportunity.noticeId,
			opportunity.naicsCode ?? "no-naics",
			opportunity.fullParentPathCode ?? "no-agency",
			options.includeHistoricalData ? "hist" : "no-hist",
			options.includeEntityInfo ? "entity" : "no-entity",
			options.includeInsights ? "insights" : "no-insights",
		];

		return `enhanced-opportunity:${keyComponents.join(":")}`;
	}

	private async getFromCache(
		cacheKey: string
	): Promise<EnhancedOpportunity | null> {
		try {
			if (!redisClient) {
				this.enhancementStats.cacheMisses++;
				return null;
			}

			const cached = await redisClient.get(cacheKey);
			if (cached) {
				this.enhancementStats.cacheHits++;
				return JSON.parse(cached) as EnhancedOpportunity;
			}
			this.enhancementStats.cacheMisses++;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			loggingService.warn("Cache get error:", errorMessage);
			this.enhancementStats.cacheMisses++;
		}

		return null;
	}

	private async setCache(
		cacheKey: string,
		data: EnhancedOpportunity,
		ttl: number
	): Promise<void> {
		try {
			if (!redisClient) {
				return;
			}

			await redisClient.setEx(cacheKey, ttl, JSON.stringify(data));
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			loggingService.warn("Cache set error:", errorMessage);
		}
	}

	private async withTimeout<T>(
		promise: Promise<T>,
		timeoutMs: number
	): Promise<T> {
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error("Request timeout")), timeoutMs);
		});

		return Promise.race([promise, timeoutPromise]);
	}

	private async trackApiCall<T>(
		apiName: keyof typeof this.enhancementStats.apiCallStats,
		apiCall: () => Promise<T>
	): Promise<T> {
		const startTime = Date.now();
		this.enhancementStats.apiCallStats[apiName].calls++;

		try {
			const result = await apiCall();
			const responseTime = Date.now() - startTime;

			// Update average response time
			const stats = this.enhancementStats.apiCallStats[apiName];
			stats.avgResponseTime =
				(stats.avgResponseTime * (stats.calls - 1) + responseTime) /
				stats.calls;

			return result;
		} catch (error) {
			this.enhancementStats.apiCallStats[apiName].failures++;
			throw error;
		}
	}

	getEnhancementStats(): {
		totalEnhanced: number;
		averageEnhancementTime: number;
		cacheHitRate: number;
		dataSourceReliability: Record<string, number>;
	} {
		// Calculate real statistics from tracked data
		const totalCacheRequests =
			this.enhancementStats.cacheHits + this.enhancementStats.cacheMisses;
		const cacheHitRate =
			totalCacheRequests > 0
				? (this.enhancementStats.cacheHits / totalCacheRequests) * 100
				: 0;

		const averageEnhancementTime =
			this.enhancementStats.totalEnhanced > 0
				? this.enhancementStats.totalEnhancementTime /
				  this.enhancementStats.totalEnhanced
				: 0;

		// Calculate API reliability based on success rates
		const dataSourceReliability: Record<string, number> = {};
		Object.entries(this.enhancementStats.apiCallStats).forEach(
			([apiName, stats]) => {
				const successRate =
					stats.calls > 0
						? ((stats.calls - stats.failures) / stats.calls) * 100
						: 100;
				dataSourceReliability[this.getApiDisplayName(apiName)] =
					Math.round(successRate);
			}
		);

		return {
			totalEnhanced: this.enhancementStats.totalEnhanced,
			averageEnhancementTime: Math.round(averageEnhancementTime),
			cacheHitRate: Math.round(cacheHitRate * 100) / 100,
			dataSourceReliability,
		};
	}

	private getApiDisplayName(apiName: string): string {
		const displayNames: Record<string, string> = {
			samGov: "SAM.gov Opportunities API",
			usaspending: "USAspending.gov API",
			entityManagement: "SAM.gov Entity Management API",
			insightsEngine: "Insights Engine",
		};
		return displayNames[apiName] ?? apiName;
	}

	async clearCache(): Promise<void> {
		try {
			if (!redisClient) {
				return;
			}

			const keys = await redisClient.keys("enhanced-opportunity:*");
			if (keys.length > 0) {
				await redisClient.del(keys);
				loggingService.info(`Cleared ${keys.length} cached enhancements`);
			}
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			loggingService.error("Cache clear error:", errorMessage);
		}
	}

	resetStats(): void {
		this.enhancementStats = {
			totalEnhanced: 0,
			totalEnhancementTime: 0,
			cacheHits: 0,
			cacheMisses: 0,
			apiCallStats: {
				samGov: { calls: 0, failures: 0, avgResponseTime: 0 },
				usaspending: { calls: 0, failures: 0, avgResponseTime: 0 },
				entityManagement: { calls: 0, failures: 0, avgResponseTime: 0 },
				insightsEngine: { calls: 0, failures: 0, avgResponseTime: 0 },
			},
		};
		loggingService.info("Enhancement statistics reset");
	}

	async healthCheck(): Promise<{
		samGov: boolean;
		usaspending: boolean;
		entityManagement: boolean;
		insightsEngine: boolean;
		openai: {
			available: boolean;
			model: string;
			isGPT5: boolean;
			geographicRestricted: boolean;
			fallbackActive: boolean;
		};
		redis: boolean;
	}> {
		const results = await Promise.allSettled([
			samGovService.checkHealth(),
			usaspendingService.checkHealth(),
			entityManagementService.checkHealth(),
			Promise.resolve(true), // Insights engine doesn't have external dependencies
			Promise.resolve(openaiService.isServiceAvailable()).then(_available => {
				return openaiService.getServiceStatus();
			}), // Check OpenAI availability with detailed status
			redisClient ? redisClient.ping() : Promise.resolve(false),
		]);

		return {
			samGov: results[0].status === "fulfilled" && Boolean(results[0].value),
			usaspending:
				results[1].status === "fulfilled" && Boolean(results[1].value),
			entityManagement:
				results[2].status === "fulfilled" && Boolean(results[2].value),
			insightsEngine:
				results[3].status === "fulfilled" && Boolean(results[3].value),
			openai:
				results[4].status === "fulfilled" && results[4].value
					? (results[4].value as {
							available: boolean;
							model: string;
							isGPT5: boolean;
							geographicRestricted: boolean;
							fallbackActive: boolean;
					  })
					: {
							available: false,
							model: "unknown",
							isGPT5: false,
							geographicRestricted: false,
							fallbackActive: true,
					  },
			redis: results[5].status === "fulfilled" && results[5].value === "PONG",
		};
	}
}

export default new DataEnhancementService();
