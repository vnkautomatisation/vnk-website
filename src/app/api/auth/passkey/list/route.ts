// Liste les passkeys de l'admin connecté + permet d'en supprimer une.
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logSecurityEvent } from "@/lib/security/security-events";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const passkeys = await prisma.adminPasskey.findMany({
    where: { adminId: session.user.adminId! },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      deviceLabel: true,
      transports: true,
      backupEligible: true,
      createdAt: true,
      lastUsedAt: true,
      aaguid: true,
    },
  });
  return NextResponse.json({ passkeys });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const adminId = session.user.adminId!;
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const passkey = await prisma.adminPasskey.findUnique({ where: { id } });
  if (!passkey || passkey.adminId !== adminId) {
    return NextResponse.json({ error: "Passkey introuvable" }, { status: 404 });
  }
  await prisma.adminPasskey.delete({ where: { id } });

  await logSecurityEvent({
    adminId,
    type: "passkey_removed",
    severity: "warning",
    message: `Passkey supprimée${passkey.deviceLabel ? ` : ${passkey.deviceLabel}` : ""}`,
  });

  return NextResponse.json({ success: true });
}
