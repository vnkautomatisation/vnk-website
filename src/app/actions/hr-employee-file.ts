"use server";
// Actions dossier employé : coordonnées d'urgence, info bancaire, famille, fichiers, équipement.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { encryptString, decryptString, mask } from "@/lib/security/encryption";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

async function requireHrWrite(): Promise<number | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const adminId = session.user.adminId!;
  const me = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
  if (!me) return null;
  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  return (me.customRole?.name === "super_admin" || (perms.hr ?? []).includes("write") || (perms.users ?? []).includes("write")) ? adminId : null;
}

// Self ou HR
async function requireSelfOrHr(targetAdminId: number): Promise<{ actorId: number; isSelf: boolean; isHr: boolean } | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const actorId = session.user.adminId!;
  const isSelf = actorId === targetAdminId;
  const me = await prisma.admin.findUnique({ where: { id: actorId }, include: { customRole: true } });
  if (!me) return null;
  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isHr = me.customRole?.name === "super_admin" || (perms.hr ?? []).includes("write") || (perms.users ?? []).includes("write");
  if (!isSelf && !isHr) return null;
  return { actorId, isSelf, isHr };
}

// ═══════════════════════════════════════════════════════════
// COORDONNÉES D'URGENCE
// ═══════════════════════════════════════════════════════════
const emergencySchema = z.object({
  id: z.number().int().optional(),
  adminId: z.number().int(),
  name: z.string().min(1).max(120),
  relationship: z.string().min(1).max(60),
  phone: z.string().min(7).max(40),
  phoneAlt: z.string().max(40).nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  isPrimary: z.boolean().default(false),
  notes: z.string().max(500).nullable().optional(),
});

export async function upsertEmergencyContactAction(input: z.infer<typeof emergencySchema>): Promise<Result<{ id: number }>> {
  const guard = await requireSelfOrHr(input.adminId);
  if (!guard) return { success: false, error: "Non autorisé" };
  const parsed = emergencySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  if (parsed.data.isPrimary) {
    await prisma.emergencyContact.updateMany({
      where: { adminId: parsed.data.adminId, NOT: parsed.data.id ? { id: parsed.data.id } : undefined },
      data: { isPrimary: false },
    });
  }

  const data = {
    adminId: parsed.data.adminId,
    name: parsed.data.name,
    relationship: parsed.data.relationship,
    phone: parsed.data.phone,
    phoneAlt: parsed.data.phoneAlt ?? null,
    email: parsed.data.email || null,
    isPrimary: parsed.data.isPrimary,
    notes: parsed.data.notes ?? null,
  };

  const row = parsed.data.id
    ? await prisma.emergencyContact.update({ where: { id: parsed.data.id }, data, select: { id: true } })
    : await prisma.emergencyContact.create({ data, select: { id: true } });

  await logAudit({
    adminId: guard.actorId,
    action: parsed.data.id ? "update" : "create",
    entityType: "emergency_contact",
    entityId: row.id,
    changes: { adminId: parsed.data.adminId },
  });
  revalidatePath("/admin/mon-espace/urgence");
  revalidatePath("/admin/employes");
  return { success: true, data: { id: row.id } };
}

export async function deleteEmergencyContactAction(input: { id: number; adminId: number }): Promise<Result> {
  const guard = await requireSelfOrHr(input.adminId);
  if (!guard) return { success: false, error: "Non autorisé" };
  await prisma.emergencyContact.delete({ where: { id: input.id } });
  await logAudit({ adminId: guard.actorId, action: "delete", entityType: "emergency_contact", entityId: input.id });
  revalidatePath("/admin/mon-espace/urgence");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// INFO BANCAIRE (chiffré)
// ═══════════════════════════════════════════════════════════
const bankSchema = z.object({
  adminId: z.number().int(),
  institution: z.string().min(2).max(10),  // ex: "815" Desjardins
  transit: z.string().min(3).max(10),      // ex: "30312"
  account: z.string().min(4).max(20),
  institutionLabel: z.string().max(80).optional(),
});

export async function upsertBankInfoAction(input: z.infer<typeof bankSchema>): Promise<Result> {
  const guard = await requireSelfOrHr(input.adminId);
  if (!guard) return { success: false, error: "Non autorisé" };
  const parsed = bankSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  try {
    const data = {
      adminId: parsed.data.adminId,
      institutionEnc: encryptString(parsed.data.institution),
      transitEnc: encryptString(parsed.data.transit),
      accountEnc: encryptString(parsed.data.account),
      institutionLabel: parsed.data.institutionLabel ?? null,
      accountLast4: parsed.data.account.slice(-4),
      verifiedAt: null, // reset si modifié
    };
    await prisma.bankInfo.upsert({
      where: { adminId: parsed.data.adminId },
      create: data,
      update: data,
    });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur de chiffrement" };
  }

  await logAudit({
    adminId: guard.actorId,
    action: "update",
    entityType: "bank_info",
    entityId: parsed.data.adminId,
    changes: { updated: true },
  });
  revalidatePath("/admin/mon-espace/bancaire");
  return { success: true };
}

export async function getBankInfoMaskedAction(input: { adminId: number }): Promise<Result<{
  institutionLabel: string | null;
  institutionMasked: string;
  transitMasked: string;
  accountMasked: string;
  verifiedAt: string | null;
} | null>> {
  const guard = await requireSelfOrHr(input.adminId);
  if (!guard) return { success: false, error: "Non autorisé" };

  const row = await prisma.bankInfo.findUnique({ where: { adminId: input.adminId } });
  if (!row) return { success: true, data: null };

  try {
    const inst = decryptString(row.institutionEnc);
    const transit = decryptString(row.transitEnc);
    const acc = decryptString(row.accountEnc);
    return {
      success: true,
      data: {
        institutionLabel: row.institutionLabel,
        institutionMasked: inst,
        transitMasked: transit,
        accountMasked: mask(acc, 4),
        verifiedAt: row.verifiedAt?.toISOString() ?? null,
      },
    };
  } catch {
    return { success: false, error: "Impossible de déchiffrer" };
  }
}

// ═══════════════════════════════════════════════════════════
// PERMIS PROFESSIONNELS
// ═══════════════════════════════════════════════════════════
const licenseSchema = z.object({
  id: z.number().int().optional(),
  adminId: z.number().int(),
  type: z.string().min(1).max(120),
  number: z.string().max(60).nullable().optional(),
  issuer: z.string().max(120).nullable().optional(),
  issuedAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  fileUrl: z.string().nullable().optional(),
  isMandatory: z.boolean().default(false),
  notes: z.string().max(500).nullable().optional(),
});

export async function upsertLicenseAction(input: z.infer<typeof licenseSchema>): Promise<Result<{ id: number }>> {
  const guard = await requireSelfOrHr(input.adminId);
  if (!guard) return { success: false, error: "Non autorisé" };
  const parsed = licenseSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const data = {
    adminId: parsed.data.adminId,
    type: parsed.data.type,
    number: parsed.data.number ?? null,
    issuer: parsed.data.issuer ?? null,
    issuedAt: parsed.data.issuedAt ? new Date(parsed.data.issuedAt) : null,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    fileUrl: parsed.data.fileUrl ?? null,
    isMandatory: parsed.data.isMandatory,
    notes: parsed.data.notes ?? null,
  };

  const row = parsed.data.id
    ? await prisma.professionalLicense.update({ where: { id: parsed.data.id }, data, select: { id: true } })
    : await prisma.professionalLicense.create({ data, select: { id: true } });

  await logAudit({ adminId: guard.actorId, action: parsed.data.id ? "update" : "create", entityType: "professional_license", entityId: row.id });
  revalidatePath("/admin/mon-espace/formations");
  revalidatePath("/admin/employes/permis");
  return { success: true, data: { id: row.id } };
}

export async function deleteLicenseAction(input: { id: number; adminId: number }): Promise<Result> {
  const guard = await requireSelfOrHr(input.adminId);
  if (!guard) return { success: false, error: "Non autorisé" };
  await prisma.professionalLicense.delete({ where: { id: input.id } });
  await logAudit({ adminId: guard.actorId, action: "delete", entityType: "professional_license", entityId: input.id });
  revalidatePath("/admin/mon-espace/formations");
  revalidatePath("/admin/employes/permis");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// ÉQUIPEMENT ATTRIBUÉ
// ═══════════════════════════════════════════════════════════
const equipmentSchema = z.object({
  id: z.number().int().optional(),
  adminId: z.number().int(),
  category: z.enum(["laptop", "phone", "tool", "epi", "vehicle", "card", "license", "other"]),
  name: z.string().min(1).max(160),
  serialNumber: z.string().max(120).nullable().optional(),
  brand: z.string().max(80).nullable().optional(),
  model: z.string().max(80).nullable().optional(),
  assignedAt: z.string().nullable().optional(),
  returnedAt: z.string().nullable().optional(),
  conditionOnReturn: z.enum(["good", "damaged", "lost"]).nullable().optional(),
  value: z.number().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export async function upsertEquipmentAction(input: z.infer<typeof equipmentSchema>): Promise<Result<{ id: number }>> {
  // Équipement : seuls les RH/admin peuvent gérer (pas self-service)
  const actorId = await requireHrWrite();
  if (!actorId) return { success: false, error: "Non autorisé" };
  const parsed = equipmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const data = {
    adminId: parsed.data.adminId,
    category: parsed.data.category,
    name: parsed.data.name,
    serialNumber: parsed.data.serialNumber ?? null,
    brand: parsed.data.brand ?? null,
    model: parsed.data.model ?? null,
    assignedAt: parsed.data.assignedAt ? new Date(parsed.data.assignedAt) : new Date(),
    returnedAt: parsed.data.returnedAt ? new Date(parsed.data.returnedAt) : null,
    conditionOnReturn: parsed.data.conditionOnReturn ?? null,
    value: parsed.data.value ?? null,
    notes: parsed.data.notes ?? null,
  };

  const row = parsed.data.id
    ? await prisma.assignedEquipment.update({ where: { id: parsed.data.id }, data, select: { id: true } })
    : await prisma.assignedEquipment.create({ data, select: { id: true } });

  // Notifier l'employé qu'un équipement vient de lui être attribué (création seulement)
  if (!parsed.data.id) {
    await prisma.notification.create({
      data: {
        recipientType: "admin",
        recipientId: parsed.data.adminId,
        type: "info",
        title: "Équipement assigné",
        body: `${parsed.data.name}${parsed.data.category ? ` (${parsed.data.category})` : ""}`,
        link: "/admin/mon-espace/equipement",
        icon: "package",
      },
    }).catch(() => null);
  }

  await logAudit({ adminId: actorId, action: parsed.data.id ? "update" : "create", entityType: "assigned_equipment", entityId: row.id });
  revalidatePath("/admin/employes/equipement");
  revalidatePath("/admin/mon-espace/equipement");
  revalidatePath("/admin/employes");
  return { success: true, data: { id: row.id } };
}

export async function returnEquipmentAction(input: { id: number; condition: "good" | "damaged" | "lost" }): Promise<Result> {
  const actorId = await requireHrWrite();
  if (!actorId) return { success: false, error: "Non autorisé" };

  // Récupérer adminId + nom AVANT la mise à jour pour pouvoir notifier
  // l'employé que son équipement a été marqué retourné par RH.
  const equipment = await prisma.assignedEquipment.findUnique({
    where: { id: input.id },
    select: { adminId: true, name: true, returnedAt: true },
  });

  await prisma.assignedEquipment.update({
    where: { id: input.id },
    data: { returnedAt: new Date(), conditionOnReturn: input.condition },
  });

  // Notifier l'employé seulement si le retour est NOUVEAU (évite spam si déjà retourné).
  if (equipment && !equipment.returnedAt) {
    await prisma.notification
      .create({
        data: {
          recipientType: "admin",
          recipientId: equipment.adminId,
          type: "info",
          title: `Équipement marqué retourné : ${equipment.name}`,
          body: `Les RH ont enregistré le retour de cet équipement (état : ${input.condition === "good" ? "bon état" : input.condition === "damaged" ? "endommagé" : "perdu"}). Contactez-les si ce n'est pas exact.`,
          link: "/admin/mon-espace/equipement",
          icon: "package",
        },
      })
      .catch(() => null);
  }

  await logAudit({ adminId: actorId, action: "update", entityType: "assigned_equipment", entityId: input.id, changes: { returned: true, condition: input.condition } });
  revalidatePath("/admin/employes/equipement");
  revalidatePath("/admin/mon-espace/equipement");
  revalidatePath("/admin/employes");
  return { success: true };
}

export async function deleteEquipmentAction(input: { id: number }): Promise<Result> {
  const actorId = await requireHrWrite();
  if (!actorId) return { success: false, error: "Non autorisé" };
  await prisma.assignedEquipment.delete({ where: { id: input.id } });
  await logAudit({ adminId: actorId, action: "delete", entityType: "assigned_equipment", entityId: input.id });
  revalidatePath("/admin/employes/equipement");
  revalidatePath("/admin/mon-espace/equipement");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// FORMATIONS
// ═══════════════════════════════════════════════════════════
const trainingSchema = z.object({
  id: z.number().int().optional(),
  adminId: z.number().int(),
  title: z.string().min(1).max(200),
  category: z.enum(["safety", "technical", "leadership", "compliance", "other"]).default("safety"),
  provider: z.string().max(120).nullable().optional(),
  completedAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  certificateUrl: z.string().nullable().optional(),
  isMandatory: z.boolean().default(false),
  hoursCount: z.number().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export async function upsertTrainingAction(input: z.infer<typeof trainingSchema>): Promise<Result<{ id: number }>> {
  const guard = await requireSelfOrHr(input.adminId);
  if (!guard) return { success: false, error: "Non autorisé" };
  const parsed = trainingSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const data = {
    adminId: parsed.data.adminId,
    title: parsed.data.title,
    category: parsed.data.category,
    provider: parsed.data.provider ?? null,
    completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : null,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    certificateUrl: parsed.data.certificateUrl ?? null,
    isMandatory: parsed.data.isMandatory,
    hoursCount: parsed.data.hoursCount ?? null,
    notes: parsed.data.notes ?? null,
  };

  const row = parsed.data.id
    ? await prisma.trainingRecord.update({ where: { id: parsed.data.id }, data, select: { id: true } })
    : await prisma.trainingRecord.create({ data, select: { id: true } });

  await logAudit({ adminId: guard.actorId, action: parsed.data.id ? "update" : "create", entityType: "training_record", entityId: row.id });
  revalidatePath("/admin/mon-espace/formations");
  revalidatePath("/admin/employes/formations");
  return { success: true, data: { id: row.id } };
}

export async function deleteTrainingAction(input: { id: number; adminId: number }): Promise<Result> {
  const guard = await requireSelfOrHr(input.adminId);
  if (!guard) return { success: false, error: "Non autorisé" };
  await prisma.trainingRecord.delete({ where: { id: input.id } });
  await logAudit({ adminId: guard.actorId, action: "delete", entityType: "training_record", entityId: input.id });
  revalidatePath("/admin/mon-espace/formations");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// FAMILLE / DÉPENDANTS
// ═══════════════════════════════════════════════════════════
const familySchema = z.object({
  id: z.number().int().optional(),
  adminId: z.number().int(),
  type: z.enum(["spouse", "child", "other"]),
  fullName: z.string().min(1).max(200),
  birthdate: z.string().nullable().optional(),
  isInsured: z.boolean().default(false),
  isTaxDependent: z.boolean().default(false),
});

export async function upsertFamilyDependentAction(input: z.infer<typeof familySchema>): Promise<Result<{ id: number }>> {
  const guard = await requireSelfOrHr(input.adminId);
  if (!guard) return { success: false, error: "Non autorisé" };
  const parsed = familySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const data = {
    adminId: parsed.data.adminId,
    type: parsed.data.type,
    fullName: parsed.data.fullName,
    birthdate: parsed.data.birthdate ? new Date(parsed.data.birthdate) : null,
    isInsured: parsed.data.isInsured,
    isTaxDependent: parsed.data.isTaxDependent,
  };

  const row = parsed.data.id
    ? await prisma.familyDependent.update({ where: { id: parsed.data.id }, data, select: { id: true } })
    : await prisma.familyDependent.create({ data, select: { id: true } });

  await logAudit({ adminId: guard.actorId, action: parsed.data.id ? "update" : "create", entityType: "family_dependent", entityId: row.id });
  revalidatePath("/admin/mon-espace/famille");
  return { success: true, data: { id: row.id } };
}

export async function deleteFamilyDependentAction(input: { id: number; adminId: number }): Promise<Result> {
  const guard = await requireSelfOrHr(input.adminId);
  if (!guard) return { success: false, error: "Non autorisé" };
  await prisma.familyDependent.delete({ where: { id: input.id } });
  await logAudit({ adminId: guard.actorId, action: "delete", entityType: "family_dependent", entityId: input.id });
  revalidatePath("/admin/mon-espace/famille");
  return { success: true };
}
