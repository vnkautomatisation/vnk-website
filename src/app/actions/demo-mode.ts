"use server";
// Server Actions — mode démo : data fictive + bandeau de protection.
// Le mode démo crée des clients/factures/devis exemples ET active un flag dans
// les settings qui bloque les opérations destructives sur les data métier.
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const adminId = session.user.adminId!;
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { customRole: true },
  });
  if (admin?.customRole?.name !== "super_admin") return null;
  return adminId;
}

const DEMO_TAG = "[DEMO]";

// ── ACTIVER LE MODE DÉMO ───────────────────────────────────
export async function enableDemoModeAction(): Promise<Result<{ created: { clients: number; quotes: number; invoices: number } }>> {
  const adminId = await requireSuperAdmin();
  if (!adminId) return { success: false, error: "Action réservée au super-administrateur" };

  // Flag dans Setting
  await prisma.setting.upsert({
    where: { category_key: { category: "system", key: "demo_mode" } },
    update: { value: "true", updatedBy: adminId },
    create: {
      category: "system", key: "demo_mode", value: "true", type: "boolean",
      label: "Mode démo actif", isPublic: false, updatedBy: adminId,
    },
  });

  // Créer 5 clients fictifs
  const sampleClients = [
    { name: "Démo · Aéro Tech Inc.", email: "demo-aero@example.com", company: "Aéro Tech Inc.", province: "QC" },
    { name: "Démo · Boucherie Lévesque", email: "demo-boucherie@example.com", company: "Boucherie Lévesque", province: "QC" },
    { name: "Démo · Brasserie du Quartier", email: "demo-brasserie@example.com", company: "Brasserie du Quartier", province: "QC" },
    { name: "Démo · Constructo Sherbrooke", email: "demo-constructo@example.com", company: "Constructo Sherbrooke", province: "QC" },
    { name: "Démo · Imprimerie Express", email: "demo-imprimerie@example.com", company: "Imprimerie Express", province: "ON" },
  ];

  const pwHash = await bcrypt.hash(crypto.randomBytes(16).toString("base64url"), 10);
  const clientIds: number[] = [];
  for (const c of sampleClients) {
    const existing = await prisma.client.findUnique({ where: { email: c.email } });
    if (existing) { clientIds.push(existing.id); continue; }
    const created = await prisma.client.create({
      data: {
        fullName: c.name,
        email: c.email,
        passwordHash: pwHash,
        companyName: c.company,
        province: c.province,
        internalNotes: `${DEMO_TAG} Compte démo créé automatiquement.`,
      },
      select: { id: true },
    });
    clientIds.push(created.id);
  }

  // 8 devis fictifs
  let quotesCreated = 0;
  for (let i = 0; i < 8; i++) {
    const clientId = clientIds[i % clientIds.length];
    const amountHt = 1500 + Math.floor(Math.random() * 8500);
    const tps = amountHt * 0.05;
    const tvq = amountHt * 0.09975;
    const quoteNumber = `DEV-DEMO-${String(i + 1).padStart(4, "0")}`;
    const existing = await prisma.quote.findUnique({ where: { quoteNumber } });
    if (existing) continue;
    await prisma.quote.create({
      data: {
        clientId,
        quoteNumber,
        title: `${DEMO_TAG} Devis démo #${i + 1}`,
        description: "Devis fictif généré pour les démos.",
        serviceType: ["Automatisation", "Audit", "Support continu", "Formation"][i % 4],
        amountHt,
        tpsAmount: tps,
        tvqAmount: tvq,
        amountTtc: amountHt + tps + tvq,
        status: ["draft", "sent", "accepted", "refused"][i % 4],
      },
    });
    quotesCreated++;
  }

  // 8 factures fictives
  let invoicesCreated = 0;
  for (let i = 0; i < 8; i++) {
    const clientId = clientIds[i % clientIds.length];
    const amountHt = 1200 + Math.floor(Math.random() * 6800);
    const tps = amountHt * 0.05;
    const tvq = amountHt * 0.09975;
    const invoiceNumber = `FAC-DEMO-${String(i + 1).padStart(4, "0")}`;
    const existing = await prisma.invoice.findUnique({ where: { invoiceNumber } });
    if (existing) continue;
    const isPaid = i % 3 === 0;
    await prisma.invoice.create({
      data: {
        clientId,
        invoiceNumber,
        title: `${DEMO_TAG} Facture démo #${i + 1}`,
        serviceType: ["Automatisation", "Audit", "Support continu"][i % 3],
        amountHt,
        tpsAmount: tps,
        tvqAmount: tvq,
        amountTtc: amountHt + tps + tvq,
        status: isPaid ? "paid" : i % 4 === 0 ? "overdue" : "unpaid",
        paidAt: isPaid ? new Date(Date.now() - i * 86400 * 1000) : null,
        dueDate: new Date(Date.now() + (i - 4) * 86400 * 1000),
      },
    });
    invoicesCreated++;
  }

  await logAudit({ adminId, action: "settings_update", entityType: "demo_mode_enabled", changes: { clients: clientIds.length, quotes: quotesCreated, invoices: invoicesCreated } });
  revalidatePath("/admin/settings/demo");
  return {
    success: true,
    data: { created: { clients: clientIds.length, quotes: quotesCreated, invoices: invoicesCreated } },
  };
}

// ── DÉSACTIVER LE MODE DÉMO ───────────────────────────────
export async function disableDemoModeAction(): Promise<Result> {
  const adminId = await requireSuperAdmin();
  if (!adminId) return { success: false, error: "Action réservée au super-administrateur" };

  await prisma.setting.upsert({
    where: { category_key: { category: "system", key: "demo_mode" } },
    update: { value: "false", updatedBy: adminId },
    create: {
      category: "system", key: "demo_mode", value: "false", type: "boolean",
      label: "Mode démo actif", updatedBy: adminId,
    },
  });

  await logAudit({ adminId, action: "settings_update", entityType: "demo_mode_disabled" });
  revalidatePath("/admin/settings/demo");
  return { success: true };
}

// ── PURGER LES DONNÉES DÉMO ───────────────────────────────
export async function purgeDemoDataAction(): Promise<Result<{ deleted: { clients: number; quotes: number; invoices: number } }>> {
  const adminId = await requireSuperAdmin();
  if (!adminId) return { success: false, error: "Action réservée au super-administrateur" };

  const [quotes, invoices, clients] = await prisma.$transaction([
    prisma.quote.deleteMany({ where: { quoteNumber: { startsWith: "DEV-DEMO-" } } }),
    prisma.invoice.deleteMany({ where: { invoiceNumber: { startsWith: "FAC-DEMO-" } } }),
    prisma.client.deleteMany({ where: { internalNotes: { contains: DEMO_TAG } } }),
  ]);

  await logAudit({
    adminId, action: "delete", entityType: "demo_data_purged",
    changes: { quotes: quotes.count, invoices: invoices.count, clients: clients.count },
  });

  revalidatePath("/admin/settings/demo");
  return {
    success: true,
    data: { deleted: { clients: clients.count, quotes: quotes.count, invoices: invoices.count } },
  };
}
