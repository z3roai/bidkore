import config from "@/config/env";
import prisma from "@/config/prisma";
import redisClient from "@/config/redis";
import { type AuthRequest, authenticateToken } from "@/middleware/auth";
import { createError } from "@/middleware/errorHandler";
import { authLimiter } from "@/middleware/rateLimiting";
import { toJSON } from "@/models/User";
import loggingService from "@/services/loggingService";
import { ConfidentialClientApplication, LogLevel } from "@azure/msal-node";
import * as crypto from "crypto";
import {
  type Response as ExpressResponse,
  type NextFunction,
  Router,
} from "express";
import jwt from "jsonwebtoken";
import multer from "multer";

// Microsoft Graph API response interface
interface MicrosoftProfile {
  id: string;
  mail?: string;
  userPrincipalName?: string;
  displayName: string;
  givenName?: string;
  surname?: string;
}

const router = Router();

// Stores for PKCE and request deduplication (store mode to ensure correctness)
type OAuthMode = "login" | "register" | "integration";

// Redis key helpers for OAuth state
const oauthStateKey = (state: string): string =>
  `oauth:microsoft:state:${state}`;
interface StoredState {
  codeVerifier: string;
  expiresAt: number;
  mode: OAuthMode;
}

async function storeOAuthState(
  state: string,
  data: StoredState
): Promise<void> {
  // TTL 20 minutes (align with expiresAt field)
  const key = oauthStateKey(state);
  const serialized = JSON.stringify(data);

  loggingService.info("Storing OAuth state", {
    key,
    state,
    hasCodeVerifier: !!data.codeVerifier,
    codeVerifierLength: data.codeVerifier?.length,
    expiresAt: data.expiresAt,
    mode: data.mode,
  });

  await redisClient.set(key, serialized, "EX", 20 * 60);

  loggingService.info("OAuth state stored successfully", { key });
}

async function getOAuthState(state: string): Promise<StoredState | null> {
  const key = oauthStateKey(state);
  loggingService.info("Retrieving OAuth state from Redis", { key, state });

  const raw = await redisClient.get(key);
  if (!raw) {
    loggingService.warn("OAuth state not found in Redis", { key, state });
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredState;
    loggingService.info("OAuth state retrieved from Redis", {
      key,
      state,
      hasCodeVerifier: !!parsed.codeVerifier,
      codeVerifierLength: parsed.codeVerifier?.length,
      expiresAt: parsed.expiresAt,
      mode: parsed.mode,
    });
    return parsed;
  } catch (error) {
    loggingService.error("Failed to parse OAuth state from Redis", {
      error,
      key,
      state,
      raw,
    });
    return null;
  }
}

async function deleteOAuthState(state: string): Promise<void> {
  await redisClient.del(oauthStateKey(state));
}

// MSAL Configuration for Confidential Client (with client secret)
// Persist MSAL token cache to Redis so refresh tokens are stored securely
const MSAL_CACHE_KEY = "msal:token_cache";
interface MsalCacheContextLike {
  tokenCache: { deserialize: (blob: string) => void; serialize: () => string };
  cacheHasChanged: boolean;
}
const cachePlugin = {
  beforeCacheAccess: async (cacheContext: MsalCacheContextLike) => {
    try {
      const serialized = await redisClient.get(MSAL_CACHE_KEY);
      if (serialized) {
        cacheContext.tokenCache.deserialize(serialized);
      }
    } catch {
      // no-op
    }
  },
  afterCacheAccess: async (cacheContext: MsalCacheContextLike) => {
    try {
      if (cacheContext.cacheHasChanged) {
        const newValue = cacheContext.tokenCache.serialize();
        await redisClient.set(MSAL_CACHE_KEY, newValue);
      }
    } catch {
      // no-op
    }
  },
};

const msalConfig = {
  auth: {
    clientId: config.microsoft.clientId,
    clientSecret: config.microsoft.clientSecret,
    authority: `https://login.microsoftonline.com/${config.microsoft.tenantId}`,
  },
  cache: {
    cachePlugin,
  },
  system: {
    loggerOptions: {
      loggerCallback: (
        level: LogLevel,
        message: string,
        containsPii: boolean
      ) => {
        if (containsPii) return;
        if (level === LogLevel.Error) console.error(`MSAL: ${message}`);
      },
    },
  },
};

const cca = new ConfidentialClientApplication(msalConfig);

// Setup multer for in-memory file uploads (suitable for proxying to Graph)
const upload = multer({
  storage: multer.memoryStorage(),
  // Microsoft Graph simple upload limit is 4MB; larger files require upload session
  limits: { fileSize: 4 * 1024 * 1024 },
});

// Helper: ensure we have a valid access token (prefer MSAL silent refresh via cache)
async function getValidMicrosoftAccessToken(
  userId: string
): Promise<string | null> {
  try {
    // Use MSAL cache first
    const tokenCache = cca.getTokenCache();
    const accounts = await tokenCache.getAllAccounts();
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        microsoftEmail: true,
        microsoftAccessToken: true,
        microsoftTokenExpiry: true,
      },
    });
    const email = userRecord?.microsoftEmail?.toLowerCase();
    const account = email
      ? accounts.find((a) => a.username?.toLowerCase() === email)
      : undefined;
    const scopes = [
      "User.Read",
      "Files.ReadWrite.All",
      "Sites.Read.All",
      "Calendars.ReadWrite",
    ];
    if (account) {
      try {
        const silent = await cca.acquireTokenSilent({ scopes, account });
        if (silent?.accessToken) return silent.accessToken;
      } catch {
        // no-op
      }
    }

    // Fallback to existing access token if still valid
    if (userRecord?.microsoftAccessToken && userRecord.microsoftTokenExpiry) {
      const expiresAt = new Date(
        userRecord.microsoftTokenExpiry as unknown as string
      ).getTime();
      if (expiresAt - Date.now() > 2 * 60 * 1000) {
        return userRecord.microsoftAccessToken;
      }
    }

    return null;
  } catch {
    // no-op
    return null;
  }
}

// Helper: Graph fetch with automatic token retrieval
async function graphFetch(
  userId: string,
  url: string
): Promise<globalThis.Response | null> {
  const accessToken = await getValidMicrosoftAccessToken(userId);
  if (!accessToken) return null;
  return await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// Initiate Microsoft OAuth flow
router.get(
  "/connect",
  authLimiter,
  async (req: AuthRequest, res: ExpressResponse): Promise<void> => {
    try {
      const mode = (req.query["mode"] as string) || "login";
      const isIntegration = mode === "integration";

      // Generate secure state and PKCE parameters
      const state = crypto.randomUUID();
      const codeVerifier = crypto.randomBytes(32).toString("base64url");
      const codeChallenge = crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");

      loggingService.info("Generated PKCE parameters", {
        state,
        codeVerifierLength: codeVerifier.length,
        codeVerifierPrefix: codeVerifier.substring(0, 10) + "...",
        codeChallengeLength: codeChallenge.length,
        codeChallengePrefix: codeChallenge.substring(0, 10) + "...",
        mode,
      });

      // Store code verifier and mode in Redis (expires in 20 minutes)
      await storeOAuthState(state, {
        codeVerifier,
        expiresAt: Date.now() + 20 * 60 * 1000,
        mode: mode as OAuthMode,
      });

      loggingService.info("Stored OAuth state in Redis", { state });

      // Different scopes based on the flow type
      let scopes: string[];
      if (isIntegration) {
        // Integration flow - request service scopes for existing users
        scopes = [
          "openid",
          "profile",
          "email",
          "User.Read",
          "Files.ReadWrite.All", // OneDrive
          "Sites.Read.All", // SharePoint sites access
          "Calendars.ReadWrite", // Outlook Calendar
          "offline_access",
        ];
      } else {
        // Registration/Login flow - request only basic scopes
        scopes = ["openid", "profile", "email", "User.Read", "offline_access"];
      }

      // Generate authorization URL
      const authUrlOptions: {
        scopes: string[];
        redirectUri: string;
        state: string;
        codeChallenge: string;
        codeChallengeMethod: string;
        prompt?: string;
      } = {
        scopes,
        redirectUri: config.microsoft.redirectUri,
        state,
        codeChallenge,
        codeChallengeMethod: "S256",
      };

      // For integration flows, force consent screen to show permissions
      if (isIntegration) {
        authUrlOptions.prompt = "consent";
      }

      const authUrl = await cca.getAuthCodeUrl(authUrlOptions);

      res.json({
        success: true,
        authUrl,
        mode,
      });
    } catch (error) {
      loggingService.error("Error generating Microsoft auth URL", {
        error: error instanceof Error ? error.message : error,
        userId: req.user?.id,
      });
      throw createError("Failed to initiate Microsoft connection", 500);
    }
  }
);

// Conditional authentication middleware - only for integration flows
const conditionalAuth = async (
  req: AuthRequest,
  res: ExpressResponse,
  next: NextFunction
) => {
  // Prefer mode stored with state to avoid client mismatch
  const bodyMode = (req.body?.mode as OAuthMode | undefined) || "login";
  const stateFromBody: string | undefined = req.body?.state;
  const stored = stateFromBody ? await getOAuthState(stateFromBody) : undefined;
  const effectiveMode: OAuthMode = stored?.mode ?? bodyMode;

  if (effectiveMode === "integration") {
    return authenticateToken(req, res, next);
  }

  return next();
};

// Test Redis connection endpoint
router.get(
  "/test-redis",
  async (req: AuthRequest, res: ExpressResponse): Promise<void> => {
    try {
      const testKey = "test:redis:connection";
      const testValue = { timestamp: Date.now(), test: "redis connection" };

      await redisClient.set(testKey, JSON.stringify(testValue), "EX", 60);
      const retrieved = await redisClient.get(testKey);

      if (retrieved) {
        const parsed = JSON.parse(retrieved);
        res.json({
          success: true,
          message: "Redis connection working",
          stored: testValue,
          retrieved: parsed,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Redis retrieval failed",
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Redis test failed",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

// Handle Microsoft OAuth callback
router.post(
  "/callback",
  authLimiter,
  conditionalAuth, // Add conditional authentication
  async (req: AuthRequest, res: ExpressResponse): Promise<void> => {
    const { code, state, mode = "login" } = req.body;
    // Use stored mode if available to ensure correctness
    const storedForState = await getOAuthState(state);
    const effectiveMode: OAuthMode = (storedForState?.mode ??
      mode) as OAuthMode;
    const isRegistration = effectiveMode === "register";
    const isIntegration = effectiveMode === "integration";

    try {
      // Validate required parameters
      if (!code || !state) {
        throw createError("Missing authorization code or state", 400);
      }

      // Integration flow requires authenticated user
      if (isIntegration && !req.user) {
        throw createError("Authentication required for integration", 401);
      }

      // Retrieve and validate code verifier
      loggingService.info("Retrieving OAuth state", { state });
      const storedData = await getOAuthState(state);

      if (!storedData) {
        loggingService.error("OAuth state not found", { state });
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

      loggingService.info("OAuth state retrieved", {
        state,
        hasCodeVerifier: !!storedData.codeVerifier,
        codeVerifierLength: storedData.codeVerifier?.length,
        expiresAt: storedData.expiresAt,
        currentTime: Date.now(),
        mode: storedData.mode,
      });

      if (storedData.expiresAt < Date.now()) {
        loggingService.error("OAuth state expired", {
          state,
          expiresAt: storedData.expiresAt,
          currentTime: Date.now(),
        });
        await deleteOAuthState(state); // Clean up expired state
        throw createError(
          "OAuth session expired. Please try connecting again.",
          400
        );
      }

      // Use the same scope logic as connect endpoint
      let scopes: string[];
      if (isIntegration) {
        // Integration flow - request service scopes for existing users
        scopes = [
          "openid",
          "profile",
          "email",
          "User.Read",
          "Files.ReadWrite.All", // OneDrive
          "Sites.Read.All", // SharePoint sites access
          "Calendars.ReadWrite", // Outlook Calendar
          "offline_access",
        ];
      } else {
        // Registration/Login flow - request only basic scopes
        scopes = ["openid", "profile", "email", "User.Read", "offline_access"];
      }

      // Validate code verifier before token exchange
      if (!storedData.codeVerifier || storedData.codeVerifier.length < 32) {
        loggingService.error("Invalid code verifier", {
          state,
          codeVerifierLength: storedData.codeVerifier?.length,
          codeVerifier: storedData.codeVerifier,
        });
        throw createError("Invalid code verifier", 400);
      }

      // Exchange authorization code for tokens
      loggingService.info("Exchanging authorization code for tokens", {
        codeLength: code?.length,
        scopes,
        redirectUri: config.microsoft.redirectUri,
        codeVerifierLength: storedData.codeVerifier?.length,
        codeVerifierPrefix: storedData.codeVerifier?.substring(0, 10) + "...",
      });

      let user: import("@prisma/client").User;
      let tokenResponse: {
        accessToken: string;
        refreshToken?: string;
        expiresOn?: Date | null;
      };

      try {
        tokenResponse = await cca.acquireTokenByCode({
          code,
          scopes,
          redirectUri: config.microsoft.redirectUri,
          codeVerifier: storedData.codeVerifier,
        });

        loggingService.info("Token exchange successful", {
          hasAccessToken: !!tokenResponse.accessToken,
          hasRefreshToken: !!tokenResponse.refreshToken,
          expiresOn: tokenResponse.expiresOn,
        });

        // Clean up the OAuth state after successful token exchange
        await deleteOAuthState(state);

        // Continue with the rest of the flow...
        console.log("tokenResponse", tokenResponse);

        // Get user profile from Microsoft Graph
        const graphResponse = await fetch(
          "https://graph.microsoft.com/v1.0/me",
          {
            headers: {
              Authorization: `Bearer ${tokenResponse.accessToken}`,
            },
          }
        );

        if (!graphResponse.ok) {
          throw createError("Failed to get Microsoft profile", 500);
        }

        const profile = (await graphResponse.json()) as MicrosoftProfile;

        // Note: Account type validation (personal vs organizational) is now handled
        // by Azure AD App Registration configuration. Set "Accounts in any organizational
        // directory" to automatically block personal accounts at the OAuth level.

        if (isIntegration) {
          // Integration flow - update existing authenticated user with service tokens
          if (!req.user) {
            throw createError("User not authenticated", 401);
          }

          user = await prisma.user.update({
            where: { id: req.user.id },
            data: {
              microsoftAccessToken: tokenResponse.accessToken,
              microsoftRefreshToken:
                (tokenResponse as { refreshToken?: string }).refreshToken ||
                null,
              microsoftTokenExpiry:
                tokenResponse.expiresOn?.toISOString() || null,
              // Add service integration timestamp (existing field)
              microsoftConnectedAt: new Date(),
              // Keep existing Microsoft account info if it exists
              ...(req.user.microsoftAccountId
                ? {}
                : {
                    microsoftAccountId: profile.id,
                    microsoftEmail:
                      profile.mail || profile.userPrincipalName || null,
                    microsoftName: profile.displayName,
                    microsoftConnectedAt: new Date(),
                  }),
            },
          });
          // no-op
        } else if (isRegistration) {
          // Registration: Check if user already exists
          const existingUser = await prisma.user.findFirst({
            where: {
              OR: [
                { microsoftAccountId: profile.id },
                { email: profile.mail || profile.userPrincipalName || "" },
              ],
            },
          });

          if (existingUser) {
            throw createError(
              "User already exists with this Microsoft account",
              409
            );
          }

          // Create new user
          user = await prisma.user.create({
            data: {
              email: profile.mail || profile.userPrincipalName || "",
              firstName: profile.givenName || "",
              lastName: profile.surname || "",
              password: "", // Microsoft users don't need passwords
              role: "FREE",
              emailVerified: true,
              microsoftAccountId: profile.id,
              microsoftEmail: profile.mail || profile.userPrincipalName || null,
              microsoftName: profile.displayName,
              microsoftAccessToken: tokenResponse.accessToken,
              microsoftRefreshToken:
                (tokenResponse as { refreshToken?: string }).refreshToken ||
                null,
              microsoftTokenExpiry:
                tokenResponse.expiresOn?.toISOString() || null,
              microsoftConnectedAt: new Date(),
            },
          });
          // no-op
        } else {
          // Login: Update existing user or create if doesn't exist
          const existingUser = await prisma.user.findFirst({
            where: {
              OR: [
                { microsoftAccountId: profile.id },
                { email: profile.mail || profile.userPrincipalName || "" },
              ],
            },
          });

          if (existingUser) {
            // Update existing user
            user = await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                microsoftAccountId: profile.id,
                microsoftEmail:
                  profile.mail || profile.userPrincipalName || null,
                microsoftName: profile.displayName,
                microsoftAccessToken: tokenResponse.accessToken,
                microsoftRefreshToken:
                  (tokenResponse as { refreshToken?: string }).refreshToken ||
                  null,
                microsoftTokenExpiry:
                  tokenResponse.expiresOn?.toISOString() || null,
                microsoftConnectedAt: new Date(),
              },
            });
            // no-op
          } else {
            // Create new user (same as registration)
            user = await prisma.user.create({
              data: {
                email: profile.mail || profile.userPrincipalName || "",
                firstName: profile.givenName || "",
                lastName: profile.surname || "",
                password: "",
                role: "FREE",
                emailVerified: true,
                microsoftAccountId: profile.id,
                microsoftEmail:
                  profile.mail || profile.userPrincipalName || null,
                microsoftName: profile.displayName,
                microsoftAccessToken: tokenResponse.accessToken,
                microsoftRefreshToken:
                  (tokenResponse as { refreshToken?: string }).refreshToken ||
                  null,
                microsoftTokenExpiry:
                  tokenResponse.expiresOn?.toISOString() || null,
                microsoftConnectedAt: new Date(),
              },
            });
            // no-op
          }
        }
      } catch (tokenError) {
        loggingService.error("Token exchange failed", {
          error: tokenError instanceof Error ? tokenError.message : tokenError,
          state,
          codeLength: code?.length,
          redirectUri: config.microsoft.redirectUri,
        });

        // Clean up OAuth state on token exchange failure
        await deleteOAuthState(state);

        throw createError(
          `Token exchange failed: ${
            tokenError instanceof Error ? tokenError.message : "Unknown error"
          }`,
          400
        );
      }

      // Generate JWT token for authentication
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
        },
        config.auth.jwtSecret,
        { expiresIn: "7d" }
      );

      // Clean up
      await deleteOAuthState(state);

      let message: string;
      if (isIntegration) {
        message = "Microsoft services integrated successfully";
      } else if (isRegistration) {
        message = "Microsoft account registered successfully";
      } else {
        message = "Microsoft account connected successfully";
      }

      res.json({
        success: true,
        message,
        user: toJSON(user),
        token, // Include JWT token for frontend authentication (not needed for integration)
        mode: effectiveMode,
      });
    } catch (error) {
      if (state) {
        await deleteOAuthState(state);
      }

      loggingService.error("Microsoft callback error", {
        error: error instanceof Error ? error.message : error,
        mode: effectiveMode,
        userId: req.user?.id,
      });

      throw error;
    }
  }
);

// Calendar: list events for a simple window (e.g., next 30 days)
router.get(
  "/calendar/events",
  authLimiter,
  authenticateToken,
  async (req: AuthRequest, res: ExpressResponse): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
      }

      const start = (req.query["start"] as string) || new Date().toISOString();
      const end =
        (req.query["end"] as string) ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const params = new URLSearchParams({
        $select: "subject,bodyPreview,start,end,organizer,location,webLink",
        $orderby: "start/dateTime",
        $top: "100",
        startDateTime: start,
        endDateTime: end,
      });

      const response = await graphFetch(
        req.user.id,
        `https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`
      );
      if (!response) {
        res
          .status(400)
          .json({ success: false, error: "Microsoft not connected" });
        return;
      }

      if (!response.ok) {
        const text = await response.text();
        loggingService.error("Graph calendar fetch failed", { text });
        // Map Graph auth issues to a clearer client error
        const status = response.status;
        if (status === 401 || status === 403) {
          res.status(400).json({
            success: false,
            error:
              "Microsoft token invalid or expired. Please reconnect Microsoft in Settings → Integrations.",
            code: "MICROSOFT_AUTH_INVALID",
          });
        } else {
          res
            .status(502)
            .json({ success: false, error: "Failed to fetch events" });
        }
        return;
      }

      const data = (await response.json()) as { value: unknown[] };
      res.json({ success: true, events: data.value });
    } catch (error) {
      loggingService.error("Calendar events error", {
        error,
        userId: req.user?.id,
      });
      throw createError("Failed to fetch calendar events", 500);
    }
  }
);

// Calendar: create an event
router.post(
  "/calendar/events",
  authLimiter,
  authenticateToken,
  async (req: AuthRequest, res: ExpressResponse): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
      }

      const accessToken = await getValidMicrosoftAccessToken(req.user.id);
      if (!accessToken) {
        res.status(400).json({
          success: false,
          error:
            "Microsoft token invalid or expired. Please reconnect Microsoft in Settings → Integrations.",
          code: "MICROSOFT_AUTH_INVALID",
        });
        return;
      }

      // Basic validation for minimal event fields
      const { subject, start, end, location, body } = req.body as {
        subject?: string;
        start?: { dateTime: string; timeZone?: string };
        end?: { dateTime: string; timeZone?: string };
        location?: { displayName?: string };
        body?: { contentType?: "Text" | "HTML"; content?: string };
      };

      if (!subject || !start?.dateTime || !end?.dateTime) {
        res.status(400).json({
          success: false,
          error: "subject, start.dateTime and end.dateTime are required",
        });
        return;
      }

      const payload = {
        subject,
        start: { dateTime: start.dateTime, timeZone: start.timeZone || "UTC" },
        end: { dateTime: end.dateTime, timeZone: end.timeZone || "UTC" },
        ...(location ? { location } : {}),
        ...(body ? { body } : {}),
      };

      const response = await fetch(
        "https://graph.microsoft.com/v1.0/me/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const status = response.status;
        if (status === 401 || status === 403) {
          res.status(400).json({
            success: false,
            error:
              "Microsoft token invalid or expired. Please reconnect Microsoft in Settings → Integrations.",
            code: "MICROSOFT_AUTH_INVALID",
          });
          return;
        }
        res
          .status(502)
          .json({ success: false, error: "Failed to create event" });
        return;
      }

      const data = (await response.json()) as unknown;
      res.json({ success: true, event: data });
    } catch {
      throw createError("Failed to create calendar event", 500);
    }
  }
);

// Calendar: update an event (time/subject/location)
router.patch(
  "/calendar/events/:eventId",
  authLimiter,
  authenticateToken,
  async (req: AuthRequest, res: ExpressResponse): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
      }

      const { eventId } = req.params as { eventId: string };
      const { subject, start, end, location } = req.body as {
        subject?: string;
        start?: { dateTime: string; timeZone?: string };
        end?: { dateTime: string; timeZone?: string };
        location?: { displayName?: string };
      };

      if (!eventId) {
        res.status(400).json({ success: false, error: "Missing eventId" });
        return;
      }

      const accessToken = await getValidMicrosoftAccessToken(req.user.id);
      if (!accessToken) {
        res.status(400).json({
          success: false,
          error:
            "Microsoft token invalid or expired. Please reconnect Microsoft in Settings → Integrations.",
          code: "MICROSOFT_AUTH_INVALID",
        });
        return;
      }

      const payload: Record<string, unknown> = {};
      if (subject) payload["subject"] = subject;
      if (start?.dateTime) {
        payload["start"] = {
          dateTime: start.dateTime,
          timeZone: start.timeZone || "UTC",
        };
      }
      if (end?.dateTime) {
        payload["end"] = {
          dateTime: end.dateTime,
          timeZone: end.timeZone || "UTC",
        };
      }
      if (location) payload["location"] = location;

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(
          eventId
        )}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const status = response.status;
        if (status === 401 || status === 403) {
          res.status(400).json({
            success: false,
            error:
              "Microsoft token invalid or expired. Please reconnect Microsoft in Settings → Integrations.",
            code: "MICROSOFT_AUTH_INVALID",
          });
          return;
        }
        res
          .status(502)
          .json({ success: false, error: "Failed to update event" });
        return;
      }

      const data = (await response.json()) as unknown;
      res.json({ success: true, event: data });
    } catch {
      throw createError("Failed to update calendar event", 500);
    }
  }
);

// Files: list OneDrive root children
router.get(
  "/files/onedrive",
  authLimiter,
  authenticateToken,
  async (req: AuthRequest, res: ExpressResponse): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
      }

      const path = (req.query["path"] as string) || "/";
      const url =
        path === "/"
          ? "https://graph.microsoft.com/v1.0/me/drive/root/children"
          : `https://graph.microsoft.com/v1.0/me/drive/root:${encodeURI(
              path
            )}:/children`;

      const response = await graphFetch(req.user.id, url);
      if (!response) {
        res
          .status(400)
          .json({ success: false, error: "Microsoft not connected" });
        return;
      }
      if (!response.ok) {
        const text = await response.text();
        loggingService.error("Graph OneDrive fetch failed", { text });
        const status = response.status;
        if (status === 401 || status === 403) {
          res.status(400).json({
            success: false,
            error:
              "Microsoft token invalid or expired. Please reconnect Microsoft in Settings → Integrations.",
            code: "MICROSOFT_AUTH_INVALID",
          });
        } else {
          res
            .status(502)
            .json({ success: false, error: "Failed to fetch files" });
        }
        return;
      }
      const data = (await response.json()) as { value: unknown[] };
      res.json({ success: true, items: data.value });
    } catch (error) {
      loggingService.error("OneDrive list error", {
        error,
        userId: req.user?.id,
      });
      throw createError("Failed to fetch OneDrive items", 500);
    }
  }
);

// Files: upload to OneDrive root or provided path (simple upload for files <= 20MB)
router.post(
  "/files/onedrive/upload",
  authLimiter,
  authenticateToken,
  upload.single("file"),
  async (req: AuthRequest, res: ExpressResponse): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
      }

      const file = (req as unknown as { file?: Express.Multer.File }).file;
      const rawPath = (req.query["path"] as string) || "/";
      if (!file) {
        res.status(400).json({ success: false, error: "No file provided" });
        return;
      }

      // Sanitize path: ensure it starts with '/'
      const basePath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
      const safeFileName = file.originalname.replace(/[^\w.\- ]+/g, "_");
      const targetPath =
        basePath === "/" ? `/${safeFileName}` : `${basePath}/${safeFileName}`;

      const accessToken = await getValidMicrosoftAccessToken(req.user.id);
      if (!accessToken) {
        res
          .status(400)
          .json({ success: false, error: "Microsoft not connected" });
        return;
      }

      const url =
        `https://graph.microsoft.com/v1.0/me/drive/root:${encodeURI(
          targetPath
        )}` + ":/content";

      const response = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/octet-stream",
        },
        body: new Uint8Array(file.buffer),
      });

      if (!response.ok) {
        const text = await response.text();
        loggingService.error("Graph OneDrive upload failed", { text });
        const status = response.status;
        if (status === 401 || status === 403) {
          res.status(400).json({
            success: false,
            error:
              "Microsoft token invalid or expired. Please reconnect Microsoft in Settings → Integrations.",
            code: "MICROSOFT_AUTH_INVALID",
          });
        } else if (status === 413) {
          res.status(413).json({
            success: false,
            error: "File too large for simple upload (max 4MB).",
            code: "FILE_TOO_LARGE",
          });
        } else {
          res
            .status(502)
            .json({ success: false, error: "Failed to upload file" });
        }
        return;
      }

      const data = (await response.json()) as unknown;
      res.json({ success: true, item: data });
    } catch (error) {
      loggingService.error("OneDrive upload error", {
        error,
        userId: req.user?.id,
      });
      throw createError("Failed to upload to OneDrive", 500);
    }
  }
);

// Files: list SharePoint followed sites and default document libraries (basic)
router.get(
  "/files/sharepoint/sites",
  authLimiter,
  authenticateToken,
  async (req: AuthRequest, res: ExpressResponse): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
      }

      const response = await graphFetch(
        req.user.id,
        "https://graph.microsoft.com/v1.0/me/followedSites"
      );
      if (!response) {
        res
          .status(400)
          .json({ success: false, error: "Microsoft not connected" });
        return;
      }
      if (!response.ok) {
        const text = await response.text();
        loggingService.error("Graph followed sites failed", { text });
        const status = response.status;
        if (status === 401 || status === 403) {
          res.status(400).json({
            success: false,
            error:
              "Microsoft token invalid or expired. Please reconnect Microsoft in Settings → Integrations.",
            code: "MICROSOFT_AUTH_INVALID",
          });
        } else {
          res
            .status(502)
            .json({ success: false, error: "Failed to fetch sites" });
        }
        return;
      }
      const data = (await response.json()) as { value: unknown[] };
      res.json({ success: true, sites: data.value });
    } catch (error) {
      loggingService.error("SharePoint sites error", {
        error,
        userId: req.user?.id,
      });
      throw createError("Failed to fetch SharePoint sites", 500);
    }
  }
);

router.get(
  "/files/sharepoint/site/:siteId/drives",
  authLimiter,
  authenticateToken,
  async (req: AuthRequest, res: ExpressResponse): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
      }

      const { siteId } = req.params as { siteId: string };
      const response = await graphFetch(
        req.user.id,
        `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(
          siteId
        )}/drives`
      );
      if (!response) {
        res
          .status(400)
          .json({ success: false, error: "Microsoft not connected" });
        return;
      }
      if (!response.ok) {
        const text = await response.text();
        loggingService.error("Graph site drives failed", { text });
        const status = response.status;
        if (status === 401 || status === 403) {
          res.status(400).json({
            success: false,
            error:
              "Microsoft token invalid or expired. Please reconnect Microsoft in Settings → Integrations.",
            code: "MICROSOFT_AUTH_INVALID",
          });
        } else {
          res
            .status(502)
            .json({ success: false, error: "Failed to fetch drives" });
        }
        return;
      }
      const data = (await response.json()) as { value: unknown[] };
      res.json({ success: true, drives: data.value });
    } catch (error) {
      loggingService.error("SharePoint drives error", {
        error,
        userId: req.user?.id,
      });
      throw createError("Failed to fetch SharePoint drives", 500);
    }
  }
);

router.get(
  "/files/sharepoint/drive/:driveId/children",
  authLimiter,
  authenticateToken,
  async (req: AuthRequest, res: ExpressResponse): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
      }

      const { driveId } = req.params as { driveId: string };
      const folderId = (req.query["folderId"] as string) || "root";
      const url =
        folderId === "root"
          ? `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(
              driveId
            )}/root/children`
          : `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(
              driveId
            )}/items/${encodeURIComponent(folderId)}/children`;

      const response = await graphFetch(req.user.id, url);
      if (!response) {
        res
          .status(400)
          .json({ success: false, error: "Microsoft not connected" });
        return;
      }
      if (!response.ok) {
        const text = await response.text();
        loggingService.error("Graph drive children failed", { text });
        const status = response.status;
        if (status === 401 || status === 403) {
          res.status(400).json({
            success: false,
            error:
              "Microsoft token invalid or expired. Please reconnect Microsoft in Settings → Integrations.",
            code: "MICROSOFT_AUTH_INVALID",
          });
        } else {
          res
            .status(502)
            .json({ success: false, error: "Failed to fetch items" });
        }
        return;
      }
      const data = (await response.json()) as { value: unknown[] };
      res.json({ success: true, items: data.value });
    } catch (error) {
      loggingService.error("SharePoint children error", {
        error,
        userId: req.user?.id,
      });
      throw createError("Failed to fetch SharePoint items", 500);
    }
  }
);

// Get Microsoft connection status
router.get(
  "/status",
  authLimiter,
  authenticateToken,
  async (req: AuthRequest, res: ExpressResponse): Promise<void> => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user?.id || "" },
        select: {
          microsoftAccountId: true,
          microsoftEmail: true,
          microsoftName: true,
          microsoftConnectedAt: true,
          password: true,
        },
      });

      const canUnlinkLogin = Boolean(
        user?.password && user.password.length > 0
      );

      res.json({
        success: true,
        connected: !!user?.microsoftAccountId,
        microsoftEmail: user?.microsoftEmail,
        microsoftName: user?.microsoftName,
        connectedAt: user?.microsoftConnectedAt,
        canUnlinkLogin,
      });
    } catch (error) {
      loggingService.error("Error getting Microsoft status", {
        error: error instanceof Error ? error.message : error,
        userId: req.user?.id,
      });
      throw createError("Failed to get Microsoft status", 500);
    }
  }
);

// Disconnect Microsoft services (integration-only)
// Keeps account link but removes service tokens
router.delete(
  "/integration/disconnect",
  authLimiter,
  authenticateToken,
  async (req: AuthRequest, res: ExpressResponse): Promise<void> => {
    try {
      const user = await prisma.user.update({
        where: { id: req.user?.id || "" },
        data: {
          microsoftAccessToken: null,
          microsoftRefreshToken: null,
          microsoftTokenExpiry: null,
        },
      });

      res.json({
        success: true,
        message: "Microsoft services disconnected successfully",
        user,
      });
    } catch (error) {
      loggingService.error("Error disconnecting Microsoft services", {
        error: error instanceof Error ? error.message : error,
        userId: req.user?.id,
      });
      throw createError("Failed to disconnect Microsoft services", 500);
    }
  }
);

// Disconnect Microsoft account
router.delete(
  "/disconnect",
  authLimiter,
  authenticateToken,
  async (req: AuthRequest, res: ExpressResponse): Promise<void> => {
    try {
      const user = await prisma.user.update({
        where: { id: req.user?.id || "" },
        data: {
          microsoftAccountId: null,
          microsoftEmail: null,
          microsoftName: null,
          microsoftAccessToken: null,
          microsoftRefreshToken: null,
          microsoftTokenExpiry: null,
          microsoftConnectedAt: null,
        },
      });

      res.json({
        success: true,
        message: "Microsoft account disconnected successfully",
        user,
      });
    } catch (error) {
      loggingService.error("Error disconnecting Microsoft account", {
        error: error instanceof Error ? error.message : error,
        userId: req.user?.id,
      });
      throw createError("Failed to disconnect Microsoft account", 500);
    }
  }
);

export default router;
