import type { Prisma, CompanyProfile } from "@prisma/client";

import prisma from "@/config/prisma";

export type { CompanyProfile };
export type CompanyProfileCreateInput = Prisma.CompanyProfileCreateInput;
export type CompanyProfileUpdateInput = Prisma.CompanyProfileUpdateInput;

export default {
  async findByUserId(userId: string): Promise<CompanyProfile | null> {
    return prisma.companyProfile.findUnique({ where: { userId } });
  },

  async upsertByUserId(
    userId: string,
    data: Omit<CompanyProfileUpdateInput, "user"> & Partial<CompanyProfileCreateInput>
  ): Promise<CompanyProfile> {
    return prisma.companyProfile.upsert({
      where: { userId },
      update: data as Prisma.CompanyProfileUpdateInput,
      create: { ...(data as Prisma.CompanyProfileCreateInput), user: { connect: { id: userId } } },
    });
  },

  async updateLogo(userId: string, logoUrl: string | null): Promise<CompanyProfile> {
    return prisma.companyProfile.update({ where: { userId }, data: { logoUrl } });
  },
};


