// ─────────────────────────────────────────────────────────
// Helper unifié pour vérifier les permissions de l'admin courant.
// Utilisable depuis n'importe quel server component ou server action.
// Côté client → utiliser le hook `usePermissions()` (src/hooks/use-permissions.ts).
// ─────────────────────────────────────────────────────────
import "server-only";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RESOURCES, type Resource, type Action, type PermissionsMatrix } from "@/lib/rbac";

export type CurrentAdminPermissions = {
  adminId: number;
  email: string;
  roleName: string | null; // nom du rôle custom (super_admin, accountant, ...)
  isSuperAdmin: boolean;
  matrix: PermissionsMatrix;
};

let cachedAdmin: { id: number; data: CurrentAdminPermissions; expires: number } | null = null;
const CACHE_TTL_MS = 5_000; // micro-cache pour éviter les hits répétés sur la même requête

export async function getCurrentAdminPermissions(): Promise<CurrentAdminPermissions | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const adminId = session.user.adminId!;

  // Micro-cache
  if (cachedAdmin && cachedAdmin.id === adminId && cachedAdmin.expires > Date.now()) {
    return cachedAdmin.data;
  }

  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { customRole: true },
  });
  if (!admin) return null;

  const roleName = admin.customRole?.name ?? null;
  const isSuperAdmin = roleName === "super_admin";
  const matrix = (admin.customRole?.permissions as PermissionsMatrix | undefined) ?? {};

  const data: CurrentAdminPermissions = {
    adminId, email: admin.email, roleName, isSuperAdmin, matrix,
  };
  cachedAdmin = { id: adminId, data, expires: Date.now() + CACHE_TTL_MS };
  return data;
}

export function canAct(perms: CurrentAdminPermissions | null, resource: Resource, action: Action): boolean {
  if (!perms) return false;
  if (perms.isSuperAdmin) return true;
  return (perms.matrix[resource] ?? []).includes(action);
}

// Helper combiné : auth + check en une étape, throw si pas autorisé.
// À utiliser dans les server actions critiques.
export async function requirePermission(resource: Resource, action: Action): Promise<{ adminId: number }> {
  const perms = await getCurrentAdminPermissions();
  if (!perms) throw new Error("Non autorisé");
  if (!canAct(perms, resource, action)) {
    throw new Error(`Permission refusée : ${resource}:${action}`);
  }
  return { adminId: perms.adminId };
}

// Accès à la ZONE Réglages (hub + sidebar) : settings.write complet, OU
// n'importe quelle ressource de la famille configuration en écriture
// (informaticien : portail client, site web, intégrations, contenu...).
// Chaque sous-page garde ensuite son propre garde plus précis.
const SETTINGS_AREA_RESOURCES: Resource[] = [
  "settings", "integrations", "automations", "branding",
  "blog", "pages", "email_templates", "pdf_templates",
  "client_portal", "website",
];
export function canAccessSettingsArea(perms: CurrentAdminPermissions | null): boolean {
  if (!perms) return false;
  if (perms.isSuperAdmin) return true;
  return SETTINGS_AREA_RESOURCES.some((r) => canAct(perms, r, "write"));
}

// Pour les routes API : refuse si la session est un ADMIN sans la
// permission demandée. Les sessions client ne sont pas concernées (retourne
// false — leurs propres checks s'appliquent). super_admin passe toujours.
export async function adminApiForbidden(resource: Resource, action: Action): Promise<boolean> {
  const perms = await getCurrentAdminPermissions();
  if (!perms) return false; // pas une session admin
  return !canAct(perms, resource, action);
}

// Variante multi-ressources : refuse si l'admin n'a AUCUNE des permissions
// listées (utile quand plusieurs ressources donnent légitimement accès,
// ex. branding : settings OU branding OU website OU client_portal).
export async function adminApiForbiddenAll(
  pairs: Array<[Resource, Action]>,
): Promise<boolean> {
  const perms = await getCurrentAdminPermissions();
  if (!perms) return false;
  return !pairs.some(([r, a]) => canAct(perms, r, a));
}

// Helper pour lister toutes les ressources accessibles en lecture
// (utile pour construire la nav latérale dynamiquement).
export function readableResources(perms: CurrentAdminPermissions | null): Resource[] {
  if (!perms) return [];
  if (perms.isSuperAdmin) return [...RESOURCES] as Resource[];
  return RESOURCES.filter((r) => (perms.matrix[r] ?? []).includes("read")) as Resource[];
}
