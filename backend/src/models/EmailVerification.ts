// EmailVerification model
import {
	type EmailVerification,
	type Prisma,
	VerificationType,
} from "@prisma/client";

import prisma from "@/config/prisma";

// Re-export Prisma types
export type { EmailVerification };
export type EmailVerificationCreateInput = Prisma.EmailVerificationCreateInput;
export type EmailVerificationUpdateInput = Prisma.EmailVerificationUpdateInput;
export type EmailVerificationWhereInput = Prisma.EmailVerificationWhereInput;
export type EmailVerificationWhereUniqueInput =
	Prisma.EmailVerificationWhereUniqueInput;

// Re-export enum
export { VerificationType };

// Utility functions for EmailVerification operations
export const isExpired = (verification: EmailVerification): boolean => {
	return new Date() > verification.expiresAt;
};

export const isValid = (verification: EmailVerification): boolean => {
	return !verification.isUsed && !isExpired(verification);
};

// Prisma EmailVerification model operations
export default {
	async findByPk(id: string): Promise<EmailVerification | null> {
		return prisma.emailVerification.findUnique({ where: { id } });
	},

	async findAll(options: Prisma.EmailVerificationFindManyArgs = {}): Promise<EmailVerification[]> {
		return prisma.emailVerification.findMany(options);
	},

	async create(data: EmailVerificationCreateInput): Promise<EmailVerification> {
		return prisma.emailVerification.create({ data });
	},

	async update(
		data: EmailVerificationUpdateInput,
		options: { where: EmailVerificationWhereUniqueInput },
	): Promise<EmailVerification> {
		return prisma.emailVerification.update({
			where: options.where,
			data,
		});
	},

	async destroy(options: { where: EmailVerificationWhereUniqueInput }): Promise<EmailVerification> {
		return prisma.emailVerification.delete({ where: options.where });
	},

	async deleteMany(options: { where: EmailVerificationWhereInput }): Promise<Prisma.BatchPayload> {
		return prisma.emailVerification.deleteMany({ where: options.where });
	},

	async findOne(options: { where: EmailVerificationWhereInput }): Promise<EmailVerification | null> {
		return prisma.emailVerification.findFirst(options);
	},

	async findByToken(token: string): Promise<EmailVerification | null> {
		return prisma.emailVerification.findFirst({ where: { token } });
	},

	async findByUser(userId: string): Promise<EmailVerification[]> {
		return prisma.emailVerification.findMany({ where: { userId } });
	},

	async findByEmail(email: string): Promise<EmailVerification[]> {
		return prisma.emailVerification.findMany({ where: { email } });
	},

	async count(options: { where?: EmailVerificationWhereInput } = {}): Promise<number> {
		return prisma.emailVerification.count(options);
	},
};
