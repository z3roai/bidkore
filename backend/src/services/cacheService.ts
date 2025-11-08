import { redisClient } from "@/config/redis";
import loggingService from "@/services/loggingService";

export interface CacheOptions {
	ttl?: number; // Time to live in seconds
	prefix?: string; // Key prefix for namespacing
	serialize?: boolean; // Whether to serialize/deserialize data
}

export interface CacheStats {
	hits: number;
	misses: number;
	hitRate: number;
	totalRequests: number;
}

class CacheService {
	private readonly stats = new Map<string, { hits: number; misses: number }>();
	private readonly defaultTTL = 300; // 5 minutes
	private readonly defaultPrefix = "bidkore";

	/**
	 * Get cached data by key
	 */
	async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
		try {
			const fullKey = this.buildKey(key, options.prefix);
			const cached = await redisClient.get(fullKey);

			if (cached) {
				this.recordHit(key);
				const data =
					options.serialize !== false
						? (JSON.parse(cached) as T)
						: (cached as T);
				loggingService.debug(`Cache hit for key: ${fullKey}`);
				return data;
			}

			this.recordMiss(key);
			loggingService.debug(`Cache miss for key: ${fullKey}`);
			return null;
		} catch (error) {
			loggingService.error(`Cache get error for key ${key}:`, error);
			return null;
		}
	}

	/**
	 * Set cached data with TTL
	 */
	async set<T>(
		key: string,
		value: T,
		options: CacheOptions = {}
	): Promise<boolean> {
		try {
			const fullKey = this.buildKey(key, options.prefix);
			const ttl = options.ttl ?? this.defaultTTL;
			const serializedValue =
				options.serialize !== false ? JSON.stringify(value) : value;

			await redisClient.setex(fullKey, ttl, serializedValue as string);
			loggingService.debug(`Cache set for key: ${fullKey} with TTL: ${ttl}s`);
			return true;
		} catch (error) {
			loggingService.error(`Cache set error for key ${key}:`, error);
			return false;
		}
	}

	/**
	 * Delete cached data by key
	 */
	async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
		try {
			const fullKey = this.buildKey(key, options.prefix);
			const result = await redisClient.del(fullKey);
			loggingService.debug(`Cache delete for key: ${fullKey}`);
			return result > 0;
		} catch (error) {
			loggingService.error(`Cache delete error for key ${key}:`, error);
			return false;
		}
	}

	/**
	 * Delete multiple keys by pattern
	 */
	async deletePattern(
		pattern: string,
		options: CacheOptions = {}
	): Promise<number> {
		try {
			const fullPattern = this.buildKey(pattern, options.prefix);
			const keys = await redisClient.keys(fullPattern);

			if (keys.length === 0) {
				return 0;
			}

			const result = await redisClient.del(keys);
			loggingService.debug(
				`Cache delete pattern: ${fullPattern}, deleted ${result} keys`
			);
			return result;
		} catch (error) {
			loggingService.error(
				`Cache delete pattern error for pattern ${pattern}:`,
				error
			);
			return 0;
		}
	}

	/**
	 * Get or set cached data with fallback function
	 */
	async getOrSet<T>(
		key: string,
		fallbackFn: () => Promise<T>,
		options: CacheOptions = {}
	): Promise<T> {
		const cached = await this.get<T>(key, options);

		if (cached !== null) {
			return cached;
		}

		const freshData = await fallbackFn();
		await this.set(key, freshData, options);
		return freshData;
	}

	/**
	 * Invalidate cache by pattern (useful for related data)
	 */
	async invalidatePattern(
		pattern: string,
		options: CacheOptions = {}
	): Promise<number> {
		return this.deletePattern(pattern, options);
	}

	/**
	 * Get cache statistics
	 */
	getStats(key?: string): CacheStats | Map<string, CacheStats> {
		if (key) {
			const keyStats = this.stats.get(key) ?? { hits: 0, misses: 0 };
			const totalRequests = keyStats.hits + keyStats.misses;
			return {
				hits: keyStats.hits,
				misses: keyStats.misses,
				hitRate: totalRequests > 0 ? keyStats.hits / totalRequests : 0,
				totalRequests,
			};
		}

		const allStats = new Map<string, CacheStats>();
		for (const [cacheKey, stats] of this.stats.entries()) {
			const totalRequests = stats.hits + stats.misses;
			allStats.set(cacheKey, {
				hits: stats.hits,
				misses: stats.misses,
				hitRate: totalRequests > 0 ? stats.hits / totalRequests : 0,
				totalRequests,
			});
		}
		return allStats;
	}

	/**
	 * Clear all cache statistics
	 */
	clearStats(): void {
		this.stats.clear();
	}

	/**
	 * Check if Redis is connected
	 */
	async isConnected(): Promise<boolean> {
		try {
			await redisClient.ping();
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Get cache memory usage
	 */
	async getMemoryUsage(): Promise<{ used: string; peak: string }> {
		try {
			const info = await redisClient.info("memory");
			const lines = info.split("\r\n");
			const used =
				lines
					.find(line => line.startsWith("used_memory_human:"))
					?.split(":")[1] ?? "0B";
			const peak =
				lines
					.find(line => line.startsWith("used_memory_peak_human:"))
					?.split(":")[1] ?? "0B";
			return { used, peak };
		} catch (error) {
			loggingService.error("Error getting memory usage:", error);
			return { used: "0B", peak: "0B" };
		}
	}

	private buildKey(key: string, prefix?: string): string {
		const keyPrefix = prefix ?? this.defaultPrefix;
		return `${keyPrefix}:${key}`;
	}

	private recordHit(key: string): void {
		const stats = this.stats.get(key) ?? { hits: 0, misses: 0 };
		stats.hits++;
		this.stats.set(key, stats);
	}

	private recordMiss(key: string): void {
		const stats = this.stats.get(key) ?? { hits: 0, misses: 0 };
		stats.misses++;
		this.stats.set(key, stats);
	}
}

// Export singleton instance
const cacheService = new CacheService();
export default cacheService;
