// Job model

import type { Job, Prisma } from "@prisma/client";

import prisma from "@/config/prisma";

// Job-related enums
export enum JobStatus {
	PENDING = "pending",
	RUNNING = "running",
	COMPLETED = "completed",
	FAILED = "failed",
}

export enum JobType {
	SAM_SYNC = "sam_sync",
	EMAIL_NOTIFICATION = "email_notification",
	FILTER_PROCESSING = "filter_processing",
	DATA_EXPORT = "data_export",
}

// Re-export Prisma types
export type { Job };
export type JobCreateInput = Prisma.JobCreateInput;
export type JobUpdateInput = Prisma.JobUpdateInput;
export type JobWhereInput = Prisma.JobWhereInput;
export type JobWhereUniqueInput = Prisma.JobWhereUniqueInput;
export type JobFindManyArgs = Prisma.JobFindManyArgs;

// Prisma Job model operations
export default {
	async findByPk(id: string): Promise<Job | null> {
		return prisma.job.findUnique({ where: { id } });
	},

	async findAll(options: JobFindManyArgs = {}): Promise<Job[]> {
		return prisma.job.findMany(options);
	},

	async create(data: JobCreateInput): Promise<Job> {
		return prisma.job.create({ data });
	},

	async update(data: JobUpdateInput, options: { where: JobWhereUniqueInput }): Promise<Job> {
		return prisma.job.update({ where: options.where, data });
	},

	async destroy(options: { where: JobWhereUniqueInput }): Promise<Job> {
		return prisma.job.delete({ where: options.where });
	},

	async findOne(options: { where: JobWhereInput }): Promise<Job | null> {
		return prisma.job.findFirst(options);
	},

	async findByUser(userId: string): Promise<Job[]> {
		return prisma.job.findMany({ where: { userId } });
	},

	async findActive(): Promise<Job[]> {
		return prisma.job.findMany({ where: { status: "active" } });
	},

	async count(options: { where?: JobWhereInput } = {}): Promise<number> {
		return prisma.job.count(options);
	},
};
