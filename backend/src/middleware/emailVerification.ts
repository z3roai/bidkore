import type { NextFunction, Response } from "express";

import type { AuthRequest } from "@/middleware/auth";

export const requireEmailVerification = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (!req.user.emailVerified) {
    res.status(403).json({
      error: "Email verification required",
      message: "Please verify your email address to access this feature",
      emailVerificationRequired: true,
    });
    return;
  }

  next();
};

export const optionalEmailVerification = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // Add email verification status to the response for frontend handling
  req.emailVerificationRequired = !req.user.emailVerified;
  next();
};
