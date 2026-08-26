// API · Export de la configuration complète du portail en JSON.
// Inclut : settings, roles custom, positions custom, catalog items, templates
// emails et PDF. Exclut les comptes utilisateurs (PII) et les données métier.
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { adminApiForbiddenAll } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbiddenAll([["settings", "export"], ["settings", "write"]])) {
    return forbiddenJson();
  }
  const adminId = session.user.adminId!;

  try {
    const [settings, roles, positions, catalogItems, emailTemplates, pdfTemplates, services, promos] = await Promise.all([
      prisma.setting.findMany({
        where: { category: { not: "cms_media" } }, // exclure les blobs d'images uploadées
        orderBy: [{ category: "asc" }, { key: "asc" }],
      }),
      prisma.role.findMany({ where: { isSystem: false }, orderBy: { name: "asc" } }),
      prisma.position.findMany({ where: { isSystem: false }, orderBy: { name: "asc" } }),
      prisma.catalogItem.findMany({ where: { isSystem: false }, orderBy: [{ type: "asc" }, { sortOrder: "asc" }] }),
      prisma.emailTemplate.findMany({ orderBy: { key: "asc" } }),
      prisma.pdfTemplate.findMany({ orderBy: { key: "asc" } }),
      prisma.serviceCatalog.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.discountCode.findMany({ orderBy: { code: "asc" } }),
    ]);

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      exportedBy: adminId,
      portal: "vnk-website",
      // Settings (sans les blobs media)
      settings: settings.map((s) => ({
        category: s.category, key: s.key, value: s.value, type: s.type,
        label: s.label, description: s.description,
        isPublic: s.isPublic, isSecret: s.isSecret, sortOrder: s.sortOrder,
      })),
      // Rôles custom (système exclus, ils sont seedés)
      roles: roles.map((r) => ({
        name: r.name, description: r.description, permissions: r.permissions,
        color: r.color, sortOrder: r.sortOrder,
      })),
      // Postes custom
      positions: positions.map((p) => ({
        name: p.name, description: p.description,
        defaultDepartment: p.defaultDepartment, color: p.color, sortOrder: p.sortOrder,
      })),
      // Items de catalogues custom
      catalogItems: catalogItems.map((c) => ({
        type: c.type, key: c.key, name: c.name, description: c.description,
        color: c.color, icon: c.icon, metadata: c.metadata,
        isActive: c.isActive, sortOrder: c.sortOrder,
      })),
      // Templates emails
      emailTemplates: emailTemplates.map((t) => ({
        key: t.key, locale: t.locale, subject: t.subject,
        bodyHtml: t.bodyHtml, bodyText: t.bodyText,
        variables: t.variables, isEnabled: t.isEnabled,
      })),
      // Templates PDF
      pdfTemplates: pdfTemplates.map((t) => ({
        key: t.key, locale: t.locale,
        content: t.content, variables: t.variables, isEnabled: t.isEnabled,
      })),
      // Services offerts
      services: services.map((s) => ({
        key: s.key, name: s.name, description: s.description,
        basePrice: s.basePrice.toString(), priceUnit: s.priceUnit, currency: s.currency,
        category: s.category, isActive: s.isActive, sortOrder: s.sortOrder,
      })),
      // Codes promo
      promos: promos.map((p) => ({
        code: p.code, description: p.description,
        discountType: p.discountType, value: p.value.toString(),
        maxUses: p.maxUses, validFrom: p.validFrom, validUntil: p.validUntil,
        isActive: p.isActive,
      })),
    };

    await logAudit({ adminId, action: "export", entityType: "config_export" });

    const filename = `vnk-config-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[config-export]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
