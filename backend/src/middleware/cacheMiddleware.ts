import type { NextFunction, Request, Response } from "express";

import type { AuthRequest } from "@/middleware/auth";
import cacheService from "@/services/cacheService";
import loggingService from "@/services/loggingService";

export interface CacheMiddlewareOptions {
	ttl?: number;
	keyGenerator?: (req: Request) => string;
	skipCache?: (req: Request) => boolean;
	includeQueryParams?: boolean;
	includeUserContext?: boolean;
}

/**
 * Middleware to cache API responses
 */
export const cacheMiddleware = (options: CacheMiddlewareOptions = {}) => {
	const {
		ttl = 300, // 5 minutes default
		keyGenerator,
		skipCache,
		includeQueryParams = true,
		includeUserContext = false,
	} = options;

	return async (
		req: Request,
		res: Response,
		next: NextFunction
	): Promise<void> => {
		// Skip caching for non-GET requests by default
		if (req.method !== "GET") {
			next();
			return;
		}

		// Check if cache should be skipped
		if (skipCache?.(req)) {
			next();
			return;
		}

		// Generate cache key
		const cacheKey = keyGenerator
			? keyGenerator(req)
			: generateDefaultCacheKey(req, {
					includeQueryParams,
					includeUserContext,
			  });

		try {
			// Try to get cached response
			const cachedResponse = await cacheService.get(cacheKey, { ttl });

			if (cachedResponse) {
				loggingService.debug(`Cache hit for ${req.path}`);

				// Set cache headers
				res.set({
					"X-Cache": "HIT",
					"X-Cache-Key": cacheKey,
					"Cache-Control": `public, max-age=${ttl}`,
				});

				// Send cached response
				res.json(cachedResponse);
				return;
			}

			// Cache miss - intercept response
			const originalJson = res.json;
			const originalSend = res.send;
			const originalEnd = res.end;

			let responseBody: unknown;

			// Override res.json to capture response
			res.json = function (body: unknown): Response {
				responseBody = body;
				return originalJson.call(this, body);
			};

			// Override res.send to capture response
			res.send = function (body: unknown): Response {
				responseBody = body;
				return originalSend.call(this, body);
			};

			// Override res.end to capture response
			const endWrapper = function (
				this: Response,
				...args: Parameters<typeof originalEnd>
			): Response {
				const chunk = args[0] as unknown;
				if (chunk && !responseBody) {
					responseBody = chunk;
				}
				return originalEnd.apply(this, args);
			};
			res.end = endWrapper as typeof res.end;

			// Store original end function to call after caching
			const originalEndCall = res.end;

			// Override res.end to cache response
			const cacheEndWrapper = function (
				this: Response,
				...args: Parameters<typeof originalEndCall>
			): Response {
				// Call original end first
				const result = originalEndCall.apply(this, args);

				// Cache the response asynchronously
				if (responseBody && res.statusCode >= 200 && res.statusCode < 300) {
					cacheService
						.set(cacheKey, responseBody, { ttl })
						.catch((error: Error) => {
							loggingService.error(
								`Failed to cache response for ${req.path}:`,
								error
							);
						});

					// Set cache headers
					res.set({
						"X-Cache": "MISS",
						"X-Cache-Key": cacheKey,
						"Cache-Control": `public, max-age=${ttl}`,
					});
				}

				return result;
			};
			res.end = cacheEndWrapper as typeof res.end;

			next();
		} catch (error) {
			loggingService.error(`Cache middleware error for ${req.path}:`, error);
			next();
		}
	};
};

/**
 * Middleware to invalidate cache on data mutations
 */
export const cacheInvalidationMiddleware = (patterns: string[]) => {
	return (_req: Request, res: Response, next: NextFunction): void => {
		// Store original end function
		const originalEnd = res.end;
		const originalJson = res.json;

		// Override response methods to invalidate cache after successful mutations
		res.json = function (body: unknown): Response {
			// Call original json method
			const result = originalJson.call(this, body);

			// Invalidate cache if response is successful
			if (res.statusCode >= 200 && res.statusCode < 300) {
				invalidateCachePatterns(patterns).catch((error: Error) => {
					loggingService.error("Failed to invalidate cache patterns:", error);
				});
			}

			return result;
		};

		const invalidationEndWrapper = function (
			this: Response,
			...args: Parameters<typeof originalEnd>
		): Response {
			// Call original end method
			const result = originalEnd.apply(this, args);

			// Invalidate cache if response is successful
			if (res.statusCode >= 200 && res.statusCode < 300) {
				invalidateCachePatterns(patterns).catch((error: Error) => {
					loggingService.error("Failed to invalidate cache patterns:", error);
				});
			}

			return result;
		};
		res.end = invalidationEndWrapper as typeof res.end;

		next();
	};
};

/**
 * Generate default cache key from request
 */
function generateDefaultCacheKey(
	req: AuthRequest,
	options: { includeQueryParams: boolean; includeUserContext: boolean }
): string {
	const { includeQueryParams, includeUserContext } = options;

	let key = req.path;

	// Include query parameters if requested
	if (includeQueryParams && Object.keys(req.query).length > 0) {
		const sortedQuery = Object.keys(req.query)
			.sort()
			.map(k => `${k}=${String(req.query[k])}`)
			.join("&");
		key += `?${sortedQuery}`;
	}

	// Include user context if requested
	if (includeUserContext && req.user?.id) {
		key += `:user:${req.user.id}`;
	}

	return key;
}

/**
 * Invalidate cache patterns asynchronously
 */
async function invalidateCachePatterns(patterns: string[]): Promise<void> {
	const invalidationPromises = patterns.map(pattern =>
		cacheService.invalidatePattern(pattern)
	);

	await Promise.all(invalidationPromises);
}

/**
 * Cache configuration presets for common use cases
 */
export const cachePresets = {
	// Short-term cache for frequently accessed data
	shortTerm: { ttl: 60, includeQueryParams: true },

	// Medium-term cache for moderately changing data
	mediumTerm: { ttl: 300, includeQueryParams: true },

	// Long-term cache for relatively static data
	longTerm: { ttl: 1800, includeQueryParams: true },

	// User-specific cache
	userSpecific: {
		ttl: 300,
		includeQueryParams: true,
		includeUserContext: true,
	},

	// Public cache (no user context)
	public: { ttl: 300, includeQueryParams: true, includeUserContext: false },
};
