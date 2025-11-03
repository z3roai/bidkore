import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Request } from "express";
import multer, { type FileFilterCallback } from "multer";

import loggingService from "@/services/loggingService";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) {
	fs.mkdirSync(uploadsDir, { recursive: true });
}

// Ensure avatars and logos subdirectories exist
const avatarsDir = path.join(uploadsDir, "avatars");
const logosDir = path.join(uploadsDir, "logos");
if (!fs.existsSync(avatarsDir)) {
	fs.mkdirSync(avatarsDir, { recursive: true });
}
if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

// Configure multer for avatar uploads
const storage = multer.diskStorage({
	destination: (
		_req: Request,
		_file: Express.Multer.File,
		cb: (error: Error | null, destination: string) => void
	) => {
		cb(null, avatarsDir);
	},
	filename: (
		_req: Request,
		file: Express.Multer.File,
		cb: (error: Error | null, filename: string) => void
	) => {
		const uniqueName = `${randomUUID()}${path.extname(file.originalname)}`;
		cb(null, uniqueName);
	},
});

// File filter for avatar uploads
const fileFilter = (
	_req: Request,
	file: Express.Multer.File,
	cb: FileFilterCallback
): void => {
	// Check file type
	if (file.mimetype.startsWith("image/")) {
		cb(null, true);
	} else {
		cb(new Error("Only image files are allowed for avatars"));
	}
};

// Configure multer
export const uploadAvatar = multer({
	storage,
	fileFilter,
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB limit
	},
});

// Helper function to get avatar URL
export const getAvatarUrl = (filename: string): string => {
	return `/uploads/avatars/${filename}`;
};

// Helper function to delete avatar file
export const deleteAvatarFile = (filename: string): void => {
	try {
		const filePath = path.join(avatarsDir, filename);
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
			loggingService.info(`Avatar file deleted: ${filename}`);
		}
	} catch (error) {
		loggingService.error(`Failed to delete avatar file ${filename}:`, error);
		throw error;
	}
};

// Helper function to extract filename from URL
export const extractFilenameFromUrl = (url: string): string | null => {
	// Handle both relative and absolute URLs
	const match = url.match(/\/(?:uploads\/avatars|.*\/uploads\/avatars)\/(.+)$/);
	return match?.[1] ?? null;
};

// Logo upload configuration (reusing same fileFilter and limits)
const logoStorage = multer.diskStorage({
  destination: (
    _req: Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    cb(null, logosDir);
  },
  filename: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    const uniqueName = `${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

export const uploadLogo = multer({
  storage: logoStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export const getLogoUrl = (filename: string): string => {
  return `/uploads/logos/${filename}`;
};

export const deleteLogoFile = (filename: string): void => {
  try {
    const filePath = path.join(logosDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      loggingService.info(`Logo file deleted: ${filename}`);
    }
  } catch (error) {
    loggingService.error(`Failed to delete logo file ${filename}:`, error);
    throw error;
  }
};

export const extractLogoFilenameFromUrl = (url: string): string | null => {
  const match = url.match(/\/(?:uploads\/logos|.*\/uploads\/logos)\/(.+)$/);
  return match?.[1] ?? null;
};
