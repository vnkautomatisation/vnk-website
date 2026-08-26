// POST /api/tax-declarations/[id]/submit
// Marque une declaration comme soumise (status = submitted, submittedAt = now).
// Action irreversible : apres soumission, la declaration ne peut plus etre modifiee ni supprimee.
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("tax_declarations", "write")) {
    return forbiddenJson();
  }
  const { id } = await params;
  const declId = Number(id);

  const existing = await prisma.taxDeclaration.findUnique({ where: { id: declId } });
  if (!existing) {
    return NextResponse.json({ error: "Déclaration introuvable" }, { status: 404 });
  }
  if (existing.status === "submitted" || existing.submittedAt) {
    return NextResponse.json({ error: "Déclaration déjà soumise" }, { status: 409 });
  }

  const updated = await prisma.taxDeclaration.update({
    where: { id: declId },
    data: { status: "submitted", submittedAt: new Date() },
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "tax_declarations",
    entityId: declId,
    changes: { op: "submit", status: "submitted" },
  });

  return NextResponse.json({ success: true, declaration: updated });
}
