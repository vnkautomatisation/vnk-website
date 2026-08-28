// GET /api/payments/export?format=quickbooks|sage|acomba|csv_standard|excel&from=&to=&onlyReconciled=
// POST /api/payments/export?format=... avec body { paymentIds: number[] } pour exporter une selection
// Genere un fichier d'export comptable pour les paiements de la periode (ou de la selection)
import { NextResponse } from "next/server";
import { getTranslations, getLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";
import { dateLocale } from "@/lib/i18n-format";

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function csvFromRows(rows: (string | number | Date | null | undefined)[][], separator = ","): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(separator)).join("\r\n");
}

function safeFileName(s: string): string {
  return s.replace(/[\/\\:*?"<>|]/g, "_").replace(/\s+/g, "_");
}

type PaymentWithRelations = Awaited<ReturnType<typeof loadPayments>>[number];

async function loadPayments(where: Record<string, unknown>) {
  const dateTag = dateLocale(await getLocale());
  return prisma.payment.findMany({
    where,
    include: {
      client: { select: { id: true, fullName: true, companyName: true, email: true } },
      invoice: { select: { invoiceNumber: true, title: true, amountHt: true, tpsAmount: true, tvqAmount: true, amountTtc: true } },
    },
    orderBy: { paidAt: "asc" },
  });
}

function buildBody(payments: PaymentWithRelations[], format: string, t: (k: string) => string, dateTag: string): { body: string; filename: string; suffix: string } {
  if (format === "quickbooks") {
    const rows: (string | number | Date | null | undefined)[][] = [
      ["Date", "Type", "Num", "Name", "Memo", "Account", "Amount", "Class"],
    ];
    payments.forEach((p) => {
      rows.push([
        (p.paidAt ?? p.createdAt).toISOString().slice(0, 10),
        "PAYMENT",
        p.invoice?.invoiceNumber ?? `PAY-${p.id}`,
        p.client?.fullName ?? "",
        p.invoice?.title ?? "",
        "Comptes clients",
        Number(p.amount).toFixed(2),
        p.accountingCategory ?? "Services",
      ]);
    });
    return { body: csvFromRows(rows), filename: "quickbooks_payments", suffix: "quickbooks" };
  }
  if (format === "sage") {
    const rows: (string | number | Date | null | undefined)[][] = [
      [t("hdr_date"), t("hdr_numero_de_transaction"), t("hdr_numero_de_facture"), t("hdr_nom_du_client"), t("hdr_description"), t("hdr_methode"), t("hdr_montant_ht"), t("hdr_tps"), t("hdr_tvq"), t("hdr_montant_total"), t("hdr_devise"), t("hdr_compte")],
    ];
    payments.forEach((p) => {
      const inv = p.invoice;
      rows.push([
        (p.paidAt ?? p.createdAt).toISOString().slice(0, 10),
        `P-${p.id}`,
        inv?.invoiceNumber ?? "",
        p.client?.fullName ?? "",
        inv?.title ?? "Paiement",
        p.paymentMethod ?? "stripe",
        inv ? Number(inv.amountHt).toFixed(2) : "",
        inv ? Number(inv.tpsAmount).toFixed(2) : "",
        inv ? Number(inv.tvqAmount).toFixed(2) : "",
        Number(p.amount).toFixed(2),
        (p.currency || "CAD").toUpperCase(),
        p.accountingCategory ?? "Encaissements",
      ]);
    });
    return { body: csvFromRows(rows), filename: "sage50_journal", suffix: "sage" };
  }
  if (format === "acomba") {
    const rows: (string | number | Date | null | undefined)[][] = [
      ["Date", "No. transaction", "No. facture", "Code client", "Nom client", "Description", "Mode paiement", "Montant HT", "TPS", "TVQ", "Total", "Devise"],
    ];
    payments.forEach((p) => {
      const inv = p.invoice;
      rows.push([
        (p.paidAt ?? p.createdAt).toLocaleDateString(dateTag),
        `P-${p.id}`,
        p.client?.id ? `C${p.client.id}` : "",
        p.client?.fullName ?? "",
        inv?.title ?? "Paiement",
        p.paymentMethod ?? "stripe",
        inv ? Number(inv.amountHt).toFixed(2).replace(".", ",") : "",
        inv ? Number(inv.tpsAmount).toFixed(2).replace(".", ",") : "",
        inv ? Number(inv.tvqAmount).toFixed(2).replace(".", ",") : "",
        Number(p.amount).toFixed(2).replace(".", ","),
        (p.currency || "CAD").toUpperCase(),
      ]);
    });
    return { body: csvFromRows(rows, ";"), filename: "acomba_paiements", suffix: "acomba" };
  }
  // CSV standard
  const rows: (string | number | Date | null | undefined)[][] = [
    [t("hdr_date"), t("hdr_id"), t("hdr_facture"), t("hdr_client"), t("hdr_entreprise"), t("hdr_description"), t("hdr_methode"), t("hdr_montant_ht"), t("hdr_tps"), t("hdr_tvq"), t("hdr_total_ttc"), t("hdr_devise"), t("hdr_statut"), t("hdr_stripe_id"), t("hdr_categorie"), t("hdr_reconcilie"), t("hdr_exporte"), t("hdr_comptable")],
  ];
  payments.forEach((p) => {
    const inv = p.invoice;
    rows.push([
      (p.paidAt ?? p.createdAt).toISOString().slice(0, 10),
      p.id,
      inv?.invoiceNumber ?? "",
      p.client?.fullName ?? "",
      p.client?.companyName ?? "",
      inv?.title ?? "",
      p.paymentMethod ?? "",
      inv ? Number(inv.amountHt).toFixed(2) : "",
      inv ? Number(inv.tpsAmount).toFixed(2) : "",
      inv ? Number(inv.tvqAmount).toFixed(2) : "",
      Number(p.amount).toFixed(2),
      (p.currency || "CAD").toUpperCase(),
      p.status,
      p.stripePaymentIntentId ?? "",
      p.accountingCategory ?? "",
      p.reconciledAt ? p.reconciledAt.toISOString().slice(0, 10) : "",
      p.exportedAt ? p.exportedAt.toISOString().slice(0, 10) : "",
      p.reconciledBy ?? "",
    ]);
  });
  return { body: csvFromRows(rows), filename: "paiements", suffix: "csv" };
}

async function markExportedAndAudit(payments: PaymentWithRelations[], format: string, adminId: number | null, adminEmail: string | null) {
  if (payments.length > 0) {
    const now = new Date();
    await prisma.payment.updateMany({
      where: { id: { in: payments.map((p) => p.id) } },
      data: {
        exportedAt: now,
        exportedBy: adminEmail ?? "admin",
        exportFormat: format,
      },
    });
  }
  await logAudit({
    adminId,
    action: "export",
    entityType: "payments",
    changes: { type: "accounting_export", format, count: payments.length },
  });
}

function csvResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(req: Request) {
  const t = await getTranslations("api_errors");
  const dateTag = dateLocale(await getLocale());
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("payments", "read")) {
    return forbiddenJson();
  }

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") ?? "csv_standard").toLowerCase();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const onlyReconciled = searchParams.get("onlyReconciled") === "true";
  const onlyNotExported = searchParams.get("onlyNotExported") === "true";

  const where: Record<string, unknown> = {};
  if (from || to) {
    const dateWhere: Record<string, Date> = {};
    if (from) dateWhere.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setDate(end.getDate() + 1);
      dateWhere.lte = end;
    }
    where.paidAt = dateWhere;
  }
  if (onlyReconciled) where.reconciledAt = { not: null };
  if (onlyNotExported) where.exportedAt = null;

  const payments = await loadPayments(where);
  const { body, filename, suffix } = buildBody(payments, format, t, dateTag);
  const period = `${from ?? "all"}_${to ?? "now"}`;
  await markExportedAndAudit(payments, suffix, session.user.adminId ?? null, session.user.email ?? null);
  return csvResponse(body, `${filename}_${safeFileName(period)}.csv`);
}

export async function POST(req: Request) {
  const t = await getTranslations("api_errors");
  const dateTag = dateLocale(await getLocale());
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("payments", "write")) {
    return forbiddenJson();
  }

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") ?? "csv_standard").toLowerCase();

  const body = await req.json().catch(() => ({}));
  const paymentIds = Array.isArray(body.paymentIds)
    ? body.paymentIds.filter((n: unknown): n is number => Number.isInteger(n) && (n as number) > 0)
    : [];

  if (paymentIds.length === 0) {
    return NextResponse.json({ error: "paymentIds requis" }, { status: 400 });
  }

  const payments = await loadPayments({ id: { in: paymentIds } });
  const { body: csv, filename, suffix } = buildBody(payments, format, t, dateTag);
  await markExportedAndAudit(payments, suffix, session.user.adminId ?? null, session.user.email ?? null);
  return csvResponse(csv, `${filename}_selection_${new Date().toISOString().slice(0, 10)}.csv`);
}
