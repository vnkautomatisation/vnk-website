// Diagnostic : lit l'admin et teste le bcrypt avec un password donne.
// Usage : node scripts/check-admin.mjs <email> [password-a-tester]
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const [, , emailArg, passwordArg] = process.argv;
if (!emailArg) {
  console.error("Usage : node scripts/check-admin.mjs <email> [password]");
  process.exit(1);
}

const prisma = new PrismaClient({ log: ["warn", "error"] });

try {
  const email = emailArg.toLowerCase().trim();
  const admin = await prisma.admin.findUnique({
    where: { email },
    select: {
      id: true, email: true, fullName: true,
      isActive: true, role: true,
      passwordHash: true, lastLogin: true,
      twoFactorEnabled: true,
    },
  });

  if (!admin) {
    console.log(`(X) AUCUN admin trouve pour "${email}"`);
    const all = await prisma.admin.findMany({ select: { email: true, isActive: true } });
    console.log(`\nAdmins existants en DB (${all.length}) :`);
    for (const a of all) console.log(`  - ${a.email}  (active=${a.isActive})`);
    process.exit(2);
  }

  console.log(`(OK) Admin trouve :`);
  console.log(`  id            : ${admin.id}`);
  console.log(`  email         : ${admin.email}`);
  console.log(`  fullName      : ${admin.fullName}`);
  console.log(`  isActive      : ${admin.isActive}`);
  console.log(`  role          : ${admin.role}`);
  console.log(`  twoFactor     : ${admin.twoFactorEnabled}`);
  console.log(`  lastLogin     : ${admin.lastLogin}`);
  console.log(`  hash prefix   : ${admin.passwordHash.slice(0, 7)} (len=${admin.passwordHash.length})`);

  if (passwordArg) {
    const ok = await bcrypt.compare(passwordArg, admin.passwordHash);
    console.log(`\nTest bcrypt avec password fourni : ${ok ? "(OK) MATCH" : "(X) NO MATCH"}`);
  }
} finally {
  await prisma.$disconnect();
}
