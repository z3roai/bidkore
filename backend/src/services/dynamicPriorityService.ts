import { SubscriptionStatus } from "@/models/prisma";
import type { Queue } from "bullmq";

import {
  attachmentDownloadQueue,
  emailQueue,
  filterPollingQueue,
  notificationQueue,
} from "../config/redis";

import Subscription from "@/models/Subscription";
import User from "@/models/User";
import loggingService from "@/services/loggingService";

export interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  avgProcessingTime: number;
  throughput: number; // jobs per minute
}

export interface UserUsageMetrics {
  userId: string;
  jobCount: number;
  avgProcessingTime: number;
  successRate: number;
  lastActivity: Date;
  tier: string;
}

export interface DynamicPriorityConfig {
  basePriority: number;
  dynamicAdjustment: number;
  maxWaitTime: number;
  minWaitTime: number;
  concurrencyMultiplier: number;
}

class DynamicPriorityService {
  private readonly usageMetrics = new Map<string, UserUsageMetrics>();
  private readonly queueMetrics = new Map<string, QueueMetrics>();
  private lastMetricsUpdate: Date = new Date();

  /**
   * Update queue metrics for dynamic priority calculation
   */
  async updateQueueMetrics(): Promise<void> {
    try {
      const [attachmentStats, notificationStats, emailStats, filterStats] =
        await Promise.all([
          this.getQueueMetrics(attachmentDownloadQueue, "attachment-download"),
          this.getQueueMetrics(notificationQueue, "notification"),
          this.getQueueMetrics(emailQueue, "email"),
          this.getQueueMetrics(filterPollingQueue, "filter-polling"),
        ]);

      this.queueMetrics.set("attachment-download", attachmentStats);
      this.queueMetrics.set("notification", notificationStats);
      this.queueMetrics.set("email", emailStats);
      this.queueMetrics.set("filter-polling", filterStats);

      this.lastMetricsUpdate = new Date();

      loggingService.debug("Queue metrics updated", {
        attachmentDownload: attachmentStats,
        notification: notificationStats,
        email: emailStats,
        filterPolling: filterStats,
      });
    } catch (error: unknown) {
      loggingService.error("Error updating queue metrics:", error);
    }
  }

  /**
   * Get metrics for a specific queue
   */
  private async getQueueMetrics(
    queue: Queue,
    queueName: string
  ): Promise<QueueMetrics> {
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaiting(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getActive(),
      ]);

      // Calculate average processing time from recent completed jobs
      const recentCompleted = completed.slice(-100); // Last 100 completed jobs
      const avgProcessingTime =
        recentCompleted.length > 0
          ? recentCompleted.reduce((sum, job) => {
              const processingTime =
                job.processedOn && job.finishedOn
                  ? job.finishedOn - job.processedOn
                  : 0;
              return sum + processingTime;
            }, 0) / recentCompleted.length
          : 5000; // Default 5 seconds

      // Calculate throughput (jobs per minute) based on recent activity
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      const recentJobs = completed.filter(
        (job) => job.finishedOn && job.finishedOn > oneMinuteAgo
      );
      const throughput = recentJobs.length;

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        avgProcessingTime,
        throughput,
      };
    } catch (error: unknown) {
      loggingService.error(
        `Error getting metrics for queue ${queueName}:`,
        error
      );
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        avgProcessingTime: 5000,
        throughput: 0,
      };
    }
  }

  /**
   * Update user usage metrics for dynamic priority adjustment
   */
  async updateUserMetrics(
    userId: string,
    jobType: string,
    processingTime: number,
    success: boolean
  ): Promise<void> {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        return;
      }

      const existing = this.usageMetrics.get(userId) ?? {
        userId,
        jobCount: 0,
        avgProcessingTime: 0,
        successRate: 100,
        lastActivity: new Date(),
        tier: user.role,
      };

      // Update metrics with exponential moving average
      const alpha = 0.1; // Smoothing factor
      existing.jobCount += 1;
      existing.avgProcessingTime =
        existing.avgProcessingTime === 0
          ? processingTime
          : alpha * processingTime + (1 - alpha) * existing.avgProcessingTime;

      existing.successRate =
        existing.successRate === 100
          ? success
            ? 100
            : 0
          : alpha * (success ? 100 : 0) + (1 - alpha) * existing.successRate;

      existing.lastActivity = new Date();
      existing.tier = user.role;

      this.usageMetrics.set(userId, existing);

      loggingService.debug("User metrics updated", {
        userId,
        jobType,
        processingTime,
        success,
        updatedMetrics: existing,
      });
    } catch (error: unknown) {
      loggingService.error("Error updating user metrics:", error);
    }
  }

  /**
   * Get dynamic priority configuration based on current system load and user metrics
   */
  async getDynamicPriorityConfig(
    userId: string,
    jobType: string
  ): Promise<DynamicPriorityConfig> {
    try {
      // Update metrics if needed (every 30 seconds)
      const now = new Date();
      if (now.getTime() - this.lastMetricsUpdate.getTime() > 30000) {
        await this.updateQueueMetrics();
      }

      const user = await User.findByPk(userId);
      const userMetrics = this.usageMetrics.get(userId);
      const queueMetrics = this.queueMetrics.get(jobType);

      if (!user || !queueMetrics) {
        return this.getDefaultConfig(user?.role ?? "free");
      }

      // Get subscription info for premium users
      let subscription = null;
      if (["PREMIUM", "ENTERPRISE", "ADMIN"].includes(user.role)) {
        subscription = await Subscription.findOne({
          where: {
            userId,
            status: SubscriptionStatus.ACTIVE,
          },
        });
      }

      // Base priority from user tier
      const basePriority = this.getBasePriority(
        user.role,
        Boolean(subscription)
      );

      // Dynamic adjustment based on system load
      const systemLoadFactor = this.calculateSystemLoadFactor(queueMetrics);

      // User usage factor (frequent users get slight priority boost)
      const usageFactor = this.calculateUsageFactor(userMetrics);

      // Queue congestion factor
      const congestionFactor = this.calculateCongestionFactor(queueMetrics);

      // Calculate dynamic adjustment
      const dynamicAdjustment = Math.round(
        systemLoadFactor * 2 +
          Number(usageFactor) * 1 +
          Number(congestionFactor) * 1
      );

      // Calculate wait times based on current system state
      const baseWaitTime = this.getBaseWaitTime(
        user.role,
        Boolean(subscription)
      );
      const adjustedWaitTime = Math.max(
        baseWaitTime * systemLoadFactor,
        0 // Never go below 0
      );

      const maxWaitTime = this.getMaxWaitTime(user.role, queueMetrics);
      const minWaitTime = Math.min(adjustedWaitTime, maxWaitTime);

      // Concurrency multiplier based on system load
      const concurrencyMultiplier = Math.max(
        0.5,
        Math.min(2.0, 1 / systemLoadFactor)
      );

      const config: DynamicPriorityConfig = {
        basePriority,
        dynamicAdjustment,
        maxWaitTime,
        minWaitTime,
        concurrencyMultiplier,
      };

      loggingService.debug("Dynamic priority config calculated", {
        userId,
        userRole: user.role,
        jobType,
        config,
        systemLoadFactor,
        usageFactor,
        congestionFactor,
        queueMetrics,
        userMetrics,
      });

      return config;
    } catch (error: unknown) {
      loggingService.error("Error calculating dynamic priority config:", error);
      return this.getDefaultConfig("free");
    }
  }

  /**
   * Calculate system load factor (1.0 = normal, >1.0 = high load, <1.0 = low load)
   */
  private calculateSystemLoadFactor(metrics: QueueMetrics): number {
    // High waiting jobs = high load
    const waitingFactor = Math.min(metrics.waiting / 50, 2.0); // Cap at 2x for 50+ waiting jobs

    // Low throughput = high load
    const throughputFactor = Math.max(
      0.5,
      10 / Math.max(metrics.throughput, 1)
    ); // 10 jobs/min = normal

    // High processing time = high load
    const processingTimeFactor = Math.min(
      metrics.avgProcessingTime / 10000,
      2.0
    ); // 10s = normal

    return (waitingFactor + throughputFactor + processingTimeFactor) / 3;
  }

  /**
   * Calculate usage factor for user (frequent users get slight priority)
   */
  private calculateUsageFactor(metrics?: UserUsageMetrics): number {
    if (!metrics) {
      return 0;
    }

    // Recent active users get slight priority boost
    const hoursSinceLastActivity =
      (Date.now() - metrics.lastActivity.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastActivity > 24) {
      return -0.5; // Inactive users get slight penalty
    }

    // High success rate users get priority boost
    if (metrics.successRate > 95) {
      return 0.5;
    }
    if (metrics.successRate < 80) {
      return -0.5;
    }

    return 0; // Normal users
  }

  /**
   * Calculate congestion factor for specific queue
   */
  private calculateCongestionFactor(metrics: QueueMetrics): number {
    // High active jobs relative to completed = congestion
    const activeRatio =
      metrics.active / Math.max(metrics.completed + metrics.active, 1);
    return activeRatio > 0.1 ? 1.0 : -0.5; // >10% active jobs = congested
  }

  /**
   * Get base priority from user tier
   */
  private getBasePriority(
    role: string,
    hasActiveSubscription: boolean
  ): number {
    if (!hasActiveSubscription && role !== "ADMIN") {
      return 2; // Free users
    }

    switch (role) {
      case "ADMIN":
        return 10;
      case "ENTERPRISE":
        return 8;
      case "PREMIUM":
        return 6;
      default:
        return 2;
    }
  }

  /**
   * Get base wait time from user tier
   */
  private getBaseWaitTime(
    role: string,
    hasActiveSubscription: boolean
  ): number {
    if (!hasActiveSubscription && role !== "ADMIN") {
      return 30000; // 30s for free users
    }

    switch (role) {
      case "ADMIN":
        return 0;
      case "ENTERPRISE":
        return 1000; // 1s
      case "PREMIUM":
        return 5000; // 5s
      default:
        return 30000;
    }
  }

  /**
   * Get maximum wait time based on system state
   */
  private getMaxWaitTime(role: string, metrics: QueueMetrics): number {
    const baseMaxWait = this.getBaseWaitTime(role, true) * 5; // 5x base wait as max

    // If system is overloaded, increase max wait for lower tiers
    if (metrics.waiting > 100) {
      return role === "ADMIN" ? baseMaxWait : baseMaxWait * 2;
    }

    return baseMaxWait;
  }

  /**
   * Get default config when dynamic calculation fails
   */
  private getDefaultConfig(role: string): DynamicPriorityConfig {
    return {
      basePriority: this.getBasePriority(role, false),
      dynamicAdjustment: 0,
      maxWaitTime: this.getBaseWaitTime(role, false) * 5,
      minWaitTime: this.getBaseWaitTime(role, false),
      concurrencyMultiplier: 1.0,
    };
  }

  /**
   * Get real-time estimated wait time for user
   */
  async getEstimatedWaitTime(userId: string, jobType: string): Promise<string> {
    try {
      const config = await this.getDynamicPriorityConfig(userId, jobType);
      const queueMetrics = this.queueMetrics.get(jobType);

      if (!queueMetrics) {
        return "Unknown";
      }

      // Calculate estimated wait time based on queue position and processing rate
      const estimatedWaitMs =
        (queueMetrics.waiting / Math.max(queueMetrics.throughput, 0.1)) * 60000;
      const adjustedWaitMs = Math.max(
        estimatedWaitMs * config.concurrencyMultiplier,
        config.minWaitTime
      );

      const waitMinutes = Math.ceil(adjustedWaitMs / 60000);

      if (waitMinutes < 1) {
        return "Immediate";
      }
      if (waitMinutes < 2) {
        return "1-2 minutes";
      }
      if (waitMinutes < 5) {
        return "2-5 minutes";
      }
      if (waitMinutes < 10) {
        return "5-10 minutes";
      }
      if (waitMinutes < 30) {
        return "10-30 minutes";
      }

      return `${waitMinutes}+ minutes`;
    } catch (error: unknown) {
      loggingService.error("Error calculating estimated wait time:", error);
      return "Unknown";
    }
  }

  /**
   * Get system-wide priority statistics
   */
  async getPriorityStatistics(): Promise<{
    systemLoad: number;
    queueHealth: Record<string, QueueMetrics>;
    userDistribution: Record<string, number>;
    recommendations: string[];
  }> {
    try {
      await this.updateQueueMetrics();

      const systemLoad =
        Array.from(this.queueMetrics.values()).reduce(
          (sum, metrics) => sum + this.calculateSystemLoadFactor(metrics),
          0
        ) / this.queueMetrics.size;

      const userDistribution: Record<string, number> = {};
      this.usageMetrics.forEach((metrics) => {
        userDistribution[metrics.tier] =
          (userDistribution[metrics.tier] || 0) + 1;
      });

      const recommendations: string[] = [];

      // Generate recommendations based on system state
      if (systemLoad > 1.5) {
        recommendations.push("System load is high - consider scaling workers");
      }

      this.queueMetrics.forEach((metrics, queueName) => {
        if (metrics.waiting > 50) {
          recommendations.push(
            `${queueName} queue has high backlog (${metrics.waiting} jobs)`
          );
        }
        if (metrics.failed > metrics.completed * 0.1) {
          recommendations.push(`${queueName} queue has high failure rate`);
        }
      });

      return {
        systemLoad,
        queueHealth: Object.fromEntries(this.queueMetrics),
        userDistribution,
        recommendations,
      };
    } catch (error: unknown) {
      loggingService.error("Error getting priority statistics:", error);
      throw error;
    }
  }
}

export default new DynamicPriorityService();
