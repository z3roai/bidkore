import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import config from "@/config/env";
import loggingService from "@/services/loggingService";

const router = Router();
const prisma = new PrismaClient();

// Schema for OAuth handler request
const oauthHandlerSchema = z.object({
  provider: z.enum(["google", "microsoft"]),
  providerId: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  image: z.string().optional(),
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.number().optional(),
});

type OAuthHandlerRequest = z.infer<typeof oauthHandlerSchema>;

// Generate JWT token
const generateToken = (userId: string): string => {
  const secret = config.auth.jwtSecret;
  return jwt.sign({ userId }, secret, { expiresIn: "7d" });
};

// Helper function to convert Prisma user to JSON
const toJSON = (user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  avatar?: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  isActive: user.isActive,
  emailVerified: user.emailVerified,
  avatar: user.avatar,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// OAuth handler endpoint
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      provider,
      providerId,
      email,
      name,
      accessToken,
      refreshToken,
      expiresAt,
    } = req.body as OAuthHandlerRequest;

    // Validate request body
    const validationResult = oauthHandlerSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        error: "Invalid request data",
        details: validationResult.error.errors,
      });
      return;
    }

    // Parse name into firstName and lastName
    const nameParts = name?.split(" ") || [];
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Check if user already exists
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(provider === "google" ? [{ googleAccountId: providerId }] : []),
          ...(provider === "microsoft"
            ? [{ microsoftAccountId: providerId }]
            : []),
        ],
      },
    });

    if (user) {
      // Update existing user with OAuth data
      const updateData: {
        lastLoginAt: Date;
        googleAccountId?: string;
        googleEmail?: string;
        googleName?: string;
        googleAccessToken?: string;
        googleRefreshToken?: string;
        googleTokenExpiry?: Date | null;
        googleConnectedAt?: Date;
        microsoftAccountId?: string;
        microsoftEmail?: string;
        microsoftName?: string;
        microsoftAccessToken?: string;
        microsoftRefreshToken?: string;
        microsoftTokenExpiry?: Date | null;
        microsoftConnectedAt?: Date;
      } = {
        lastLoginAt: new Date(),
      };

      if (provider === "google") {
        updateData.googleAccountId = providerId;
        updateData.googleEmail = email;
        updateData.googleName = name;
        updateData.googleAccessToken = accessToken;
        updateData.googleRefreshToken = refreshToken;
        updateData.googleTokenExpiry = expiresAt
          ? new Date(expiresAt * 1000)
          : null;
        updateData.googleConnectedAt = new Date();
      } else if (provider === "microsoft") {
        updateData.microsoftAccountId = providerId;
        updateData.microsoftEmail = email;
        updateData.microsoftName = name;
        updateData.microsoftAccessToken = accessToken;
        updateData.microsoftRefreshToken = refreshToken;
        updateData.microsoftTokenExpiry = expiresAt
          ? new Date(expiresAt * 1000)
          : null;
        updateData.microsoftConnectedAt = new Date();
      }

      user = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      loggingService.info(
        `Updated existing user ${user.id} with ${provider} OAuth data`
      );
    } else {
      // Create new user
      const createData: {
        email: string;
        firstName: string;
        lastName: string;
        password: string;
        role: "FREE" | "PREMIUM" | "ENTERPRISE" | "ADMIN";
        isActive: boolean;
        emailVerified: boolean;
        lastLoginAt: Date;
        googleAccountId?: string;
        googleEmail?: string;
        googleName?: string;
        googleAccessToken?: string;
        googleRefreshToken?: string;
        googleTokenExpiry?: Date | null;
        googleConnectedAt?: Date;
        microsoftAccountId?: string;
        microsoftEmail?: string;
        microsoftName?: string;
        microsoftAccessToken?: string;
        microsoftRefreshToken?: string;
        microsoftTokenExpiry?: Date | null;
        microsoftConnectedAt?: Date;
      } = {
        email,
        firstName,
        lastName,
        password: "", // No password for OAuth users
        role: "FREE",
        isActive: true,
        emailVerified: true, // OAuth emails are pre-verified
        lastLoginAt: new Date(),
      };

      if (provider === "google") {
        createData.googleAccountId = providerId;
        createData.googleEmail = email;
        createData.googleName = name;
        createData.googleAccessToken = accessToken;
        createData.googleRefreshToken = refreshToken;
        createData.googleTokenExpiry = expiresAt
          ? new Date(expiresAt * 1000)
          : null;
        createData.googleConnectedAt = new Date();
      } else if (provider === "microsoft") {
        createData.microsoftAccountId = providerId;
        createData.microsoftEmail = email;
        createData.microsoftName = name;
        createData.microsoftAccessToken = accessToken;
        createData.microsoftRefreshToken = refreshToken;
        createData.microsoftTokenExpiry = expiresAt
          ? new Date(expiresAt * 1000)
          : null;
        createData.microsoftConnectedAt = new Date();
      }

      user = await prisma.user.create({
        data: createData,
      });

      loggingService.info(`Created new user ${user.id} with ${provider} OAuth`);
    }

    // Generate JWT token
    const token = generateToken(user.id);

    res.json({
      success: true,
      message: `Successfully ${
        user ? "updated" : "created"
      } user with ${provider}`,
      token,
      user: toJSON(user),
    });
  } catch (error) {
    loggingService.error("OAuth handler error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
