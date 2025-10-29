import type { MessageType } from "@/models/prisma";
import { type Response, Router } from "express";
import { z } from "zod";

import { type AuthRequest, authenticateToken } from "@/middleware/auth";
import { DMChatUtils } from "@/models/DMChat";
import { DMMessageUtils } from "@/models/DMMessage";
import loggingService from "@/services/loggingService";

const router = Router();

// Validation schemas
const createDMChatSchema = z.object({
  userId: z.string().min(1),
});

const sendDMMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  messageType: z.enum(["TEXT", "FILE", "SYSTEM", "NOTIFICATION"]).optional(),
  replyTo: z.string().min(1).optional(),
  metadata: z.any().optional(),
});

const getDMMessagesSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

// Get all DM chats for the current user
router.get(
  "/",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const currentUser = req.user;
      const chats = await DMChatUtils.findByUserId(currentUser.id);

      // Transform the response to include the other user's info
      const transformedChats = chats.map((chat) => {
        const otherUserId = DMChatUtils.getOtherUser(chat, currentUser.id);
        const otherUser =
          chat.userId1 === otherUserId ? chat.user1 : chat.user2;
        const latestMessage = chat.messages[0] ?? null;

        return {
          id: chat.id,
          otherUser: {
            id: otherUser.id,
            firstName: otherUser.firstName,
            lastName: otherUser.lastName,
            email: otherUser.email,
            avatar: otherUser.avatar,
          },
          latestMessage: latestMessage
            ? {
                id: latestMessage.id,
                content: latestMessage.content,
                type: latestMessage.type,
                createdAt: latestMessage.createdAt,
                user: latestMessage.user,
              }
            : null,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        };
      });

      res.json({ chats: transformedChats });
    } catch (error) {
      loggingService.error("Error fetching DM chats:", error);
      res.status(500).json({ error: "Failed to fetch DM chats" });
    }
  }
);

// Create or get a DM chat with another user
router.post(
  "/",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const result = createDMChatSchema.safeParse(req.body);
      if (!result.success) {
        res
          .status(400)
          .json({ error: result.error.issues[0]?.message ?? "Invalid input" });
        return;
      }

      const { userId: otherUserId } = result.data;

      if (otherUserId === req.user.id.toString()) {
        res.status(400).json({ error: "Cannot create DM chat with yourself" });
        return;
      }

      // Check if the other user exists
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      const otherUser = await prisma.user.findUnique({
        where: { id: otherUserId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
        },
      });

      if (!otherUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const chat = await DMChatUtils.findOrCreate(
        req.user.id.toString(),
        otherUserId
      );

      // Get the chat with relations
      const chatWithRelations = await DMChatUtils.findById(
        chat.id,
        req.user.id.toString()
      );

      if (!chatWithRelations) {
        res.status(500).json({ error: "Failed to create chat" });
        return;
      }

      const otherUserInfo = DMChatUtils.getOtherUser(
        chatWithRelations,
        req.user.id.toString()
      );
      const otherUserData =
        chatWithRelations.userId1 === otherUserInfo
          ? chatWithRelations.user1
          : chatWithRelations.user2;

      res.status(201).json({
        chat: {
          id: chatWithRelations.id,
          otherUser: otherUserData,
          createdAt: chatWithRelations.createdAt,
          updatedAt: chatWithRelations.updatedAt,
        },
      });
    } catch (error) {
      loggingService.error("Error creating DM chat:", error);
      res.status(500).json({ error: "Failed to create DM chat" });
    }
  }
);

// Get messages for a specific DM chat
router.get(
  "/:id/messages",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const chatIdParam = req.params["id"];
      if (!chatIdParam) {
        res.status(400).json({ error: "Chat ID is required" });
        return;
      }

      const chatId = parseInt(chatIdParam, 10);
      if (Number.isNaN(chatId)) {
        res.status(400).json({ error: "Invalid chat ID" });
        return;
      }

      // Verify user has access to this chat
      const chat = await DMChatUtils.findById(
        chatId.toString(),
        req.user.id.toString()
      );
      if (!chat) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const result = getDMMessagesSchema.safeParse(req.query);
      if (!result.success) {
        res
          .status(400)
          .json({ error: result.error.issues[0]?.message ?? "Invalid input" });
        return;
      }

      const { page = 1, limit = 50 } = result.data;

      const { messages, total } = await DMMessageUtils.findByChatId(
        chatId.toString(),
        page,
        limit
      );

      res.json({
        messages,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      loggingService.error("Error fetching DM messages:", error);
      res.status(500).json({ error: "Failed to fetch DM messages" });
    }
  }
);

// Send a message to a DM chat
router.post(
  "/:id/messages",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const chatIdParam = req.params["id"];
      if (!chatIdParam) {
        res.status(400).json({ error: "Chat ID is required" });
        return;
      }

      const chatId = parseInt(chatIdParam, 10);
      if (Number.isNaN(chatId)) {
        res.status(400).json({ error: "Invalid chat ID" });
        return;
      }

      // Verify user has access to this chat
      const chat = await DMChatUtils.findById(
        chatId.toString(),
        req.user.id.toString()
      );
      if (!chat) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const result = sendDMMessageSchema.safeParse(req.body);
      if (!result.success) {
        res
          .status(400)
          .json({ error: result.error.issues[0]?.message ?? "Invalid input" });
        return;
      }

      const { message, messageType = "TEXT", replyTo } = result.data;

      // Validate replyTo message exists and belongs to the same chat
      if (replyTo) {
        const replyMessage = await DMMessageUtils.findById(replyTo);
        if (!replyMessage || replyMessage.chatId !== chatId.toString()) {
          res.status(400).json({ error: "Reply message not found" });
          return;
        }
      }

      const dmMessage = await DMMessageUtils.create({
        chatId: chatId.toString(),
        userId: req.user.id.toString(),
        content: message,
        type: messageType as MessageType,
        replyTo: replyTo ?? null,
      });

      // Get the created message with user data
      const messageWithUser = await DMMessageUtils.findById(dmMessage.id);

      loggingService.logUserAction(
        "send_dm_message",
        req.user.id,
        req.user.role,
        {
          chatId,
          messageId: dmMessage.id,
          messageType,
        }
      );

      // Broadcast message to DM chat via WebSocket
      // Note: WebSocket broadcasting would need to be implemented with a proper service instance
      // For now, we'll skip the WebSocket broadcast until the service is properly initialized

      res.status(201).json({
        message: messageWithUser,
      });
    } catch (error) {
      loggingService.error("Error sending DM message:", error);
      res.status(500).json({ error: "Failed to send DM message" });
    }
  }
);

// Delete a DM message
router.delete(
  "/:id/messages/:messageId",
  authenticateToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      const chatIdParam = req.params["id"];
      const messageIdParam = req.params["messageId"];

      if (!chatIdParam || !messageIdParam) {
        res.status(400).json({ error: "Chat ID and message ID are required" });
        return;
      }

      const chatId = parseInt(chatIdParam, 10);
      const messageId = parseInt(messageIdParam, 10);

      if (Number.isNaN(chatId) || Number.isNaN(messageId)) {
        res.status(400).json({ error: "Invalid chat or message ID" });
        return;
      }

      // Verify user has access to this chat
      const chat = await DMChatUtils.findById(
        chatId.toString(),
        req.user.id.toString()
      );
      if (!chat) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const deleted = await DMMessageUtils.delete(
        messageId.toString(),
        req.user.id.toString()
      );
      if (!deleted) {
        res.status(404).json({ error: "Message not found" });
        return;
      }

      res.json({ message: "Message deleted successfully" });
    } catch (error) {
      loggingService.error("Error deleting DM message:", error);
      res.status(500).json({ error: "Failed to delete DM message" });
    }
  }
);

export default router;
