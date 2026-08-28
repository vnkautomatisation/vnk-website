// GET /api/audit-trail — timeline globale unifiee de tous les evenements
// Combine : LoginEvent + OrderEvent + SignatureEvent + ConsentLog + EmailEvent + AuditLog + WorkflowEvent
// Filtres : ?type=login,order,... &clientId=X &from=YYYY-MM-DD &to=YYYY-MM-DD &limit=200 &severity=critical,error,warning &result=success,failed &cursor=N (pagination)
//
// Enrichissements VNK :
//  - severity (info/success/warning/error/critical) calculé par event
//  - anomalies détectées (failed_login_burst, off_hours_admin, impossible_travel, bulk_export)
//  - geoIp + deviceType (pour LoginEvent)
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { workflowEventLabel } from "@/lib/workflow-label";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export type Severity = "info" | "success" | "warning" | "error" | "critical";
export type AnomalyFlag = "failed_login_burst" | "off_hours_admin" | "impossible_travel" | "bulk_export" | "new_geo";

export type AuditTrailEvent = {
  id: string;
  source: "login" | "order" | "signature" | "consent" | "email" | "audit" | "workflow";
  type: string;
  label: string;
  severity: Severity;
  result: "success" | "failed" | "neutral";
  anomalies: AnomalyFlag[];
  clientId: number | null;
  clientName?: string | null;
  adminId?: number | null;
  adminEmail?: string | null;
  email?: string | null;
  ipAddress: string | null;
  userAgent?: string | null;
  country?: string | null;
  city?: string | null;
  amount?: number | null;
  currency?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

// ─── Helpers anomalies ──────────────────────────────────────────
// Détection : > 5 logins échoués pour le même email/IP en 10 minutes
function detectFailedLoginBurst(allLogins: { email: string; ipAddress: string | null; type: string; createdAt: Date }[]): Set<string> {
  const flagged = new Set<string>();
  const WINDOW_MS = 10 * 60 * 1000;
  const THRESHOLD = 5;
  // Groupe par email + IP
  const groups = new Map<string, { type: string; createdAt: Date }[]>();
  for (const l of allLogins) {
    if (l.type !== "failed") continue;
    const key = `${l.email}::${l.ipAddress ?? ""}`;
    const arr = groups.get(key) ?? [];
    arr.push({ type: l.type, createdAt: l.createdAt });
    groups.set(key, arr);
  }
  for (const arr of groups.values()) {
    if (arr.length < THRESHOLD) continue;
    arr.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (let i = 0; i <= arr.length - THRESHOLD; i++) {
      const span = arr[i + THRESHOLD - 1].createdAt.getTime() - arr[i].createdAt.getTime();
      if (span <= WINDOW_MS) {
        // Marque tous les events de la fenêtre
        for (let j = i; j < arr.length; j++) flagged.add(arr[j].createdAt.toISOString());
      }
    }
  }
  return flagged;
}

// Détection : login d'un même email depuis 2 pays différents en moins de 1h (vol impossible)
function detectImpossibleTravel(allLogins: { email: string; country: string | null; createdAt: Date; type: string }[]): Set<string> {
  const flagged = new Set<string>();
  const WINDOW_MS = 60 * 60 * 1000;
  // Groupe par email (success uniquement)
  const groups = new Map<string, { country: string | null; createdAt: Date }[]>();
  for (const l of allLogins) {
    if (l.type !== "success" || !l.country) continue;
    const arr = groups.get(l.email) ?? [];
    arr.push({ country: l.country, createdAt: l.createdAt });
    groups.set(l.email, arr);
  }
  for (const arr of groups.values()) {
    arr.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (let i = 1; i < arr.length; i++) {
      const prev = arr[i - 1];
      const cur = arr[i];
      if (prev.country && cur.country && prev.country !== cur.country) {
        const span = cur.createdAt.getTime() - prev.createdAt.getTime();
        if (span <= WINDOW_MS) {
          flagged.add(prev.createdAt.toISOString());
          flagged.add(cur.createdAt.toISOString());
        }
      }
    }
  }
  return flagged;
}

// Off-hours : action admin entre 22h et 6h (heure locale serveur)
function isOffHoursAdmin(date: Date): boolean {
  const h = date.getHours();
  return h >= 22 || h < 6;
}

// Détection : > 3 exports admin dans 5 min par le même admin
function detectBulkExport(audits: { adminId: number | null; action: string; createdAt: Date }[]): Set<string> {
  const flagged = new Set<string>();
  const WINDOW_MS = 5 * 60 * 1000;
  const THRESHOLD = 3;
  const groups = new Map<number, Date[]>();
  for (const a of audits) {
    if (a.action !== "export" || !a.adminId) continue;
    const arr = groups.get(a.adminId) ?? [];
    arr.push(a.createdAt);
    groups.set(a.adminId, arr);
  }
  for (const arr of groups.values()) {
    if (arr.length < THRESHOLD) continue;
    arr.sort((a, b) => a.getTime() - b.getTime());
    for (let i = 0; i <= arr.length - THRESHOLD; i++) {
      const span = arr[i + THRESHOLD - 1].getTime() - arr[i].getTime();
      if (span <= WINDOW_MS) {
        for (let j = i; j < arr.length; j++) flagged.add(arr[j].toISOString());
      }
    }
  }
  return flagged;
}

// Map LoginEvent.type → severity
function loginSeverity(type: string): { sev: Severity; result: "success" | "failed" | "neutral" } {
  if (type === "success" || type === "2fa_success") return { sev: "success", result: "success" };
  if (type === "failed" || type === "2fa_failed" || type === "locked") return { sev: "error", result: "failed" };
  return { sev: "info", result: "neutral" };
}

function orderSeverity(type: string): { sev: Severity; result: "success" | "failed" | "neutral" } {
  if (type === "paid") return { sev: "success", result: "success" };
  if (type === "failed" || type === "dispute_opened") return { sev: "error", result: "failed" };
  if (type === "refunded" || type === "cancelled") return { sev: "warning", result: "neutral" };
  return { sev: "info", result: "neutral" };
}

function emailSeverity(type: string): { sev: Severity; result: "success" | "failed" | "neutral" } {
  if (type === "delivered" || type === "opened" || type === "clicked") return { sev: "success", result: "success" };
  if (type === "bounced" || type === "complained" || type === "failed") return { sev: "error", result: "failed" };
  return { sev: "info", result: "neutral" };
}

function auditSeverity(action: string): { sev: Severity; result: "success" | "failed" | "neutral" } {
  if (action === "delete") return { sev: "warning", result: "neutral" };
  if (action === "export") return { sev: "warning", result: "neutral" };
  if (action === "settings_update" || action === "role_change" || action === "password_reset") return { sev: "warning", result: "neutral" };
  return { sev: "info", result: "neutral" };
}

// Les libelles composes du journal passent par des cles.
const LOGIN_KEYS: Record<string, string> = {
  success: "aud_connexion_reussie", failed: "aud_echec_connexion", logout: "aud_deconnexion",
  locked: "aud_compte_verrouille", "2fa_success": "aud_2fa_reussie",
  "2fa_failed": "aud_2fa_echouee", "2fa_challenge": "aud_defi_2fa",
};
const ORDER_KEYS: Record<string, string> = {
  paid: "aud_paiement_reussi", failed: "aud_echec_paiement", refunded: "aud_remboursement",
  dispute_opened: "aud_litige_ouvert", cancelled: "aud_annule",
};
const EMAIL_KEYS: Record<string, string> = {
  sent: "aud_envoye", delivered: "aud_livre", opened: "aud_ouvert",
  clicked: "aud_lien_clique", bounced: "aud_rebondi", complained: "aud_marque_spam",
};

export async function GET(req: Request) {
  const t = await getTranslations("api_errors");
  const tRoot = await getTranslations();
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("audit_trail", "read")) {
    return forbiddenJson();
  }

  const { searchParams } = new URL(req.url);
  const types = searchParams.get("type")?.split(",").filter(Boolean) ?? [];
  const clientIdFilter = searchParams.get("clientId");
  const adminIdFilter = searchParams.get("adminId");
  // actorScope : "all" (par défaut) | "admin_only" (uniquement événements admin/utilisateurs) | "client_only"
  const actorScope = searchParams.get("actorScope") || "all";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const severityFilter = searchParams.get("severity")?.split(",").filter(Boolean) ?? [];
  const resultFilter = searchParams.get("result")?.split(",").filter(Boolean) ?? [];
  const anomalyFilter = searchParams.get("anomaly") === "1";
  const limit = Math.min(Number(searchParams.get("limit") ?? 200), 1000);
  const adminIdNum = adminIdFilter ? Number(adminIdFilter) : null;

  const want = (k: string) => types.length === 0 || types.includes(k);
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setDate(end.getDate() + 1);
    dateFilter.lte = end;
  }
  const dateWhere = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};
  const clientWhere = clientIdFilter ? { clientId: Number(clientIdFilter) } : {};

  // Resolve client names map
  const clientMap = new Map<number, string>();
  if (clientIdFilter) {
    const c = await prisma.client.findUnique({ where: { id: Number(clientIdFilter) }, select: { fullName: true } });
    if (c) clientMap.set(Number(clientIdFilter), c.fullName);
  } else {
    const clients = await prisma.client.findMany({ select: { id: true, fullName: true } });
    clients.forEach((c) => clientMap.set(c.id, c.fullName));
  }

  // Pour détection anomalies, on a besoin de tous les logins/audits de la période (pas filtrés)
  const allLoginsForAnomaly: { email: string; ipAddress: string | null; type: string; country: string | null; createdAt: Date }[] = [];
  const allAuditsForAnomaly: { adminId: number | null; action: string; createdAt: Date }[] = [];

  const events: AuditTrailEvent[] = [];

  if (want("login")) {
    const logins = await prisma.loginEvent.findMany({
      where: { ...dateWhere, ...clientWhere },
      orderBy: { createdAt: "desc" }, take: limit,
    });
    logins.forEach((l) => {
      allLoginsForAnomaly.push({ email: l.email, ipAddress: l.ipAddress, type: l.type, country: l.country, createdAt: l.createdAt });
      const { sev, result } = loginSeverity(l.type);
      events.push({
        id: `login-${l.id}`, source: "login", type: l.type,
        label: t("aud_login_ligne", { etat: t(LOGIN_KEYS[l.type] ?? "aud_evenement"), email: l.email, raison: l.reason ? t("aud_parenthese", { texte: l.reason }) : "" }),
        severity: sev, result, anomalies: [],
        clientId: l.clientId, clientName: l.clientId ? clientMap.get(l.clientId) ?? null : null,
        adminId: l.adminId, email: l.email,
        ipAddress: l.ipAddress, userAgent: l.userAgent,
        country: l.country, city: l.city,
        metadata: { country: l.country, city: l.city, deviceType: l.deviceType, reason: l.reason },
        createdAt: l.createdAt.toISOString(),
      });
    });
  }

  if (want("order")) {
    const orders = await prisma.orderEvent.findMany({
      where: { ...dateWhere, ...clientWhere },
      orderBy: { createdAt: "desc" }, take: limit,
    });
    orders.forEach((o) => {
      const { sev, result } = orderSeverity(o.type);
      events.push({
        id: `order-${o.id}`, source: "order", type: o.type,
        label: t("aud_order_ligne", { etat: t(ORDER_KEYS[o.type] ?? "aud_evenement"), montant: o.amount ? `· ${Number(o.amount).toFixed(2)} ${o.currency ?? "CAD"}` : "", invite: o.guestEmail ? t("aud_invite", { email: o.guestEmail }) : "" }),
        severity: sev, result, anomalies: [],
        clientId: o.clientId, clientName: o.clientId ? clientMap.get(o.clientId) ?? null : null,
        email: o.guestEmail,
        ipAddress: o.ipAddress, userAgent: o.userAgent,
        country: o.geoCountry,
        amount: o.amount != null ? Number(o.amount) : null, currency: o.currency,
        metadata: { stripeIntentId: o.stripeIntentId, paymentMethod: o.paymentMethod, referer: o.referer, origin: o.origin, geoCountry: o.geoCountry, invoiceId: o.invoiceId, ...(o.metadata as object | null ?? {}) },
        createdAt: o.createdAt.toISOString(),
      });
    });
  }

  if (want("signature")) {
    const sigs = await prisma.signatureEvent.findMany({
      where: { ...dateWhere, ...clientWhere },
      orderBy: { createdAt: "desc" }, take: limit,
    });
    sigs.forEach((s) => events.push({
      id: `sig-${s.id}`, source: "signature", type: `${s.entityType}_signed`,
      label: t("route_signature_p0_p1_par_p2_p3", { p0: s.entityType, p1: s.entityId, p2: s.signedBy, p3: s.rfc3161Token ? " (RFC 3161)" : "" }),
      severity: "success", result: "success", anomalies: [],
      clientId: s.clientId, clientName: clientMap.get(s.clientId) ?? null,
      ipAddress: s.ipAddress, userAgent: s.userAgent,
      metadata: { entityType: s.entityType, entityId: s.entityId, hash: s.signatureHash, rfc3161Token: s.rfc3161Token },
      createdAt: s.createdAt.toISOString(),
    }));
  }

  if (want("consent")) {
    const consents = await prisma.consentLog.findMany({
      where: { ...dateWhere, ...clientWhere },
      orderBy: { createdAt: "desc" }, take: limit,
    });
    consents.forEach((c) => events.push({
      id: `consent-${c.id}`, source: "consent", type: c.consentType,
      label: t("route_consentement_p0_p1_v_p2", { p0: c.consentType, p1: c.granted ? "accepté" : "refusé", p2: c.version }),
      severity: c.granted ? "success" : "warning",
      result: c.granted ? "success" : "neutral",
      anomalies: [],
      clientId: c.clientId, clientName: clientMap.get(c.clientId) ?? null,
      ipAddress: c.ipAddress, userAgent: c.userAgent,
      metadata: { source: c.source, version: c.version, granted: c.granted },
      createdAt: c.createdAt.toISOString(),
    }));
  }

  if (want("email")) {
    const emails = await prisma.emailEvent.findMany({
      where: { ...dateWhere, ...clientWhere },
      orderBy: { createdAt: "desc" }, take: limit,
    });
    emails.forEach((e) => {
      const { sev, result } = emailSeverity(e.type);
      events.push({
        id: `email-${e.id}`, source: "email", type: e.type,
        label: t("aud_email_ligne", { etat: t(EMAIL_KEYS[e.type] ?? "aud_evenement"), sujet: e.subject ? t("aud_deux_points", { texte: e.subject }) : "", email: e.email }),
        severity: sev, result, anomalies: [],
        clientId: e.clientId, clientName: e.clientId ? clientMap.get(e.clientId) ?? null : null,
        email: e.email, ipAddress: e.ipAddress, userAgent: e.userAgent,
        metadata: { messageId: e.messageId, link: e.link, subject: e.subject, ...(e.metadata as object | null ?? {}) },
        createdAt: e.createdAt.toISOString(),
      });
    });
  }

  if (want("audit")) {
    const audits = await prisma.auditLog.findMany({
      where: dateWhere,
      include: { admin: { select: { email: true } } },
      orderBy: { createdAt: "desc" }, take: limit,
    });
    audits.forEach((a) => {
      allAuditsForAnomaly.push({ adminId: a.adminId, action: a.action, createdAt: a.createdAt });
      const ch = a.changes as Record<string, unknown> | null;
      const cidFromChanges = ch && typeof ch.clientId === "number" ? ch.clientId : null;
      const auditClientId = cidFromChanges ?? (a.entityType === "clients" && a.entityId ? a.entityId : null);

      if (clientIdFilter && auditClientId !== Number(clientIdFilter)) return;

      const typeFromChanges = ch && typeof ch.type === "string" ? ch.type : null;
      const clientNameFromChanges = ch && typeof ch.clientName === "string" ? ch.clientName : null;
      const titleFromChanges = ch && typeof ch.title === "string" ? ch.title : null;
      const actor = a.admin?.email ?? clientNameFromChanges ?? (auditClientId ? clientMap.get(auditClientId) ?? null : null);
      let prettyLabel: string;
      if (typeFromChanges === "document_read_by_client") {
        prettyLabel = t("route_document_p0_lu_par_p1", { p0: titleFromChanges ?? `#${a.entityId}`, p1: clientNameFromChanges ?? "client" });
      } else if (typeFromChanges === "password_changed") {
        prettyLabel = t("route_mot_de_passe_modifie_p0", { p0: actor ? t("route_par_acteur", { actor }) : "" });
      } else if (typeFromChanges === "2fa_enabled") {
        prettyLabel = t("route_2fa_activee_p0", { p0: actor ? t("route_par_acteur", { actor }) : "" });
      } else if (typeFromChanges === "2fa_disabled") {
        prettyLabel = t("route_2fa_desactivee_p0", { p0: actor ? t("route_par_acteur", { actor }) : "" });
      } else if (typeFromChanges) {
        prettyLabel = t("route_p0_p1_p2", { p0: typeFromChanges, p1: a.entityId ? ` #${a.entityId}` : "", p2: actor ? t("route_par_acteur", { actor }) : "" });
      } else {
        prettyLabel = t("route_p0_p1_p2_p3", { p0: a.action, p1: a.entityType, p2: a.entityId ? ` #${a.entityId}` : "", p3: actor ? t("route_par_acteur", { actor }) : "" });
      }
      const { sev, result } = auditSeverity(a.action);
      events.push({
        id: `audit-${a.id}`, source: "audit", type: typeFromChanges ?? `${a.entityType}.${a.action}`,
        label: prettyLabel,
        severity: sev, result, anomalies: [],
        clientId: auditClientId,
        clientName: auditClientId ? clientMap.get(auditClientId) ?? null : null,
        adminId: a.adminId, adminEmail: a.admin?.email ?? null,
        ipAddress: a.ipAddress, userAgent: a.userAgent,
        metadata: ch,
        createdAt: a.createdAt.toISOString(),
      });
    });
  }

  if (want("workflow")) {
    const workflow = await prisma.workflowEvent.findMany({
      where: { ...dateWhere, ...(clientIdFilter ? { clientId: Number(clientIdFilter) } : {}) },
      orderBy: { createdAt: "desc" }, take: limit,
    });
    const humanizeLabel = (label: string | null, clientId: number | null): string => {
      if (!label) return "";
      const name = clientId ? clientMap.get(clientId) : null;
      if (!name) return label;
      return label
        .replace(/\bpar le client\b/gi, t("route_par_p0", { p0: name }))
        .replace(/\bau client\b/gi, t("route_a_p0", { p0: name }))
        .replace(/\bdu client\b/gi, t("route_de_p0", { p0: name }))
        .replace(/\bpar client\b/gi, t("route_par_p0", { p0: name }));
    };
    workflow.forEach((w) => events.push({
      id: `wf-${w.id}`, source: "workflow", type: w.eventType,
      label: humanizeLabel(workflowEventLabel(tRoot, w), w.clientId) || w.eventType,
      severity: "info", result: "neutral", anomalies: [],
      clientId: w.clientId, clientName: clientMap.get(w.clientId) ?? null,
      ipAddress: null, metadata: w.metadata as Record<string, unknown> | null,
      createdAt: w.createdAt.toISOString(),
    }));
  }

  // ─── Anomalies (post-traitement) ──────────────────────────────
  const failedLoginBurst = detectFailedLoginBurst(allLoginsForAnomaly);
  const impossibleTravel = detectImpossibleTravel(allLoginsForAnomaly);
  const bulkExport = detectBulkExport(allAuditsForAnomaly);

  for (const e of events) {
    if (e.source === "login") {
      if (failedLoginBurst.has(e.createdAt)) e.anomalies.push("failed_login_burst");
      if (impossibleTravel.has(e.createdAt)) e.anomalies.push("impossible_travel");
    }
    if (e.source === "audit") {
      const eventDate = new Date(e.createdAt);
      if (bulkExport.has(e.createdAt)) e.anomalies.push("bulk_export");
      if (e.adminEmail && isOffHoursAdmin(eventDate)) e.anomalies.push("off_hours_admin");
    }
    // Sévérité élevée si anomalies critiques
    if (e.anomalies.includes("impossible_travel")) e.severity = "critical";
    else if (e.anomalies.includes("failed_login_burst")) e.severity = "critical";
    else if (e.anomalies.includes("bulk_export") || e.anomalies.includes("off_hours_admin")) {
      if (e.severity === "info" || e.severity === "success") e.severity = "warning";
    }
  }

  // ─── Filtres post-enrichissement ─────────────────────────────
  let filtered = events;
  if (severityFilter.length > 0) {
    filtered = filtered.filter((e) => severityFilter.includes(e.severity));
  }
  if (resultFilter.length > 0) {
    filtered = filtered.filter((e) => resultFilter.includes(e.result));
  }
  if (anomalyFilter) {
    filtered = filtered.filter((e) => e.anomalies.length > 0);
  }
  // ─── Filtre acteur : admin/utilisateur spécifique ─────────────
  if (adminIdNum) {
    filtered = filtered.filter((e) => e.adminId === adminIdNum);
  }
  // ─── Filtre scope acteur (admin_only / client_only) ───────────
  if (actorScope === "admin_only") {
    // Actions effectuées par un utilisateur (admin) du système
    filtered = filtered.filter((e) => e.adminId != null);
  } else if (actorScope === "client_only") {
    // Actions effectuées par/sur un client (jamais d'admin)
    filtered = filtered.filter((e) => e.adminId == null && e.clientId != null);
  }

  // Tri global par date desc + limit
  filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Stats globales (sur events non filtrés par severity/result/anomaly pour donner contexte)
  const stats = {
    total: events.length,
    bySeverity: {
      critical: events.filter((e) => e.severity === "critical").length,
      error: events.filter((e) => e.severity === "error").length,
      warning: events.filter((e) => e.severity === "warning").length,
      success: events.filter((e) => e.severity === "success").length,
      info: events.filter((e) => e.severity === "info").length,
    },
    anomaliesCount: events.filter((e) => e.anomalies.length > 0).length,
    failedCount: events.filter((e) => e.result === "failed").length,
  };

  return NextResponse.json({ events: filtered.slice(0, limit), stats });
}
