// Stripe models
import type {
    Prisma,
    StripeCustomer as PrismaStripeCustomer,
    StripePayment as PrismaStripePayment,
    StripeSubscription as PrismaStripeSubscription,
} from "@prisma/client";

import prisma from "@/config/prisma";

// Re-export Prisma types
export type StripeCustomer = PrismaStripeCustomer;
export type StripeSubscription = PrismaStripeSubscription;
export type StripePayment = PrismaStripePayment;

export type StripeCustomerCreateInput = Prisma.StripeCustomerCreateInput;
export type StripeCustomerUpdateInput = Prisma.StripeCustomerUpdateInput;
export type StripeCustomerWhereInput = Prisma.StripeCustomerWhereInput;
export type StripeCustomerWhereUniqueInput =
	Prisma.StripeCustomerWhereUniqueInput;

export type StripeSubscriptionCreateInput =
	Prisma.StripeSubscriptionCreateInput;
export type StripeSubscriptionUpdateInput =
	Prisma.StripeSubscriptionUpdateInput;
export type StripeSubscriptionWhereInput = Prisma.StripeSubscriptionWhereInput;
export type StripeSubscriptionWhereUniqueInput =
	Prisma.StripeSubscriptionWhereUniqueInput;

export type StripePaymentCreateInput = Prisma.StripePaymentCreateInput;
export type StripePaymentUpdateInput = Prisma.StripePaymentUpdateInput;
export type StripePaymentWhereInput = Prisma.StripePaymentWhereInput;
export type StripePaymentWhereUniqueInput =
	Prisma.StripePaymentWhereUniqueInput;

// Prisma StripeCustomer model operations
export const StripeCustomerModel = {
	async findByPk(id: string): Promise<StripeCustomer | null> {
		return prisma.stripeCustomer.findUnique({ where: { id } });
	},

	async findAll(options: Prisma.StripeCustomerFindManyArgs = {}): Promise<StripeCustomer[]> {
		return prisma.stripeCustomer.findMany(options);
	},

	async create(data: StripeCustomerCreateInput): Promise<StripeCustomer> {
		return prisma.stripeCustomer.create({ data });
	},

	async update(
		data: StripeCustomerUpdateInput,
		options: { where: StripeCustomerWhereUniqueInput },
	): Promise<StripeCustomer> {
		return prisma.stripeCustomer.update({ where: options.where, data });
	},

	async destroy(options: { where: StripeCustomerWhereUniqueInput }): Promise<StripeCustomer> {
		return prisma.stripeCustomer.delete({ where: options.where });
	},

	async findOne(options: { where: StripeCustomerWhereInput }): Promise<StripeCustomer | null> {
		return prisma.stripeCustomer.findFirst(options);
	},

	async findByUserId(userId: string): Promise<StripeCustomer | null> {
		return prisma.stripeCustomer.findFirst({ where: { userId } });
	},

	async findByStripeId(stripeCustomerId: string): Promise<StripeCustomer | null> {
		return prisma.stripeCustomer.findFirst({
			where: { stripeCustomerId },
		});
	},

	async count(options: { where?: StripeCustomerWhereInput } = {}): Promise<number> {
		return prisma.stripeCustomer.count(options);
	},
};

// Prisma StripeSubscription model operations
export const StripeSubscriptionModel = {
	async findByPk(id: string): Promise<StripeSubscription | null> {
		return prisma.stripeSubscription.findUnique({ where: { id } });
	},

	async findAll(options: Prisma.StripeSubscriptionFindManyArgs = {}): Promise<StripeSubscription[]> {
		return prisma.stripeSubscription.findMany(options);
	},

	async create(data: StripeSubscriptionCreateInput): Promise<StripeSubscription> {
		return prisma.stripeSubscription.create({ data });
	},

	async update(
		data: StripeSubscriptionUpdateInput,
		options: { where: StripeSubscriptionWhereUniqueInput },
	): Promise<StripeSubscription> {
		return prisma.stripeSubscription.update({
			where: options.where,
			data,
		});
	},

	async destroy(options: { where: StripeSubscriptionWhereUniqueInput }): Promise<StripeSubscription> {
		return prisma.stripeSubscription.delete({ where: options.where });
	},

	async findOne(options: { where: StripeSubscriptionWhereInput }): Promise<StripeSubscription | null> {
		return prisma.stripeSubscription.findFirst(options);
	},

	async findByCustomerId(stripeCustomerId: string): Promise<StripeSubscription[]> {
		return prisma.stripeSubscription.findMany({
			where: { stripeCustomerId },
		});
	},

	async count(options: { where?: StripeSubscriptionWhereInput } = {}): Promise<number> {
		return prisma.stripeSubscription.count(options);
	},
};

// Prisma StripePayment model operations
export const StripePaymentModel = {
	async findByPk(id: string): Promise<StripePayment | null> {
		return prisma.stripePayment.findUnique({ where: { id } });
	},

	async findAll(options: Prisma.StripePaymentFindManyArgs = {}): Promise<StripePayment[]> {
		return prisma.stripePayment.findMany(options);
	},

	async create(data: StripePaymentCreateInput): Promise<StripePayment> {
		return prisma.stripePayment.create({ data });
	},

	async update(
		data: StripePaymentUpdateInput,
		options: { where: StripePaymentWhereUniqueInput },
	): Promise<StripePayment> {
		return prisma.stripePayment.update({ where: options.where, data });
	},

	async destroy(options: { where: StripePaymentWhereUniqueInput }): Promise<StripePayment> {
		return prisma.stripePayment.delete({ where: options.where });
	},

	async findOne(options: { where: StripePaymentWhereInput }): Promise<StripePayment | null> {
		return prisma.stripePayment.findFirst(options);
	},

	async findByCustomerId(stripeCustomerId: string): Promise<StripePayment[]> {
		return prisma.stripePayment.findMany({ where: { stripeCustomerId } });
	},

	async count(options: { where?: StripePaymentWhereInput } = {}): Promise<number> {
		return prisma.stripePayment.count(options);
	},
};

export default {
	StripeCustomerModel,
	StripeSubscriptionModel,
	StripePaymentModel,
};
