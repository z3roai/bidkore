// Prisma client and basic exports
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
export { PrismaClient };
export { default as prisma } from "../config/prisma";

// Re-export everything from Prisma client including enums and types
export * from "@prisma/client";
