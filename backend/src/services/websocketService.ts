import type { Server as HTTPServer } from "node:http";

import jwt from "jsonwebtoken";
import { type Socket, Server as SocketIOServer } from "socket.io";

import config from "@/config/env";
import type { User as UserType } from "@/models";
import User from "@/models/User";
import loggingService from "@/services/loggingService";

interface JwtPayload {
	userId: string;
}

interface OnlineMember {
	userId: string;
	userName: string;
	email: string;
	avatar: string | null;
}

interface AuthenticatedSocket extends Socket {
	user?: UserType;
	userId?: string;
}

class WebSocketService {
	private readonly io: SocketIOServer;
	private readonly connectedUsers = new Map<string, string>(); // userId -> socketId
	private readonly teamRooms = new Map<string, Set<string>>(); // teamId -> Set of socketIds
	private readonly dmRooms = new Map<string, Set<string>>(); // chatId -> Set of socketIds

	constructor(server: HTTPServer) {
		this.io = new SocketIOServer(server, {
			cors: {
				origin: config.urls.frontend,
				methods: ["GET", "POST"],
				credentials: true,
			},
			transports: ["websocket", "polling"],
		});

		this.setupMiddleware();
		this.setupEventHandlers();
	}

	private setupMiddleware(): void {
		// Authentication middleware
		this.io.use((socket: AuthenticatedSocket, next: (err?: Error) => void) => {
			const authenticateUser = async (): Promise<void> => {
				try {
					const authHeader = socket.handshake.headers.authorization;
					const authToken = socket.handshake.auth["token"] as unknown;
					const token: string | null =
						(typeof authToken === "string" ? authToken : null) ??
						(typeof authHeader === "string"
							? authHeader.replace("Bearer ", "")
							: null);

					if (!token) {
						next(new Error("Authentication error: No token provided"));
						return;
					}

					const decoded = jwt.verify(
						token,
						config.auth.jwtSecret
					) as JwtPayload;

					// Get user from database
					const user = await User.findByPk(decoded.userId);
					if (!user) {
						next(new Error("Authentication error: User not found"));
						return;
					}

					socket.user = user;
					socket.userId = user.id;
					next();
				} catch (error) {
					loggingService.error("WebSocket authentication error:", error);
					next(new Error("Authentication error: Invalid token"));
				}
			};

			authenticateUser().catch(error => {
				loggingService.error("Authentication error:", error);
				next(new Error("Authentication error"));
			});
		});
	}

	private setupEventHandlers(): void {
		this.io.on("connection", (socket: AuthenticatedSocket) => {
			if (!socket.userId || !socket.user) {
				loggingService.error("Socket connection without proper authentication");
				socket.disconnect();
				return;
			}

			const { userId } = socket;
			const { user } = socket;

			loggingService.info(
				`User ${user.email} connected via WebSocket (${socket.id})`
			);

			// Store user connection
			this.connectedUsers.set(userId, socket.id);

			// Join user to their personal room for notifications
			const joinResult = socket.join(`user:${userId}`);
			if (joinResult instanceof Promise) {
				joinResult.catch((error: unknown) => {
					loggingService.error("Error joining user room:", error);
				});
			}

			// Handle joining team rooms
			socket.on("join_team", async (teamId: string): Promise<void> => {
				try {
					// Verify user is team member (you might want to add this check)
					await this.joinTeamRoom(socket, teamId, userId);
				} catch (error) {
					loggingService.error("Error joining team room:", error);
					socket.emit("error", { message: "Failed to join team room" });
				}
			});

			// Handle leaving team rooms
			socket.on("leave_team", async (teamId: string): Promise<void> => {
				await this.leaveTeamRoom(socket, teamId, userId);
			});

			// Handle typing indicators
			socket.on("typing_start", (data: { teamId: string }) => {
				socket.to(`team:${data.teamId}`).emit("user_typing", {
					userId,
					userName: `${user.firstName} ${user.lastName}`.trim(),
					teamId: data.teamId,
				});
			});

			socket.on("typing_stop", (data: { teamId: string }) => {
				socket.to(`team:${data.teamId}`).emit("user_stopped_typing", {
					userId,
					teamId: data.teamId,
				});
			});

			// Handle joining DM chat rooms
			socket.on("join_dm_chat", async (chatId: string): Promise<void> => {
				try {
					await this.joinDMChatRoom(socket, chatId, userId);
				} catch (error) {
					loggingService.error("Error joining DM chat room:", error);
					socket.emit("error", { message: "Failed to join DM chat room" });
				}
			});

			// Handle leaving DM chat rooms
			socket.on("leave_dm_chat", (chatId: string): void => {
				this.leaveDMChatRoom(socket, chatId, userId);
			});

			// Handle DM typing indicators
			socket.on("dm_typing_start", (data: { chatId: string }) => {
				socket.to(`dm:${data.chatId}`).emit("dm_user_typing", {
					userId,
					userName: `${user.firstName} ${user.lastName}`.trim(),
					chatId: data.chatId,
				});
			});

			socket.on("dm_typing_stop", (data: { chatId: string }) => {
				socket.to(`dm:${data.chatId}`).emit("dm_user_stopped_typing", {
					userId,
					chatId: data.chatId,
				});
			});

			// Handle disconnect
			socket.on("disconnect", (): void => {
				loggingService.info(`User ${user.email} disconnected from WebSocket`);

				// Remove from connected users
				this.connectedUsers.delete(userId);

				// Remove from all team rooms
				this.teamRooms.forEach((socketIds, teamId) => {
					socketIds.delete(socket.id);
					if (socketIds.size === 0) {
						this.teamRooms.delete(teamId);
					}
				});

				// Notify all teams this user was in that they're offline
				this.teamRooms.forEach((socketIds, teamId) => {
					if (socketIds.has(socket.id)) {
						this.io.to(`team:${teamId}`).emit("user_offline", {
							userId,
							teamId,
						});
					}
				});
			});
		});
	}

	private async joinTeamRoom(
		socket: AuthenticatedSocket,
		teamId: string,
		userId: string
	): Promise<void> {
		// Add socket to team room
		await socket.join(`team:${teamId}`);

		// Track in our internal map
		if (!this.teamRooms.has(teamId)) {
			this.teamRooms.set(teamId, new Set());
		}
		this.teamRooms.get(teamId)?.add(socket.id);

		// Notify other team members that user joined
		socket.to(`team:${teamId}`).emit("user_joined_team", {
			userId,
			userName: `${socket.user?.firstName} ${socket.user?.lastName}`.trim(),
			teamId,
		});

		// Send current online members to the joining user
		const onlineMembers = this.getOnlineTeamMembers(teamId);
		socket.emit("team_online_members", {
			teamId,
			members: onlineMembers,
		});

		loggingService.info(`User ${userId} joined team room ${teamId}`);
	}

	private async leaveTeamRoom(
		socket: AuthenticatedSocket,
		teamId: string,
		userId: string
	): Promise<void> {
		await socket.leave(`team:${teamId}`);

		// Remove from internal tracking
		const socketIds = this.teamRooms.get(teamId);
		if (socketIds) {
			socketIds.delete(socket.id);
			if (socketIds.size === 0) {
				this.teamRooms.delete(teamId);
			}
		}

		// Notify other team members
		socket.to(`team:${teamId}`).emit("user_left_team", {
			userId,
			teamId,
		});

		loggingService.info(`User ${userId} left team room ${teamId}`);
	}

	private async joinDMChatRoom(
		socket: AuthenticatedSocket,
		chatId: string,
		userId: string
	): Promise<void> {
		// Verify user has access to this DM chat
		const { DMChatUtils } = await import("../models/DMChat");
		const chat = await DMChatUtils.findById(chatId, userId);

		if (!chat) {
			throw new Error("Access denied to DM chat");
		}

		// Join the DM chat room
		await socket.join(`dm:${chatId}`);

		// Track the socket in the DM room
		if (!this.dmRooms.has(chatId)) {
			this.dmRooms.set(chatId, new Set());
		}
		const dmRoom = this.dmRooms.get(chatId);
		if (dmRoom) {
			dmRoom.add(socket.id);
		}

		// Notify other participants
		socket.to(`dm:${chatId}`).emit("user_joined_dm_chat", {
			userId,
			chatId,
		});

		loggingService.info(`User ${userId} joined DM chat room ${chatId}`);
	}

	private leaveDMChatRoom(
		socket: AuthenticatedSocket,
		chatId: string,
		userId: string
	): void {
		// Leave the DM chat room
		const leaveResult = socket.leave(`dm:${chatId}`);
		if (leaveResult instanceof Promise) {
			leaveResult.catch((error: unknown) => {
				loggingService.error("Error leaving DM chat room:", error);
			});
		}

		// Remove socket from DM room tracking
		const socketIds = this.dmRooms.get(chatId);
		if (socketIds) {
			socketIds.delete(socket.id);
			if (socketIds.size === 0) {
				this.dmRooms.delete(chatId);
			}
		}

		// Notify other participants
		socket.to(`dm:${chatId}`).emit("user_left_dm_chat", {
			userId,
			chatId,
		});

		loggingService.info(`User ${userId} left DM chat room ${chatId}`);
	}

	private getOnlineTeamMembers(teamId: string): OnlineMember[] {
		const socketIds = this.teamRooms.get(teamId);
		if (!socketIds || socketIds.size === 0) {
			return [];
		}

		const onlineMembers: OnlineMember[] = [];
		for (const socketId of socketIds) {
			const socket = this.io.sockets.sockets.get(
				socketId
			) as AuthenticatedSocket;
			if (socket.user) {
				onlineMembers.push({
					userId: socket.user.id,
					userName: `${socket.user.firstName} ${socket.user.lastName}`.trim(),
					email: socket.user.email,
					avatar: socket.user.avatar,
				});
			}
		}

		return onlineMembers;
	}

	// Public methods for broadcasting events
	public broadcastTeamMessage(teamId: string, message: unknown): void {
		this.io.to(`team:${teamId}`).emit("new_message", message);
	}

	public broadcastTeamNotification(
		teamId: string,
		notification: unknown
	): void {
		this.io.to(`team:${teamId}`).emit("team_notification", notification);
	}

	public broadcastDMMessage(chatId: string, message: unknown): void {
		this.io.to(`dm:${chatId}`).emit("new_dm_message", message);
	}

	public notifyUser(userId: string, event: string, data: unknown): void {
		this.io.to(`user:${userId}`).emit(event, data);
	}

	public getOnlineUsers(): string[] {
		return Array.from(this.connectedUsers.keys());
	}

	public isUserOnline(userId: string): boolean {
		return this.connectedUsers.has(userId);
	}

	public getTeamOnlineCount(teamId: string): number {
		const socketIds = this.teamRooms.get(teamId);
		return socketIds ? socketIds.size : 0;
	}
}

export default WebSocketService;
