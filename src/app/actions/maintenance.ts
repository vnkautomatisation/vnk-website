"use server";
// Server Actions — gestion des fenêtres de maintenance et incidents.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return session.user.adminId!;
}

// ═══════════════════════════════════════════════════════════
// MAINTENANCE WINDOWS
// ═══════════════════════════════════════════════════════════
const maintenanceSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  startsAt: z.string(),
  endsAt: z.string(),
  isActive: z.boolean().default(false),
  affectsPortal: z.boolean().default(true),
  affectsAdmin: z.boolean().default(false),
  affectsPublic: z.boolean().default(false),
});

export async function createMaintenanceAction(input: z.infer<typeof maintenanceSchema>): Promise<Result<{ id: number }>> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const parsed = maintenanceSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const created = await prisma.maintenanceWindow.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
      isActive: parsed.data.isActive,
      affectsPortal: parsed.data.affectsPortal,
      affectsAdmin: parsed.data.affectsAdmin,
      affectsPublic: parsed.data.affectsPublic,
    },
    select: { id: true },
  });

  await logAudit({ adminId, action: "create", entityType: "maintenance_window", entityId: created.id });
  revalidatePath("/admin/settings/maintenance");
  return { success: true, data: { id: created.id } };
}

export async function updateMaintenanceAction(input: z.infer<typeof maintenanceSchema> & { id: number }): Promise<Result> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };

  const { id, ...rest } = input;
  await prisma.maintenanceWindow.update({
    where: { id },
    data: {
      ...rest,
      description: rest.description ?? null,
      startsAt: new Date(rest.startsAt),
      endsAt: new Date(rest.endsAt),
    },
  });

  await logAudit({ adminId, action: "update", entityType: "maintenance_window", entityId: id });
  revalidatePath("/admin/settings/maintenance");
  return { success: true };
}

export async function deleteMaintenanceAction(input: { id: number }): Promise<Result> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };
  await prisma.maintenanceWindow.delete({ where: { id: input.id } });
  await logAudit({ adminId, action: "delete", entityType: "maintenance_window", entityId: input.id });
  revalidatePath("/admin/settings/maintenance");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// INCIDENTS
// ═══════════════════════════════════════════════════════════
const incidentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  severity: z.enum(["minor", "major", "critical"]).default("minor"),
  status: z.enum(["investigating", "identified", "monitoring", "resolved"]).default("investigating"),
  isPublic: z.boolean().default(true),
  resolvedAt: z.string().nullable().optional(),
});

export async function createIncidentAction(input: z.infer<typeof incidentSchema>): Promise<Result<{ id: number }>> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const parsed = incidentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const created = await prisma.incidentReport.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      severity: parsed.data.severity,
      status: parsed.data.status,
      isPublic: parsed.data.isPublic,
      resolvedAt: parsed.data.resolvedAt ? new Date(parsed.data.resolvedAt) : null,
    },
    select: { id: true },
  });

  await logAudit({ adminId, action: "create", entityType: "incident_report", entityId: created.id });
  revalidatePath("/admin/settings/maintenance");
  return { success: true, data: { id: created.id } };
}

export async function updateIncidentAction(input: z.infer<typeof incidentSchema> & { id: number }): Promise<Result> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const { id, resolvedAt, ...rest } = input;
  await prisma.incidentReport.update({
    where: { id },
    data: {
      ...rest,
      resolvedAt: resolvedAt ? new Date(resolvedAt) : (rest.status === "resolved" ? new Date() : null),
    },
  });
  await logAudit({ adminId, action: "update", entityType: "incident_report", entityId: id });
  revalidatePath("/admin/settings/maintenance");
  return { success: true };
}

export async function deleteIncidentAction(input: { id: number }): Promise<Result> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };
  await prisma.incidentReport.delete({ where: { id: input.id } });
  await logAudit({ adminId, action: "delete", entityType: "incident_report", entityId: input.id });
  revalidatePath("/admin/settings/maintenance");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// BANNIÈRE D'ANNONCE GLOBALE (stocké dans Setting)
// ═══════════════════════════════════════════════════════════
const bannerSchema = z.object({
  enabled: z.boolean(),
  message: z.string().max(500),
  variant: z.enum(["info", "warning", "success", "error"]).default("info"),
  dismissible: z.boolean().default(true),
  ctaLabel: z.string().max(60).nullable().optional(),
  ctaUrl: z.string().max(500).nullable().optional(),
  audience: z.enum(["all", "admin", "portal", "public"]).default("all"),
});

export async function updateAnnouncementBannerAction(input: z.infer<typeof bannerSchema>): Promise<Result> {
  const adminId = await requireAdmin();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const parsed = bannerSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const updates = [
    { key: "banner_enabled", value: parsed.data.enabled ? "true" : "false" },
    { key: "banner_message", value: parsed.data.message },
    { key: "banner_variant", value: parsed.data.variant },
    { key: "banner_dismissible", value: parsed.data.dismissible ? "true" : "false" },
    { key: "banner_cta_label", value: parsed.data.ctaLabel ?? "" },
    { key: "banner_cta_url", value: parsed.data.ctaUrl ?? "" },
    { key: "banner_audience", value: parsed.data.audience },
  ];

  for (const u of updates) {
    await prisma.setting.upsert({
      where: { category_key: { category: "system", key: u.key } },
      update: { value: u.value, updatedBy: adminId },
      create: {
        category: "system",
        key: u.key,
        value: u.value,
        type: u.key === "banner_enabled" || u.key === "banner_dismissible" ? "boolean" : "string",
        label: u.key,
        updatedBy: adminId,
      },
    });
  }

  await logAudit({ adminId, action: "settings_update", entityType: "announcement_banner", changes: { after: parsed.data } });
  revalidatePath("/admin/settings/maintenance");
  return { success: true };
}
