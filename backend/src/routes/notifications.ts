import { SubscriptionStatus } from "@/models/prisma";
import { type Response, Router } from "express";

import { type AuthRequest, authenticateToken } from "@/middleware/auth";
import Notification from "@/models/Notification";
import Subscription from "@/models/Subscription";
import User from "@/models/User";
import loggingService from "@/services/loggingService";

const router = Router();

// Notification feature access based on subscription plan
interface NotificationFeatureAccess {
  canMarkAsRead: boolean;
  canDelete: boolean;
  canMarkAllAsRead: boolean;
  // Feature-based notification types that user can see
  allowedNotificationTypes: string[];
}

// Get user's notification feature access based on their subscription
async function getUserNotificationAccess(
  userId: string
): Promise<NotificationFeatureAccess> {
  const user = await User.findByPk(userId);
  if (!user) {
    return {
      canMarkAsRead: true,
      canDelete: false,
      canMarkAllAsRead: false,
      allowedNotificationTypes: [
        "system_update",
        "payment_success",
        "subscription_expiring",
      ],
    };
  }

  // Check if user has premium role
  const hasPremiumRole = ["premium", "enterprise", "admin"].includes(
    user.role?.toLowerCase() || user.role
  );

  // Check active subscription
  const currentSubscription = await Subscription.findOne({
    where: { userId, status: SubscriptionStatus.ACTIVE },
  });

  const isPremium =
    hasPremiumRole ||
    (currentSubscription && currentSubscription.planType !== "free");
  const isEnterprise =
    user.role?.toLowerCase() === "enterprise" ||
    user.role?.toLowerCase() === "admin" ||
    (currentSubscription && currentSubscription.planType === "enterprise");

  // Define notification types based on features
  const baseNotificationTypes = [
    "system_update",
    "payment_success",
    "subscription_expiring",
    "password_change_reminder",
  ];

  const premiumNotificationTypes = [
    ...baseNotificationTypes,
    "opportunity_found", // Premium users can create filters and get opportunity notifications
    "filter_created", // Premium users can create custom filters
    "search_completed", // Premium users have advanced search
  ];

  const enterpriseNotificationTypes = [
    ...premiumNotificationTypes,
    "member_joined", // Enterprise users can create teams
    "member_left", // Enterprise users can manage team members
    "team_invitation", // Enterprise users can invite team members
    "message_sent", // Enterprise users have team chat
  ];

  return {
    canMarkAsRead: true, // All users can mark as read
    canDelete: true, // All users can delete their notifications
    canMarkAllAsRead: true, // All users can mark all as read
    allowedNotificationTypes: isEnterprise
      ? enterpriseNotificationTypes
      : isPremium
      ? premiumNotificationTypes
      : baseNotificationTypes,
  };
}

// List notifications for current user - Available to all users with feature-based filtering
router.get(
  "/",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const access = await getUserNotificationAccess(req.user.id);

      const {
        page = "1",
        limit = "20",
        onlyUnread,
        status,
        type,
      } = req.query as Record<string, string>;

      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause with feature-based filtering
      const where: {
        userId: string;
        isRead?: boolean;
        type?: string | { in: string[] };
      } = {
        userId: req.user.id,
      };

      // Filter by notification types the user has access to
      where.type = { in: access.allowedNotificationTypes };

      if (onlyUnread === "true") {
        where.isRead = false;
      }
      if (status === "unread") {
        where.isRead = false;
      }
      if (status === "read") {
        where.isRead = true;
      }
      if (typeof type === "string" && type.trim().length > 0) {
        // If user requests a specific type, check if they have access to it
        if (access.allowedNotificationTypes.includes(type.trim())) {
          where.type = type.trim();
        } else {
          // User doesn't have access to this notification type
          res.json({
            notifications: [],
            pagination: {
              page: pageNum,
              limit: limitNum,
              total: 0,
              totalPages: 0,
            },
            access: {
              canDelete: access.canDelete,
              canMarkAllAsRead: access.canMarkAllAsRead,
              allowedTypes: access.allowedNotificationTypes,
            },
            upgradeRequired: true,
            message: `Notification type '${type}' requires premium subscription`,
          });
          return;
        }
      }

      const { rows, count } = await Notification.findAndCountAll({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      });

      res.json({
        notifications: rows,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count,
          totalPages: Math.ceil(count / limitNum),
        },
        access: {
          canDelete: access.canDelete,
          canMarkAllAsRead: access.canMarkAllAsRead,
          allowedTypes: access.allowedNotificationTypes,
        },
      });
    } catch (error) {
      loggingService.error("Failed to list notifications", error);
      res.status(500).json({ error: "Failed to list notifications" });
    }
  }
);

// Unread count - Available to all users with feature-based filtering
router.get(
  "/unread-count",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const access = await getUserNotificationAccess(req.user.id);

      // Count only notifications the user has access to
      const whereClause: {
        userId: string;
        isRead: boolean;
        type: { in: string[] };
      } = {
        userId: req.user.id,
        isRead: false,
        type: { in: access.allowedNotificationTypes },
      };

      const count = await Notification.count({
        where: whereClause,
      });

      res.json({
        unread: count,
        access: {
          canDelete: access.canDelete,
          canMarkAllAsRead: access.canMarkAllAsRead,
          allowedTypes: access.allowedNotificationTypes,
        },
      });
    } catch (error) {
      loggingService.error("Failed to get unread count", error);
      res.status(500).json({ error: "Failed to get unread count" });
    }
  }
);

// Mark one as read - Available to all users
router.post(
  "/:id/read",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const access = await getUserNotificationAccess(req.user.id);

      if (!access.canMarkAsRead) {
        res.status(403).json({
          error: "Mark as read not available for your plan",
          upgradeRequired: true,
          requiredPlan: "premium",
        });
        return;
      }

      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: "Notification ID is required" });
        return;
      }

      const notification = await Notification.findByPk(id);
      if (!notification || notification.userId !== req.user.id) {
        res.status(404).json({ error: "Notification not found" });
        return;
      }

      // Check if user has access to this notification type
      if (!access.allowedNotificationTypes.includes(notification.type)) {
        res.status(403).json({
          error: "You don't have access to this notification type",
          upgradeRequired: true,
          requiredPlan: "premium",
        });
        return;
      }

      await Notification.update({ isRead: true }, { where: { id } });
      res.json({ message: "Marked as read" });
    } catch (error) {
      loggingService.error("Failed to mark notification as read", error);
      res.status(500).json({ error: "Failed to mark as read" });
    }
  }
);

// Mark all as read - Available to all users
router.post(
  "/read-all",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const access = await getUserNotificationAccess(req.user.id);

      if (!access.canMarkAllAsRead) {
        res.status(403).json({
          error: "Mark all as read not available for your plan",
          upgradeRequired: true,
          requiredPlan: "premium",
        });
        return;
      }

      // Mark all as read only for notification types the user has access to
      await Notification.updateMany(
        { isRead: true },
        {
          where: {
            userId: req.user.id,
            isRead: false,
            type: { in: access.allowedNotificationTypes },
          },
        }
      );
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      loggingService.error("Failed to mark all as read", error);
      res.status(500).json({ error: "Failed to mark all as read" });
    }
  }
);

// Delete a notification - Available to all users
router.delete(
  "/:id",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const access = await getUserNotificationAccess(req.user.id);

      if (!access.canDelete) {
        res.status(403).json({
          error: "Delete notifications not available for your plan",
          upgradeRequired: true,
          requiredPlan: "premium",
        });
        return;
      }

      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: "Notification ID is required" });
        return;
      }

      const notification = await Notification.findByPk(id);
      if (!notification || notification.userId !== req.user.id) {
        res.status(404).json({ error: "Notification not found" });
        return;
      }

      // Check if user has access to this notification type
      if (!access.allowedNotificationTypes.includes(notification.type)) {
        res.status(403).json({
          error: "You don't have access to this notification type",
          upgradeRequired: true,
          requiredPlan: "premium",
        });
        return;
      }

      await Notification.delete({ where: { id } });
      res.json({ message: "Notification deleted" });
    } catch (error) {
      loggingService.error("Failed to delete notification", error);
      res.status(500).json({ error: "Failed to delete notification" });
    }
  }
);

export default router;
