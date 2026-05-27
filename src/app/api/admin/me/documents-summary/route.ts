// GET /api/admin/me/documents-summary
// Compteurs synthétiques pour la page Mon espace > Documents.
// Auth : tout admin connecté (renvoie ses propres compteurs).
import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const adminId = session.user.adminId!;

  const me = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { id: true, teamId: true },
  });
  if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in60d = new Date(today);
  in60d.setDate(in60d.getDate() + 60);

  // ── Documents légaux à signer (templates obligatoires actifs non signés
  // dans leur version courante) ──────────────────────────────────────
  const activeTemplates = await prisma.legalDocumentTemplate.findMany({
    where: { isActive: true, isRequired: true },
    select: { id: true, version: true },
  });
  let legalToSign = 0;
  if (activeTemplates.length > 0) {
    const signed = await prisma.legalDocumentSignature.findMany({
      where: { adminId, templateId: { in: activeTemplates.map((t) => t.id) } },
      select: { templateId: true, version: true },
    });
    const signedSet = new Set(signed.map((s) => `${s.templateId}|${s.version}`));
    legalToSign = activeTemplates.filter((t) => !signedSet.has(`${t.id}|${t.version}`)).length;
  }

  // ── Demandes de signature ciblées pending (perso / équipe / global) ──
  // Inclut les demandes qui ciblent l'employé, son équipe ou "all", et
  // qui correspondent à un template qu'il n'a pas encore signé.
  const sigReqs = await prisma.documentSignatureRequest.findMany({
    where: {
      status: "pending",
      OR: [
        { targetAdminId: adminId },
        ...(me.teamId ? [{ targetTeamId: me.teamId }] : []),
        { targetAll: true },
      ],
    },
    include: { template: { select: { id: true, version: true } } },
  });
  let pendingSignatureRequests = 0;
  if (sigReqs.length > 0) {
    const tplIds = Array.from(new Set(sigReqs.map((s) => s.template.id)));
    const signed = await prisma.legalDocumentSignature.findMany({
      where: { adminId, templateId: { in: tplIds } },
      select: { templateId: true, version: true },
    });
    const signedSet = new Set(signed.map((s) => `${s.templateId}|${s.version}`));
    pendingSignatureRequests = sigReqs.filter(
      (r) => !signedSet.has(`${r.template.id}|${r.template.version}`),
    ).length;
  }

  // ── Contrats signés (incluant statuts post-signature) ──
  const contractsCount = await prisma.employeeContract.count({
    where: {
      adminId,
      status: { in: ["signed_employee", "signed_employer", "active", "terminated", "expired"] },
    },
  });

  // ── Bulletins de paie année courante (publiés uniquement) ──
  const payStubsThisYear = await prisma.payStub.count({
    where: {
      adminId,
      releasedAt: { not: null, gte: yearStart },
    },
  });

  // ── Documents fiscaux année courante ──
  const taxDocsThisYear = await prisma.taxDocument.count({
    where: {
      adminId,
      OR: [
        { taxYear: today.getFullYear() },
        { issuedAt: { gte: yearStart } },
      ],
    },
  });

  // ── Documents personnels (tous, incluant les privés) ──
  const personalDocsCount = await prisma.employeePersonalDocument.count({
    where: { adminId },
  });

  // ── Documents personnels expirant <= 60 jours ──
  const expiringSoonCount = await prisma.employeePersonalDocument.count({
    where: {
      adminId,
      expiresAt: { gte: today, lte: in60d },
    },
  });

  // ── Demandes lettres d'emploi pending ──
  const pendingLetterRequests = await prisma.employmentLetterRequest.count({
    where: { adminId, status: "pending" },
  });

  return NextResponse.json({
    legalToSign,
    pendingSignatureRequests,
    contractsCount,
    payStubsThisYear,
    taxDocsThisYear,
    personalDocsCount,
    expiringSoonCount,
    pendingLetterRequests,
  });
}
