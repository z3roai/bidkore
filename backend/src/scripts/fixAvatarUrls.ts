import { prisma } from "@/config/database";
import loggingService from "@/services/loggingService";

const fixAvatarUrls = async(): Promise<void> => {
	try {
		await prisma.$connect();
		loggingService.info("Database connection established");

		// Get all users with avatar URLs
		const users = await prisma.user.findMany({
			where: {
				avatar: {
					not: null,
				},
			},
			select: {
				id: true,
				email: true,
				avatar: true,
			},
		});

		loggingService.info(`Found ${users.length} users with avatars`);

		for (const user of users) {
			const oldUrl = user.avatar;
			if (!oldUrl) {continue;}

			loggingService.info(
				`User ${user.email} (ID: ${user.id}) has avatar: ${oldUrl}`,
			);

			// Extract filename from the URL
			const match = oldUrl.match(
				/\/(?:uploads\/avatars|.*\/uploads\/avatars)\/(.+)$/,
			);
			if (match) {
				const filename = match[1];
				const newUrl = `/uploads/avatars/${filename}`;

				// Update the avatar URL to use relative path
				await prisma.user.update({
					where: { id: user.id },
					data: { avatar: newUrl },
				});

				loggingService.info(`Updated ${user.email}: ${oldUrl} -> ${newUrl}`);
			} else {
				loggingService.warn(`Could not extract filename from URL: ${oldUrl}`);
			}
		}

		loggingService.info("Avatar URL fix completed");
	} catch (error) {
		loggingService.error("Avatar URL fix failed:", error);
		throw error;
	} finally {
		await prisma.$disconnect();
		loggingService.info("🔌 Database connection closed");
	}
};

// Run the fix
if (require.main === module) {
	fixAvatarUrls()
		.then(() => {
			loggingService.info("Avatar URL fix completed successfully");
			process.exit(0);
		})
		.catch((error) => {
			loggingService.error("Avatar URL fix failed:", error);
			process.exit(1);
		});
}

export default fixAvatarUrls;
