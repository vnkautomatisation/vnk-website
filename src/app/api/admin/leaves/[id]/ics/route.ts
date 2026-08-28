// GET /api/admin/leaves/[id]/ics
// Retourne un fichier ICS pour ajouter le conge approuve a un calendrier
// externe (Google, Outlook, Apple).
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

function pad(n: number) { return n.toString().padStart(2, "0"); }
function toIcsDate(d: Date): string {
  // VALUE=DATE format YYYYMMDD pour all-day events
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}
function nowStamp(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

const TYPE_KEY: Record<string, string> = {
  vacation: "exp_vacances",
  sick: "exp_maladie",
  parental: "exp_conge_parental",
  unpaid: "exp_sans_solde",
  bereavement: "exp_deces",
  other: "exp_conge",
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const adminId = session.user.adminId!;
  const { id } = await params;
  const leaveId = Number(id);
  if (!Number.isFinite(leaveId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    include: { admin: { select: { id: true, email: true, fullName: true } } },
  });
  if (!leave) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // Seul l'auteur ou un reviewer peut exporter
  if (leave.adminId !== adminId) {
    const me = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
    const perms = (me?.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
    const isReviewer = me?.customRole?.name === "super_admin" || (perms.leaves ?? []).includes("write") || (perms.users ?? []).includes("write");
    if (!isReviewer) return forbiddenJson();
  }

  if (leave.status !== "approved") {
    return NextResponse.json({ error: t("seuls_les_conges_approuves_peuvent_etre_exportes") }, { status: 400 });
  }

  const dtStart = toIcsDate(leave.startDate);
  // DTEND est exclusif en ICS DATE-only -> +1 jour
  const endPlus = new Date(leave.endDate); endPlus.setDate(endPlus.getDate() + 1);
  const dtEnd = toIcsDate(endPlus);
  const summary = t("route_conge_p0", { p0: TYPE_KEY[leave.type] ? t(TYPE_KEY[leave.type]) : leave.type });
  const description = leave.reason ? leave.reason.replace(/\n/g, "\\n") : "";
  const uid = `leave-${leave.id}@vnk.local`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VNK Automatisation//Congés//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${nowStamp()}`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${summary}`,
    description ? `DESCRIPTION:${description}` : null,
    `STATUS:CONFIRMED`,
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="conge-${leave.id}.ics"`,
    },
  });
}
