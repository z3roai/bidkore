import { prisma, MessageType } from "./prisma";

interface PrismaDMMessage {
  id: string;
  chatId: string;
  userId: string;
  content: string;
  type: string;
  replyTo?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DMMessageAttributes {
  id: string;
  chatId: string;
  userId: string;
  content: string;
  type: string;
  replyTo?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DMMessageCreationAttributes {
  chatId: string;
  userId: string;
  content: string;
  type?: string;
  replyTo?: string | null;
}

export interface DMMessageWithRelations {
  id: string;
  chatId: string;
  userId: string;
  content: string;
  type: string;
  replyTo?: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string | null;
  };
  parent?: PrismaDMMessage | null;
  replies?: PrismaDMMessage[] | null;
}

export const DMMessageUtils = {
  async create(data: DMMessageCreationAttributes): Promise<PrismaDMMessage> {
    return prisma.dMMessage.create({
      data: {
        chatId: data.chatId,
        userId: data.userId,
        content: data.content,
        type: (data.type as MessageType) || MessageType.TEXT,
        replyTo: data.replyTo ?? null,
      },
    });
  },

  async findById(id: string): Promise<DMMessageWithRelations | null> {
    return prisma.dMMessage.findUnique({
      where: { id },
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
                avatar: true,
              },
            },
          },
        },
        replies: {
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
          },
        },
      },
    });
  },

  async findByChatId(
    chatId: string,
    page = 1,
    limit = 50
  ): Promise<{ messages: DMMessageWithRelations[]; total: number }> {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.dMMessage.findMany({
        where: { chatId },
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
                  avatar: true,
                },
              },
            },
          },
          replies: {
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
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.dMMessage.count({ where: { chatId } }),
    ]);

    return { messages: messages.reverse(), total };
  },

  async delete(id: string, userId: string): Promise<boolean> {
    const message = await prisma.dMMessage.findUnique({
      where: { id },
    });

    if (!message || message.userId !== userId) {
      return false;
    }

    await prisma.dMMessage.delete({ where: { id } });
    return true;
  },
};
