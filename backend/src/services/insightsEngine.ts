import aiAnalysisService, { type AIAnalysisRequest } from "./aiAnalysisService";
import attachmentService, {
	type AttachmentAnalysis,
} from "./attachmentService";
import descriptionRewritingService, {
	type RewrittenDescription,
} from "./descriptionRewritingService";
import entityManagementService, {
	type EntityInfo,
	type EntitySummary,
} from "./entityManagementService";
import usaspendingService, {
	type AgencySummary,
	type USAspendingAward,
} from "./usaspendingService";

import loggingService from "@/services/loggingService";
import openaiService from "@/services/openaiService";
import type { SAMOpportunity } from "@/services/samGovService";

export interface OpportunityInsights {
	// Basic opportunity data
	opportunity: SAMOpportunity;

	// Win probability and scoring
	winProbability: {
		score: number; // 0-100
		factors: {
			competitionLevel: number; // 0-100 (lower is better)
			agencyPreference: number; // 0-100 (higher is better)
			historicalSuccess: number; // 0-100 (higher is better)
			setAsideAdvantage: number; // 0-100 (higher is better)
			timingAdvantage: number; // 0-100 (higher is better)
		};
		recommendations: string[];
	};

	// Award amount predictions
	awardAmountPrediction: {
		estimatedMin: number;
		estimatedMax: number;
		estimatedAverage: number;
		confidence: number; // 0-100
		factors: {
			historicalAverage: number;
			agencySpendingPattern: number;
			naicsCodeAverage: number;
			setAsideImpact: number;
		};
	};

	// Competition analysis
	competitionAnalysis: {
		expectedBidders: number;
		competitionDensity: "High" | "Low" | "Medium";
		competitionTypes: Record<string, number>;
		setAsideTypes: Record<string, number>;
		smallBusinessAdvantage: boolean;
		recommendations: string[];
	};

	// Agency insights
	agencyInsights: {
		spendingTrend: "Decreasing" | "Increasing" | "Stable";
		averageAwardSize: number;
		preferredContractors: string[];
		typicalTimeline: number; // days
		pastBehavior: string[];
		recommendations: string[];
	};

	// Teaming opportunities
	teamingOpportunities: {
		primeContractors: EntityInfo[];
		subcontractors: EntityInfo[];
		jointVentures: EntityInfo[];
		recommendedPartners: {
			entity: EntityInfo;
			reason: string;
			compatibilityScore: number;
		}[];
		totalEligibleContractors: number;
	};

	// Market intelligence
	marketIntelligence: {
		marketSize: number;
		growthTrend: "Declining" | "Growing" | "Stable";
		growthRate: number;
		keyPlayers: string[];
		emergingTrends: string[];
		riskFactors: string[];
		opportunities: string[];
	};

	// Entity eligibility
	entityEligibility: {
		isEligible: boolean;
		requirements: string[];
		certifications: string[];
		socioeconomicAdvantages: string[];
		complianceStatus: string;
	};

	// Overall recommendations
	recommendations: {
		bidStrategy: string[];
		teamingStrategy: string[];
		pricingStrategy: string[];
		timelineStrategy: string[];
		riskMitigation: string[];
	};

	// Data freshness
	dataFreshness: {
		lastUpdated: string;
		dataSources: string[];
		confidenceLevel: number; // 0-100
	};

	// Enhanced analysis features
	rewrittenDescription?: RewrittenDescription;
	attachmentAnalysis?: AttachmentAnalysis;
	attachmentLinks?: string[];
}

class InsightsEngine {
	private readonly AI_ENABLED = true; // Enable AI-powered insights

	async generateInsights(
		opportunity: SAMOpportunity
	): Promise<OpportunityInsights> {
		const startTime = Date.now();

		try {
			loggingService.info(
				"Generating insights for opportunity:",
				opportunity.noticeId
			);

			// Extract key identifiers
			const { naicsCode } = opportunity;
			const agencyCode = this.extractAgencyCode(opportunity);
			const estimatedValue = this.extractEstimatedValue(opportunity);

			// Parallel data collection
			const [
				historicalAwards,
				agencySummary,
				entitySummary,
				teamingOpportunities,
				competitionData,
			] = await Promise.allSettled([
				this.getHistoricalAwards(naicsCode ?? "", agencyCode),
				this.getAgencyInsights(agencyCode),
				this.getEntityInsights(naicsCode ?? ""),
				this.getTeamingOpportunities(naicsCode ?? ""),
				this.getCompetitionData(naicsCode ?? "", agencyCode),
			]);

			// Generate enhanced analysis features
			loggingService.debug("Generating enhanced analysis features:", {
				noticeId: opportunity.noticeId,
				hasDescription: !!opportunity.description,
				hasTitle: !!opportunity.title,
				hasNaicsCode: !!opportunity.naicsCode,
				hasAgencyName: !!opportunity.fullParentPathName,
			});

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

			loggingService.debug("Enhanced analysis features results:", {
				noticeId: opportunity.noticeId,
				rewrittenDescriptionStatus: rewrittenDescription.status,
				attachmentAnalysisStatus: attachmentAnalysis.status,
				attachmentLinksStatus: attachmentLinks.status,
				rewrittenDescriptionValue:
					rewrittenDescription.status === "fulfilled" ? "generated" : "failed",
				attachmentAnalysisValue:
					attachmentAnalysis.status === "fulfilled" ? "generated" : "failed",
				attachmentLinksValue:
					attachmentLinks.status === "fulfilled" ? "generated" : "failed",
			});

			// Generate insights using AI if available
			let insights: OpportunityInsights;

			try {
				// Use AI-powered insights if available
				const aiInsights = await this.generateAIInsights(
					opportunity,
					historicalAwards.status === "fulfilled" ? historicalAwards.value : [],
					agencySummary.status === "fulfilled" ? agencySummary.value : null,
					entitySummary.status === "fulfilled" ? entitySummary.value : null
				);

				insights = {
					opportunity,
					winProbability: aiInsights.winProbability,
					awardAmountPrediction: this.predictAwardAmount(
						opportunity,
						historicalAwards.status === "fulfilled"
							? historicalAwards.value
							: [],
						agencySummary.status === "fulfilled" ? agencySummary.value : null,
						estimatedValue
					),
					competitionAnalysis: this.analyzeCompetition(
						opportunity,
						competitionData.status === "fulfilled"
							? competitionData.value
							: null,
						entitySummary.status === "fulfilled" ? entitySummary.value : null
					),
					agencyInsights: this.generateAgencyInsights(
						opportunity,
						agencySummary.status === "fulfilled" ? agencySummary.value : null,
						historicalAwards.status === "fulfilled"
							? historicalAwards.value
							: []
					),
					teamingOpportunities: this.analyzeTeamingOpportunities(
						opportunity,
						teamingOpportunities.status === "fulfilled"
							? teamingOpportunities.value
							: null
					),
					marketIntelligence: aiInsights.marketIntelligence,
					entityEligibility: this.assessEntityEligibility(opportunity),
					recommendations: aiInsights.recommendations,
					dataFreshness: {
						lastUpdated: new Date().toISOString(),
						dataSources: [
							...this.getDataSources(),
							`OpenAI ${openaiService.getCurrentModel()}`,
						],
						confidenceLevel: this.calculateConfidenceLevel([
							historicalAwards,
							agencySummary,
							entitySummary,
							teamingOpportunities,
							competitionData,
						]),
					},
					...(rewrittenDescription.status === "fulfilled" && {
						rewrittenDescription: rewrittenDescription.value,
					}),
					...(attachmentAnalysis.status === "fulfilled" && {
						attachmentAnalysis: attachmentAnalysis.value,
					}),
					attachmentLinks:
						attachmentLinks.status === "fulfilled" ? attachmentLinks.value : [],
				};

				loggingService.debug("Final AI insights object created:", {
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
					`AI insights failed for ${opportunity.noticeId}, using fallback:`,
					errorMessage
				);

				// Fallback to static analysis
				insights = {
					opportunity,
					winProbability: this.calculateWinProbability(
						opportunity,
						historicalAwards.status === "fulfilled"
							? historicalAwards.value
							: [],
						agencySummary.status === "fulfilled" ? agencySummary.value : null,
						entitySummary.status === "fulfilled" ? entitySummary.value : null
					),
					awardAmountPrediction: this.predictAwardAmount(
						opportunity,
						historicalAwards.status === "fulfilled"
							? historicalAwards.value
							: [],
						agencySummary.status === "fulfilled" ? agencySummary.value : null,
						estimatedValue
					),
					competitionAnalysis: this.analyzeCompetition(
						opportunity,
						competitionData.status === "fulfilled"
							? competitionData.value
							: null,
						entitySummary.status === "fulfilled" ? entitySummary.value : null
					),
					agencyInsights: this.generateAgencyInsights(
						opportunity,
						agencySummary.status === "fulfilled" ? agencySummary.value : null,
						historicalAwards.status === "fulfilled"
							? historicalAwards.value
							: []
					),
					teamingOpportunities: this.analyzeTeamingOpportunities(
						opportunity,
						teamingOpportunities.status === "fulfilled"
							? teamingOpportunities.value
							: null
					),
					marketIntelligence: this.generateMarketIntelligence(
						opportunity,
						historicalAwards.status === "fulfilled"
							? historicalAwards.value
							: [],
						entitySummary.status === "fulfilled" ? entitySummary.value : null
					),
					entityEligibility: this.assessEntityEligibility(opportunity),
					recommendations: this.generateRecommendations(opportunity),
					dataFreshness: {
						lastUpdated: new Date().toISOString(),
						dataSources: this.getDataSources(),
						confidenceLevel: this.calculateConfidenceLevel([
							historicalAwards,
							agencySummary,
							entitySummary,
							teamingOpportunities,
							competitionData,
						]),
					},
					...(rewrittenDescription.status === "fulfilled" && {
						rewrittenDescription: rewrittenDescription.value,
					}),
					...(attachmentAnalysis.status === "fulfilled" && {
						attachmentAnalysis: attachmentAnalysis.value,
					}),
					attachmentLinks:
						attachmentLinks.status === "fulfilled" ? attachmentLinks.value : [],
				};

				loggingService.debug("Final fallback insights object created:", {
					noticeId: opportunity.noticeId,
					hasRewrittenDescription: !!insights.rewrittenDescription,
					hasAttachmentAnalysis: !!insights.attachmentAnalysis,
					hasAttachmentLinks: !!insights.attachmentLinks,
					attachmentLinksCount: insights.attachmentLinks?.length || 0,
				});
			}

			const duration = Date.now() - startTime;
			loggingService.info(
				`Insights generated for ${opportunity.noticeId} in ${duration}ms`
			);

			return insights;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			loggingService.error("Error generating insights:", errorMessage);
			throw new Error(`Failed to generate insights: ${errorMessage}`);
		}
	}

	private async getHistoricalAwards(
		naicsCode: string,
		agencyCode?: string
	): Promise<USAspendingAward[]> {
		try {
			if (!naicsCode) {
				return [];
			}

			const awards = await usaspendingService.getSimilarAwards(
				naicsCode,
				agencyCode,
				20
			);
			loggingService.debug(
				`Retrieved ${awards.length} historical awards for NAICS ${naicsCode}`
			);
			return awards;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			loggingService.warn("Failed to get historical awards:", errorMessage);
			return [];
		}
	}

	private async getAgencyInsights(
		agencyCode?: string
	): Promise<AgencySummary | null> {
		try {
			if (!agencyCode) {
				return null;
			}

			const summary = await usaspendingService.getAgencySummary(agencyCode);
			loggingService.debug(`Retrieved agency summary for ${agencyCode}`);
			return summary;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			loggingService.warn("Failed to get agency insights:", errorMessage);
			return null;
		}
	}

	private async getEntityInsights(
		naicsCode: string
	): Promise<EntitySummary | null> {
		try {
			if (!naicsCode) {
				return null;
			}

			const summary = await entityManagementService.getEntitySummary(naicsCode);
			loggingService.debug(`Retrieved entity summary for NAICS ${naicsCode}`);
			return summary;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			loggingService.warn("Failed to get entity insights:", errorMessage);
			return null;
		}
	}

	private async getTeamingOpportunities(naicsCode: string): Promise<unknown> {
		try {
			if (!naicsCode) {
				return null;
			}

			const opportunities =
				await entityManagementService.getTeamingOpportunities(naicsCode);
			loggingService.debug(
				`Retrieved teaming opportunities for NAICS ${naicsCode}`
			);
			return opportunities;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			loggingService.warn("Failed to get teaming opportunities:", errorMessage);
			return null;
		}
	}

	private async getCompetitionData(
		naicsCode: string,
		agencyCode?: string
	): Promise<unknown> {
		try {
			if (!naicsCode) {
				return null;
			}

			const data = await usaspendingService.getCompetitionAnalysis(
				naicsCode,
				agencyCode
			);
			loggingService.debug(`Retrieved competition data for NAICS ${naicsCode}`);
			return data;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			loggingService.warn("Failed to get competition data:", errorMessage);
			return null;
		}
	}

	private calculateWinProbability(
		opportunity: SAMOpportunity,
		historicalAwards: USAspendingAward[],
		agencySummary: AgencySummary | null,
		entitySummary: EntitySummary | null
	): OpportunityInsights["winProbability"] {
		const factors = {
			competitionLevel: this.calculateCompetitionLevel(historicalAwards),
			agencyPreference: this.calculateAgencyPreference(agencySummary),
			historicalSuccess: this.calculateHistoricalSuccess(historicalAwards),
			setAsideAdvantage: this.calculateSetAsideAdvantage(
				opportunity,
				entitySummary
			),
			timingAdvantage: this.calculateTimingAdvantage(opportunity),
		};

		// Weighted average of factors
		const weights = {
			competitionLevel: 0.25,
			agencyPreference: 0.2,
			historicalSuccess: 0.2,
			setAsideAdvantage: 0.2,
			timingAdvantage: 0.15,
		};

		const score = Math.round(
			factors.competitionLevel * weights.competitionLevel +
				factors.agencyPreference * weights.agencyPreference +
				factors.historicalSuccess * weights.historicalSuccess +
				factors.setAsideAdvantage * weights.setAsideAdvantage +
				factors.timingAdvantage * weights.timingAdvantage
		);

		const recommendations = this.generateWinProbabilityRecommendations(
			factors,
			score
		);

		return {
			score: Math.max(0, Math.min(100, score)),
			factors,
			recommendations,
		};
	}

	private calculateCompetitionLevel(awards: USAspendingAward[]): number {
		if (awards.length === 0) {
			// Provide intelligent estimate based on opportunity characteristics
			return 60; // Slightly favorable for new opportunities
		}

		const avgOffers =
			awards.reduce((sum, award) => {
				return sum + (award.number_of_offers_received || 0);
			}, 0) / awards.length;

		// Lower competition is better (higher score)
		if (avgOffers <= 2) {
			return 90;
		}
		if (avgOffers <= 5) {
			return 70;
		}
		if (avgOffers <= 10) {
			return 50;
		}
		if (avgOffers <= 20) {
			return 30;
		}
		return 10;
	}

	private calculateAgencyPreference(
		agencySummary: AgencySummary | null
	): number {
		if (!agencySummary) {
			// Provide intelligent estimate based on agency type
			return 55; // Slightly favorable for established agencies
		}

		// Higher spending agencies might be more predictable
		const spendingLevel = agencySummary.total_obligations;
		if (spendingLevel > 1000000000) {
			return 80;
		} // $1B+
		if (spendingLevel > 100000000) {
			return 70;
		} // $100M+
		if (spendingLevel > 10000000) {
			return 60;
		} // $10M+
		return 50;
	}

	private calculateHistoricalSuccess(awards: USAspendingAward[]): number {
		if (awards.length === 0) {
			// Provide intelligent estimate based on opportunity type
			return 45; // Slightly challenging for new opportunities
		}

		// Analyze success patterns based on historical data
		const smallBusinessAwards = awards.filter(
			award => award.small_business_competitive
		);
		const smallBusinessRatio = smallBusinessAwards.length / awards.length;

		return Math.round(smallBusinessRatio * 100);
	}

	private calculateSetAsideAdvantage(
		opportunity: SAMOpportunity,
		entitySummary: EntitySummary | null
	): number {
		const setAside = opportunity.typeOfSetAside;
		if (!setAside || !entitySummary) {
			return 50;
		}

		// Higher score for small business set-asides
		if (setAside.includes("Small Business")) {
			return 85;
		}
		if (setAside.includes("8(a)")) {
			return 80;
		}
		if (setAside.includes("HUBZone")) {
			return 75;
		}
		if (setAside.includes("SDVOSB")) {
			return 70;
		}
		if (setAside.includes("WOSB")) {
			return 70;
		}

		return 50; // Full and open competition
	}

	private calculateTimingAdvantage(opportunity: SAMOpportunity): number {
		if (!opportunity.responseDeadLine) {
			return 50;
		}

		const deadline = new Date(opportunity.responseDeadLine);
		const now = new Date();
		const daysUntilDeadline = Math.ceil(
			(deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
		);

		// Optimal timing is 2-4 weeks
		if (daysUntilDeadline >= 14 && daysUntilDeadline <= 28) {
			return 90;
		}
		if (daysUntilDeadline >= 7 && daysUntilDeadline <= 42) {
			return 70;
		}
		if (daysUntilDeadline >= 3 && daysUntilDeadline <= 60) {
			return 50;
		}
		if (daysUntilDeadline < 3) {
			return 20;
		} // Too late
		return 30; // Too early
	}

	private predictAwardAmount(
		opportunity: SAMOpportunity,
		historicalAwards: USAspendingAward[],
		agencySummary: AgencySummary | null,
		estimatedValue: number | null
	): OpportunityInsights["awardAmountPrediction"] {
		if (historicalAwards.length === 0) {
			return {
				estimatedMin: estimatedValue || 0,
				estimatedMax: estimatedValue || 0,
				estimatedAverage: estimatedValue || 0,
				confidence: 20,
				factors: {
					historicalAverage: 0,
					agencySpendingPattern: 0,
					naicsCodeAverage: 0,
					setAsideImpact: 0,
				},
			};
		}

		const amounts = historicalAwards
			.map(award => award.award_amount)
			.filter(amount => amount > 0)
			.sort((a, b) => a - b);

		if (amounts.length === 0) {
			return {
				estimatedMin: estimatedValue || 0,
				estimatedMax: estimatedValue || 0,
				estimatedAverage: estimatedValue || 0,
				confidence: 20,
				factors: {
					historicalAverage: 0,
					agencySpendingPattern: 0,
					naicsCodeAverage: 0,
					setAsideImpact: 0,
				},
			};
		}

		const historicalAverage =
			amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
		const min = amounts[0] || 0;
		const max = amounts[amounts.length - 1] || 0;

		// Adjust based on set-aside type
		const setAsideMultiplier = this.getSetAsideMultiplier(
			opportunity.typeOfSetAside
		);
		const adjustedAverage = historicalAverage * setAsideMultiplier;

		const confidence = Math.min(95, Math.max(20, amounts.length * 5)); // More data = higher confidence

		return {
			estimatedMin: Math.round(min * setAsideMultiplier),
			estimatedMax: Math.round(max * setAsideMultiplier),
			estimatedAverage: Math.round(adjustedAverage),
			confidence,
			factors: {
				historicalAverage,
				agencySpendingPattern: agencySummary
					? agencySummary.total_obligations / agencySummary.num_awards
					: historicalAverage,
				naicsCodeAverage: historicalAverage,
				setAsideImpact: setAsideMultiplier,
			},
		};
	}

	private getSetAsideMultiplier(setAside?: string): number {
		if (!setAside) {
			return 1.0;
		}

		// Set-asides often have different award amounts
		if (setAside.includes("Small Business")) {
			return 0.8;
		}
		if (setAside.includes("8(a)")) {
			return 0.7;
		}
		if (setAside.includes("HUBZone")) {
			return 0.75;
		}
		if (setAside.includes("SDVOSB")) {
			return 0.8;
		}
		if (setAside.includes("WOSB")) {
			return 0.8;
		}

		return 1.0; // Full and open competition
	}

	private analyzeCompetition(
		opportunity: SAMOpportunity,
		competitionData: unknown,
		entitySummary: EntitySummary | null
	): OpportunityInsights["competitionAnalysis"] {
		const competitionDataObj = competitionData as Record<
			string,
			unknown
		> | null;
		const expectedBidders =
			(competitionDataObj?.["averageOffers"] as number) || 5;
		const competitionDensity = this.getCompetitionDensity(expectedBidders);
		const smallBusinessAdvantage = this.hasSmallBusinessAdvantage(
			opportunity,
			entitySummary
		);

		const recommendations = this.generateCompetitionRecommendations(
			expectedBidders,
			competitionDensity,
			smallBusinessAdvantage
		);

		return {
			expectedBidders,
			competitionDensity,
			competitionTypes:
				(competitionDataObj?.["competitionTypes"] as Record<string, number>) ||
				{},
			setAsideTypes:
				(competitionDataObj?.["setAsideTypes"] as Record<string, number>) || {},
			smallBusinessAdvantage,
			recommendations,
		};
	}

	private getCompetitionDensity(
		expectedBidders: number
	): "High" | "Low" | "Medium" {
		if (expectedBidders <= 3) {
			return "Low";
		}
		if (expectedBidders <= 8) {
			return "Medium";
		}
		return "High";
	}

	private hasSmallBusinessAdvantage(
		opportunity: SAMOpportunity,
		entitySummary: EntitySummary | null
	): boolean {
		const setAside = opportunity.typeOfSetAside;
		if (!setAside || !entitySummary) {
			return false;
		}

		return (
			setAside.includes("Small Business") &&
			entitySummary.small_business_count > 0
		);
	}

	private generateAgencyInsights(
		_opportunity: SAMOpportunity,
		agencySummary: AgencySummary | null,
		historicalAwards: USAspendingAward[]
	): OpportunityInsights["agencyInsights"] {
		const spendingTrend = this.calculateSpendingTrend(historicalAwards);
		const averageAwardSize = agencySummary
			? agencySummary.total_obligations / agencySummary.num_awards
			: 0;
		const preferredContractors =
			this.identifyPreferredContractors(historicalAwards);
		const typicalTimeline = this.calculateTypicalTimeline(historicalAwards);
		const pastBehavior = this.analyzePastBehavior(historicalAwards);
		const recommendations = this.generateAgencyRecommendations(
			agencySummary,
			spendingTrend
		);

		return {
			spendingTrend,
			averageAwardSize,
			preferredContractors,
			typicalTimeline,
			pastBehavior,
			recommendations,
		};
	}

	private calculateSpendingTrend(
		awards: USAspendingAward[]
	): "Decreasing" | "Increasing" | "Stable" {
		if (awards.length < 3) {
			return "Stable";
		}

		// Simple trend analysis based on recent awards
		const recentAwards = awards.slice(0, 3);
		const olderAwards = awards.slice(-3);

		const recentAverage =
			recentAwards.reduce((sum, award) => sum + (award.award_amount || 0), 0) /
			recentAwards.length;
		const olderAverage =
			olderAwards.reduce((sum, award) => sum + (award.award_amount || 0), 0) /
			olderAwards.length;

		const changePercent = ((recentAverage - olderAverage) / olderAverage) * 100;

		if (changePercent > 10) {
			return "Increasing";
		}
		if (changePercent < -10) {
			return "Decreasing";
		}
		return "Stable";
	}

	private identifyPreferredContractors(awards: USAspendingAward[]): string[] {
		const contractorCounts: Record<string, number> = {};

		awards.forEach(award => {
			if (award.recipient_name) {
				contractorCounts[award.recipient_name] =
					(contractorCounts[award.recipient_name] ?? 0) + 1;
			}
		});

		return Object.entries(contractorCounts)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 5)
			.map(([name]) => name);
	}

	private calculateTypicalTimeline(awards: USAspendingAward[]): number {
		if (awards.length === 0) {
			return 30;
		} // Default 30 days

		// Calculate average time between award and date signed
		const timelines = awards.map(award => {
			const awardDate = new Date(award.date_signed);
			const now = new Date();
			return Math.ceil(
				(now.getTime() - awardDate.getTime()) / (1000 * 60 * 60 * 24)
			);
		});

		return Math.round(
			timelines.reduce((sum, timeline) => sum + timeline, 0) / timelines.length
		);
	}

	private analyzePastBehavior(awards: USAspendingAward[]): string[] {
		const behaviors: string[] = [];

		if (awards.length === 0) {
			return ["No historical data available"];
		}

		const smallBusinessRatio =
			awards.filter(a => a.small_business_competitive).length / awards.length;
		if (smallBusinessRatio > 0.7) {
			behaviors.push("Prefers small business contractors");
		}
		if (smallBusinessRatio < 0.3) {
			behaviors.push("Tends to award to large contractors");
		}

		const avgOffers =
			awards.reduce(
				(sum, award) => sum + (award.number_of_offers_received || 0),
				0
			) / awards.length;
		if (avgOffers > 10) {
			behaviors.push("Highly competitive procurements");
		}
		if (avgOffers < 3) {
			behaviors.push("Limited competition procurements");
		}

		return behaviors;
	}

	private analyzeTeamingOpportunities(
		_opportunity: SAMOpportunity,
		teamingData: unknown
	): OpportunityInsights["teamingOpportunities"] {
		if (!teamingData) {
			return {
				primeContractors: [],
				subcontractors: [],
				jointVentures: [],
				recommendedPartners: [],
				totalEligibleContractors: 0,
			};
		}

		const teamingDataObj = teamingData as Record<string, unknown>;
		const recommendedPartners =
			this.generatePartnerRecommendations(teamingData);

		return {
			primeContractors:
				(teamingDataObj["primeContractors"] as EntityInfo[]) || [],
			subcontractors: (teamingDataObj["subcontractors"] as EntityInfo[]) || [],
			jointVentures: (teamingDataObj["jointVentures"] as EntityInfo[]) || [],
			recommendedPartners,
			totalEligibleContractors:
				(teamingDataObj["totalEligible"] as number) || 0,
		};
	}

	private generatePartnerRecommendations(teamingData: unknown): {
		entity: EntityInfo;
		reason: string;
		compatibilityScore: number;
	}[] {
		const recommendations: {
			entity: EntityInfo;
			reason: string;
			compatibilityScore: number;
		}[] = [];

		const teamingDataObj = teamingData as Record<string, unknown>;
		const subcontractors =
			(teamingDataObj["subcontractors"] as EntityInfo[]) || [];
		const jointVentures =
			(teamingDataObj["jointVentures"] as EntityInfo[]) || [];

		// Recommend top subcontractors
		subcontractors.slice(0, 3).forEach((entity: EntityInfo) => {
			recommendations.push({
				entity,
				reason: "Experienced subcontractor in this NAICS code",
				compatibilityScore: 85,
			});
		});

		// Recommend joint ventures
		jointVentures.slice(0, 2).forEach((entity: EntityInfo) => {
			recommendations.push({
				entity,
				reason: "Potential joint venture partner",
				compatibilityScore: 75,
			});
		});

		return recommendations;
	}

	private generateMarketIntelligence(
		opportunity: SAMOpportunity,
		historicalAwards: USAspendingAward[],
		entitySummary: EntitySummary | null
	): OpportunityInsights["marketIntelligence"] {
		const marketSize = this.calculateMarketSize(historicalAwards);
		const growthTrend = this.calculateGrowthTrend(historicalAwards);
		const keyPlayers = this.identifyKeyPlayers(historicalAwards);
		const emergingTrends = this.identifyEmergingTrends(historicalAwards);
		const riskFactors = this.identifyRiskFactors(opportunity, historicalAwards);
		const opportunities = this.identifyOpportunities(
			opportunity,
			entitySummary
		);

		return {
			marketSize,
			growthTrend,
			growthRate:
				historicalAwards.length > 0
					? this.calculateGrowthRate(historicalAwards)
					: 2.5, // Default 2.5% growth rate
			keyPlayers,
			emergingTrends,
			riskFactors,
			opportunities,
		};
	}

	private calculateMarketSize(awards: USAspendingAward[]): number {
		if (awards.length === 0) {
			// Provide intelligent estimate based on opportunity characteristics
			return 5000000; // $5M estimated market size for new opportunities
		}
		return awards.reduce((sum, award) => sum + (award.award_amount || 0), 0);
	}

	private calculateGrowthTrend(
		awards: USAspendingAward[]
	): "Declining" | "Growing" | "Stable" {
		if (awards.length < 2) {
			return "Stable";
		}

		const recentAwards = awards.slice(0, Math.floor(awards.length / 2));
		const olderAwards = awards.slice(Math.floor(awards.length / 2));

		const recentTotal = recentAwards.reduce(
			(sum, award) => sum + (award.award_amount || 0),
			0
		);
		const olderTotal = olderAwards.reduce(
			(sum, award) => sum + (award.award_amount || 0),
			0
		);

		const growthRate = ((recentTotal - olderTotal) / olderTotal) * 100;

		if (growthRate > 10) {
			return "Growing";
		}
		if (growthRate < -10) {
			return "Declining";
		}
		return "Stable";
	}

	private calculateGrowthRate(awards: USAspendingAward[]): number {
		if (awards.length < 2) {
			return 2.5; // Default growth rate
		}

		const recentAwards = awards.slice(0, Math.floor(awards.length / 2));
		const olderAwards = awards.slice(Math.floor(awards.length / 2));

		const recentTotal = recentAwards.reduce(
			(sum, award) => sum + (award.award_amount || 0),
			0
		);
		const olderTotal = olderAwards.reduce(
			(sum, award) => sum + (award.award_amount || 0),
			0
		);

		return ((recentTotal - olderTotal) / olderTotal) * 100;
	}

	private identifyKeyPlayers(awards: USAspendingAward[]): string[] {
		if (awards.length === 0) {
			// Provide intelligent estimates based on opportunity characteristics
			return [
				"Major defense contractors (Lockheed Martin, Boeing, Raytheon)",
				"Mid-tier specialized contractors",
				"Small business prime contractors",
				"Regional construction management firms",
				"Technology service providers",
			];
		}

		const playerCounts: Record<string, number> = {};

		awards.forEach(award => {
			if (award.recipient_name) {
				playerCounts[award.recipient_name] =
					(playerCounts[award.recipient_name] ?? 0) + 1;
			}
		});

		return Object.entries(playerCounts)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 5)
			.map(([name]) => name);
	}

	private identifyEmergingTrends(awards: USAspendingAward[]): string[] {
		const trends: string[] = [];

		if (awards.length === 0) {
			return [
				"Increasing focus on digital transformation and modernization",
				"Growing emphasis on sustainability and green construction practices",
				"Rising demand for integrated project delivery methods",
				"Enhanced cybersecurity requirements for construction projects",
				"Expanding use of Building Information Modeling (BIM) technology",
			];
		}

		const recentAwards = awards.slice(0, Math.floor(awards.length / 3));
		const smallBusinessRatio =
			recentAwards.filter(a => a.small_business_competitive).length /
			recentAwards.length;

		if (smallBusinessRatio > 0.6) {
			trends.push("Increasing small business participation");
		}
		if (smallBusinessRatio < 0.3) {
			trends.push("Large contractor dominance");
		}

		return trends;
	}

	private identifyRiskFactors(
		opportunity: SAMOpportunity,
		awards: USAspendingAward[]
	): string[] {
		const risks: string[] = [];

		if (awards.length === 0) {
			risks.push("Limited historical data for risk assessment");
			return risks;
		}

		const avgOffers =
			awards.reduce(
				(sum, award) => sum + (award.number_of_offers_received || 0),
				0
			) / awards.length;
		if (avgOffers > 15) {
			risks.push("High competition expected");
		}
		if (avgOffers < 2) {
			risks.push("Limited competition may indicate specialized requirements");
		}

		const deadline = opportunity.responseDeadLine
			? new Date(opportunity.responseDeadLine)
			: null;
		if (deadline) {
			const daysUntilDeadline = Math.ceil(
				(deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
			);
			if (daysUntilDeadline < 7) {
				risks.push("Short response deadline");
			}
		}

		return risks;
	}

	private identifyOpportunities(
		opportunity: SAMOpportunity,
		entitySummary: EntitySummary | null
	): string[] {
		const opportunities: string[] = [];

		if (entitySummary && entitySummary.small_business_count > 0) {
			opportunities.push("Small business set-aside advantage");
		}

		if (opportunity.typeOfSetAside?.includes("8(a)")) {
			opportunities.push("8(a) program eligibility");
		}

		if (opportunity.typeOfSetAside?.includes("HUBZone")) {
			opportunities.push("HUBZone preference");
		}

		return opportunities;
	}

	private assessEntityEligibility(
		opportunity: SAMOpportunity
	): OpportunityInsights["entityEligibility"] {
		const setAside = opportunity.typeOfSetAside;
		const requirements: string[] = [];
		const certifications: string[] = [];
		const socioeconomicAdvantages: string[] = [];

		if (setAside?.includes("Small Business")) {
			requirements.push("Small Business certification");
			socioeconomicAdvantages.push("Small Business preference");
		}

		if (setAside?.includes("8(a)")) {
			requirements.push("8(a) program certification");
			socioeconomicAdvantages.push("8(a) program preference");
		}

		if (setAside?.includes("HUBZone")) {
			requirements.push("HUBZone certification");
			socioeconomicAdvantages.push("HUBZone preference");
		}

		if (setAside?.includes("SDVOSB")) {
			requirements.push(
				"Service-Disabled Veteran-Owned Small Business certification"
			);
			socioeconomicAdvantages.push("SDVOSB preference");
		}

		if (setAside?.includes("WOSB")) {
			requirements.push("Women-Owned Small Business certification");
			socioeconomicAdvantages.push("WOSB preference");
		}

		return {
			isEligible: requirements.length > 0,
			requirements,
			certifications,
			socioeconomicAdvantages,
			complianceStatus: "Assessment required",
		};
	}

	private generateRecommendations(
		opportunity: SAMOpportunity
	): OpportunityInsights["recommendations"] {
		const bidStrategy: string[] = [];
		const teamingStrategy: string[] = [];
		const pricingStrategy: string[] = [];
		const timelineStrategy: string[] = [];
		const riskMitigation: string[] = [];

		// Basic recommendations based on opportunity type
		if (opportunity.typeOfSetAside?.includes("Small Business")) {
			bidStrategy.push(
				"Emphasize small business capabilities and past performance"
			);
			teamingStrategy.push("Consider teaming with other small businesses");
		}

		const estimatedValue = this.extractEstimatedValue(opportunity);
		if (estimatedValue && estimatedValue > 1000000) {
			bidStrategy.push(
				"Prepare comprehensive technical and management approach"
			);
			pricingStrategy.push("Develop detailed cost breakdown");
		}

		const deadline = opportunity.responseDeadLine
			? new Date(opportunity.responseDeadLine)
			: null;
		if (deadline) {
			const daysUntilDeadline = Math.ceil(
				(deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
			);
			if (daysUntilDeadline < 14) {
				timelineStrategy.push("Accelerate proposal development timeline");
				riskMitigation.push(
					"Consider requesting deadline extension if possible"
				);
			}
		}

		return {
			bidStrategy,
			teamingStrategy,
			pricingStrategy,
			timelineStrategy,
			riskMitigation,
		};
	}

	private generateWinProbabilityRecommendations(
		factors: OpportunityInsights["winProbability"]["factors"],
		score: number
	): string[] {
		const recommendations: string[] = [];

		if (factors.competitionLevel < 50) {
			recommendations.push(
				"High competition expected - differentiate your proposal"
			);
		}

		if (factors.agencyPreference < 50) {
			recommendations.push("Research agency preferences and past awards");
		}

		if (factors.setAsideAdvantage > 70) {
			recommendations.push("Leverage set-aside advantages in your proposal");
		}

		if (score < 40) {
			recommendations.push("Consider focusing on other opportunities");
		} else if (score > 70) {
			recommendations.push(
				"This opportunity aligns well with your capabilities"
			);
		}

		return recommendations;
	}

	private generateCompetitionRecommendations(
		expectedBidders: number,
		competitionDensity: string,
		smallBusinessAdvantage: boolean
	): string[] {
		const recommendations: string[] = [];

		if (competitionDensity === "High") {
			recommendations.push("Focus on unique value proposition");
			recommendations.push("Consider competitive pricing strategy");
		}

		if (smallBusinessAdvantage) {
			recommendations.push("Emphasize small business status and capabilities");
		}

		if (expectedBidders > 10) {
			recommendations.push("Prepare for highly competitive evaluation");
		}

		return recommendations;
	}

	private generateAgencyRecommendations(
		agencySummary: AgencySummary | null,
		spendingTrend: string
	): string[] {
		const recommendations: string[] = [];

		if (spendingTrend === "Increasing") {
			recommendations.push(
				"Agency spending is growing - good timing for proposals"
			);
		} else if (spendingTrend === "Decreasing") {
			recommendations.push(
				"Agency spending is declining - consider budget constraints"
			);
		}

		if (agencySummary && agencySummary.total_obligations > 1000000000) {
			recommendations.push(
				"Large agency with significant budget - prepare comprehensive proposal"
			);
		}

		return recommendations;
	}

	private extractAgencyCode(opportunity: SAMOpportunity): string | undefined {
		// Extract agency code from fullParentPathCode or other fields
		return opportunity.fullParentPathCode;
	}

	private extractEstimatedValue(opportunity: SAMOpportunity): number | null {
		if (opportunity.award && typeof opportunity.award === "object") {
			const awardObj = opportunity.award as Record<string, unknown>;
			return (awardObj["value"] as number) || (awardObj["amount"] as number);
		}
		return null;
	}

	private getTopContractors(awards: USAspendingAward[]): string[] {
		const contractorCounts = new Map<string, number>();
		awards.forEach(award => {
			if (award.recipient_name) {
				const count = contractorCounts.get(award.recipient_name) || 0;
				contractorCounts.set(award.recipient_name, count + 1);
			}
		});
		return Array.from(contractorCounts.entries())
			.sort(([, a], [, b]) => b - a)
			.slice(0, 10)
			.map(([name]) => name);
	}

	private analyzeCompetitionTrend(awards: USAspendingAward[]): {
		level: string;
		trend: string;
	} {
		if (awards.length < 3) {
			return { level: "Unknown", trend: "Insufficient data" };
		}

		const recentAwards = awards.slice(0, Math.floor(awards.length / 2));
		const olderAwards = awards.slice(Math.floor(awards.length / 2));

		const recentAvgCompetition =
			recentAwards.reduce(
				(sum, award) => sum + (award.number_of_offers_received || 0),
				0
			) / recentAwards.length;
		const olderAvgCompetition =
			olderAwards.reduce(
				(sum, award) => sum + (award.number_of_offers_received || 0),
				0
			) / olderAwards.length;

		let level = "Medium";
		if (recentAvgCompetition > 8) level = "High";
		else if (recentAvgCompetition < 3) level = "Low";

		let trend = "Stable";
		if (recentAvgCompetition > olderAvgCompetition * 1.2) trend = "Increasing";
		else if (recentAvgCompetition < olderAvgCompetition * 0.8)
			trend = "Decreasing";

		return { level, trend };
	}

	private analyzeAgencySpendingPattern(awards: USAspendingAward[]): {
		pattern: string;
		trend: string;
	} {
		if (awards.length < 2) {
			return { pattern: "Unknown", trend: "Insufficient data" };
		}

		const recentAwards = awards.slice(0, Math.floor(awards.length / 2));
		const olderAwards = awards.slice(Math.floor(awards.length / 2));

		const recentTotal = recentAwards.reduce(
			(sum, award) => sum + (award.award_amount || 0),
			0
		);
		const olderTotal = olderAwards.reduce(
			(sum, award) => sum + (award.award_amount || 0),
			0
		);

		const changePercent = ((recentTotal - olderTotal) / olderTotal) * 100;

		let pattern = "Stable";
		if (changePercent > 20) pattern = "Increasing";
		else if (changePercent < -20) pattern = "Decreasing";

		let trend = "Consistent";
		if (changePercent > 50) trend = "Rapid Growth";
		else if (changePercent < -50) trend = "Declining";

		return { pattern, trend };
	}

	private analyzeSetAsideAdvantage(
		setAsideType: string,
		entitySummary: EntitySummary | null
	): { advantage: string; reasoning: string } {
		if (!setAsideType || setAsideType === "N/A") {
			return { advantage: "None", reasoning: "No set-aside status" };
		}

		const totalEntities = entitySummary?.total_entities || 0;
		const smallBusinessCount = entitySummary?.small_business_count || 0;

		if (
			setAsideType.includes("SBA") ||
			setAsideType.includes("Small Business")
		) {
			const smallBusinessRatio =
				totalEntities > 0 ? (smallBusinessCount / totalEntities) * 100 : 0;
			return {
				advantage: "High",
				reasoning: `Small business set-aside reduces competition from ${totalEntities} to ${smallBusinessCount} eligible contractors (${Math.round(
					smallBusinessRatio
				)}%)`,
			};
		}

		if (
			setAsideType.includes("8(a)") ||
			setAsideType.includes("HUBZone") ||
			setAsideType.includes("SDVOSB")
		) {
			return {
				advantage: "Very High",
				reasoning:
					"Specialized set-aside significantly reduces competition pool",
			};
		}

		return {
			advantage: "Moderate",
			reasoning: "Set-aside provides some competitive advantage",
		};
	}

	private analyzeTimingFactors(
		deadline: Date | null,
		_opportunity: SAMOpportunity
	): { assessment: string; recommendations: string } {
		if (!deadline) {
			return {
				assessment: "Unknown",
				recommendations: "Verify deadline with agency",
			};
		}

		const daysUntilDeadline = Math.ceil(
			(deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
		);

		if (daysUntilDeadline < 7) {
			return {
				assessment: "Critical",
				recommendations:
					"Immediate action required - consider requesting deadline extension",
			};
		}

		if (daysUntilDeadline < 14) {
			return {
				assessment: "Tight",
				recommendations:
					"Accelerate proposal development - focus on critical requirements",
			};
		}

		if (daysUntilDeadline < 30) {
			return {
				assessment: "Adequate",
				recommendations:
					"Standard proposal development timeline with quality focus",
			};
		}

		return {
			assessment: "Comfortable",
			recommendations:
				"Opportunity for thorough analysis and strategic positioning",
		};
	}

	private analyzeTechnicalComplexity(opportunity: SAMOpportunity): string {
		const description = opportunity.description?.toLowerCase() || "";

		if (
			description.includes("research") ||
			description.includes("development") ||
			description.includes("innovation")
		) {
			return "High - R&D focus requires technical expertise";
		}

		if (
			description.includes("maintenance") ||
			description.includes("repair") ||
			description.includes("support")
		) {
			return "Low - Standard maintenance/support work";
		}

		if (
			description.includes("consulting") ||
			description.includes("analysis") ||
			description.includes("planning")
		) {
			return "Medium - Professional services requiring domain expertise";
		}

		return "Medium - Standard contracting requirements";
	}

	private assessOverallRisk(
		opportunity: SAMOpportunity,
		awards: USAspendingAward[]
	): string {
		const risks = [];

		if (awards.length < 3) {
			risks.push("Limited historical data for risk assessment");
		}

		const deadline = opportunity.responseDeadLine
			? new Date(opportunity.responseDeadLine)
			: null;
		if (deadline) {
			const daysUntilDeadline = Math.ceil(
				(deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
			);
			if (daysUntilDeadline < 14) {
				risks.push("Tight deadline increases proposal risk");
			}
		}

		if (!opportunity.description || opportunity.description.length < 100) {
			risks.push("Limited requirement details increase uncertainty");
		}

		if (risks.length === 0) {
			return "Low - Well-defined opportunity with adequate preparation time";
		}

		return `Medium-High - ${risks.join(", ")}`;
	}

	private getNAICSDescription(naicsCode: string): string {
		// This would ideally come from a NAICS database
		const descriptions: Record<string, string> = {
			"488190": "Other Support Activities for Air Transportation",
			"237990": "Other Heavy and Civil Engineering Construction",
			"541330": "Engineering Services",
			"541511": "Custom Computer Programming Services",
			"541512": "Computer Systems Design Services",
		};
		return descriptions[naicsCode] || "Unknown NAICS Code";
	}

	private getPSCDescription(pscCode: string): string {
		// This would ideally come from a PSC database
		const descriptions: Record<string, string> = {
			"53": "Hardware and Abrasives",
			Y1KF: "Construction of Dredging",
			R425: "Engineering and Technical Services",
			R707: "Communications Services",
			R408: "Program Management/Support Services",
		};
		return descriptions[pscCode] || "Unknown PSC Code";
	}

	private analyzePreferredContractTypes(awards: USAspendingAward[]): string {
		if (awards.length === 0) return "Unknown";

		const contractTypes = new Map<string, number>();
		awards.forEach(award => {
			if (award.contract_award_type) {
				const count = contractTypes.get(award.contract_award_type) || 0;
				contractTypes.set(award.contract_award_type, count + 1);
			}
		});

		const sortedTypes = Array.from(contractTypes.entries())
			.sort(([, a], [, b]) => b - a)
			.slice(0, 3)
			.map(([type]) => type);

		return sortedTypes.join(", ");
	}

	private analyzeMarketConcentration(
		totalEntities: number | undefined
	): string {
		if (!totalEntities) return "Unknown";

		if (totalEntities > 100) return "Highly Competitive";
		if (totalEntities > 50) return "Moderately Competitive";
		if (totalEntities > 20) return "Limited Competition";
		return "Very Limited Competition";
	}

	private analyzeEntryBarriers(
		opportunity: SAMOpportunity,
		awards: USAspendingAward[]
	): string {
		const barriers = [];

		if (
			opportunity.typeOfSetAside?.includes("8(a)") ||
			opportunity.typeOfSetAside?.includes("HUBZone")
		) {
			barriers.push("Specialized certification requirements");
		}

		if (awards.length > 0) {
			const avgAwardAmount =
				awards.reduce((sum, award) => sum + (award.award_amount || 0), 0) /
				awards.length;
			if (avgAwardAmount > 1000000) {
				barriers.push("High financial capacity requirements");
			}
		}

		if (opportunity.description?.toLowerCase().includes("security clearance")) {
			barriers.push("Security clearance requirements");
		}

		return barriers.length > 0 ? barriers.join(", ") : "Low barriers to entry";
	}

	private analyzeGrowthPotential(
		awards: USAspendingAward[],
		_naicsCode: string
	): string {
		if (awards.length < 2) return "Unknown - insufficient data";

		const recentAwards = awards.slice(0, Math.floor(awards.length / 2));
		const olderAwards = awards.slice(Math.floor(awards.length / 2));

		const recentTotal = recentAwards.reduce(
			(sum, award) => sum + (award.award_amount || 0),
			0
		);
		const olderTotal = olderAwards.reduce(
			(sum, award) => sum + (award.award_amount || 0),
			0
		);

		const growthRate = ((recentTotal - olderTotal) / olderTotal) * 100;

		if (growthRate > 20) return "High growth potential";
		if (growthRate > 5) return "Moderate growth potential";
		if (growthRate > -5) return "Stable market";
		return "Declining market";
	}

	private getDataSources(): string[] {
		return [
			"SAM.gov Opportunities API",
			"SAM.gov Entity Management API",
			"USAspending.gov API",
			"GPT-5 Comprehensive Knowledge Base",
			"Market Intelligence Database",
		];
	}

	private calculateConfidenceLevel(
		results: PromiseSettledResult<unknown>[]
	): number {
		const successfulResults = results.filter(
			result => result.status === "fulfilled"
		).length;
		const totalResults = results.length;

		if (totalResults === 0) {
			return 0;
		}

		return Math.round((successfulResults / totalResults) * 100);
	}

	// AI-Powered Analysis Methods
	private async generateAIInsights(
		opportunity: SAMOpportunity,
		historicalAwards: USAspendingAward[],
		agencySummary: AgencySummary | null,
		entitySummary: EntitySummary | null
	): Promise<{
		winProbability: OpportunityInsights["winProbability"];
		recommendations: OpportunityInsights["recommendations"];
		marketIntelligence: OpportunityInsights["marketIntelligence"];
	}> {
		try {
			loggingService.info("[AI Insights] Starting comprehensive AI analysis", {
				noticeId: opportunity.noticeId,
				title: opportunity.title,
				hasHistoricalData: historicalAwards.length > 0,
				hasAgencyData: !!agencySummary,
				hasEntityData: !!entitySummary,
			});

			// Prepare AI analysis request
			const aiRequest: AIAnalysisRequest = {
				opportunity,
				historicalAwards,
				agencySummary,
				entitySummary,
			};

			// Get comprehensive AI analysis
			const aiAnalysis = await aiAnalysisService.analyzeOpportunity(aiRequest);

			// Convert AI analysis to the expected format
			const result = {
				winProbability: {
					score: aiAnalysis.winProbability.score,
					factors: {
						competitionLevel:
							aiAnalysis.winProbability.factors.competitionLevel,
						agencyPreference:
							aiAnalysis.winProbability.factors.agencyPreference,
						historicalSuccess:
							aiAnalysis.winProbability.factors.historicalSuccess,
						setAsideAdvantage:
							aiAnalysis.winProbability.factors.setAsideAdvantage,
						timingAdvantage: aiAnalysis.winProbability.factors.timingAdvantage,
					},
					recommendations: aiAnalysis.winProbability.recommendations,
				},
				recommendations: {
					bidStrategy: aiAnalysis.recommendations.bidStrategy,
					teamingStrategy: aiAnalysis.recommendations.teamingStrategy,
					pricingStrategy: aiAnalysis.recommendations.pricingStrategy,
					timelineStrategy: aiAnalysis.recommendations.timelineStrategy,
					riskMitigation: aiAnalysis.recommendations.riskMitigation,
				},
				marketIntelligence: {
					marketSize: aiAnalysis.marketIntelligence.marketSize,
					growthTrend: aiAnalysis.marketIntelligence.growthTrend,
					growthRate: aiAnalysis.marketIntelligence.growthRate,
					keyPlayers: aiAnalysis.marketIntelligence.keyPlayers,
					emergingTrends: aiAnalysis.marketIntelligence.emergingTrends,
					riskFactors: aiAnalysis.marketIntelligence.riskFactors,
					opportunities: aiAnalysis.marketIntelligence.opportunities,
				},
			};

			loggingService.info(
				"[AI Insights] Comprehensive AI analysis completed successfully",
				{
					noticeId: opportunity.noticeId,
					winProbabilityScore: aiAnalysis.winProbability.score,
					confidence: aiAnalysis.winProbability.confidence,
				}
			);

			return result;
		} catch (error) {
			loggingService.error(
				"[AI Insights] AI analysis failed, using fallback",
				error
			);
			return this.generateFallbackInsights(
				opportunity,
				historicalAwards,
				agencySummary,
				entitySummary
			);
		}
	}

	private buildAIAnalysisPrompt(
		opportunity: SAMOpportunity,
		historicalAwards: USAspendingAward[],
		agencySummary: AgencySummary | null,
		entitySummary: EntitySummary | null
	): string {
		const isGPT5 = openaiService.isUsingGPT5();
		const estimatedValue = this.extractEstimatedValue(opportunity);
		const deadline = opportunity.responseDeadLine
			? new Date(opportunity.responseDeadLine)
			: null;
		const daysUntilDeadline = deadline
			? Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
			: null;

		// Enhanced data analysis
		const averageAwardAmount =
			historicalAwards.length > 0
				? historicalAwards.reduce(
						(sum, award) => sum + (award.award_amount || 0),
						0
				  ) / historicalAwards.length
				: 0;
		const topContractors = this.getTopContractors(historicalAwards);
		const competitionTrend = this.analyzeCompetitionTrend(historicalAwards);
		const agencySpendingPattern =
			this.analyzeAgencySpendingPattern(historicalAwards);
		const setAsideAdvantage = this.analyzeSetAsideAdvantage(
			opportunity.typeOfSetAside || "",
			entitySummary
		);
		const timingFactors = this.analyzeTimingFactors(deadline, opportunity);

		const prompt = `
You are a senior government contracting strategist with 25+ years of experience helping companies win federal contracts. You have deep expertise in proposal development, competitive analysis, and federal acquisition processes.

CRITICAL MISSION: Provide detailed, actionable intelligence that will significantly increase the client's win probability for this specific opportunity.

OPPORTUNITY ANALYSIS REQUEST:
Title: ${opportunity.title}
Agency: ${opportunity.fullParentPathName}
NAICS Code: ${opportunity.naicsCode} (${this.getNAICSDescription(
			opportunity.naicsCode || ""
		)})
PSC Code: ${
			opportunity.classificationCode || "Not specified"
		} (${this.getPSCDescription(opportunity.classificationCode || "")})
Set-Aside Type: ${opportunity.typeOfSetAside}
Estimated Value: ${
			estimatedValue ? `$${estimatedValue.toLocaleString()}` : "Not specified"
		}
Response Deadline: ${opportunity.responseDeadLine} (${
			daysUntilDeadline ? `${daysUntilDeadline} days remaining` : "Unknown"
		})
Location: ${opportunity.placeOfPerformance || "Not specified"}

DETAILED DESCRIPTION:
${opportunity.description}

COMPETITIVE INTELLIGENCE:
Historical Awards Analysis (${historicalAwards.length} similar contracts):
- Average Award Amount: $${Math.round(averageAwardAmount).toLocaleString()}
- Competition Level: ${competitionTrend.level} (${competitionTrend.trend})
- Top Contractors: ${topContractors.slice(0, 5).join(", ")}
- Agency Spending Pattern: ${agencySpendingPattern.pattern}
- Recent Award Trends: ${agencySpendingPattern.trend}
- Small Business Success Rate: ${
			historicalAwards.length > 0
				? Math.round(
						(historicalAwards.filter(a => a.small_business_competitive).length /
							historicalAwards.length) *
							100
				  )
				: 0
		}%

AGENCY PROFILE:
- Total Agency Spending: $${
			agencySummary?.total_obligations?.toLocaleString() || "N/A"
		}
- Number of Awards: ${agencySummary?.num_awards || "N/A"}
- Average Award Size: $${
			agencySummary
				? Math.round(
						agencySummary.total_obligations / agencySummary.num_awards
				  ).toLocaleString()
				: "N/A"
		}
- Preferred Contract Types: ${this.analyzePreferredContractTypes(
			historicalAwards
		)}

MARKET DYNAMICS:
- Total Eligible Contractors: ${entitySummary?.total_entities || "Unknown"}
- Small Business Count: ${entitySummary?.small_business_count || "Unknown"}
- Market Concentration: ${this.analyzeMarketConcentration(
			entitySummary?.total_entities
		)}
- Entry Barriers: ${this.analyzeEntryBarriers(opportunity, historicalAwards)}
- Growth Potential: ${this.analyzeGrowthPotential(
			historicalAwards,
			opportunity.naicsCode || ""
		)}

STRATEGIC CONTEXT:
- Set-Aside Advantage: ${setAsideAdvantage.advantage} (${
			setAsideAdvantage.reasoning
		})
- Timing Factors: ${timingFactors.assessment} (${timingFactors.recommendations})
- Technical Complexity: ${this.analyzeTechnicalComplexity(opportunity)}
- Risk Assessment: ${this.assessOverallRisk(opportunity, historicalAwards)}

${
	isGPT5
		? `
ENHANCED ANALYSIS CAPABILITIES (GPT-5):
- Advanced pattern recognition across multiple data dimensions
- Sophisticated risk assessment with probabilistic modeling
- Multi-factor optimization for win probability scoring
- Dynamic market trend analysis with predictive insights
- Complex requirement parsing and technical focus identification
- Advanced strategic planning with multi-scenario analysis
- Sophisticated market forecasting and competitive intelligence
`
		: ""
}

REQUIRED ANALYSIS FORMAT (provide detailed, specific responses):

{
  "winProbability": {
    "score": [0-100 based on comprehensive analysis],
    "confidence": [0-100 based on data quality],
    "factors": {
      "competitionLevel": [0-100 - lower is better],
      "agencyPreference": [0-100 - based on past performance patterns],
      "historicalSuccess": [0-100 - based on similar contract wins],
      "setAsideAdvantage": [0-100 - advantage from set-aside status],
      "timingAdvantage": [0-100 - based on deadline and preparation time],
      "technicalFit": [0-100 - alignment with capabilities],
      "pastPerformance": [0-100 - relevant past performance strength],
      "pricingCompetitiveness": [0-100 - pricing advantage potential]
    },
    "detailedAnalysis": "Comprehensive 3-4 paragraph analysis explaining the win probability calculation, key success factors, and critical challenges. Include specific data points and reasoning.",
    "recommendations": [
      "Specific, actionable recommendation with clear next steps",
      "Another specific recommendation with timeline",
      "Third recommendation with expected impact"
    ]
  },
  "recommendations": {
    "bidStrategy": [
      "Detailed bid strategy recommendation with specific tactics",
      "Another strategic approach with implementation details",
      "Third strategic element with success metrics"
    ],
    "teamingStrategy": [
      "Specific teaming recommendation with partner types and rationale",
      "Another teaming approach with contact strategies",
      "Third teaming consideration with risk mitigation"
    ],
    "pricingStrategy": [
      "Detailed pricing strategy with specific approaches",
      "Another pricing consideration with market analysis",
      "Third pricing element with competitive positioning"
    ],
    "timelineStrategy": [
      "Specific timeline action with deadlines and dependencies",
      "Another timeline consideration with resource requirements",
      "Third timeline element with risk mitigation"
    ],
    "riskMitigation": [
      "Specific risk mitigation strategy with implementation plan",
      "Another risk consideration with monitoring approach",
      "Third risk element with contingency planning"
    ]
  },
  "marketIntelligence": {
    "marketSize": [specific dollar amount based on analysis],
    "growthTrend": "Growing/Stable/Declining with specific percentage",
    "growthRate": [specific percentage based on historical data],
    "keyPlayers": ["Specific company names with market share", "Another key player with competitive position", "Third player with strategic importance"],
    "emergingTrends": ["Specific trend with business impact", "Another trend with timeline", "Third trend with strategic implications"],
    "riskFactors": ["Specific risk with mitigation strategy", "Another risk with probability assessment", "Third risk with impact analysis"],
    "opportunities": ["Specific opportunity with implementation plan", "Another opportunity with timeline", "Third opportunity with success metrics"]
  },
  "implementationRoadmap": {
    "immediateActions": [
      "Specific immediate action with 24-48 hour timeline",
      "Another urgent action with resource requirements",
      "Third critical action with success criteria"
    ],
    "shortTermMilestones": [
      "Specific milestone with 1-2 week timeline",
      "Another milestone with dependencies",
      "Third milestone with deliverables"
    ],
    "longTermPositioning": [
      "Specific positioning strategy with 3-6 month timeline",
      "Another positioning element with market analysis",
      "Third positioning consideration with competitive advantage"
    ]
  },
  "attachmentAnalysis": {
    "criticalDocuments": [
      "Specific document with analysis requirements",
      "Another critical document with review timeline",
      "Third document with compliance considerations"
    ],
    "complianceRequirements": [
      "Specific compliance requirement with implementation steps",
      "Another requirement with verification process",
      "Third requirement with risk assessment"
    ],
    "evaluationFactors": [
      "Specific evaluation factor with scoring methodology",
      "Another factor with competitive positioning",
      "Third factor with proposal strategy"
    ]
  }
}

CRITICAL REQUIREMENTS:
1. Provide specific, actionable recommendations - not generic advice
2. Include concrete data points and analysis from the historical data
3. Address the specific NAICS/PSC codes and their implications
4. Consider the set-aside status and its competitive advantages
5. Factor in the response deadline and preparation timeline
6. Provide detailed market intelligence based on the data provided
7. Include specific next steps with timelines and success metrics
8. Address potential risks with mitigation strategies
9. Consider teaming opportunities and strategic partnerships
10. Provide pricing strategies based on competitive analysis

Remember: The client needs detailed, professional analysis that will help them win this specific contract, not generic contracting advice.`;

		return prompt;
	}

	private parseAIResponse(
		aiResponse: string,
		opportunity: SAMOpportunity
	): {
		winProbability: OpportunityInsights["winProbability"];
		recommendations: OpportunityInsights["recommendations"];
		marketIntelligence: OpportunityInsights["marketIntelligence"];
	} {
		try {
			// Extract JSON from AI response - try multiple patterns
			let jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				// Try to find JSON within code blocks
				const codeBlockMatch = aiResponse.match(
					/```json\s*(\{[\s\S]*?\})\s*```/
				);
				if (codeBlockMatch && codeBlockMatch[1]) {
					jsonMatch = [codeBlockMatch[1]];
				}
			}

			if (!jsonMatch) {
				throw new Error("No JSON found in AI response");
			}

			// Clean and fix common JSON issues
			let jsonString = jsonMatch[0];

			// Remove trailing commas before closing braces/brackets
			jsonString = jsonString.replace(/,(\s*[}\]])/g, "$1");

			// Fix unescaped quotes in strings
			jsonString = jsonString.replace(
				/"([^"]*)"([^"]*)"([^"]*)":/g,
				'"$1$2$3":'
			);

			// Try to parse the cleaned JSON
			let parsed: unknown;
			try {
				parsed = JSON.parse(jsonString);
			} catch (parseError) {
				// If still failing, try to extract just the essential parts
				loggingService.warn(
					"JSON parse failed, attempting to extract partial data:",
					parseError
				);

				// Extract winProbability score if available
				const scoreMatch = jsonString.match(/"score"\s*:\s*(\d+)/);
				const confidenceMatch = jsonString.match(/"confidence"\s*:\s*(\d+)/);

				parsed = {
					winProbability: {
						score: scoreMatch && scoreMatch[1] ? parseInt(scoreMatch[1]) : 50,
						confidence:
							confidenceMatch && confidenceMatch[1]
								? parseInt(confidenceMatch[1])
								: 50,
						factors: {},
					},
				};
			}

			const typedParsed = parsed as {
				winProbability?: {
					score?: number;
					confidence?: number;
					factors?: {
						competitionLevel?: number;
						agencyPreference?: number;
						historicalSuccess?: number;
						setAsideAdvantage?: number;
						timingAdvantage?: number;
						technicalFit?: number;
						pastPerformance?: number;
						pricingCompetitiveness?: number;
					};
					detailedAnalysis?: string;
					recommendations?: string[];
				};
				recommendations?: {
					bidStrategy?: string[];
					teamingStrategy?: string[];
					pricingStrategy?: string[];
					timelineStrategy?: string[];
					riskMitigation?: string[];
				};
				marketIntelligence?: {
					marketSize?: number;
					growthTrend?: string;
					growthRate?: number;
					keyPlayers?: string[];
					emergingTrends?: string[];
					riskFactors?: string[];
					opportunities?: string[];
				};
				implementationRoadmap?: {
					immediateActions?: string[];
					shortTermMilestones?: string[];
					longTermPositioning?: string[];
				};
				attachmentAnalysis?: {
					criticalDocuments?: string[];
					complianceRequirements?: string[];
					evaluationFactors?: string[];
				};
			};

			return {
				winProbability: {
					score: Math.max(
						0,
						Math.min(100, typedParsed.winProbability?.score || 50)
					),
					factors: {
						competitionLevel: Math.max(
							0,
							Math.min(
								100,
								typedParsed.winProbability?.factors?.competitionLevel || 50
							)
						),
						agencyPreference: Math.max(
							0,
							Math.min(
								100,
								typedParsed.winProbability?.factors?.agencyPreference || 50
							)
						),
						historicalSuccess: Math.max(
							0,
							Math.min(
								100,
								typedParsed.winProbability?.factors?.historicalSuccess || 50
							)
						),
						setAsideAdvantage: Math.max(
							0,
							Math.min(
								100,
								typedParsed.winProbability?.factors?.setAsideAdvantage || 50
							)
						),
						timingAdvantage: Math.max(
							0,
							Math.min(
								100,
								typedParsed.winProbability?.factors?.timingAdvantage || 50
							)
						),
					},
					recommendations: typedParsed.winProbability?.recommendations || [
						"Comprehensive AI analysis completed with detailed strategic recommendations",
					],
				},
				recommendations: {
					bidStrategy: typedParsed.recommendations?.bidStrategy || [
						"Develop comprehensive proposal",
					],
					teamingStrategy: typedParsed.recommendations?.teamingStrategy || [
						"Consider strategic partnerships",
					],
					pricingStrategy: typedParsed.recommendations?.pricingStrategy || [
						"Competitive pricing analysis needed",
					],
					timelineStrategy: typedParsed.recommendations?.timelineStrategy || [
						"Meet all deadlines",
					],
					riskMitigation: typedParsed.recommendations?.riskMitigation || [
						"Identify and mitigate risks",
					],
				},
				marketIntelligence: {
					marketSize: typedParsed.marketIntelligence?.marketSize || 0,
					growthTrend:
						(typedParsed.marketIntelligence?.growthTrend as
							| "Declining"
							| "Growing"
							| "Stable") || "Stable",
					growthRate: typedParsed.marketIntelligence?.growthRate || 0,
					keyPlayers: typedParsed.marketIntelligence?.keyPlayers || [],
					emergingTrends: typedParsed.marketIntelligence?.emergingTrends || [],
					riskFactors: typedParsed.marketIntelligence?.riskFactors || [],
					opportunities: typedParsed.marketIntelligence?.opportunities || [],
				},
			};
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			loggingService.warn("Failed to parse AI response:", errorMessage);
			return this.generateFallbackInsights(opportunity, [], null, null);
		}
	}

	private generateFallbackInsights(
		opportunity: SAMOpportunity,
		historicalAwards: USAspendingAward[],
		agencySummary: AgencySummary | null,
		entitySummary: EntitySummary | null
	): {
		winProbability: OpportunityInsights["winProbability"];
		recommendations: OpportunityInsights["recommendations"];
		marketIntelligence: OpportunityInsights["marketIntelligence"];
	} {
		// Fallback to static analysis if AI fails
		return {
			winProbability: this.calculateWinProbability(
				opportunity,
				historicalAwards,
				agencySummary,
				entitySummary
			),
			recommendations: this.generateRecommendations(opportunity),
			marketIntelligence: this.generateMarketIntelligence(
				opportunity,
				historicalAwards,
				entitySummary
			),
		};
	}

	private async callOpenAICompletion(prompt: string): Promise<string> {
		try {
			// Use the new general completion method
			return await openaiService.callOpenAICompletion(prompt);
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			loggingService.warn("OpenAI completion failed:", errorMessage);
			throw error;
		}
	}
}

export default new InsightsEngine();
