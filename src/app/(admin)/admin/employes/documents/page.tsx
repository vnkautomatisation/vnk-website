import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { DocumentsAdminView } from "./documents-admin-view";

export const metadata: Metadata = { title: "Employes - Documents" };
export const dynamic = "force-dynamic";

export default async function DocumentsAdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const me = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { customRole: true },
  });
  if (!me) redirect("/admin/login");

  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = me.customRole?.name === "super_admin";
  const isHr =
    isSuper
    || (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("write");

  if (!isHr) {
    // Un non-RH n'a rien a faire ici, on le renvoie vers Mon espace
    redirect("/admin/mon-espace/documents");
  }

  const in60d = new Date();
  in60d.setHours(0, 0, 0, 0);
  in60d.setDate(in60d.getDate() + 60);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    templates,
    allSignatures,
    allEmployees,
    teams,
    pendingRequests,
    completedRequests,
    expiringDocs,
    uploadRequests,
    activeHandbooks,
    handbookSignatures,
  ] = await Promise.all([
    prisma.legalDocumentTemplate.findMany({
      where: { isActive: true },
      orderBy: { title: "asc" },
      include: { _count: { select: { signatures: true } } },
    }).then((rows) =>
      rows.map((r) => ({
        ...r,
        // Garantit la presence de signatureScope dans le payload meme si la
        // colonne n'est pas encore propagee a la DB (default = "employee_only").
        signatureScope: (r as { signatureScope?: string }).signatureScope ?? "employee_only",
        // acknowledgmentMode (Bug 2) : defaut reading_only si non encore en DB.
        acknowledgmentMode:
          (r as { acknowledgmentMode?: string }).acknowledgmentMode ?? "reading_only",
      })),
    ),
    prisma.legalDocumentSignature.findMany({
      select: {
        id: true,
        adminId: true,
        templateId: true,
        version: true,
        signedAt: true,
        finalPdfUrl: true,
        signatureData: true,
      },
    }),
    prisma.admin.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        team: { select: { id: true, name: true } },
      },
    }),
    prisma.team.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.documentSignatureRequest.findMany({
      where: { status: "pending" },
      orderBy: [{ dueDate: "asc" }, { requestedAt: "desc" }],
      include: {
        template: { select: { id: true, title: true, key: true, version: true, isRequired: true } },
        targetAdmin: { select: { id: true, fullName: true, email: true } },
        requestedBy: { select: { id: true, fullName: true, email: true } },
      },
    }),
    // Mission 6 : RH conserve la visibilite des demandes completees pour
    // consulter l'historique (PDF signe + date completion).
    prisma.documentSignatureRequest.findMany({
      where: { status: { in: ["completed", "cancelled"] } },
      orderBy: [{ completedAt: "desc" }, { requestedAt: "desc" }],
      take: 200,
      include: {
        template: { select: { id: true, title: true, key: true, version: true, isRequired: true } },
        targetAdmin: { select: { id: true, fullName: true, email: true } },
        requestedBy: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.employeePersonalDocument.findMany({
      where: {
        expiresAt: { gte: today, lte: in60d },
        ...(isSuper ? {} : { isPrivate: false }),
        admin: { isActive: true },
      },
      orderBy: { expiresAt: "asc" },
      include: { admin: { select: { id: true, fullName: true, email: true } } },
    }),
    prisma.documentUploadRequest.findMany({
      where: { status: { in: ["pending", "uploaded"] } },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        targetAdmin: { select: { id: true, fullName: true, email: true } },
        requestedBy: { select: { id: true, fullName: true, email: true } },
      },
    }),
    // Mission 1 : cahiers ACTIFS + leurs items pour filtrer la liste des
    // templates standalone (un template inclus dans un cahier n'est plus
    // affiche comme carte individuelle).
    prisma.documentHandbook.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
      include: {
        items: {
          select: { templateId: true, orderIndex: true },
          orderBy: { orderIndex: "asc" },
        },
      },
    }),
    prisma.documentHandbookSignature.findMany({
      select: {
        id: true,
        handbookId: true,
        adminId: true,
        version: true,
        signedAt: true,
        finalPdfUrl: true,
      },
    }),
  ]);

  // Mission 1 : Set des templateIds inclus dans un cahier actif.
  const templateIdsInActiveHandbooks = new Set<number>();
  for (const h of activeHandbooks) {
    for (const it of h.items) templateIdsInActiveHandbooks.add(it.templateId);
  }

  return (
    <DocumentsAdminView
      templates={JSON.parse(JSON.stringify(templates))}
      allSignatures={JSON.parse(JSON.stringify(allSignatures))}
      employees={JSON.parse(JSON.stringify(allEmployees))}
      teams={JSON.parse(JSON.stringify(teams))}
      pendingRequests={JSON.parse(JSON.stringify(pendingRequests))}
      completedRequests={JSON.parse(JSON.stringify(completedRequests))}
      expiringDocs={JSON.parse(JSON.stringify(expiringDocs))}
      uploadRequests={JSON.parse(JSON.stringify(uploadRequests))}
      handbooks={JSON.parse(JSON.stringify(activeHandbooks))}
      handbookSignatures={JSON.parse(JSON.stringify(handbookSignatures))}
      templateIdsInActiveHandbooks={Array.from(templateIdsInActiveHandbooks)}
      isSuper={isSuper}
    />
  );
}
