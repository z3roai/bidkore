import type { Prisma } from "@prisma/client";

import cacheService from "@/services/cacheService";
import loggingService from "@/services/loggingService";

export interface QueryCacheOptions {
	ttl?: number;
	keyPrefix?: string;
	includeUserContext?: boolean;
	userId?: string;
}

export interface CachedQueryResult<T> {
	data: T;
	cached: boolean;
	cacheKey: string;
	ttl: number;
}

class DatabaseCacheService {
	private readonly defaultTTL = 300; // 5 minutes
	private readonly queryPrefix = "db_query";

	/**
	 * Cache a Prisma query result
	 */
	async cacheQuery<T>(
		queryKey: string,
		queryFn: () => Promise<T>,
		options: QueryCacheOptions = {}
	): Promise<CachedQueryResult<T>> {
		const {
			ttl = this.defaultTTL,
			keyPrefix = this.queryPrefix,
			includeUserContext = false,
			userId,
		} = options;

		const cacheKey = this.buildQueryKey(queryKey, {
			keyPrefix,
			includeUserContext,
			...(userId !== undefined && { userId }),
		});

		try {
			// Try to get from cache first
			const cached = await cacheService.get<T>(cacheKey, { ttl });

			if (cached !== null) {
				loggingService.debug(`Database query cache hit: ${cacheKey}`);
				return {
					data: cached,
					cached: true,
					cacheKey,
					ttl,
				};
			}

			// Cache miss - execute query
			loggingService.debug(`Database query cache miss: ${cacheKey}`);
			const result = await queryFn();

			// Cache the result
			await cacheService.set(cacheKey, result, { ttl });

			return {
				data: result,
				cached: false,
				cacheKey,
				ttl,
			};
		} catch (error) {
			loggingService.error(
				`Database query cache error for ${cacheKey}:`,
				error
			);
			// Fallback to direct query execution
			const result = await queryFn();
			return {
				data: result,
				cached: false,
				cacheKey,
				ttl,
			};
		}
	}

	/**
	 * Cache a Prisma findMany query
	 */
	async cacheFindMany<T>(
		model: string,
		where: Prisma.JsonValue,
		queryFn: () => Promise<T[]>,
		options: QueryCacheOptions = {}
	): Promise<CachedQueryResult<T[]>> {
		const queryKey = this.buildFindManyKey(model, where);
		return this.cacheQuery(queryKey, queryFn, options);
	}

	/**
	 * Cache a Prisma findUnique query
	 */
	async cacheFindUnique<T>(
		model: string,
		where: Prisma.JsonValue,
		queryFn: () => Promise<T | null>,
		options: QueryCacheOptions = {}
	): Promise<CachedQueryResult<T | null>> {
		const queryKey = this.buildFindUniqueKey(model, where);
		return this.cacheQuery(queryKey, queryFn, options);
	}

	/**
	 * Cache a Prisma findFirst query
	 */
	async cacheFindFirst<T>(
		model: string,
		where: Prisma.JsonValue,
		queryFn: () => Promise<T | null>,
		options: QueryCacheOptions = {}
	): Promise<CachedQueryResult<T | null>> {
		const queryKey = this.buildFindFirstKey(model, where);
		return this.cacheQuery(queryKey, queryFn, options);
	}

	/**
	 * Cache a Prisma count query
	 */
	async cacheCount(
		model: string,
		where: Prisma.JsonValue,
		queryFn: () => Promise<number>,
		options: QueryCacheOptions = {}
	): Promise<CachedQueryResult<number>> {
		const queryKey = this.buildCountKey(model, where);
		return this.cacheQuery(queryKey, queryFn, options);
	}

	/**
	 * Cache a Prisma aggregate query
	 */
	async cacheAggregate<T>(
		model: string,
		where: Prisma.JsonValue,
		queryFn: () => Promise<T>,
		options: QueryCacheOptions = {}
	): Promise<CachedQueryResult<T>> {
		const queryKey = this.buildAggregateKey(model, where);
		return this.cacheQuery(queryKey, queryFn, options);
	}

	/**
	 * Invalidate cache for a specific model
	 */
	async invalidateModel(model: string, userId?: string): Promise<number> {
		const patterns = [
			`${this.queryPrefix}:${model}:*`,
			`${this.queryPrefix}:findMany:${model}:*`,
			`${this.queryPrefix}:findUnique:${model}:*`,
			`${this.queryPrefix}:findFirst:${model}:*`,
			`${this.queryPrefix}:count:${model}:*`,
			`${this.queryPrefix}:aggregate:${model}:*`,
		];

		if (userId) {
			patterns.push(...patterns.map(pattern => `${pattern}:user:${userId}`));
		}

		const invalidationPromises = patterns.map(pattern =>
			cacheService.invalidatePattern(pattern)
		);

		const results = await Promise.all(invalidationPromises);
		const totalInvalidated = results.reduce((sum, count) => sum + count, 0);

		loggingService.info(
			`Invalidated ${totalInvalidated} cache entries for model: ${model}`
		);
		return totalInvalidated;
	}

	/**
	 * Invalidate cache for a specific user
	 */
	async invalidateUser(userId: string): Promise<number> {
		const pattern = `${this.queryPrefix}:*:user:${userId}`;
		const invalidated = await cacheService.invalidatePattern(pattern);
		loggingService.info(
			`Invalidated ${invalidated} cache entries for user: ${userId}`
		);
		return invalidated;
	}

	/**
	 * Invalidate all database query cache
	 */
	async invalidateAll(): Promise<number> {
		const pattern = `${this.queryPrefix}:*`;
		const invalidated = await cacheService.invalidatePattern(pattern);
		loggingService.info(
			`Invalidated ${invalidated} database query cache entries`
		);
		return invalidated;
	}

	/**
	 * Get cache statistics for database queries
	 */
	getStats(): Map<string, unknown> {
		return cacheService.getStats() as Map<string, unknown>;
	}

	private buildQueryKey(
		queryKey: string,
		options: {
			keyPrefix: string;
			includeUserContext: boolean;
			userId?: string;
		}
	): string {
		const { keyPrefix, includeUserContext, userId } = options;
		let key = `${keyPrefix}:${queryKey}`;

		if (includeUserContext && userId) {
			key += `:user:${userId}`;
		}

		return key;
	}

	private buildFindManyKey(model: string, where: Prisma.JsonValue): string {
		const whereHash = this.hashObject(where);
		return `findMany:${model}:${whereHash}`;
	}

	private buildFindUniqueKey(model: string, where: Prisma.JsonValue): string {
		const whereHash = this.hashObject(where);
		return `findUnique:${model}:${whereHash}`;
	}

	private buildFindFirstKey(model: string, where: Prisma.JsonValue): string {
		const whereHash = this.hashObject(where);
		return `findFirst:${model}:${whereHash}`;
	}

	private buildCountKey(model: string, where: Prisma.JsonValue): string {
		const whereHash = this.hashObject(where);
		return `count:${model}:${whereHash}`;
	}

	private buildAggregateKey(model: string, where: Prisma.JsonValue): string {
		const whereHash = this.hashObject(where);
		return `aggregate:${model}:${whereHash}`;
	}

	private hashObject(obj: Prisma.JsonValue): string {
		// Simple hash function for object keys
		// In production, consider using a more robust hashing library
		if (obj === null || typeof obj !== "object") {
			return JSON.stringify(obj);
		}
		const str = JSON.stringify(obj, Object.keys(obj).sort());
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return Math.abs(hash).toString(36);
	}
}

// Export singleton instance
const databaseCacheService = new DatabaseCacheService();
export default databaseCacheService;
