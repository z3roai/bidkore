import { Router, Response } from "express";
import crypto from "crypto";
import { AuthRequest } from "@/middleware/auth";
import { createError } from "@/middleware/errorHandler";
import loggingService from "@/services/loggingService";
import { config } from "@/config/env";
import { authLimiter } from "@/middleware/rateLimiting";
import { authenticateToken } from "@/middleware/auth";
import prisma from "@/config/prisma";
import { toJSON } from "@/models/User";
import jwt from "jsonwebtoken";

const router = Router();

// OAuth state management (same as Microsoft)
interface StoredState {
  codeVerifier: string;
  expiresAt: number;
  mode: "login" | "register" | "integration";
}

type OAuthMode = "login" | "register" | "integration";

// Redis keys for OAuth state management
const OAUTH_STATE_PREFIX = "oauth_state:";

async function storeOAuthState(
  state: string,
  data: StoredState
): Promise<void> {
  // TTL 20 minutes (align with expiresAt field)
  const ttlSeconds = Math.floor((data.expiresAt - Date.now()) / 1000);
  if (ttlSeconds <= 0) return;

  const key = `${OAUTH_STATE_PREFIX}${state}`;
  // Store as JSON string
  const serialized = JSON.stringify(data);
  // Use Redis if available, otherwise fallback to in-memory (not recommended for production)
  // For now, we'll use a simple in-memory store for development
  (global as Record<string, unknown>).oauthStates =
    (global as Record<string, unknown>).oauthStates || new Map();
  ((global as Record<string, unknown>).oauthStates as Map<string, string>).set(
    key,
    serialized
  );

  // Set expiration
  setTimeout(() => {
    (
      (global as Record<string, unknown>).oauthStates as Map<string, string>
    )?.delete(key);
  }, ttlSeconds * 1000);
}

async function getOAuthState(state: string): Promise<StoredState | null> {
  const key = `${OAUTH_STATE_PREFIX}${state}`;
  const serialized = (
    (global as Record<string, unknown>).oauthStates as Map<string, string>
  )?.get(key);
  if (!serialized) return null;

  try {
    return JSON.parse(serialized) as StoredState;
  } catch {
    return null;
  }
}

async function deleteOAuthState(state: string): Promise<void> {
  const key = `${OAUTH_STATE_PREFIX}${state}`;
  (
    (global as Record<string, unknown>).oauthStates as Map<string, string>
  )?.delete(key);
}

// Google OAuth configuration
function isGoogleConfigured(): boolean {
  return Boolean(config.google?.clientId && config.google?.clientSecret);
}

// Initiate Google OAuth flow
router.get(
  "/connect",
  authLimiter,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!isGoogleConfigured()) {
        res.status(503).json({
          success: false,
          error: "Google authentication is not configured",
        });
        return;
      }

      const mode = (req.query["mode"] as string) || "login";
      const _isIntegration = mode === "integration";

      // Generate secure state and PKCE parameters
      const state = crypto.randomUUID();
      const codeVerifier = crypto.randomBytes(32).toString("base64url");
      const codeChallenge = crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");

      // Store code verifier and mode in Redis (expires in 20 minutes)
      await storeOAuthState(state, {
        codeVerifier,
        expiresAt: Date.now() + 20 * 60 * 1000,
        mode: mode as OAuthMode,
      });

      // Google OAuth scopes - Using only basic scopes that don't require verification
      const scopes = ["openid", "profile", "email"];

      // Build authorization URL
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.append("response_type", "code");
      authUrl.searchParams.append("client_id", config.google.clientId || "");
      authUrl.searchParams.append(
        "redirect_uri",
        config.google.redirectUri || ""
      );
      authUrl.searchParams.append("scope", scopes.join(" "));
      authUrl.searchParams.append("state", state);
      authUrl.searchParams.append("code_challenge", codeChallenge);
      authUrl.searchParams.append("code_challenge_method", "S256");
      authUrl.searchParams.append("access_type", "offline");
      authUrl.searchParams.append("prompt", "consent");

      res.json({
        success: true,
        authUrl: authUrl.toString(),
        mode,
      });
    } catch (error) {
      loggingService.error("Error generating Google auth URL", {
        error: error instanceof Error ? error.message : error,
      });
      throw createError("Failed to initiate Google connection", 500);
    }
  }
);

// Conditional authentication middleware
const conditionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: () => void
) => {
  const mode = req.body?.mode || req.query?.mode;
  if (mode === "integration") {
    return authenticateToken(req, res, next);
  }
  return next();
};

// Handle Google OAuth callback
router.post(
  "/callback",
  authLimiter,
  conditionalAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { code, state, mode = "login" } = req.body;

    // Use stored mode if available to ensure correctness
    const storedForState = await getOAuthState(state);
    const effectiveMode: OAuthMode = (storedForState?.mode ??
      mode) as OAuthMode;
    const _isRegistration = effectiveMode === "register";
    const _isIntegration = effectiveMode === "integration";

    try {
      if (!isGoogleConfigured()) {
        res.status(503).json({
          success: false,
          error: "Google authentication is not configured",
        });
        return;
      }

      // Validate required parameters
      if (!code || !state) {
        throw createError("Missing authorization code or state", 400);
      }

      // Integration flow requires authenticated user
      if (_isIntegration && !req.user) {
        throw createError("Authentication required for integration", 401);
      }

      // Retrieve and validate code verifier
      const storedData = await getOAuthState(state);

      if (!storedData) {
        res.status(400).json({
          success: false,
          error: "OAuth session expired",
          message:
            "Your authentication session has expired. Please try connecting again.",
          code: "OAUTH_STATE_NOT_FOUND",
          shouldRetry: true,
        });
        return;
      }

      if (storedData.expiresAt < Date.now()) {
        await deleteOAuthState(state);
        throw createError(
          "OAuth session expired. Please try connecting again.",
          400
        );
      }

      // Exchange authorization code for tokens
      const tokenUrl = "https://oauth2.googleapis.com/token";
      const tokenParams = new URLSearchParams({
        client_id: config.google.clientId || "",
        client_secret: config.google.clientSecret || "",
        code,
        grant_type: "authorization_code",
        redirect_uri: config.google.redirectUri || "",
        code_verifier: storedData.codeVerifier,
      });

      const tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenParams.toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        loggingService.error("Google token exchange failed", {
          status: tokenResponse.status,
          error: errorText,
        });
        throw createError("Failed to exchange authorization code", 500);
      }

      const tokenData = await tokenResponse.json();
      const { access_token, refresh_token, expires_in } = tokenData;

      // Get user profile from Google
      const profileResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        }
      );

      if (!profileResponse.ok) {
        throw createError("Failed to get Google profile", 500);
      }

      const profile = await profileResponse.json();
      const { id: googleId, email, name } = profile;

      // Check if user already exists with this Google account
      const existingUser = await prisma.user.findUnique({
        where: { googleAccountId: googleId },
      });

      if (existingUser && !_isIntegration) {
        // Update existing user with fresh tokens
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            googleAccessToken: access_token,
            googleRefreshToken: refresh_token,
            googleTokenExpiry: new Date(Date.now() + expires_in * 1000),
            googleConnectedAt: new Date(),
            lastLoginAt: new Date(),
          },
        });

        // Generate JWT token
        const token = jwt.sign(
          {
            userId: existingUser.id,
            email: existingUser.email,
            role: existingUser.role,
          },
          config.auth.jwtSecret,
          { expiresIn: "7d" }
        );

        res.json({
          success: true,
          message: "Successfully signed in with Google",
          token,
          user: toJSON(existingUser),
          mode: effectiveMode,
        });
        return;
      }

      // Check if user exists with same email
      const userWithEmail = await prisma.user.findUnique({
        where: { email },
      });

      if (userWithEmail && !_isIntegration) {
        // Link Google account to existing user
        await prisma.user.update({
          where: { id: userWithEmail.id },
          data: {
            googleAccountId: googleId,
            googleEmail: email,
            googleName: name,
            googleAccessToken: access_token,
            googleRefreshToken: refresh_token,
            googleTokenExpiry: new Date(Date.now() + expires_in * 1000),
            googleConnectedAt: new Date(),
            lastLoginAt: new Date(),
          },
        });

        // Generate JWT token
        const token = jwt.sign(
          {
            userId: userWithEmail.id,
            email: userWithEmail.email,
            role: userWithEmail.role,
          },
          config.auth.jwtSecret,
          { expiresIn: "7d" }
        );

        res.json({
          success: true,
          message: "Successfully linked Google account",
          token,
          user: toJSON(userWithEmail),
          mode: effectiveMode,
        });
        return;
      }

      if (_isIntegration) {
        // Integration flow - update existing authenticated user
        if (!req.user) {
          throw createError("prisma.user not authenticated", 401);
        }

        await prisma.user.update({
          where: { id: req.user.id },
          data: {
            googleAccountId: googleId,
            googleEmail: email,
            googleName: name,
            googleAccessToken: access_token,
            googleRefreshToken: refresh_token,
            googleTokenExpiry: new Date(Date.now() + expires_in * 1000),
            googleConnectedAt: new Date(),
          },
        });

        res.json({
          success: true,
          message: "Google account connected successfully",
          mode: effectiveMode,
        });
        return;
      }

      // Create new user
      const newUser = await prisma.user.create({
        data: {
          email,
          password: "", // No password for OAuth users
          firstName: name?.split(" ")[0] || "",
          lastName: name?.split(" ").slice(1).join(" ") || "",
          googleAccountId: googleId,
          googleEmail: email,
          googleName: name,
          googleAccessToken: access_token,
          googleRefreshToken: refresh_token,
          googleTokenExpiry: new Date(Date.now() + expires_in * 1000),
          googleConnectedAt: new Date(),
          isActive: true,
          emailVerified: true, // Google emails are pre-verified
          lastLoginAt: new Date(),
        },
      });

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: newUser.id,
          email: newUser.email,
          role: newUser.role,
        },
        config.auth.jwtSecret,
        { expiresIn: "7d" }
      );

      res.json({
        success: true,
        message: "Successfully registered with Google",
        token,
        user: toJSON(newUser),
        mode: effectiveMode,
      });
    } catch (error) {
      loggingService.error("Google callback error", {
        error: error instanceof Error ? error.message : error,
        mode: effectiveMode,
      });
      throw error;
    }
  }
);

// Disconnect Google integration
router.post(
  "/disconnect",
  authLimiter,
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          googleAccountId: null,
          googleEmail: null,
          googleName: null,
          googleAccessToken: null,
          googleRefreshToken: null,
          googleTokenExpiry: null,
          googleConnectedAt: null,
        },
      });

      res.json({
        success: true,
        message: "Google account disconnected successfully",
      });
    } catch (error) {
      loggingService.error("Google disconnect error", {
        error: error instanceof Error ? error.message : error,
      });
      throw createError("Failed to disconnect Google account", 500);
    }
  }
);

// Get Google connection status
router.get(
  "/status",
  authLimiter,
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          googleAccountId: true,
          googleEmail: true,
          googleName: true,
          googleConnectedAt: true,
          password: true,
        },
      });

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const isConnected = Boolean(user.googleAccountId);
      const canUnlinkLogin = Boolean(
        user?.password && user.password.length > 0
      );

      res.json({
        success: true,
        isConnected,
        canUnlinkLogin,
        googleEmail: user.googleEmail,
        googleName: user.googleName,
        connectedAt: user.googleConnectedAt,
      });
    } catch (error) {
      loggingService.error("Google status error", {
        error: error instanceof Error ? error.message : error,
      });
      throw createError("Failed to get Google status", 500);
    }
  }
);

export default router;
