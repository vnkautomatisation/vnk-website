// API · Import de la configuration depuis un JSON exporté.
// Mode "merge" : upsert sans toucher aux données existantes non listées.
// Mode "replace" : ATTENTION — supprime les éléments non-système avant import.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const adminId = session.user.adminId!;

  try {
    const body = await request.json();
    const { payload, mode = "merge" } = body;

    if (!payload || typeof payload !== "object" || payload.version !== 1) {
      return NextResponse.json({ error: "Fichier de configuration invalide ou version non supportée" }, { status: 400 });
    }

    // Seul super_admin peut faire replace (destructif)
    if (mode === "replace") {
      const me = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
      if (me?.customRole?.name !== "super_admin") {
        return NextResponse.json({ error: "Seul un super-administrateur peut effectuer un import 'replace'" }, { status: 403 });
      }
    }

    const stats = { settings: 0, roles: 0, positions: 0, catalogItems: 0, emailTemplates: 0, pdfTemplates: 0, services: 0, promos: 0 };

    // Mode replace : nettoyer les non-système avant
    if (mode === "replace") {
      await prisma.$transaction([
        prisma.catalogItem.deleteMany({ where: { isSystem: false } }),
        prisma.role.deleteMany({ where: { isSystem: false } }),
        prisma.position.deleteMany({ where: { isSystem: false } }),
      ]);
    }

    // Settings
    if (Array.isArray(payload.settings)) {
      for (const s of payload.settings) {
        if (!s.category || !s.key) continue;
        await prisma.setting.upsert({
          where: { category_key: { category: s.category, key: s.key } },
          update: { value: s.value, type: s.type, label: s.label, description: s.description, updatedBy: adminId },
          create: {
            category: s.category, key: s.key, value: s.value, type: s.type ?? "string",
            label: s.label ?? s.key, description: s.description,
            isPublic: s.isPublic ?? false, isSecret: s.isSecret ?? false,
            sortOrder: s.sortOrder ?? 0, updatedBy: adminId,
          },
        });
        stats.settings++;
      }
    }

    // Roles custom
    if (Array.isArray(payload.roles)) {
      for (const r of payload.roles) {
        if (!r.name) continue;
        await prisma.role.upsert({
          where: { name: r.name },
          update: { description: r.description, permissions: r.permissions, color: r.color, sortOrder: r.sortOrder },
          create: {
            name: r.name, description: r.description, permissions: r.permissions ?? {},
            color: r.color ?? "#0F2D52", sortOrder: r.sortOrder ?? 1000, isSystem: false,
          },
        });
        stats.roles++;
      }
    }

    // Positions custom
    if (Array.isArray(payload.positions)) {
      for (const p of payload.positions) {
        if (!p.name) continue;
        await prisma.position.upsert({
          where: { name: p.name },
          update: { description: p.description, defaultDepartment: p.defaultDepartment, color: p.color, sortOrder: p.sortOrder },
          create: {
            name: p.name, description: p.description,
            defaultDepartment: p.defaultDepartment, color: p.color ?? "#0F2D52",
            sortOrder: p.sortOrder ?? 1000, isSystem: false,
          },
        });
        stats.positions++;
      }
    }

    // Catalog items
    if (Array.isArray(payload.catalogItems)) {
      for (const c of payload.catalogItems) {
        if (!c.type || !c.key) continue;
        await prisma.catalogItem.upsert({
          where: { type_key: { type: c.type, key: c.key } },
          update: {
            name: c.name, description: c.description, color: c.color, icon: c.icon,
            metadata: c.metadata, isActive: c.isActive, sortOrder: c.sortOrder,
          },
          create: {
            type: c.type, key: c.key, name: c.name, description: c.description,
            color: c.color ?? "#0F2D52", icon: c.icon, metadata: c.metadata ?? {},
            isActive: c.isActive ?? true, sortOrder: c.sortOrder ?? 1000, isSystem: false,
          },
        });
        stats.catalogItems++;
      }
    }

    // Email templates
    if (Array.isArray(payload.emailTemplates)) {
      for (const t of payload.emailTemplates) {
        if (!t.key) continue;
        await prisma.emailTemplate.upsert({
          where: { key_locale: { key: t.key, locale: t.locale ?? "fr" } },
          update: { subject: t.subject, bodyHtml: t.bodyHtml, bodyText: t.bodyText, variables: t.variables, isEnabled: t.isEnabled, updatedBy: adminId },
          create: {
            key: t.key, locale: t.locale ?? "fr", subject: t.subject,
            bodyHtml: t.bodyHtml, bodyText: t.bodyText,
            variables: t.variables, isEnabled: t.isEnabled ?? true, updatedBy: adminId,
          },
        });
        stats.emailTemplates++;
      }
    }

    // PDF templates
    if (Array.isArray(payload.pdfTemplates)) {
      for (const t of payload.pdfTemplates) {
        if (!t.key) continue;
        await prisma.pdfTemplate.upsert({
          where: { key_locale: { key: t.key, locale: t.locale ?? "fr" } },
          update: { content: t.content, variables: t.variables, isEnabled: t.isEnabled },
          create: {
            key: t.key, locale: t.locale ?? "fr", content: t.content,
            variables: t.variables, isEnabled: t.isEnabled ?? true,
          },
        });
        stats.pdfTemplates++;
      }
    }

    // Services
    if (Array.isArray(payload.services)) {
      for (const s of payload.services) {
        if (!s.key) continue;
        await prisma.serviceCatalog.upsert({
          where: { key: s.key },
          update: {
            name: s.name, description: s.description,
            basePrice: s.basePrice, priceUnit: s.priceUnit, currency: s.currency,
            category: s.category, isActive: s.isActive, sortOrder: s.sortOrder,
          },
          create: {
            key: s.key, name: s.name, description: s.description,
            basePrice: s.basePrice ?? 0, priceUnit: s.priceUnit ?? "hour",
            currency: s.currency ?? "CAD", category: s.category,
            isActive: s.isActive ?? true, sortOrder: s.sortOrder ?? 1000,
          },
        });
        stats.services++;
      }
    }

    // Promos
    if (Array.isArray(payload.promos)) {
      for (const p of payload.promos) {
        if (!p.code) continue;
        await prisma.discountCode.upsert({
          where: { code: p.code },
          update: {
            description: p.description, discountType: p.discountType, value: p.value,
            maxUses: p.maxUses, validFrom: p.validFrom ? new Date(p.validFrom) : null,
            validUntil: p.validUntil ? new Date(p.validUntil) : null,
            isActive: p.isActive,
          },
          create: {
            code: p.code, description: p.description,
            discountType: p.discountType, value: p.value,
            maxUses: p.maxUses,
            validFrom: p.validFrom ? new Date(p.validFrom) : null,
            validUntil: p.validUntil ? new Date(p.validUntil) : null,
            isActive: p.isActive ?? true,
          },
        });
        stats.promos++;
      }
    }

    await logAudit({
      adminId,
      action: "settings_update",
      entityType: "config_import",
      changes: { mode, stats, exportedAt: payload.exportedAt },
    });

    return NextResponse.json({ ok: true, mode, stats });
  } catch (err) {
    console.error("[config-import]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur serveur" }, { status: 500 });
  }
}
