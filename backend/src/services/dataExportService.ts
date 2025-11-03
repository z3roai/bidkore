import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import AdmZip from "adm-zip";

import config from "@/config/env";
import prisma from "@/config/prisma";
import loggingService from "@/services/loggingService";
import emailService from "@/services/emailService";

export interface DataExportResult {
  filePath: string;
  publicUrl: string;
}

async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fsp.mkdir(dirPath, { recursive: true });
  } catch {
    // ignore
  }
}

export async function exportUserData(userId: string): Promise<DataExportResult> {
  const uploadsRoot = path.join(path.dirname(new URL(import.meta.url).pathname), "../../uploads");
  const exportsDir = path.join(uploadsRoot, "exports");
  await ensureDir(exportsDir);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${userId}-${timestamp}.zip`;
  const filePath = path.join(exportsDir, fileName);

  const zip = new AdmZip();

  try {
    const [user, preferences, filters, searchHistory, notifications, archived] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.userPreferences.findUnique({ where: { userId } }),
      prisma.filter.findMany({ where: { userId } }),
      prisma.searchHistory.findMany({ where: { userId } }),
      prisma.notification.findMany({ where: { userId } }),
      prisma.archivedOpportunity.findMany({ where: { userId } }),
    ]);

    zip.addFile(
      "user.json",
      Buffer.from(JSON.stringify(user ?? {}, null, 2), "utf8")
    );
    zip.addFile(
      "preferences.json",
      Buffer.from(JSON.stringify(preferences ?? {}, null, 2), "utf8")
    );
    zip.addFile(
      "filters.json",
      Buffer.from(JSON.stringify(filters ?? [], null, 2), "utf8")
    );
    zip.addFile(
      "searchHistory.json",
      Buffer.from(JSON.stringify(searchHistory ?? [], null, 2), "utf8")
    );
    zip.addFile(
      "notifications.json",
      Buffer.from(JSON.stringify(notifications ?? [], null, 2), "utf8")
    );
    zip.addFile(
      "archivedOpportunities.json",
      Buffer.from(JSON.stringify(archived ?? [], null, 2), "utf8")
    );

    // Persist to disk
    await fsp.writeFile(filePath, zip.toBuffer());

    const publicUrl = `${config.urls.backend}/uploads/exports/${fileName}`;

    // Send email with link if possible
    if (user?.email) {
      try {
        await emailService.sendGenericEmail({
          to: user.email,
          subject: "Your BidKore data export is ready",
          html: `<p>Your data export has been generated.</p><p><a href="${publicUrl}">Download your ZIP</a></p>`,
        });
      } catch (emailErr) {
        loggingService.warn("Failed to send export email", emailErr);
      }
    }

    return { filePath, publicUrl };
  } catch (error) {
    loggingService.error("Failed to export user data:", error);
    // Clean up partial file
    try {
      if (fs.existsSync(filePath)) {
        await fsp.rm(filePath, { force: true });
      }
    } catch {}
    throw new Error("Failed to export user data");
  }
}


