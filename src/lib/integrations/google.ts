// ─────────────────────────────────────────────────────────
// Intégration Google (Calendar + Meet)
// OAuth2 Authorization Code Flow + Google Calendar API v3.
//
// Configuration côté Google Cloud Console :
// - Projet "VNK Portal"
// - OAuth Client ID (type Web Application)
// - Redirect URI : https://<domain>/api/oauth/google/callback
// - Scopes : calendar, calendar.events
//
// Variables d'environnement (.env.local) :
// - GOOGLE_CLIENT_ID
// - GOOGLE_CLIENT_SECRET
// - GOOGLE_REDIRECT_URI
// ─────────────────────────────────────────────────────────
import "server-only";
import { prisma } from "@/lib/prisma";
import { encryptCredentials, decryptCredentials } from "@/lib/security/crypto";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

export function getGoogleRedirectUri(origin?: string): string {
  const base = origin
    ?? process.env.GOOGLE_REDIRECT_URI
    ?? process.env.NEXTAUTH_URL
    ?? process.env.AUTH_URL
    ?? "http://localhost:3000";
  if (base.includes("/api/oauth/google/callback")) return base;
  return `${base.replace(/\/$/, "")}/api/oauth/google/callback`;
}

async function getAppConfig(origin?: string): Promise<{ clientId: string; clientSecret: string; redirectUri: string }> {
  const integ = await prisma.integration.findUnique({
    where: { provider: "google_calendar" },
    select: { credentials: true },
  });
  const creds = integ?.credentials ? decryptCredentials(integ.credentials as Record<string, string>) : {};

  const clientId = creds.client_id || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = creds.client_secret || process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = getGoogleRedirectUri(origin);

  if (!clientId || !clientSecret) {
    throw new Error("Identifiants OAuth Google manquants. Renseignez-les dans Profil > Intégrations.");
  }
  return { clientId, clientSecret, redirectUri };
}

export async function buildAuthorizeUrl(state: string, origin?: string): Promise<string> {
  const { clientId, redirectUri } = await getAppConfig(origin);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES.join(" "),
    state,
    access_type: "offline",
    prompt: "consent", // force refresh_token
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
};

export async function exchangeCodeForTokens(code: string, origin?: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = await getAppConfig(origin);
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Échange token Google échoué : ${await res.text()}`);
  }
  return res.json();
}

async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = await getAppConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Refresh token Google échoué : ${await res.text()}`);
  }
  return res.json();
}

export async function storeGoogleTokens(tokens: TokenResponse, accountEmail?: string) {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  // Récupère l'existant pour conserver le refresh_token si Google n'en renvoie pas un nouveau
  const existing = await prisma.integration.findUnique({ where: { provider: "google_calendar" } });
  const existingCreds = existing?.credentials
    ? decryptCredentials(existing.credentials as Record<string, string>)
    : {};

  const creds = encryptCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? existingCreds.refresh_token ?? "",
    expires_at: expiresAt,
    account_email: accountEmail ?? existingCreds.account_email ?? "",
  });

  await prisma.integration.upsert({
    where: { provider: "google_calendar" },
    create: {
      provider: "google_calendar",
      name: "Google Calendar",
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

export async function getValidAccessToken(): Promise<string | null> {
  const integ = await prisma.integration.findUnique({
    where: { provider: "google_calendar" },
    select: { credentials: true, isEnabled: true },
  });
  if (!integ?.isEnabled || !integ.credentials) return null;

  const creds = decryptCredentials(integ.credentials as Record<string, string>);
  if (!creds.access_token || !creds.refresh_token) return null;

  const expiresAt = creds.expires_at ? new Date(creds.expires_at).getTime() : 0;
  if (Date.now() + 60_000 < expiresAt) {
    return creds.access_token;
  }

  try {
    const refreshed = await refreshTokens(creds.refresh_token);
    await storeGoogleTokens(refreshed, creds.account_email);
    return refreshed.access_token;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur refresh";
    await prisma.integration.update({
      where: { provider: "google_calendar" },
      data: { lastError: msg.slice(0, 500) },
    }).catch(() => null);
    return null;
  }
}

// ── Création d'un évènement Google Calendar avec Meet auto ──
export type GoogleEventInput = {
  subject: string;
  body?: string;
  startISO: string;       // ISO 8601 avec offset (ex: 2024-05-16T14:00:00-04:00)
  endISO: string;
  timezone: string;
  attendees: { email: string; name?: string }[];
  withMeet?: boolean;
};

export type GoogleEventResult = {
  eventId: string;
  joinUrl: string | null;
  htmlLink: string | null;
};

export async function createGoogleEvent(input: GoogleEventInput): Promise<GoogleEventResult> {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Google non connecté");

  const payload: Record<string, unknown> = {
    summary: input.subject,
    description: input.body ?? "",
    start: { dateTime: input.startISO, timeZone: input.timezone },
    end: { dateTime: input.endISO, timeZone: input.timezone },
    attendees: input.attendees.map((a) => ({ email: a.email, displayName: a.name })),
    reminders: { useDefault: true },
  };

  if (input.withMeet !== false) {
    payload.conferenceData = {
      createRequest: {
        requestId: `vnk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    throw new Error(`Création évènement Google échouée : ${await res.text()}`);
  }
  const data = await res.json();

  // Trouver le lien Meet dans entryPoints
  let joinUrl: string | null = null;
  const entries = data.conferenceData?.entryPoints as Array<{ entryPointType: string; uri: string }> | undefined;
  if (entries) {
    const video = entries.find((e) => e.entryPointType === "video");
    joinUrl = video?.uri ?? null;
  }
  // Fallback hangoutLink
  if (!joinUrl) joinUrl = data.hangoutLink ?? null;

  return {
    eventId: data.id,
    joinUrl,
    htmlLink: data.htmlLink ?? null,
  };
}

export async function updateGoogleEvent(
  eventId: string,
  patch: Partial<GoogleEventInput>
): Promise<boolean> {
  const token = await getValidAccessToken();
  if (!token) return false;

  const payload: Record<string, unknown> = {};
  if (patch.subject) payload.summary = patch.subject;
  if (patch.body !== undefined) payload.description = patch.body;
  if (patch.startISO && patch.timezone) {
    payload.start = { dateTime: patch.startISO, timeZone: patch.timezone };
  }
  if (patch.endISO && patch.timezone) {
    payload.end = { dateTime: patch.endISO, timeZone: patch.timezone };
  }
  if (patch.attendees) {
    payload.attendees = patch.attendees.map((a) => ({ email: a.email, displayName: a.name }));
  }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
  return res.ok;
}

export async function deleteGoogleEvent(eventId: string): Promise<boolean> {
  const token = await getValidAccessToken();
  if (!token) return false;
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
  return res.ok || res.status === 404 || res.status === 410;
}

export async function disconnectGoogle(): Promise<void> {
  const existing = await prisma.integration.findUnique({ where: { provider: "google_calendar" } });
  if (!existing) return;
  const existingDecrypted = decryptCredentials((existing.credentials as Record<string, string>) ?? {});
  const keepFields = ["client_id", "client_secret"] as const;
  const cleaned: Record<string, string> = {};
  for (const k of keepFields) {
    if (existingDecrypted[k]) cleaned[k] = existingDecrypted[k];
  }
  await prisma.integration.update({
    where: { provider: "google_calendar" },
    data: { isEnabled: false, credentials: encryptCredentials(cleaned) as never, lastError: null },
  }).catch(() => null);
}

export async function isGoogleAppConfigured(): Promise<boolean> {
  const integ = await prisma.integration.findUnique({
    where: { provider: "google_calendar" },
    select: { credentials: true },
  });
  const creds = integ?.credentials ? decryptCredentials(integ.credentials as Record<string, string>) : {};
  return !!(creds.client_id || process.env.GOOGLE_CLIENT_ID) && !!(creds.client_secret || process.env.GOOGLE_CLIENT_SECRET);
}

export async function getGoogleStatus(): Promise<{
  connected: boolean;
  accountEmail: string | null;
  expiresAt: Date | null;
}> {
  const integ = await prisma.integration.findUnique({
    where: { provider: "google_calendar" },
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
