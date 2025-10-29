import { prisma } from "./prisma";

interface PrismaDMChat {
	id: string;
	userId1: string;
	userId2: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface DMChatAttributes {
	id: string;
	userId1: string;
	userId2: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface DMChatCreationAttributes {
	userId1: string;
	userId2: string;
}

export interface DMChatWithRelations {
	id: string;
	userId1: string;
	userId2: string;
	createdAt: Date;
	updatedAt: Date;
	user1: {
		id: string;
		firstName: string;
		lastName: string;
		email: string;
		avatar?: string | null;
	};
	user2: {
		id: string;
		firstName: string;
		lastName: string;
		email: string;
		avatar?: string | null;
	};
	messages: {
		id: string;
		userId: string;
		content: string;
		type: string;
		createdAt: Date;
		user: {
			id: string;
			firstName: string;
			lastName: string;
			email: string;
			avatar?: string | null;
		};
	}[];
}

export const DMChatUtils = {
	async findOrCreate(userId1: string, userId2: string): Promise<PrismaDMChat> {
		// Ensure userId1 < userId2 for consistent ordering
		const smallerId = userId1 < userId2 ? userId1 : userId2;
		const largerId = userId1 < userId2 ? userId2 : userId1;

		let chat = await prisma.dMChat.findUnique({
			where: {
				userId1_userId2: {
					userId1: smallerId,
					userId2: largerId,
				},
			},
		});

		chat ??= await prisma.dMChat.create({
			data: {
				userId1: smallerId,
				userId2: largerId,
			},
		});

		return chat;
	},

	async findByUserId(userId: string): Promise<DMChatWithRelations[]> {
		return prisma.dMChat.findMany({
			where: {
				OR: [{ userId1: userId }, { userId2: userId }],
			},
			include: {
				user1: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						avatar: true,
					},
				},
				user2: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						avatar: true,
					},
				},
				messages: {
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
					orderBy: { createdAt: "desc" },
					take: 1, // Only get the latest message for the chat list
				},
			},
			orderBy: { updatedAt: "desc" },
		});
	},

	async findById(
		id: string,
		userId: string
	): Promise<DMChatWithRelations | null> {
		return prisma.dMChat.findFirst({
			where: {
				id,
				OR: [{ userId1: userId }, { userId2: userId }],
			},
			include: {
				user1: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						avatar: true,
					},
				},
				user2: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						avatar: true,
					},
				},
				messages: {
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
					},
					orderBy: { createdAt: "asc" },
				},
			},
		});
	},

	getOtherUser(chat: PrismaDMChat, currentUserId: string): string {
		return chat.userId1 === currentUserId ? chat.userId2 : chat.userId1;
	},
};
