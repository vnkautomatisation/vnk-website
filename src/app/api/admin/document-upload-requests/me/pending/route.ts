// GET /api/admin/document-upload-requests/me/pending
// Liste les demandes d'upload "pending" pour l'employé courant.
// Réutilisé par MyDocumentsView (bandeau + section Mon dossier).
import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const adminId = session.user.adminId!;

  const rows = await prisma.documentUploadRequest.findMany({
    where: {
      targetAdminId: adminId,
      status: "pending",
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      requestedBy: { select: { id: true, fullName: true, email: true } },
    },
  });

  return NextResponse.json({ requests: rows });
}
