// ─────────────────────────────────────────────────────────
// Intégration Microsoft (Outlook Calendar + Teams meetings)
// Utilise Microsoft Graph API v1.0 et OAuth2 Authorization Code Flow.
//
// Configuration côté Azure :
// - App Registration "VNK Portal"
// - Redirect URI : https://<domain>/api/oauth/microsoft/callback
// - Permissions déléguées : offline_access, User.Read,
//   Calendars.ReadWrite, OnlineMeetings.ReadWrite
//
// Variables d'environnement requises (.env.local) :
// - MICROSOFT_CLIENT_ID
// - MICROSOFT_CLIENT_SECRET
// - MICROSOFT_TENANT_ID (ou "common")
// - MICROSOFT_REDIRECT_URI
// ─────────────────────────────────────────────────────────
import "server-only";
import { prisma } from "@/lib/prisma";
import { encryptCredentials, decryptCredentials } from "@/lib/security/crypto";

const SCOPES = [
  "offline_access",
  "User.Read",
  "Calendars.ReadWrite",
  "OnlineMeetings.ReadWrite",
];

// Construit l'URL de redirection à partir du domaine du portail
export function getMicrosoftRedirectUri(origin?: string): string {
  const base = origin
    ?? process.env.MICROSOFT_REDIRECT_URI
    ?? process.env.NEXTAUTH_URL
    ?? process.env.AUTH_URL
    ?? "http://localhost:3000";
  if (base.includes("/api/oauth/microsoft/callback")) return base;
  return `${base.replace(/\/$/, "")}/api/oauth/microsoft/callback`;
}

// Lit la config OAuth depuis l'intégration (DB chiffrée) ou fallback ENV
async function getAppConfig(origin?: string): Promise<{ clientId: string; clientSecret: string; tenantId: string; redirectUri: string }> {
  // Priorité : credentials configurés via l'UI
  const integ = await prisma.integration.findUnique({
    where: { provider: "microsoft_calendar" },
    select: { credentials: true },
  });
  const creds = integ?.credentials ? decryptCredentials(integ.credentials as Record<string, string>) : {};

  const clientId = creds.client_id || process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = creds.client_secret || process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = creds.tenant_id || process.env.MICROSOFT_TENANT_ID || "common";
  const redirectUri = getMicrosoftRedirectUri(origin);

  if (!clientId || !clientSecret) {
    throw new Error("Identifiants OAuth Microsoft manquants. Renseignez-les dans Profil > Intégrations.");
  }
  return { clientId, clientSecret, tenantId, redirectUri };
}

// ── URL d'autorisation (étape 1 OAuth) ───────────────────
export async function buildAuthorizeUrl(state: string, origin?: string): Promise<string> {
  const { clientId, tenantId, redirectUri } = await getAppConfig(origin);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: SCOPES.join(" "),
    state,
    prompt: "select_account",
  });
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`;
}

// ── Échange code → tokens (étape 2 OAuth) ────────────────
type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

export async function exchangeCodeForTokens(code: string, origin?: string): Promise<TokenResponse> {
  const { clientId, clientSecret, tenantId, redirectUri } = await getAppConfig(origin);
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    scope: SCOPES.join(" "),
  });
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Échange token Microsoft échoué : ${err}`);
  }
  return res.json();
}

// ── Refresh d'un token expiré ────────────────────────────
async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret, tenantId } = await getAppConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: SCOPES.join(" "),
  });
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Refresh token Microsoft échoué : ${err}`);
  }
  return res.json();
}

// ── Persistance des tokens (chiffrés) ────────────────────
export async function storeMicrosoftTokens(tokens: TokenResponse, accountEmail?: string) {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Conserver les credentials d'app existants (client_id/secret/tenant)
  const existing = await prisma.integration.findUnique({ where: { provider: "microsoft_calendar" } });
  const existingDecrypted = existing?.credentials
    ? decryptCredentials(existing.credentials as Record<string, string>)
    : {};

  const creds = encryptCredentials({
    ...existingDecrypted,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    account_email: accountEmail ?? existingDecrypted.account_email ?? "",
  });

  await prisma.integration.upsert({
    where: { provider: "microsoft_calendar" },
    create: {
      provider: "microsoft_calendar",
      name: "Microsoft Outlook Calendar",
      isEnabled: true,
      credentials: creds as never,
      config: {} as never,
    },
    update: {
      isEnabled: true,
      credentials: creds as never,
      lastError: null,
    },
  });
}

// ── Récupère un access_token valide (refresh si besoin) ──
export async function getValidAccessToken(): Promise<string | null> {
  const integ = await prisma.integration.findUnique({
    where: { provider: "microsoft_calendar" },
    select: { credentials: true, isEnabled: true },
  });
  if (!integ?.isEnabled || !integ.credentials) return null;

  const creds = decryptCredentials(integ.credentials as Record<string, string>);
  if (!creds.access_token || !creds.refresh_token) return null;

  // Si expire dans moins de 60 s → refresh
  const expiresAt = creds.expires_at ? new Date(creds.expires_at).getTime() : 0;
  if (Date.now() + 60_000 < expiresAt) {
    return creds.access_token;
  }

  try {
    const refreshed = await refreshTokens(creds.refresh_token);
    await storeMicrosoftTokens(refreshed, creds.account_email);
    return refreshed.access_token;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur refresh";
    await prisma.integration.update({
      where: { provider: "microsoft_calendar" },
      data: { lastError: msg.slice(0, 500) },
    }).catch(() => null);
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// Graph API : créer un évènement Outlook + Teams meeting
// Retourne l'eventId Outlook et le joinUrl Teams.
// ─────────────────────────────────────────────────────────
export type GraphEventInput = {
  subject: string;
  body?: string;          // HTML
  startISO: string;       // ISO 8601 local time
  endISO: string;
  timezone: string;       // ex: "America/Toronto"
  attendees: { email: string; name?: string }[];
  isOnlineMeeting?: boolean;
  location?: string;
};

export type GraphEventResult = {
  eventId: string;
  joinUrl: string | null;
  webLink: string | null;
};

export async function createOutlookEvent(input: GraphEventInput): Promise<GraphEventResult> {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Microsoft non connecté");

  const payload: Record<string, unknown> = {
    subject: input.subject,
    body: { contentType: "HTML", content: input.body ?? "" },
    start: { dateTime: input.startISO, timeZone: input.timezone },
    end: { dateTime: input.endISO, timeZone: input.timezone },
    attendees: input.attendees.map((a) => ({
      emailAddress: { address: a.email, name: a.name ?? a.email },
      type: "required",
    })),
  };

  if (input.isOnlineMeeting !== false) {
    payload.isOnlineMeeting = true;
    payload.onlineMeetingProvider = "teamsForBusiness";
  }

  if (input.location) {
    payload.location = { displayName: input.location };
  }

  const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: `outlook.timezone="${input.timezone}"`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Création évènement Outlook échouée : ${err}`);
  }

  const data = await res.json();
  return {
    eventId: data.id,
    joinUrl: data.onlineMeeting?.joinUrl ?? null,
    webLink: data.webLink ?? null,
  };
}

// ── Mettre à jour un évènement existant ───────────────────
export async function updateOutlookEvent(
  eventId: string,
  patch: Partial<GraphEventInput>
): Promise<boolean> {
  const token = await getValidAccessToken();
  if (!token) return false;

  const payload: Record<string, unknown> = {};
  if (patch.subject) payload.subject = patch.subject;
  if (patch.body !== undefined) payload.body = { contentType: "HTML", content: patch.body };
  if (patch.startISO && patch.timezone) {
    payload.start = { dateTime: patch.startISO, timeZone: patch.timezone };
  }
  if (patch.endISO && patch.timezone) {
    payload.end = { dateTime: patch.endISO, timeZone: patch.timezone };
  }
  if (patch.attendees) {
    payload.attendees = patch.attendees.map((a) => ({
      emailAddress: { address: a.email, name: a.name ?? a.email },
      type: "required",
    }));
  }
  if (patch.location) payload.location = { displayName: patch.location };

  const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(patch.timezone ? { Prefer: `outlook.timezone="${patch.timezone}"` } : {}),
    },
    body: JSON.stringify(payload),
  });
  return res.ok;
}

// ── Annuler/supprimer un évènement ────────────────────────
export async function deleteOutlookEvent(eventId: string): Promise<boolean> {
  const token = await getValidAccessToken();
  if (!token) return false;
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok || res.status === 404;
}

// ── Vérifier les dispos (free/busy) ──────────────────────
export type FreeBusyRange = {
  start: Date;
  end: Date;
  status: "free" | "busy" | "tentative" | "oof" | "workingElsewhere";
};

export async function getFreeBusy(startISO: string, endISO: string, timezone: string): Promise<FreeBusyRange[] | null> {
  const token = await getValidAccessToken();
  if (!token) return null;

  // Récupère l'adresse de l'utilisateur connecté
  const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok) return null;
  const me = await meRes.json();

  const res = await fetch("https://graph.microsoft.com/v1.0/me/calendar/getSchedule", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      schedules: [me.mail ?? me.userPrincipalName],
      startTime: { dateTime: startISO, timeZone: timezone },
      endTime: { dateTime: endISO, timeZone: timezone },
      availabilityViewInterval: 30,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const items = data.value?.[0]?.scheduleItems ?? [];
  return items.map((it: { start: { dateTime: string }; end: { dateTime: string }; status: string }) => ({
    start: new Date(it.start.dateTime),
    end: new Date(it.end.dateTime),
    status: it.status as FreeBusyRange["status"],
  }));
}

// ── Déconnexion (révoque côté DB en gardant la config OAuth de l'app) ──
export async function disconnectMicrosoft(): Promise<void> {
  const existing = await prisma.integration.findUnique({ where: { provider: "microsoft_calendar" } });
  if (!existing) return;
  const existingDecrypted = decryptCredentials((existing.credentials as Record<string, string>) ?? {});
  // Conserver client_id/secret/tenant pour reconnexion ulterieure
  const keepFields = ["client_id", "client_secret", "tenant_id"] as const;
  const cleaned: Record<string, string> = {};
  for (const k of keepFields) {
    if (existingDecrypted[k]) cleaned[k] = existingDecrypted[k];
  }
  await prisma.integration.update({
    where: { provider: "microsoft_calendar" },
    data: { isEnabled: false, credentials: encryptCredentials(cleaned) as never, lastError: null },
  }).catch(() => null);
}

// ── Configuration OAuth de l'app (client_id/secret) configurée ? ──
export async function isMicrosoftAppConfigured(): Promise<boolean> {
  const integ = await prisma.integration.findUnique({
    where: { provider: "microsoft_calendar" },
    select: { credentials: true },
  });
  const creds = integ?.credentials ? decryptCredentials(integ.credentials as Record<string, string>) : {};
  return !!(creds.client_id || process.env.MICROSOFT_CLIENT_ID) && !!(creds.client_secret || process.env.MICROSOFT_CLIENT_SECRET);
}

// ── État de connexion (pour l'UI) ─────────────────────────
export async function getMicrosoftStatus(): Promise<{
  connected: boolean;
  accountEmail: string | null;
  expiresAt: Date | null;
}> {
  const integ = await prisma.integration.findUnique({
    where: { provider: "microsoft_calendar" },
    select: { credentials: true, isEnabled: true },
  });
  if (!integ?.isEnabled || !integ.credentials) {
    return { connected: false, accountEmail: null, expiresAt: null };
  }
  const creds = decryptCredentials(integ.credentials as Record<string, string>);
  return {
    connected: !!(creds.access_token && creds.refresh_token),
    accountEmail: creds.account_email || null,
    expiresAt: creds.expires_at ? new Date(creds.expires_at) : null,
  };
}
