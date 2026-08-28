// GET /api/admin/team/directory-pdf
// Export PDF de l'annuaire interne (nom, email, téléphone, poste, département)
import { NextResponse } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import PDFDocument from "pdfkit";
import { Readable } from "stream";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";
import { dateLocale } from "@/lib/i18n-format";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const t = await getTranslations("admin.action_errors");
  const dl = dateLocale(await getLocale());
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const adminId = session.user.adminId!;

  const url = new URL(req.url);
  const includeInactive = url.searchParams.get("includeInactive") === "1";
  const filterDepartment = url.searchParams.get("department");
  const filterTeamId = url.searchParams.get("teamId");
  const filterRoleId = url.searchParams.get("roleId");
  const filterPositionId = url.searchParams.get("positionId");

  // Construire where dynamique
  const where: Record<string, unknown> = {};
  if (!includeInactive) where.isActive = true;
  if (filterDepartment) where.department = filterDepartment;
  if (filterTeamId) where.teamId = Number(filterTeamId);
  if (filterRoleId) where.roleId = Number(filterRoleId);
  if (filterPositionId) where.positionId = Number(filterPositionId);

  const users = await prisma.admin.findMany({
    where: where as never,
    orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
    select: {
      id: true, email: true, fullName: true, isActive: true,
      title: true, phone: true, department: true,
      customRole: { select: { name: true, color: true } },
      position: { select: { name: true, color: true } },
      team: { select: { name: true, color: true } },
    },
  });

  // Résoudre nom du filtre pour l'afficher dans le header PDF
  let filterLabel = "";
  if (filterDepartment) filterLabel = t("filtre_departement", { nom: filterDepartment });
  else if (filterTeamId) {
    const team = await prisma.team.findUnique({ where: { id: Number(filterTeamId) }, select: { name: true } });
    if (team) filterLabel = t("filtre_equipe", { nom: team.name });
  } else if (filterRoleId) {
    const r = await prisma.role.findUnique({ where: { id: Number(filterRoleId) }, select: { name: true } });
    if (r) filterLabel = t("filtre_role", { nom: r.name });
  } else if (filterPositionId) {
    const p = await prisma.position.findUnique({ where: { id: Number(filterPositionId) }, select: { name: true } });
    if (p) filterLabel = t("filtre_poste", { nom: p.name });
  }

  await logAudit({
    adminId,
    action: "export",
    entityType: "admin_directory",
    changes: { count: users.length, includeInactive, filterLabel },
  });

  const doc = new PDFDocument({ size: "LETTER", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c as Buffer));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  // ── Header ──
  doc.rect(0, 0, doc.page.width, 80).fill("#0F2D52");
  doc.fillColor("#ffffff")
    .fontSize(20).font("Helvetica-Bold")
    .text(t("pdf_annuaire_interne"), 50, 28);
  doc.fontSize(10).font("Helvetica")
    .text(
      t("genere_le_n_membres", {
        date: new Date().toLocaleDateString(dl, { day: "2-digit", month: "long", year: "numeric" }),
        count: users.length,
        portee: includeInactive ? t("incluant_inactifs") : t("actifs_seulement"),
        filtre: filterLabel ? t("filtre_par", { filtre: filterLabel }) : "",
      }),
      50, 55
    );

  doc.y = 100;
  doc.fillColor("#000000");

  // ── Table headers ──
  const colX = { name: 50, role: 200, dept: 320, phone: 420, email: 510 };
  doc.fontSize(8).font("Helvetica-Bold").fillColor("#6b7280");
  doc.text(t("pdf_h_nom_poste"), colX.name, doc.y);
  doc.text(t("pdf_h_role"), colX.role, doc.y);
  doc.text(t("pdf_h_departement"), colX.dept, doc.y);
  doc.text(t("pdf_h_telephone"), colX.phone, doc.y);
  doc.text(t("pdf_h_courriel"), colX.email, doc.y);
  doc.moveDown(0.5);
  doc.strokeColor("#e5e7eb").lineWidth(0.5)
    .moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
  doc.moveDown(0.4);

  // ── Rows ──
  doc.fillColor("#111827").fontSize(9).font("Helvetica");
  for (const u of users) {
    if (doc.y > doc.page.height - 60) {
      doc.addPage();
      doc.y = 50;
    }
    const rowY = doc.y;
    const nameLine = `${u.fullName || u.email}${!u.isActive ? `  ${t("pdf_inactif")}` : ""}`;
    doc.font("Helvetica-Bold").fillColor(u.isActive ? "#0F2D52" : "#9ca3af")
      .text(nameLine, colX.name, rowY, { width: 145 });
    if (u.title || u.position) {
      doc.font("Helvetica").fillColor("#6b7280").fontSize(8)
        .text(u.title || u.position?.name || "", colX.name, doc.y, { width: 145 });
      doc.fontSize(9);
    }
    const rowBottom = doc.y;

    doc.font("Helvetica").fillColor("#111827")
      .text(u.customRole?.name || "—", colX.role, rowY, { width: 110 });
    doc.text(u.department || "—", colX.dept, rowY, { width: 95 });
    doc.text(u.phone || "—", colX.phone, rowY, { width: 85 });
    doc.fontSize(8).text(u.email, colX.email, rowY, { width: 90 });
    doc.fontSize(9);

    doc.y = Math.max(doc.y, rowBottom) + 6;
    doc.strokeColor("#f3f4f6").moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.y += 4;
  }

  // ── Footer ──
  const pageRange = doc.bufferedPageRange();
  for (let i = pageRange.start; i < pageRange.start + pageRange.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(7).fillColor("#9ca3af").font("Helvetica")
      .text(
        t("pdf_pied_annuaire", { page: i + 1, total: pageRange.count }),
        50, doc.page.height - 30, { align: "center", width: doc.page.width - 100 }
      );
  }

  doc.end();
  const pdf = await done;

  return new NextResponse(Readable.from(pdf) as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="annuaire-vnk_${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
