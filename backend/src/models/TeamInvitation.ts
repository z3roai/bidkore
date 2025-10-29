// TeamInvitation model

import {
	InvitationStatus,
	type TeamInvitation as PrismaTeamInvitation,
	type Team,
	type TeamRole,
	type User,
} from "@prisma/client";

import prisma from "@/config/prisma";

export { InvitationStatus };

export interface TeamInvitationAttributes {
	id: string;
	teamId: string;
	email: string;
	invitedBy: string;
	status: InvitationStatus;
	expiresAt: Date;
	token?: string;
	role: TeamRole;
	customMessage?: string;
	acceptedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

export interface TeamInvitationCreationAttributes {
	teamId: string;
	email: string;
	invitedBy: string;
	expiresAt: Date;
	status?: InvitationStatus;
	token?: string;
	role?: TeamRole;
	customMessage?: string;
}

export interface TeamInvitationWithRelations {
	id: string;
	teamId: string;
	email: string;
	invitedBy: string;
	status: InvitationStatus;
	expiresAt: Date;
	token: string | null;
	role: TeamRole;
	customMessage: string | null;
	acceptedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	team?: Team;
	inviter?: User;
}

export interface TeamInvitationWithUsers {
	id: string;
	teamId: string;
	email: string;
	invitedBy: string;
	status: InvitationStatus;
	expiresAt: Date;
	createdAt: Date;
	updatedAt: Date;
	team?: Team;
	inviter?: User;
}

// Prisma-based utility functions for TeamInvitation
export async function createTeamInvitation(
	data: TeamInvitationCreationAttributes,
): Promise<PrismaTeamInvitation> {
	return prisma.teamInvitation.create({
		data: {
			teamId: data.teamId,
			email: data.email,
			invitedBy: data.invitedBy,
			status: data.status ?? InvitationStatus.PENDING,
			expiresAt: data.expiresAt,
			token: data.token ?? "",
			role: data.role ?? "MEMBER",
			customMessage: data.customMessage ?? null,
		},
	});
}

export async function findTeamInvitationById(
	id: string,
): Promise<TeamInvitationWithRelations | null> {
	const result = await prisma.teamInvitation.findUnique({
		where: { id },
		include: {
			team: true,
			inviter: true,
		},
	});
	return result as TeamInvitationWithRelations | null;
}

export async function findTeamInvitationsByTeamId(
	teamId: string,
): Promise<TeamInvitationWithRelations[]> {
	const results = await prisma.teamInvitation.findMany({
		where: { teamId },
		include: {
			team: true,
			inviter: true,
		},
		orderBy: { createdAt: "desc" },
	});
	return results as TeamInvitationWithRelations[];
}

export async function findTeamInvitationsByEmail(
	email: string,
): Promise<TeamInvitationWithRelations[]> {
	const results = await prisma.teamInvitation.findMany({
		where: { email },
		include: {
			team: true,
			inviter: true,
		},
		orderBy: { createdAt: "desc" },
	});
	return results as TeamInvitationWithRelations[];
}

export async function findPendingTeamInvitations(): Promise<
	TeamInvitationWithRelations[]
> {
	const results = await prisma.teamInvitation.findMany({
		where: {
			status: InvitationStatus.PENDING,
			expiresAt: {
				gt: new Date(),
			},
		},
		include: {
			team: true,
			inviter: true,
		},
		orderBy: { createdAt: "desc" },
	});
	return results as TeamInvitationWithRelations[];
}

export async function findExpiredTeamInvitations(): Promise<
	TeamInvitationWithRelations[]
> {
	const results = await prisma.teamInvitation.findMany({
		where: {
			status: InvitationStatus.PENDING,
			expiresAt: {
				lte: new Date(),
			},
		},
		include: {
			team: true,
			inviter: true,
		},
	});
	return results as TeamInvitationWithRelations[];
}

export async function updateTeamInvitation(
	id: string,
	data: Partial<TeamInvitationCreationAttributes>,
): Promise<PrismaTeamInvitation> {
	return prisma.teamInvitation.update({
		where: { id },
		data,
	});
}

export async function updateTeamInvitationStatus(
	id: string,
	status: InvitationStatus,
): Promise<PrismaTeamInvitation> {
	return prisma.teamInvitation.update({
		where: { id },
		data: { status },
	});
}

export async function deleteTeamInvitation(
	id: string,
): Promise<PrismaTeamInvitation> {
	return prisma.teamInvitation.delete({
		where: { id },
	});
}

export async function expireOldTeamInvitations(): Promise<{ count: number }> {
	return prisma.teamInvitation.updateMany({
		where: {
			status: InvitationStatus.PENDING,
			expiresAt: {
				lte: new Date(),
			},
		},
		data: {
			status: InvitationStatus.EXPIRED,
		},
	});
}

export function isTeamInvitationExpired(
	invitation: PrismaTeamInvitation | TeamInvitationWithRelations,
): boolean {
	return invitation.expiresAt < new Date();
}

export function isTeamInvitationPending(
	invitation: PrismaTeamInvitation | TeamInvitationWithRelations,
): boolean {
	return (
		invitation.status === InvitationStatus.PENDING &&
		!isTeamInvitationExpired(invitation)
	);
}

export function isTeamInvitationAccepted(
	invitation: PrismaTeamInvitation | TeamInvitationWithRelations,
): boolean {
	return invitation.status === InvitationStatus.ACCEPTED;
}

export function isTeamInvitationCancelled(
	invitation: PrismaTeamInvitation | TeamInvitationWithRelations,
): boolean {
	return invitation.status === InvitationStatus.CANCELLED;
}

// For backward compatibility with service layer expecting data objects
export type TeamInvitation = PrismaTeamInvitation;
