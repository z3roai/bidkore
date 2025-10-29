// Team model
import type { Prisma, Team, TeamMember } from "@prisma/client";

import prisma from "@/config/prisma";

// Re-export Prisma types
export type { Team, TeamMember };
export type TeamCreateInput = Prisma.TeamCreateInput;
export type TeamUpdateInput = Prisma.TeamUpdateInput;
export type TeamWhereInput = Prisma.TeamWhereInput;
export type TeamWhereUniqueInput = Prisma.TeamWhereUniqueInput;

// Team with related data types - using Prisma's generated types
export type TeamWithDetails = Prisma.TeamGetPayload<{
  include: {
    teamMembers: {
      include: {
        user: {
          select: {
            id: true;
            firstName: true;
            lastName: true;
            email: true;
          };
        };
      };
    };
    filters: {
      where: {
        isActive: true;
      };
    };
  };
}>;

// TeamMember types
export type TeamMemberCreateInput = Prisma.TeamMemberCreateInput;
export type TeamMemberUpdateInput = Prisma.TeamMemberUpdateInput;
export type TeamMemberWhereInput = Prisma.TeamMemberWhereInput;
export type TeamMemberWhereUniqueInput = Prisma.TeamMemberWhereUniqueInput;

// Prisma Team model operations
export default {
  async findByPk(id: string): Promise<Team | null> {
    return prisma.team.findUnique({ where: { id } });
  },

  async findByPkWithDetails(id: string): Promise<TeamWithDetails | null> {
    return prisma.team.findUnique({
      where: { id },
      include: {
        teamMembers: {
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
        filters: {
          where: {
            isActive: true,
          },
        },
      },
    });
  },

  async findAll(options: Prisma.TeamFindManyArgs = {}): Promise<Team[]> {
    return prisma.team.findMany(options);
  },

  async create(data: TeamCreateInput): Promise<Team> {
    return prisma.team.create({ data });
  },

  async update(
    data: TeamUpdateInput,
    options: { where: TeamWhereUniqueInput },
  ): Promise<Team> {
    return prisma.team.update({ where: options.where, data });
  },

  async destroy(options: { where: TeamWhereUniqueInput }): Promise<Team> {
    return prisma.team.delete({ where: options.where });
  },

  async findOne(options: { where: TeamWhereInput }): Promise<Team | null> {
    return prisma.team.findFirst(options);
  },

  async findByCreator(createdBy: string): Promise<Team[]> {
    return prisma.team.findMany({ where: { createdBy } });
  },

  async findUserTeams(userId: string): Promise<Team[]> {
    return prisma.team.findMany({
      where: {
        isActive: true,
        teamMembers: {
          some: {
            userId,
          },
        },
      },
      include: {
        filters: {
          where: {
            isActive: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  },

  async findActive(): Promise<Team[]> {
    return prisma.team.findMany({ where: { isActive: true } });
  },

  async count(options: { where?: TeamWhereInput } = {}): Promise<number> {
    return prisma.team.count(options);
  },
};

// Export TeamMember as a separate model
export const TeamMemberModel = {
  async findByPk(id: string): Promise<TeamMember | null> {
    return prisma.teamMember.findUnique({ where: { id } });
  },

  async findAll(
    options: Prisma.TeamMemberFindManyArgs = {},
  ): Promise<TeamMember[]> {
    return prisma.teamMember.findMany(options);
  },

  async create(data: TeamMemberCreateInput): Promise<TeamMember> {
    return prisma.teamMember.create({ data });
  },

  async update(
    data: TeamMemberUpdateInput,
    options: { where: TeamMemberWhereUniqueInput },
  ): Promise<TeamMember> {
    return prisma.teamMember.update({ where: options.where, data });
  },

  async destroy(options: {
    where: TeamMemberWhereUniqueInput;
  }): Promise<TeamMember> {
    return prisma.teamMember.delete({ where: options.where });
  },

  async findOne(options: {
    where: TeamMemberWhereInput;
  }): Promise<TeamMember | null> {
    return prisma.teamMember.findFirst(options);
  },

  async findByTeam(teamId: string): Promise<TeamMember[]> {
    return prisma.teamMember.findMany({ where: { teamId } });
  },

  async findByUser(userId: string): Promise<TeamMember[]> {
    return prisma.teamMember.findMany({ where: { userId } });
  },

  async count(options: { where?: TeamMemberWhereInput } = {}): Promise<number> {
    return prisma.teamMember.count(options);
  },
};
