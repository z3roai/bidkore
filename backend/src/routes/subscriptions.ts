import { SubscriptionStatus } from "@/models/prisma";
import { type Response, Router } from "express";

import {
  type AuthRequest,
  authenticateToken,
  requireAdmin,
} from "../middleware/auth";
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
} from "../schemas/subscription";

import { requireEmailVerification } from "@/middleware/emailVerification";
import { validateRequest } from "@/middleware/validation";
import Subscription from "@/models/Subscription";
import User, { UserRole } from "@/models/User";
import loggingService from "@/services/loggingService";

const router = Router();

// Get user's subscription
router.get(
  "/me",
  authenticateToken,
  requireEmailVerification,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const subscription = await Subscription.findOne({
        where: { userId: req.user.id },
      });

      if (!subscription) {
        // Create default free subscription if none exists
        const freeSubscription = await Subscription.create({
          user: { connect: { id: req.user.id } },
          planId: "free-plan",
          planType: "free",
          status: SubscriptionStatus.ACTIVE,
          startDate: new Date(),
          autoRenew: false,
          price: 0,
          currency: "USD",
          features: {
            maxFilters: 3,
            maxTeams: 0,
            attachmentDownloads: false,
            prioritySupport: false,
            apiAccess: false,
          },
        });

        res.json({
          subscription: {
            id: freeSubscription.id,
            userId: freeSubscription.userId,
            planType: freeSubscription.planType,
            status: freeSubscription.status,
            startDate: freeSubscription.startDate,
            endDate: freeSubscription.endDate,
            autoRenew: freeSubscription.autoRenew,
            price: freeSubscription.price,
            currency: freeSubscription.currency,
            paymentMethod: freeSubscription.paymentMethod,
            lastPaymentDate: freeSubscription.lastPaymentDate,
            nextPaymentDate: freeSubscription.nextPaymentDate,
            features: freeSubscription.features,
            createdAt: freeSubscription.createdAt,
            updatedAt: freeSubscription.updatedAt,
          },
        });
        return;
      }

      res.json({
        subscription: {
          id: subscription.id,
          userId: subscription.userId,
          planType: subscription.planType,
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          autoRenew: subscription.autoRenew,
          price: subscription.price,
          currency: subscription.currency,
          paymentMethod: subscription.paymentMethod,
          lastPaymentDate: subscription.lastPaymentDate,
          nextPaymentDate: subscription.nextPaymentDate,
          features: subscription.features,
          createdAt: subscription.createdAt,
          updatedAt: subscription.updatedAt,
        },
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error : new Error(String(error));
      loggingService.logUserError(
        "get_subscription",
        req.user?.id ?? "",
        req.user?.role ?? "unknown",
        errorMessage
      );
      res.status(500).json({ error: "Failed to get subscription" });
    }
  }
);

// Get all subscriptions (admin only)
router.get(
  "/",
  authenticateToken,
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const subscriptions = await Subscription.findAll({
        orderBy: { createdAt: "desc" },
      });

      // Get user data for each subscription
      const subscriptionsWithUsers = await Promise.all(
        subscriptions.map(async (sub) => {
          const user = await User.findOne({ where: { id: sub.userId } });
          return {
            id: sub.id,
            userId: sub.userId,
            planType: sub.planType,
            status: sub.status,
            startDate: sub.startDate,
            endDate: sub.endDate,
            autoRenew: sub.autoRenew,
            price: sub.price,
            currency: sub.currency,
            paymentMethod: sub.paymentMethod,
            lastPaymentDate: sub.lastPaymentDate,
            nextPaymentDate: sub.nextPaymentDate,
            features: sub.features,
            createdAt: sub.createdAt,
            updatedAt: sub.updatedAt,
            user: user
              ? {
                  id: user.id,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  email: user.email,
                }
              : null,
          };
        })
      );

      res.json({
        subscriptions: subscriptionsWithUsers,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error : new Error(String(error));
      loggingService.logUserError(
        "get_all_subscriptions",
        req.user?.id ?? "",
        req.user?.role ?? "unknown",
        errorMessage
      );
      res.status(500).json({ error: "Failed to get subscriptions" });
    }
  }
);

// Create subscription (admin only)
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  validateRequest(createSubscriptionSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const {
        userId,
        planType,
        price,
        currency = "USD",
        paymentMethod,
        features,
      } = req.body as {
        userId: string;
        planType: string;
        price: number;
        currency?: string;
        paymentMethod: string;
        features: string[];
      };

      // Check if user exists
      const user = await User.findByPk(userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Check if user already has an active subscription
      const existingSubscription = await Subscription.findOne({
        where: { userId, status: SubscriptionStatus.ACTIVE },
      });

      if (existingSubscription) {
        res
          .status(409)
          .json({ error: "User already has an active subscription" });
        return;
      }

      // Set default features based on plan type
      const defaultFeatures = {
        free: {
          maxFilters: 3,
          maxTeams: 0,
          attachmentDownloads: false,
          prioritySupport: false,
          apiAccess: false,
        },
        premium: {
          maxFilters: 50,
          maxTeams: 5,
          attachmentDownloads: true,
          prioritySupport: true,
          apiAccess: true,
        },
        enterprise: {
          maxFilters: -1,
          maxTeams: -1,
          attachmentDownloads: true,
          prioritySupport: true,
          apiAccess: true,
          customFeatures: true,
        },
      };

      const subscription = await Subscription.create({
        user: { connect: { id: userId } },
        planId: `${planType}-plan`,
        planType,
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date(),
        autoRenew: false,
        price,
        currency,
        paymentMethod,
        features:
          features ?? defaultFeatures[planType as keyof typeof defaultFeatures],
      });

      // Update user role based on subscription
      let userRole: UserRole;
      if (planType === "free") {
        userRole = UserRole.FREE;
      } else if (planType === "enterprise") {
        userRole = UserRole.ENTERPRISE;
      } else {
        userRole = UserRole.PREMIUM;
      }
      await User.update({ role: userRole }, { where: { id: userId } });

      if (req.user) {
        loggingService.logUserAction(
          "create_subscription",
          req.user.id,
          req.user.role,
          {
            subscriptionId: subscription.id,
            userId,
            planType,
          }
        );
      }

      res.status(201).json({
        message: "Subscription created successfully",
        subscription: {
          id: subscription.id,
          userId: subscription.userId,
          planType: subscription.planType,
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          autoRenew: subscription.autoRenew,
          price: subscription.price,
          currency: subscription.currency,
          paymentMethod: subscription.paymentMethod,
          features: subscription.features,
          createdAt: subscription.createdAt,
        },
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error : new Error(String(error));
      loggingService.logUserError(
        "create_subscription",
        req.user?.id ?? "",
        req.user?.role ?? "unknown",
        errorMessage
      );
      res.status(500).json({ error: "Failed to create subscription" });
    }
  }
);

// Update subscription
router.put(
  "/:id",
  authenticateToken,
  validateRequest(updateSubscriptionSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const subscriptionId = req.params["id"];
      if (!subscriptionId) {
        res.status(400).json({ error: "Invalid subscription ID" });
        return;
      }

      const subscription = await Subscription.findByPk(subscriptionId);
      if (!subscription) {
        res.status(404).json({ error: "Subscription not found" });
        return;
      }

      // Check if user can update this subscription
      const canUpdate =
        req.user.role === "ADMIN" || subscription.userId === req.user.id;
      if (!canUpdate) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      await Subscription.update(req.body, { where: { id: subscriptionId } });

      // Get updated subscription for response
      const updatedSubscription = await Subscription.findOne({
        where: { id: subscriptionId },
      });
      if (!updatedSubscription) {
        res.status(404).json({ error: "Subscription not found" });
        return;
      }

      // Update user role if plan type changed
      const { planType: newPlanType } = req.body as { planType?: string };
      if (newPlanType) {
        let userRole: UserRole;
        if (newPlanType === "free") {
          userRole = UserRole.FREE;
        } else if (newPlanType === "enterprise") {
          userRole = UserRole.ENTERPRISE;
        } else {
          userRole = UserRole.PREMIUM;
        }
        await User.update(
          { role: userRole },
          { where: { id: subscription.userId } }
        );
      }

      loggingService.logUserAction(
        "update_subscription",
        req.user.id,
        req.user.role,
        {
          subscriptionId,
          updates: req.body as Record<string, unknown>,
        }
      );

      res.json({
        message: "Subscription updated successfully",
        subscription: {
          id: updatedSubscription.id,
          userId: updatedSubscription.userId,
          planType: updatedSubscription.planType,
          status: updatedSubscription.status,
          startDate: updatedSubscription.startDate,
          endDate: updatedSubscription.endDate,
          autoRenew: updatedSubscription.autoRenew,
          price: updatedSubscription.price,
          currency: updatedSubscription.currency,
          paymentMethod: updatedSubscription.paymentMethod,
          lastPaymentDate: updatedSubscription.lastPaymentDate,
          nextPaymentDate: updatedSubscription.nextPaymentDate,
          features: updatedSubscription.features,
          updatedAt: updatedSubscription.updatedAt,
        },
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error : new Error(String(error));
      loggingService.logUserError(
        "update_subscription",
        req.user?.id ?? "",
        req.user?.role ?? "unknown",
        errorMessage
      );
      res.status(500).json({ error: "Failed to update subscription" });
    }
  }
);

// Cancel subscription
router.post(
  "/:id/cancel",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const subscriptionId = req.params["id"];
      if (!subscriptionId) {
        res.status(400).json({ error: "Invalid subscription ID" });
        return;
      }

      const subscription = await Subscription.findByPk(subscriptionId);
      if (!subscription) {
        res.status(404).json({ error: "Subscription not found" });
        return;
      }

      // Check if user can cancel this subscription
      const canCancel =
        req.user.role === "ADMIN" || subscription.userId === req.user.id;
      if (!canCancel) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      await Subscription.update(
        {
          status: SubscriptionStatus.CANCELED,
          autoRenew: false,
        },
        { where: { id: subscriptionId } }
      );

      // Downgrade user to free plan
      await User.update(
        { role: UserRole.FREE },
        { where: { id: subscription.userId } }
      );

      loggingService.logUserAction(
        "cancel_subscription",
        req.user.id,
        req.user.role,
        { subscriptionId }
      );

      res.json({
        message: "Subscription cancelled successfully",
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error : new Error(String(error));
      loggingService.logUserError(
        "cancel_subscription",
        req.user?.id ?? "",
        req.user?.role ?? "unknown",
        errorMessage
      );
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  }
);

// Get subscription features
router.get(
  "/features/:planType",
  authenticateToken,
  (req: AuthRequest, res: Response): void => {
    try {
      const { planType } = req.params;

      const features = {
        free: {
          maxFilters: 3,
          maxTeams: 0,
          attachmentDownloads: false,
          prioritySupport: false,
          apiAccess: false,
          price: 0,
        },
        premium: {
          maxFilters: 50,
          maxTeams: 5,
          attachmentDownloads: true,
          prioritySupport: true,
          apiAccess: true,
          price: 29.99,
        },
        enterprise: {
          maxFilters: -1, // unlimited
          maxTeams: -1, // unlimited
          attachmentDownloads: true,
          prioritySupport: true,
          apiAccess: true,
          customFeatures: true,
          price: 99.99,
        },
      };

      const planFeatures = features[planType as keyof typeof features];
      if (!planFeatures) {
        res.status(400).json({ error: "Invalid plan type" });
        return;
      }

      res.json({
        planType,
        features: planFeatures,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error : new Error(String(error));
      loggingService.logUserError(
        "get_subscription_features",
        req.user?.id ?? "",
        req.user?.role ?? "unknown",
        errorMessage
      );
      res.status(500).json({ error: "Failed to get subscription features" });
    }
  }
);

export default router;
