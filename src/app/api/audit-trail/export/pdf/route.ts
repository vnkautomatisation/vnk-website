// GET /api/audit-trail/export/pdf — Export PDF du journal d'audit global
// Inclut filtres + manifeste d'integrite SHA-256 pour conformite Loi 25 / SOC 2.
// Reutilise la logique d'agregation de /api/audit-trail.
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { auth } from "@/lib/auth";
import { generateAuditTrailGlobalPdf } from "@/lib/services/pdf-export";

const SOURCE_LABELS: Record<string, string> = {
  login: "Connexions",
  order: "Commandes/Paiements",
  signature: "Signatures",
  consent: "Consentements",
  email: "Courriels",
  audit: "Actions admin",
  workflow: "Workflow",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "Critique",
  error: "Erreur",
  warning: "Avertissement",
  success: "Succès",
  info: "Info",
};

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // On délègue le calcul à l'endpoint principal /api/audit-trail (DRY)
  const url = new URL(req.url);
  const internalUrl = `${url.origin}/api/audit-trail${url.search}`;
  // Forward du cookie d'auth pour que l'appel interne reste authentifie
  const cookie = req.headers.get("cookie") ?? "";
  const res = await fetch(internalUrl, { headers: { cookie } });
  if (!res.ok) {
    return NextResponse.json({ error: "Erreur agrégation événements" }, { status: 500 });
  }
  const data = await res.json();

  // Hash d'intégrité : SHA-256 sur le contenu sérialisé (ordre stable)
  const events = (data.events ?? []) as {
    source: string; type: string; label: string;
    severity: "info" | "success" | "warning" | "error" | "critical";
    result: "success" | "failed" | "neutral";
    anomalies: string[];
    clientName?: string | null; adminEmail?: string | null;
    email?: string | null; ipAddress: string | null;
    country?: string | null; createdAt: string;
  }[];
  const stats = data.stats ?? { total: 0, bySeverity: { critical: 0, error: 0, warning: 0, success: 0, info: 0 }, anomaliesCount: 0, failedCount: 0 };

  const integrityPayload = events.map((e) => `${e.createdAt}|${e.source}|${e.type}|${e.label}|${e.ipAddress ?? ""}`).join("\n");
  const integrityHash = createHash("sha256").update(integrityPayload).digest("hex");

  // Construire le résumé filtres lisible
  const filters: { from?: string; to?: string; sources?: string[]; severity?: string[]; clientName?: string } = {};
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const typeParam = url.searchParams.get("type");
  const sevParam = url.searchParams.get("severity");
  if (from) filters.from = from;
  if (to) filters.to = to;
  if (typeParam) filters.sources = typeParam.split(",").filter(Boolean).map((s) => SOURCE_LABELS[s] ?? s);
  if (sevParam) filters.severity = sevParam.split(",").filter(Boolean).map((s) => SEVERITY_LABELS[s] ?? s);

  const pdf = await generateAuditTrailGlobalPdf({
    events: events.map((e) => ({
      source: e.source,
      type: e.type,
      label: e.label,
      severity: e.severity,
      result: e.result,
      anomalies: e.anomalies,
      clientName: e.clientName,
      adminEmail: e.adminEmail,
      email: e.email,
      ipAddress: e.ipAddress,
      country: e.country,
      createdAt: new Date(e.createdAt),
    })),
    stats,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    integrityHash,
    lang: "fr",
  });

  const filename = `audit-trail_${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.length),
    },
  });
}
