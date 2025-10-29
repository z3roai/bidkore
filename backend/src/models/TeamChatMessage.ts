import {
	MessageType,
	type TeamChatMessage as PrismaTeamChatMessage,
	type Team,
	type User,
} from "@prisma/client";

import prisma from "@/config/prisma";

export { MessageType };

export interface TeamChatMessageAttributes {
	id: string;
	teamId: string;
	userId: string;
	content: string;
	type: MessageType;
	replyTo?: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface TeamChatMessageCreationAttributes {
	teamId: string;
	userId: string;
	content: string;
	type?: MessageType;
	replyTo?: string | null;
}

export interface TeamChatMessageWithRelations extends PrismaTeamChatMessage {
	team?: Team;
	user?: User;
	parent?: PrismaTeamChatMessage | null;
	replies?: PrismaTeamChatMessage[];
}

// Prisma-based utility functions for TeamChatMessage
export async function createTeamChatMessage(
	data: TeamChatMessageCreationAttributes
): Promise<PrismaTeamChatMessage> {
	return prisma.teamChatMessage.create({
		data: {
			teamId: data.teamId,
			userId: data.userId,
			content: data.content,
			type: data.type ?? MessageType.TEXT,
			replyTo: data.replyTo ?? null,
		},
	});
}

export async function findTeamChatMessageById(
	id: string
): Promise<TeamChatMessageWithRelations | null> {
	return prisma.teamChatMessage.findUnique({
		where: { id },
		include: {
			team: true,
			user: true,
			parent: true,
			replies: true,
		},
	});
}

export async function findTeamChatMessagesByTeamId(
	teamId: string
): Promise<TeamChatMessageWithRelations[]> {
	return prisma.teamChatMessage.findMany({
		where: { teamId },
		include: {
			team: true,
			user: true,
			parent: true,
			replies: true,
		},
		orderBy: { createdAt: "asc" },
	});
}

export async function updateTeamChatMessage(
	id: string,
	data: Partial<TeamChatMessageCreationAttributes>
): Promise<PrismaTeamChatMessage> {
	return prisma.teamChatMessage.update({
		where: { id },
		data,
	});
}

export async function deleteTeamChatMessage(
	id: string
): Promise<PrismaTeamChatMessage> {
	return prisma.teamChatMessage.delete({
		where: { id },
	});
}

export function isSystemMessage(message: PrismaTeamChatMessage): boolean {
	return message.type === MessageType.SYSTEM;
}

export function isFileMessage(message: PrismaTeamChatMessage): boolean {
	return message.type === MessageType.FILE;
}

export function isImageMessage(message: PrismaTeamChatMessage): boolean {
	return message.type === MessageType.IMAGE;
}

export function isTextMessage(message: PrismaTeamChatMessage): boolean {
	return message.type === MessageType.TEXT;
}
