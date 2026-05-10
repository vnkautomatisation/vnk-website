// GET /api/audit-trail — timeline globale unifiee de tous les evenements
// Combine : LoginEvent + OrderEvent + SignatureEvent + ConsentLog + EmailEvent + AuditLog + WorkflowEvent
// Filtres : ?type=login,order,... &clientId=X &from=YYYY-MM-DD &to=YYYY-MM-DD &limit=200
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type AuditTrailEvent = {
  id: string;
  source: "login" | "order" | "signature" | "consent" | "email" | "audit" | "workflow";
  type: string;
  label: string;
  clientId: number | null;
  clientName?: string | null;
  adminId?: number | null;
  adminEmail?: string | null;
  email?: string | null;
  ipAddress: string | null;
  userAgent?: string | null;
  amount?: number | null;
  currency?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const types = searchParams.get("type")?.split(",") ?? [];
  const clientIdFilter = searchParams.get("clientId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Math.min(Number(searchParams.get("limit") ?? 200), 1000);

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

  const events: AuditTrailEvent[] = [];

  if (want("login")) {
    const logins = await prisma.loginEvent.findMany({
      where: { ...dateWhere, ...clientWhere },
      orderBy: { createdAt: "desc" }, take: limit,
    });
    logins.forEach((l) => events.push({
      id: `login-${l.id}`, source: "login", type: l.type,
      label: `${l.type === "success" ? "Connexion réussie" : l.type === "failed" ? "Échec connexion" : l.type === "logout" ? "Déconnexion" : l.type} — ${l.email}${l.reason ? ` (${l.reason})` : ""}`,
      clientId: l.clientId, clientName: l.clientId ? clientMap.get(l.clientId) ?? null : null,
      adminId: l.adminId, email: l.email,
      ipAddress: l.ipAddress, userAgent: l.userAgent,
      metadata: { country: l.country, city: l.city, deviceType: l.deviceType },
      createdAt: l.createdAt.toISOString(),
    }));
  }

  if (want("order")) {
    const orders = await prisma.orderEvent.findMany({
      where: { ...dateWhere, ...clientWhere },
      orderBy: { createdAt: "desc" }, take: limit,
    });
    orders.forEach((o) => events.push({
      id: `order-${o.id}`, source: "order", type: o.type,
      label: `${o.type} ${o.amount ? `— ${Number(o.amount).toFixed(2)} ${o.currency ?? "CAD"}` : ""}${o.guestEmail ? ` (invité: ${o.guestEmail})` : ""}`,
      clientId: o.clientId, clientName: o.clientId ? clientMap.get(o.clientId) ?? null : null,
      email: o.guestEmail,
      ipAddress: o.ipAddress, userAgent: o.userAgent,
      amount: o.amount != null ? Number(o.amount) : null, currency: o.currency,
      metadata: { stripeIntentId: o.stripeIntentId, paymentMethod: o.paymentMethod, referer: o.referer, origin: o.origin, geoCountry: o.geoCountry, ...(o.metadata as object | null ?? {}) },
      createdAt: o.createdAt.toISOString(),
    }));
  }

  if (want("signature")) {
    const sigs = await prisma.signatureEvent.findMany({
      where: { ...dateWhere, ...clientWhere },
      orderBy: { createdAt: "desc" }, take: limit,
    });
    sigs.forEach((s) => events.push({
      id: `sig-${s.id}`, source: "signature", type: `${s.entityType}_signed`,
      label: `Signature ${s.entityType} #${s.entityId} par ${s.signedBy}${s.rfc3161Token ? " (RFC 3161)" : ""}`,
      clientId: s.clientId, clientName: clientMap.get(s.clientId) ?? null,
      ipAddress: s.ipAddress, userAgent: s.userAgent,
      metadata: { entityType: s.entityType, entityId: s.entityId, hash: s.signatureHash?.slice(0, 16) },
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
      label: `Consentement ${c.consentType} ${c.granted ? "accepté" : "refusé"} v${c.version}`,
      clientId: c.clientId, clientName: clientMap.get(c.clientId) ?? null,
      ipAddress: c.ipAddress, userAgent: c.userAgent,
      metadata: { source: c.source, version: c.version },
      createdAt: c.createdAt.toISOString(),
    }));
  }

  if (want("email")) {
    const emails = await prisma.emailEvent.findMany({
      where: { ...dateWhere, ...clientWhere },
      orderBy: { createdAt: "desc" }, take: limit,
    });
    emails.forEach((e) => events.push({
      id: `email-${e.id}`, source: "email", type: e.type,
      label: `Email ${e.type}${e.subject ? ` : ${e.subject}` : ""} → ${e.email}`,
      clientId: e.clientId, clientName: e.clientId ? clientMap.get(e.clientId) ?? null : null,
      email: e.email, ipAddress: e.ipAddress, userAgent: e.userAgent,
      metadata: { messageId: e.messageId, link: e.link, ...(e.metadata as object | null ?? {}) },
      createdAt: e.createdAt.toISOString(),
    }));
  }

  if (want("audit")) {
    const audits = await prisma.auditLog.findMany({
      where: dateWhere,
      include: { admin: { select: { email: true } } },
      orderBy: { createdAt: "desc" }, take: limit,
    });
    audits.forEach((a) => events.push({
      id: `audit-${a.id}`, source: "audit", type: `${a.entityType}.${a.action}`,
      label: `${a.action} ${a.entityType}${a.entityId ? ` #${a.entityId}` : ""}`,
      clientId: null, adminId: a.adminId, adminEmail: a.admin?.email ?? null,
      ipAddress: a.ipAddress, userAgent: a.userAgent,
      metadata: a.changes as Record<string, unknown> | null,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  if (want("workflow")) {
    const workflow = await prisma.workflowEvent.findMany({
      where: { ...dateWhere, ...(clientIdFilter ? { clientId: Number(clientIdFilter) } : {}) },
      orderBy: { createdAt: "desc" }, take: limit,
    });
    workflow.forEach((w) => events.push({
      id: `wf-${w.id}`, source: "workflow", type: w.eventType,
      label: w.eventLabel ?? w.eventType,
      clientId: w.clientId, clientName: clientMap.get(w.clientId) ?? null,
      ipAddress: null, metadata: w.metadata as Record<string, unknown> | null,
      createdAt: w.createdAt.toISOString(),
    }));
  }

  // Tri global par date desc + limit
  events.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ events: events.slice(0, limit) });
}
