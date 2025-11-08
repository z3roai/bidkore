console.log("BidKore Backend is starting...");

import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import compression from "compression";
import cors from "cors";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { connectDatabase } from "@/config/database";
import config from "@/config/env";
import { connectRedis } from "@/config/redis";
import { errorHandler, notFoundHandler } from "@/middleware/errorHandler";
import requestLogger from "@/middleware/requestLogger";
import aiFilterAnalyticsRoutes from "@/routes/aiFilterAnalytics";
import aiSearchRoutes from "@/routes/aiSearch";
import analyticsRoutes from "@/routes/analytics";
import authRoutes from "@/routes/auth";
import dmChatRoutes from "@/routes/dmChat";
import dropboxRoutes from "@/routes/dropbox";
import filtersRoutes from "@/routes/filters";
import logsRoutes from "@/routes/logs";
import googleRoutes from "@/routes/google";
import microsoftRoutes from "@/routes/microsoft";
import notificationsRoutes from "@/routes/notifications";
import oauthHandlerRoutes from "@/routes/oauth-handler";
import opportunitiesRoutes from "@/routes/opportunities";
import queueRoutes from "@/routes/queue";
import searchHistoryRoutes from "@/routes/searchHistory";
import stripeRoutes, { stripeWebhookRouter } from "@/routes/stripe";
import subscriptionsRoutes from "@/routes/subscriptions";
import teamsRoutes, { setWebSocketService } from "@/routes/teams";
import companyProfileRoutes from "@/routes/companyProfile";
import proposalsRoutes from "@/routes/proposals";
import totpRoutes from "@/routes/totp";
import userRoutes from "@/routes/user";
import webauthnRoutes from "@/routes/webauthn";
import loggingService from "@/services/loggingService";
import schedulerService from "@/services/schedulerService";
import WebSocketService from "@/services/websocketService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const server = createServer(app);
const PORT = config.server.port || 5000;

app.set("trust proxy", 1);

// Security middleware
app.use(helmet());

app.use(cors({
  origin: config.urls.frontend,
  credentials: true,
}));

// // Rate limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: config.nodeEnv === "development" ? 9999999 : 100, // Higher limit for development
//   message: "Too many requests from this IP, please try again later.",
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// app.use((req, res, next) => {
//   if (req.path.startsWith("/api/auth/") || req.path.startsWith("/auth/")) {
//     return next();
//   }
//   return limiter(req, res, next);
// });

// Stripe webhook must be mounted BEFORE json body parser to preserve raw body
app.use("/api/stripe/webhook", stripeWebhookRouter);

// Body parsing middleware (after webhook)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Compression middleware
app.use(compression());

app.use(requestLogger);

// Serve static files for uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "BidKore Backend",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/auth/oauth-handler", oauthHandlerRoutes);
app.use("/api/totp", totpRoutes);
app.use("/api/webauthn", webauthnRoutes);
app.use("/api/users", userRoutes);
app.use("/api/teams", teamsRoutes);
app.use("/api/opportunities", opportunitiesRoutes);
app.use("/api/search-history", searchHistoryRoutes);
app.use("/api/subscriptions", subscriptionsRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api/filters", filtersRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/ai-filter-analytics", aiFilterAnalyticsRoutes);
app.use("/api/auth/dropbox", dropboxRoutes);
app.use("/api/auth/google", googleRoutes);
app.use("/api/auth/microsoft", microsoftRoutes);
app.use("/api/queue", queueRoutes);
app.use("/api/ai", aiSearchRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/dm-chat", dmChatRoutes);
app.use("/api/company-profile", companyProfileRoutes);
app.use("/api/proposals", proposalsRoutes);

app.use(notFoundHandler);

app.use(errorHandler);

const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();
    await connectRedis();
    schedulerService.start();

    const wsService = new WebSocketService(server);
    setWebSocketService(wsService);

    server.listen(PORT, () => {
      loggingService.info(`BidKore Backend running on port ${PORT}`);
      loggingService.info(`Health check: http://localhost:${PORT}/health`);
      loggingService.info("SAM.gov polling scheduler started");
      loggingService.info("Priority queue workers started");
      loggingService.info("WebSocket server initialized");
    });
  } catch (error) {
    loggingService.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer().catch((error) => {
  loggingService.error("Failed to start server:", error);
  process.exit(1);
});

export default app;
