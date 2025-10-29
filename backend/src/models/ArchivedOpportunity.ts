// Prisma-based ArchivedOpportunity model

import type { ArchivedOpportunity, Prisma } from "@prisma/client";

import prisma from "@/config/prisma";

// Re-export Prisma types
export type { ArchivedOpportunity };
export type ArchivedOpportunityCreateInput =
	Prisma.ArchivedOpportunityCreateInput;
export type ArchivedOpportunityUpdateInput =
	Prisma.ArchivedOpportunityUpdateInput;
export type ArchivedOpportunityWhereInput =
	Prisma.ArchivedOpportunityWhereInput;
export type ArchivedOpportunityWhereUniqueInput =
	Prisma.ArchivedOpportunityWhereUniqueInput;

// Include relations
export type ArchivedOpportunityWithRelations =
	Prisma.ArchivedOpportunityGetPayload<{
		include: {
			user: true;
			opportunity: true;
		};
	}>;

// Query options types
export type ArchivedOpportunityFindManyOptions = Omit<
	Prisma.ArchivedOpportunityFindManyArgs,
	"include"
> & {
	include?: Partial<{
		user: boolean;
		opportunity: boolean;
	}>;
};

// Prisma ArchivedOpportunity model operations
export default {
	async findByPk(id: string): Promise<ArchivedOpportunityWithRelations | null> {
		return prisma.archivedOpportunity.findUnique({
			where: { id },
			include: {
				user: true,
				opportunity: true,
			},
		});
	},

	async findAll(
		options: ArchivedOpportunityFindManyOptions = {}
	): Promise<ArchivedOpportunityWithRelations[]> {
		return prisma.archivedOpportunity.findMany({
			...options,
			include: {
				user: true,
				opportunity: true,
				...options.include,
			},
		});
	},

	async findByUserId(
		userId: string,
		options: ArchivedOpportunityFindManyOptions = {}
	): Promise<ArchivedOpportunityWithRelations[]> {
		return prisma.archivedOpportunity.findMany({
			where: { userId },
			include: {
				user: true,
				opportunity: true,
				...options.include,
			},
			...options,
		});
	},

	async findByUserAndOpportunity(
		userId: string,
		opportunityId: string
	): Promise<ArchivedOpportunityWithRelations | null> {
		return prisma.archivedOpportunity.findFirst({
			where: {
				userId,
				opportunityId,
			},
			include: {
				user: true,
				opportunity: true,
			},
		});
	},

	async countByUserId(userId: string): Promise<number> {
		return prisma.archivedOpportunity.count({
			where: { userId },
		});
	},

	async create(
		data: ArchivedOpportunityCreateInput
	): Promise<ArchivedOpportunityWithRelations> {
		return prisma.archivedOpportunity.create({
			data,
			include: {
				user: true,
				opportunity: true,
			},
		});
	},

	async update(
		data: ArchivedOpportunityUpdateInput,
		options: { where: ArchivedOpportunityWhereUniqueInput }
	): Promise<ArchivedOpportunityWithRelations> {
		return prisma.archivedOpportunity.update({
			where: options.where,
			data,
			include: {
				user: true,
				opportunity: true,
			},
		});
	},

	async destroy(options: {
		where: ArchivedOpportunityWhereUniqueInput;
	}): Promise<ArchivedOpportunity> {
		return prisma.archivedOpportunity.delete({ where: options.where });
	},

	async findOne(options: {
		where: ArchivedOpportunityWhereInput;
	}): Promise<ArchivedOpportunityWithRelations | null> {
		return prisma.archivedOpportunity.findFirst({
			where: options.where,
			include: {
				user: true,
				opportunity: true,
			},
		});
	},

	async count(
		options: { where?: ArchivedOpportunityWhereInput } = {}
	): Promise<number> {
		return prisma.archivedOpportunity.count(options);
	},

	// Get archived opportunities stats for a user
	async getUserStats(userId: string): Promise<{
		total: number;
		dropboxSynced: number;
		byStatus: Record<string, number>;
	}> {
		const stats = await prisma.archivedOpportunity.groupBy({
			by: ["syncStatus"],
			where: { userId },
			_count: true,
		});

		const totalCount = await prisma.archivedOpportunity.count({
			where: { userId },
		});

		const dropboxSyncedCount = await prisma.archivedOpportunity.count({
			where: {
				userId,
				isDropboxSynced: true,
			},
		});

		return {
			total: totalCount,
			dropboxSynced: dropboxSyncedCount,
			byStatus: stats.reduce(
				(
					acc: Record<string, number>,
					stat: { syncStatus: string; _count: number }
				) => {
					acc[stat.syncStatus] = stat._count;
					return acc;
				},
				{} as Record<string, number>
			),
		};
	},

	// Update sync status for a single archived opportunity
	async updateSingleSyncStatus(
		id: string,
		syncStatus:
			| "CANCELLED"
			| "COMPLETED"
			| "FAILED"
			| "IN_PROGRESS"
			| "PENDING",
		attachmentCount?: number,
		syncedAttachmentCount?: number,
		syncError?: string
	): Promise<ArchivedOpportunity> {
		return prisma.archivedOpportunity.update({
			where: { id },
			data: {
				syncStatus,
				...(attachmentCount !== undefined && { attachmentCount }),
				...(syncedAttachmentCount !== undefined && { syncedAttachmentCount }),
				...(syncError && { syncError }),
				...(syncStatus === "COMPLETED" && {
					isDropboxSynced: true,
					dropboxSyncedAt: new Date(),
				}),
			},
		});
	},

	// Update sync status for multiple archived opportunities
	async updateSyncStatus(
		userId: string,
		opportunityIds: string[],
		syncStatus:
			| "CANCELLED"
			| "COMPLETED"
			| "FAILED"
			| "IN_PROGRESS"
			| "PENDING",
		syncError?: string
	): Promise<{ count: number }> {
		return prisma.archivedOpportunity.updateMany({
			where: {
				userId,
				opportunityId: { in: opportunityIds },
			},
			data: {
				syncStatus,
				...(syncError !== undefined && { syncError }),
				...(syncStatus === "COMPLETED" && {
					isDropboxSynced: true,
					dropboxSyncedAt: new Date(),
				}),
			},
		});
	},
};
