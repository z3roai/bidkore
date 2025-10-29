import { type Response, Router } from "express";

import samGovService, {
	type SAMOpportunity,
	type SAMSearchParams,
} from "../services/samGovService";

import { type AuthRequest, authenticateToken } from "@/middleware/auth";
import dataEnhancementService from "@/services/dataEnhancementService";
import loggingService from "@/services/loggingService";
import { mapSamGovToCanonical } from "@/services/mappers/samGov.mapper";
import openaiService from "@/services/openaiService";
import { getUserPreferences } from "@/services/preferencesService";
import { rankOpportunities } from "@/services/rankingService";

const router = Router();

// AI-powered natural language search
router.post(
	"/search",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const { query, context } = req.body as {
				query?: string;
				context?: Record<string, unknown>;
			};

			if (!query || typeof query !== "string" || !query.trim()) {
				res.status(400).json({
					error: "Query is required and must be a non-empty string",
					example: "Find software development contracts in healthcare",
				});
				return;
			}

			// Check if OpenAI service is available
			const isAvailable = openaiService.isServiceAvailable();
			if (!isAvailable) {
				// Fallback to basic keyword search
				loggingService.warn(
					"[WARN] OpenAI service unavailable, using fallback search"
				);

				const fallbackParams = {
					keyword: query.trim(),
					limit: 25,
				};

				const liveOpportunities = await samGovService.searchOpportunities(
					fallbackParams
				);

				res.json({
					success: true,
					query: query.trim(),
					searchType: "fallback",
					aiServiceAvailable: false,
					opportunities: liveOpportunities,
					total: liveOpportunities.length,
					message:
						"AI service temporarily unavailable. Using basic keyword search.",
				});
				return;
			}

			// Log the incoming request for testing
			loggingService.info("AI search request received:", {
				userId: req.user.id,
				originalQuery: query.trim(),
				context: context ?? {},
				timestamp: new Date().toISOString(),
			});

			// Convert natural language to SAM.gov parameters using AI
			const aiResponse = await openaiService.convertNaturalLanguageToSAMQuery({
				naturalLanguageQuery: query.trim(),
				context: context ?? {},
			});

			// Log the AI conversion result
			loggingService.info("AI search conversion result:", {
				userId: req.user.id,
				originalQuery: query.trim(),
				confidence: aiResponse.confidence,
				parameters: aiResponse.samGovParams,
				explanation: aiResponse.explanation,
				suggestedKeywords: aiResponse.suggestedKeywords,
			});

			// Safety check: Ensure both postedFrom and postedTo are present if either is set
			const samGovParams = { ...aiResponse.samGovParams };
			if (
				aiResponse.samGovParams.postedFrom &&
				!aiResponse.samGovParams.postedTo
			) {
				// If postedFrom is set but postedTo is missing, set postedTo to today
				const today = new Date().toISOString().slice(0, 10);
				samGovParams.postedTo = today;
				loggingService.warn(
					"[WARN] AI generated postedFrom without postedTo, adding postedTo:",
					{
						postedFrom: aiResponse.samGovParams.postedFrom,
						postedTo: today,
					}
				);
			} else if (
				!aiResponse.samGovParams.postedFrom &&
				aiResponse.samGovParams.postedTo
			) {
				// If postedTo is set but postedFrom is missing, set postedFrom to 30 days ago
				const thirtyDaysAgo = new Date();
				thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
				const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);
				samGovParams.postedFrom = thirtyDaysAgoStr;
				loggingService.warn(
					"[WARN] AI generated postedTo without postedFrom, adding postedFrom:",
					{
						postedFrom: thirtyDaysAgoStr,
						postedTo: aiResponse.samGovParams.postedTo,
					}
				);
			}

			// Debug: Log the exact parameters being sent to SAM.gov
			loggingService.info("AI generated SAM.gov parameters:", {
				originalQuery: query.trim(),
				samGovParams,
				paramKeys: Object.keys(samGovParams),
				paramValues: Object.values(samGovParams),
			});

			// Execute SAM.gov search with AI-generated parameters
			let liveOpportunities: SAMOpportunity[] = [];
			try {
				loggingService.info("Calling SAM.gov with AI parameters:", {
					params: samGovParams,
					paramCount: Object.keys(samGovParams).length,
				});

				liveOpportunities = await samGovService.searchOpportunities(
					samGovParams
				);

				loggingService.info("AI search SAM.gov call successful:", {
					count: liveOpportunities.length,
					params: samGovParams,
					firstOpportunity: liveOpportunities[0]
						? {
								noticeId: liveOpportunities[0].noticeId,
								title: liveOpportunities[0].title,
								type: liveOpportunities[0].type,
								keys: Object.keys(liveOpportunities[0]),
						  }
						: null,
				});
			} catch (error) {
				loggingService.error("[ERROR] AI search SAM.gov call failed:", error);
				liveOpportunities = [];
			}

			// If AI search returns no results, try a fallback search with just the keyword
			if (liveOpportunities.length === 0) {
				loggingService.warn(
					"[WARN] AI search returned no results, trying fallback search"
				);

				// Remove potentially restrictive date parameters for fallback
				const fallbackParams: SAMSearchParams = {
					keyword: query.trim(),
					limit: samGovParams.limit ?? 25,
				};

				// Only add non-date parameters from AI response
				if (samGovParams.naicsCode) {
					fallbackParams.naicsCode = samGovParams.naicsCode;
				}
				if (samGovParams.agency) {
					fallbackParams.agency = samGovParams.agency;
				}
				if (samGovParams.setAside) {
					fallbackParams.setAside = samGovParams.setAside;
				}
				if (samGovParams.type) {
					fallbackParams.type = samGovParams.type;
				}
				if (samGovParams.status) {
					fallbackParams.status = samGovParams.status;
				}

				try {
					liveOpportunities = await samGovService.searchOpportunities(
						fallbackParams
					);
					loggingService.info("Fallback search results:", {
						fallbackCount: liveOpportunities.length,
						fallbackParams,
					});
				} catch (error) {
					loggingService.error("[ERROR] Fallback search failed:", error);
					liveOpportunities = [];
				}
			}

			// Enhance opportunities with federal API data (same as live search)
			loggingService.info("Starting enhancement process:", {
				opportunityCount: liveOpportunities.length,
				firstOpportunity: liveOpportunities[0]
					? {
							noticeId: liveOpportunities[0].noticeId,
							title: liveOpportunities[0].title,
					  }
					: null,
			});

			const enhancedOpportunities =
				await dataEnhancementService.enhanceOpportunities(liveOpportunities, {
					includeHistoricalData: true,
					includeEntityInfo: true,
					includeInsights: true,
					maxHistoricalAwards: 15,
					cacheResults: true,
					cacheTTL: 900, // 15 minutes
				});

			loggingService.info("Enhancement completed:", {
				originalCount: liveOpportunities.length,
				enhancedCount: enhancedOpportunities.length,
				firstEnhanced: enhancedOpportunities[0]
					? {
							noticeId: enhancedOpportunities[0].samData.noticeId,
							title: enhancedOpportunities[0].samData.title,
							hasInsights: Boolean(enhancedOpportunities[0].insights),
					  }
					: null,
			});

			// Map to canonical and rerank (same as live search)
			loggingService.info("Starting mapping process:", {
				enhancedCount: enhancedOpportunities.length,
			});

			const canonical = enhancedOpportunities
				.map((e, index) => {
					loggingService.info(`Mapping opportunity ${index + 1}:`, {
						noticeId: e.samData.noticeId,
						title: e.samData.title,
						samDataKeys: Object.keys(e.samData),
					});

					const mapped = mapSamGovToCanonical(e.samData);
					if (!mapped) {
						loggingService.error(
							`[ERROR] Failed to map opportunity ${index + 1}:`,
							{
								noticeId: e.samData.noticeId,
								title: e.samData.title,
								samData: e.samData,
							}
						);
					} else {
						loggingService.info(
							`Successfully mapped opportunity ${index + 1}:`,
							{
								noticeId: mapped.noticeId,
								title: mapped.title,
							}
						);
					}
					return mapped;
				})
				.filter((c): c is NonNullable<typeof c> => Boolean(c));

			loggingService.info("AI search mapping results:", {
				originalCount: liveOpportunities.length,
				enhancedCount: enhancedOpportunities.length,
				canonicalCount: canonical.length,
				canonical: canonical.map(c => ({
					noticeId: c.noticeId,
					title: c.title,
				})),
			});

			loggingService.info("Starting ranking process:", {
				canonicalCount: canonical.length,
				keyword:
					String(
						samGovParams.keyword ?? samGovParams.q ?? query.trim()
					).trim() || null,
			});

			const preferences = await getUserPreferences(req.user.id);
			loggingService.info("User preferences loaded:", {
				preferences,
				hasRankingWeights: Boolean(preferences.rankingWeights),
			});

			const ranked = rankOpportunities(canonical, {
				keyword:
					String(
						samGovParams.keyword ?? samGovParams.q ?? query.trim()
					).trim() || "",
				preferences,
			});

			loggingService.info("AI search ranking results:", {
				rankedCount: ranked.length,
				ranked: ranked.map(r => ({
					noticeId: r.noticeId,
					title: r.title,
					score: r.score,
				})),
			});

			// Transform to client format with AI assistant fields
			loggingService.info("Starting transformation to client format:", {
				rankedCount: ranked.length,
			});

			// Build lookup for enhanced insights by noticeId
			const enhancedByNoticeId = new Map(
				enhancedOpportunities.map(e => [e.samData.noticeId, e])
			);

			const transformedOpportunities = ranked.map((r, index) => {
				const enhanced = enhancedByNoticeId.get(r.noticeId);
				const insights = enhanced?.insights;

				const winRate = Math.max(
					0,
					Math.min(
						100,
						typeof insights?.winProbability?.score === "number"
							? insights.winProbability.score
							: Math.round(r.score * 10)
					)
				);

				let bidability: string;
				if (winRate >= 70) {
					bidability = "High";
				} else if (winRate >= 50) {
					bidability = "Medium";
				} else {
					bidability = "Low";
				}

				const assistantAnalysis: string[] = [];
				if (r.whyRanked && r.whyRanked.length > 0) {
					assistantAnalysis.push(...r.whyRanked.slice(0, 2));
				}
				if (insights?.recommendations?.bidStrategy?.length) {
					const bidStrategy = insights.recommendations.bidStrategy[0];
					if (bidStrategy) {
						assistantAnalysis.push(bidStrategy);
					}
				}

				// Build concise assistant advice string
				const adviceParts: string[] = [];
				const recs = insights?.recommendations;
				if (recs) {
					if (recs.bidStrategy?.[0]) {
						adviceParts.push(recs.bidStrategy[0]);
					}
					if (recs.teamingStrategy?.[0]) {
						adviceParts.push(recs.teamingStrategy[0]);
					}
					if (recs.pricingStrategy?.[0]) {
						adviceParts.push(recs.pricingStrategy[0]);
					}
					if (recs.timelineStrategy?.[0]) {
						adviceParts.push(recs.timelineStrategy[0]);
					}
					if (recs.riskMitigation?.[0]) {
						adviceParts.push(recs.riskMitigation[0]);
					}
				}
				// Fallback guidance
				if (adviceParts.length === 0) {
					if (r.responseDeadline) {
						adviceParts.push(
							`Prepare response by ${new Date(
								r.responseDeadline
							).toLocaleDateString()}`
						);
					}
					if (r.naicsCode) {
						adviceParts.push(
							`Confirm NAICS ${r.naicsCode} fit and past performance`
						);
					}
					adviceParts.push("Review attachments for scope and compliance");
				}
				const assistantAdvice = adviceParts.slice(0, 3).join(" • ");

				const transformed = {
					id: null,
					samId: r.noticeId,
					noticeId: r.noticeId,
					title: r.title,
					description: r.description,
					agency: r.agencyName,
					naicsCode: r.naicsCode,
					classificationCode: r.classificationCode,
					postedDate: r.postedDate,
					responseDeadline: r.responseDeadline,
					setAside: r.setAside,
					location: r.location ?? "N/A",
					estimatedValue: r.estimatedValue ?? null,
					uiLink: r.uiLink,
					score: r.score,
					whyRanked: r.whyRanked.slice(0, 3),
					probabilityOfSuccess: winRate,
					// New AI assistant fields
					bidability,
					winRate,
					assistantAnalysis,
					assistantAdvice,
					// Surface enhanced insights for UI (optional rendering)
					enhancedData: (() => {
						const enhancedData = insights
							? {
									rewrittenDescription: insights.rewrittenDescription,
									attachmentAnalysis: insights.attachmentAnalysis,
									attachmentLinks: insights.attachmentLinks,
									winProbability: insights.winProbability,
									awardAmountPrediction: insights.awardAmountPrediction,
									competitionAnalysis: insights.competitionAnalysis,
									agencyInsights: insights.agencyInsights,
									teamingOpportunities: insights.teamingOpportunities,
									marketIntelligence: insights.marketIntelligence,
									entityEligibility: insights.entityEligibility,
									recommendations: insights.recommendations,
									dataFreshness: insights.dataFreshness,
							  }
							: null;

						loggingService.debug("Enhanced data for client:", {
							noticeId: r.noticeId,
							hasInsights: !!insights,
							hasEnhancedData: !!enhancedData,
							hasRewrittenDescription: !!enhancedData?.rewrittenDescription,
							hasAttachmentAnalysis: !!enhancedData?.attachmentAnalysis,
							hasAttachmentLinks: !!enhancedData?.attachmentLinks,
							attachmentLinksCount: enhancedData?.attachmentLinks?.length || 0,
						});

						return enhancedData;
					})(),
					historicalAwards: enhanced?.historicalAwards,
					entityInfo: enhanced?.entityInfo,
				};

				loggingService.info(`Transformed opportunity ${index + 1}:`, {
					noticeId: transformed.noticeId,
					title: transformed.title,
					score: transformed.score,
					winRate: transformed.winRate,
					bidability: transformed.bidability,
				});

				return transformed;
			});

			// Ensure descriptions are actual text (not noticedesc URLs)
			const isNoticeDescUrl = (val?: string): boolean =>
				Boolean(val) &&
				val?.includes("api.sam.gov") === true &&
				val?.toLowerCase().includes("noticedesc") === true;
			await Promise.all(
				transformedOpportunities.map(
					async (opportunity: (typeof transformedOpportunities)[0]) => {
						try {
							if (isNoticeDescUrl(opportunity.description)) {
								const response = await samGovService.getOpportunityDescription(
									opportunity.noticeId
								);
								if (response?.description) {
									opportunity.description = response.description;
									// Note: detailedDescription property doesn't exist on the type
									// Consider adding it to the type definition if needed
								}
							}
						} catch (e) {
							loggingService.warn(
								"[WARN] Failed to enrich description from SAM.gov",
								{
									noticeId: opportunity.noticeId,
									error: (e as Error)?.message,
								}
							);
						}
					}
				)
			);

			loggingService.info("Final transformation results:", {
				transformedCount: transformedOpportunities.length,
				finalOpportunities: transformedOpportunities.map(t => ({
					noticeId: t.noticeId,
					title: t.title,
					score: t.score,
				})),
			});

			// Log the complete search response for testing
			loggingService.info("AI search completed successfully:", {
				userId: req.user.id,
				originalQuery: query.trim(),
				aiConfidence: aiResponse.confidence,
				resultCount: transformedOpportunities.length,
				totalResults: transformedOpportunities.length,
				searchType: "ai_powered",
				aiServiceAvailable: true,
				parameters: samGovParams,
				timestamp: new Date().toISOString(),
			});

			loggingService.logUserAction("ai_search", req.user.id, req.user.role, {
				originalQuery: query.trim(),
				aiConfidence: aiResponse.confidence,
				resultCount: transformedOpportunities.length,
				parameters: samGovParams,
			});

			res.json({
				success: true,
				query: query.trim(),
				searchType: "ai_powered",
				aiServiceAvailable: true,
				filterSummary: {
					keyword: samGovParams.keyword ?? samGovParams.q,
					naicsCode: samGovParams.naicsCode,
					agency: samGovParams.agency,
					postedFrom: samGovParams.postedFrom,
					postedTo: samGovParams.postedTo,
					status: samGovParams.status,
					type: samGovParams.type,
				},
				opportunities: transformedOpportunities,
				total: transformedOpportunities.length,
				limit: samGovParams.limit ?? 25,
				offset: 0,
				source: "sam.gov-ai",
				searchedAt: new Date().toISOString(),
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"ai_search",
				req.user?.id ?? "",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);

			// Provide helpful error messages
			if (
				error instanceof Error &&
				error.message.includes("OpenAI service is not initialized")
			) {
				res.status(503).json({
					error: "AI search service is temporarily unavailable",
					fallbackAvailable: true,
					message: "Please try using the regular search functionality.",
				});
			} else if (error instanceof Error && error.message.includes("SAM.gov")) {
				res.status(502).json({
					error: "Failed to search SAM.gov database",
					message:
						"The government database is temporarily unavailable. Please try again later.",
				});
			} else {
				res.status(500).json({
					error: "Failed to perform AI search",
					message: "An unexpected error occurred. Please try again.",
				});
			}
		}
	}
);

// Check AI service status
router.get(
	"/status",
	authenticateToken,
	async (_req: AuthRequest, res: Response): Promise<void> => {
		try {
			const testResult = await openaiService.testConnection();

			res.json({
				aiServiceAvailable: testResult.available,
				error: testResult.error ?? null,
				timestamp: new Date().toISOString(),
			});
		} catch (error: unknown) {
			loggingService.error(
				"[ERROR] Failed to check AI service status:",
				error instanceof Error ? error.message : String(error)
			);
			res.status(500).json({
				aiServiceAvailable: false,
				error: "Failed to check service status",
				timestamp: new Date().toISOString(),
			});
		}
	}
);

// Test AI conversion (for debugging and testing)
router.post(
	"/test-conversion",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const { query, context } = req.body as {
				query?: string;
				context?: Record<string, unknown>;
			};

			if (!query || typeof query !== "string" || !query.trim()) {
				res.status(400).json({
					error: "Query is required and must be a non-empty string",
					example: "Find software development contracts in healthcare",
				});
				return;
			}

			loggingService.info("AI test conversion request:", {
				userId: req.user.id,
				query: query.trim(),
				context: context ?? {},
			});

			// Test the AI conversion
			const aiResponse = await openaiService.convertNaturalLanguageToSAMQuery({
				naturalLanguageQuery: query.trim(),
				context: context ?? {},
			});

			// Safety check: Ensure both postedFrom and postedTo are present if either is set (same logic as main endpoint)
			const samGovParams = { ...aiResponse.samGovParams };
			if (
				aiResponse.samGovParams.postedFrom &&
				!aiResponse.samGovParams.postedTo
			) {
				// If postedFrom is set but postedTo is missing, set postedTo to today
				const today = new Date().toISOString().slice(0, 10);
				samGovParams.postedTo = today;
			} else if (
				!aiResponse.samGovParams.postedFrom &&
				aiResponse.samGovParams.postedTo
			) {
				// If postedTo is set but postedFrom is missing, set postedFrom to 30 days ago
				const thirtyDaysAgo = new Date();
				thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
				const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);
				samGovParams.postedFrom = thirtyDaysAgoStr;
			}

			// Build test URLs and curl commands
			const samGovUrl = buildSAMGovTestUrl(samGovParams);
			const curlCommand = buildCurlTestCommand(samGovParams);

			res.json({
				success: true,
				originalQuery: query.trim(),
				aiResponse,
				testUrls: {
					samGovUrl,
					curlCommand,
				},
				timestamp: new Date().toISOString(),
			});
		} catch (error: unknown) {
			loggingService.error("[ERROR] AI test conversion failed:", {
				error: error instanceof Error ? error.message : String(error),
				userId: req.user?.id,
				query: (req.body as { query?: string })?.query,
			});

			res.status(500).json({
				error: "Failed to test AI conversion",
				message: error instanceof Error ? error.message : String(error),
				timestamp: new Date().toISOString(),
			});
		}
	}
);

// Helper functions for test endpoints
function buildSAMGovTestUrl(params: SAMSearchParams): string {
	const baseUrl = "https://api.sam.gov/prod/opportunities/v2/search";
	const queryParams = new URLSearchParams();

	// Add API key placeholder
	queryParams.append("api_key", "YOUR_API_KEY_HERE");

	// Add search parameters
	Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
		if (value !== null && value !== "") {
			const apiKey = getSAMGovParamName(key);
			queryParams.append(apiKey, String(value));
		}
	});

	return `${baseUrl}?${queryParams.toString()}`;
}

function buildCurlTestCommand(params: SAMSearchParams): string {
	const baseUrl = "https://api.sam.gov/prod/opportunities/v2/search";
	const apiKey = "YOUR_API_KEY_HERE";

	let curlParams = "";
	Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
		if (value !== null && value !== "") {
			const paramName = getSAMGovParamName(key);
			curlParams += ` --data-urlencode "${paramName}=${String(value)}"`;
		}
	});

	return `curl -X GET "${baseUrl}?api_key=${apiKey}"${curlParams}`;
}

function getSAMGovParamName(key: string): string {
	const paramMapping: Record<string, string> = {
		keyword: "q",
		naicsCode: "naicsCode",
		agency: "agency",
		postedFrom: "postedFrom",
		postedTo: "postedTo",
		responseDeadlineFrom: "responseDeadlineFrom",
		responseDeadlineTo: "responseDeadlineTo",
		setAside: "setAside",
		type: "type",
		status: "status",
		limit: "pageSize",
		offset: "pageNumber",
		sort: "sort",
		order: "order",
	};

	return paramMapping[key] ?? key;
}

// Helper functions removed - they were unused

export default router;
