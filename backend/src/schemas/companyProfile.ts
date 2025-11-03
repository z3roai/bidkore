import { z } from "zod";

export const saveCompanyProfileSchema = z
  .object({
    companyName: z.string().min(1).max(200).optional(),
    dunsNumber: z.string().max(32).optional(),
    cageCode: z.string().max(32).optional(),
    ueiNumber: z.string().max(64).optional(),
    businessAddress: z.string().max(1000).optional(),
    description: z.string().max(5000).optional(),
    founded: z.string().max(32).optional(),
    numberOfEmployees: z.number().int().min(0).max(1000000).optional(),
    certifications: z.array(z.string().max(100)).optional(),
    naicsCodes: z.array(z.string().max(20)).optional(),
  })
  .describe("Company profile save data");

export type SaveCompanyProfileRequest = z.infer<typeof saveCompanyProfileSchema>;


