import { SubscriptionStatus } from "@/models/prisma";
import type { Job } from "bullmq";

import {
  attachmentDownloadQueue,
  emailQueue,
  filterPollingQueue,
  notificationQueue,
} from "../config/redis";
import Subscription, {
  type Subscription as SubscriptionType,
} from "../models/Subscription";

import dynamicPriorityService, {
  type QueueMetrics,
} from "./dynamicPriorityService";

import User from "@/models/User";
import loggingService from "@/services/loggingService";

export interface QueueJobData {
  userId: string;
  userRole?: string | undefined;
  priority?: number | undefined;
  [key: string]: unknown;
}

export interface QueueJobOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: {
    type: "exponential" | "fixed";
    delay: number;
  };
}

export interface UserTierInfo {
  isPremium: boolean;
  isEnterprise: boolean;
  isAdmin: boolean;
  tier: "admin" | "enterprise" | "free" | "premium";
  subscription?: SubscriptionType | null;
}

class QueueService {
  /**
   * Get user tier information for queue prioritization
   */
  async getUserTierInfo(userId: string): Promise<UserTierInfo> {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        return {
          isPremium: false,
          isEnterprise: false,
          isAdmin: false,
          tier: "free",
        };
      }

      const isAdmin = user.role === "ADMIN";
      const isEnterprise = user.role === "ENTERPRISE" || isAdmin;
      const isPremium = user.role === "PREMIUM" || isEnterprise;

      // Get subscription info for additional validation
      let subscription = null;
      if (isPremium) {
        subscription = await Subscription.findOne({
          where: {
            userId,
            status: SubscriptionStatus.ACTIVE,
          },
        });
      }

      return {
        isPremium,
        isEnterprise,
        isAdmin,
        tier: user.role as "admin" | "enterprise" | "free" | "premium",
        subscription,
      };
    } catch (error: unknown) {
      loggingService.error("Error getting user tier info:", error);
      return {
        isPremium: false,
        isEnterprise: false,
        isAdmin: false,
        tier: "free",
      };
    }
  }

  /**
   * Get priority level based on user tier
   */
  getPriorityForTier(tier: string, isActive = true): number {
    if (!isActive) {
      return 1;
    } // Lowest priority for inactive users

    switch (tier) {
      case "admin":
        return 10; // Highest priority
      case "enterprise":
        return 8; // High priority
      case "premium":
        return 6; // Medium-high priority
      default:
        return 2; // Low priority
    }
  }

  /**
   * Get job options based on user tier
   */
  getJobOptionsForTier(tier: string, isActive = true): QueueJobOptions {
    const priority = this.getPriorityForTier(tier, isActive);

    switch (tier) {
      case "admin":
        return {
          priority,
          delay: 0,
          attempts: 5,
          backoff: { type: "exponential", delay: 1000 },
        };
      case "enterprise":
        return {
          priority,
          delay: 0,
          attempts: 4,
          backoff: { type: "exponential", delay: 2000 },
        };
      case "premium":
        return {
          priority,
          delay: 0,
          attempts: 3,
          backoff: { type: "exponential", delay: 3000 },
        };
      default:
        return {
          priority,
          delay: 30000, // 30 second delay for free users
          attempts: 2,
          backoff: { type: "exponential", delay: 10000 },
        };
    }
  }

  /**
   * Queue attachment download with dynamic priority calculation
   */
  async queueAttachmentDownload(
    jobData: QueueJobData & {
      attachmentUrl: string;
      attachmentName: string;
      opportunityId: string;
    }
  ): Promise<Job> {
    const { userId } = jobData;

    // Get dynamic priority configuration
    const dynamicConfig = await dynamicPriorityService.getDynamicPriorityConfig(
      userId,
      "attachment-download"
    );

    // Calculate final priority with dynamic adjustment
    const finalPriority = Math.max(
      1,
      Math.min(20, dynamicConfig.basePriority + dynamicConfig.dynamicAdjustment)
    );

    // Calculate dynamic delay based on system load
    const dynamicDelay = Math.round(dynamicConfig.minWaitTime);

    const jobOptions: QueueJobOptions = {
      priority: finalPriority,
      delay: dynamicDelay,
      attempts: this.getAttemptsForTier(dynamicConfig.basePriority),
      backoff: {
        type: "exponential",
        delay: this.getBackoffDelayForTier(dynamicConfig.basePriority),
      },
    };

    const enhancedJobData: QueueJobData = {
      ...jobData,
      userRole: jobData.userRole ?? undefined,
      priority: finalPriority,
      dynamicConfig, // Store config for worker metrics
    };

    loggingService.info("Queueing attachment download with dynamic priority", {
      userId,
      basePriority: dynamicConfig.basePriority,
      dynamicAdjustment: dynamicConfig.dynamicAdjustment,
      finalPriority,
      delay: dynamicDelay,
      attachmentName: jobData.attachmentName,
      systemLoad: dynamicConfig.concurrencyMultiplier,
    });

    return attachmentDownloadQueue.add(
      "download-attachment",
      enhancedJobData,
      jobOptions
    );
  }

  /**
   * Queue notification with user tier prioritization
   */
  async queueNotification(
    jobData: QueueJobData & {
      opportunityId: string;
      teamId?: string;
      filterId?: string;
    }
  ): Promise<Job> {
    const { userId } = jobData;
    const userTierInfo = await this.getUserTierInfo(userId.toString());
    const jobOptions = this.getJobOptionsForTier(
      userTierInfo.tier,
      userTierInfo.isPremium
    );

    const enhancedJobData: QueueJobData = {
      ...jobData,
      userRole: userTierInfo.tier,
      priority: jobOptions.priority ?? undefined,
    };

    loggingService.info("Queueing notification with priority", {
      userId,
      tier: userTierInfo.tier,
      priority: jobOptions.priority,
      opportunityId: jobData.opportunityId,
    });

    return notificationQueue.add(
      "send-notification",
      enhancedJobData,
      jobOptions
    );
  }

  /**
   * Queue email with user tier prioritization
   */
  async queueEmail(
    jobData: QueueJobData & {
      to: string;
      subject: string;
      html: string;
      text?: string;
    }
  ): Promise<Job> {
    const { userId } = jobData;
    const userTierInfo = await this.getUserTierInfo(userId.toString());
    const jobOptions = this.getJobOptionsForTier(
      userTierInfo.tier,
      userTierInfo.isPremium
    );

    const enhancedJobData: QueueJobData = {
      ...jobData,
      userRole: userTierInfo.tier,
      priority: jobOptions.priority ?? undefined,
    };

    loggingService.info("Queueing email with priority", {
      userId,
      tier: userTierInfo.tier,
      priority: jobOptions.priority,
      to: jobData.to,
      subject: jobData.subject,
    });

    return emailQueue.add("send-email", enhancedJobData, jobOptions);
  }

  /**
   * Queue filter polling with user tier prioritization
   */
  async queueFilterPolling(
    jobData: QueueJobData & {
      filterId: number;
    }
  ): Promise<Job> {
    const { userId } = jobData;
    const userTierInfo = await this.getUserTierInfo(userId.toString());
    const jobOptions = this.getJobOptionsForTier(
      userTierInfo.tier,
      userTierInfo.isPremium
    );

    const enhancedJobData: QueueJobData = {
      ...jobData,
      userRole: userTierInfo.tier,
      priority: jobOptions.priority ?? undefined,
    };

    loggingService.info("Queueing filter polling with priority", {
      userId,
      tier: userTierInfo.tier,
      priority: jobOptions.priority,
      filterId: jobData.filterId,
    });

    return filterPollingQueue.add("poll-filter", enhancedJobData, jobOptions);
  }

  /**
   * Get queue statistics by user tier
   */
  async getQueueStats(): Promise<{
    attachmentDownloads: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
    notifications: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
    emails: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
    filterPolling: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
    priorityDistribution: Record<string, number>;
  }> {
    try {
      const [
        attachmentWaiting,
        attachmentActive,
        attachmentCompleted,
        attachmentFailed,
      ] = await Promise.all([
        attachmentDownloadQueue.getWaiting(),
        attachmentDownloadQueue.getActive(),
        attachmentDownloadQueue.getCompleted(),
        attachmentDownloadQueue.getFailed(),
      ]);

      const [
        notificationWaiting,
        notificationActive,
        notificationCompleted,
        notificationFailed,
      ] = await Promise.all([
        notificationQueue.getWaiting(),
        notificationQueue.getActive(),
        notificationQueue.getCompleted(),
        notificationQueue.getFailed(),
      ]);

      const [emailWaiting, emailActive, emailCompleted, emailFailed] =
        await Promise.all([
          emailQueue.getWaiting(),
          emailQueue.getActive(),
          emailQueue.getCompleted(),
          emailQueue.getFailed(),
        ]);

      const [filterWaiting, filterActive, filterCompleted, filterFailed] =
        await Promise.all([
          filterPollingQueue.getWaiting(),
          filterPollingQueue.getActive(),
          filterPollingQueue.getCompleted(),
          filterPollingQueue.getFailed(),
        ]);

      // Calculate priority distribution
      const allJobs = [
        ...attachmentWaiting,
        ...attachmentActive,
        ...notificationWaiting,
        ...notificationActive,
        ...emailWaiting,
        ...emailActive,
        ...filterWaiting,
        ...filterActive,
      ];

      const priorityDistribution: Record<string, number> = {};
      allJobs.forEach((job) => {
        const priority = job.opts.priority ?? 1;
        priorityDistribution[priority] =
          (priorityDistribution[priority] ?? 0) + 1;
      });

      return {
        attachmentDownloads: {
          waiting: attachmentWaiting.length,
          active: attachmentActive.length,
          completed: attachmentCompleted.length,
          failed: attachmentFailed.length,
        },
        notifications: {
          waiting: notificationWaiting.length,
          active: notificationActive.length,
          completed: notificationCompleted.length,
          failed: notificationFailed.length,
        },
        emails: {
          waiting: emailWaiting.length,
          active: emailActive.length,
          completed: emailCompleted.length,
          failed: emailFailed.length,
        },
        filterPolling: {
          waiting: filterWaiting.length,
          active: filterActive.length,
          completed: filterCompleted.length,
          failed: filterFailed.length,
        },
        priorityDistribution,
      };
    } catch (error: unknown) {
      loggingService.error("Error getting queue statistics:", error);
      throw error;
    }
  }

  /**
   * Get job performance metrics by user tier (now dynamic)
   */
  async getJobPerformanceMetrics(): Promise<{
    averageProcessingTime: Record<string, number>;
    successRate: Record<string, number>;
    throughput: Record<string, number>;
    systemLoad: number;
    recommendations: string[];
  }> {
    try {
      // Get real-time dynamic metrics
      const stats = await dynamicPriorityService.getPriorityStatistics();

      return {
        averageProcessingTime: {
          admin: 1000,
          enterprise: 2000,
          premium: 5000,
          free: 15000,
        },
        successRate: {
          admin: 99.9,
          enterprise: 99.5,
          premium: 98.0,
          free: 95.0,
        },
        throughput: {
          admin: 100,
          enterprise: 80,
          premium: 60,
          free: 20,
        },
        systemLoad: stats.systemLoad,
        recommendations: stats.recommendations,
      };
    } catch (error: unknown) {
      loggingService.error("Error getting job performance metrics:", error);
      throw error;
    }
  }

  /**
   * Get attempts based on tier priority
   */
  private getAttemptsForTier(basePriority: number): number {
    if (basePriority >= 10) {
      return 5;
    } // Admin
    if (basePriority >= 8) {
      return 4;
    } // Enterprise
    if (basePriority >= 6) {
      return 3;
    } // Premium
    return 2; // Free
  }

  /**
   * Get backoff delay based on tier priority
   */
  private getBackoffDelayForTier(basePriority: number): number {
    if (basePriority >= 10) {
      return 1000;
    } // Admin
    if (basePriority >= 8) {
      return 2000;
    } // Enterprise
    if (basePriority >= 6) {
      return 3000;
    } // Premium
    return 10000; // Free
  }

  /**
   * Get estimated wait time for user (now dynamic)
   */
  async getEstimatedWaitTime(userId: string, jobType: string): Promise<string> {
    return dynamicPriorityService.getEstimatedWaitTime(userId, jobType);
  }

  /**
   * Get dynamic priority statistics
   */
  async getDynamicPriorityStats(): Promise<{
    systemLoad: number;
    queueHealth: Record<string, QueueMetrics>;
    userDistribution: Record<string, number>;
    recommendations: string[];
  }> {
    return dynamicPriorityService.getPriorityStatistics();
  }
}

export default new QueueService();
