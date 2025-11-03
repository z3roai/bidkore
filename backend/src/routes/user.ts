import { type Response, Router } from "express";

import {
	type AuthRequest,
	authenticateToken,
	requireAdmin,
} from "../middleware/auth";
import {
	deleteAvatarFile,
	extractFilenameFromUrl,
	getAvatarUrl,
	uploadAvatar,
} from "../services/fileUploadService";

import { requireEmailVerification } from "@/middleware/emailVerification";
import { validateRequest } from "@/middleware/validation";
import User, { toJSON, UserRole } from "@/models/User";
import { changePasswordSchema, updateProfileSchema, userSettingsSchema } from "@/schemas/user";
import loggingService from "@/services/loggingService";
import { getUserSettings, upsertUserSettings } from "@/services/preferencesService";
import { exportUserData } from "@/services/dataExportService";
import {
	TeamOwnershipError,
	deleteUserPermanently,
} from "@/services/userDeletionService";

const router = Router();

// Get all users (admin only)
router.get(
	"/",
	authenticateToken,
	requireAdmin,
	async (_req: AuthRequest, res: Response): Promise<void> => {
		try {
			const users = await User.findAll({
				select: {
					id: true,
					email: true,
					firstName: true,
					lastName: true,
					role: true,
					isActive: true,
					emailVerified: true,
					avatar: true,
					createdAt: true,
					updatedAt: true,
				},
				orderBy: { createdAt: "desc" },
			});

			res.json({
				users,
				count: users.length,
			});
		} catch (error) {
			loggingService.error("Get users error:", error);
			res.status(500).json({ error: "Failed to get users" });
		}
	}
);

// Get user settings
router.get(
	"/settings",
	authenticateToken,
	requireEmailVerification,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const settings = await getUserSettings(req.user.id);
			res.json({ settings });
		} catch (error) {
			loggingService.error("Get user settings error:", error);
			res.status(500).json({ error: "Failed to get user settings" });
		}
	}
);

// Update user settings
router.put(
	"/settings",
	authenticateToken,
	requireEmailVerification,
	validateRequest(userSettingsSchema),
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const updated = await upsertUserSettings(req.user.id, req.body as Record<string, unknown>);
			res.json({ message: "Settings updated successfully", settings: updated });
		} catch (error) {
			loggingService.error("Update user settings error:", error);
			res.status(500).json({ error: "Failed to update user settings" });
		}
	}
);

// Export user data
router.post(
	"/export",
	authenticateToken,
	requireEmailVerification,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const result = await exportUserData(req.user.id);
			res.json({ message: "Data export generated", downloadUrl: result.publicUrl });
		} catch (error) {
			loggingService.error("Export user data error:", error);
			res.status(500).json({ error: "Failed to export user data" });
		}
	}
);

// Permanently delete account
router.delete(
	"/account/permanent",
	authenticateToken,
	requireEmailVerification,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const { confirm, email } = (req.body || {}) as {
				confirm?: boolean;
				email?: string;
			};

			if (!confirm) {
				res.status(400).json({ error: "Confirmation required" });
				return;
			}

			if (email && email !== req.user.email) {
				res.status(400).json({ error: "Email does not match current user" });
				return;
			}

			await deleteUserPermanently(req.user.id);
			res.json({ message: "Account permanently deleted" });
		} catch (error) {
			if (error instanceof TeamOwnershipError) {
				res.status(409).json({
					error: "User owns teams. Transfer ownership or delete teams first.",
				});
				return;
			}
			loggingService.error("Permanent account deletion error:", error);
			res.status(500).json({ error: "Failed to permanently delete account" });
		}
	}
);

// Get user by ID (admin only)
router.get(
	"/:id",
	authenticateToken,
	requireAdmin,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			const { id } = req.params;
			if (!id) {
				res.status(400).json({ error: "User ID is required" });
				return;
			}
			const user = await User.findOne({ where: { id } });
			if (user) {
				// Sanitize user data before sending to client
				res.json({ user: toJSON(user) });
				return;
			}

			res.status(404).json({ error: "User not found" });
		} catch (error) {
			loggingService.error("Get user error:", error);
			res.status(500).json({ error: "Failed to get user" });
		}
	}
);

// Update user profile
router.put(
	"/profile",
	authenticateToken,
	requireEmailVerification,
	validateRequest(updateProfileSchema),
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			await User.update(req.body, { where: { id: req.user.id } });

			// Get updated user data
			const updatedUser = await User.findOne({ where: { id: req.user.id } });
			if (!updatedUser) {
				res.status(404).json({ error: "User not found" });
				return;
			}

			res.json({
				message: "Profile updated successfully",
				user: toJSON(updatedUser),
			});
		} catch (error) {
			loggingService.error("Update profile error:", error);
			res.status(500).json({ error: "Failed to update profile" });
		}
	}
);

// Change password
router.put(
	"/change-password",
	authenticateToken,
	validateRequest(changePasswordSchema),
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const { currentPassword, newPassword } = req.body as {
				currentPassword: string;
				newPassword: string;
			};

			// Verify current password
			const bcrypt = await import("bcryptjs");
			const isValidPassword = await bcrypt.default.compare(
				currentPassword,
				req.user.password
			);
			if (!isValidPassword) {
				res.status(400).json({ error: "Current password is incorrect" });
				return;
			}

			// Hash new password
			const hashedPassword = await bcrypt.default.hash(newPassword, 12);

			// Update password and track last change time
			await User.update(
				{ password: hashedPassword, lastPasswordChangeAt: new Date() },
				{ where: { id: req.user.id } }
			);

			res.json({
				message: "Password changed successfully",
			});
		} catch (error) {
			loggingService.error("Change password error:", error);
			res.status(500).json({ error: "Failed to change password" });
		}
	}
);

// Deactivate account
router.delete(
	"/account",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			await User.update({ isActive: false }, { where: { id: req.user.id } });

			res.json({
				message: "Account deactivated successfully",
			});
		} catch (error) {
			loggingService.error("Deactivate account error:", error);
			res.status(500).json({ error: "Failed to deactivate account" });
		}
	}
);

// Upload avatar
router.post(
	"/avatar",
	authenticateToken,
	uploadAvatar.single("avatar"),
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

			// Delete old avatar if it exists
			if (req.user.avatar) {
				const oldFilename = extractFilenameFromUrl(req.user.avatar);
				if (oldFilename) {
					try {
						deleteAvatarFile(oldFilename);
					} catch (error) {
						loggingService.warn("Failed to delete old avatar:", error);
					}
				}
			}

			// Update user with new avatar URL
			const avatarUrl = getAvatarUrl(req.file.filename);
			await User.update({ avatar: avatarUrl }, { where: { id: req.user.id } });

			// Get updated user data
			const updatedUser = await User.findOne({ where: { id: req.user.id } });
			if (!updatedUser) {
				res.status(404).json({ error: "User not found" });
				return;
			}

			loggingService.info("Avatar upload successful:", {
				userId: req.user.id,
				avatarUrl,
				userAvatar: updatedUser.avatar,
			});

			res.json({
				message: "Avatar uploaded successfully",
				avatarUrl,
				user: toJSON(updatedUser),
			});
		} catch (error) {
			loggingService.error("Avatar upload error:", error);
			res.status(500).json({ error: "Failed to upload avatar" });
		}
	}
);

// Delete avatar
router.delete(
	"/avatar",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			if (!req.user.avatar) {
				res.status(400).json({ error: "No avatar to delete" });
				return;
			}

			// Delete avatar file
			const filename = extractFilenameFromUrl(req.user.avatar);
			if (filename) {
				try {
					deleteAvatarFile(filename);
				} catch (error) {
					loggingService.warn("Failed to delete avatar file:", error);
				}
			}

			// Update user to remove avatar
			await User.update({ avatar: null }, { where: { id: req.user.id } });

			// Get updated user data
			const updatedUser = await User.findOne({ where: { id: req.user.id } });
			if (!updatedUser) {
				res.status(404).json({ error: "User not found" });
				return;
			}

			res.json({
				message: "Avatar deleted successfully",
				user: toJSON(updatedUser),
			});
		} catch (error) {
			loggingService.error("Avatar delete error:", error);
			res.status(500).json({ error: "Failed to delete avatar" });
		}
	}
);

// Update user role (admin only)
router.put(
	"/:id/role",
	authenticateToken,
	requireAdmin,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			const { id } = req.params;
			const { role } = req.body as { role: UserRole };

			if (!Object.values(UserRole).includes(role)) {
				res.status(400).json({ error: "Invalid role" });
				return;
			}

			if (!id) {
				res.status(400).json({ error: "User ID is required" });
				return;
			}

			const user = await User.findOne({ where: { id } });
			if (!user) {
				res.status(404).json({ error: "User not found" });
				return;
			}

			await User.update({ role }, { where: { id } });

			// Get updated user data
			const updatedUser = await User.findOne({
				where: { id },
			});
			if (!updatedUser) {
				res.status(404).json({ error: "User not found" });
				return;
			}

			res.json({
				message: "User role updated successfully",
				user: toJSON(updatedUser),
			});
		} catch (error) {
			loggingService.error("Update role error:", error);
			res.status(500).json({ error: "Failed to update user role" });
		}
	}
);

export default router;
