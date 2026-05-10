// Helper centralise pour capturer le contexte de chaque requete critique
// IP, User-Agent, referer, origin, geoIP — utilise par login, payment, signature, order, consent
import "server-only";

export type RequestContext = {
  ipAddress: string | null;
  userAgent: string | null;
  referer: string | null;
  origin: string | null;
  country: string | null;
  city: string | null;
  deviceType: "desktop" | "mobile" | "tablet" | null;
};

function detectDeviceType(ua: string | null): "desktop" | "mobile" | "tablet" | null {
  if (!ua) return null;
  const u = ua.toLowerCase();
  if (/ipad|tablet|kindle/.test(u)) return "tablet";
  if (/iphone|ipod|android|mobile|blackberry|opera mini/.test(u)) return "mobile";
  return "desktop";
}

export function captureRequestContext(req: Request): RequestContext {
  const headers = req.headers;
  // Chaine X-Forwarded-For peut contenir IPs multiples : prendre la premiere (client reel)
  const xff = headers.get("x-forwarded-for");
  const ipAddress = xff
    ? xff.split(",")[0].trim()
    : headers.get("x-real-ip") ?? headers.get("cf-connecting-ip") ?? null;
  const userAgent = headers.get("user-agent");
  const referer = headers.get("referer") ?? headers.get("referrer");
  const origin = headers.get("origin");
  // Cloudflare / Vercel / Railway peuvent fournir geoIP via headers
  const country = headers.get("cf-ipcountry") ?? headers.get("x-vercel-ip-country") ?? null;
  const city = headers.get("cf-ipcity") ?? headers.get("x-vercel-ip-city") ?? null;

  return {
    ipAddress,
    userAgent,
    referer,
    origin,
    country,
    city,
    deviceType: detectDeviceType(userAgent),
  };
}

// Wrappers pour logger automatiquement les events critiques
import { prisma } from "@/lib/prisma";

export async function logLoginEvent(params: {
  req: Request;
  clientId?: number | null;
  adminId?: number | null;
  email: string;
  type: "success" | "failed" | "locked" | "2fa_challenge" | "2fa_success" | "2fa_failed" | "logout";
  reason?: string;
}) {
  const ctx = captureRequestContext(params.req);
  return prisma.loginEvent.create({
    data: {
      clientId: params.clientId ?? null,
      adminId: params.adminId ?? null,
      email: params.email,
      type: params.type,
      reason: params.reason ?? null,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      country: ctx.country,
      city: ctx.city,
      deviceType: ctx.deviceType,
    },
  });
}

export async function logOrderEvent(params: {
  req?: Request;
  clientId?: number | null;
  guestEmail?: string | null;
  type: "initiated" | "created" | "paid" | "failed" | "refunded" | "cancelled" | "dispute_opened" | "dispute_updated";
  amount?: number;
  currency?: string;
  stripeIntentId?: string;
  paymentMethod?: string;
  invoiceId?: number;
  metadata?: Record<string, unknown>;
}) {
  const ctx = params.req ? captureRequestContext(params.req) : { ipAddress: null, userAgent: null, referer: null, origin: null, country: null };
  return prisma.orderEvent.create({
    data: {
      clientId: params.clientId ?? null,
      guestEmail: params.guestEmail ?? null,
      type: params.type,
      amount: params.amount,
      currency: params.currency ?? null,
      stripeIntentId: params.stripeIntentId ?? null,
      paymentMethod: params.paymentMethod ?? null,
      invoiceId: params.invoiceId ?? null,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      referer: ctx.referer,
      origin: ctx.origin,
      geoCountry: ctx.country,
      metadata: (params.metadata as object | undefined) ?? undefined,
    },
  });
}

export async function logSignatureEvent(params: {
  req: Request;
  entityType: "contract" | "quote";
  entityId: number;
  clientId: number;
  signedBy: string;
  signatureHash?: string;
  rfc3161Token?: string;
}) {
  const ctx = captureRequestContext(params.req);
  return prisma.signatureEvent.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      clientId: params.clientId,
      signedBy: params.signedBy,
      signatureHash: params.signatureHash ?? null,
      rfc3161Token: params.rfc3161Token ?? null,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    },
  });
}

export async function logConsentEvent(params: {
  req: Request;
  clientId: number;
  consentType: "terms" | "privacy" | "marketing" | "cookies" | "data_retention";
  version: string;
  granted: boolean;
  source?: "signup" | "portal_settings" | "popup_banner";
}) {
  const ctx = captureRequestContext(params.req);
  return prisma.consentLog.create({
    data: {
      clientId: params.clientId,
      consentType: params.consentType,
      version: params.version,
      granted: params.granted,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      source: params.source ?? null,
    },
  });
}

export async function logEmailEvent(params: {
  clientId?: number | null;
  messageId?: string;
  type: "sent" | "delivered" | "opened" | "clicked" | "bounced" | "complained" | "failed";
  email: string;
  subject?: string;
  link?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  return prisma.emailEvent.create({
    data: {
      clientId: params.clientId ?? null,
      messageId: params.messageId ?? null,
      type: params.type,
      email: params.email,
      subject: params.subject ?? null,
      link: params.link ?? null,
      metadata: (params.metadata as object | undefined) ?? undefined,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    },
  });
}
