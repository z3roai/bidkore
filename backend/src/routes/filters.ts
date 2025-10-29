import { type Response, Router } from "express";

import {
	findTeamMembersByUserId,
	type TeamMemberWithRelations,
} from "../models/TeamMember";

import prisma from "@/config/prisma";
import { authenticateToken, type AuthRequest } from "@/middleware/auth";
import type { FilterWhereInput } from "@/models/Filter";
import filterService from "@/services/filterService";
import loggingService from "@/services/loggingService";

// Type definitions
interface FilterCriteria {
	keywords?: string[];
	naicsCodes?: string[];
	agencies?: string[];
	setAsides?: string[];
	types?: string[];
	locations?: string[];
	postedFrom?: string | null;
	postedTo?: string | null;
	responseDeadlineFrom?: string | null;
	responseDeadlineTo?: string | null;
	estimatedValueMin?: number | null;
	estimatedValueMax?: number | null;
	classificationCodes?: string[];
}

interface FilterWithRelations {
	id: string;
	name: string;
	description: string | null;
	naturalLanguageDescription: string | null;
	criteria: unknown;
	isActive: boolean;
	isSaved: boolean;
	userId: string;
	teamId: string | null;
	pollingInterval: number | null;
	lastPolledAt: Date | null;
	nextPollAt: Date | null;
	searchCount: number;
	opportunityCount: number;
	lastSearchAt: Date | null;
	notifyOnNewOpportunities: boolean;
	notifyOnDeadlineReminder: boolean;
	deadlineReminderDays: unknown; // Json type from Prisma
	user: unknown;
	team: unknown;
	createdAt: Date;
	updatedAt: Date;
}

interface PlaceOfPerformance {
	city?: { name: string };
	state?: { name: string };
}

interface Award {
	value?: number;
	amount?: number;
	totalValue?: number;
}

interface OpportunityData {
	noticeId: string;
	title: string;
	solicitationNumber?: string | null;
	fullParentPathName?: string;
	fullParentPathCode?: string;
	postedDate?: Date | string;
	type?: string;
	baseType?: string;
	archiveType?: string;
	archiveDate?: Date | string;
	typeOfSetAsideDescription?: string;
	typeOfSetAside?: string;
	responseDeadLine?: Date | string;
	naicsCode?: string;
	naicsCodes?: string[];
	classificationCode?: string;
	active?: string; // Changed from boolean to string to match SAMOpportunity
	award?: unknown; // Changed to match filterService.ts
	pointOfContact?: unknown;
	description?: string;
	detailedDescription?: string;
	organizationType?: string;
	officeAddress?: unknown;
	placeOfPerformance?: unknown;
	additionalInfoLink?: string;
	uiLink?: string;
	links?: unknown;
	resourceLinks?: unknown;
}

interface FilterMatchResult {
	opportunity: OpportunityData;
	matchReason: string;
	matchedCriteria: string[];
}

const router = Router();

// Get all filters for a user/team
router.get(
	"/",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const {
				page = 1,
				limit = 20,
				isActive,
				isSaved,
				sortBy = "createdAt",
				sortOrder = "DESC",
			} = req.query;

			const offset = (Number(page) - 1) * Number(limit);

			// Get user's team memberships
			const userTeamIds = await getUserTeamIds(req.user.id);

			const whereClause: FilterWhereInput = {
				OR: [{ userId: req.user.id }, { teamId: { in: userTeamIds } }],
			};

			// Apply filters
			if (isActive !== null && isActive !== undefined) {
				whereClause.isActive = isActive === "true";
			}

			if (isSaved !== null && isSaved !== undefined) {
				whereClause.isSaved = isSaved === "true";
			}

			const filters = await prisma.filter.findMany({
				where: whereClause,
				orderBy: {
					[sortBy as string]: (sortOrder as string).toLowerCase() as
						| "asc"
						| "desc",
				},
				take: Number(limit),
				skip: offset,
				include: {
					user: true,
					team: true,
				},
			});

			const totalCount = await prisma.filter.count({ where: whereClause });

			res.json({
				filters: filters.map((filter: FilterWithRelations) => {
					const criteriaObj =
						filter.criteria && typeof filter.criteria === "object"
							? (filter.criteria as FilterCriteria)
							: {};
					return {
						id: filter.id,
						name: filter.name,
						description: filter.description,
						naturalLanguageDescription: filter.naturalLanguageDescription,
						criteria: {
							keywords: criteriaObj.keywords || [],
							naicsCodes: criteriaObj.naicsCodes || [],
							agencies: criteriaObj.agencies || [],
							setAsides: criteriaObj.setAsides || [],
							types: criteriaObj.types || [],
							locations: criteriaObj.locations || [],
							postedFrom: criteriaObj.postedFrom || null,
							postedTo: criteriaObj.postedTo || null,
							responseDeadlineFrom: criteriaObj.responseDeadlineFrom || null,
							responseDeadlineTo: criteriaObj.responseDeadlineTo || null,
							estimatedValueMin: criteriaObj.estimatedValueMin || null,
							estimatedValueMax: criteriaObj.estimatedValueMax || null,
							classificationCodes: criteriaObj.classificationCodes || [],
						},
						isActive: filter.isActive,
						isSaved: filter.isSaved,
						userId: filter.userId,
						teamId: filter.teamId,
						pollingInterval: filter.pollingInterval,
						lastPolledAt: filter.lastPolledAt,
						nextPollAt: filter.nextPollAt,
						searchCount: filter.searchCount,
						opportunityCount: filter.opportunityCount,
						lastSearchAt: filter.lastSearchAt,
						notificationSettings: {
							notifyOnNewOpportunities: filter.notifyOnNewOpportunities,
							notifyOnDeadlineReminder: filter.notifyOnDeadlineReminder,
							deadlineReminderDays: filter.deadlineReminderDays,
						},
						user: filter.user,
						team: filter.team,
						createdAt: filter.createdAt,
						updatedAt: filter.updatedAt,
					};
				}),
				total: totalCount,
				page: Number(page),
				limit: Number(limit),
			});
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			loggingService.logUserError(
				"get_filters",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				new Error(errorMessage)
			);
			res.status(500).json({ error: "Failed to get filters" });
		}
	}
);

// Create a new filter
router.post(
	"/",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const {
				name,
				description,
				naturalLanguageDescription,
				criteria,
				teamId,
				pollingInterval,
				notificationSettings,
			} = req.body as {
				name?: string;
				description?: string;
				naturalLanguageDescription?: string;
				criteria?: unknown;
				teamId?: string;
				pollingInterval?: number;
				notificationSettings?: {
					notifyOnNewOpportunities?: boolean;
					notifyOnDeadlineReminder?: boolean;
					deadlineReminderDays?: number;
				};
			};

			if (!name || !criteria) {
				res.status(400).json({ error: "Name and criteria are required" });
				return;
			}

			// Validate criteria has at least one field
			const hasCriteria = Object.values(
				criteria as Record<string, unknown>
			).some(value => {
				if (Array.isArray(value)) {
					return value.length > 0;
				}
				return value !== null && value !== undefined && value !== "";
			});

			if (!hasCriteria) {
				res
					.status(400)
					.json({ error: "At least one search criteria is required" });
				return;
			}

			const filter = await filterService.createFilter({
				name,
				...(description !== undefined && { description }),
				...(naturalLanguageDescription !== undefined && {
					naturalLanguageDescription,
				}),
				criteria: criteria as Record<string, unknown>,
				userId: req.user.id,
				...(teamId !== undefined && { teamId }),
				...(pollingInterval !== undefined && { pollingInterval }),
				...(notificationSettings && {
					notificationSettings: {
						...(notificationSettings.notifyOnNewOpportunities !== undefined && {
							notifyOnNewOpportunities:
								notificationSettings.notifyOnNewOpportunities,
						}),
						...(notificationSettings.notifyOnDeadlineReminder !== undefined && {
							notifyOnDeadlineReminder:
								notificationSettings.notifyOnDeadlineReminder,
						}),
						...(notificationSettings.deadlineReminderDays !== undefined && {
							deadlineReminderDays: [notificationSettings.deadlineReminderDays],
						}),
					},
				}),
			});

			res.status(201).json({
				id: filter.id,
				name: filter.name,
				description: filter.description,
				naturalLanguageDescription: filter.naturalLanguageDescription,
				criteria: {
					keywords: filter.keywords,
					naicsCodes: filter.naicsCodes,
					agencies: filter.agencies,
					setAsides: filter.setAsides,
					types: filter.types,
					locations: filter.locations,
					postedFrom: filter.postedFrom,
					postedTo: filter.postedTo,
					responseDeadlineFrom: filter.responseDeadlineFrom,
					responseDeadlineTo: filter.responseDeadlineTo,
					estimatedValueMin: filter.estimatedValueMin,
					estimatedValueMax: filter.estimatedValueMax,
					classificationCodes: filter.classificationCodes,
				},
				isActive: filter.isActive,
				isSaved: filter.isSaved,
				userId: filter.userId,
				teamId: filter.teamId,
				pollingInterval: filter.pollingInterval,
				notificationSettings: {
					notifyOnNewOpportunities: filter.notifyOnNewOpportunities,
					notifyOnDeadlineReminder: filter.notifyOnDeadlineReminder,
					deadlineReminderDays: filter.deadlineReminderDays,
				},
				createdAt: filter.createdAt,
				updatedAt: filter.updatedAt,
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"create_filter",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to create filter" });
		}
	}
);

// Get a specific filter
router.get(
	"/:id",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const filterId = req.params["id"];
			if (!filterId) {
				res.status(400).json({ error: "Filter ID is required" });
				return;
			}
			const userTeamIds = await getUserTeamIds(req.user.id);

			const filter = await prisma.filter.findFirst({
				where: {
					id: filterId,
					OR: [{ userId: req.user.id }, { teamId: { in: userTeamIds } }],
				},
				include: {
					user: true,
					team: true,
				},
			});

			if (!filter) {
				res.status(404).json({ error: "Filter not found" });
				return;
			}

			const criteriaObj =
				filter.criteria && typeof filter.criteria === "object"
					? (filter.criteria as FilterCriteria)
					: {};
			res.json({
				id: filter.id,
				name: filter.name,
				description: filter.description,
				naturalLanguageDescription: filter.naturalLanguageDescription,
				criteria: {
					keywords: criteriaObj.keywords || [],
					naicsCodes: criteriaObj.naicsCodes || [],
					agencies: criteriaObj.agencies || [],
					setAsides: criteriaObj.setAsides || [],
					types: criteriaObj.types || [],
					locations: criteriaObj.locations || [],
					postedFrom: criteriaObj.postedFrom || null,
					postedTo: criteriaObj.postedTo || null,
					responseDeadlineFrom: criteriaObj.responseDeadlineFrom || null,
					responseDeadlineTo: criteriaObj.responseDeadlineTo || null,
					estimatedValueMin: criteriaObj.estimatedValueMin || null,
					estimatedValueMax: criteriaObj.estimatedValueMax || null,
					classificationCodes: criteriaObj.classificationCodes || [],
				},
				isActive: filter.isActive,
				isSaved: filter.isSaved,
				userId: filter.userId,
				teamId: filter.teamId,
				pollingInterval: filter.pollingInterval,
				lastPolledAt: filter.lastPolledAt,
				nextPollAt: filter.nextPollAt,
				searchCount: filter.searchCount,
				opportunityCount: filter.opportunityCount,
				lastSearchAt: filter.lastSearchAt,
				notificationSettings: {
					notifyOnNewOpportunities: filter.notifyOnNewOpportunities,
					notifyOnDeadlineReminder: filter.notifyOnDeadlineReminder,
					deadlineReminderDays: filter.deadlineReminderDays,
				},
				user: filter.user,
				team: filter.team,
				createdAt: filter.createdAt,
				updatedAt: filter.updatedAt,
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"get_filter",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to get filter" });
		}
	}
);

// Update a filter
router.put(
	"/:id",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const filterId = req.params["id"];
			if (!filterId) {
				res.status(400).json({ error: "Filter ID is required" });
				return;
			}
			const userTeamIds = await getUserTeamIds(req.user.id);

			const filter = await prisma.filter.findFirst({
				where: {
					id: filterId,
					OR: [{ userId: req.user.id }, { teamId: { in: userTeamIds } }],
				},
				include: {
					user: true,
					team: true,
				},
			});

			if (!filter) {
				res.status(404).json({ error: "Filter not found" });
				return;
			}

			const {
				name,
				description,
				naturalLanguageDescription,
				criteria,
				pollingInterval,
				notificationSettings,
				isActive,
			} = req.body as {
				name?: string;
				description?: string;
				naturalLanguageDescription?: string;
				criteria?: unknown;
				pollingInterval?: number;
				notificationSettings?: {
					notifyOnNewOpportunities?: boolean;
					notifyOnDeadlineReminder?: boolean;
					deadlineReminderDays?: number;
				};
				isActive?: boolean;
			};

			// Prepare update data
			const updateData: Record<string, unknown> = {};
			if (name !== null && name !== undefined) {
				updateData["name"] = name;
			}
			if (description !== null && description !== undefined) {
				updateData["description"] = description;
			}
			if (
				naturalLanguageDescription !== null &&
				naturalLanguageDescription !== undefined
			) {
				updateData["naturalLanguageDescription"] = naturalLanguageDescription;
			}
			if (pollingInterval !== null && pollingInterval !== undefined) {
				updateData["pollingInterval"] = pollingInterval;
			}
			if (isActive !== null && isActive !== undefined) {
				updateData["isActive"] = isActive;
			}
			if (criteria !== null && criteria !== undefined) {
				updateData["criteria"] = criteria;
			}

			// Update notification settings
			if (notificationSettings) {
				if (
					notificationSettings.notifyOnNewOpportunities !== null &&
					notificationSettings.notifyOnNewOpportunities !== undefined
				) {
					updateData["notifyOnNewOpportunities"] =
						notificationSettings.notifyOnNewOpportunities;
				}
				if (
					notificationSettings.notifyOnDeadlineReminder !== null &&
					notificationSettings.notifyOnDeadlineReminder !== undefined
				) {
					updateData["notifyOnDeadlineReminder"] =
						notificationSettings.notifyOnDeadlineReminder;
				}
				if (
					notificationSettings.deadlineReminderDays !== null &&
					notificationSettings.deadlineReminderDays !== undefined
				) {
					updateData["deadlineReminderDays"] =
						notificationSettings.deadlineReminderDays;
				}
			}

			const updatedFilter = await prisma.filter.update({
				where: { id: filterId },
				data: updateData,
				include: {
					user: true,
					team: true,
				},
			});

			res.json({
				id: updatedFilter.id,
				name: updatedFilter.name,
				description: updatedFilter.description,
				naturalLanguageDescription: updatedFilter.naturalLanguageDescription,
				criteria: updatedFilter.criteria ?? {},
				isActive: updatedFilter.isActive,
				isSaved: updatedFilter.isSaved,
				userId: updatedFilter.userId,
				teamId: updatedFilter.teamId,
				pollingInterval: updatedFilter.pollingInterval,
				notificationSettings: {
					notifyOnNewOpportunities: updatedFilter.notifyOnNewOpportunities,
					notifyOnDeadlineReminder: updatedFilter.notifyOnDeadlineReminder,
					deadlineReminderDays: updatedFilter.deadlineReminderDays,
				},
				createdAt: updatedFilter.createdAt,
				updatedAt: updatedFilter.updatedAt,
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"update_filter",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to update filter" });
		}
	}
);

// Delete a filter
router.delete(
	"/:id",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const filterId = req.params["id"];
			if (!filterId) {
				res.status(400).json({ error: "Filter ID is required" });
				return;
			}
			const userTeamIds = await getUserTeamIds(req.user.id);

			const filter = await prisma.filter.findFirst({
				where: {
					id: filterId,
					OR: [{ userId: req.user.id }, { teamId: { in: userTeamIds } }],
				},
				include: {
					user: true,
					team: true,
				},
			});

			if (!filter) {
				res.status(404).json({ error: "Filter not found" });
				return;
			}

			await prisma.filter.delete({ where: { id: filterId } });

			res.status(204).send();
		} catch (error: unknown) {
			loggingService.logUserError(
				"delete_filter",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to delete filter" });
		}
	}
);

// Get opportunities for a specific filter
router.get(
	"/:id/opportunities",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const filterId = req.params["id"];
			if (!filterId) {
				res.status(400).json({ error: "Filter ID is required" });
				return;
			}
			const { page = 1, limit = 20, includeArchived = false } = req.query;
			const offset = (Number(page) - 1) * Number(limit);

			const userTeamIds = await getUserTeamIds(req.user.id);

			// Verify user has access to this filter
			const filter = await prisma.filter.findFirst({
				where: {
					id: filterId,
					OR: [{ userId: req.user.id }, { teamId: { in: userTeamIds } }],
				},
				include: {
					user: true,
					team: true,
				},
			});

			if (!filter) {
				res.status(404).json({ error: "Filter not found" });
				return;
			}

			const { opportunities, total } =
				await filterService.getFilterOpportunities(filterId, {
					limit: Number(limit),
					offset,
					includeArchived: includeArchived === "true",
				});

			res.json({
				opportunities: opportunities.map(opp => ({
					id: opp.id,
					noticeId: opp.noticeId,
					title: opp.title,
					description: opp.description,
					detailedDescription: opp.detailedDescription,
					naicsCode: opp.naicsCode,
					naicsCodes: opp.naicsCode,
					solicitationNumber: opp.solicitationNumber,
					agency: opp.fullParentPathName,
					office: opp.fullParentPathCode,
					location: (() => {
						if (!opp.placeOfPerformance) {
							return "N/A";
						}
						if (typeof opp.placeOfPerformance === "string") {
							return opp.placeOfPerformance;
						}
						const location = opp.placeOfPerformance as PlaceOfPerformance;
						return location.city?.name || location.state?.name || "N/A";
					})(),
					setAside: opp.typeOfSetAside,
					responseDeadline: opp.responseDeadLine
						? new Date(opp.responseDeadLine).toISOString()
						: null,
					postedDate: opp.postedDate,
					type: opp.type,
					baseType: opp.baseType,
					archiveType: opp.archiveType,
					archiveDate: opp.archiveDate,
					status: opp.isActive,
					active: opp.isActive,
					estimatedValue:
						(opp.award as Award)?.value ??
						(opp.award as Award)?.amount ??
						(opp.award as Award)?.totalValue ??
						null,
					contractType: opp.type,
					pointOfContact: opp.pointOfContact,
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
					isActive: opp.isActive,
					createdAt: opp.createdAt,
					updatedAt: opp.updatedAt,
				})),
				total,
				page: Number(page),
				limit: Number(limit),
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"get_filter_opportunities",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to get filter opportunities" });
		}
	}
);

// Manually refresh a filter
router.post(
	"/:id/refresh",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const filterId = req.params["id"];
			if (!filterId) {
				res.status(400).json({ error: "Filter ID is required" });
				return;
			}
			const userTeamIds = await getUserTeamIds(req.user.id);

			// Verify user has access to this filter
			const filter = await prisma.filter.findFirst({
				where: {
					id: filterId,
					OR: [{ userId: req.user.id }, { teamId: { in: userTeamIds } }],
				},
				include: {
					user: true,
					team: true,
				},
			});

			if (!filter) {
				res.status(404).json({ error: "Filter not found" });
				return;
			}

			const result = await filterService.refreshFilter(filterId);

			res.json({
				message: "Filter refreshed successfully",
				newOpportunities: result.newOpportunities,
				totalOpportunities: result.totalOpportunities,
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"refresh_filter",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to refresh filter" });
		}
	}
);

// Search opportunities with ad-hoc filter (not saved)
router.post(
	"/search",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const { criteria } = req.body as {
				criteria?: Record<string, unknown>;
			};

			if (!criteria) {
				res.status(400).json({ error: "Search criteria are required" });
				return;
			}

			const matches = await filterService.searchWithFilter(criteria, false);

			res.json({
				opportunities: matches.map((match: FilterMatchResult) => ({
					id: match.opportunity.noticeId, // Use noticeId as temporary ID
					noticeId: match.opportunity.noticeId,
					title: match.opportunity.title,
					description: match.opportunity.description,
					detailedDescription: match.opportunity.detailedDescription,
					naicsCode: match.opportunity.naicsCode,
					naicsCodes: match.opportunity.naicsCode,
					solicitationNumber: match.opportunity.solicitationNumber,
					agency: match.opportunity.fullParentPathName,
					office: match.opportunity.fullParentPathCode,
					location: (() => {
						if (!match.opportunity.placeOfPerformance) {
							return "N/A";
						}
						if (typeof match.opportunity.placeOfPerformance === "string") {
							return match.opportunity.placeOfPerformance;
						}
						const location = match.opportunity
							.placeOfPerformance as PlaceOfPerformance;
						return location.city?.name || location.state?.name || "N/A";
					})(),
					setAside: match.opportunity.typeOfSetAside,
					responseDeadline: match.opportunity.responseDeadLine
						? new Date(match.opportunity.responseDeadLine).toISOString()
						: null,
					postedDate: match.opportunity.postedDate,
					type: match.opportunity.type,
					baseType: match.opportunity.baseType,
					archiveType: match.opportunity.archiveType,
					archiveDate: match.opportunity.archiveDate,
					status: match.opportunity.active,
					active:
						match.opportunity.active === "Y" ||
						match.opportunity.active === "true",
					estimatedValue: (() => {
						if (!match.opportunity.award) {
							return null;
						}
						const award = match.opportunity.award as Award;
						return award.value || award.amount || award.totalValue || null;
					})(),
					contractType: match.opportunity.type,
					pointOfContact: match.opportunity.pointOfContact,
					contractingOfficer: match.opportunity.pointOfContact,
					scopeOfWork: match.opportunity.description,
					fullParentPathName: match.opportunity.fullParentPathName,
					fullParentPathCode: match.opportunity.fullParentPathCode,
					typeOfSetAside: match.opportunity.typeOfSetAside,
					typeOfSetAsideDescription:
						match.opportunity.typeOfSetAsideDescription,
					classificationCode: match.opportunity.classificationCode,
					award: match.opportunity.award,
					organizationType: match.opportunity.organizationType,
					officeAddress: match.opportunity.officeAddress,
					placeOfPerformance: match.opportunity.placeOfPerformance,
					additionalInfoLink: match.opportunity.additionalInfoLink,
					uiLink:
						match.opportunity.uiLink &&
						!match.opportunity.uiLink.includes("api.sam.gov")
							? match.opportunity.uiLink
							: `https://sam.gov/opp/${match.opportunity.noticeId}`,
					links: match.opportunity.links,
					resourceLinks: match.opportunity.resourceLinks,
					matchReason: match.matchReason,
					matchedCriteria: match.matchedCriteria,
				})),
				total: matches.length,
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"search_opportunities",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to search opportunities" });
		}
	}
);

// Archive old opportunities for a filter
router.post(
	"/:id/archive",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const filterId = req.params["id"];
			if (!filterId) {
				res.status(400).json({ error: "Filter ID is required" });
				return;
			}
			const { archiveDaysOld = 90 } = req.body as {
				archiveDaysOld?: number;
			};
			const userTeamIds = await getUserTeamIds(req.user.id);

			// Verify user has access to this filter
			const filter = await prisma.filter.findFirst({
				where: {
					id: filterId,
					OR: [{ userId: req.user.id }, { teamId: { in: userTeamIds } }],
				},
				include: {
					user: true,
					team: true,
				},
			});

			if (!filter) {
				res.status(404).json({ error: "Filter not found" });
				return;
			}

			const archivedCount = await filterService.archiveOldOpportunities(
				filterId,
				archiveDaysOld
			);

			res.json({
				message: "Opportunities archived successfully",
				archivedCount,
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"archive_filter_opportunities",
				req.user?.id ?? "unknown",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to archive opportunities" });
		}
	}
);

// Helper function to get user's team IDs
async function getUserTeamIds(userId: string): Promise<string[]> {
	const memberships = await findTeamMembersByUserId(userId);
	return memberships.map((m: TeamMemberWithRelations) => m.teamId);
}

export default router;
