import { type Response, Router } from "express";

import { type AuthRequest, authenticateToken } from "@/middleware/auth";

const router = Router();

// Minimal endpoint for quick inspection: /api/logs/usaspending?limit=50
router.get(
	"/usaspending",
	authenticateToken,
	(_req: AuthRequest, res: Response): void => {
		try {
			const logs: unknown[] = []; // redisJsonLogger removed
			res.json({ service: "usaspending", count: logs.length, logs });
		} catch {
			res.status(500).json({ error: "Failed to retrieve logs" });
		}
	},
);

export default router;
