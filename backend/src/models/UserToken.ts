import type { Prisma, UserToken } from "@prisma/client";
import { VerificationType } from "./prisma";

import prisma from "@/config/prisma";

// Re-export Prisma types
export type { UserToken, VerificationType };

// Define input types using Prisma's generated types
export type UserTokenCreateInput = Prisma.UserTokenCreateInput;
export type UserTokenUpdateInput = Prisma.UserTokenUpdateInput;
export type UserTokenWhereInput = Prisma.UserTokenWhereInput;
export type UserTokenWhereUniqueInput = Prisma.UserTokenWhereUniqueInput;

// Prisma UserToken model operations
export default {
  async findByPk(id: string): Promise<UserToken | null> {
    return prisma.userToken.findUnique({ where: { id } });
  },

  async findAll(
    options: Prisma.UserTokenFindManyArgs = {}
  ): Promise<UserToken[]> {
    return prisma.userToken.findMany(options);
  },

  async create(data: UserTokenCreateInput): Promise<UserToken> {
    return prisma.userToken.create({ data });
  },

  async update(
    data: UserTokenUpdateInput,
    options: { where: UserTokenWhereUniqueInput }
  ): Promise<UserToken> {
    return prisma.userToken.update({ where: options.where, data });
  },

  async destroy(options: {
    where: UserTokenWhereUniqueInput;
  }): Promise<UserToken> {
    return prisma.userToken.delete({ where: options.where });
  },

  async findOne(options: {
    where: UserTokenWhereInput;
  }): Promise<UserToken | null> {
    return prisma.userToken.findFirst(options);
  },

  async findByToken(token: string): Promise<UserToken | null> {
    return prisma.userToken.findFirst({ where: { token } });
  },

  async findByUser(userId: string): Promise<UserToken[]> {
    return prisma.userToken.findMany({ where: { userId } });
  },

  async findByType(type: string): Promise<UserToken[]> {
    return prisma.userToken.findMany({ where: { type } });
  },

  async count(options: { where?: UserTokenWhereInput } = {}): Promise<number> {
    return prisma.userToken.count(options);
  },
};
