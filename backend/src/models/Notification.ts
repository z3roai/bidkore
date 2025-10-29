import type { Notification, Prisma } from "@prisma/client";

import prisma from "@/config/prisma";

export type { Notification };
export type NotificationCreateInput = Prisma.NotificationCreateInput;
export type NotificationUpdateInput = Prisma.NotificationUpdateInput;
export type NotificationWhereInput = Prisma.NotificationWhereInput;
export type NotificationWhereUniqueInput = Prisma.NotificationWhereUniqueInput;

export default {
	async findByPk(id: string): Promise<Notification | null> {
		return prisma.notification.findUnique({ where: { id } });
	},

	async findAll(
		options: Prisma.NotificationFindManyArgs = {}
	): Promise<Notification[]> {
		return prisma.notification.findMany(options);
	},

	async findOne(options: {
		where: NotificationWhereInput;
	}): Promise<Notification | null> {
		return prisma.notification.findFirst(options);
	},

	async findAndCountAll(
		options: Prisma.NotificationFindManyArgs = {}
	): Promise<{ rows: Notification[]; count: number }> {
		const [rows, count] = await Promise.all([
			prisma.notification.findMany(options),
			prisma.notification.count(
				options.where ? { where: options.where } : undefined
			),
		]);
		return { rows, count };
	},

	async count(
		options: { where?: NotificationWhereInput } = {}
	): Promise<number> {
		return prisma.notification.count(options);
	},

	async create(data: NotificationCreateInput): Promise<Notification> {
		return prisma.notification.create({ data });
	},

	async update(
		data: NotificationUpdateInput,
		options: { where: NotificationWhereUniqueInput }
	): Promise<Notification> {
		return prisma.notification.update({ where: options.where, data });
	},

	async delete(options: {
		where: NotificationWhereUniqueInput;
	}): Promise<Notification> {
		return prisma.notification.delete({ where: options.where });
	},

	async updateMany(
		data: NotificationUpdateInput,
		options: { where: NotificationWhereInput }
	): Promise<Prisma.BatchPayload> {
		return prisma.notification.updateMany({ where: options.where, data });
	},

	async markAsRead(id: string, userId: string): Promise<Prisma.BatchPayload> {
		// Ensure ownership when marking as read
		return prisma.notification.updateMany({
			where: { id, userId },
			data: { isRead: true },
		});
	},

	async markAllAsReadByUser(userId: string): Promise<Prisma.BatchPayload> {
		return prisma.notification.updateMany({
			where: { userId, isRead: false },
			data: { isRead: true },
		});
	},
};
