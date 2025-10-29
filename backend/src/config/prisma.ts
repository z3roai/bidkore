import { PrismaClient } from "@prisma/client";
import config from "./env";
import loggingService from "@/services/loggingService";

// Create Prisma client instance
const prisma = new PrismaClient({
	log:
		config.nodeEnv === "development"
			? ["query", "error", "warn"]
			: ["error"],
});

// Connect to database
export const connectDatabase = async (): Promise<void> => {
	try {
		await prisma.$connect();
		loggingService.info(
			`Database connected to ${config.db.host}:${config.db.port}/${config.db.name}`
		);
	} catch (error) {
		loggingService.error("Failed to connect to database:", error);
		throw error;
	}
};

// Disconnect from database
export const disconnectDatabase = async (): Promise<void> => {
	try {
		await prisma.$disconnect();
		loggingService.info("Database disconnected");
	} catch (error) {
		loggingService.error("Failed to disconnect from database:", error);
		throw error;
	}
};

// Export prisma client as default
export default prisma;

