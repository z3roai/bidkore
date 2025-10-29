// Subscription model
import type { Prisma, Subscription } from "@prisma/client";

import prisma from "@/config/prisma";

// Re-export Prisma types
export type { Subscription };
export type SubscriptionCreateInput = Prisma.SubscriptionCreateInput;
export type SubscriptionUpdateInput = Prisma.SubscriptionUpdateInput;
export type SubscriptionWhereInput = Prisma.SubscriptionWhereInput;
export type SubscriptionWhereUniqueInput = Prisma.SubscriptionWhereUniqueInput;

// Prisma Subscription model operations
export default {
	async findByPk(id: string): Promise<Subscription | null> {
		return prisma.subscription.findUnique({ where: { id } });
	},

	async findAll(options: Prisma.SubscriptionFindManyArgs = {}): Promise<Subscription[]> {
		return prisma.subscription.findMany(options);
	},

	async create(data: SubscriptionCreateInput): Promise<Subscription> {
		return prisma.subscription.create({ data });
	},

	async update(
		data: SubscriptionUpdateInput,
		options: { where: SubscriptionWhereUniqueInput },
	): Promise<Subscription> {
		return prisma.subscription.update({ where: options.where, data });
	},

	async destroy(options: { where: SubscriptionWhereUniqueInput }): Promise<Subscription> {
		return prisma.subscription.delete({ where: options.where });
	},

	async findOne(options: { where: SubscriptionWhereInput }): Promise<Subscription | null> {
		return prisma.subscription.findFirst(options);
	},

	async findByUser(userId: string): Promise<Subscription[]> {
		return prisma.subscription.findMany({ where: { userId } });
	},

	async findActive(): Promise<Subscription[]> {
		return prisma.subscription.findMany({ where: { status: "ACTIVE" } });
	},

	async count(options: { where?: SubscriptionWhereInput } = {}): Promise<number> {
		return prisma.subscription.count(options);
	},

	// Upsert a subscription uniquely by userId
	async upsertByUserId(
		userId: string,
		createData: SubscriptionCreateInput,
		updateData: SubscriptionUpdateInput,
	): Promise<Subscription> {
		return prisma.subscription.upsert({
			where: { userId },
			create: createData,
			update: updateData,
		});
	},
};
