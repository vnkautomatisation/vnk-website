// GET /api/admin/vacation-windows/[id]/anonymous-prefs
// Retourne le count anonymise d'employes ayant soumis une preference touchant chaque
// date de la coversFrom/coversTo range de la fenetre. Aucun nom n'est expose — utilise
// pour la heatmap de popularite cote employe (modal de soumission preferences).
import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

function pad(n: number) { return n.toString().padStart(2, "0"); }
function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }

  const { id } = await params;
  const windowId = Number(id);
  if (!Number.isFinite(windowId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const w = await prisma.vacationSelectionWindow.findUnique({
    where: { id: windowId },
    select: { id: true, coversFrom: true, coversTo: true, status: true },
  });
  if (!w) return NextResponse.json({ error: "Fenetre introuvable" }, { status: 404 });

  // Recupere uniquement les start/end + adminId (pour dedupe par employe par jour)
  const prefs = await prisma.vacationPreference.findMany({
    where: {
      windowId,
      // On exclut soi-meme pour ne pas se compter
      adminId: { not: session.user.adminId ?? -1 },
    },
    select: { adminId: true, startDate: true, endDate: true, status: true },
  });

  // Heatmap : dateISO -> count distinct adminId
  const dayCount = new Map<string, Set<number>>();
  for (const p of prefs) {
    if (p.status === "denied") continue; // ignore les refusees pour pas biaiser
    const s = new Date(p.startDate);
    const e = new Date(p.endDate);
    const cursor = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const limit = new Date(e.getFullYear(), e.getMonth(), e.getDate());
    while (cursor <= limit) {
      const key = toISO(cursor);
      if (!dayCount.has(key)) dayCount.set(key, new Set());
      dayCount.get(key)!.add(p.adminId);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const heatmap: Array<{ date: string; count: number }> = [];
  // On itere sur tous les jours du coversFrom -> coversTo pour avoir une serie continue
  const from = new Date(w.coversFrom.getFullYear(), w.coversFrom.getMonth(), w.coversFrom.getDate());
  const to = new Date(w.coversTo.getFullYear(), w.coversTo.getMonth(), w.coversTo.getDate());
  const cur = new Date(from);
  while (cur <= to) {
    const key = toISO(cur);
    heatmap.push({ date: key, count: dayCount.get(key)?.size ?? 0 });
    cur.setDate(cur.getDate() + 1);
  }

  const maxCount = heatmap.reduce((m, d) => Math.max(m, d.count), 0);
  // Nombre distinct de collègues ayant soumis (preferences non refusées)
  const submittedCount = new Set(prefs.filter((p) => p.status !== "denied").map((p) => p.adminId)).size;

  return NextResponse.json({
    windowId,
    coversFrom: toISO(w.coversFrom),
    coversTo: toISO(w.coversTo),
    maxCount,
    submittedCount,
    heatmap,
  });
}
