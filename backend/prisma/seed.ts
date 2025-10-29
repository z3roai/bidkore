import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

import loggingService from "../src/services/loggingService";

const prisma = new PrismaClient();

async function main() {
  loggingService.info("Starting database seeding...");

  // Check if admin user already exists
  const existingAdmin = await prisma.user.findFirst({
    where: {
      role: UserRole.ADMIN,
    },
  });

  if (existingAdmin) {
    loggingService.info("Admin user already exists, skipping creation", {
      email: existingAdmin.email,
      id: existingAdmin.id,
    });
    return;
  }

  // Create admin user
  const hashedPassword = await bcrypt.hash("admin123", 12);

  const adminUser = await prisma.user.create({
    data: {
      email: "admin@bidkore.com",
      password: hashedPassword,
      firstName: "Admin",
      lastName: "User",
      role: UserRole.ADMIN,
      isActive: true,
      emailVerified: true,
    },
  });

  loggingService.info("Admin user created successfully!", {
    email: adminUser.email,
    password: "admin123",
    id: adminUser.id,
    role: adminUser.role,
    loginCredentials: {
      email: "admin@bidkore.com",
      password: "admin123",
    },
    important: "Change the admin password in production!",
  });
}

main()
  .catch((e) => {
    loggingService.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect().then(() => {
      loggingService.info("Database connection closed");
    });
  });
