import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seeds a ready-to-demo scenario:
 *  - victim@example.com  / Password123!  -> emergency keyword "HELP"
 *  - trusted@example.com / Password123!  -> registered as victim's trusted member
 * Log in as the victim to trigger the demo controls, then open a second
 * browser/tab logged in as the trusted contact to acknowledge/respond/resolve.
 */
async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const victim = await prisma.user.upsert({
    where: { email: "victim@example.com" },
    update: {},
    create: { email: "victim@example.com", passwordHash, fullName: "Amara Nkosi", phone: "+27-71-000-0001" },
  });

  const trusted = await prisma.user.upsert({
    where: { email: "trusted@example.com" },
    update: {},
    create: { email: "trusted@example.com", passwordHash, fullName: "Sipho Dlamini", phone: "+27-71-000-0002" },
  });

  const existingKeyword = await prisma.emergencyKeyword.findFirst({ where: { userId: victim.id } });
  if (existingKeyword) {
    await prisma.emergencyKeyword.update({ where: { id: existingKeyword.id }, data: { keyword: "HELP", enabled: true } });
  } else {
    await prisma.emergencyKeyword.create({ data: { userId: victim.id, keyword: "HELP", enabled: true } });
  }

  const existingLink = await prisma.trustedMember.findFirst({ where: { ownerId: victim.id, email: trusted.email } });
  if (!existingLink) {
    await prisma.trustedMember.create({
      data: {
        ownerId: victim.id,
        memberUserId: trusted.id,
        name: trusted.fullName,
        email: trusted.email,
        phone: trusted.phone,
        relationship: "Sibling",
        priority: 1,
        status: "ACCEPTED",
      },
    });
  }

  const existingDevice = await prisma.wearableDevice.findFirst({ where: { userId: victim.id } });
  if (!existingDevice) {
    await prisma.wearableDevice.create({ data: { userId: victim.id, name: "SafeWatch Demo", deviceType: "Smartwatch" } });
  }

  console.log("Seed complete:");
  console.log("  victim@example.com / Password123!");
  console.log("  trusted@example.com / Password123!");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
