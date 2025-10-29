import { type Prisma } from "@prisma/client";
import { UserRole } from "@/models/prisma";
import cron from "node-cron";

import { Filter } from "@/models";
// import { filterPollingQueue } from '../config/redis'; // Commented out as it's not used
import Notification from "@/models/Notification";
import User from "@/models/User";
import filterService from "@/services/filterService";
import loggingService from "@/services/loggingService";
import notificationService from "@/services/notificationService";
import smartPollingService from "@/services/smartPollingService";

export interface FilterWithUser {
  id: string;
  name: string;
  description?: string | null;
  criteria: Prisma.JsonValue;
  isActive: boolean;
  isSaved: boolean;
  nextPollAt: Date | null; // Changed from Date to Date | null
  userId?: string;
  teamId?: string | null;
  pollingInterval: number;
  notifyOnNewOpportunities: boolean;
  notifyOnDeadlineReminder: boolean;
  deadlineReminderDays: Prisma.JsonValue;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
    emailVerified: boolean;
  };
}

export interface SchedulerError {
  message: string;
  stack?: string;
}

class SchedulerService {
  private isRunning = false;

  start(): void {
    if (this.isRunning) {
      loggingService.info("Scheduler is already running");
      return;
    }

    this.isRunning = true;
    loggingService.info("Starting SAM.gov polling scheduler...");

    // Run enhanced filter polling every 15 minutes
    cron.schedule("*/15 * * * *", () => {
      void this.pollFilters();
    });

    // Run password change reminders daily at 09:00 UTC
    cron.schedule("0 9 * * *", () => {
      void this.sendPasswordChangeReminders();
    });

    // Also run immediately on startup
    setTimeout(() => {
      void this.pollFilters();
    }, 10000); // Wait 10 seconds after startup
  }

  stop(): void {
    this.isRunning = false;
    loggingService.info("SAM.gov polling scheduler stopped");
  }

  private async pollFilters(): Promise<void> {
    try {
      loggingService.info("Starting smart filter polling cycle...");

      // Get all filters ready for polling - only for premium users
      const filters = await Filter.findAll({
        where: {
          isActive: true,
        },
        include: {
          user: true, // Include user data to check premium status
        },
      });

      // Filter to only include filters from premium users
      const premiumFilters = filters.filter((filter: FilterWithUser) => {
        const { user } = filter;
        const isPremium =
          user &&
          (user.role === UserRole.PREMIUM ||
            user.role === UserRole.ENTERPRISE ||
            user.role === UserRole.ADMIN);
        const isActive = user?.isActive;
        const isEmailVerified = user?.emailVerified;

        return isPremium && isActive && isEmailVerified;
      });

      loggingService.info(
        `Found ${filters.length} total filters, ${premiumFilters.length} premium user filters`
      );

      if (premiumFilters.length === 0) {
        loggingService.info("No premium user filters available");
        return;
      }

      // Use smart polling to select which filters to poll
      const filtersToPoll =
        smartPollingService.getFiltersForSmartPolling(premiumFilters);

      loggingService.info(
        `Smart polling selected ${filtersToPoll.length} filters for polling`
      );

      if (filtersToPoll.length === 0) {
        loggingService.info("No filters selected for polling at this time");
        return;
      }

      // Use deduplicated polling for efficiency
      const result = await filterService.pollDeduplicatedFilters();

      // Update polling schedules for processed filters
      for (const filter of filtersToPoll) {
        const nextPollAt = smartPollingService.updatePollingSchedule(filter);
        await Filter.update({ nextPollAt }, { where: { id: filter.id } });
      }

      // Analyze polling performance
      const performanceAnalysis =
        smartPollingService.analyzePollingPerformance(premiumFilters);

      loggingService.info(
        `Smart filter polling completed: ${result.processedFilters} filters processed, ${result.newOpportunities} new opportunities`
      );
      loggingService.info("Polling performance analysis", performanceAnalysis);
    } catch (error: unknown) {
      const schedulerError = error as SchedulerError;
      loggingService.error("Smart filter polling cycle failed:", error);
      loggingService.error("Smart filter polling cycle failed", {
        error: schedulerError.message || "Unknown error",
        stack: schedulerError.stack,
      });
    }
  }

  // Manual trigger for testing
  async triggerPolling(): Promise<void> {
    loggingService.info("🔄 Manually triggering filter polling...");
    await this.pollFilters();
  }

  // Manual trigger for filter polling
  async triggerFilterPolling(): Promise<void> {
    loggingService.info("🔄 Manually triggering filter polling...");
    await this.pollFilters();
  }

  // Get scheduler status
  getStatus(): { isRunning: boolean; nextRun?: string } {
    return {
      isRunning: this.isRunning,
    };
  }

  private async sendPasswordChangeReminders(): Promise<void> {
    try {
      const now = new Date();
      // Define reminder thresholds (in days)
      const REMINDER_DAYS = [75, 85, 89]; // assuming 90-day policy
      const MS_PER_DAY = 24 * 60 * 60 * 1000;

      // Fetch active users; we limit batch size to avoid heavy load
      const users = await User.findAll({
        where: { isActive: true, emailVerified: true },
      });

      for (const user of users) {
        const basisDate =
          (user as unknown as { lastPasswordChangeAt?: Date | null })
            .lastPasswordChangeAt ?? user.createdAt;
        if (!basisDate) continue;
        const ageDays = Math.floor(
          (now.getTime() - new Date(basisDate).getTime()) / MS_PER_DAY
        );

        if (!REMINDER_DAYS.includes(ageDays)) continue;

        const daysLeft = 90 - ageDays;
        const title =
          daysLeft > 0
            ? `Password change reminder: ${daysLeft} day${
                daysLeft === 1 ? "" : "s"
              } left`
            : "Password change overdue";
        const message =
          daysLeft > 0
            ? "For security, please update your password before it expires."
            : "Your password has expired per policy. Please update it now.";

        await Notification.create({
          user: { connect: { id: user.id } },
          type: "password_change_reminder",
          title,
          message,
          metadata: { daysLeft },
        } as import("@prisma/client").Prisma.NotificationCreateInput);

        // Send email reminder as well
        await notificationService.sendPasswordChangeReminderEmail(
          user.email,
          daysLeft
        );
      }

      loggingService.info("Password change reminders processed", {
        count: users.length,
      });
    } catch (error) {
      loggingService.error(
        "Failed to send password change reminders",
        error as unknown
      );
    }
  }
}

export default new SchedulerService();
