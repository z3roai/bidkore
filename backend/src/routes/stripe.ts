import express, { type Request, type Response, Router } from "express";
import Stripe from "stripe";

import config from "@/config/env";
import { type AuthRequest, authenticateToken } from "@/middleware/auth";
import { getFullName } from "@/models/User";
import loggingService from "@/services/loggingService";
import stripeService from "@/services/stripeService";

const router = Router();

// Get Stripe products and prices
router.get("/products", async (_req: Request, res: Response): Promise<void> => {
	try {
		const [products, prices] = await Promise.all([
			stripeService.getProducts(),
			stripeService.getPrices(),
		]);

		const productsWithPrices = products.map(product => ({
			id: product.id,
			name: product.name,
			description: product.description,
			images: product.images,
			metadata: product.metadata,
			prices: prices
				.filter(price => {
					const priceProduct = price.product as Stripe.Product | string;
					const priceProductId =
						typeof priceProduct === "string" ? priceProduct : priceProduct.id;
					return priceProductId === product.id;
				})
				.map(price => ({
					id: price.id,
					unit_amount: price.unit_amount,
					currency: price.currency,
					recurring: price.recurring,
					metadata: price.metadata,
				})),
		}));

		res.json({ products: productsWithPrices });
	} catch (error: unknown) {
		loggingService.logError(
			"stripe_products_endpoint",
			error instanceof Error ? error : new Error(String(error))
		);
		res.status(500).json({ error: "Failed to retrieve products" });
	}
});

// Create Stripe customer
router.post(
	"/customer",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const customer = await stripeService.createCustomer({
				userId: req.user.id,
				email: req.user.email,
				name: getFullName(req.user),
			});

			loggingService.logUserAction(
				"stripe_customer_created_via_api",
				req.user.id,
				req.user.role
			);

			res.json({ customer });
		} catch (error: unknown) {
			loggingService.logUserError(
				"stripe_customer_creation_api",
				req.user?.id ?? "",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to create customer" });
		}
	}
);

// Get Stripe customer
router.get(
	"/customer",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const customer = await stripeService.getCustomer(req.user.id);

			if (!customer) {
				res.status(404).json({ error: "Customer not found" });
				return;
			}

			res.json({ customer });
		} catch (error: unknown) {
			loggingService.logUserError(
				"stripe_customer_retrieve_api",
				req.user?.id ?? "",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to retrieve customer" });
		}
	}
);

// Create subscription
router.post(
	"/subscription",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const { priceId, trialPeriodDays } = req.body as {
				priceId: string;
				trialPeriodDays?: number;
			};

			if (!priceId) {
				res.status(400).json({ error: "Price ID is required" });
				return;
			}

			const subscription = await stripeService.createSubscription({
				userId: req.user.id,
				priceId,
				...(trialPeriodDays !== undefined && { trialPeriodDays }),
			});

			loggingService.logUserAction(
				"stripe_subscription_created_via_api",
				req.user.id,
				req.user.role,
				{ priceId }
			);

			res.json({ subscription });
		} catch (error: unknown) {
			loggingService.logUserError(
				"stripe_subscription_creation_api",
				req.user?.id ?? "",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to create subscription" });
		}
	}
);

// Get subscription
router.get(
	"/subscription",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const subscription = await stripeService.getSubscription(req.user.id);

			if (!subscription) {
				res.status(404).json({ error: "Subscription not found" });
				return;
			}

			res.json({ subscription });
		} catch (error: unknown) {
			loggingService.logUserError(
				"stripe_subscription_retrieve_api",
				req.user?.id ?? "",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to retrieve subscription" });
		}
	}
);

// Cancel subscription
router.post(
	"/subscription/cancel",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const { cancelAtPeriodEnd = true } = req.body as {
				cancelAtPeriodEnd?: boolean;
			};

			const subscription = await stripeService.cancelSubscription(
				req.user.id,
				cancelAtPeriodEnd
			);

			loggingService.logUserAction(
				"stripe_subscription_canceled_via_api",
				req.user.id,
				req.user.role,
				{ cancelAtPeriodEnd }
			);

			res.json({ subscription });
		} catch (error: unknown) {
			loggingService.logUserError(
				"stripe_subscription_cancel_api",
				req.user?.id ?? "",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to cancel subscription" });
		}
	}
);

// Create payment intent
router.post(
	"/payment-intent",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const {
				amount,
				currency = "usd",
				description,
				metadata,
			} = req.body as {
				amount: number;
				currency?: string;
				description?: string;
				metadata?: Record<string, string>;
			};

			if (!amount || amount <= 0) {
				res.status(400).json({ error: "Valid amount is required" });
				return;
			}

			const paymentIntent = await stripeService.createPaymentIntent({
				userId: req.user.id,
				amount,
				currency,
				...(description !== undefined && { description }),
				...(metadata !== undefined && { metadata }),
			});

			loggingService.logUserAction(
				"stripe_payment_intent_created_via_api",
				req.user.id,
				req.user.role,
				{ amount }
			);

			res.json({
				clientSecret: paymentIntent.client_secret,
				paymentIntentId: paymentIntent.id,
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"stripe_payment_intent_creation_api",
				req.user?.id ?? "",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to create payment intent" });
		}
	}
);

// Create Checkout Session (Stripe Checkout hosted page)
router.post(
	"/create-checkout-session",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const {
				priceId,
				successUrl,
				cancelUrl,
				allowPromotionCodes,
				trialPeriodDays,
			} = req.body as {
				priceId: string;
				successUrl?: string;
				cancelUrl?: string;
				allowPromotionCodes?: boolean;
				trialPeriodDays?: number;
			};

			if (!priceId) {
				res.status(400).json({ error: "Price ID is required" });
				return;
			}

			const frontendBase = config.urls.frontend;
			const defaultSuccess = `${frontendBase}/dashboard`;
			const defaultCancel = `${frontendBase}/stripe-payment`;

			const session = await stripeService.createCheckoutSession({
				userId: req.user.id,
				priceId,
				successUrl: successUrl ?? defaultSuccess,
				cancelUrl: cancelUrl ?? defaultCancel,
				...(allowPromotionCodes !== undefined && { allowPromotionCodes }),
				...(trialPeriodDays !== undefined && { trialPeriodDays }),
			});

			loggingService.logUserAction(
				"stripe_checkout_session_created_via_api",
				req.user.id,
				req.user.role,
				{ priceId }
			);

			res.json({ id: session.id, url: session.url });
		} catch (error: unknown) {
			loggingService.logUserError(
				"stripe_checkout_session_creation_api",
				req.user?.id ?? "",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to create checkout session" });
		}
	}
);

// Stripe webhook router with raw body parsing (must be mounted before express.json)
export const stripeWebhookRouter = Router();
stripeWebhookRouter.post(
	"/",
	express.raw({ type: "application/json" }),
	async (req: Request, res: Response): Promise<void> => {
		try {
			const sig = req.headers["stripe-signature"] as string;
			const { webhookSecret } = config.stripe;

			if (!webhookSecret) {
				res.status(500).json({ error: "Webhook secret not configured" });
				return;
			}

			let event: Stripe.Event;

			try {
				event = Stripe.webhooks.constructEvent(
					req.body as Buffer,
					sig,
					webhookSecret
				);
			} catch (err: unknown) {
				loggingService.logError(
					"stripe_webhook_signature_verification",
					err instanceof Error ? err : new Error(String(err))
				);
				res.status(400).json({ error: "Invalid signature" });
				return;
			}

			await stripeService.handleWebhook(event);

			res.json({ received: true });
		} catch (error: unknown) {
			loggingService.logError(
				"stripe_webhook_handler",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Webhook handler failed" });
		}
	}
);

// Get payment methods for customer
router.get(
	"/payment-methods",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			if (!config.stripe.secretKey) {
				res.status(500).json({ error: "Stripe secret key not configured" });
				return;
			}

			const stripe = new Stripe(config.stripe.secretKey, {
				apiVersion: "2023-10-16",
			});

			const customer = await stripeService.getCustomer(req.user.id);

			if (!customer) {
				res.status(404).json({ error: "Customer not found" });
				return;
			}

			const paymentMethods = await stripe.paymentMethods.list({
				customer: customer.id,
				type: "card",
			});

			res.json({ paymentMethods: paymentMethods.data });
		} catch (error: unknown) {
			loggingService.logUserError(
				"stripe_payment_methods_retrieve",
				req.user?.id ?? "",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to retrieve payment methods" });
		}
	}
);

export default router;
