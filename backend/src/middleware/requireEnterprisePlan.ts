import { SubscriptionStatus } from "@/models/prisma";
import type { NextFunction, Response } from "express";

import type { AuthRequest } from "@/middleware/auth";
import Subscription from "@/models/Subscription";
import loggingService from "@/services/loggingService";

/**
 * Middleware to require Enterprise plan for team creation and management
 * Checks if the authenticated user has an active Enterprise subscription
 */
export const requireEnterprisePlan = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    // Check if user has enterprise role (admin users also have access)
    const hasEnterpriseRole = ["enterprise", "admin"].includes(
      req.user.role.toLowerCase()
    );

    if (hasEnterpriseRole) {
      loggingService.debug("Enterprise plan validation passed via user role", {
        userId: req.user.id,
        userRole: req.user.role,
        action: (req.route as { path?: string }).path ?? req.path,
      });
      next();
      return;
    }

    // Check for active Enterprise subscription
    const subscription = await Subscription.findOne({
      where: {
        userId: req.user.id,
        status: SubscriptionStatus.ACTIVE,
        planType: "enterprise",
      },
    });

    if (!subscription) {
      // Get current subscription for upgrade prompt
      const currentSubscription = await Subscription.findOne({
        where: {
          userId: req.user.id,
          status: SubscriptionStatus.ACTIVE,
        },
      });

      loggingService.warn("Enterprise plan required for team creation", {
        userId: req.user.id,
        userRole: req.user.role,
        currentPlan: currentSubscription?.planType ?? "free",
        action: (req.route as { path?: string }).path ?? req.path,
        subscriptionExists: Boolean(currentSubscription),
      });

      res.status(403).json({
        error: "Enterprise plan required for team creation and management",
        upgradeRequired: true,
        currentPlan: currentSubscription?.planType ?? "free",
        requiredPlan: "enterprise",
        features: {
          teamCreation: true,
          advancedRoles: true,
          teamChat: true,
          bulkInvitations: true,
          teamAnalytics: true,
        },
      });
      return;
    }

    // Check if subscription is not expired
    if (subscription.endDate && new Date() > subscription.endDate) {
      loggingService.warn("Enterprise subscription expired", {
        userId: req.user.id,
        endDate: subscription.endDate,
      });

      res.status(403).json({
        error: "Enterprise subscription has expired",
        upgradeRequired: true,
        currentPlan: "expired",
        requiredPlan: "enterprise",
      });
      return;
    }

    // Add subscription info to request for use in route handlers
    req.subscription = subscription;

    loggingService.debug("Enterprise plan validation passed", {
      userId: req.user.id,
      planType: subscription.planType,
      features: subscription.features,
    });

    next();
  } catch (error: unknown) {
    loggingService.error("Enterprise plan validation error:", error);
    res.status(500).json({ error: "Plan validation failed" });
  }
};

/**
 * Middleware to check if user can create teams (Enterprise plan or admin)
 */
export const canCreateTeams = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    // Admin users can always create teams
    if (req.user.role === "ADMIN") {
      next();
      return;
    }

    // Check for active Enterprise subscription
    const subscription = await Subscription.findOne({
      where: {
        userId: req.user.id,
        status: SubscriptionStatus.ACTIVE,
        planType: "enterprise",
      },
    });

    if (!subscription) {
      res.status(403).json({
        error: "Enterprise plan required to create teams",
        upgradeRequired: true,
        currentPlan: "free",
      });
      return;
    }

    next();
  } catch (error: unknown) {
    loggingService.error("Team creation permission check error:", error);
    res.status(500).json({ error: "Permission check failed" });
  }
};

/**
 * Helper function to check if user has Enterprise features
 */
export const hasEnterpriseFeatures = async (
  userId: string
): Promise<boolean> => {
  try {
    const subscription = await Subscription.findOne({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        planType: "enterprise",
      },
    });

    return (
      Boolean(subscription) &&
      (!subscription?.endDate || new Date() <= subscription.endDate)
    );
  } catch (error) {
    loggingService.error("Enterprise features check error:", error);
    return false;
  }
};
