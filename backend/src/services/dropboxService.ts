import pkg from "@prisma/client";
const { PrismaClient } = pkg;

import config from "@/config/env";
import loggingService from "@/services/loggingService";

const prisma = new PrismaClient();

interface DropboxFile {
	name: string;
	content: Buffer;
	mimeType?: string;
}

interface DropboxUploadResponse {
	success: boolean;
	fileId?: string;
	filePath?: string;
	error?: string;
}

class DropboxService {
	private async getValidAccessToken(userId: string): Promise<string | null> {
		try {
			const connection = await prisma.dropboxConnection.findUnique({
				where: { userId, isActive: true },
			});

			if (!connection) {
				loggingService.warn("No active Dropbox connection found", { userId });
				return null;
			}

			// Check if token is expired and refresh if needed
			if (connection.expiresAt && connection.expiresAt < new Date()) {
				if (!connection.refreshToken) {
					loggingService.error(
						"Access token expired and no refresh token available",
						{ userId }
					);
					return null;
				}

				try {
					const refreshedToken = await this.refreshAccessToken(
						connection.refreshToken
					);
					if (refreshedToken) {
						// Update the connection with new token
						await prisma.dropboxConnection.update({
							where: { id: connection.id },
							data: {
								accessToken: refreshedToken.access_token,
								expiresAt: refreshedToken.expires_in
									? new Date(Date.now() + refreshedToken.expires_in * 1000)
									: null,
							},
						});
						return refreshedToken.access_token;
					}
				} catch (error) {
					loggingService.error("Failed to refresh Dropbox token", {
						error,
						userId,
					});
					return null;
				}
			}

			return connection.accessToken;
		} catch (error) {
			loggingService.error("Error getting Dropbox access token", {
				error,
				userId,
			});
			return null;
		}
	}

	private async refreshAccessToken(refreshToken: string): Promise<{
		access_token: string;
		expires_in?: number;
	} | null> {
		try {
			// Validate required configuration
			if (!config.dropbox.clientId || !config.dropbox.clientSecret) {
				loggingService.error("Missing Dropbox configuration", {
					hasClientId: Boolean(config.dropbox.clientId),
					hasClientSecret: Boolean(config.dropbox.clientSecret),
				});
				return null;
			}

			const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({
					grant_type: "refresh_token",
					refresh_token: refreshToken,
					client_id: config.dropbox.clientId,
					client_secret: config.dropbox.clientSecret,
				}),
			});

			if (!response.ok) {
				loggingService.error("Token refresh failed", {
					status: response.status,
				});
				return null;
			}

			return (await response.json()) as {
				access_token: string;
				expires_in?: number;
			};
		} catch (error) {
			loggingService.error("Error refreshing token", { error });
			return null;
		}
	}

	async createFolder(
		userId: string,
		folderName: string,
		parentPath = ""
	): Promise<string | null> {
		try {
			const accessToken = await this.getValidAccessToken(userId);
			if (!accessToken) {
				return null;
			}

			const folderPath = parentPath
				? `${parentPath}/${folderName}`
				: `/${folderName}`;

			const response = await fetch(
				"https://api.dropboxapi.com/2/files/create_folder_v2",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${accessToken}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						path: folderPath,
						autorename: true, // Automatically rename if folder exists
					}),
				}
			);

			if (!response.ok) {
				const error = await response.text();
				loggingService.error("Failed to create Dropbox folder", {
					error,
					folderPath,
					userId,
				});
				return null;
			}

			const result = (await response.json()) as {
				metadata: { path_display: string };
			};
			loggingService.info("Dropbox folder created", {
				folderPath: result.metadata.path_display,
				userId,
			});
			return result.metadata.path_display;
		} catch (error) {
			loggingService.error("Error creating Dropbox folder", { error, userId });
			return null;
		}
	}

	async uploadFile(
		userId: string,
		file: DropboxFile,
		folderPath = "/BidKore"
	): Promise<DropboxUploadResponse> {
		try {
			const accessToken = await this.getValidAccessToken(userId);
			if (!accessToken) {
				return { success: false, error: "No valid Dropbox connection" };
			}

			const filePath = `${folderPath}/${file.name}`;

			// Use upload API for files
			const response = await fetch(
				"https://content.dropboxapi.com/2/files/upload",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${accessToken}`,
						"Content-Type": "application/octet-stream",
						"Dropbox-API-Arg": JSON.stringify({
							path: filePath,
							mode: "add",
							autorename: true,
							mute: false,
							strict_conflict: false,
						}),
					},
					body: new Uint8Array(file.content),
				}
			);

			if (!response.ok) {
				const error = await response.text();
				loggingService.error("Failed to upload file to Dropbox", {
					error,
					filePath,
					userId,
				});
				return { success: false, error: `Upload failed: ${error}` };
			}

			const result = (await response.json()) as {
				path_display: string;
				id: string;
			};
			loggingService.info("File uploaded to Dropbox", {
				filePath: result.path_display,
				fileId: result.id,
				userId,
			});

			return {
				success: true,
				fileId: result.id,
				filePath: result.path_display,
			};
		} catch (error) {
			loggingService.error("Error uploading file to Dropbox", {
				error,
				userId,
			});
			return { success: false, error: "Upload failed due to network error" };
		}
	}

	async uploadOpportunityAttachments(
		userId: string,
		opportunityId: string,
		attachments: { url: string; filename: string }[]
	): Promise<{
		success: boolean;
		uploaded: number;
		failed: number;
		errors: string[];
	}> {
		try {
			const accessToken = await this.getValidAccessToken(userId);
			if (!accessToken) {
				return {
					success: false,
					uploaded: 0,
					failed: attachments.length,
					errors: ["No valid Dropbox connection"],
				};
			}

			// Create opportunity folder
			const opportunityFolder = `/BidKore/Opportunities/${opportunityId}`;
			await this.createFolder(userId, opportunityId, "/BidKore/Opportunities");

			let uploaded = 0;
			let failed = 0;
			const errors: string[] = [];

			for (const attachment of attachments) {
				try {
					// Download the attachment
					const fileResponse = await fetch(attachment.url);
					if (!fileResponse.ok) {
						errors.push(`Failed to download ${attachment.filename}`);
						failed++;
						continue;
					}

					const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());

					const uploadResult = await this.uploadFile(
						userId,
						{
							name: attachment.filename,
							content: fileBuffer,
						},
						opportunityFolder
					);

					if (uploadResult.success) {
						uploaded++;
					} else {
						failed++;
						errors.push(
							`Failed to upload ${attachment.filename}: ${uploadResult.error}`
						);
					}
				} catch (error) {
					failed++;
					errors.push(
						`Error processing ${attachment.filename}: ${String(error)}`
					);
					loggingService.error("Error processing attachment", {
						error,
						filename: attachment.filename,
						userId,
					});
				}
			}

			loggingService.info("Opportunity attachments upload completed", {
				userId,
				opportunityId,
				uploaded,
				failed,
				totalAttachments: attachments.length,
			});

			return {
				success: uploaded > 0,
				uploaded,
				failed,
				errors,
			};
		} catch (error) {
			loggingService.error("Error uploading opportunity attachments", {
				error,
				userId,
				opportunityId,
			});
			return {
				success: false,
				uploaded: 0,
				failed: attachments.length,
				errors: ["Service error during upload"],
			};
		}
	}

	async updateSyncStatus(
		userId: string,
		opportunityId: string,
		isSuccess: boolean,
		folderId?: string
	): Promise<void> {
		try {
			await prisma.archivedOpportunity.updateMany({
				where: {
					userId,
					opportunityId,
				},
				data: {
					isDropboxSynced: isSuccess,
					dropboxFolderId: folderId ?? null,
					dropboxSyncedAt: isSuccess ? new Date() : null,
				},
			});
		} catch (error) {
			loggingService.error("Error updating Dropbox sync status", {
				error,
				userId,
				opportunityId,
			});
		}
	}
}

export default new DropboxService();
