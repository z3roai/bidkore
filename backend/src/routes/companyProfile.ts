import { type Response, Router } from "express";

import { type AuthRequest, authenticateToken } from "@/middleware/auth";
import { requireEmailVerification } from "@/middleware/emailVerification";
import { validateRequest } from "@/middleware/validation";
import CompanyProfile from "@/models/CompanyProfile";
import { saveCompanyProfileSchema } from "@/schemas/companyProfile";
import {
  deleteLogoFile,
  extractLogoFilenameFromUrl,
  getLogoUrl,
  uploadLogo,
} from "@/services/fileUploadService";
import loggingService from "@/services/loggingService";

const router = Router();

// Get current user's company profile
router.get(
  "/",
  authenticateToken,
  requireEmailVerification,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const profile = await CompanyProfile.findByUserId(req.user.id);
      res.json({ profile: profile ?? null });
    } catch (error) {
      loggingService.error("Get company profile error:", error);
      res.status(500).json({ error: "Failed to get company profile" });
    }
  }
);

// Save (upsert) company profile
router.put(
  "/",
  authenticateToken,
  requireEmailVerification,
  validateRequest(saveCompanyProfileSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const updated = await CompanyProfile.upsertByUserId(req.user.id, req.body);
      res.json({ message: "Company profile saved", profile: updated });
    } catch (error) {
      loggingService.error("Save company profile error:", error);
      res.status(500).json({ error: "Failed to save company profile" });
    }
  }
);

// Upload company logo
router.post(
  "/logo",
  authenticateToken,
  requireEmailVerification,
  uploadLogo.single("logo"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const existing = await CompanyProfile.findByUserId(req.user.id);
      // Delete old logo if any
      if (existing?.logoUrl) {
        const fn = extractLogoFilenameFromUrl(existing.logoUrl);
        if (fn) {
          try {
            deleteLogoFile(fn);
          } catch (e) {
            loggingService.warn("Failed to delete old logo:", e);
          }
        }
      }

      const logoUrl = getLogoUrl(req.file.filename);
      const profile = await CompanyProfile.upsertByUserId(req.user.id, {
        logoUrl,
      });

      res.json({ message: "Logo uploaded", logoUrl, profile });
    } catch (error) {
      loggingService.error("Upload logo error:", error);
      res.status(500).json({ error: "Failed to upload logo" });
    }
  }
);

// Delete company logo
router.delete(
  "/logo",
  authenticateToken,
  requireEmailVerification,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const existing = await CompanyProfile.findByUserId(req.user.id);
      if (!existing?.logoUrl) {
        res.status(400).json({ error: "No logo to delete" });
        return;
      }
      const fn = extractLogoFilenameFromUrl(existing.logoUrl);
      if (fn) {
        try {
          deleteLogoFile(fn);
        } catch (e) {
          loggingService.warn("Failed to delete logo file:", e);
        }
      }

      const profile = await CompanyProfile.updateLogo(req.user.id, null);
      res.json({ message: "Logo deleted", profile });
    } catch (error) {
      loggingService.error("Delete logo error:", error);
      res.status(500).json({ error: "Failed to delete logo" });
    }
  }
);

export default router;


