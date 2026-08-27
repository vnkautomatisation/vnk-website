// GET /api/cron/check-contracts — job quotidien (Railway cron)
// Auto-marque comme "expired" les contrats pending/draft dont expiresAt < aujourd'hui
// → workflow event contract_cancelled (faute d'event "expired" dedie) + notification admin
//
// Setup Railway : meme cron service que check-invoices, chainer avec &&
//   curl ... /api/cron/check-invoices && curl ... /api/cron/check-contracts
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { createWorkflowEvent } from "@/lib/workflow";
import { revalidateAdminViews } from "@/lib/revalidate";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

function authorize(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

export async function GET(req: Request) {
  const t = await getTranslations("api_errors");
  if (!authorize(req)) {
    return unauthorizedJson();
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const toExpire = await prisma.contract.findMany({
    where: {
      status: { in: ["pending", "draft"] },
      expiresAt: { lt: today, not: null },
    },
    select: { id: true, clientId: true, contractNumber: true, title: true, expiresAt: true },
  });

  for (const ct of toExpire) {
    await prisma.contract.update({ where: { id: ct.id }, data: { status: "expired" } });

    await createWorkflowEvent({
      clientId: ct.clientId,
      contractId: ct.id,
      eventType: "contract_cancelled",
      eventLabel: `Contrat ${ct.contractNumber} expiré automatiquement`,
      triggeredBy: "system",
    });

    await prisma.notification.create({
      data: {
        recipientType: "admin",
        recipientId: 0,
        type: "warning",
        title: t("contrat_expire"),
        body: `${ct.contractNumber} — ${ct.title}`,
        link: `/admin/contracts`,
      },
    });
  }

  if (toExpire.length > 0) {
    revalidateAdminViews();
  }

  return NextResponse.json({
    success: true,
    expired: toExpire.length,
    timestamp: now.toISOString(),
  });
}
