// Prisma-only database exports
// Export Prisma client as the default database connection
export {
	connectDatabase,
	default as prisma,
	disconnectDatabase,
} from "./prisma";
