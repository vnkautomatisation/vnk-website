// GET /api/payments/export?format=quickbooks|sage|acomba|csv_standard|excel&from=&to=&onlyReconciled=
// Genere un fichier d'export comptable pour les paiements de la periode
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  // CSV standard : guillemets doubles dans les valeurs sont doubles
  return `"${s.replace(/"/g, '""')}"`;
}

function csvFromRows(rows: (string | number | Date | null | undefined)[][], separator = ","): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(separator)).join("\r\n");
}

function safeFileName(s: string): string {
  return s.replace(/[\/\\:*?"<>|]/g, "_").replace(/\s+/g, "_");
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
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

  const payments = await prisma.payment.findMany({
    where,
    include: {
      client: { select: { id: true, fullName: true, companyName: true, email: true } },
      invoice: { select: { invoiceNumber: true, title: true, amountHt: true, tpsAmount: true, tvqAmount: true, amountTtc: true } },
    },
    orderBy: { paidAt: "asc" },
  });

  let body: string;
  let filename: string;
  const period = `${from ?? "all"}_${to ?? "now"}`;

  if (format === "quickbooks") {
    // QuickBooks IIF-CSV simplifié : Date, Type, Num, Name, Memo, Account, Amount, Class
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
    body = csvFromRows(rows);
    filename = `quickbooks_payments_${safeFileName(period)}.csv`;
  } else if (format === "sage") {
    // Sage 50 Canada : format journal des encaissements
    const rows: (string | number | Date | null | undefined)[][] = [
      ["Date", "Numéro de transaction", "Numéro de facture", "Nom du client", "Description", "Méthode", "Montant HT", "TPS", "TVQ", "Montant total", "Devise", "Compte"],
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
    body = csvFromRows(rows);
    filename = `sage50_journal_${safeFileName(period)}.csv`;
  } else if (format === "acomba") {
    // Acomba : format CSV avec point-virgule comme séparateur (FR-CA)
    const rows: (string | number | Date | null | undefined)[][] = [
      ["Date", "No. transaction", "No. facture", "Code client", "Nom client", "Description", "Mode paiement", "Montant HT", "TPS", "TVQ", "Total", "Devise"],
    ];
    payments.forEach((p) => {
      const inv = p.invoice;
      rows.push([
        (p.paidAt ?? p.createdAt).toLocaleDateString("fr-CA"),
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
    body = csvFromRows(rows, ";");
    filename = `acomba_paiements_${safeFileName(period)}.csv`;
  } else {
    // CSV standard
    const rows: (string | number | Date | null | undefined)[][] = [
      ["Date", "ID", "Facture", "Client", "Entreprise", "Description", "Méthode", "Montant HT", "TPS", "TVQ", "Total TTC", "Devise", "Statut", "Stripe ID", "Catégorie", "Réconcilié", "Exporté", "Comptable"],
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
    body = csvFromRows(rows);
    filename = `paiements_${safeFileName(period)}.csv`;
  }

  // Marquer comme exportes
  if (payments.length > 0) {
    const now = new Date();
    await prisma.payment.updateMany({
      where: { id: { in: payments.map((p) => p.id) } },
      data: {
        exportedAt: now,
        exportedBy: session.user.email ?? "admin",
        exportFormat: format,
      },
    });
  }

  await logAudit({
    adminId: session.user.adminId,
    action: "export",
    entityType: "payments",
    changes: { type: "accounting_export", format, count: payments.length, period: { from, to } },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
