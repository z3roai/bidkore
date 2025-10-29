import type { EntitySummary } from "@/services/entityManagementService";
import loggingService from "@/services/loggingService";
import openaiService from "@/services/openaiService";
import type { SAMOpportunity } from "@/services/samGovService";
import type {
	AgencySummary,
	USAspendingAward,
} from "@/services/usaspendingService";
import { parseJson } from "@/utils/jsonParser";

export interface AIAnalysisRequest {
	opportunity: SAMOpportunity;
	historicalAwards: USAspendingAward[];
	agencySummary: AgencySummary | null;
	entitySummary: EntitySummary | null;
}

export interface AIWinProbabilityAnalysis {
	score: number; // 0-100
	confidence: number; // 0-100
	factors: {
		competitionLevel: number; // 0-100 (lower is better)
		agencyPreference: number; // 0-100 (higher is better)
		historicalSuccess: number; // 0-100 (higher is better)
		setAsideAdvantage: number; // 0-100 (higher is better)
		timingAdvantage: number; // 0-100 (higher is better)
		technicalFit: number; // 0-100 (higher is better)
		pastPerformance: number; // 0-100 (higher is better)
		pricingCompetitiveness: number; // 0-100 (higher is better)
	};
	detailedAnalysis: string;
	keySuccessFactors: string[];
	criticalChallenges: string[];
	recommendations: string[];
}

export interface AIMarketIntelligence {
	marketSize: number;
	growthTrend: "Declining" | "Growing" | "Stable";
	growthRate: number;
	keyPlayers: string[];
	emergingTrends: string[];
	riskFactors: string[];
	opportunities: string[];
	marketAnalysis: string;
}

export interface AIRecommendations {
	bidStrategy: string[];
	teamingStrategy: string[];
	pricingStrategy: string[];
	timelineStrategy: string[];
	riskMitigation: string[];
	competitivePositioning: string[];
	resourceAllocation: string[];
}

export interface AIAnalysisResponse {
	winProbability: AIWinProbabilityAnalysis;
	marketIntelligence: AIMarketIntelligence;
	recommendations: AIRecommendations;
	implementationRoadmap: {
		immediateActions: string[];
		shortTermMilestones: string[];
		longTermPositioning: string[];
	};
	attachmentAnalysis?: {
		criticalDocuments: string[];
		complianceRequirements: string[];
		evaluationFactors: string[];
	};
}

class AIAnalysisService {
	private readonly AI_ENABLED = true;

	/**
	 * Perform comprehensive AI analysis of an opportunity
	 */
	async analyzeOpportunity(
		request: AIAnalysisRequest
	): Promise<AIAnalysisResponse> {
		if (!this.AI_ENABLED) {
			return this.generateFallbackAnalysis(request.opportunity);
		}

		try {
			loggingService.info(
				"[AI Analysis] Starting comprehensive opportunity analysis",
				{
					noticeId: request.opportunity.noticeId,
					title: request.opportunity.title,
					hasHistoricalData: request.historicalAwards.length > 0,
					hasAgencyData: !!request.agencySummary,
					hasEntityData: !!request.entitySummary,
				}
			);

			const prompt = this.buildComprehensiveAnalysisPrompt(request);
			const aiResponse = await openaiService.callOpenAICompletion(prompt);

			loggingService.debug("[AI Analysis] Raw AI response received", {
				responseLength: aiResponse.length,
				responsePreview: aiResponse.substring(0, 200) + "...",
			});

			const parsedResponse = this.parseAIResponse(aiResponse);

			loggingService.info("[AI Analysis] Analysis completed successfully", {
				winProbabilityScore: parsedResponse.winProbability.score,
				confidence: parsedResponse.winProbability.confidence,
			});

			return parsedResponse;
		} catch (error) {
			loggingService.error(
				"[AI Analysis] Analysis failed, using fallback",
				error
			);
			return this.generateFallbackAnalysis(request.opportunity);
		}
	}

	/**
	 * Build comprehensive analysis prompt for GPT-5
	 */
	private buildComprehensiveAnalysisPrompt(request: AIAnalysisRequest): string {
		const { opportunity, historicalAwards, agencySummary, entitySummary } =
			request;

		return `You are an expert government contracting analyst with access to GPT-5's advanced capabilities and comprehensive knowledge base. Analyze this opportunity using your extensive knowledge of government contracting, market intelligence, competitive landscape, and industry trends to provide detailed, data-driven insights.

Use your comprehensive knowledge to:
- Research the specific agency's contracting patterns, preferences, and recent trends
- Analyze the NAICS code market dynamics, key players, and growth trends
- Evaluate competitive landscape and typical bidder profiles
- Assess market size, growth rates, and emerging opportunities
- Identify risk factors and compliance requirements specific to this type of contract
- Research similar contracts and their outcomes
- Analyze timing factors and market conditions
- Evaluate technical requirements and their implications

OPPORTUNITY DETAILS:
- Title: ${opportunity.title}
- Notice ID: ${opportunity.noticeId}
- Type: ${opportunity.type || "Unknown"}
- Agency: ${opportunity.fullParentPathName || "Unknown"}
- NAICS: ${opportunity.naicsCode || "Unknown"}
- Set-Aside: ${opportunity.typeOfSetAside || "None"}
- Posted: ${opportunity.postedDate || "Unknown"}
- Deadline: ${opportunity.responseDeadLine || "Unknown"}
- Description: ${
			opportunity.description?.substring(0, 2000) || "No description available"
		}

HISTORICAL AWARDS DATA:
${
	historicalAwards.length > 0
		? JSON.stringify(historicalAwards.slice(0, 10), null, 2)
		: "No historical data available"
}

AGENCY SUMMARY:
${
	agencySummary
		? JSON.stringify(agencySummary, null, 2)
		: "No agency data available"
}

ENTITY SUMMARY:
${
	entitySummary
		? JSON.stringify(entitySummary, null, 2)
		: "No entity data available"
}

ANALYSIS REQUIREMENTS:

1. WIN PROBABILITY ANALYSIS:
   - Calculate a precise score (0-100) based on comprehensive data analysis
   - Provide confidence level (0-100) for your assessment
   - Analyze each factor with specific reasoning:
     * Competition Level: Based on historical data, set-aside status, and market analysis
     * Agency Preference: Based on past awards, spending patterns, and contractor relationships
     * Historical Success: Based on similar opportunities and outcomes
     * Set-Aside Advantage: Based on eligibility and competition reduction
     * Timing Advantage: Based on deadline analysis and preparation time
     * Technical Fit: Based on requirements analysis and capabilities
     * Past Performance: Based on relevant experience and track record
     * Pricing Competitiveness: Based on market analysis and cost factors

2. MARKET INTELLIGENCE:
   - Provide specific market size estimates with reasoning based on your knowledge of the industry
   - Analyze growth trends with supporting data from your knowledge base
   - Identify key players with specific names and market share from your comprehensive database
   - Highlight emerging trends and their impact on this specific market segment
   - Assess risk factors and opportunities based on current market conditions
   - Include regulatory changes, technology trends, and economic factors affecting this market

3. STRATEGIC RECOMMENDATIONS:
   - Provide specific, actionable recommendations for each category based on your comprehensive knowledge
   - Base recommendations on data analysis and industry best practices, not generic advice
   - Include competitive positioning strategies tailored to this specific opportunity
   - Address resource allocation needs based on typical requirements for similar contracts
   - Include specific teaming strategies based on known contractor relationships and capabilities
   - Provide pricing strategies based on market analysis and historical data patterns

4. IMPLEMENTATION ROADMAP:
   - Create specific, time-bound action items based on typical contract timelines
   - Define clear milestones and success metrics tailored to this opportunity type
   - Address both immediate and long-term positioning strategies
   - Include compliance and certification requirements specific to this contract type
   - Provide risk mitigation strategies based on common challenges in similar contracts

RESPONSE FORMAT:
Return a comprehensive JSON response with the following structure:

{
  "winProbability": {
    "score": 0-100,
    "confidence": 0-100,
    "factors": {
      "competitionLevel": 0-100,
      "agencyPreference": 0-100,
      "historicalSuccess": 0-100,
      "setAsideAdvantage": 0-100,
      "timingAdvantage": 0-100,
      "technicalFit": 0-100,
      "pastPerformance": 0-100,
      "pricingCompetitiveness": 0-100
    },
    "detailedAnalysis": "Comprehensive 3-4 paragraph analysis explaining the win probability calculation, key success factors, and critical challenges. Include specific data points and reasoning.",
    "keySuccessFactors": ["Specific factor 1", "Specific factor 2", ...],
    "criticalChallenges": ["Specific challenge 1", "Specific challenge 2", ...],
    "recommendations": ["Specific, actionable recommendation 1", "Specific, actionable recommendation 2", ...]
  },
  "marketIntelligence": {
    "marketSize": 0,
    "growthTrend": "Declining" | "Growing" | "Stable",
    "growthRate": 0,
    "keyPlayers": ["Company 1", "Company 2", ...],
    "emergingTrends": ["Trend 1", "Trend 2", ...],
    "riskFactors": ["Risk 1", "Risk 2", ...],
    "opportunities": ["Opportunity 1", "Opportunity 2", ...],
    "marketAnalysis": "Detailed market analysis with specific insights and data points"
  },
  "recommendations": {
    "bidStrategy": ["Specific strategy 1", "Specific strategy 2", ...],
    "teamingStrategy": ["Specific teaming approach 1", "Specific teaming approach 2", ...],
    "pricingStrategy": ["Specific pricing approach 1", "Specific pricing approach 2", ...],
    "timelineStrategy": ["Specific timeline action 1", "Specific timeline action 2", ...],
    "riskMitigation": ["Specific risk mitigation 1", "Specific risk mitigation 2", ...],
    "competitivePositioning": ["Specific positioning strategy 1", "Specific positioning strategy 2", ...],
    "resourceAllocation": ["Specific resource allocation 1", "Specific resource allocation 2", ...]
  },
  "implementationRoadmap": {
    "immediateActions": ["Action 1 (next 48 hours)", "Action 2 (next week)", ...],
    "shortTermMilestones": ["Milestone 1 (next month)", "Milestone 2 (next quarter)", ...],
    "longTermPositioning": ["Long-term goal 1", "Long-term goal 2", ...]
  },
  "attachmentAnalysis": {
    "criticalDocuments": ["Document 1", "Document 2", ...],
    "complianceRequirements": ["Requirement 1", "Requirement 2", ...],
    "evaluationFactors": ["Factor 1", "Factor 2", ...]
  }
}

IMPORTANT:
- Use specific data points and reasoning for all assessments
- Avoid generic advice - provide tailored insights based on the actual opportunity
- Ensure all scores are justified with clear reasoning
- Make recommendations actionable and specific to this opportunity
- Use the provided historical data, agency data, and web search results to inform your analysis
- If data is insufficient, clearly state limitations and provide best-effort analysis based on available information`;
	}

	/**
	 * Parse AI response with robust error handling
	 */
	private parseAIResponse(aiResponse: string): AIAnalysisResponse {
		loggingService.debug("[AI Analysis] Parsing AI response:", {
			responseLength: aiResponse.length,
			responsePreview: aiResponse.substring(0, 200) + "...",
		});

		// Try to extract JSON from code blocks manually if needed
		let cleanedResponse = aiResponse;
		if (aiResponse.includes("```json") || aiResponse.includes("```")) {
			const codeBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;
			const jsonMatch = codeBlockRegex.exec(aiResponse);
			if (jsonMatch?.[1]) {
				cleanedResponse = jsonMatch[1];
				loggingService.debug("[AI Analysis] Extracted JSON from code block:", {
					extractedLength: cleanedResponse.length,
				});
			}
		}

		const parseResult = parseJson<AIAnalysisResponse>(cleanedResponse);

		if (!parseResult.success || !parseResult.data) {
			loggingService.warn(
				"[AI Analysis] Failed to parse AI response, using fallback",
				{
					error: parseResult.error,
					cleanedJson: parseResult.cleanedJson?.substring(0, 500),
					originalResponse: aiResponse.substring(0, 500),
					cleanedResponse: cleanedResponse.substring(0, 500),
				}
			);
			throw new Error(`AI response parsing failed: ${parseResult.error}`);
		}

		// Log the parsed data structure for debugging
		loggingService.debug("[AI Analysis] Parsed data structure:", {
			hasWinProbability: !!parseResult.data.winProbability,
			hasMarketIntelligence: !!parseResult.data.marketIntelligence,
			hasRecommendations: !!parseResult.data.recommendations,
			hasImplementationRoadmap: !!parseResult.data.implementationRoadmap,
			hasAttachmentAnalysis: !!parseResult.data.attachmentAnalysis,
			topLevelKeys: Object.keys(parseResult.data),
		});

		// Validate required fields exist
		const missingFields = [];
		if (!parseResult.data.winProbability) missingFields.push("winProbability");
		if (!parseResult.data.marketIntelligence)
			missingFields.push("marketIntelligence");
		if (!parseResult.data.recommendations)
			missingFields.push("recommendations");
		if (!parseResult.data.implementationRoadmap)
			missingFields.push("implementationRoadmap");

		if (missingFields.length > 0) {
			loggingService.warn(
				"[AI Analysis] Missing required fields in AI response",
				{
					missingFields,
					availableFields: Object.keys(parseResult.data),
					parsedData: JSON.stringify(parseResult.data, null, 2).substring(
						0,
						1000
					),
				}
			);
			throw new Error(
				`Missing required fields in AI response: ${missingFields.join(", ")}`
			);
		}

		// Validate and clean win probability data
		const winProbability = this.validateWinProbability(
			parseResult.data.winProbability
		);
		const marketIntelligence = this.validateMarketIntelligence(
			parseResult.data.marketIntelligence
		);
		const recommendations = this.validateRecommendations(
			parseResult.data.recommendations
		);

		return {
			winProbability,
			marketIntelligence,
			recommendations,
			implementationRoadmap: parseResult.data.implementationRoadmap,
			attachmentAnalysis: parseResult.data.attachmentAnalysis || {
				criticalDocuments: [],
				complianceRequirements: [],
				evaluationFactors: [],
			},
		};
	}

	/**
	 * Validate and clean win probability data
	 */
	private validateWinProbability(data: unknown): AIWinProbabilityAnalysis {
		const dataObj = data as Record<string, unknown>;
		const factors = (dataObj["factors"] as Record<string, unknown>) || {};

		return {
			score: Math.max(0, Math.min(100, (dataObj["score"] as number) || 50)),
			confidence: Math.max(
				0,
				Math.min(100, (dataObj["confidence"] as number) || 50)
			),
			factors: {
				competitionLevel: Math.max(
					0,
					Math.min(100, (factors["competitionLevel"] as number) || 50)
				),
				agencyPreference: Math.max(
					0,
					Math.min(100, (factors["agencyPreference"] as number) || 50)
				),
				historicalSuccess: Math.max(
					0,
					Math.min(100, (factors["historicalSuccess"] as number) || 50)
				),
				setAsideAdvantage: Math.max(
					0,
					Math.min(100, (factors["setAsideAdvantage"] as number) || 50)
				),
				timingAdvantage: Math.max(
					0,
					Math.min(100, (factors["timingAdvantage"] as number) || 50)
				),
				technicalFit: Math.max(
					0,
					Math.min(100, (factors["technicalFit"] as number) || 50)
				),
				pastPerformance: Math.max(
					0,
					Math.min(100, (factors["pastPerformance"] as number) || 50)
				),
				pricingCompetitiveness: Math.max(
					0,
					Math.min(100, (factors["pricingCompetitiveness"] as number) || 50)
				),
			},
			detailedAnalysis:
				(dataObj["detailedAnalysis"] as string) || "AI analysis completed",
			keySuccessFactors: Array.isArray(dataObj["keySuccessFactors"])
				? (dataObj["keySuccessFactors"] as string[])
				: [],
			criticalChallenges: Array.isArray(dataObj["criticalChallenges"])
				? (dataObj["criticalChallenges"] as string[])
				: [],
			recommendations: Array.isArray(dataObj["recommendations"])
				? (dataObj["recommendations"] as string[])
				: [],
		};
	}

	/**
	 * Validate and clean market intelligence data
	 */
	private validateMarketIntelligence(data: unknown): AIMarketIntelligence {
		const dataObj = data as Record<string, unknown>;
		return {
			marketSize: Math.max(0, (dataObj["marketSize"] as number) || 0),
			growthTrend: ["Declining", "Growing", "Stable"].includes(
				dataObj["growthTrend"] as string
			)
				? (dataObj["growthTrend"] as "Declining" | "Growing" | "Stable")
				: "Stable",
			growthRate: Math.max(0, (dataObj["growthRate"] as number) || 0),
			keyPlayers: Array.isArray(dataObj["keyPlayers"])
				? (dataObj["keyPlayers"] as string[])
				: [],
			emergingTrends: Array.isArray(dataObj["emergingTrends"])
				? (dataObj["emergingTrends"] as string[])
				: [],
			riskFactors: Array.isArray(dataObj["riskFactors"])
				? (dataObj["riskFactors"] as string[])
				: [],
			opportunities: Array.isArray(dataObj["opportunities"])
				? (dataObj["opportunities"] as string[])
				: [],
			marketAnalysis:
				(dataObj["marketAnalysis"] as string) || "Market analysis completed",
		};
	}

	/**
	 * Validate and clean recommendations data
	 */
	private validateRecommendations(data: unknown): AIRecommendations {
		const dataObj = data as Record<string, unknown>;
		return {
			bidStrategy: Array.isArray(dataObj["bidStrategy"])
				? (dataObj["bidStrategy"] as string[])
				: [],
			teamingStrategy: Array.isArray(dataObj["teamingStrategy"])
				? (dataObj["teamingStrategy"] as string[])
				: [],
			pricingStrategy: Array.isArray(dataObj["pricingStrategy"])
				? (dataObj["pricingStrategy"] as string[])
				: [],
			timelineStrategy: Array.isArray(dataObj["timelineStrategy"])
				? (dataObj["timelineStrategy"] as string[])
				: [],
			riskMitigation: Array.isArray(dataObj["riskMitigation"])
				? (dataObj["riskMitigation"] as string[])
				: [],
			competitivePositioning: Array.isArray(dataObj["competitivePositioning"])
				? (dataObj["competitivePositioning"] as string[])
				: [],
			resourceAllocation: Array.isArray(dataObj["resourceAllocation"])
				? (dataObj["resourceAllocation"] as string[])
				: [],
		};
	}

	/**
	 * Generate fallback analysis when AI is unavailable
	 */
	private generateFallbackAnalysis(
		_opportunity: SAMOpportunity
	): AIAnalysisResponse {
		return {
			winProbability: {
				score: 50,
				confidence: 20,
				factors: {
					competitionLevel: 50,
					agencyPreference: 50,
					historicalSuccess: 50,
					setAsideAdvantage: 50,
					timingAdvantage: 50,
					technicalFit: 50,
					pastPerformance: 50,
					pricingCompetitiveness: 50,
				},
				detailedAnalysis:
					"Limited data available for analysis. AI analysis service is currently unavailable.",
				keySuccessFactors: ["Data analysis required"],
				criticalChallenges: ["Insufficient data for comprehensive analysis"],
				recommendations: ["Manual analysis recommended"],
			},
			marketIntelligence: {
				marketSize: 0,
				growthTrend: "Stable",
				growthRate: 0,
				keyPlayers: [],
				emergingTrends: [],
				riskFactors: ["Limited data available"],
				opportunities: [],
				marketAnalysis: "Market analysis requires additional data",
			},
			recommendations: {
				bidStrategy: ["Manual analysis required"],
				teamingStrategy: ["Manual analysis required"],
				pricingStrategy: ["Manual analysis required"],
				timelineStrategy: ["Manual analysis required"],
				riskMitigation: ["Manual analysis required"],
				competitivePositioning: ["Manual analysis required"],
				resourceAllocation: ["Manual analysis required"],
			},
			implementationRoadmap: {
				immediateActions: ["Gather additional data"],
				shortTermMilestones: ["Complete manual analysis"],
				longTermPositioning: ["Develop comprehensive strategy"],
			},
		};
	}
}

export default new AIAnalysisService();
