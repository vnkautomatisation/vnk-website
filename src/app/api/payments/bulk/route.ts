// POST /api/payments/bulk — actions en masse : reconcile / unreconcile / assign / categorize / export-flag
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { revalidateAdminViews } from "@/lib/revalidate";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const bodySchema = z.object({
  paymentIds: z.array(z.number().int().positive()).min(1),
  action: z.enum([
    "reconcile",
    "unreconcile",
    "assign_accountant",
    "set_category",
    "mark_exported",
    "add_notes",
  ]),
  // payloads selon action
  accountantId: z.number().int().positive().nullable().optional(),
  category: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  exportFormat: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("payments", "write")) {
    return forbiddenJson();
  }

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { paymentIds, action } = parsed.data;
  const adminEmail = session.user.email ?? "admin";
  const now = new Date();

  let data: Record<string, unknown> = {};
  switch (action) {
    case "reconcile": {
      // Pour reconcile en masse on calcule la periode au fil — boucle individuelle
      let count = 0;
      for (const pid of paymentIds) {
        const p = await prisma.payment.findUnique({ where: { id: pid } });
        if (!p) continue;
        const periodDate = p.paidAt ?? p.createdAt;
        const fp = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, "0")}`;
        await prisma.payment.update({
          where: { id: pid },
          data: {
            reconciledAt: now,
            reconciledBy: adminEmail,
            fiscalPeriod: fp,
          },
        });
        count++;
      }
      await logAudit({
        adminId: session.user.adminId,
        action: "update",
        entityType: "payments",
        changes: { type: "bulk_reconcile", count, ids: paymentIds },
      });
      revalidateAdminViews();
      return NextResponse.json({ success: true, count });
    }
    case "unreconcile": {
      const res = await prisma.payment.updateMany({
        where: { id: { in: paymentIds }, exportedAt: null },
        data: { reconciledAt: null, reconciledBy: null, fiscalPeriod: null },
      });
      await logAudit({
        adminId: session.user.adminId,
        action: "update",
        entityType: "payments",
        changes: { type: "bulk_unreconcile", count: res.count },
      });
      revalidateAdminViews();
      return NextResponse.json({ success: true, count: res.count });
    }
    case "assign_accountant": {
      data = { assignedAccountantId: parsed.data.accountantId ?? null };
      break;
    }
    case "set_category": {
      data = { accountingCategory: parsed.data.category ?? null };
      break;
    }
    case "add_notes": {
      data = { accountantNotes: parsed.data.notes ?? null };
      break;
    }
    case "mark_exported": {
      data = {
        exportedAt: now,
        exportedBy: adminEmail,
        exportFormat: parsed.data.exportFormat ?? "csv",
      };
      break;
    }
  }

  const res = await prisma.payment.updateMany({
    where: { id: { in: paymentIds } },
    data,
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "payments",
    changes: { type: `bulk_${action}`, count: res.count, ids: paymentIds, data },
  });

  revalidateAdminViews();
  return NextResponse.json({ success: true, count: res.count });
}
