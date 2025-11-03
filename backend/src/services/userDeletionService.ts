import prisma from "@/config/prisma";
import { deleteAvatarFile, extractFilenameFromUrl } from "@/services/fileUploadService";
import loggingService from "@/services/loggingService";

export class TeamOwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamOwnershipError";
  }
}

export async function assertNoTeamOwnership(userId: string): Promise<void> {
  const ownedTeams = await prisma.team.findMany({ where: { createdBy: userId } });
  if (ownedTeams.length > 0) {
    throw new TeamOwnershipError(
      "User owns one or more teams. Transfer or delete teams before account deletion."
    );
  }
}

export async function deleteUserPermanently(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return;
  }

  await assertNoTeamOwnership(userId);

  try {
    await prisma.$transaction(async (tx) => {
      // Team relations
      await tx.teamMember.deleteMany({ where: { userId } });
      await tx.teamChatMessage.deleteMany({ where: { userId } });

      // Direct messages and chats
      const dmChats = await tx.dMChat.findMany({
        where: { OR: [{ userId1: userId }, { userId2: userId }] },
        select: { id: true },
      });
      if (dmChats.length > 0) {
        const chatIds = dmChats.map((c) => c.id);
        await tx.dMMessage.deleteMany({ where: { chatId: { in: chatIds } } });
        await tx.dMChat.deleteMany({ where: { id: { in: chatIds } } });
      }

      // User data
      await tx.notification.deleteMany({ where: { userId } });
      await tx.searchHistory.deleteMany({ where: { userId } });
      await tx.keyword.deleteMany({ where: { userId } });
      await tx.archivedOpportunity.deleteMany({ where: { userId } });
      await tx.filter.deleteMany({ where: { userId } });

      // Integrations
      await tx.dropboxConnection.deleteMany({ where: { userId } });
      await tx.stripePayment.deleteMany({ where: { userId } });
      await tx.stripeSubscription.deleteMany({ where: { userId } });
      await tx.stripeCustomer.deleteMany({ where: { userId } });

      // Auth-related
      await tx.userToken.deleteMany({ where: { userId } });
      await tx.emailVerification.deleteMany({ where: { userId } });
      await tx.webAuthnCredential.deleteMany({ where: { userId } });
      await tx.userPreferences.deleteMany({ where: { userId } });
    });

    // Delete avatar file outside transaction
    if (user.avatar) {
      try {
        const filename = extractFilenameFromUrl(user.avatar);
        if (filename) deleteAvatarFile(filename);
      } catch (e) {
        loggingService.warn("Failed to delete avatar file during user deletion", e);
      }
    }

    // Finally, delete the user
    await prisma.user.delete({ where: { id: userId } });
  } catch (error) {
    if (error instanceof TeamOwnershipError) {
      throw error;
    }
    loggingService.error("Failed to permanently delete user:", error);
    throw new Error("Failed to permanently delete user");
  }
}


