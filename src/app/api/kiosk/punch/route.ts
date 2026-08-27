// POST /api/kiosk/punch — shared-tablet punching by employee PIN.
// Feature-flagged: settings hr_pointage.kiosk_enabled must be true.
// No personal session: the employee is identified by a 4-6 digit PIN
// (bcrypt hash on Admin.kioskPinHash, issued by HR from the settings page).
//
// Body: { pin, action: "status"|"in"|"out"|"pause"|"resume", jobCodeId?, kind? }
//   - status: identify + open shift (incl. break state), job codes, worked
//             minutes today and the colleagues currently on site
//   - in:     clock in (job code required when the position has active codes)
//   - out:    clock out (closes a running break automatically)
//   - pause:  start a break — kind "meal" (unpaid) or "paid" (short break)
//   - resume: end the running break
//
// Colleague presence is only returned AFTER a valid PIN: the kiosk URL is
// public, so nothing identifying is exposed before identification.
//
// Security: rate-limited per IP (brute-force), punches recorded with
// source="kiosk", punch rounding applied, geofence bypassed (the tablet
// itself is on site).
import "server-only";
import { getTranslations } from "next-intl/server";
import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { checkRateLimit, getClientIpFromHeaders } from "@/lib/security/rate-limit";
import { getTimeclockConfig, roundToStep } from "@/lib/services/timeclock-config";
import { workedMin, closeRunningBreak } from "@/lib/time-entry";

export const dynamic = "force-dynamic";

type KioskAdmin = { id: number; full_name: string | null; email: string; kiosk_pin_hash: string; position_id: number | null };

async function identifyByPin(pin: string): Promise<KioskAdmin | null> {
  if (!/^\d{4,6}$/.test(pin)) return null;
  // Raw query: kiosk_pin_hash may be missing from a stale generated client.
  const rows = await prisma.$queryRaw<KioskAdmin[]>`
    SELECT id, full_name, email, kiosk_pin_hash, position_id
    FROM admins
    WHERE is_active = true AND kiosk_pin_hash IS NOT NULL
  `;
  const bcrypt = (await import("bcryptjs")).default;
  for (const r of rows) {
    if (await bcrypt.compare(pin, r.kiosk_pin_hash)) return r;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const t = await getTranslations("api_errors");
  const cfg = await getTimeclockConfig();
  if (!cfg.kioskEnabled) {
    return NextResponse.json({ error: t("mode_kiosque_desactive") }, { status: 403 });
  }

  const h = await headers().catch(() => null);
  const ip = getClientIpFromHeaders(h);
  // 4-digit PINs: tighter window to compensate (10k combinations).
  const rl = checkRateLimit({ key: `kiosk:${ip}`, limit: 12, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json({ error: t("trop_de_tentatives_reessayez_dans_quelques_minutes") }, { status: 429 });
  }

  let body: { pin?: string; action?: string; jobCodeId?: number; kind?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("requete_invalide") }, { status: 400 });
  }
  const pin = String(body.pin ?? "");
  const action = String(body.action ?? "status");

  const admin = await identifyByPin(pin);
  if (!admin) {
    return NextResponse.json({ error: "NIP invalide" }, { status: 401 });
  }
  const displayName = admin.full_name ?? admin.email;

  const open = await prisma.timeClock.findFirst({
    where: { adminId: admin.id, clockOut: null },
    orderBy: { clockIn: "desc" },
    select: {
      id: true, clockIn: true, pausedAt: true, totalBreakMin: true, category: true,
      pausedKind: true, paidBreakMin: true,
    },
  });

  // Minutes already worked today (closed entries), for the confirmation screen.
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  async function workedTodayMin(): Promise<number> {
    const rows = await prisma.timeClock.findMany({
      where: {
        adminId: admin!.id,
        clockIn: { gte: dayStart },
        clockOut: { not: null },
        category: { in: ["work", "meeting", "training"] },
      },
      select: { durationMin: true },
    });
    return rows.reduce((s, r) => s + (r.durationMin ?? 0), 0);
  }

  if (action === "status") {
    const jobCodes = admin.position_id
      ? await prisma.jobCode.findMany({
          where: { positionId: admin.position_id, isActive: true },
          orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
          select: { id: true, code: true, label: true },
        })
      : [];
    // Colleagues currently on site (first name only).
    const onSiteRows = await prisma.timeClock.findMany({
      where: { clockOut: null, adminId: { not: admin.id } },
      orderBy: { clockIn: "asc" },
      take: 12,
      select: { clockIn: true, pausedAt: true, admin: { select: { fullName: true, email: true } } },
    });
    const onSite = onSiteRows.map((r) => ({
      name: (r.admin?.fullName || r.admin?.email || "").split(" ")[0],
      since: r.clockIn.toISOString(),
      paused: r.pausedAt != null,
    }));

    const pausedKind = open?.pausedKind ?? null;
    return NextResponse.json({
      fullName: displayName,
      open: open
        ? {
            clockIn: open.clockIn.toISOString(),
            pausedAt: open.pausedAt ? open.pausedAt.toISOString() : null,
            pausedKind,
            totalBreakMin: open.totalBreakMin,
          }
        : null,
      jobCodes,
      todayMin: await workedTodayMin(),
      onSite,
    });
  }

  if (action === "in") {
    if (open) {
      return NextResponse.json({ error: t("un_pointage_est_deja_ouvert_fermez_le") }, { status: 409 });
    }
    const codes = admin.position_id
      ? await prisma.jobCode.findMany({
          where: { positionId: admin.position_id, isActive: true },
          select: { id: true },
        })
      : [];
    let jobCodeId: number | null = null;
    if (codes.length > 0) {
      const chosen = codes.find((c) => c.id === Number(body.jobCodeId));
      if (!chosen) {
        return NextResponse.json({ error: t("choisissez_un_code_de_tache") }, { status: 400 });
      }
      jobCodeId = chosen.id;
    }
    const tc = await prisma.timeClock.create({
      data: {
        adminId: admin.id,
        clockIn: roundToStep(new Date(), cfg.roundingMin),
        category: "work",
        jobCodeId,
        source: "kiosk",
      },
      select: { id: true, clockIn: true },
    });
    await logAudit({ adminId: admin.id, action: "create", entityType: "time_clock", entityId: tc.id, changes: { source: "kiosk", jobCodeId } });
    return NextResponse.json({
      ok: true, fullName: displayName, clockIn: tc.clockIn.toISOString(),
      todayMin: await workedTodayMin(),
    });
  }

  // Breaks from the kiosk, same rules as the web: "meal" is deducted,
  // "paid" is tracked in paidBreakMin but never deducted.
  if (action === "pause") {
    if (!open) return NextResponse.json({ error: "Aucun pointage ouvert" }, { status: 409 });
    if (open.pausedAt) return NextResponse.json({ error: t("pause_deja_en_cours") }, { status: 409 });
    const kind = body.kind === "paid" ? "paid" : "meal";
    await prisma.timeClock.update({
      where: { id: open.id },
      data: { pausedAt: new Date(), pausedKind: kind },
    });
    await logAudit({ adminId: admin.id, action: "update", entityType: "time_clock", entityId: open.id, changes: { paused: kind, source: "kiosk" } });
    return NextResponse.json({ ok: true, fullName: displayName, kind });
  }

  if (action === "resume") {
    if (!open || !open.pausedAt) {
      return NextResponse.json({ error: "Aucune pause en cours" }, { status: 409 });
    }
    const { totalBreakMin, paidBreakMin, addedMin: added } = closeRunningBreak(open, new Date());
    await prisma.timeClock.update({
      where: { id: open.id },
      data: { pausedAt: null, pausedKind: null, totalBreakMin, paidBreakMin },
    });
    await logAudit({ adminId: admin.id, action: "update", entityType: "time_clock", entityId: open.id, changes: { resumed: true, breakMin: added, source: "kiosk" } });
    return NextResponse.json({ ok: true, fullName: displayName, breakMin: added });
  }

  if (action === "out") {
    if (!open) {
      return NextResponse.json({ error: "Aucun pointage ouvert" }, { status: 409 });
    }
    const rawNow = new Date();
    const rounded = roundToStep(rawNow, cfg.roundingMin);
    const now = rounded.getTime() > open.clockIn.getTime() ? rounded : rawNow;
    const { totalBreakMin, paidBreakMin } = closeRunningBreak(open, now);
    const durationMin = workedMin(open.clockIn, now, totalBreakMin);
    await prisma.timeClock.update({
      where: { id: open.id },
      data: { clockOut: now, durationMin, pausedAt: null, pausedKind: null, totalBreakMin, paidBreakMin },
    });
    await logAudit({ adminId: admin.id, action: "update", entityType: "time_clock", entityId: open.id, changes: { closed: true, source: "kiosk", durationMin } });
    return NextResponse.json({
      ok: true, fullName: displayName, durationMin,
      todayMin: await workedTodayMin(),
    });
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
