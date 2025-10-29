import { type Prisma } from "@prisma/client";
import { PaymentStatus, SubscriptionStatus } from "@/models/prisma";
import Stripe from "stripe";

import {
  StripeCustomerModel,
  StripePaymentModel,
  StripeSubscriptionModel,
} from "../models/Stripe";

import config from "@/config/env";
import Subscription from "@/models/Subscription";
import User, { UserRole } from "@/models/User";
import emailService from "@/services/emailService";
import loggingService from "@/services/loggingService";

const stripe = new Stripe(config.stripe.secretKey as string, {
  apiVersion: "2023-10-16",
});

export interface CreateCustomerData {
  userId: string;
  email: string;
  name?: string;
}

export interface CreateSubscriptionData {
  userId: string;
  priceId: string;
  trialPeriodDays?: number;
}

export interface CreatePaymentIntentData {
  userId: string;
  amount: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateCheckoutSessionData {
  userId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  allowPromotionCodes?: boolean;
  trialPeriodDays?: number;
}

class StripeService {
  // Customer Management
  async createCustomer(data: CreateCustomerData): Promise<Stripe.Customer> {
    try {
      const customer = await stripe.customers.create({
        email: data.email,
        ...(data.name && { name: data.name }),
        metadata: {
          userId: data.userId,
        },
      });

      await StripeCustomerModel.create({
        user: { connect: { id: data.userId } },
        stripeCustomerId: customer.id,
        email: data.email,
      });

      loggingService.logUserAction(
        "stripe_customer_created",
        data.userId,
        "unknown",
        { customerId: customer.id }
      );

      return customer;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorObj = error instanceof Error ? error : new Error(errorMessage);
      loggingService.logUserError(
        "stripe_customer_creation",
        data.userId,
        "unknown",
        errorObj
      );
      throw new Error(`Failed to create Stripe customer: ${errorMessage}`);
    }
  }

  async getCustomer(userId: string): Promise<Stripe.Customer | null> {
    try {
      const stripeCustomer = await StripeCustomerModel.findOne({
        where: { userId },
      });

      if (!stripeCustomer) {
        return null;
      }

      const customer = await stripe.customers.retrieve(
        stripeCustomer.stripeCustomerId
      );

      if (customer.deleted) {
        return null;
      }

      return customer as Stripe.Customer;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorObj = error instanceof Error ? error : new Error(errorMessage);
      loggingService.logUserError(
        "stripe_customer_retrieve",
        userId,
        "unknown",
        errorObj
      );
      throw new Error(`Failed to retrieve Stripe customer: ${errorMessage}`);
    }
  }

  // Subscription Management
  async createSubscription(
    data: CreateSubscriptionData
  ): Promise<Stripe.Subscription> {
    try {
      let stripeCustomer = await StripeCustomerModel.findOne({
        where: { userId: data.userId },
      });

      if (!stripeCustomer) {
        const user = await User.findByPk(data.userId);
        if (!user) {
          throw new Error("User not found");
        }

        await this.createCustomer({
          userId: data.userId,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
        });

        stripeCustomer = await StripeCustomerModel.findOne({
          where: { userId: data.userId },
        });
      }

      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: stripeCustomer?.stripeCustomerId ?? "",
        items: [{ price: data.priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
      };

      if (data.trialPeriodDays) {
        subscriptionData.trial_period_days = data.trialPeriodDays;
      }

      const subscription = await stripe.subscriptions.create(subscriptionData);

      await StripeSubscriptionModel.create({
        user: { connect: { id: data.userId } },
        stripeSubscriptionId: subscription.id,
        customer: {
          connect: { stripeCustomerId: stripeCustomer?.stripeCustomerId ?? "" },
        },
        status: this.mapStripeStatusToSubscriptionStatus(subscription.status),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        trialStart: subscription.trial_start
          ? new Date(subscription.trial_start * 1000)
          : null,
        trialEnd: subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : null,
      });

      loggingService.logUserAction(
        "stripe_subscription_created",
        data.userId,
        "unknown",
        {
          subscriptionId: subscription.id,
          priceId: data.priceId,
        }
      );

      return subscription;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorObj = error instanceof Error ? error : new Error(errorMessage);
      loggingService.logUserError(
        "stripe_subscription_creation",
        data.userId,
        "unknown",
        errorObj
      );
      throw new Error(`Failed to create subscription: ${errorMessage}`);
    }
  }

  async cancelSubscription(
    userId: string,
    cancelAtPeriodEnd = true
  ): Promise<Stripe.Subscription> {
    try {
      const stripeSubscription = await StripeSubscriptionModel.findOne({
        where: { userId },
      });

      if (!stripeSubscription) {
        throw new Error("Subscription not found");
      }

      const subscription = await stripe.subscriptions.update(
        stripeSubscription.stripeSubscriptionId,
        {
          cancel_at_period_end: cancelAtPeriodEnd,
        }
      );

      await StripeSubscriptionModel.update(
        {
          status: this.mapStripeStatusToSubscriptionStatus(subscription.status),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          canceledAt: cancelAtPeriodEnd ? null : new Date(),
        },
        { where: { id: stripeSubscription.id } }
      );

      loggingService.logUserAction(
        "stripe_subscription_canceled",
        userId,
        "unknown",
        {
          subscriptionId: subscription.id,
          cancelAtPeriodEnd,
        }
      );

      return subscription;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorObj = error instanceof Error ? error : new Error(errorMessage);
      loggingService.logUserError(
        "stripe_subscription_cancel",
        userId,
        "unknown",
        errorObj
      );
      throw new Error(`Failed to cancel subscription: ${errorMessage}`);
    }
  }

  async getSubscription(userId: string): Promise<Stripe.Subscription | null> {
    try {
      const stripeSubscription = await StripeSubscriptionModel.findOne({
        where: { userId },
      });

      if (!stripeSubscription) {
        return null;
      }

      const subscription = await stripe.subscriptions.retrieve(
        stripeSubscription.stripeSubscriptionId
      );
      return subscription;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorObj = error instanceof Error ? error : new Error(errorMessage);
      loggingService.logUserError(
        "stripe_subscription_retrieve",
        userId,
        "unknown",
        errorObj
      );
      throw new Error(`Failed to retrieve subscription: ${errorMessage}`);
    }
  }

  // Payment Intent Management
  async createPaymentIntent(
    data: CreatePaymentIntentData
  ): Promise<Stripe.PaymentIntent> {
    try {
      const stripeCustomer = await StripeCustomerModel.findOne({
        where: { userId: data.userId },
      });

      const paymentIntentData: Stripe.PaymentIntentCreateParams = {
        amount: data.amount,
        currency: data.currency ?? "usd",
        ...(data.description && { description: data.description }),
        metadata: {
          userId: data.userId,
          ...data.metadata,
        },
      };

      if (stripeCustomer) {
        paymentIntentData.customer = stripeCustomer.stripeCustomerId;
      }

      const paymentIntent = await stripe.paymentIntents.create(
        paymentIntentData
      );

      await StripePaymentModel.create({
        user: { connect: { id: data.userId } },
        customer: {
          connect: { stripeCustomerId: stripeCustomer?.stripeCustomerId ?? "" },
        },
        stripePaymentIntentId: paymentIntent.id,
        amount: data.amount,
        currency: data.currency ?? "usd",
        status: paymentIntent.status as PaymentStatus,
        ...(data.description && { description: data.description }),
        metadata: data.metadata as Prisma.InputJsonValue,
      });

      loggingService.logUserAction(
        "stripe_payment_intent_created",
        data.userId,
        "unknown",
        {
          paymentIntentId: paymentIntent.id,
          amount: data.amount,
        }
      );

      return paymentIntent;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorObj = error instanceof Error ? error : new Error(errorMessage);
      loggingService.logUserError(
        "stripe_payment_intent_creation",
        data.userId,
        "unknown",
        errorObj
      );
      throw new Error(`Failed to create payment intent: ${errorMessage}`);
    }
  }

  async createCheckoutSession(
    data: CreateCheckoutSessionData
  ): Promise<Stripe.Checkout.Session> {
    try {
      let stripeCustomer = await StripeCustomerModel.findOne({
        where: { userId: data.userId },
      });

      if (!stripeCustomer) {
        const user = await User.findByPk(data.userId);
        if (!user) {
          throw new Error("User not found");
        }

        await this.createCustomer({
          userId: data.userId,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
        });

        stripeCustomer = await StripeCustomerModel.findOne({
          where: { userId: data.userId },
        });
      }

      const params: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        ...(stripeCustomer?.stripeCustomerId && {
          customer: stripeCustomer.stripeCustomerId,
        }),
        line_items: [
          {
            price: data.priceId,
            quantity: 1,
          },
        ],
        success_url: `${data.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: data.cancelUrl,
        allow_promotion_codes: data.allowPromotionCodes ?? true,
        subscription_data: {},
      };

      if (data.trialPeriodDays) {
        params.subscription_data = {
          ...params.subscription_data,
          trial_period_days: data.trialPeriodDays,
        } as Stripe.Checkout.SessionCreateParams.SubscriptionData;
      }

      const session = await stripe.checkout.sessions.create(params);

      loggingService.logUserAction(
        "stripe_checkout_session_created",
        data.userId,
        "unknown",
        {
          sessionId: session.id,
          priceId: data.priceId,
        }
      );

      return session;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorObj = error instanceof Error ? error : new Error(errorMessage);
      loggingService.logUserError(
        "stripe_checkout_session_creation",
        data.userId,
        "unknown",
        errorObj
      );
      throw new Error(`Failed to create checkout session: ${errorMessage}`);
    }
  }

  // Helper method to map Stripe subscription status to our SubscriptionStatus enum
  private mapStripeStatusToSubscriptionStatus(
    stripeStatus: string
  ): SubscriptionStatus {
    switch (stripeStatus) {
      case "active":
        return SubscriptionStatus.ACTIVE;
      case "canceled":
      case "cancelled":
        return SubscriptionStatus.CANCELED;
      case "past_due":
        return SubscriptionStatus.PAST_DUE;
      case "unpaid":
        return SubscriptionStatus.UNPAID;
      case "incomplete":
        return SubscriptionStatus.INCOMPLETE;
      case "trialing":
        return SubscriptionStatus.TRIALING;
      default:
        loggingService.warn(
          `Unknown Stripe subscription status: ${stripeStatus}, defaulting to INCOMPLETE`
        );
        return SubscriptionStatus.INCOMPLETE;
    }
  }

  // Webhook Handlers
  async handleWebhook(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated":
          await this.handleSubscriptionChange(event.data.object);
          break;

        case "customer.subscription.deleted":
          await this.handleSubscriptionDeleted(event.data.object);
          break;

        case "checkout.session.completed": {
          const session = event.data.object;
          if (session.mode === "subscription" && session.subscription) {
            const subscription = await stripe.subscriptions.retrieve(
              session.subscription as string
            );
            await this.handleSubscriptionChange(subscription);
          }
          break;
        }

        case "payment_intent.succeeded":
          await this.handlePaymentSucceeded(event.data.object);
          break;

        case "payment_intent.payment_failed":
          await this.handlePaymentFailed(event.data.object);
          break;

        case "invoice.payment_succeeded":
          await this.handleInvoicePaymentSucceeded(event.data.object);
          break;

        case "invoice.payment_failed":
          await this.handleInvoicePaymentFailed(event.data.object);
          break;

        default:
          // Handle all other Stripe event types that we don't need to process
          loggingService.info(
            `Received unhandled Stripe event type: ${event.type}`
          );
          break;
      }
    } catch (error: unknown) {
      const errorObj =
        error instanceof Error ? error : new Error("Unknown error");
      loggingService.logJobError("stripe_webhook_handler", "webhook", errorObj);
      throw error;
    }
  }

  private async handleSubscriptionChange(
    subscription: Stripe.Subscription
  ): Promise<void> {
    loggingService.info("Handling subscription change:", subscription);
    // Use subscription's current period fields directly
    const currentPeriodStart = subscription.current_period_start;
    const currentPeriodEnd = subscription.current_period_end;

    let existing = await StripeSubscriptionModel.findOne({
      where: { stripeSubscriptionId: subscription.id },
    });

    // Get customer info for user mapping
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;
    const stripeCustomer = await StripeCustomerModel.findOne({
      where: { stripeCustomerId: customerId },
    });

    if (!stripeCustomer) {
      loggingService.warn(
        `Stripe customer not found for customer ID: ${customerId}`
      );
      return;
    }

    const subscriptionData: Prisma.StripeSubscriptionCreateInput = {
      user: { connect: { id: stripeCustomer.userId } },
      stripeSubscriptionId: subscription.id,
      customer: { connect: { stripeCustomerId: customerId } },
      status: this.mapStripeStatusToSubscriptionStatus(subscription.status),
      currentPeriodStart:
        currentPeriodStart && typeof currentPeriodStart === "number"
          ? new Date(currentPeriodStart * 1000)
          : new Date(),
      currentPeriodEnd:
        currentPeriodEnd && typeof currentPeriodEnd === "number"
          ? new Date(currentPeriodEnd * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default to 30 days from now
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };

    if (
      subscription.trial_start &&
      typeof subscription.trial_start === "number" &&
      subscription.trial_start > 0
    ) {
      subscriptionData.trialStart = new Date(subscription.trial_start * 1000);
      loggingService.info("Added trialStart:", subscriptionData.trialStart);
    }
    if (
      subscription.trial_end &&
      typeof subscription.trial_end === "number" &&
      subscription.trial_end > 0
    ) {
      subscriptionData.trialEnd = new Date(subscription.trial_end * 1000);
      loggingService.info("Added trialEnd:", subscriptionData.trialEnd);
    }

    if (!existing) {
      // Check if user already has a subscription (due to unique constraint on userId)
      const existingByUser = await StripeSubscriptionModel.findOne({
        where: { userId: stripeCustomer.userId },
      });

      if (existingByUser) {
        // Update existing subscription with new Stripe subscription data
        loggingService.info(
          "Updating existing user subscription with new Stripe subscription:",
          subscriptionData
        );
        existing = await StripeSubscriptionModel.update(subscriptionData, {
          where: { id: existingByUser.id },
        });
      } else {
        // Create new subscription record
        loggingService.info(
          "Creating new subscription with data:",
          subscriptionData
        );
        existing = await StripeSubscriptionModel.create(subscriptionData);
      }
    }

    // existing is guaranteed to be truthy at this point
    const updateData: Prisma.StripeSubscriptionUpdateInput = {
      status: this.mapStripeStatusToSubscriptionStatus(subscription.status),
      currentPeriodStart:
        currentPeriodStart && typeof currentPeriodStart === "number"
          ? new Date(currentPeriodStart * 1000)
          : new Date(),
      currentPeriodEnd:
        currentPeriodEnd && typeof currentPeriodEnd === "number"
          ? new Date(currentPeriodEnd * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };

    if (
      subscription.canceled_at &&
      typeof subscription.canceled_at === "number" &&
      subscription.canceled_at > 0
    ) {
      updateData.canceledAt = new Date(subscription.canceled_at * 1000);
    }
    if (
      subscription.trial_start &&
      typeof subscription.trial_start === "number" &&
      subscription.trial_start > 0
    ) {
      updateData.trialStart = new Date(subscription.trial_start * 1000);
    }
    if (
      subscription.trial_end &&
      typeof subscription.trial_end === "number" &&
      subscription.trial_end > 0
    ) {
      updateData.trialEnd = new Date(subscription.trial_end * 1000);
    }

    await StripeSubscriptionModel.update(updateData, {
      where: { id: existing.id },
    });

    // Update user role based on subscription plan type
    if (
      subscription.status === "active" ||
      subscription.status === "trialing"
    ) {
      // Extract plan type from Stripe subscription price metadata
      let planType = "premium"; // default
      if (subscription.items.data.length > 0) {
        const item = subscription.items.data[0];
        const price = item?.price;
        if (price?.metadata) {
          planType =
            price.metadata["plan_type"] ??
            price.metadata["plan"] ??
            price.metadata["tier"] ??
            "premium";
        }
      }

      let userRole: UserRole;
      if (planType === "enterprise") {
        userRole = UserRole.ENTERPRISE;
      } else if (planType === "premium") {
        userRole = UserRole.PREMIUM;
      } else {
        // Default to premium for active Stripe subscriptions
        userRole = UserRole.PREMIUM;
      }

      // Get the user before updating to check for role changes
      const userBeforeUpdate = await User.findByPk(existing.userId);

      await User.update({ role: userRole }, { where: { id: existing.userId } });

      // Send upgrade email if this is a role upgrade
      if (userBeforeUpdate && userBeforeUpdate.role !== userRole) {
        await this.sendUpgradeEmail(userBeforeUpdate, userRole, planType);
      }

      // Create or update the main Subscription record
      await this.createOrUpdateSubscriptionRecord(
        existing.userId,
        subscription,
        planType
      );

      loggingService.info(
        `Updated user role to ${userRole} based on plan type: ${planType}`,
        {
          userId: existing.userId,
          planType,
          userRole,
          subscriptionId: subscription.id,
        }
      );
    }
  }

  private async sendUpgradeEmail(
    user: {
      email: string;
      firstName: string;
      lastName: string;
      role: UserRole;
    },
    newRole: UserRole,
    planType: string
  ): Promise<void> {
    try {
      const oldPlan = this.getPlanNameFromRole(user.role);
      const newPlan = this.getPlanNameFromRole(newRole);
      const features = this.getFeaturesForPlan(planType);
      const dashboardUrl = `${config.urls.frontend}/dashboard`;

      await emailService.sendSubscriptionUpgradeEmail({
        to: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        oldPlan,
        newPlan,
        features,
        dashboardUrl,
      });

      loggingService.info(
        `Upgrade email sent to ${user.email} for ${oldPlan} → ${newPlan}`
      );
    } catch (error: unknown) {
      loggingService.error("Failed to send upgrade email:", error);
      // Don't throw error to avoid breaking the subscription flow
    }
  }

  private getPlanNameFromRole(role: UserRole): string {
    switch (role) {
      case UserRole.FREE:
        return "Free";
      case UserRole.PREMIUM:
        return "Premium";
      case UserRole.ENTERPRISE:
        return "Enterprise";
      case UserRole.ADMIN:
        return "Admin";
      default:
        return "Free";
    }
  }

  private getFeaturesForPlan(planType: string): string[] {
    const featureMap: Record<string, string[]> = {
      premium: [
        "Unlimited SAM.gov opportunity monitoring",
        "Advanced filtering and search capabilities",
        "Real-time alerts and notifications",
        "Team collaboration tools",
        "Document management and storage",
        "Basic analytics and reporting",
        "Priority email support",
      ],
      enterprise: [
        "Everything in Premium, plus:",
        "Unlimited team members and workspaces",
        "Custom integrations and API access",
        "Advanced analytics and custom reports",
        "White-label options",
        "Dedicated account manager",
        "24/7 phone and chat support",
        "Custom training and onboarding",
      ],
    };

    return featureMap[planType] ?? featureMap["premium"] ?? [];
  }

  private async createOrUpdateSubscriptionRecord(
    userId: string,
    subscription: Stripe.Subscription,
    planType: string
  ): Promise<void> {
    try {
      // Extract price information from Stripe subscription safely
      const price = subscription.items.data[0]?.price;
      const priceAmountInCents = price?.unit_amount ?? 0;
      const currency = (price?.currency ?? "usd").toUpperCase();

      // Normalize status to our app's convention (uppercase strings)
      const normalizedStatus =
        subscription.status === "active" ? "ACTIVE" : "INACTIVE";

      // Validate and create date objects safely
      const currentTime = new Date();
      let startDate = subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000)
        : currentTime;

      let endDate = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : null;

      let nextPaymentDate = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : null;

      // Validate that the dates are valid
      if (Number.isNaN(startDate.getTime())) {
        loggingService.warn(
          `Invalid startDate for subscription ${subscription.id}, using current time`,
          {
            subscriptionId: subscription.id,
            current_period_start: subscription.current_period_start,
          }
        );
        startDate = currentTime;
      }

      if (endDate && Number.isNaN(endDate.getTime())) {
        loggingService.warn(
          `Invalid endDate for subscription ${subscription.id}, setting to null`,
          {
            subscriptionId: subscription.id,
            current_period_end: subscription.current_period_end,
          }
        );
        endDate = null;
      }

      if (nextPaymentDate && Number.isNaN(nextPaymentDate.getTime())) {
        loggingService.warn(
          `Invalid nextPaymentDate for subscription ${subscription.id}, setting to null`,
          {
            subscriptionId: subscription.id,
            current_period_end: subscription.current_period_end,
          }
        );
        nextPaymentDate = null;
      }

      // Build create and update shapes
      const createData = {
        user: { connect: { id: userId } },
        planId: subscription.id,
        planType,
        status: normalizedStatus,
        startDate,
        endDate,
        autoRenew: !subscription.cancel_at_period_end,
        currency,
        price: priceAmountInCents / 100,
        paymentMethod: "stripe",
        lastPaymentDate: currentTime,
        nextPaymentDate,
        metadata: {
          stripeSubscriptionId: subscription.id,
          stripeCustomerId:
            typeof subscription.customer === "string"
              ? subscription.customer
              : subscription.customer.id,
        } as Prisma.JsonObject,
      };

      const updateData = {
        planId: createData.planId,
        planType: createData.planType,
        status: createData.status,
        startDate: createData.startDate,
        endDate: createData.endDate,
        autoRenew: createData.autoRenew,
        currency: createData.currency,
        price: createData.price,
        paymentMethod: createData.paymentMethod,
        lastPaymentDate: createData.lastPaymentDate,
        nextPaymentDate: createData.nextPaymentDate,
        metadata: createData.metadata,
      };

      await Subscription.upsertByUserId(userId, createData, updateData);
      loggingService.info(
        `Upserted subscription record for user ${userId} with plan type: ${planType}`
      );
    } catch (error: unknown) {
      const errorInfo =
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              code: "code" in error ? (error as { code: unknown }).code : null,
              meta: "meta" in error ? (error as { meta: unknown }).meta : null,
            }
          : {
              name: "Unknown",
              message: "Unknown error",
              code: null,
              meta: null,
            };
      loggingService.error(
        `Failed to create/update subscription record for user ${userId}:`,
        {
          error: errorInfo,
          userId,
          subscriptionId: subscription.id,
        }
      );
      // Don't throw error to avoid breaking the subscription flow
    }
  }

  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription
  ): Promise<void> {
    let existing = await StripeSubscriptionModel.findOne({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!existing) {
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;
      const stripeCustomer = await StripeCustomerModel.findOne({
        where: { stripeCustomerId: customerId },
      });
      if (stripeCustomer) {
        const subscriptionData: Prisma.StripeSubscriptionCreateInput = {
          user: { connect: { id: stripeCustomer.userId } },
          stripeSubscriptionId: subscription.id,
          customer: { connect: { stripeCustomerId: customerId } },
          status: SubscriptionStatus.CANCELED,
          currentPeriodStart:
            subscription.current_period_start &&
            typeof subscription.current_period_start === "number"
              ? new Date(subscription.current_period_start * 1000)
              : new Date(),
          currentPeriodEnd:
            subscription.current_period_end &&
            typeof subscription.current_period_end === "number"
              ? new Date(subscription.current_period_end * 1000)
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          canceledAt: new Date(),
        };

        if (
          subscription.trial_start &&
          typeof subscription.trial_start === "number" &&
          subscription.trial_start > 0
        ) {
          subscriptionData.trialStart = new Date(
            subscription.trial_start * 1000
          );
        }
        if (
          subscription.trial_end &&
          typeof subscription.trial_end === "number" &&
          subscription.trial_end > 0
        ) {
          subscriptionData.trialEnd = new Date(subscription.trial_end * 1000);
        }
        // Ensure unique per user: update existing-by-user if present, else create
        const existingByUser = await StripeSubscriptionModel.findOne({
          where: { userId: stripeCustomer.userId },
        });
        if (existingByUser) {
          await StripeSubscriptionModel.update(subscriptionData, {
            where: { id: existingByUser.id },
          });
          existing = existingByUser;
        } else {
          existing = await StripeSubscriptionModel.create(subscriptionData);
        }
      }
    }

    if (existing) {
      await StripeSubscriptionModel.update(
        {
          status: SubscriptionStatus.CANCELED,
          canceledAt: new Date(),
        },
        { where: { id: existing.id } }
      );

      await User.update(
        { role: UserRole.FREE },
        { where: { id: existing.userId } }
      );
    }
  }

  private async handlePaymentSucceeded(
    paymentIntent: Stripe.PaymentIntent
  ): Promise<void> {
    const stripePayment = await StripePaymentModel.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (stripePayment) {
      await StripePaymentModel.update(
        {
          status: PaymentStatus.SUCCEEDED,
        },
        { where: { id: stripePayment.id } }
      );
    }
  }

  private async handlePaymentFailed(
    paymentIntent: Stripe.PaymentIntent
  ): Promise<void> {
    const stripePayment = await StripePaymentModel.findOne({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (stripePayment) {
      await StripePaymentModel.update(
        {
          status: PaymentStatus.FAILED,
        },
        { where: { id: stripePayment.id } }
      );
    }
  }

  private async handleInvoicePaymentSucceeded(
    invoice: Stripe.Invoice
  ): Promise<void> {
    if (invoice.subscription) {
      const subscription = await stripe.subscriptions.retrieve(
        invoice.subscription as string
      );
      await this.handleSubscriptionChange(subscription);
    }
  }

  private async handleInvoicePaymentFailed(
    invoice: Stripe.Invoice
  ): Promise<void> {
    if (invoice.subscription) {
      const subscription = await stripe.subscriptions.retrieve(
        invoice.subscription as string
      );
      await this.handleSubscriptionChange(subscription);
    }
  }

  // Utility Methods
  async getPrices(): Promise<Stripe.Price[]> {
    try {
      const prices = await stripe.prices.list({
        active: true,
        expand: ["data.product"],
      });
      return prices.data;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorObj = error instanceof Error ? error : new Error(errorMessage);
      loggingService.logJobError("stripe_prices_retrieve", "prices", errorObj);
      throw new Error(`Failed to retrieve prices: ${errorMessage}`);
    }
  }

  async getProducts(): Promise<Stripe.Product[]> {
    try {
      const products = await stripe.products.list({
        active: true,
      });
      return products.data;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorObj = error instanceof Error ? error : new Error(errorMessage);
      loggingService.logJobError(
        "stripe_products_retrieve",
        "products",
        errorObj
      );
      throw new Error(`Failed to retrieve products: ${errorMessage}`);
    }
  }
}

export default new StripeService();
