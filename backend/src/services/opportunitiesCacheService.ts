import type { ArchivedOpportunity, Opportunity, Prisma } from "@prisma/client";

import prisma from "@/config/prisma";
import ArchivedOpportunityModel from "@/models/ArchivedOpportunity";
import OpportunityModel from "@/models/Opportunity";
import databaseCacheService from "@/services/databaseCacheService";
import loggingService from "@/services/loggingService";

export interface OpportunitySearchParams {
	limit?: number;
	offset?: number;
	keyword?: string;
	agency?: string;
	naicsCode?: string;
	location?: string;
	setAside?: string;
	contractType?: string;
	status?: string;
	userId?: string;
}

export interface CachedOpportunityResult {
	opportunities: (ArchivedOpportunity | Opportunity)[];
	total: number;
	cached: boolean;
	cacheKey: string;
}

export interface CachedStatsResult {
	stats: {
		totalActive: number;
		totalArchived: number;
		recentCount: number;
		agencyCount: number;
	};
	cached: boolean;
	cacheKey: string;
}

class OpportunitiesCacheService {
	private readonly defaultTTL = 300; // 5 minutes

	/**
	 * Get opportunities with caching
	 */
	async getOpportunities(
		params: OpportunitySearchParams = {},
		options: { ttl?: number; includeUserContext?: boolean } = {}
	): Promise<CachedOpportunityResult> {
		const {
			limit = 20,
			offset = 0,
			keyword,
			agency,
			naicsCode,
			location,
			setAside,
			contractType,
			status,
			userId,
		} = params;

		const { ttl = this.defaultTTL, includeUserContext = false } = options;

		// Build where clause
		const where: Prisma.OpportunityWhereInput = {
			isActive: true,
			...(keyword && {
				title: {
					contains: keyword,
					mode: "insensitive",
				},
			}),
			...(agency && {
				organizationType: { contains: agency, mode: "insensitive" },
			}),
			...(naicsCode && { naicsCode: { contains: naicsCode } }),
			...(location && {
				placeOfPerformance: {
					path: ["$"],
					string_contains: location,
				},
			}),
			...(setAside && {
				typeOfSetAside: { contains: setAside, mode: "insensitive" },
			}),
			...(contractType && {
				type: { contains: contractType, mode: "insensitive" },
			}),
			...(status && { active: { contains: status, mode: "insensitive" } }),
		};

		// Build cache key
		const cacheKey = this.buildSearchKey({
			where,
			limit,
			offset,
			...(includeUserContext && userId && { userId }),
		});

		// Execute cached query
		const result = await databaseCacheService.cacheQuery(
			cacheKey,
			async () => {
				const [opportunities, total] = await Promise.all([
					OpportunityModel.findAll({
						where,
						orderBy: { postedDate: "desc" },
						take: limit,
						skip: offset,
					}),
					OpportunityModel.count({ where }),
				]);

				return { opportunities, total };
			},
			{
				ttl,
				includeUserContext,
				...(userId !== undefined && { userId }),
			}
		);

		return {
			opportunities: result.data.opportunities,
			total: result.data.total,
			cached: result.cached,
			cacheKey: result.cacheKey,
		};
	}

	/**
	 * Get opportunity by ID with caching
	 */
	async getOpportunityById(
		id: number,
		options: {
			ttl?: number;
			includeUserContext?: boolean;
			userId?: string;
		} = {}
	): Promise<CachedOpportunityResult> {
		const {
			ttl = this.defaultTTL,
			includeUserContext = false,
			userId,
		} = options;

		const where = { id, isActive: true };
		const cacheKey = this.buildFindKey("opportunity", where, userId);

		const result = await databaseCacheService.cacheQuery(
			cacheKey,
			async () => {
				const opportunity = await OpportunityModel.findByPk(id.toString());

				return {
					opportunities: opportunity ? [opportunity] : [],
					total: opportunity ? 1 : 0,
				};
			},
			{
				ttl,
				includeUserContext,
				...(userId !== undefined && { userId }),
			}
		);

		return {
			opportunities: result.data.opportunities,
			total: result.data.total,
			cached: result.cached,
			cacheKey: result.cacheKey,
		};
	}

	/**
	 * Get opportunities by SAM ID with caching
	 */
	async getOpportunityBySamId(
		samId: string,
		options: {
			ttl?: number;
			includeUserContext?: boolean;
			userId?: string;
		} = {}
	): Promise<CachedOpportunityResult> {
		const {
			ttl = this.defaultTTL,
			includeUserContext = false,
			userId,
		} = options;

		const where = { samId, isActive: true };
		const cacheKey = this.buildFindKey("opportunity_sam", where, userId);

		const result = await databaseCacheService.cacheQuery(
			cacheKey,
			async () => {
				const opportunity = await OpportunityModel.findOne({
					where,
				});

				return {
					opportunities: opportunity ? [opportunity] : [],
					total: opportunity ? 1 : 0,
				};
			},
			{
				ttl,
				includeUserContext,
				...(userId !== undefined && { userId }),
			}
		);

		return {
			opportunities: result.data.opportunities,
			total: result.data.total,
			cached: result.cached,
			cacheKey: result.cacheKey,
		};
	}

	/**
	 * Get archived opportunities with caching
	 */
	async getArchivedOpportunities(
		params: OpportunitySearchParams = {},
		options: { ttl?: number; includeUserContext?: boolean } = {}
	): Promise<CachedOpportunityResult> {
		const {
			limit = 20,
			offset = 0,
			keyword,
			agency,
			naicsCode,
			location,
			setAside,
			contractType,
			status,
			userId,
		} = params;

		const { ttl = this.defaultTTL, includeUserContext = false } = options;

		// Build where clause for archived opportunities
		const opportunityWhere: Prisma.OpportunityWhereInput = {};

		if (keyword) {
			opportunityWhere.title = {
				contains: keyword,
				mode: "insensitive",
			};
		}
		if (agency) {
			opportunityWhere.organizationType = {
				contains: agency,
				mode: "insensitive",
			};
		}
		if (naicsCode) {
			opportunityWhere.naicsCode = { contains: naicsCode };
		}
		if (location) {
			opportunityWhere.placeOfPerformance = {
				path: ["$"],
				string_contains: location,
			};
		}
		if (setAside) {
			opportunityWhere.typeOfSetAside = {
				contains: setAside,
				mode: "insensitive",
			};
		}
		if (contractType) {
			opportunityWhere.type = { contains: contractType, mode: "insensitive" };
		}
		if (status) {
			opportunityWhere.active = { contains: status, mode: "insensitive" };
		}

		const where: Prisma.ArchivedOpportunityWhereInput = {
			opportunity: opportunityWhere,
		};

		// Build cache key
		const cacheKey = this.buildSearchKey({
			where,
			limit,
			offset,
			...(includeUserContext && userId && { userId }),
			prefix: "archived",
		});

		// Execute cached query
		const result = await databaseCacheService.cacheQuery(
			cacheKey,
			async () => {
				const [opportunities, total] = await Promise.all([
					ArchivedOpportunityModel.findAll({
						where,
						orderBy: { createdAt: "desc" },
						take: limit,
						skip: offset,
					}),
					ArchivedOpportunityModel.count({ where }),
				]);

				return { opportunities, total };
			},
			{
				ttl,
				includeUserContext,
				...(userId !== undefined && { userId }),
			}
		);

		return {
			opportunities: result.data.opportunities,
			total: result.data.total,
			cached: result.cached,
			cacheKey: result.cacheKey,
		};
	}

	/**
	 * Get opportunity statistics with caching
	 */
	async getOpportunityStats(
		options: {
			ttl?: number;
			includeUserContext?: boolean;
			userId?: string;
		} = {}
	): Promise<CachedStatsResult> {
		const { ttl = 600, includeUserContext = false, userId } = options; // 10 minutes for stats

		const cacheKey = this.buildStatsKey(userId);

		const result = await databaseCacheService.cacheQuery(
			cacheKey,
			async () => {
				const [totalActive, totalArchived, recentCount, agencyGroups] =
					await Promise.all([
						OpportunityModel.count({ where: { isActive: true } }),
						ArchivedOpportunityModel.count(),
						OpportunityModel.count({
							where: {
								isActive: true,
								postedDate: {
									gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
								},
							},
						}),
						prisma.opportunity.groupBy({
							by: ["fullParentPathName"],
							where: {
								isActive: true,
								fullParentPathName: { not: null },
							},
						}),
					]);

				const agencyCount = agencyGroups.length;

				return {
					stats: {
						totalActive,
						totalArchived,
						recentCount,
						agencyCount,
					},
				};
			},
			{
				ttl,
				includeUserContext,
				...(userId !== undefined && { userId }),
			}
		);

		return {
			stats: result.data.stats,
			cached: result.cached,
			cacheKey: result.cacheKey,
		};
	}

	/**
	 * Invalidate opportunity cache
	 */
	async invalidateOpportunityCache(userId?: string): Promise<number> {
		const patterns = [
			"opportunities:*",
			"opportunity:*",
			"archived_opportunities:*",
			"opportunity_stats:*",
		];

		if (userId) {
			patterns.push(...patterns.map(pattern => `${pattern}:user:${userId}`));
		}

		const invalidationPromises = patterns.map(pattern =>
			databaseCacheService.invalidateModel(pattern)
		);

		const results = await Promise.all(invalidationPromises);
		const totalInvalidated = results.reduce((sum, count) => sum + count, 0);

		loggingService.info(
			`Invalidated ${totalInvalidated} opportunity cache entries`
		);
		return totalInvalidated;
	}

	private buildSearchKey(params: {
		where: Prisma.ArchivedOpportunityWhereInput | Prisma.OpportunityWhereInput;
		limit: number;
		offset: number;
		userId?: string;
		prefix?: string;
	}): string {
		const { where, limit, offset, userId, prefix = "opportunities" } = params;
		const whereHash = this.hashObject(where);
		let key = `${prefix}:search:${whereHash}:${limit}:${offset}`;

		if (userId) {
			key += `:user:${userId}`;
		}

		return key;
	}

	private buildFindKey(
		type: string,
		where: Record<string, unknown>,
		userId?: string
	): string {
		const whereHash = this.hashObject(where);
		let key = `${type}:find:${whereHash}`;

		if (userId) {
			key += `:user:${userId}`;
		}

		return key;
	}

	private buildStatsKey(userId?: string): string {
		let key = "opportunity_stats:general";

		if (userId) {
			key += `:user:${userId}`;
		}

		return key;
	}

	private hashObject(obj: Record<string, unknown>): string {
		const str = JSON.stringify(obj, Object.keys(obj).sort());
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}
		return Math.abs(hash).toString(36);
	}
}

// Export singleton instance
const opportunitiesCacheService = new OpportunitiesCacheService();
export default opportunitiesCacheService;
