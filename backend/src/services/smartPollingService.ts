import type { FilterData } from "@/services/filterService";
import loggingService from "@/services/loggingService";

export interface PollingStrategy {
	baseInterval: number;
	adjustedInterval: number;
	reason: string;
	confidence: number;
}

export interface FilterActivityMetrics {
	opportunityCount: number;
	daysSinceLastPoll: number;
	daysSinceLastOpportunity: number;
	pollingFrequency: number;
	successRate: number;
}

class SmartPollingService {
	private readonly MIN_INTERVAL = 15; // 15 minutes minimum
	private readonly MAX_INTERVAL = 1440; // 24 hours maximum
	private readonly NEW_FILTER_BOOST_DAYS = 7; // Boost new filters for 7 days
	private readonly INACTIVE_THRESHOLD_DAYS = 14; // Consider inactive after 14 days

	/**
	 * Calculates optimal polling interval based on filter activity and characteristics
	 */
	calculateOptimalPollingInterval(filter: FilterData): PollingStrategy {
		const baseInterval = filter.pollingInterval;
		const metrics = this.calculateFilterMetrics(filter);

		let adjustedInterval = baseInterval;
		let reason = "Base interval";
		let confidence = 0.5;

		// New filter boost - more frequent polling for first week
		if (this.isNewFilter(filter)) {
			adjustedInterval = Math.min(baseInterval, 30);
			reason = "New filter boost";
			confidence = 0.8;
		}

		// High activity filters - more frequent polling
		else if (metrics.pollingFrequency > 0.8 && metrics.successRate > 0.7) {
			adjustedInterval = Math.max(baseInterval * 0.7, this.MIN_INTERVAL);
			reason = "High activity filter";
			confidence = 0.9;
		}

		// Inactive filters - less frequent polling
		else if (metrics.daysSinceLastPoll > this.INACTIVE_THRESHOLD_DAYS) {
			adjustedInterval = Math.min(baseInterval * 2, this.MAX_INTERVAL);
			reason = "Inactive filter";
			confidence = 0.7;
		}

		// Filters with no opportunities - moderate frequency
		else if (metrics.opportunityCount === 0) {
			adjustedInterval = Math.min(baseInterval, 45);
			reason = "No opportunities found";
			confidence = 0.6;
		}

		// AI-generated filters - slightly more frequent polling
		else if (
			"naturalLanguageDescription" in filter &&
			filter.naturalLanguageDescription
		) {
			adjustedInterval = Math.max(baseInterval * 0.9, this.MIN_INTERVAL);
			reason = "AI-generated filter";
			confidence = 0.7;
		}

		// Ensure interval is within bounds
		adjustedInterval = Math.max(
			this.MIN_INTERVAL,
			Math.min(adjustedInterval, this.MAX_INTERVAL),
		);

		const strategy: PollingStrategy = {
			baseInterval,
			adjustedInterval,
			reason,
			confidence,
		};

		loggingService.info("Calculated polling strategy", {
			filterId: filter.id,
			filterName: filter.name,
			strategy,
			metrics,
		});

		return strategy;
	}

	/**
	 * Calculates filter activity metrics
	 */
	private calculateFilterMetrics(filter: FilterData): FilterActivityMetrics {
		const now = new Date();

		// Calculate days since last poll
		const daysSinceLastPoll = filter.lastPolledAt
			? (now.getTime() - filter.lastPolledAt.getTime()) / (1000 * 60 * 60 * 24)
			: 999; // Very high if never polled

		// Calculate days since last opportunity (approximate)
		const daysSinceLastOpportunity = filter.lastSearchAt
			? (now.getTime() - filter.lastSearchAt.getTime()) / (1000 * 60 * 60 * 24)
			: 999;

		// Calculate polling frequency (polls per day)
		const pollingFrequency =
			(filter.searchCount ?? 0) > 0 && filter.lastPolledAt
				? (filter.searchCount ?? 0) / Math.max(daysSinceLastPoll, 1)
				: 0;

		// Calculate success rate (opportunities found per poll)
		const successRate =
			(filter.searchCount ?? 0) > 0
				? (filter.opportunityCount ?? 0) / (filter.searchCount ?? 0)
				: 0;

		return {
			opportunityCount: filter.opportunityCount ?? 0,
			daysSinceLastPoll,
			daysSinceLastOpportunity,
			pollingFrequency,
			successRate,
		};
	}

	/**
	 * Checks if filter is considered "new" (within boost period)
	 */
	private isNewFilter(filter: FilterData): boolean {
		if (!filter.createdAt) {return false;}

		const daysSinceCreation =
			(Date.now() - filter.createdAt.getTime()) / (1000 * 60 * 60 * 24);
		return daysSinceCreation <= this.NEW_FILTER_BOOST_DAYS;
	}

	/**
	 * Determines if filter should be polled based on smart strategy
	 */
	shouldPollFilter(filter: FilterData): {
		shouldPoll: boolean;
		reason: string;
	} {
		if (!filter.isActive || !filter.nextPollAt) {
			return {
				shouldPoll: false,
				reason: "Filter inactive or no next poll time",
			};
		}

		const now = new Date();
		const timeUntilNextPoll = filter.nextPollAt.getTime() - now.getTime();

		// Always poll if it's time
		if (timeUntilNextPoll <= 0) {
			return { shouldPoll: true, reason: "Scheduled poll time reached" };
		}

		// Check for urgent conditions that might require early polling
		const metrics = this.calculateFilterMetrics(filter);

		// Urgent: New filter that hasn't been polled yet
		if (this.isNewFilter(filter) && !filter.lastPolledAt) {
			return { shouldPoll: true, reason: "New filter first poll" };
		}

		// Urgent: High-value filter with recent activity
		if (metrics.pollingFrequency > 1.0 && metrics.successRate > 0.5) {
			return { shouldPoll: true, reason: "High-value filter early poll" };
		}

		return { shouldPoll: false, reason: "Not yet time for polling" };
	}

	/**
	 * Updates filter polling schedule based on smart strategy
	 */
	updatePollingSchedule(filter: FilterData): Date {
		const strategy = this.calculateOptimalPollingInterval(filter);

		const nextPollAt = new Date();
		nextPollAt.setMinutes(nextPollAt.getMinutes() + strategy.adjustedInterval);

		loggingService.info("Updated polling schedule", {
			filterId: filter.id,
			filterName: filter.name,
			nextPollAt: nextPollAt.toISOString(),
			strategy,
		});

		return nextPollAt;
	}

	/**
	 * Gets filters that should be polled based on smart strategy
	 */
	getFiltersForSmartPolling(allFilters: FilterData[]): FilterData[] {
		const filtersToPoll: FilterData[] = [];

		for (const filter of allFilters) {
			const shouldPoll = this.shouldPollFilter(filter);

			if (shouldPoll.shouldPoll) {
				filtersToPoll.push(filter);
				loggingService.info("Filter selected for smart polling", {
					filterId: filter.id,
					filterName: filter.name,
					reason: shouldPoll.reason,
				});
			}
		}

		// Sort by priority (new filters first, then by activity)
		filtersToPoll.sort((a, b) => {
			const aIsNew = this.isNewFilter(a);
			const bIsNew = this.isNewFilter(b);

			if (aIsNew && !bIsNew) {return -1;}
			if (!aIsNew && bIsNew) {return 1;}

			// If both are new or both are not new, sort by opportunity count
			return (b.opportunityCount ?? 0) - (a.opportunityCount ?? 0);
		});

		loggingService.info("Smart polling selection complete", {
			totalFilters: allFilters.length,
			selectedFilters: filtersToPoll.length,
			selectedFilterIds: filtersToPoll.map((f) => f.id),
		});

		return filtersToPoll;
	}

	/**
	 * Analyzes polling performance and suggests optimizations
	 */
	analyzePollingPerformance(filters: FilterData[]): {
		recommendations: string[];
		metrics: {
			totalFilters: number;
			activeFilters: number;
			avgPollingInterval: number;
			avgSuccessRate: number;
		};
	} {
		const activeFilters = filters.filter((f) => f.isActive);
		const avgPollingInterval =
			activeFilters.reduce((sum, f) => sum + f.pollingInterval, 0) /
			activeFilters.length;
		const avgSuccessRate =
			activeFilters.reduce((sum, f) => {
				const successRate =
					(f.searchCount ?? 0) > 0
						? (f.opportunityCount ?? 0) / (f.searchCount ?? 0)
						: 0;
				return sum + successRate;
			}, 0) / activeFilters.length;

		const recommendations: string[] = [];

		if (avgPollingInterval < 30) {
			recommendations.push(
				"Consider increasing polling intervals for better resource efficiency",
			);
		}

		if (avgSuccessRate < 0.1) {
			recommendations.push(
				"Low success rate detected - consider reviewing filter criteria",
			);
		}

		const inactiveFilters = activeFilters.filter((f) => {
			if (!f.lastPolledAt) {return true;}
			const daysSinceLastPoll =
				(Date.now() - f.lastPolledAt.getTime()) / (1000 * 60 * 60 * 24);
			return daysSinceLastPoll > this.INACTIVE_THRESHOLD_DAYS;
		});

		if (inactiveFilters.length > activeFilters.length * 0.3) {
			recommendations.push(
				"High number of inactive filters - consider cleanup or reactivation",
			);
		}

		return {
			recommendations,
			metrics: {
				totalFilters: filters.length,
				activeFilters: activeFilters.length,
				avgPollingInterval,
				avgSuccessRate,
			},
		};
	}
}

export default new SmartPollingService();
