// Opportunity model
import type { Opportunity, Prisma } from "@prisma/client";

import prisma from "@/config/prisma";

// Re-export Prisma types
export type { Opportunity };
export type OpportunityCreateInput = Prisma.OpportunityCreateInput;
export type OpportunityUpdateInput = Prisma.OpportunityUpdateInput;
export type OpportunityWhereInput = Prisma.OpportunityWhereInput;
export type OpportunityWhereUniqueInput = Prisma.OpportunityWhereUniqueInput;

// Prisma Opportunity model operations
export default {
	async findByPk(id: string): Promise<Opportunity | null> {
		return prisma.opportunity.findUnique({ where: { id } });
	},

	async findAll(
		options: Prisma.OpportunityFindManyArgs = {}
	): Promise<Opportunity[]> {
		return prisma.opportunity.findMany(options);
	},

	async create(data: OpportunityCreateInput): Promise<Opportunity> {
		return prisma.opportunity.create({ data });
	},

	async update(
		data: OpportunityUpdateInput,
		options: { where: OpportunityWhereUniqueInput }
	): Promise<Opportunity> {
		return prisma.opportunity.update({ where: options.where, data });
	},

	async destroy(options: {
		where: OpportunityWhereUniqueInput;
	}): Promise<Opportunity> {
		return prisma.opportunity.delete({ where: options.where });
	},

	async findOne(options: {
		where: OpportunityWhereInput;
	}): Promise<Opportunity | null> {
		return prisma.opportunity.findFirst(options);
	},

	async findAndCountAll(
		options: Prisma.OpportunityFindManyArgs = {}
	): Promise<{ rows: Opportunity[]; count: number }> {
		const [data, count] = await Promise.all([
			prisma.opportunity.findMany(options),
			prisma.opportunity.count(
				options.where ? { where: options.where } : undefined
			),
		]);
		return { rows: data, count };
	},

	async findActive(): Promise<Opportunity[]> {
		return prisma.opportunity.findMany({ where: { isActive: true } });
	},

	async findByAgency(organizationType: string): Promise<Opportunity[]> {
		return prisma.opportunity.findMany({ where: { organizationType } });
	},

	async count(
		options: { where?: OpportunityWhereInput } = {}
	): Promise<number> {
		return prisma.opportunity.count(options);
	},
};
