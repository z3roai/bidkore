import type { Job } from "bullmq";
import { type Response, Router } from "express";

import {
	type AuthRequest,
	authenticateToken,
	requireAdmin,
} from "../middleware/auth";

import loggingService from "@/services/loggingService";
import queueService from "@/services/queueService";

const router = Router();

/**
 * Get queue statistics (Admin only)
 */
router.get(
	"/stats",
	authenticateToken,
	requireAdmin,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			const stats = await queueService.getQueueStats();
			const metrics = await queueService.getJobPerformanceMetrics();

			loggingService.info("Queue statistics retrieved", {
				userId: req.user?.id,
				stats,
			});

			res.json({
				success: true,
				data: {
					stats,
					metrics,
					timestamp: new Date().toISOString(),
				},
			});
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error : new Error(String(error));
			loggingService.logUserError(
				"get_queue_stats",
				req.user?.id ?? "",
				req.user?.role ?? "unknown",
				errorMessage
			);
			res.status(500).json({ error: "Failed to get queue statistics" });
		}
	}
);

/**
 * Get user-specific queue information
 */
router.get(
	"/user/:userId",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			const { userId } = req.params;

			if (!userId) {
				res.status(400).json({ error: "Invalid user ID" });
				return;
			}

			// Users can only view their own queue info, unless they're admin
			if (req.user?.id !== userId && req.user?.role !== "ADMIN") {
				res.status(403).json({ error: "Access denied" });
				return;
			}

			const userTierInfo = await queueService.getUserTierInfo(userId);

			loggingService.info("User queue info retrieved", {
				requestedUserId: userId,
				requesterUserId: req.user.id,
				userTier: userTierInfo.tier,
			});

			res.json({
				success: true,
				data: {
					userId,
					tier: userTierInfo.tier,
					isPremium: userTierInfo.isPremium,
					isEnterprise: userTierInfo.isEnterprise,
					isAdmin: userTierInfo.isAdmin,
					priority: queueService.getPriorityForTier(userTierInfo.tier),
					jobOptions: queueService.getJobOptionsForTier(userTierInfo.tier),
					subscription: userTierInfo.subscription,
				},
			});
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error : new Error(String(error));
			loggingService.logUserError(
				"get_user_queue_info",
				req.user?.id ?? "",
				req.user?.role ?? "unknown",
				errorMessage
			);
			res.status(500).json({ error: "Failed to get user queue information" });
		}
	}
);

/**
 * Get dynamic priority system information
 */
router.get(
	"/priority-system",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			const dynamicStats = await queueService.getDynamicPriorityStats();

			const prioritySystem = {
				type: "dynamic",
				description:
					"Dynamic priority system that adjusts based on system load and user behavior",
				baseTiers: {
					admin: {
						basePriority: 10,
						description: "Highest base priority with dynamic adjustments",
					},
					enterprise: {
						basePriority: 8,
						description: "High base priority with dynamic adjustments",
					},
					premium: {
						basePriority: 6,
						description: "Medium-high base priority with dynamic adjustments",
					},
					free: {
						basePriority: 2,
						description: "Standard base priority with dynamic adjustments",
					},
				},
				dynamicFactors: {
					systemLoad: "Adjusts priority based on current queue congestion",
					userBehavior: "Frequent users get slight priority boost",
					successRate: "High success rate users get priority preference",
					timeSinceActivity: "Recently active users get priority boost",
				},
				currentSystemState: {
					systemLoad: dynamicStats.systemLoad,
					queueHealth: dynamicStats.queueHealth,
					userDistribution: dynamicStats.userDistribution,
					recommendations: dynamicStats.recommendations,
				},
				features: {
					dynamicPriorityCalculation: true,
					realTimeSystemLoadAdjustment: true,
					userBehaviorTracking: true,
					adaptiveWaitTimes: true,
					performanceMetrics: true,
					intelligentConcurrency: true,
					systemHealthMonitoring: true,
				},
			};

			res.json({
				success: true,
				data: prioritySystem,
			});
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error : new Error(String(error));
			loggingService.logUserError(
				"get_priority_system_info",
				req.user?.id ?? "",
				req.user?.role ?? "unknown",
				errorMessage
			);
			res
				.status(500)
				.json({ error: "Failed to get priority system information" });
		}
	}
);

/**
 * Test queue priority (Admin only)
 */
router.post(
	"/test-priority",
	authenticateToken,
	requireAdmin,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			const { userId, tier, jobType } = req.body as {
				userId?: string;
				tier?: string;
				jobType?: string;
			};

			if (!userId || !tier || !jobType) {
				res.status(400).json({
					error: "Missing required fields: userId, tier, jobType",
				});
				return;
			}

			const userTierInfo = await queueService.getUserTierInfo(userId);
			const jobOptions = queueService.getJobOptionsForTier(tier);

			// Create a test job based on jobType
			let testJob: Job;
			const testData = {
				userId,
				userRole: tier,
				testMode: true,
				timestamp: new Date().toISOString(),
			};

			switch (jobType) {
				case "attachment":
					testJob = await queueService.queueAttachmentDownload({
						...testData,
						attachmentUrl: "https://example.com/test-file.pdf",
						attachmentName: "test-file.pdf",
						opportunityId: "999999",
					});
					break;
				case "notification":
					testJob = await queueService.queueNotification({
						...testData,
						opportunityId: "999999",
					});
					break;
				case "email":
					testJob = await queueService.queueEmail({
						...testData,
						to: "test@example.com",
						subject: "Test Email",
						html: "<p>Test email content</p>",
					});
					break;
				case "filter":
					testJob = await queueService.queueFilterPolling({
						...testData,
						filterId: 999999,
					});
					break;
				default:
					res.status(400).json({
						error:
							"Invalid jobType. Must be one of: attachment, notification, email, filter",
					});
					return;
			}

			loggingService.info("Priority test job created", {
				adminUserId: req.user?.id,
				testUserId: userId,
				tier,
				jobType,
				jobId: testJob.id,
				priority: jobOptions.priority,
			});

			res.json({
				success: true,
				data: {
					testJob: {
						id: testJob.id,
						name: testJob.name,
						data: testJob.data as Record<string, unknown>,
						opts: testJob.opts,
						priority: jobOptions.priority,
						delay: jobOptions.delay,
						attempts: jobOptions.attempts,
					},
					userTierInfo,
					jobOptions,
					message: `Test ${jobType} job created with ${tier} priority`,
				},
			});
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error : new Error(String(error));
			loggingService.logUserError(
				"test_queue_priority",
				req.user?.id ?? "",
				req.user?.role ?? "unknown",
				errorMessage
			);
			res.status(500).json({ error: "Failed to create test priority job" });
		}
	}
);

export default router;
