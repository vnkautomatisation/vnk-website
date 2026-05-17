// Auth pour endpoints SCIM 2.0 — bearer token statique défini en env.
// Le token doit être communiqué à l'IdP (Azure AD / Okta / etc.) côté SCIM provisioning.
// Pas de "server-only" : pure utilité (string compare) — utilisable en tests.

export function checkScimAuth(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  const expected = process.env.SCIM_BEARER_TOKEN;
  if (!expected) {
    return { ok: false, status: 500, error: "SCIM_BEARER_TOKEN non configuré" };
  }
  const header = req.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Bearer token manquant" };
  }
  const provided = header.slice(7);
  // Comparaison timing-safe
  if (provided.length !== expected.length) {
    return { ok: false, status: 401, error: "Token invalide" };
  }
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) {
    return { ok: false, status: 401, error: "Token invalide" };
  }
  return { ok: true };
}

// Conversion Admin → SCIM 2.0 User
export type ScimUser = {
  schemas: string[];
  id: string;
  externalId?: string;
  userName: string;
  name?: { formatted?: string; givenName?: string; familyName?: string };
  displayName?: string;
  emails: Array<{ value: string; primary?: boolean }>;
  active: boolean;
  meta: {
    resourceType: "User";
    created?: string;
    lastModified?: string;
    location?: string;
  };
};

type AdminLike = {
  id: number;
  email: string;
  fullName: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function adminToScim(a: AdminLike, baseUrl: string): ScimUser {
  const parts = (a.fullName ?? "").trim().split(/\s+/);
  const givenName = parts[0] || undefined;
  const familyName = parts.length > 1 ? parts.slice(1).join(" ") : undefined;
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: String(a.id),
    userName: a.email,
    name: {
      formatted: a.fullName ?? a.email,
      givenName,
      familyName,
    },
    displayName: a.fullName ?? a.email,
    emails: [{ value: a.email, primary: true }],
    active: a.isActive,
    meta: {
      resourceType: "User",
      created: a.createdAt.toISOString(),
      lastModified: a.updatedAt.toISOString(),
      location: `${baseUrl}/api/scim/v2/Users/${a.id}`,
    },
  };
}
