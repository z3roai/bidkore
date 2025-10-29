import cacheService from "@/services/cacheService";
import loggingService from "@/services/loggingService";

export interface CacheMetrics {
	timestamp: Date;
	hitRate: number;
	totalRequests: number;
	totalHits: number;
	totalMisses: number;
	memoryUsage: {
		used: string;
		peak: string;
	};
	topKeys: {
		key: string;
		hits: number;
		misses: number;
		hitRate: number;
	}[];
}

export interface CacheHealthCheck {
	status: "degraded" | "healthy" | "unhealthy";
	redisConnected: boolean;
	hitRate: number;
	memoryUsage: {
		used: string;
		peak: string;
	};
	issues: string[];
}

class CacheMonitoringService {
	private metricsHistory: CacheMetrics[] = [];
	private readonly maxHistorySize = 100; // Keep last 100 metrics
	private readonly warningHitRate = 0.7; // Warn if hit rate below 70%
	private readonly criticalHitRate = 0.5; // Critical if hit rate below 50%

	/**
	 * Collect current cache metrics
	 */
	async collectMetrics(): Promise<CacheMetrics> {
		try {
			const stats = cacheService.getStats();
			const memoryUsage = await cacheService.getMemoryUsage();

			// Calculate overall metrics
			let totalHits = 0;
			let totalMisses = 0;
			let totalRequests = 0;
			const keyMetrics: {
				key: string;
				hits: number;
				misses: number;
				hitRate: number;
			}[] = [];

			if (stats instanceof Map) {
				for (const [key, keyStats] of stats.entries()) {
					totalHits += keyStats.hits;
					totalMisses += keyStats.misses;
					totalRequests += keyStats.totalRequests;

					keyMetrics.push({
						key,
						hits: keyStats.hits,
						misses: keyStats.misses,
						hitRate: keyStats.hitRate,
					});
				}
			} else {
				const { hits, misses, totalRequests: totalRequestsFromStats } = stats;
				totalHits = hits;
				totalMisses = misses;
				totalRequests = totalRequestsFromStats;
			}

			const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

			// Sort keys by hit rate for top performers
			const topKeys = keyMetrics
				.slice()
				.sort((a, b) => b.hitRate - a.hitRate)
				.slice(0, 10);

			const metrics: CacheMetrics = {
				timestamp: new Date(),
				hitRate,
				totalRequests,
				totalHits,
				totalMisses,
				memoryUsage,
				topKeys,
			};

			// Store in history
			this.metricsHistory.push(metrics);
			if (this.metricsHistory.length > this.maxHistorySize) {
				this.metricsHistory.shift();
			}

			return metrics;
		} catch (error) {
			loggingService.error("Failed to collect cache metrics:", error);
			throw error;
		}
	}

	/**
	 * Get cache health status
	 */
	async getHealthCheck(): Promise<CacheHealthCheck> {
		try {
			const redisConnected = await cacheService.isConnected();
			const metrics = await this.collectMetrics();
			const issues: string[] = [];

			// Check Redis connection
			if (!redisConnected) {
				issues.push("Redis connection is down");
			}

			// Check hit rate
			if (metrics.hitRate < this.criticalHitRate) {
				issues.push(
					`Critical: Cache hit rate is ${(metrics.hitRate * 100).toFixed(
						1
					)}% (below ${this.criticalHitRate * 100}%)`
				);
			} else if (metrics.hitRate < this.warningHitRate) {
				issues.push(
					`Warning: Cache hit rate is ${(metrics.hitRate * 100).toFixed(
						1
					)}% (below ${this.warningHitRate * 100}%)`
				);
			}

			// Check memory usage (basic check)
			const usedMemoryMB = this.parseMemoryString(metrics.memoryUsage.used);

			if (usedMemoryMB > 1000) {
				// More than 1GB
				issues.push(`High memory usage: ${metrics.memoryUsage.used}`);
			}

			// Determine status
			let status: "degraded" | "healthy" | "unhealthy";
			if (issues.length === 0) {
				status = "healthy";
			} else if (issues.some(issue => issue.includes("Critical"))) {
				status = "unhealthy";
			} else {
				status = "degraded";
			}

			return {
				status,
				redisConnected,
				hitRate: metrics.hitRate,
				memoryUsage: metrics.memoryUsage,
				issues,
			};
		} catch (error) {
			loggingService.error("Failed to perform cache health check:", error);
			return {
				status: "unhealthy",
				redisConnected: false,
				hitRate: 0,
				memoryUsage: { used: "0B", peak: "0B" },
				issues: ["Failed to perform health check"],
			};
		}
	}

	/**
	 * Get metrics history
	 */
	getMetricsHistory(limit?: number): CacheMetrics[] {
		if (limit) {
			return this.metricsHistory.slice(-limit);
		}
		return [...this.metricsHistory];
	}

	/**
	 * Get average hit rate over time
	 */
	getAverageHitRate(hours = 24): number {
		const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
		const recentMetrics = this.metricsHistory.filter(
			metric => metric.timestamp >= cutoffTime
		);

		if (recentMetrics.length === 0) {
			return 0;
		}

		const totalHitRate = recentMetrics.reduce(
			(sum, metric) => sum + metric.hitRate,
			0
		);
		return totalHitRate / recentMetrics.length;
	}

	/**
	 * Get cache performance trends
	 */
	getPerformanceTrends(hours = 24): {
		hitRateTrend: "declining" | "improving" | "stable";
		requestTrend: "decreasing" | "increasing" | "stable";
		hitRateChange: number;
		requestChange: number;
	} {
		const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
		const recentMetrics = this.metricsHistory.filter(
			metric => metric.timestamp >= cutoffTime
		);

		if (recentMetrics.length < 2) {
			return {
				hitRateTrend: "stable",
				requestTrend: "stable",
				hitRateChange: 0,
				requestChange: 0,
			};
		}

		const firstHalf = recentMetrics.slice(
			0,
			Math.floor(recentMetrics.length / 2)
		);
		const secondHalf = recentMetrics.slice(
			Math.floor(recentMetrics.length / 2)
		);

		const firstHalfAvgHitRate =
			firstHalf.reduce((sum, m) => sum + m.hitRate, 0) / firstHalf.length;
		const secondHalfAvgHitRate =
			secondHalf.reduce((sum, m) => sum + m.hitRate, 0) / secondHalf.length;
		const hitRateChange = secondHalfAvgHitRate - firstHalfAvgHitRate;

		const firstHalfAvgRequests =
			firstHalf.reduce((sum, m) => sum + m.totalRequests, 0) / firstHalf.length;
		const secondHalfAvgRequests =
			secondHalf.reduce((sum, m) => sum + m.totalRequests, 0) /
			secondHalf.length;
		const requestChange = secondHalfAvgRequests - firstHalfAvgRequests;

		let hitRateTrend: "declining" | "improving" | "stable";
		if (hitRateChange > 0.05) {
			hitRateTrend = "improving";
		} else if (hitRateChange < -0.05) {
			hitRateTrend = "declining";
		} else {
			hitRateTrend = "stable";
		}

		let requestTrend: "decreasing" | "increasing" | "stable";
		if (requestChange > 10) {
			requestTrend = "increasing";
		} else if (requestChange < -10) {
			requestTrend = "decreasing";
		} else {
			requestTrend = "stable";
		}

		return {
			hitRateTrend,
			requestTrend,
			hitRateChange,
			requestChange,
		};
	}

	/**
	 * Clear metrics history
	 */
	clearMetricsHistory(): void {
		this.metricsHistory = [];
		loggingService.info("Cache metrics history cleared");
	}

	/**
	 * Get cache recommendations based on metrics
	 */
	getRecommendations(): string[] {
		const recommendations: string[] = [];
		const recentMetrics = this.getMetricsHistory(10); // Last 10 metrics

		if (recentMetrics.length === 0) {
			return ["Insufficient data for recommendations"];
		}

		const avgHitRate =
			recentMetrics.reduce((sum, m) => sum + m.hitRate, 0) /
			recentMetrics.length;
		const avgRequests =
			recentMetrics.reduce((sum, m) => sum + m.totalRequests, 0) /
			recentMetrics.length;

		// Hit rate recommendations
		if (avgHitRate < 0.5) {
			recommendations.push(
				"Consider increasing cache TTL for frequently accessed data"
			);
			recommendations.push("Review cache key strategies to improve hit rates");
		}

		// Request volume recommendations
		if (avgRequests > 1000) {
			recommendations.push(
				"High request volume detected - consider implementing request deduplication"
			);
		}

		// Memory usage recommendations
		const latestMemory = recentMetrics[recentMetrics.length - 1]?.memoryUsage;
		if (!latestMemory) {
			return recommendations;
		}
		const usedMemoryMB = this.parseMemoryString(latestMemory.used);
		if (usedMemoryMB > 500) {
			recommendations.push(
				"High memory usage - consider implementing cache eviction policies"
			);
		}

		// Performance trend recommendations
		const trends = this.getPerformanceTrends();
		if (trends.hitRateTrend === "declining") {
			recommendations.push(
				"Hit rate is declining - review cache invalidation strategies"
			);
		}

		if (recommendations.length === 0) {
			recommendations.push("Cache performance is optimal");
		}

		return recommendations;
	}

	private parseMemoryString(memoryStr: string): number {
		const match = memoryStr.match(/^(\d+(?:\.\d+)?)([KMGT]?B)$/);
		if (!match) {
			return 0;
		}

		const value = parseFloat(match[1] ?? "0");
		const unit = match[2] ?? "B";

		const multipliers: Record<string, number> = {
			B: 1,
			KB: 1024,
			MB: 1024 * 1024,
			GB: 1024 * 1024 * 1024,
			TB: 1024 * 1024 * 1024 * 1024,
		};

		return (value * (multipliers[unit] ?? 1)) / (1024 * 1024); // Convert to MB
	}
}

// Export singleton instance
const cacheMonitoringService = new CacheMonitoringService();
export default cacheMonitoringService;
