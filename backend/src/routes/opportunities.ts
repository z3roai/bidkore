import { Prisma } from "@prisma/client";
import { type Router as ExpressRouter, type Response, Router } from "express";

import {
	optionalPremiumAttachmentAccess,
	requirePremiumAttachmentAccess,
} from "../middleware/requirePremiumAttachmentAccess";
import dataEnhancementService, {
	type EnhancedOpportunity as ServiceEnhancedOpportunity,
} from "../services/dataEnhancementService";

import { redisClient } from "@/config/redis";
import { type AuthRequest, authenticateToken } from "@/middleware/auth";
import { requireEmailVerification } from "@/middleware/emailVerification";
import ArchivedOpportunity from "@/models/ArchivedOpportunity";
import Opportunity from "@/models/Opportunity";
import attachmentService from "@/services/attachmentService";
import calendarSchedulingService from "@/services/calendarSchedulingService";
import dropboxService from "@/services/dropboxService";
import loggingService from "@/services/loggingService";
import { mapSamGovToCanonical } from "@/services/mappers/samGov.mapper";
import { getUserPreferences } from "@/services/preferencesService";
import { rankOpportunities } from "@/services/rankingService";
import samGovService, { type SAMOpportunity } from "@/services/samGovService";

// Utility function to convert Prisma Opportunity to SAMOpportunity
const convertOpportunityToSAM = (
	opportunity: Prisma.OpportunityGetPayload<Record<string, never>>
): SAMOpportunity => {
	return {
		noticeId: opportunity.noticeId,
		title: opportunity.title,
		...(opportunity.solicitationNumber && {
			solicitationNumber: opportunity.solicitationNumber,
		}),
		...(opportunity.fullParentPathName && {
			fullParentPathName: opportunity.fullParentPathName,
		}),
		...(opportunity.fullParentPathCode && {
			fullParentPathCode: opportunity.fullParentPathCode,
		}),
		...(opportunity.postedDate && {
			postedDate: opportunity.postedDate.toISOString(),
		}),
		...(opportunity.type && { type: opportunity.type }),
		...(opportunity.baseType && { baseType: opportunity.baseType }),
		...(opportunity.archiveType && { archiveType: opportunity.archiveType }),
		...(opportunity.archiveDate && {
			archiveDate: opportunity.archiveDate.toISOString(),
		}),
		...(opportunity.typeOfSetAsideDescription && {
			typeOfSetAsideDescription: opportunity.typeOfSetAsideDescription,
		}),
		...(opportunity.typeOfSetAside && {
			typeOfSetAside: opportunity.typeOfSetAside,
		}),
		...(opportunity.responseDeadLine && {
			responseDeadLine: opportunity.responseDeadLine.toISOString(),
		}),
		...(opportunity.naicsCode && { naicsCode: opportunity.naicsCode }),
		...(Array.isArray(opportunity.naicsCodes) && {
			naicsCodes: opportunity.naicsCodes as string[],
		}),
		...(opportunity.classificationCode && {
			classificationCode: opportunity.classificationCode,
		}),
		...(opportunity.active && { active: opportunity.active }),
		...(opportunity.award && {
			award: opportunity.award as {
				amount?: number;
				date?: string;
				contractor?: string;
			},
		}),
		...(opportunity.pointOfContact && {
			pointOfContact:
				opportunity.pointOfContact as SAMOpportunity["pointOfContact"],
		}),
		...(opportunity.description && { description: opportunity.description }),
		...(opportunity.organizationType && {
			organizationType: opportunity.organizationType,
		}),
		...(opportunity.officeAddress && {
			officeAddress:
				opportunity.officeAddress as SAMOpportunity["officeAddress"],
		}),
		...(opportunity.placeOfPerformance && {
			placeOfPerformance:
				opportunity.placeOfPerformance as SAMOpportunity["placeOfPerformance"],
		}),
		...(opportunity.additionalInfoLink && {
			additionalInfoLink: opportunity.additionalInfoLink,
		}),
		...(opportunity.uiLink && { uiLink: opportunity.uiLink }),
		...(opportunity.links && {
			links: opportunity.links as SAMOpportunity["links"],
		}),
		...(opportunity.resourceLinks && {
			resourceLinks:
				opportunity.resourceLinks as SAMOpportunity["resourceLinks"],
		}),
	} as SAMOpportunity;
};

// Type definitions for better type safety

// Extend AuthRequest to include premium attachment access
interface ExtendedAuthRequest extends AuthRequest {
	premiumAttachmentAccess?: boolean;
}

interface AwardData {
	value?: number;
	amount?: number;
	totalValue?: number;
}

interface WhereClause {
	isActive: boolean;
	title?: {
		contains: string;
		mode: "default" | "insensitive";
	};
	[key: string]: unknown;
}

interface SearchParams {
	limit: number;
	keyword?: string;
	[key: string]: unknown;
}

interface UpdateData {
	description?: string;
	detailedDescription?: string;
	[key: string]: unknown;
}

interface Attachment {
	name?: string;
	filename?: string;
	url?: string;
	link?: string;
	[key: string]: unknown;
}

interface ResourceLink {
	url?: string;
	text?: string;
	name?: string;
	[key: string]: unknown;
}

interface AttachmentData {
	hasAttachments?: boolean;
	totalCount: number;
	attachments: import("@/services/attachmentService").AttachmentInfo[];
	links?: string[];
}

interface TransformedOpportunity {
	id: number | null;
	samId: string;
	noticeId: string;
	title: string;
	description: string | null | undefined;
	detailedDescription: string | null | undefined;
	naicsCode: string | null | undefined;
	naicsCodes: string[] | null | undefined;
	agency: string | null | undefined;
	location: string;
	setAside: string | null | undefined;
	responseDeadline: string | null;
	responseDeadLine: string | null | undefined;
	postedDate: string | null | undefined;
	type: string | null | undefined;
	baseType: string | null | undefined;
	archiveType: string | null | undefined;
	archiveDate: string | null | undefined;
	status: string | null | undefined;
	active: boolean;
	estimatedValue: number | null;
	contractType: string | null | undefined;
	pointOfContact: unknown;
	contractingOfficer: unknown;
	scopeOfWork: string | null | undefined;
	fullParentPathName: string | null | undefined;
	fullParentPathCode: string | null | undefined;
	typeOfSetAside: string | null | undefined;
	typeOfSetAsideDescription: string | null | undefined;
	classificationCode: string | null | undefined;
	award: unknown;
	organizationType: string | null | undefined;
	officeAddress: unknown;
	placeOfPerformance: unknown;
	additionalInfoLink: string | null | undefined;
	uiLink: string | null | undefined;
	links: unknown;
	resourceLinks: unknown;
	metadata: {
		isLiveSearch?: boolean;
		isEnhanced?: boolean;
		searchKeyword?: string;
		searchedAt?: string;
		enhancementTimestamp?: string;
		confidenceScore?: number;
		dataSources?: string[];
		isActive?: boolean;
		createdAt?: Date;
		updatedAt?: Date;
	};
	isLiveSearch?: boolean;
	isEnhanced?: boolean;
	searchKeyword?: string;
	searchedAt?: string;
	enhancedData?: unknown;
	historicalAwards?: unknown[];
	entityInfo?: unknown;
	insights?: unknown;
	// Dynamic properties added at runtime
	score?: number;
	whyRanked?: string[];
	winRate?: number;
	probabilityOfSuccess?: number;
	bidability?: string;
	assistantAnalysis?: string[];
}

const router: ExpressRouter = Router();

// Error type guard
const isError = (error: unknown): error is Error => {
	return error instanceof Error;
};

// Helper function to log errors consistently
const logError = (
	service: {
		logUserError: (
			action: string,
			userId: string,
			role: string,
			error: Error
		) => void;
	},
	action: string,
	userId: string,
	role: string,
	error: unknown
): void => {
	service.logUserError(
		action,
		userId,
		role,
		isError(error) ? error : new Error("Unknown error")
	);
};

// Helper functions to safely extract data from JSON fields
const getLocationFromPerformance = (placeOfPerformance: unknown): string => {
	if (!placeOfPerformance) {
		return "N/A";
	}
	if (typeof placeOfPerformance === "string") {
		return placeOfPerformance;
	}
	if (typeof placeOfPerformance === "object") {
		const location = placeOfPerformance as {
			city?: { name?: string };
			state?: { name?: string };
			streetAddress?: string;
			zip?: string;
		};
		const parts = [
			location.streetAddress,
			location.city?.name,
			location.state?.name,
			location.zip,
		].filter(Boolean);
		return parts.length > 0 ? parts.join(", ") : "N/A";
	}
	return "N/A";
};

const getContactInfo = (pointOfContact: unknown): string => {
	if (!pointOfContact) {
		return "N/A";
	}

	if (typeof pointOfContact === "string") {
		return pointOfContact;
	}

	if (Array.isArray(pointOfContact)) {
		const contacts = pointOfContact
			.map(contact => {
				if (typeof contact === "object" && contact !== null) {
					const c = contact as {
						fullname?: string;
						email?: string;
						phone?: string;
						title?: string;
						type?: string;
					};
					const parts = [c.fullname, c.title, c.email, c.phone].filter(Boolean);
					return parts.length > 0 ? parts.join(" - ") : null;
				}
				return null;
			})
			.filter(Boolean);

		return contacts.length > 0 ? contacts.join("; ") : "N/A";
	}

	return "N/A";
};

const getEstimatedValue = (award: unknown): number | null => {
	if (!award) {
		return null;
	}
	if (typeof award === "object") {
		const awardObj = award as AwardData;
		return awardObj.value || awardObj.amount || awardObj.totalValue || null;
	}
	return null;
};

// Get all opportunities
router.get(
	"/",
	authenticateToken,
	requireEmailVerification,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const { page = 1, limit = 10, keyword } = req.query;
			const offset = (Number(page) - 1) * Number(limit);

			const whereClause: WhereClause = { isActive: true };

			if (keyword && typeof keyword === "string") {
				whereClause.title = {
					contains: keyword,
					mode: "insensitive",
				};
			}

			const opportunities = await Opportunity.findAndCountAll({
				where: whereClause,
				take: Number(limit),
				skip: offset,
				orderBy: { createdAt: "desc" },
			});

			res.json({
				opportunities: opportunities.rows.map(opp => ({
					id: opp.id,
					samId: opp.noticeId, // Add samId alias for frontend compatibility
					noticeId: opp.noticeId,
					title: opp.title,
					description: opp.description,
					detailedDescription: opp.detailedDescription,
					naicsCode: opp.naicsCode,
					naicsCodes: opp.naicsCodes,
					solicitationNumber: opp.solicitationNumber,
					agency: opp.fullParentPathName, // Map fullParentPathName to agency for frontend
					office: opp.fullParentPathCode, // Map fullParentPathCode to office for frontend
					location: getLocationFromPerformance(opp.placeOfPerformance),
					setAside: opp.typeOfSetAside,
					responseDeadline: opp.responseDeadLine
						? new Date(opp.responseDeadLine).toISOString()
						: null, // Convert to ISO string for frontend
					responseDeadLine: opp.responseDeadLine,
					postedDate: opp.postedDate,
					type: opp.type,
					baseType: opp.baseType,
					archiveType: opp.archiveType,
					archiveDate: opp.archiveDate,
					status: opp.active, // Map active to status
					active: opp.active === "Y" || opp.active === "true", // Convert to boolean
					estimatedValue: getEstimatedValue(opp.award),
					contractType: opp.type,
					pointOfContact: getContactInfo(opp.pointOfContact),
					contractingOfficer: getContactInfo(opp.pointOfContact), // Use pointOfContact as contractingOfficer
					scopeOfWork: opp.description, // Use description as scopeOfWork
					fullParentPathName: opp.fullParentPathName,
					fullParentPathCode: opp.fullParentPathCode,
					typeOfSetAside: opp.typeOfSetAside,
					typeOfSetAsideDescription: opp.typeOfSetAsideDescription,
					classificationCode: opp.classificationCode,
					award: opp.award,
					organizationType: opp.organizationType,
					officeAddress: opp.officeAddress,
					placeOfPerformance: opp.placeOfPerformance,
					additionalInfoLink: opp.additionalInfoLink,
					uiLink:
						opp.uiLink && !opp.uiLink.includes("api.sam.gov")
							? opp.uiLink
							: `https://sam.gov/opp/${opp.noticeId}`, // Ensure proper SAM.gov link
					links: opp.links,
					resourceLinks: opp.resourceLinks,
					metadata: {
						isActive: opp.isActive,
						createdAt: opp.createdAt,
						updatedAt: opp.updatedAt,
					},
					isActive: opp.isActive,
					createdAt: opp.createdAt,
					updatedAt: opp.updatedAt,
				})),
				total: opportunities.count,
				page: Number(page),
				limit: Number(limit),
				userSubscription: {
					planType: req.user.role.toLowerCase(),
					isPremium: ["PREMIUM", "ENTERPRISE", "ADMIN"].includes(req.user.role),
					isEnterprise: ["ENTERPRISE", "ADMIN"].includes(req.user.role),
					upgradeRecommended: !["PREMIUM", "ENTERPRISE", "ADMIN"].includes(
						req.user.role
					),
				},
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"get_opportunities",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				isError(error) ? error : new Error("Unknown error")
			);
			res.status(500).json({ error: "Failed to get opportunities" });
		}
	}
);

// Real-time SAM.gov search (ad-hoc searches)
router.post(
	"/save",
	authenticateToken,
	requireEmailVerification,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const payload = req.body as {
				noticeId: string;
				title: string;
				description?: string | null;
				postedDate?: string | null;
				responseDeadline?: string | null;
				agency?: string | null;
				naicsCode?: string | null;
				classificationCode?: string | null;
				setAside?: string | null;
				location?: string | null;
				uiLink?: string | null;
				links?: unknown;
				resourceLinks?: unknown;
			};

			if (!payload?.noticeId || !payload.title) {
				res.status(400).json({ error: "noticeId and title are required" });
				return;
			}

			// Upsert Opportunity by noticeId
			const existing = await Opportunity.findOne({
				where: { noticeId: payload.noticeId },
			});
			let savedOpportunityId: string;
			if (existing) {
				await Opportunity.update(
					{
						title: payload.title,
						description: payload.description || existing.description || null,
						postedDate: payload.postedDate
							? new Date(payload.postedDate)
							: existing.postedDate || null,
						responseDeadLine: payload.responseDeadline
							? new Date(payload.responseDeadline)
							: existing.responseDeadLine || null,
						fullParentPathName:
							payload.agency || existing.fullParentPathName || null,
						naicsCode: payload.naicsCode || existing.naicsCode || null,
						classificationCode:
							payload.classificationCode || existing.classificationCode || null,
						typeOfSetAside: payload.setAside || existing.typeOfSetAside || null,
						placeOfPerformance:
							payload.location || existing.placeOfPerformance || Prisma.DbNull,
						uiLink: payload.uiLink || existing.uiLink || null,
						links: payload.links || existing?.links || Prisma.DbNull,
						resourceLinks:
							payload.resourceLinks || existing?.resourceLinks || Prisma.DbNull,
					},
					{ where: { noticeId: payload.noticeId } }
				);
				savedOpportunityId = existing.id;
			} else {
				const created = await Opportunity.create({
					noticeId: payload.noticeId,
					title: payload.title,
					description: payload.description || null,
					postedDate: payload.postedDate ? new Date(payload.postedDate) : null,
					responseDeadLine: payload.responseDeadline
						? new Date(payload.responseDeadline)
						: null,
					fullParentPathName: payload.agency || null,
					naicsCode: payload.naicsCode || null,
					classificationCode: payload.classificationCode || null,
					typeOfSetAside: payload.setAside || null,
					placeOfPerformance: payload.location || Prisma.DbNull,
					uiLink: payload.uiLink || null,
					links: payload.links || Prisma.DbNull,
					resourceLinks: payload.resourceLinks || Prisma.DbNull,
				});
				savedOpportunityId = created.id;
			}

			// Create Archived record (saved/hearted)
			const existingArchive =
				await ArchivedOpportunity.findByUserAndOpportunity(
					req.user.id,
					savedOpportunityId
				);
			if (existingArchive) {
				res.status(200).json({
					success: true,
					saved: true,
					opportunityId: savedOpportunityId,
				});
				return;
			}

			await ArchivedOpportunity.create({
				user: { connect: { id: req.user.id } },
				opportunity: { connect: { id: savedOpportunityId } },
				isDropboxSynced: false,
				syncStatus: "COMPLETED",
				attachmentCount: 0,
				syncedAttachmentCount: 0,
			});

			// Auto-schedule calendar event for the opportunity deadline
			try {
				const opportunityForCalendar = {
					id: savedOpportunityId,
					noticeId: payload.noticeId,
					title: payload.title,
					responseDeadLine: payload.responseDeadline
						? new Date(payload.responseDeadline)
						: null,
					fullParentPathName: payload.agency || null,
					uiLink: payload.uiLink || null,
					description: payload.description || null,
				};

				const calendarResult =
					await calendarSchedulingService.createOpportunityDeadlineEvent(
						req.user.id,
						opportunityForCalendar
					);

				if (calendarResult.success && calendarResult.eventId) {
					await calendarSchedulingService.recordCalendarEvent(
						req.user.id,
						savedOpportunityId,
						calendarResult.eventId
					);

					loggingService.info("Calendar event created for saved opportunity", {
						userId: req.user.id,
						opportunityId: savedOpportunityId,
						eventId: calendarResult.eventId,
					});
				} else {
					loggingService.info("Calendar event not created", {
						userId: req.user.id,
						opportunityId: savedOpportunityId,
						reason: calendarResult.error,
					});
				}
			} catch (calendarError) {
				// Don't fail the save operation if calendar creation fails
				loggingService.error(
					"Error creating calendar event for saved opportunity",
					{
						error: calendarError,
						userId: req.user.id,
						opportunityId: savedOpportunityId,
					}
				);
			}

			res.status(201).json({
				success: true,
				saved: true,
				opportunityId: savedOpportunityId,
			});
		} catch (error: unknown) {
			logError(
				loggingService,
				"save_opportunity",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error
			);
			res.status(500).json({ error: "Failed to save opportunity" });
		}
	}
);

router.post(
	"/search/live",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const {
				keyword,
				limit = 20,
				...otherFilters
			} = req.body as {
				keyword?: string;
				limit?: number;
				naicsCode?: string;
				agency?: string;
				status?: string;
				type?: string;
				setAside?: string;
				postedFrom?: string;
				postedTo?: string;
				responseDeadlineFrom?: string;
				responseDeadlineTo?: string;
				[key: string]: unknown;
			};

			// Prepare search parameters
			const searchParams: SearchParams = {
				limit: Math.min(limit, 50), // Cap at 50 for performance
			};

			// Add keyword if provided
			if (keyword?.trim()) {
				searchParams.keyword = keyword.trim();
			}

			// Add other filters if provided
			if (otherFilters["naicsCode"]) {
				searchParams["naicsCode"] = otherFilters["naicsCode"];
			}
			if (otherFilters["agency"]) {
				searchParams["agency"] = otherFilters["agency"];
			}
			if (otherFilters["status"]) {
				searchParams["status"] = otherFilters["status"];
			}
			if (otherFilters["type"]) {
				searchParams["type"] = otherFilters["type"];
			}
			if (otherFilters["setAside"]) {
				searchParams["setAside"] = otherFilters["setAside"];
			}
			if (otherFilters["postedFrom"]) {
				searchParams["postedFrom"] = otherFilters["postedFrom"];
			}
			if (otherFilters["postedTo"]) {
				searchParams["postedTo"] = otherFilters["postedTo"];
			}
			if (otherFilters["responseDeadlineFrom"]) {
				searchParams["responseDeadlineFrom"] =
					otherFilters["responseDeadlineFrom"];
			}
			if (otherFilters["responseDeadlineTo"]) {
				searchParams["responseDeadlineTo"] = otherFilters["responseDeadlineTo"];
			}

			// Check if at least one search parameter is provided
			const hasSearchParams = Object.keys(searchParams).some(
				key => key !== "limit" && searchParams[key]?.toString().trim()
			);

			if (!hasSearchParams) {
				res
					.status(400)
					.json({ error: "At least one search parameter is required" });
				return;
			}

			// Perform real-time search on SAM.gov
			const liveOpportunities = await samGovService.searchOpportunities(
				searchParams
			);

			// Enhance opportunities with federal API data
			const enhancedOpportunities =
				await dataEnhancementService.enhanceOpportunities(liveOpportunities, {
					includeHistoricalData: true,
					includeEntityInfo: true,
					includeInsights: true,
					maxHistoricalAwards: 15,
					cacheResults: true,
					cacheTTL: 900, // 15 minutes
				});

			// Map to canonical and rank
			const canonical = enhancedOpportunities
				.map(e => mapSamGovToCanonical(e.samData as unknown))
				.filter((c): c is NonNullable<typeof c> => Boolean(c));
			const preferences = await getUserPreferences(req.user.id);
			const ranked = rankOpportunities(canonical, {
				...(keyword?.trim() && { keyword: keyword.trim() }),
				preferences,
			});

			// Transform enhanced opportunities to match our API format
			const transformedOpportunities: TransformedOpportunity[] =
				enhancedOpportunities.map((enhanced: ServiceEnhancedOpportunity) => {
					const opp = enhanced.samData; // Get the original SAM data
					return {
						id: null, // No local ID for live results
						samId: opp.noticeId,
						noticeId: opp.noticeId,
						title: opp.title,
						description: opp.description,
						detailedDescription: opp.description,
						naicsCode: opp.naicsCode,
						naicsCodes: opp.naicsCodes,
						agency: opp.fullParentPathName,
						location: getLocationFromPerformance(opp.placeOfPerformance),
						setAside: opp.typeOfSetAside,
						responseDeadline: opp.responseDeadLine
							? new Date(opp.responseDeadLine).toISOString()
							: null,
						responseDeadLine: opp.responseDeadLine,
						postedDate: opp.postedDate,
						type: opp.type,
						baseType: opp.baseType,
						archiveType: opp.archiveType,
						archiveDate: opp.archiveDate,
						status: opp.active,
						active: opp.active === "Y" || opp.active === "true",
						estimatedValue: getEstimatedValue(opp.award),
						contractType: opp.type,
						pointOfContact: getContactInfo(opp.pointOfContact),
						contractingOfficer: opp.pointOfContact,
						scopeOfWork: opp.description,
						fullParentPathName: opp.fullParentPathName,
						fullParentPathCode: opp.fullParentPathCode,
						typeOfSetAside: opp.typeOfSetAside,
						typeOfSetAsideDescription: opp.typeOfSetAsideDescription,
						classificationCode: opp.classificationCode,
						award: opp.award,
						organizationType: opp.organizationType,
						officeAddress: opp.officeAddress,
						placeOfPerformance: opp.placeOfPerformance,
						additionalInfoLink: opp.additionalInfoLink,
						uiLink:
							opp.uiLink && !opp.uiLink.includes("api.sam.gov")
								? opp.uiLink
								: `https://sam.gov/opp/${opp.noticeId}`,
						links: opp.links,
						resourceLinks: opp.resourceLinks,
						metadata: {
							isLiveSearch: true,
							searchKeyword: keyword?.trim() ?? "",
							searchedAt: new Date().toISOString(),
						},
						isLiveSearch: true,
						searchKeyword: keyword?.trim() ?? "",
						searchedAt: new Date().toISOString(),
						// Enhanced data
						historicalAwards: enhanced.historicalAwards,
						entityInfo: enhanced.entityInfo,
						insights: enhanced.insights,
						enhancedData: enhanced.insights,
					};
				});

			// Attach ranking info and AI assistant fields by noticeId
			const scoreById = new Map(
				ranked.map(r => [
					r.noticeId,
					{ score: r.score, whyRanked: r.whyRanked },
				])
			);
			const enhancedById = new Map(
				enhancedOpportunities.map(e => [e.samData.noticeId, e])
			);
			transformedOpportunities.forEach(o => {
				const s = scoreById.get(o.noticeId);
				if (s) {
					o.score = s.score;
					o.whyRanked = s.whyRanked;
				}
				const enhanced = enhancedById.get(o.noticeId);
				const insights = enhanced?.insights as
					| {
							winProbability?: { score?: number };
							recommendations?: { bidStrategy?: string[] };
					  }
					| undefined;
				let winRate: number | undefined = insights?.winProbability?.score;
				if (typeof winRate !== "number" && s) {
					winRate = Math.round((s.score || 0) * 10);
				}
				if (typeof winRate === "number") {
					winRate = Math.max(0, Math.min(100, winRate));
					o.winRate = winRate;
					o.probabilityOfSuccess = winRate;
					o.bidability = (() => {
						if (winRate >= 70) {
							return "High";
						}
						if (winRate >= 50) {
							return "Medium";
						}
						return "Low";
					})();
				}
				const assistantNotes: string[] = [];
				if (s?.whyRanked?.length) {
					assistantNotes.push(...s.whyRanked.slice(0, 2));
				}
				if (
					insights?.recommendations?.bidStrategy?.length &&
					insights.recommendations.bidStrategy[0]
				) {
					assistantNotes.push(insights.recommendations.bidStrategy[0]);
				}
				if (assistantNotes.length) {
					o.assistantAnalysis = assistantNotes;
				}
			});

			// Sort by score if available
			transformedOpportunities.sort((a, b) => (b.score || 0) - (a.score || 0));

			loggingService.logUserAction("live_search", req.user.id, req.user.role, {
				keyword: keyword?.trim() ?? "",
				resultCount: transformedOpportunities.length,
			});

			res.json({
				opportunities: transformedOpportunities,
				total: transformedOpportunities.length,
				limit: Math.min(limit, 50),
				offset: 0,
				source: "sam.gov-live",
				searchKeyword: keyword?.trim() ?? "",
				searchedAt: new Date().toISOString(),
				userSubscription: {
					planType: req.user.role.toLowerCase(),
					isPremium: ["PREMIUM", "ENTERPRISE", "ADMIN"].includes(req.user.role),
					isEnterprise: ["ENTERPRISE", "ADMIN"].includes(req.user.role),
					upgradeRecommended: !["PREMIUM", "ENTERPRISE", "ADMIN"].includes(
						req.user.role
					),
				},
			});
		} catch (error: unknown) {
			logError(
				loggingService,
				"live_search",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error
			);
			res.status(500).json({ error: "Failed to perform live search" });
		}
	}
);

// Enhanced search with federal API data enrichment
router.post(
	"/search/enhanced",
	authenticateToken,
	requireEmailVerification,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const {
				keyword,
				limit = 10,
				includeInsights = true,
				...otherFilters
			} = req.body as {
				keyword?: string;
				limit?: number;
				includeInsights?: boolean;
				[key: string]: unknown;
			};

			// Prepare search parameters
			const searchParams: SearchParams = {
				limit: Math.min(limit, 25), // Cap at 25 for enhanced search (more expensive)
			};

			// Add keyword if provided
			if (keyword?.trim()) {
				searchParams.keyword = keyword.trim();
			}

			// Add other filters if provided
			if (otherFilters["naicsCode"]) {
				searchParams["naicsCode"] = otherFilters["naicsCode"];
			}
			if (otherFilters["agency"]) {
				searchParams["agency"] = otherFilters["agency"];
			}
			if (otherFilters["status"]) {
				searchParams["status"] = otherFilters["status"];
			}
			if (otherFilters["type"]) {
				searchParams["type"] = otherFilters["type"];
			}
			if (otherFilters["setAside"]) {
				searchParams["setAside"] = otherFilters["setAside"];
			}
			if (otherFilters["postedFrom"]) {
				searchParams["postedFrom"] = otherFilters["postedFrom"];
			}
			if (otherFilters["postedTo"]) {
				searchParams["postedTo"] = otherFilters["postedTo"];
			}
			if (otherFilters["responseDeadlineFrom"]) {
				searchParams["responseDeadlineFrom"] =
					otherFilters["responseDeadlineFrom"];
			}
			if (otherFilters["responseDeadlineTo"]) {
				searchParams["responseDeadlineTo"] = otherFilters["responseDeadlineTo"];
			}

			// Check if at least one search parameter is provided
			const hasSearchParams = Object.keys(searchParams).some(
				key => key !== "limit" && searchParams[key]?.toString().trim()
			);

			if (!hasSearchParams) {
				res
					.status(400)
					.json({ error: "At least one search parameter is required" });
				return;
			}

			// Perform real-time search on SAM.gov
			const liveOpportunities = await samGovService.searchOpportunities(
				searchParams
			);

			if (liveOpportunities.length === 0) {
				res.json({
					opportunities: [],
					total: 0,
					limit: searchParams.limit,
					offset: 0,
					source: "sam.gov-enhanced",
					searchKeyword: keyword?.trim() || "",
					searchedAt: new Date().toISOString(),
					userSubscription: {
						planType: req.user.role.toLowerCase(),
						isPremium: ["PREMIUM", "ENTERPRISE", "ADMIN"].includes(
							req.user.role
						),
						isEnterprise: ["ENTERPRISE", "ADMIN"].includes(req.user.role),
						upgradeRecommended: !["PREMIUM", "ENTERPRISE", "ADMIN"].includes(
							req.user.role
						),
					},
				});
				return;
			}

			// Enhance opportunities with federal API data
			const enhancedOpportunities =
				await dataEnhancementService.enhanceOpportunities(liveOpportunities, {
					includeHistoricalData: true,
					includeEntityInfo: true,
					includeInsights,
					maxHistoricalAwards: 15,
					cacheResults: true,
					cacheTTL: 900, // 15 minutes
				});

			// Map to canonical and rank
			const canonical = enhancedOpportunities
				.map(e => mapSamGovToCanonical(e.samData as unknown))
				.filter((c): c is NonNullable<typeof c> => Boolean(c));
			const preferences = await getUserPreferences(req.user.id);
			const ranked = rankOpportunities(canonical, {
				...(keyword?.trim() && { keyword: keyword.trim() }),
				preferences,
			});

			// Transform enhanced opportunities to match our API format
			const transformedOpportunities: TransformedOpportunity[] =
				enhancedOpportunities.map(enhanced => {
					const opp = enhanced.samData;
					return {
						id: null, // No local ID for live results
						samId: opp.noticeId,
						noticeId: opp.noticeId,
						title: opp.title,
						description: opp.description,
						detailedDescription: opp.description,
						naicsCode: opp.naicsCode,
						naicsCodes: opp.naicsCodes,
						agency: opp.fullParentPathName,
						location: getLocationFromPerformance(opp.placeOfPerformance),
						setAside: opp.typeOfSetAside,
						responseDeadline: opp.responseDeadLine
							? new Date(opp.responseDeadLine).toISOString()
							: null,
						responseDeadLine: opp.responseDeadLine,
						postedDate: opp.postedDate,
						type: opp.type,
						baseType: opp.baseType,
						archiveType: opp.archiveType,
						archiveDate: opp.archiveDate,
						status: opp.active,
						active: opp.active === "Y" || opp.active === "true",
						estimatedValue: getEstimatedValue(opp.award),
						contractType: opp.type,
						pointOfContact: getContactInfo(opp.pointOfContact),
						contractingOfficer: opp.pointOfContact,
						scopeOfWork: opp.description,
						fullParentPathName: opp.fullParentPathName,
						fullParentPathCode: opp.fullParentPathCode,
						typeOfSetAside: opp.typeOfSetAside,
						typeOfSetAsideDescription: opp.typeOfSetAsideDescription,
						classificationCode: opp.classificationCode,
						award: opp.award,
						organizationType: opp.organizationType,
						officeAddress: opp.officeAddress,
						placeOfPerformance: opp.placeOfPerformance,
						additionalInfoLink: opp.additionalInfoLink,
						uiLink:
							opp.uiLink && !opp.uiLink.includes("api.sam.gov")
								? opp.uiLink
								: `https://sam.gov/opp/${opp.noticeId}`,
						links: opp.links,
						resourceLinks: opp.resourceLinks,
						metadata: {
							isLiveSearch: true,
							isEnhanced: true,
							searchKeyword: keyword?.trim() || "",
							searchedAt: new Date().toISOString(),
							enhancementTimestamp: enhanced.enhancementTimestamp,
							confidenceScore: enhanced.confidenceScore,
							dataSources: enhanced.dataSources,
						},
						isLiveSearch: true,
						isEnhanced: true,
						searchKeyword: keyword?.trim() || "",
						searchedAt: new Date().toISOString(),
						// Enhanced data
						enhancedData: enhanced.insights,
						historicalAwards: enhanced.historicalAwards.map(award => ({
							id: award.id,
							recipient_name: award.recipient_name,
							award_amount: award.award_amount,
							date_signed: award.date_signed,
							competition_type: award.competition_type,
							set_aside_type: award.set_aside_type,
							number_of_offers_received: award.number_of_offers_received,
						})),
						entityInfo: enhanced.entityInfo
							? {
									legal_business_name: enhanced.entityInfo.legal_business_name,
									uei: enhanced.entityInfo.uei,
									registration_status: enhanced.entityInfo.registration_status,
									socioeconomic_status:
										enhanced.entityInfo.socioeconomic_status,
									certifications: enhanced.entityInfo.certifications,
									small_business_designations:
										enhanced.entityInfo.small_business_designations,
							  }
							: null,
					};
				});

			// Attach ranking info by noticeId
			const scoreById = new Map(
				ranked.map(r => [
					r.noticeId,
					{ score: r.score, whyRanked: r.whyRanked },
				])
			);
			transformedOpportunities.forEach(o => {
				const s = scoreById.get(o.noticeId);
				if (s) {
					o.score = s.score;
					o.whyRanked = s.whyRanked;
				}
			});

			// Sort by score if available
			transformedOpportunities.sort((a, b) => (b.score || 0) - (a.score || 0));

			loggingService.logUserAction(
				"enhanced_search",
				req.user.id,
				req.user.role,
				{
					keyword: keyword?.trim(),
					resultCount: transformedOpportunities.length,
					enhancementTime: Date.now(),
				}
			);

			res.json({
				opportunities: transformedOpportunities,
				total: transformedOpportunities.length,
				limit: searchParams.limit,
				offset: 0,
				source: "sam.gov-enhanced",
				searchKeyword: keyword?.trim() || "",
				searchedAt: new Date().toISOString(),
				enhancementStats: {
					totalEnhanced: transformedOpportunities.length,
					averageConfidenceScore: Math.round(
						transformedOpportunities.reduce(
							(sum, opp) => sum + (opp.metadata?.confidenceScore || 0),
							0
						) / transformedOpportunities.length
					),
					dataSources: Array.from(
						new Set(
							transformedOpportunities.flatMap(
								opp => opp.metadata?.dataSources || []
							)
						)
					),
				},
				userSubscription: {
					planType: req.user.role.toLowerCase(),
					isPremium: ["PREMIUM", "ENTERPRISE", "ADMIN"].includes(req.user.role),
					isEnterprise: ["ENTERPRISE", "ADMIN"].includes(req.user.role),
					upgradeRecommended: !["PREMIUM", "ENTERPRISE", "ADMIN"].includes(
						req.user.role
					),
				},
			});
		} catch (error: unknown) {
			logError(
				loggingService,
				"enhanced_search",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error
			);
			res.status(500).json({ error: "Failed to perform enhanced search" });
		}
	}
);

// Search opportunities (existing local search)
router.get(
	"/search",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const { q, page = 1, limit = 10, status } = req.query;
			const offset = (Number(page) - 1) * Number(limit);

			const whereClause: WhereClause = { isActive: true };

			if (q && typeof q === "string") {
				whereClause.title = {
					contains: q,
					mode: "insensitive",
				};
			}

			if (status) {
				whereClause["active"] = status;
			}

			let opportunities = await Opportunity.findAndCountAll({
				where: whereClause,
				take: Number(limit),
				skip: offset,
				orderBy: { createdAt: "desc" },
			});

			// If no results with keyword search, show recent opportunities
			if (opportunities.count === 0 && q) {
				opportunities = await Opportunity.findAndCountAll({
					where: { isActive: true },
					take: Number(limit),
					skip: offset,
					orderBy: { createdAt: "desc" },
				});
			}

			const responseData = opportunities.rows.map(opp => ({
				id: opp.id,
				samId: opp.noticeId, // Add samId alias for frontend compatibility
				noticeId: opp.noticeId,
				title: opp.title,
				description: opp.description,
				detailedDescription: opp.detailedDescription,
				naicsCode: opp.naicsCode,
				naicsCodes: opp.naicsCodes,
				solicitationNumber: opp.solicitationNumber,
				agency: opp.fullParentPathName, // Map fullParentPathName to agency for frontend
				office: opp.fullParentPathCode, // Map fullParentPathCode to office for frontend
				location: getLocationFromPerformance(opp.placeOfPerformance),
				setAside: opp.typeOfSetAside,
				responseDeadline: opp.responseDeadLine, // Add responseDeadline alias
				responseDeadLine: opp.responseDeadLine,
				postedDate: opp.postedDate,
				type: opp.type,
				baseType: opp.baseType,
				archiveType: opp.archiveType,
				archiveDate: opp.archiveDate,
				status: opp.active, // Map active to status
				active: opp.active === "Y" || opp.active === "true", // Convert to boolean
				estimatedValue: getEstimatedValue(opp.award),
				contractType: opp.type,
				pointOfContact: getContactInfo(opp.pointOfContact),
				contractingOfficer: getContactInfo(opp.pointOfContact), // Use pointOfContact as contractingOfficer
				scopeOfWork: opp.description, // Use description as scopeOfWork
				fullParentPathName: opp.fullParentPathName,
				fullParentPathCode: opp.fullParentPathCode,
				typeOfSetAside: opp.typeOfSetAside,
				typeOfSetAsideDescription: opp.typeOfSetAsideDescription,
				classificationCode: opp.classificationCode,
				award: opp.award,
				organizationType: opp.organizationType,
				officeAddress: opp.officeAddress,
				placeOfPerformance: opp.placeOfPerformance,
				additionalInfoLink: opp.additionalInfoLink,
				uiLink: opp.uiLink,
				links: opp.links,
				resourceLinks: opp.resourceLinks,
				metadata: {
					isActive: opp.isActive,
					createdAt: opp.createdAt,
					updatedAt: opp.updatedAt,
				},
				isActive: opp.isActive,
				createdAt: opp.createdAt,
				updatedAt: opp.updatedAt,
			}));

			res.json({
				opportunities: responseData,
				total: opportunities.count,
				page: Number(page),
				limit: Number(limit),
				userSubscription: {
					planType: req.user.role.toLowerCase(),
					isPremium: ["PREMIUM", "ENTERPRISE", "ADMIN"].includes(req.user.role),
					isEnterprise: ["ENTERPRISE", "ADMIN"].includes(req.user.role),
					upgradeRecommended: !["PREMIUM", "ENTERPRISE", "ADMIN"].includes(
						req.user.role
					),
				},
			});
		} catch (error: unknown) {
			logError(
				loggingService,
				"search_opportunities",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error
			);
			res.status(500).json({ error: "Failed to search opportunities" });
		}
	}
);

// Get user's archived opportunities
router.get(
	"/archived",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			// Check if user has Premium or Enterprise plan
			if (!["PREMIUM", "ENTERPRISE", "ADMIN"].includes(req.user.role)) {
				res.status(403).json({
					error:
						"Premium or Enterprise plan required for viewing archived opportunities",
					upgradeRequired: true,
					currentPlan: req.user.role.toLowerCase(),
					requiredPlan: "premium",
				});
				return;
			}

			const { page = 1, limit = 10 } = req.query;
			const offset = (Number(page) - 1) * Number(limit);

			const archivedOpportunities = await ArchivedOpportunity.findByUserId(
				req.user.id,
				{
					skip: offset,
					take: Number(limit),
					orderBy: { archivedAt: "desc" },
				}
			);

			const total = await ArchivedOpportunity.countByUserId(req.user.id);

			res.json({
				archivedOpportunities,
				pagination: {
					page: Number(page),
					limit: Number(limit),
					total,
					totalPages: Math.ceil(total / Number(limit)),
				},
			});
		} catch (error: unknown) {
			logError(
				loggingService,
				"get_archived_opportunities",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error
			);
			res.status(500).json({ error: "Failed to get archived opportunities" });
		}
	}
);

// Get opportunity by ID
router.get(
	"/:id",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const opportunityId = req.params["id"];
			if (!opportunityId) {
				res.status(400).json({ error: "Invalid opportunity ID" });
				return;
			}

			const opportunity = await Opportunity.findByPk(opportunityId);

			if (!opportunity) {
				res.status(404).json({ error: "Opportunity not found" });
				return;
			}

			// Check if detailed description exists, if not fetch from SAM.gov
			let { detailedDescription } = opportunity;
			let descriptionSource = "database";

			// Check if description is a URL that needs to be fetched
			const isDescriptionUrl =
				detailedDescription &&
				typeof detailedDescription === "string" &&
				detailedDescription.includes("api.sam.gov") &&
				detailedDescription.includes("noticedesc");

			if (!detailedDescription || isDescriptionUrl) {
				if (isDescriptionUrl) {
					// If it's a URL, fetch the description directly from the URL
					try {
						const descriptionContent =
							await samGovService.fetchDescriptionFromUrl(
								detailedDescription as string
							);
						if (descriptionContent) {
							detailedDescription = descriptionContent;
							descriptionSource = "sam_gov_url";

							// Update the opportunity with the fetched description
							await Opportunity.update(
								{ detailedDescription: descriptionContent },
								{ where: { id: opportunity.id } }
							);

							loggingService.logUserAction(
								"auto_fetch_description",
								req.user.id,
								req.user.role,
								{
									opportunityId,
									noticeId: opportunity.noticeId,
									descriptionLength: descriptionContent.length,
									wasUrl: true,
								}
							);
						}
					} catch (error: unknown) {
						logError(
							loggingService,
							"auto_fetch_description",
							req.user.id,
							req.user.role,
							error
						);
					}
				} else if (opportunity.noticeId) {
					// If no description and we have noticeId, try to get description
					try {
						const samData = await samGovService.getOpportunityDescription(
							opportunity.noticeId
						);
						if (samData?.description) {
							detailedDescription = samData.description;
							descriptionSource = "sam_gov";

							// Update the opportunity with the fetched description
							await Opportunity.update(
								{ detailedDescription: samData.description },
								{ where: { id: opportunity.id } }
							);

							loggingService.logUserAction(
								"auto_fetch_description",
								req.user.id,
								req.user.role,
								{
									opportunityId,
									noticeId: opportunity.noticeId,
									descriptionLength: samData.description.length,
									wasUrl: false,
								}
							);
						}
					} catch (error: unknown) {
						logError(
							loggingService,
							"auto_fetch_description",
							req.user.id,
							req.user.role,
							error
						);
					}
				}
			}

			res.json({
				opportunity: {
					id: opportunity.id,
					noticeId: opportunity.noticeId,
					title: opportunity.title,
					description: opportunity.description,
					detailedDescription,
					descriptionSource,
					naicsCode: opportunity.naicsCode,
					naicsCodes: opportunity.naicsCodes,
					solicitationNumber: opportunity.solicitationNumber,
					agency: opportunity.fullParentPathName, // Map fullParentPathName to agency for frontend
					office: opportunity.fullParentPathCode, // Map fullParentPathCode to office for frontend
					location: getLocationFromPerformance(opportunity.placeOfPerformance),
					setAside: opportunity.typeOfSetAside,
					responseDeadline: opportunity.responseDeadLine
						? new Date(opportunity.responseDeadLine).toISOString()
						: null, // Convert to ISO string for frontend
					responseDeadLine: opportunity.responseDeadLine,
					postedDate: opportunity.postedDate,
					type: opportunity.type,
					baseType: opportunity.baseType,
					archiveType: opportunity.archiveType,
					archiveDate: opportunity.archiveDate,
					status: opportunity.active, // Map active to status
					active: opportunity.active === "Y" || opportunity.active === "true", // Convert to boolean
					estimatedValue: getEstimatedValue(opportunity.award), // Try multiple possible value fields
					contractType: opportunity.type,
					pointOfContact: opportunity.pointOfContact,
					contractingOfficer: opportunity.pointOfContact, // Use pointOfContact as contractingOfficer
					scopeOfWork: opportunity.description, // Use description as scopeOfWork
					fullParentPathName: opportunity.fullParentPathName,
					fullParentPathCode: opportunity.fullParentPathCode,
					typeOfSetAside: opportunity.typeOfSetAside,
					typeOfSetAsideDescription: opportunity.typeOfSetAsideDescription,
					classificationCode: opportunity.classificationCode,
					award: opportunity.award,
					organizationType: opportunity.organizationType,
					officeAddress: opportunity.officeAddress,
					placeOfPerformance: opportunity.placeOfPerformance,
					additionalInfoLink: opportunity.additionalInfoLink,
					uiLink:
						opportunity.uiLink && !opportunity.uiLink.includes("api.sam.gov")
							? opportunity.uiLink
							: `https://sam.gov/opp/${opportunity.noticeId}`, // Ensure proper SAM.gov link
					links: opportunity.links,
					resourceLinks: opportunity.resourceLinks,
					metadata: {
						isActive: opportunity.isActive,
						createdAt: opportunity.createdAt,
						updatedAt: opportunity.updatedAt,
					},
					isActive: opportunity.isActive,
					createdAt: opportunity.createdAt,
					updatedAt: opportunity.updatedAt,
				},
			});
		} catch (error: unknown) {
			logError(
				loggingService,
				"get_opportunity_details",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error
			);
			res.status(500).json({ error: "Failed to get opportunity details" });
		}
	}
);

// Refresh opportunity from SAM.gov
router.post(
	"/:id/refresh",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const opportunityId = req.params["id"];
			if (!opportunityId) {
				res.status(400).json({ error: "Invalid opportunity ID" });
				return;
			}

			const opportunity = await Opportunity.findByPk(opportunityId);

			if (!opportunity) {
				res.status(404).json({ error: "Opportunity not found" });
				return;
			}

			// Get fresh data from SAM.gov
			const samData = await samGovService.getOpportunityDetails(
				opportunity.noticeId
			);
			if (!samData) {
				res.status(404).json({ error: "Opportunity not found on SAM.gov" });
				return;
			}

			// Update opportunity with fresh data
			await Opportunity.update(
				{
					// SAM.gov fields - exact match to API response
					noticeId: samData.noticeId,
					title: samData.title,
					solicitationNumber: samData.solicitationNumber || null,
					fullParentPathName: samData.fullParentPathName || null,
					fullParentPathCode: samData.fullParentPathCode || null,
					postedDate: samData.postedDate ? new Date(samData.postedDate) : null,
					type: samData.type || null,
					baseType: samData.baseType || null,
					archiveType: samData.archiveType || null,
					archiveDate: samData.archiveDate
						? new Date(samData.archiveDate)
						: null,
					typeOfSetAsideDescription: samData.typeOfSetAsideDescription || null,
					typeOfSetAside: samData.typeOfSetAside || null,
					responseDeadLine: samData.responseDeadLine
						? new Date(samData.responseDeadLine)
						: null,
					naicsCode: samData.naicsCode || null,
					naicsCodes: samData.naicsCodes || Prisma.DbNull,
					classificationCode: samData.classificationCode || null,
					active: samData.active || null,
					award: samData.award || Prisma.DbNull,
					pointOfContact: Array.isArray(samData.pointOfContact)
						? (samData.pointOfContact as unknown as Prisma.InputJsonValue)
						: samData.pointOfContact
						? ([samData.pointOfContact] as unknown as Prisma.InputJsonValue)
						: Prisma.DbNull,
					description: samData.description || null,
					organizationType: samData.organizationType || null,
					officeAddress: samData.officeAddress || Prisma.DbNull,
					placeOfPerformance: samData.placeOfPerformance || Prisma.DbNull,
					additionalInfoLink: samData.additionalInfoLink || null,
					uiLink: samData.uiLink || null,
					links: samData.links || Prisma.DbNull,
					resourceLinks: samData.resourceLinks || Prisma.DbNull,
				},
				{ where: { id: opportunity.id } }
			);

			// Clear cache
			const cacheKey = `opportunity:${opportunityId}`;
			await redisClient.del(cacheKey);

			loggingService.logUserAction(
				"refresh_opportunity",
				req.user.id,
				req.user.role,
				{ opportunityId }
			);

			res.json({
				message: "Opportunity refreshed successfully",
				opportunity: {
					id: opportunity.id,
					samId: opportunity.noticeId, // Add samId alias for frontend compatibility
					noticeId: opportunity.noticeId,
					title: opportunity.title,
					description: opportunity.description,
					detailedDescription: opportunity.detailedDescription,
					naicsCode: opportunity.naicsCode,
					naicsCodes: opportunity.naicsCodes,
					solicitationNumber: opportunity.solicitationNumber,
					agency: opportunity.fullParentPathName, // Map fullParentPathName to agency for frontend
					office: opportunity.fullParentPathCode, // Map fullParentPathCode to office for frontend
					location: getLocationFromPerformance(opportunity.placeOfPerformance),
					setAside: opportunity.typeOfSetAside,
					responseDeadline: opportunity.responseDeadLine
						? new Date(opportunity.responseDeadLine).toISOString()
						: null, // Convert to ISO string for frontend
					responseDeadLine: opportunity.responseDeadLine,
					postedDate: opportunity.postedDate,
					type: opportunity.type,
					baseType: opportunity.baseType,
					archiveType: opportunity.archiveType,
					archiveDate: opportunity.archiveDate,
					status: opportunity.active, // Map active to status
					active: opportunity.active === "Y" || opportunity.active === "true", // Convert to boolean
					estimatedValue: getEstimatedValue(opportunity.award), // Try multiple possible value fields
					contractType: opportunity.type,
					pointOfContact: opportunity.pointOfContact,
					contractingOfficer: opportunity.pointOfContact, // Use pointOfContact as contractingOfficer
					scopeOfWork: opportunity.description, // Use description as scopeOfWork
					fullParentPathName: opportunity.fullParentPathName,
					fullParentPathCode: opportunity.fullParentPathCode,
					typeOfSetAside: opportunity.typeOfSetAside,
					typeOfSetAsideDescription: opportunity.typeOfSetAsideDescription,
					classificationCode: opportunity.classificationCode,
					award: opportunity.award,
					organizationType: opportunity.organizationType,
					officeAddress: opportunity.officeAddress,
					placeOfPerformance: opportunity.placeOfPerformance,
					additionalInfoLink: opportunity.additionalInfoLink,
					uiLink:
						opportunity.uiLink && !opportunity.uiLink.includes("api.sam.gov")
							? opportunity.uiLink
							: `https://sam.gov/opp/${opportunity.noticeId}`, // Ensure proper SAM.gov link
					links: opportunity.links,
					resourceLinks: opportunity.resourceLinks,
					metadata: {
						isActive: opportunity.isActive,
						createdAt: opportunity.createdAt,
						updatedAt: opportunity.updatedAt,
					},
					isActive: opportunity.isActive,
					createdAt: opportunity.createdAt,
					updatedAt: opportunity.updatedAt,
				},
			});
		} catch (error: unknown) {
			logError(
				loggingService,
				"refresh_opportunity",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error
			);
			res.status(500).json({ error: "Failed to refresh opportunity" });
		}
	}
);

// Fetch opportunity description from SAM.gov
router.get(
	"/:id/description",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const opportunityId = req.params["id"];
			if (!opportunityId) {
				res.status(400).json({ error: "Invalid opportunity ID" });
				return;
			}

			const opportunity = await Opportunity.findByPk(opportunityId);

			if (!opportunity) {
				res.status(404).json({ error: "Opportunity not found" });
				return;
			}

			// Check if detailed description already exists in database
			if (opportunity.detailedDescription) {
				loggingService.logUserAction(
					"fetch_opportunity_description",
					req.user.id,
					req.user.role,
					{
						opportunityId,
						source: "database_cache",
						descriptionLength: opportunity.detailedDescription.length,
					}
				);

				res.json({
					description: opportunity.detailedDescription,
					message: "Description retrieved from database cache",
					source: "database",
				});
				return;
			}

			const { noticeId } = opportunity;
			if (!noticeId) {
				res
					.status(400)
					.json({ error: "No notice ID available for this opportunity" });
				return;
			}

			// Fetch description from SAM.gov using our service
			const samData = await samGovService.getOpportunityDescription(noticeId);

			if (samData?.description) {
				// Update the opportunity with the fetched description in detailedDescription field
				await Opportunity.update(
					{ detailedDescription: samData.description },
					{ where: { id: opportunity.id } }
				);

				loggingService.logUserAction(
					"fetch_opportunity_description",
					req.user.id,
					req.user.role,
					{
						opportunityId,
						noticeId,
						source: "sam_gov_api",
						descriptionLength: samData.description.length,
					}
				);

				res.json({
					description: samData.description,
					message: "Description fetched from SAM.gov and saved to database",
					source: "sam_gov",
				});
			} else {
				res.status(404).json({ error: "Description not found on SAM.gov" });
			}
		} catch (error: unknown) {
			logError(
				loggingService,
				"fetch_opportunity_description",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error
			);
			res
				.status(500)
				.json({ error: "Failed to fetch opportunity description" });
		}
	}
);

// Fetch opportunity description from SAM.gov by noticeId (for live search cards)
router.get(
	"/sam/:noticeId/description",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			const { noticeId } = req.params;
			if (!noticeId) {
				res.status(400).json({ error: "noticeId is required" });
				return;
			}

			const samData = await samGovService.getOpportunityDescription(noticeId);
			if (samData?.description) {
				res.json({
					success: true,
					description: samData.description,
					source: "sam_gov",
				});
				return;
			}

			res.status(404).json({ error: "Description not found on SAM.gov" });
		} catch (error: unknown) {
			logError(
				loggingService,
				"fetch_description_by_noticeId",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error
			);
			res.status(500).json({ error: "Failed to fetch description" });
		}
	}
);

// Update opportunity description
router.patch(
	"/:id/description",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const opportunityId = req.params["id"];
			if (!opportunityId) {
				res.status(400).json({ error: "Invalid opportunity ID" });
				return;
			}

			const { description, detailedDescription } = req.body as {
				description?: string;
				detailedDescription?: string;
			};

			if (!description && !detailedDescription) {
				res
					.status(400)
					.json({ error: "Description or detailedDescription is required" });
				return;
			}

			const opportunity = await Opportunity.findByPk(opportunityId);
			if (!opportunity) {
				res.status(404).json({ error: "Opportunity not found" });
				return;
			}

			const updateData: UpdateData = {};
			if (description) {
				updateData.description = description;
			}
			if (detailedDescription) {
				updateData.detailedDescription = detailedDescription;
			}

			await Opportunity.update(updateData, { where: { id: opportunity.id } });

			loggingService.logUserAction(
				"update_opportunity_description",
				req.user.id,
				req.user.role,
				{
					opportunityId,
					descriptionLength: description?.length || 0,
				}
			);

			res.json({ message: "Description updated successfully" });
		} catch (error: unknown) {
			logError(
				loggingService,
				"update_opportunity_description",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error
			);
			res
				.status(500)
				.json({ error: "Failed to update opportunity description" });
		}
	}
);

// Archive an opportunity for the current user (Premium/Enterprise feature)
router.post(
	"/:id/archive",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			// Check if user has Premium or Enterprise plan
			if (!["PREMIUM", "ENTERPRISE", "ADMIN"].includes(req.user.role)) {
				res.status(403).json({
					error:
						"Premium or Enterprise plan required for archiving opportunities",
					upgradeRequired: true,
					currentPlan: req.user.role.toLowerCase(),
					requiredPlan: "premium",
				});
				return;
			}

			const opportunityId = req.params["id"];
			const { saveToDropbox = false } = req.body as {
				saveToDropbox?: boolean;
			};

			if (!opportunityId) {
				res.status(400).json({ error: "Invalid opportunity ID" });
				return;
			}

			// Check if opportunity exists
			const opportunity = await Opportunity.findByPk(opportunityId);
			if (!opportunity) {
				res.status(404).json({ error: "Opportunity not found" });
				return;
			}

			// Check if already archived by this user
			const existingArchive =
				await ArchivedOpportunity.findByUserAndOpportunity(
					req.user.id,
					opportunityId
				);

			if (existingArchive) {
				res.status(400).json({
					error: "Opportunity already archived by this user",
					archivedAt: existingArchive.archivedAt,
				});
				return;
			}

			// Create archived opportunity record
			const archivedOpportunity = await ArchivedOpportunity.create({
				user: { connect: { id: req.user.id } },
				opportunity: { connect: { id: opportunityId } },
				isDropboxSynced: false,
				syncStatus: saveToDropbox ? "PENDING" : "COMPLETED",
				attachmentCount: 0,
				syncedAttachmentCount: 0,
			});

			loggingService.logUserAction(
				"archive_opportunity",
				req.user.id,
				req.user.role,
				{
					opportunityId,
					saveToDropbox,
					archivedOpportunityId: archivedOpportunity.id,
				}
			);

			// Handle Dropbox sync if requested
			let dropboxResult = null;
			if (saveToDropbox) {
				try {
					// Extract attachments from opportunity data
					const attachments: { url: string; filename: string }[] = [];

					// Check for attachments in the opportunity object
					if (
						opportunity.attachments &&
						Array.isArray(opportunity.attachments)
					) {
						opportunity.attachments.forEach(
							(attachment: unknown, index: number) => {
								const att = attachment as Attachment;
								const filename =
									att.name ?? att.filename ?? `attachment_${index + 1}`;
								const url = att.url ?? att.link;
								if (url) {
									attachments.push({ url, filename });
								}
							}
						);
					}

					// Check for resource links that might be downloadable files
					if (
						opportunity.resourceLinks &&
						Array.isArray(opportunity.resourceLinks)
					) {
						opportunity.resourceLinks.forEach(
							(link: unknown, index: number) => {
								const resLink = link as ResourceLink;
								if (resLink.url?.includes(".pdf")) {
									const filename = resLink.name ?? `resource_${index + 1}.pdf`;
									attachments.push({ url: resLink.url, filename });
								}
							}
						);
					}

					// Update attachment count
					await ArchivedOpportunity.updateSingleSyncStatus(
						archivedOpportunity.id,
						"PENDING",
						attachments.length
					);

					// Sync to Dropbox
					if (attachments.length > 0) {
						dropboxResult = await dropboxService.uploadOpportunityAttachments(
							req.user.id,
							opportunityId,
							attachments
						);

						// Update sync status based on result
						await ArchivedOpportunity.updateSingleSyncStatus(
							archivedOpportunity.id,
							dropboxResult.success ? "COMPLETED" : "FAILED",
							attachments.length,
							dropboxResult.uploaded
						);

						await dropboxService.updateSyncStatus(
							req.user.id,
							opportunityId,
							dropboxResult.success
						);
					} else {
						// No attachments to sync
						await ArchivedOpportunity.updateSingleSyncStatus(
							archivedOpportunity.id,
							"COMPLETED",
							0,
							0
						);
					}
				} catch (error) {
					loggingService.error("Error syncing to Dropbox", {
						error,
						userId: req.user.id,
						opportunityId,
					});

					await ArchivedOpportunity.updateSingleSyncStatus(
						archivedOpportunity.id,
						"FAILED"
					);
				}
			}

			res.status(201).json({
				message: "Opportunity archived successfully",
				archivedOpportunity: {
					id: archivedOpportunity.id,
					opportunityId: archivedOpportunity.opportunityId,
					archivedAt: archivedOpportunity.archivedAt,
					syncStatus: archivedOpportunity.syncStatus,
					isDropboxSynced: archivedOpportunity.isDropboxSynced,
				},
			});
		} catch (error: unknown) {
			logError(
				loggingService,
				"archive_opportunity",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error
			);
			res.status(500).json({ error: "Failed to archive opportunity" });
		}
	}
);

// Get opportunity attachments (Premium feature)
router.get(
	"/:id/attachments",
	authenticateToken,
	requirePremiumAttachmentAccess,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			const opportunityId = req.params["id"];

			if (!opportunityId) {
				res.status(400).json({ error: "Invalid opportunity ID" });
				return;
			}

			// Check if opportunity exists
			const opportunity = await Opportunity.findByPk(opportunityId);
			if (!opportunity) {
				res.status(404).json({ error: "Opportunity not found" });
				return;
			}

			// Get processed attachments
			const samOpportunity = convertOpportunityToSAM(opportunity);
			const attachmentAnalysis =
				attachmentService.analyzeAttachments(samOpportunity);
			const attachmentLinks =
				attachmentService.generateAttachmentLinks(samOpportunity);

			const attachmentData = {
				totalCount: attachmentAnalysis.attachmentCount,
				attachments: attachmentAnalysis.allAttachments,
				links: attachmentLinks,
				hasAttachments: attachmentAnalysis.hasAttachments,
			};

			// Get attachment statistics
			const stats = {
				totalCount: attachmentAnalysis.attachmentCount,
				criticalCount: attachmentAnalysis.criticalAttachments.length,
				hasAttachments: attachmentAnalysis.hasAttachments,
			};

			loggingService.info("Attachments retrieved for opportunity", {
				opportunityId,
				userId: req.user?.id,
				attachmentCount: attachmentData.totalCount,
				hasPremiumAccess: true,
			});

			res.json({
				success: true,
				data: {
					opportunityId,
					attachments: attachmentData.attachments,
					totalCount: attachmentData.totalCount,
					hasAttachments: attachmentData.hasAttachments,
					stats,
				},
			});
		} catch (error: unknown) {
			logError(
				loggingService,
				"get_opportunity_attachments",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error
			);
			res.status(500).json({ error: "Failed to get opportunity attachments" });
		}
	}
);

// Get opportunity attachments with access status (for UI display)
router.get(
	"/:id/attachments/status",
	authenticateToken,
	optionalPremiumAttachmentAccess,
	async (req: ExtendedAuthRequest, res: Response): Promise<void> => {
		try {
			const opportunityId = req.params["id"];

			if (!opportunityId) {
				res.status(400).json({ error: "Invalid opportunity ID" });
				return;
			}

			// Check if opportunity exists
			const opportunity = await Opportunity.findByPk(opportunityId);
			if (!opportunity) {
				res.status(404).json({ error: "Opportunity not found" });
				return;
			}

			const hasPremiumAccess = req.premiumAttachmentAccess ?? false;

			// Get basic attachment info without full details if no premium access
			let attachmentData: AttachmentData;
			if (hasPremiumAccess) {
				const samOpportunity = convertOpportunityToSAM(opportunity);
				const attachmentAnalysis =
					attachmentService.analyzeAttachments(samOpportunity);
				const attachmentLinks =
					attachmentService.generateAttachmentLinks(samOpportunity);

				attachmentData = {
					attachments: attachmentAnalysis.allAttachments,
					totalCount: attachmentAnalysis.attachmentCount,
					links: attachmentLinks,
					hasAttachments: attachmentAnalysis.hasAttachments,
				};
			} else {
				// For free users, just show that attachments exist
				const rawAttachments = opportunity.attachments;
				const hasAttachments =
					rawAttachments &&
					(Array.isArray(rawAttachments)
						? rawAttachments.length > 0
						: typeof rawAttachments === "object" &&
						  Object.keys(rawAttachments).length > 0);

				attachmentData = {
					attachments: [],
					totalCount: (() => {
						if (!hasAttachments) {
							return 0;
						}
						return Array.isArray(rawAttachments) ? rawAttachments.length : 1;
					})(),
					hasAttachments: Boolean(hasAttachments),
				};
			}

			res.json({
				success: true,
				data: {
					opportunityId,
					hasPremiumAccess,
					hasAttachments: attachmentData.hasAttachments,
					totalCount: attachmentData.totalCount,
					attachments: hasPremiumAccess ? attachmentData.attachments : [],
					upgradeRequired: !hasPremiumAccess && attachmentData.hasAttachments,
				},
			});
		} catch (error: unknown) {
			logError(
				loggingService,
				"get_opportunity_attachments_status",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error
			);
			res.status(500).json({ error: "Failed to get attachment status" });
		}
	}
);

export default router;
