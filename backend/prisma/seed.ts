import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

import loggingService from "../src/services/loggingService";

const prisma = new PrismaClient();

async function main() {
  loggingService.info("Starting database seeding...");

  let adminUserId: string;

  const existingAdmin = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN },
  });

  if (existingAdmin) {
    loggingService.info("Admin user already exists", {
      email: existingAdmin.email,
    });
    adminUserId = existingAdmin.id;
  } else {
    const hashedPassword = await bcrypt.hash("Admin123!", 12);
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
    adminUserId = adminUser.id;
    loggingService.info("Admin user created", {
      email: "admin@bidkore.com",
      password: "Admin123!",
    });
  }

  const opportunityCount = await prisma.opportunity.count();

  if (opportunityCount === 0) {
    loggingService.info("Seeding opportunities...");

    const opportunities = [
      {
        noticeId: "DEPT-2024-001",
        title: "IT Infrastructure Modernization Services",
        solicitationNumber: "FA8750-24-R-0001",
        fullParentPathName: "Department of Defense.Air Force",
        fullParentPathCode: "097",
        postedDate: new Date("2024-01-15"),
        type: "Solicitation",
        baseType: "Presolicitation",
        responseDeadLine: new Date("2025-06-15"),
        naicsCode: "541512",
        typeOfSetAsideDescription: "Total Small Business Set-Aside",
        typeOfSetAside: "SBA",
        description:
          "The Department of Defense requires comprehensive IT infrastructure modernization services including cloud migration, network security implementation, and legacy system upgrades.",
        organizationType: "OFFICE",
        officeAddress: JSON.stringify({ city: "Washington", state: "DC", zipcode: "20301" }),
        pointOfContact: JSON.stringify([
          { fullName: "John Smith", email: "john.smith@af.mil", phone: "202-555-0100", type: "primary" },
        ]),
        placeOfPerformance: JSON.stringify({
          city: { name: "Washington", code: "DC" },
          state: { name: "District of Columbia", code: "DC" },
        }),
        active: "Yes",
        isActive: true,
        attachments: JSON.stringify([]),
      },
      {
        noticeId: "DEPT-2024-002",
        title: "Cybersecurity Assessment and Compliance Services",
        solicitationNumber: "HSCG23-24-R-0050",
        fullParentPathName: "Department of Homeland Security",
        fullParentPathCode: "070",
        postedDate: new Date("2024-02-01"),
        type: "Solicitation",
        baseType: "Combined Synopsis/Solicitation",
        responseDeadLine: new Date("2025-07-01"),
        naicsCode: "541512",
        typeOfSetAsideDescription: "8(a) Set-Aside",
        typeOfSetAside: "8A",
        description:
          "DHS seeks qualified contractors to provide comprehensive cybersecurity assessment services, including penetration testing, vulnerability assessments, and compliance auditing.",
        organizationType: "OFFICE",
        officeAddress: JSON.stringify({ city: "Washington", state: "DC", zipcode: "20528" }),
        pointOfContact: JSON.stringify([
          { fullName: "Sarah Johnson", email: "sarah.johnson@hq.dhs.gov", phone: "202-555-0200", type: "primary" },
        ]),
        placeOfPerformance: JSON.stringify({
          city: { name: "Washington", code: "DC" },
          state: { name: "District of Columbia", code: "DC" },
        }),
        active: "Yes",
        isActive: true,
        attachments: JSON.stringify([]),
      },
      {
        noticeId: "DEPT-2024-003",
        title: "Cloud Migration and DevOps Implementation",
        solicitationNumber: "DOE-2024-0123",
        fullParentPathName: "Department of Energy",
        fullParentPathCode: "089",
        postedDate: new Date("2024-02-10"),
        type: "Solicitation",
        baseType: "Solicitation",
        responseDeadLine: new Date("2025-08-10"),
        naicsCode: "541519",
        typeOfSetAsideDescription: "Service-Disabled Veteran-Owned Small Business",
        typeOfSetAside: "SDVOSB",
        description:
          "Department of Energy requires cloud migration services for legacy applications and implementation of modern DevOps practices.",
        organizationType: "OFFICE",
        officeAddress: JSON.stringify({ city: "Washington", state: "DC", zipcode: "20585" }),
        pointOfContact: JSON.stringify([
          { fullName: "Michael Chen", email: "michael.chen@hq.doe.gov", phone: "202-555-0300", type: "primary" },
        ]),
        placeOfPerformance: JSON.stringify({
          city: { name: "Washington", code: "DC" },
          state: { name: "District of Columbia", code: "DC" },
        }),
        active: "Yes",
        isActive: true,
        attachments: JSON.stringify([]),
      },
      {
        noticeId: "DEPT-2024-004",
        title: "Enterprise Software Development Services",
        solicitationNumber: "GSA-2024-456",
        fullParentPathName: "General Services Administration",
        fullParentPathCode: "047",
        postedDate: new Date("2024-02-20"),
        type: "Solicitation",
        baseType: "Solicitation",
        responseDeadLine: new Date("2025-09-20"),
        naicsCode: "541511",
        typeOfSetAsideDescription: "Women-Owned Small Business",
        typeOfSetAside: "WOSB",
        description:
          "GSA requires custom enterprise software development services for a new procurement management system.",
        organizationType: "OFFICE",
        officeAddress: JSON.stringify({ city: "Washington", state: "DC", zipcode: "20405" }),
        pointOfContact: JSON.stringify([
          { fullName: "Emily Rodriguez", email: "emily.rodriguez@gsa.gov", phone: "202-555-0400", type: "primary" },
        ]),
        placeOfPerformance: JSON.stringify({
          city: { name: "Washington", code: "DC" },
          state: { name: "District of Columbia", code: "DC" },
        }),
        active: "Yes",
        isActive: true,
        attachments: JSON.stringify([]),
      },
      {
        noticeId: "DEPT-2024-005",
        title: "Network Infrastructure Upgrade and Support",
        solicitationNumber: "VA-2024-789",
        fullParentPathName: "Department of Veterans Affairs",
        fullParentPathCode: "036",
        postedDate: new Date("2024-03-01"),
        type: "Solicitation",
        baseType: "Solicitation",
        responseDeadLine: new Date("2025-10-01"),
        naicsCode: "517311",
        typeOfSetAsideDescription: "HUBZone Set-Aside",
        typeOfSetAside: "HUBZone",
        description:
          "Department of Veterans Affairs seeks contractors for comprehensive network infrastructure upgrade across 20 medical facilities.",
        organizationType: "OFFICE",
        officeAddress: JSON.stringify({ city: "Washington", state: "DC", zipcode: "20420" }),
        pointOfContact: JSON.stringify([
          { fullName: "David Thompson", email: "david.thompson@va.gov", phone: "202-555-0500", type: "primary" },
        ]),
        placeOfPerformance: JSON.stringify({
          city: { name: "Multiple Locations", code: "" },
          state: { name: "Nationwide", code: "" },
        }),
        active: "Yes",
        isActive: true,
        attachments: JSON.stringify([]),
      },
    ];

    await prisma.opportunity.createMany({ data: opportunities });
    loggingService.info(`Seeded ${opportunities.length} opportunities`);
  } else {
    loggingService.info(`Database already has ${opportunityCount} opportunities`);
  }

  const companyCount = await prisma.companyProfile.count({ where: { userId: adminUserId } });

  if (companyCount === 0) {
    await prisma.companyProfile.create({
      data: {
        userId: adminUserId,
        companyName: "BidKore Solutions LLC",
        dunsNumber: "123456789",
        cageCode: "1A2B3",
        ueiNumber: "BIDKORE123456",
        businessAddress: "123 Tech Street, Arlington, VA 22201",
        description: "Leading provider of IT services for government contracts",
        founded: "2020",
        numberOfEmployees: 25,
        certifications: ["8(a) Business Development", "Woman-Owned Small Business"],
        naicsCodes: ["541512", "541519", "541511"],
      },
    });
    loggingService.info("Created company profile");
  }

  loggingService.info("Database seeding completed");
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
