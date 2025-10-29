import { SubscriptionStatus } from "@/models/prisma";
import type { NextFunction, Response } from "express";

import type { AuthRequest } from "@/middleware/auth";
import Subscription from "@/models/Subscription";
import User from "@/models/User";
import loggingService from "@/services/loggingService";

/**
 * Middleware to require Premium plan for attachment downloads and access
 * Checks if the authenticated user has an active Premium or Enterprise subscription
 */
export const requirePremiumAttachmentAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    // Check if user has premium role (admin users also have access)
    const hasPremiumRole = ["premium", "enterprise", "admin"].includes(
      req.user.role
    );

    if (!hasPremiumRole) {
      // Get current subscription for upgrade prompt
      const currentSubscription = await Subscription.findOne({
        where: {
          userId: req.user.id,
          status: SubscriptionStatus.ACTIVE,
        },
      });

      loggingService.warn("Premium plan required for attachment access", {
        userId: req.user.id,
        currentRole: req.user.role,
        currentPlan: currentSubscription?.planType ?? "free",
        action: (req.route as { path?: string } | undefined)?.path ?? req.path,
      });

      res.status(403).json({
        error: "Premium subscription required for attachment downloads",
        upgradeRequired: true,
        currentPlan: currentSubscription?.planType ?? "free",
        requiredPlan: "premium",
        features: {
          attachmentDownloads: true,
          fileAccess: true,
          prioritySupport: true,
          advancedFilters: true,
        },
        upgradeUrl: "/billing/upgrade",
      });
      return;
    }

    // Check for active Premium/Enterprise subscription
    const subscription = await Subscription.findOne({
      where: {
        userId: req.user.id,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (!subscription) {
      loggingService.warn("No active subscription found for premium user", {
        userId: req.user.id,
        role: req.user.role,
      });

      res.status(403).json({
        error: "Active subscription required for attachment access",
        upgradeRequired: true,
        currentPlan: "none",
        requiredPlan: "premium",
      });
      return;
    }

    // Check if subscription is not expired
    if (subscription.endDate && new Date() > subscription.endDate) {
      loggingService.warn("Premium subscription expired", {
        userId: req.user.id,
        endDate: subscription.endDate,
      });

      res.status(403).json({
        error: "Premium subscription has expired",
        upgradeRequired: true,
        currentPlan: "expired",
        requiredPlan: "premium",
      });
      return;
    }

    // Add subscription info to request for use in route handlers
    req.subscription = subscription;

    loggingService.debug("Premium attachment access validation passed", {
      userId: req.user.id,
      role: req.user.role,
      planType: subscription.planType,
      features: subscription.features,
    });

    next();
  } catch (error: unknown) {
    loggingService.error("Premium attachment access validation error:", error);
    res.status(500).json({ error: "Access validation failed" });
  }
};

/**
 * Helper function to check if user has Premium attachment access
 */
export const hasPremiumAttachmentAccess = async (
  userId: string
): Promise<boolean> => {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return false;
    }

    // Check premium role
    const hasPremiumRole = ["premium", "enterprise", "admin"].includes(
      user.role
    );
    if (!hasPremiumRole) {
      return false;
    }

    // Check active subscription
    const subscription = await Subscription.findOne({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (!subscription) {
      return false;
    }

    // Check if not expired
    if (subscription.endDate && new Date() > subscription.endDate) {
      return false;
    }

    return true;
  } catch (error) {
    loggingService.error("Premium attachment access check error:", error);
    return false;
  }
};

/**
 * Optional premium attachment access - returns user access status without blocking
 */
export const optionalPremiumAttachmentAccess = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      req.premiumAttachmentAccess = false;
      next();
      return;
    }

    const hasAccess = await hasPremiumAttachmentAccess(req.user.id);
    req.premiumAttachmentAccess = hasAccess;

    if (hasAccess) {
      const subscription = await Subscription.findOne({
        where: {
          userId: req.user.id,
          status: SubscriptionStatus.ACTIVE,
        },
      });
      if (subscription) {
        req.subscription = subscription;
      }
    }

    next();
  } catch (error) {
    loggingService.error(
      "Optional premium attachment access check error:",
      error
    );
    req.premiumAttachmentAccess = false;
    next();
  }
};

// Extend Request interface to include premium attachment access flag
declare module "express" {
  interface Request {
    premiumAttachmentAccess?: boolean;
  }
}
