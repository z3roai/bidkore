import { prisma } from "@/config/database";
import loggingService from "@/services/loggingService";

const syncDatabase = async(): Promise<void> => {
	try {
		await prisma.$connect();
		loggingService.info("Database connection established");

		// Run Prisma migrations
		loggingService.info("🔄 Running Prisma migrations...");
		// Note: Prisma migrations are typically run via `npx prisma migrate deploy` or `npx prisma db push`
		// This script is mainly for verification now

		// Check if avatar column exists in users table
		try {
			interface ColumnInfo {
				column_name: string;
				data_type: string;
				is_nullable: string;
			}

			const results = await prisma.$queryRaw<ColumnInfo[]>`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'avatar'
      `;

			if (results.length > 0) {
				loggingService.info("Avatar column exists in users table:", results[0]);
			} else {
				loggingService.info("Avatar column not found in users table");
			}
		} catch (error) {
			loggingService.warn("Could not check avatar column:", error);
		}

		loggingService.info("Database sync completed");
	} catch (error) {
		loggingService.error("Database sync failed:", error);
		throw error;
	} finally {
		await prisma.$disconnect();
		loggingService.info("🔌 Database connection closed");
	}
};

// Run the sync
if (require.main === module) {
	syncDatabase()
		.then(() => {
			loggingService.info("Database sync completed successfully");
			process.exit(0);
		})
		.catch((error) => {
			loggingService.error("Database sync failed:", error);
			process.exit(1);
		});
}

export default syncDatabase;
