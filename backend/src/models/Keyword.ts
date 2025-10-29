import prisma from "@/config/prisma";
import loggingService from "@/services/loggingService";

// Keyword type definition
export interface Keyword {
	id: string;
	keyword: string;
	description?: string | null;
	userId?: string | null;
	teamId?: string | null;
	isActive: boolean;
	lastSearchedAt?: Date | null;
	searchCount: number;
	opportunityCount: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface KeywordCreationAttributes {
	keyword: string;
	description?: string | null;
	userId?: string | null;
	teamId?: string | null;
	isActive?: boolean;
}

export interface KeywordUpdateAttributes {
	keyword?: string;
	description?: string | null;
	isActive?: boolean;
	lastSearchedAt?: Date | null;
	searchCount?: number;
	opportunityCount?: number;
}

// Prisma-based utility functions for Keyword
export const KeywordUtils = {
	async create(data: KeywordCreationAttributes): Promise<Keyword | null> {
		try {
			// Use raw query since prisma.keyword might not be available
			const result = await prisma.$queryRaw<Keyword[]>`
        INSERT INTO keywords (keyword, description, user_id, team_id, is_active)
        VALUES (${data.keyword}, ${data.description ?? null}, ${
				data.userId ?? null
			}, ${data.teamId ?? null}, ${data.isActive !== false})
        RETURNING *
      `;
			return result[0] ?? null;
		} catch (error) {
			loggingService.error("Error creating keyword:", error);
			throw error;
		}
	},

	async findById(id: string): Promise<Keyword | null> {
		try {
			const result = await prisma.$queryRaw<Keyword[]>`
        SELECT * FROM keywords WHERE id = ${id}
      `;
			return result[0] ?? null;
		} catch (error) {
			loggingService.error("Error finding keyword by id:", error);
			throw error;
		}
	},

	async findByUserId(userId: string): Promise<Keyword[]> {
		try {
			return prisma.$queryRaw<Keyword[]>`
        SELECT * FROM keywords WHERE user_id = ${userId} ORDER BY created_at DESC
      `;
		} catch (error) {
			loggingService.error("Error finding keywords by user id:", error);
			throw error;
		}
	},

	async findByTeamId(teamId: string): Promise<Keyword[]> {
		try {
			return prisma.$queryRaw<Keyword[]>`
        SELECT * FROM keywords WHERE team_id = ${teamId} ORDER BY created_at DESC
      `;
		} catch (error) {
			loggingService.error("Error finding keywords by team id:", error);
			throw error;
		}
	},

	async findActive(): Promise<Keyword[]> {
		try {
			return prisma.$queryRaw<Keyword[]>`
        SELECT * FROM keywords WHERE is_active = true ORDER BY created_at DESC
      `;
		} catch (error) {
			loggingService.error("Error finding active keywords:", error);
			throw error;
		}
	},

	async update(
		id: string,
		data: KeywordUpdateAttributes
	): Promise<Keyword | null> {
		try {
			const updateFields = [];
			const values: unknown[] = [id];
			let paramIndex = 2;

			if (data.keyword !== undefined) {
				updateFields.push(`keyword = $${paramIndex++}`);
				values.push(data.keyword);
			}
			if (data.description !== undefined) {
				updateFields.push(`description = $${paramIndex++}`);
				values.push(data.description);
			}
			if (data.isActive !== undefined) {
				updateFields.push(`is_active = $${paramIndex++}`);
				values.push(data.isActive);
			}
			if (data.searchCount !== undefined) {
				updateFields.push(`search_count = $${paramIndex++}`);
				values.push(data.searchCount);
			}
			if (data.opportunityCount !== undefined) {
				updateFields.push(`opportunity_count = $${paramIndex++}`);
				values.push(data.opportunityCount);
			}
			if (data.lastSearchedAt !== undefined) {
				updateFields.push(`last_searched_at = $${paramIndex++}`);
				values.push(data.lastSearchedAt);
			}

			if (updateFields.length === 0) {
				throw new Error("No fields to update");
			}

			const result = await prisma.$queryRawUnsafe<Keyword[]>(
				`UPDATE keywords SET ${updateFields.join(
					", "
				)}, updated_at = NOW() WHERE id = $1 RETURNING *`,
				...values
			);
			return result[0] ?? null;
		} catch (error) {
			loggingService.error("Error updating keyword:", error);
			throw error;
		}
	},

	async delete_(id: string): Promise<Keyword | null> {
		try {
			const result = await prisma.$queryRaw<Keyword[]>`
        DELETE FROM keywords WHERE id = ${id} RETURNING *
      `;
			return result[0] ?? null;
		} catch (error) {
			loggingService.error("Error deleting keyword:", error);
			throw error;
		}
	},

	async findAll(): Promise<Keyword[]> {
		try {
			return prisma.$queryRaw<Keyword[]>`
        SELECT * FROM keywords ORDER BY created_at DESC
      `;
		} catch (error) {
			loggingService.error("Error finding all keywords:", error);
			throw error;
		}
	},
};

export default KeywordUtils;
