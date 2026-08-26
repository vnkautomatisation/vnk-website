// POST /api/clients/[id]/reset-password — admin genere un nouveau mot de passe pour le client
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { revalidateAdminViews } from "@/lib/revalidate";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(16);
  let pw = "";
  for (let i = 0; i < 16; i++) pw += chars[bytes[i] % chars.length];
  return pw;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("clients", "write")) {
    return forbiddenJson();
  }

  const { id } = await params;
  const clientId = Number(id);

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, email: true, fullName: true },
  });
  if (!client) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }

  const newPassword = generatePassword();
  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.client.update({
    where: { id: clientId },
    data: { passwordHash },
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "clients",
    entityId: clientId,
    changes: { action: "reset_password" },
  });

  revalidateAdminViews();

  return NextResponse.json({
    success: true,
    email: client.email,
    fullName: client.fullName,
    generatedPassword: newPassword,
  });
}
