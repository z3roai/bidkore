// FilterOpportunity model
import type { FilterOpportunity, Prisma } from "@prisma/client";

import prisma from "@/config/prisma";

// Re-export Prisma types
export type { FilterOpportunity };
export type FilterOpportunityCreateInput = Prisma.FilterOpportunityCreateInput;
export type FilterOpportunityUpdateInput = Prisma.FilterOpportunityUpdateInput;
export type FilterOpportunityWhereInput = Prisma.FilterOpportunityWhereInput;
export type FilterOpportunityWhereUniqueInput =
	Prisma.FilterOpportunityWhereUniqueInput;

// Prisma FilterOpportunity model operations
export default {
	async findByPk(id: string): Promise<FilterOpportunity | null> {
		return prisma.filterOpportunity.findUnique({ where: { id } });
	},

	async findAll(options: Prisma.FilterOpportunityFindManyArgs = {}): Promise<FilterOpportunity[]> {
		return prisma.filterOpportunity.findMany(options);
	},

	async create(data: FilterOpportunityCreateInput): Promise<FilterOpportunity> {
		return prisma.filterOpportunity.create({ data });
	},

	async update(
		data: FilterOpportunityUpdateInput,
		options: { where: FilterOpportunityWhereUniqueInput },
	): Promise<FilterOpportunity> {
		return prisma.filterOpportunity.update({
			where: options.where,
			data,
		});
	},

	async destroy(options: { where: FilterOpportunityWhereUniqueInput }): Promise<FilterOpportunity> {
		return prisma.filterOpportunity.delete({ where: options.where });
	},

	async findOne(options: { where: FilterOpportunityWhereInput }): Promise<FilterOpportunity | null> {
		return prisma.filterOpportunity.findFirst(options);
	},

	async findByFilter(filterId: string): Promise<FilterOpportunity[]> {
		return prisma.filterOpportunity.findMany({ where: { filterId } });
	},

	async findByOpportunity(opportunityId: string): Promise<FilterOpportunity[]> {
		return prisma.filterOpportunity.findMany({
			where: { opportunityId },
		});
	},

	async count(options: { where?: FilterOpportunityWhereInput } = {}): Promise<number> {
		return prisma.filterOpportunity.count(options);
	},
};
