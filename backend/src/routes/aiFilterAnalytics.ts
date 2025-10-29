import { type Response, Router } from "express";

import { type AuthRequest, authenticateToken } from "@/middleware/auth";
import { requireEnterprisePlan } from "@/middleware/requireEnterprisePlan";
import Filter from "@/models/Filter";
import aiFilterMonitoringService from "@/services/aiFilterMonitoringService";
import loggingService from "@/services/loggingService";

const router = Router();

// Get AI filter performance report (Enterprise only)
router.get(
	"/performance-report",
	authenticateToken,
	requireEnterprisePlan,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			// Get all filters for the user/team
			const filters = await Filter.findAll({
				where: { userId: req.user.id },
				include: {
					user: true,
					team: true,
				},
			});

			const report =
				aiFilterMonitoringService.generatePerformanceReport(filters);

			res.json({
				report,
				generatedAt: new Date().toISOString(),
				userRole: req.user.role,
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"get_performance_report",
				String(req.user?.id ?? 0),
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to generate performance report" });
		}
	}
);

// Get AI filter consistency validation
router.get(
	"/consistency-check",
	authenticateToken,
	requireEnterprisePlan,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			// Get all filters for the user/team
			const filters = await Filter.findAll({
				where: { userId: req.user.id },
				include: {
					user: true,
					team: true,
				},
			});

			const validation =
				aiFilterMonitoringService.validateAIFilterConsistency(filters);

			res.json({
				validation,
				checkedAt: new Date().toISOString(),
				totalFiltersChecked: filters.length,
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"get_consistency_check",
				String(req.user?.id ?? 0),
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to perform consistency check" });
		}
	}
);

// Get individual filter metrics
router.get(
	"/:id/metrics",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const filterId = parseInt(req.params["id"] ?? "0", 10);

			const filter = await Filter.findOne({
				where: {
					id: String(filterId),
					userId: req.user.id,
				},
			});

			if (!filter) {
				res.status(404).json({ error: "Filter not found" });
				return;
			}

			const metrics = aiFilterMonitoringService.collectAIFilterMetrics(filter);

			res.json({
				metrics,
				generatedAt: new Date().toISOString(),
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"get_filter_metrics",
				String(req.user?.id ?? 0),
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to get filter metrics" });
		}
	}
);

export default router;
