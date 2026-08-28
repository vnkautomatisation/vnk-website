// GET/POST /api/cron/signature-reminders — job quotidien (Railway cron)
// Rappels AUTOMATIQUES des demandes de signature de documents :
//   - Demande avec échéance dans ≤ 2 jours OU dépassée -> notifie chaque
//     destinataire qui n'a pas encore signé (après la demande).
//   - Échéance dépassée depuis > 5 jours -> escalade : notifie AUSSI le
//     manager direct du retardataire + le RH demandeur.
//   - Anti-spam : max un rappel auto / 3 jours par demande (lastAutoRemindAt).
//
// Setup Railway : chainer avec les autres crons quotidiens
//   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<APP>.up.railway.app/api/cron/signature-reminders
import { NextResponse } from "next/server";
import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";
import { dateLocale } from "@/lib/i18n-format";

export const dynamic = "force-dynamic";

function authorize(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

const REMIND_EVERY_MS = 3 * 24 * 60 * 60 * 1000; // 3 jours entre rappels auto
const SOON_MS = 2 * 24 * 60 * 60 * 1000; // "échéance proche" = ≤ 2 jours
const ESCALATE_AFTER_MS = 5 * 24 * 60 * 60 * 1000; // escalade manager après 5 j de retard

async function run(): Promise<NextResponse> {
  const t = await getTranslations("api_errors");
  const dateTag = dateLocale(await getLocale());
  const now = new Date();
  const soonLimit = new Date(now.getTime() + SOON_MS);

  // Demandes pending avec échéance proche ou dépassée, pas rappelées depuis 3 j.
  const requests = await prisma.documentSignatureRequest.findMany({
    where: {
      status: "pending",
      dueDate: { not: null, lte: soonLimit },
    },
    include: {
      template: { select: { id: true, title: true, version: true } },
      requestedBy: { select: { id: true, fullName: true } },
    },
  });

  let reminded = 0;
  let escalated = 0;
  let skipped = 0;

  for (const req of requests) {
    const lastRemind = (req as unknown as { lastAutoRemindAt?: Date | null }).lastAutoRemindAt;
    if (lastRemind && now.getTime() - new Date(lastRemind).getTime() < REMIND_EVERY_MS) {
      skipped++;
      continue;
    }

    // Résout les destinataires (individuel / équipe / tous).
    let targetIds: number[] = [];
    if (req.targetAdminId) {
      targetIds = [req.targetAdminId];
    } else if (req.targetTeamId) {
      const members = await prisma.admin.findMany({
        where: { teamId: req.targetTeamId, isActive: true },
        select: { id: true },
      });
      targetIds = members.map((m) => m.id);
    } else if (req.targetAll) {
      const all = await prisma.admin.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      targetIds = all.map((a) => a.id);
    }
    if (targetIds.length === 0) continue;

    // Exclut ceux qui ont signé APRÈS la demande (même règle que le rappel manuel).
    const signed = await prisma.legalDocumentSignature.findMany({
      where: {
        templateId: req.template.id,
        version: req.template.version,
        adminId: { in: targetIds },
        signedAt: { gte: req.requestedAt },
      },
      select: { adminId: true },
    });
    const signedSet = new Set(signed.map((s) => s.adminId));
    const pendingIds = targetIds.filter((id) => !signedSet.has(id));
    if (pendingIds.length === 0) continue;

    const due = new Date(req.dueDate as Date);
    const isOverdue = due.getTime() < now.getTime();
    const overdueMs = now.getTime() - due.getTime();
    const dueFr = due.toLocaleDateString(dateTag, { day: "numeric", month: "long", year: "numeric" });

    // Rappel aux retardataires.
    await Promise.all(
      pendingIds.map((adminId) =>
        prisma.notification.create({
          data: {
            recipientType: "admin",
            recipientId: adminId,
            type: isOverdue ? "warning" : "info",
            title: isOverdue ? t("signature_en_retard") : t("signature_bientot"),
            body: isOverdue
              ? t("route_p0_devait_etre_signe_avant_le_p1_merci", { p0: req.template.title, p1: dueFr })
              : t("route_p0_doit_etre_signe_avant_le_p1", { p0: req.template.title, p1: dueFr }),
            link: "/admin/mon-espace/documents",
            icon: "file-signature",
          },
        }).catch(() => null),
      ),
    );
    reminded += pendingIds.length;

    // Escalade : retard > 5 jours -> managers directs + RH demandeur.
    if (isOverdue && overdueMs > ESCALATE_AFTER_MS) {
      const lateAdmins = await prisma.admin.findMany({
        where: { id: { in: pendingIds } },
        select: { id: true, fullName: true, email: true, managerId: true },
      });
      const notifTargets = new Map<number, string[]>(); // managerId -> noms retardataires
      for (const a of lateAdmins) {
        if (!a.managerId) continue;
        const name = a.fullName ?? a.email;
        if (!notifTargets.has(a.managerId)) notifTargets.set(a.managerId, []);
        notifTargets.get(a.managerId)!.push(name);
      }
      await Promise.all(
        Array.from(notifTargets.entries()).map(([managerId, names]) =>
          prisma.notification.create({
            data: {
              recipientType: "admin",
              recipientId: managerId,
              type: "warning",
              title: t("signature_s_en_retard_dans_votre_equipe"),
              body: t("route_p0_echeance_p1_n_est_pas_signe_par", { p0: req.template.title, p1: dueFr, p2: names.join(", ") }),
              link: "/admin/employes/documents",
              icon: "alert-triangle",
            },
          }).catch(() => null),
        ),
      );
      // Copie au RH demandeur.
      await prisma.notification.create({
        data: {
          recipientType: "admin",
          recipientId: req.requestedById,
          type: "warning",
          title: t("demande_de_signature_en_retard"),
          body: t("route_p0_echeance_p1_p2_signature_s_manquante_s", { p0: req.template.title, p1: dueFr, p2: pendingIds.length }),
          link: "/admin/employes/documents",
          icon: "alert-triangle",
        },
      }).catch(() => null);
      escalated++;
    }

    // Marque le rappel (cast : colonne possiblement absente du client stale).
    await prisma.documentSignatureRequest.update({
      where: { id: req.id },
      data: { ...({ lastAutoRemindAt: now } as object) },
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true, requests: requests.length, reminded, escalated, skipped });
}

export async function GET(req: Request) {
  if (!authorize(req)) return unauthorizedJson();
  return run();
}

export async function POST(req: Request) {
  if (!authorize(req)) return unauthorizedJson();
  return run();
}
