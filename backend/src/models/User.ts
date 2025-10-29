// User model
import {
  type Prisma,
  UserRole as PrismaUserRole,
  type User,
} from "@prisma/client";

import prisma from "@/config/prisma";

// Re-export Prisma types
export { PrismaUserRole as UserRole };
export type { User };
export type UserCreateInput = Prisma.UserCreateInput;
// Extend update input to allow newly added fields before prisma generate runs
export interface ExtendedUserUpdateInput extends Prisma.UserUpdateInput {
  lastPasswordChangeAt?: Date | string | null;
}
export type UserUpdateInput = ExtendedUserUpdateInput;
export type UserWhereInput = Prisma.UserWhereInput;
export type UserWhereUniqueInput = Prisma.UserWhereUniqueInput;

// Utility functions for User operations
export const getFullName = (user: User): string => {
  return `${user.firstName} ${user.lastName}`;
};

export const isPremium = (user: User): boolean => {
  return (
    user.role === PrismaUserRole.PREMIUM ||
    user.role === PrismaUserRole.ENTERPRISE ||
    user.role === PrismaUserRole.ADMIN
  );
};

export const isEnterprise = (user: User): boolean => {
  return (
    user.role === PrismaUserRole.ENTERPRISE ||
    user.role === PrismaUserRole.ADMIN
  );
};

/**
 * Sanitize user object for client-side consumption
 * SECURITY: This function removes all sensitive fields that should never be exposed to the client
 *
 * The following fields are NEVER exposed to the client for security reasons:
 * - password: User password hash
 * - totpSecret: TOTP secret for 2FA
 * - totpBackupCodes: Backup codes for 2FA
 * - microsoftAccessToken: OAuth access token
 * - microsoftRefreshToken: OAuth refresh token
 * - microsoftTokenExpiry: Token expiry metadata
 * - googleAccessToken: OAuth access token
 * - googleRefreshToken: OAuth refresh token
 * - googleTokenExpiry: Token expiry metadata
 * - lastPasswordChangeAt: Internal security metadata
 */
export const toJSON = (user: User): Record<string, unknown> => {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    avatar: user.avatar,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    totpEnabled: user.totpEnabled,
    microsoftAccountId: (user as Record<string, unknown>).microsoftAccountId,
    microsoftEmail: (user as Record<string, unknown>).microsoftEmail,
    microsoftName: (user as Record<string, unknown>).microsoftName,
    microsoftConnectedAt: (user as Record<string, unknown>)
      .microsoftConnectedAt,
    googleAccountId: (user as Record<string, unknown>).googleAccountId,
    googleEmail: (user as Record<string, unknown>).googleEmail,
    googleName: (user as Record<string, unknown>).googleName,
    googleConnectedAt: (user as Record<string, unknown>).googleConnectedAt,
  };
};

// Prisma User model operations
export default {
  async findByPk(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  async findAll(options: Prisma.UserFindManyArgs = {}): Promise<User[]> {
    return prisma.user.findMany(options);
  },

  async create(data: UserCreateInput): Promise<User> {
    return prisma.user.create({ data });
  },

  async update(
    data: ExtendedUserUpdateInput,
    options: { where: UserWhereUniqueInput }
  ): Promise<User> {
    return prisma.user.update({
      where: options.where,
      data: data as Prisma.UserUpdateInput,
    });
  },

  async destroy(options: { where: UserWhereUniqueInput }): Promise<User> {
    return prisma.user.delete({ where: options.where });
  },

  async findOne(options: { where: UserWhereInput }): Promise<User | null> {
    return prisma.user.findFirst(options);
  },

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { email } });
  },

  async findByRole(role: PrismaUserRole): Promise<User[]> {
    return prisma.user.findMany({ where: { role } });
  },

  async count(options: { where?: UserWhereInput } = {}): Promise<number> {
    return prisma.user.count(options);
  },
};
