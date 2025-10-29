import { type Request, type Response, Router } from "express";

import config from "@/config/env";
import prisma from "@/config/prisma";
import { type AuthRequest, authenticateToken } from "@/middleware/auth";
import { createError } from "@/middleware/errorHandler";
import loggingService from "@/services/loggingService";

const router = Router();

// Dropbox API response types
interface DropboxTokenResponse {
	access_token: string;
	refresh_token?: string;
	expires_in?: number;
	token_type: string;
}

interface DropboxAccountResponse {
	account_id: string;
	email: string;
	name: {
		display_name: string;
	};
}

// Dropbox OAuth URLs
const DROPBOX_AUTH_URL = "https://www.dropbox.com/oauth2/authorize";
const DROPBOX_TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";

// Initiate Dropbox OAuth flow
router.get(
	"/connect",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			const { dropbox } = config;

			if (!dropbox.clientId || !dropbox.redirectUri) {
				throw createError("Dropbox OAuth not configured", 500);
			}

			// Check if user already has a Dropbox connection
			if (!req.user?.id) {
				throw createError("User not authenticated", 401);
			}

			const existingConnection = await prisma.dropboxConnection.findUnique({
				where: { userId: req.user.id },
			});

			if (existingConnection) {
				res.status(400).json({
					success: false,
					message: "User already has a Dropbox connection",
				});
				return;
			}

			// Generate state parameter for security
			const state = Buffer.from(
				JSON.stringify({
					userId: req.user?.id,
					timestamp: Date.now(),
				})
			).toString("base64");

			const authUrl = new URL(DROPBOX_AUTH_URL);
			authUrl.searchParams.append("client_id", dropbox.clientId);
			authUrl.searchParams.append("redirect_uri", dropbox.redirectUri);
			authUrl.searchParams.append("response_type", "code");
			authUrl.searchParams.append("state", state);
			authUrl.searchParams.append("token_access_type", "offline"); // For refresh tokens

			res.json({
				success: true,
				authUrl: authUrl.toString(),
			});
		} catch (error) {
			loggingService.error("Error initiating Dropbox OAuth", {
				error,
				userId: req.user?.id,
			});
			throw createError("Failed to initiate Dropbox connection", 500);
		}
	}
);

// Handle Dropbox OAuth callback
router.get("/callback", async (req: Request, res: Response): Promise<void> => {
	try {
		const { code, state, error } = req.query;

		loggingService.info("Dropbox OAuth callback received", {
			hasCode: Boolean(code),
			hasState: Boolean(state),
			hasError: Boolean(error),
			codeLength: code?.toString().length,
			stateLength: state?.toString().length,
		});

		if (error) {
			loggingService.error("Dropbox OAuth error", { error });
			res.redirect(
				`${config.urls.frontend}/settings?dropbox_error=${encodeURIComponent(
					error as string
				)}`
			);
			return;
		}

		if (!code || !state) {
			throw createError("Missing authorization code or state", 400);
		}

		// Verify state parameter
		let stateData: { userId: number; timestamp: number };
		try {
			stateData = JSON.parse(
				Buffer.from(state as string, "base64").toString()
			) as { userId: number; timestamp: number };
		} catch {
			throw createError("Invalid state parameter", 400);
		}

		const { userId, timestamp } = stateData;

		// Check if state is not too old (15 minutes)
		if (Date.now() - timestamp > 15 * 60 * 1000) {
			throw createError("OAuth state expired", 400);
		}

		// Exchange code for access token
		const { dropbox } = config;
		if (!dropbox.clientId || !dropbox.clientSecret || !dropbox.redirectUri) {
			throw createError("Dropbox OAuth not configured", 500);
		}

		const tokenResponse = await fetch(DROPBOX_TOKEN_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				code: code as string,
				grant_type: "authorization_code",
				client_id: dropbox.clientId,
				client_secret: dropbox.clientSecret,
				redirect_uri: dropbox.redirectUri,
			}),
			signal: AbortSignal.timeout(30000), // 30 second timeout
		});

		if (!tokenResponse.ok) {
			const errorText = await tokenResponse.text();
			loggingService.error("Dropbox token exchange failed", {
				status: tokenResponse.status,
				error: errorText,
			});
			throw createError("Failed to exchange authorization code", 500);
		}

		const tokenData = (await tokenResponse.json()) as DropboxTokenResponse;

		loggingService.info("Dropbox token exchange successful", {
			userId,
			hasAccessToken: Boolean(tokenData.access_token),
			hasRefreshToken: Boolean(tokenData.refresh_token),
			expiresIn: tokenData.expires_in,
		});

		// Get user's Dropbox account info
		const accountResponse = await fetch(
			"https://api.dropboxapi.com/2/users/get_current_account",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${tokenData.access_token}`,
					"Content-Type": "application/json",
				},
				signal: AbortSignal.timeout(30000), // 30 second timeout
			}
		);

		if (!accountResponse.ok) {
			loggingService.error("Failed to get Dropbox account info", {
				status: accountResponse.status,
			});
			throw createError("Failed to get Dropbox account information", 500);
		}

		const accountData =
			(await accountResponse.json()) as DropboxAccountResponse;

		loggingService.info("Dropbox account info retrieved", {
			userId,
			accountId: accountData.account_id,
			email: accountData.email,
			displayName: accountData.name.display_name,
		});

		// Store connection in database
		const connection = await prisma.dropboxConnection.create({
			data: {
				userId: userId.toString(),
				accessToken: tokenData.access_token,
				refreshToken: tokenData.refresh_token ?? null,
				accountId: accountData.account_id,
				email: accountData.email,
				displayName: accountData.name.display_name,
				expiresAt: tokenData.expires_in
					? new Date(Date.now() + tokenData.expires_in * 1000)
					: null,
			},
		});

		loggingService.info("Dropbox connection created successfully", {
			userId,
			connectionId: connection.id,
			accountId: accountData.account_id,
		});

		// Redirect back to frontend with success
		res.redirect(`${config.urls.frontend}/settings?dropbox_connected=true`);
	} catch (error) {
		loggingService.error("Error handling Dropbox callback", {
			error: error instanceof Error ? error.message : error,
			stack: error instanceof Error ? error.stack : null,
			name: error instanceof Error ? error.name : null,
		});
		res.redirect(
			`${config.urls.frontend}/settings?dropbox_error=connection_failed`
		);
	}
});

// Get Dropbox connection status
router.get(
	"/status",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user?.id) {
				throw createError("User not authenticated", 401);
			}

			const connection = await prisma.dropboxConnection.findUnique({
				where: { userId: req.user.id },
				select: {
					id: true,
					email: true,
					displayName: true,
					createdAt: true,
					isActive: true,
				},
			});

			res.json({
				success: true,
				connected: Boolean(connection),
				connection: connection ?? null,
			});
		} catch (error) {
			loggingService.error("Error getting Dropbox status", {
				error,
				userId: req.user?.id,
			});
			throw createError("Failed to get Dropbox connection status", 500);
		}
	}
);

// Disconnect Dropbox
router.delete(
	"/disconnect",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user?.id) {
				throw createError("User not authenticated", 401);
			}

			const connection = await prisma.dropboxConnection.findUnique({
				where: { userId: req.user.id },
			});

			if (!connection) {
				res.status(404).json({
					success: false,
					message: "No Dropbox connection found",
				});
				return;
			}

			// Revoke the access token with Dropbox
			try {
				await fetch("https://api.dropboxapi.com/2/auth/token/revoke", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${connection.accessToken}`,
						"Content-Type": "application/json",
					},
				});
			} catch (error) {
				loggingService.warn("Failed to revoke Dropbox token", {
					error,
					userId: req.user?.id,
				});
				// Continue with deletion even if revocation fails
			}

			// Delete connection from database
			await prisma.dropboxConnection.delete({
				where: { userId: req.user.id },
			});

			loggingService.info("Dropbox connection deleted", {
				userId: req.user?.id,
			});

			res.json({
				success: true,
				message: "Dropbox connection removed successfully",
			});
		} catch (error) {
			loggingService.error("Error disconnecting Dropbox", {
				error,
				userId: req.user?.id,
			});
			throw createError("Failed to disconnect Dropbox", 500);
		}
	}
);

export default router;
