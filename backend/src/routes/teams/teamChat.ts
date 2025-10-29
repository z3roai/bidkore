import { type Response, Router } from "express";

import {
	createTeamChatMessage,
	deleteTeamChatMessage,
	findTeamChatMessageById,
} from "../../models/TeamChatMessage";

import prisma from "@/config/prisma";
import { type AuthRequest, authenticateToken } from "@/middleware/auth";
import { MessageType } from "@/models";
import { chatMessageSchema } from "@/routes/teams/schemas";
import { isTeamAdmin, isTeamMember } from "@/routes/teams/utils";
import loggingService from "@/services/loggingService";
import type WebSocketService from "@/services/websocketService";

const router = Router();

// Get WebSocket service instance (we'll need to pass this from the main server)
let wsService: WebSocketService | null = null;

export const setWebSocketService = (service: WebSocketService): void => {
	wsService = service;
};

// Get team chat messages
router.get(
	"/:id/chat/messages",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const teamId = req.params["id"];
			const page = parseInt(req.query["page"] as string, 10) || 1;
			const limit = parseInt(req.query["limit"] as string, 10) || 50;
			const offset = (page - 1) * limit;

			if (!teamId) {
				res.status(400).json({ error: "Invalid team ID" });
				return;
			}

			// Check if user is team member
			if (!(await isTeamMember(req.user.id, teamId))) {
				res.status(403).json({ error: "Access denied" });
				return;
			}

			const messages = await prisma.teamChatMessage.findMany({
				where: { teamId },
				include: {
					user: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							email: true,
							avatar: true,
						},
					},
					parent: {
						include: {
							user: {
								select: {
									id: true,
									firstName: true,
									lastName: true,
									email: true,
								},
							},
						},
					},
				},
				orderBy: { createdAt: "desc" },
				take: limit,
				skip: offset,
			});

			const totalMessages = await prisma.teamChatMessage.count({
				where: { teamId },
			});

			res.json({
				messages: messages.reverse(), // Return in chronological order
				pagination: {
					page,
					limit,
					total: totalMessages,
					pages: Math.ceil(totalMessages / limit),
				},
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"get_team_chat_messages",
				req.user?.id ?? "",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to get chat messages" });
		}
	}
);

// Send team chat message
router.post(
	"/:id/chat/messages",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const teamId = req.params["id"];
			if (!teamId) {
				res.status(400).json({ error: "Invalid team ID" });
				return;
			}

			// Check if user is team member
			if (!(await isTeamMember(req.user.id, teamId))) {
				res.status(403).json({ error: "Access denied" });
				return;
			}

			const result = chatMessageSchema.safeParse(req.body);
			if (!result.success) {
				res
					.status(400)
					.json({ error: result.error.issues[0]?.message ?? "Invalid input" });
				return;
			}

			const { message, messageType = MessageType.TEXT, replyTo } = result.data;

			// Validate replyTo message exists and belongs to the same team
			if (replyTo) {
				const replyMessage = await prisma.teamChatMessage.findFirst({
					where: { id: replyTo, teamId },
				});

				if (!replyMessage) {
					res.status(400).json({ error: "Reply message not found" });
					return;
				}
			}

			const chatMessage = await createTeamChatMessage({
				teamId,
				userId: req.user.id,
				content: message,
				type: messageType as MessageType,
				replyTo: replyTo ?? null,
			});

			// Get the created message with user data
			const messageWithUser = await findTeamChatMessageById(chatMessage.id);

			loggingService.logUserAction(
				"send_team_chat_message",
				req.user.id,
				req.user.role,
				{
					teamId,
					messageId: chatMessage.id,
					messageType,
				}
			);

			// Broadcast message to team via WebSocket
			if (wsService) {
				wsService.broadcastTeamMessage(teamId, {
					type: "new_message",
					message: messageWithUser,
					teamId,
					timestamp: new Date().toISOString(),
				});
			}

			res.status(201).json({
				message: messageWithUser,
				notification: {
					type: "chat_message",
					teamId,
					messageId: chatMessage.id,
					userId: req.user.id,
					userName: `${req.user.firstName} ${req.user.lastName}`.trim(),
				},
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"send_team_chat_message",
				req.user?.id ?? "",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to send chat message" });
		}
	}
);

// Delete team chat message
router.delete(
	"/:id/chat/messages/:messageId",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const teamId = req.params["id"];
			const { messageId } = req.params;

			if (!teamId || !messageId || Number.isNaN(Number(messageId))) {
				res.status(400).json({ error: "Invalid team ID or message ID" });
				return;
			}

			// Check if user is team member
			if (!(await isTeamMember(req.user.id, teamId))) {
				res.status(403).json({ error: "Access denied" });
				return;
			}

			const chatMessage = await prisma.teamChatMessage.findFirst({
				where: { id: messageId, teamId },
			});

			if (!chatMessage) {
				res.status(404).json({ error: "Message not found" });
				return;
			}

			// Check if user can delete this message (author or team admin)
			const isAdmin = await isTeamAdmin(req.user.id, teamId);
			const isAuthor = chatMessage.userId === req.user.id;

			if (!isAdmin && !isAuthor) {
				res.status(403).json({
					error: "You can only delete your own messages or be a team admin",
				});
				return;
			}

			if (messageId) {
				await deleteTeamChatMessage(messageId);
			}

			loggingService.logUserAction(
				"delete_team_chat_message",
				req.user.id,
				req.user.role,
				{
					teamId,
					messageId,
				}
			);

			res.json({ message: "Message deleted successfully" });
		} catch (error: unknown) {
			loggingService.logUserError(
				"delete_team_chat_message",
				req.user?.id ?? "",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to delete chat message" });
		}
	}
);

// Get team chat statistics
router.get(
	"/:id/chat/stats",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		try {
			if (!req.user) {
				res.status(401).json({ error: "User not found" });
				return;
			}

			const teamId = req.params["id"];
			if (!teamId) {
				res.status(400).json({ error: "Invalid team ID" });
				return;
			}

			// Check if user is team member
			if (!(await isTeamMember(req.user.id, teamId))) {
				res.status(403).json({ error: "Access denied" });
				return;
			}

			const totalMessages = await prisma.teamChatMessage.count({
				where: { teamId },
			});
			const todayMessages = await prisma.teamChatMessage.count({
				where: {
					teamId,
					createdAt: {
						gte: new Date(new Date().setHours(0, 0, 0, 0)),
					},
				},
			});

			const activeUsers = await prisma.teamChatMessage.groupBy({
				by: ["userId"],
				where: { teamId },
				_count: {
					userId: true,
				},
			});

			const userIds = activeUsers.map(item => item.userId);
			const users = await prisma.user.findMany({
				where: {
					id: {
						in: userIds,
					},
				},
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					avatar: true,
				},
			});

			res.json({
				stats: {
					totalMessages,
					todayMessages,
					activeUsers: users.length,
					users,
				},
			});
		} catch (error: unknown) {
			loggingService.logUserError(
				"get_team_chat_stats",
				req.user?.id ?? "",
				req.user?.role ?? "unknown",
				error instanceof Error ? error : new Error(String(error))
			);
			res.status(500).json({ error: "Failed to get chat statistics" });
		}
	}
);

export default router;
