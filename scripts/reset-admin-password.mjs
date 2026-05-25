// Reset le password d'un admin. Usage :
//   node scripts/reset-admin-password.mjs <email> <nouveau-password>
// Ex : node scripts/reset-admin-password.mjs vnkautomatisation@gmail.com MonNouveauMdp123!
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const [, , emailArg, passwordArg] = process.argv;

if (!emailArg || !passwordArg) {
  console.error("Usage : node scripts/reset-admin-password.mjs <email> <password>");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const email = emailArg.toLowerCase().trim();
  const admin = await prisma.admin.findUnique({
    where: { email },
    select: { id: true, email: true, fullName: true, isActive: true },
  });

  if (!admin) {
    console.error(`Aucun admin trouve pour ${email}`);
    process.exit(2);
  }

  const passwordHash = await bcrypt.hash(passwordArg, 12);
  await prisma.admin.update({
    where: { id: admin.id },
    data: { passwordHash, isActive: true },
  });

  console.log(`OK - password reset pour ${admin.email} (${admin.fullName ?? "?"})`);
  console.log(`    isActive force a true.`);
} catch (e) {
  console.error("ERREUR :", e);
  process.exit(3);
} finally {
  await prisma.$disconnect();
}
