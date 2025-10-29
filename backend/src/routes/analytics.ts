import { type Request, type Response, Router } from "express";

import { authenticateToken } from "@/middleware/auth";
import loggingService from "@/services/loggingService";

const router = Router();

interface PageViewData {
  page: string;
  title: string;
  path: string;
  userId: string;
  userRole: string;
  sessionId: string;
}

// Page view tracking endpoint
export const trackPageView = (req: Request, res: Response): void => {
  try {
    const { page, title, path, userId, userRole, sessionId }: PageViewData =
      req.body as PageViewData;

    // Log the page view
    loggingService.info("Page view tracked", {
      page,
      title,
      path,
      userId,
      userRole,
      sessionId,
    });

    res.status(200).json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to track page view" });
  }
};

interface InteractionData {
  page: string;
  action: string;
  userId: string;
  userRole: string;
  timeSpent: number;
}

// Page interaction tracking endpoint
export const trackInteraction = (req: Request, res: Response): void => {
  try {
    const { page, action, userId, userRole, timeSpent }: InteractionData =
      req.body as InteractionData;

    // Log the interaction
    loggingService.info("Page interaction tracked", {
      page,
      action,
      userId,
      userRole,
      timeSpent,
    });

    res.status(200).json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to track interaction" });
  }
};

interface EventData {
  page: string;
  event: string;
  properties: Record<string, unknown>;
  userId: string;
  userRole: string;
}

// Custom event tracking endpoint
export const trackEvent = (req: Request, res: Response): void => {
  try {
    const { page, event, properties, userId, userRole }: EventData =
      req.body as EventData;

    // Log the event
    loggingService.info("Custom event tracked", {
      page,
      event,
      userId,
      userRole,
      properties,
    });

    res.status(200).json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to track event" });
  }
};

interface SessionData {
  userId: string;
  userRole: string;
  sessionId: string;
  duration: number;
  isNewSession: boolean;
}

// Session tracking endpoint
export const trackSession = (req: Request, res: Response): void => {
  try {
    const { userId, userRole, sessionId, duration, isNewSession }: SessionData =
      req.body as SessionData;

    // Log the session
    loggingService.info("Session tracked", {
      userId,
      userRole,
      sessionId,
      duration,
      isNewSession,
    });

    res.status(200).json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to track session" });
  }
};

// Dashboard metrics endpoint
export const getDashboardMetrics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // TODO: Replace with actual database queries
    // This is a placeholder that returns mock structure
    const metrics = {
      newOpportunities: {
        value: 0,
        change: 0,
        changeType: "positive" as const,
      },
      proposals: {
        value: 0,
        change: 0,
        changeType: "positive" as const,
      },
      due30Days: {
        value: 0,
        change: 0,
        changeType: "negative" as const,
      },
      winRate: {
        value: 0,
        change: 0,
        changeType: "positive" as const,
      },
      tcv: {
        value: 0,
        change: 0,
        changeType: "positive" as const,
      },
    };

    res.status(200).json({ metrics });
  } catch (error) {
    loggingService.error("Failed to fetch dashboard metrics:", error);
    res.status(500).json({ error: "Failed to fetch dashboard metrics" });
  }
};

// Recent activities endpoint
export const getRecentActivities = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const _limit = Number.parseInt(req.query.limit as string) || 10;

    // TODO: Replace with actual database queries
    const activities: Array<{
      id: string;
      type: string;
      description: string;
      timestamp: string;
    }> = [];

    res.status(200).json({ activities });
  } catch (error) {
    loggingService.error("Failed to fetch recent activities:", error);
    res.status(500).json({ error: "Failed to fetch recent activities" });
  }
};

// Upcoming events endpoint
export const getUpcomingEvents = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const _limit = Number.parseInt(req.query.limit as string) || 10;

    // TODO: Replace with actual database queries
    const events: Array<{
      id: string;
      title: string;
      time: string;
      timestamp: string;
    }> = [];

    res.status(200).json({ events });
  } catch (error) {
    loggingService.error("Failed to fetch upcoming events:", error);
    res.status(500).json({ error: "Failed to fetch upcoming events" });
  }
};

// TCV data endpoint
export const getTCVData = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const period = (req.query.period as string) || "monthly";

    // TODO: Replace with actual database queries
    const tcvData: Array<{
      period: string;
      value: number;
      isHighlighted?: boolean;
    }> = [];

    res.status(200).json({ period, data: tcvData });
  } catch (error) {
    loggingService.error("Failed to fetch TCV data:", error);
    res.status(500).json({ error: "Failed to fetch TCV data" });
  }
};

// Define routes
router.post("/track/page-view", trackPageView);
router.post("/track/interaction", trackInteraction);
router.post("/track/event", trackEvent);
router.post("/track/session", trackSession);

// Dashboard data routes (protected)
router.get("/dashboard/metrics", authenticateToken, getDashboardMetrics);
router.get("/dashboard/activities", authenticateToken, getRecentActivities);
router.get("/dashboard/events", authenticateToken, getUpcomingEvents);
router.get("/dashboard/tcv", authenticateToken, getTCVData);

export default router;
