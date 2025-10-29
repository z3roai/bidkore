import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import config from "@/config/env";
import type { SubscriptionType, UserType } from "@/models";
import User, { UserRole } from "@/models/User";
import loggingService from "@/services/loggingService";

export interface AuthRequest extends Request {
  user?: UserType;
  subscription?: SubscriptionType;
  premiumAttachmentAccess?: boolean;
  emailVerificationRequired?: boolean;
  query: Request["query"];
  body: Request["body"];
  params: Request["params"];
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    loggingService.debug("Auth Debug:", {
      url: req.url,
      hasAuthHeader: Boolean(authHeader),
      hasToken: Boolean(token),
      tokenLength: token?.length,
      tokenStart: `${token?.substring(0, 20)}...`,
    });

    if (!token) {
      loggingService.warn("No token provided");
      res.status(401).json({ error: "Access token required" });
      return;
    }

    const secret = config.auth.jwtSecret;
    if (!secret) {
      loggingService.error("JWT secret not configured");
      res.status(500).json({ error: "JWT secret not configured" });
      return;
    }

    const decoded = jwt.verify(token, secret) as { userId: string };

    const user = await User.findByPk(decoded.userId);

    if (!user?.isActive) {
      loggingService.warn("User not found or inactive:", {
        userId: decoded.userId,
        userExists: Boolean(user),
        isActive: user?.isActive,
      });
      res.status(401).json({ error: "Invalid or inactive user" });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    loggingService.error("Auth error:", error);
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: "Invalid token" });
    } else {
      res.status(500).json({ error: "Authentication error" });
    }
  }
};

export const requireRole = (roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    next();
  };
};

export const requirePremium = requireRole([UserRole.PREMIUM, UserRole.ADMIN]);
export const requireAdmin = requireRole([UserRole.ADMIN]);
