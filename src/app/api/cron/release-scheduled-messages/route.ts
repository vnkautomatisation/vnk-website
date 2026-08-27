// GET /api/cron/release-scheduled-messages — declenche les events workflow + notifs
// pour les messages programmes dont scheduledFor est passe (et qui n'ont pas encore d'event)
// Pour idempotence : on identifie les messages "fraichement libres" comme ceux dont
// scheduledFor passe et editedAt nul (on flag editedAt apres release).
//
// A executer toutes les 5-10 minutes via Railway cron
//   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<APP>.up.railway.app/api/cron/release-scheduled-messages
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

  // Messages programmes dont l'heure est passee, pas encore "released"
  // Marqueur de release : on met scheduledFor a null une fois traite
  const ready = await prisma.message.findMany({
    where: {
      scheduledFor: { lte: now, not: null },
      deletedAt: null,
      isInternalNote: false,
    },
    select: { id: true, clientId: true, sender: true, attachmentsData: true, attachmentData: true },
  });

  for (const m of ready) {
    const atts = (m.attachmentsData as unknown[] | null) ?? (m.attachmentData ? [m.attachmentData] : null);
    const count = atts ? atts.length : 0;

    await createWorkflowEvent({
      clientId: m.clientId,
      eventType: m.sender === "vnk" ? "message_from_admin" : "message_from_client",
      eventLabel: count > 0 ? t("message_programme_pieces", { count }) : t("message_programme_envoye"),
      triggeredBy: "system",
    });

    // Marque comme release : scheduledFor -> null
    await prisma.message.update({
      where: { id: m.id },
      data: { scheduledFor: null },
    });
  }

  if (ready.length > 0) revalidateAdminViews();

  return NextResponse.json({
    success: true,
    released: ready.length,
    timestamp: now.toISOString(),
  });
}
