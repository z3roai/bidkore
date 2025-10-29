// TeamMember model
import {
  type TeamMember as PrismaTeamMember,
  type Team,
  type User,
} from "@prisma/client";
import { TeamRole } from "./prisma";

import prisma from "@/config/prisma";

export { TeamRole };

export interface TeamMemberAttributes {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMemberCreationAttributes {
  teamId: string;
  userId: string;
  role?: TeamRole;
}

export interface TeamMemberWithRelations extends PrismaTeamMember {
  user?: User;
  team?: Team;
}

// Prisma-based utility functions for TeamMember
export const createTeamMember = async (
  data: TeamMemberCreationAttributes
): Promise<PrismaTeamMember> => {
  return prisma.teamMember.create({
    data: {
      teamId: data.teamId,
      userId: data.userId,
      role: data.role ?? TeamRole.MEMBER,
      joinedAt: new Date(),
    },
  });
};

export const findTeamMemberById = async (
  id: string
): Promise<TeamMemberWithRelations | null> => {
  return prisma.teamMember.findUnique({
    where: { id },
    include: {
      user: true,
      team: true,
    },
  });
};

export const findTeamMembersByTeamId = async (
  teamId: string
): Promise<TeamMemberWithRelations[]> => {
  return prisma.teamMember.findMany({
    where: { teamId },
    include: {
      user: true,
      team: true,
    },
    orderBy: { joinedAt: "asc" },
  });
};

export const findTeamMembersByUserId = async (
  userId: string
): Promise<TeamMemberWithRelations[]> => {
  return prisma.teamMember.findMany({
    where: { userId },
    include: {
      user: true,
      team: true,
    },
    orderBy: { joinedAt: "desc" },
  });
};

export const findTeamMemberByUserAndTeam = async (
  userId: string,
  teamId: string
): Promise<TeamMemberWithRelations | null> => {
  return prisma.teamMember.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
    include: {
      user: true,
      team: true,
    },
  });
};

export const findTeamOwnersByTeamId = async (
  teamId: string
): Promise<TeamMemberWithRelations[]> => {
  return prisma.teamMember.findMany({
    where: {
      teamId,
      role: TeamRole.OWNER,
    },
    include: {
      user: true,
      team: true,
    },
  });
};

export const findTeamAdminsByTeamId = async (
  teamId: string
): Promise<TeamMemberWithRelations[]> => {
  return prisma.teamMember.findMany({
    where: {
      teamId,
      role: {
        in: [TeamRole.OWNER, TeamRole.ADMIN],
      },
    },
    include: {
      user: true,
      team: true,
    },
  });
};

export const updateTeamMember = async (
  id: string,
  data: Partial<TeamMemberCreationAttributes>
): Promise<PrismaTeamMember> => {
  return prisma.teamMember.update({
    where: { id },
    data,
  });
};

export const updateTeamMemberRole = async (
  userId: string,
  teamId: string,
  role: TeamRole
): Promise<PrismaTeamMember> => {
  return prisma.teamMember.update({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
    data: { role },
  });
};

export const deleteTeamMember = async (
  id: string
): Promise<PrismaTeamMember> => {
  return prisma.teamMember.delete({
    where: { id },
  });
};

export const removeTeamMemberByUserAndTeam = async (
  userId: string,
  teamId: string
): Promise<PrismaTeamMember> => {
  return prisma.teamMember.delete({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
  });
};

export const isTeamMember = async (
  userId: string,
  teamId: string
): Promise<boolean> => {
  const member = await prisma.teamMember.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
  });
  return Boolean(member);
};

export const isTeamOwner = async (
  userId: string,
  teamId: string
): Promise<boolean> => {
  const member = await prisma.teamMember.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
  });
  return member?.role === TeamRole.OWNER;
};

export const isTeamAdmin = async (
  userId: string,
  teamId: string
): Promise<boolean> => {
  const member = await prisma.teamMember.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
  });
  return member?.role === TeamRole.OWNER || member?.role === TeamRole.ADMIN;
};

export const hasTeamMemberPermission = (
  member: PrismaTeamMember,
  requiredRole: TeamRole
): boolean => {
  const roleHierarchy = {
    [TeamRole.OWNER]: 3,
    [TeamRole.ADMIN]: 2,
    [TeamRole.MEMBER]: 1,
  };

  return roleHierarchy[member.role] >= roleHierarchy[requiredRole];
};
