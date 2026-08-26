// API · Diagnostics complet du portail.
// Vérifie : DB · variables d'environnement · intégrations · stockage · webhooks.
// Retourne un rapport JSON pour la page /admin/settings/diagnostics.
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { adminApiForbiddenAll } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

type CheckStatus = "ok" | "warn" | "error" | "skip";
type Check = {
  id: string;
  category: string;
  label: string;
  status: CheckStatus;
  message: string;
  detail?: string;
  ms?: number;
};

const ENV_VARS_REQUIRED = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
];
const ENV_VARS_OPTIONAL = [
  "CREDENTIALS_ENCRYPTION_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "SMTP_HOST",
  "DROPBOX_SIGN_API_KEY",
  "SLACK_WEBHOOK_URL",
  "MICROSOFT_CLIENT_ID",
  "GOOGLE_CLIENT_ID",
  "IPAPI_KEY",
];

async function timeOp<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - start };
}

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbiddenAll([["settings", "write"]])) {
    return forbiddenJson();
  }

  const checks: Check[] = [];

  // ── BASE DE DONNÉES ────────────────────────────────────
  try {
    const { ms } = await timeOp(() => prisma.$queryRaw`SELECT 1`);
    checks.push({
      id: "db_connect", category: "Base de données", label: "Connexion PostgreSQL",
      status: ms < 200 ? "ok" : ms < 1000 ? "warn" : "error",
      message: `Réponse en ${ms} ms`,
      ms,
    });
  } catch (e) {
    checks.push({
      id: "db_connect", category: "Base de données", label: "Connexion PostgreSQL",
      status: "error",
      message: "Échec de connexion",
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // Comptes
  try {
    const [admins, clients, sessions] = await Promise.all([
      prisma.admin.count(),
      prisma.client.count(),
      prisma.adminSession.count(),
    ]);
    checks.push({
      id: "db_counts", category: "Base de données", label: "Comptes",
      status: "ok",
      message: `${admins} admin${admins > 1 ? "s" : ""} · ${clients} client${clients > 1 ? "s" : ""} · ${sessions} session${sessions > 1 ? "s" : ""}`,
    });
  } catch {
    checks.push({
      id: "db_counts", category: "Base de données", label: "Comptes",
      status: "warn", message: "Lecture impossible",
    });
  }

  // RBAC
  try {
    const [roles, positions] = await Promise.all([
      prisma.role.count(),
      prisma.position.count(),
    ]);
    const status: CheckStatus = roles >= 7 && positions >= 6 ? "ok" : roles === 0 || positions === 0 ? "error" : "warn";
    checks.push({
      id: "rbac_seed", category: "Base de données", label: "RBAC seedé",
      status,
      message: `${roles} rôle${roles > 1 ? "s" : ""} · ${positions} poste${positions > 1 ? "s" : ""}`,
      detail: status !== "ok" ? "Lancer : npx tsx prisma/seed-rbac.ts" : undefined,
    });
  } catch {
    checks.push({
      id: "rbac_seed", category: "Base de données", label: "RBAC seedé",
      status: "error", message: "Tables non créées",
      detail: "Lancer : npx prisma db push && npx tsx prisma/seed-rbac.ts",
    });
  }

  // Catalogues
  try {
    const catalogCount = await prisma.catalogItem.count();
    checks.push({
      id: "catalogs_seed", category: "Base de données", label: "Catalogues seedés",
      status: catalogCount >= 40 ? "ok" : catalogCount > 0 ? "warn" : "error",
      message: `${catalogCount} items`,
      detail: catalogCount < 40 ? "Lancer : npx tsx prisma/seed-catalogs.ts" : undefined,
    });
  } catch {
    checks.push({
      id: "catalogs_seed", category: "Base de données", label: "Catalogues seedés",
      status: "error", message: "Table non créée",
    });
  }

  // ── VARIABLES D'ENVIRONNEMENT ──────────────────────────
  for (const v of ENV_VARS_REQUIRED) {
    const present = !!process.env[v];
    checks.push({
      id: `env_${v}`, category: "Variables d'environnement", label: v,
      status: present ? "ok" : "error",
      message: present ? "Définie" : "Manquante",
    });
  }
  for (const v of ENV_VARS_OPTIONAL) {
    const present = !!process.env[v];
    checks.push({
      id: `env_${v}`, category: "Variables d'environnement", label: v,
      status: present ? "ok" : "skip",
      message: present ? "Définie" : "Non définie (fonctionnalité optionnelle)",
    });
  }

  // ── INTÉGRATIONS ──────────────────────────────────────
  try {
    const integrations = await prisma.integration.findMany();
    if (integrations.length === 0) {
      checks.push({
        id: "integrations_none", category: "Intégrations", label: "Intégrations configurées",
        status: "skip", message: "Aucune intégration enregistrée",
      });
    } else {
      for (const i of integrations) {
        let status: CheckStatus = "skip";
        let msg = "Configurée";
        if (i.isEnabled) {
          if (i.lastError) {
            status = "error";
            msg = "Dernière synchro échouée";
          } else if (i.lastSyncAt) {
            status = "ok";
            msg = `Synchro OK le ${new Date(i.lastSyncAt).toLocaleDateString("fr-CA")}`;
          } else {
            status = "warn";
            msg = "Activée (jamais synchronisée)";
          }
        } else {
          status = "skip";
          msg = "Désactivée";
        }
        checks.push({
          id: `integration_${i.provider}`, category: "Intégrations", label: i.name || i.provider,
          status, message: msg,
          detail: i.lastError ?? undefined,
        });
      }
    }
  } catch {
    checks.push({
      id: "integrations_check", category: "Intégrations", label: "Lecture",
      status: "warn", message: "Table integrations introuvable",
    });
  }

  // ── STOCKAGE ───────────────────────────────────────────
  try {
    const settingsCount = await prisma.setting.count();
    const mediaCount = await prisma.setting.count({ where: { category: "cms_media" } });
    const mediaSize = await prisma.setting.aggregate({
      where: { category: "cms_media" },
      _sum: { id: true }, // pas idéal mais évite un raw query
    });

    // Approximation de la taille via une requête raw plus précise
    const sizeResult = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COALESCE(SUM(OCTET_LENGTH(value)), 0)::bigint AS total
      FROM settings
      WHERE value IS NOT NULL
    `;
    const totalBytes = Number(sizeResult[0]?.total ?? 0);
    const mb = (totalBytes / (1024 * 1024)).toFixed(2);

    checks.push({
      id: "storage_settings", category: "Stockage", label: "Paramètres & médias",
      status: totalBytes < 50 * 1024 * 1024 ? "ok" : totalBytes < 200 * 1024 * 1024 ? "warn" : "error",
      message: `${settingsCount} paramètres · ${mediaCount} médias · ${mb} Mo`,
      detail: totalBytes > 50 * 1024 * 1024 ? "Considérer un stockage S3/R2 pour les médias volumineux" : undefined,
    });
    // anti unused
    void mediaSize;
  } catch (e) {
    checks.push({
      id: "storage_settings", category: "Stockage", label: "Paramètres & médias",
      status: "warn", message: "Calcul impossible",
      detail: e instanceof Error ? e.message : undefined,
    });
  }

  // Sessions trop nombreuses ?
  try {
    const oldSessions = await prisma.adminSession.count({
      where: { expiresAt: { lt: new Date() } },
    });
    if (oldSessions > 0) {
      checks.push({
        id: "stale_sessions", category: "Stockage", label: "Sessions expirées",
        status: oldSessions > 100 ? "warn" : "ok",
        message: `${oldSessions} session${oldSessions > 1 ? "s" : ""} expirée${oldSessions > 1 ? "s" : ""}`,
        detail: oldSessions > 100 ? "Lancer un cron de nettoyage des sessions expirées" : undefined,
      });
    } else {
      checks.push({
        id: "stale_sessions", category: "Stockage", label: "Sessions expirées",
        status: "ok", message: "Aucune session expirée à purger",
      });
    }
  } catch {
    // skip
  }

  // ── CONFIGURATION CRITIQUE ─────────────────────────────
  try {
    const fiscalSettings = await prisma.setting.findMany({
      where: { category: "fiscal", key: { in: ["neq", "gst_number", "qst_number"] } },
    });
    const fiscalMap = Object.fromEntries(fiscalSettings.map((s) => [s.key, s.value]));
    const hasFiscal = !!(fiscalMap.neq && fiscalMap.gst_number && fiscalMap.qst_number);
    checks.push({
      id: "fiscal_config", category: "Configuration", label: "Identifiants fiscaux",
      status: hasFiscal ? "ok" : "warn",
      message: hasFiscal ? "NEQ, TPS et TVQ configurés" : "Identifiants fiscaux incomplets",
      detail: !hasFiscal ? "Compléter /admin/settings/finance" : undefined,
    });

    const rprpName = await prisma.setting.findUnique({ where: { category_key: { category: "legal", key: "rprp_name" } } });
    checks.push({
      id: "rprp_config", category: "Configuration", label: "RPRP (Loi 25)",
      status: rprpName?.value ? "ok" : "warn",
      message: rprpName?.value ? `Désigné : ${rprpName.value}` : "RPRP non désigné",
      detail: !rprpName?.value ? "Obligation Loi 25 — compléter /admin/settings/finance" : undefined,
    });

    const logoPrimary = await prisma.setting.findUnique({ where: { category_key: { category: "appearance", key: "logo_primary" } } });
    checks.push({
      id: "branding_logo", category: "Configuration", label: "Logo principal",
      status: logoPrimary?.value ? "ok" : "warn",
      message: logoPrimary?.value ? "Logo téléversé" : "Aucun logo principal",
      detail: !logoPrimary?.value ? "Téléverser dans /admin/settings/branding" : undefined,
    });
  } catch (e) {
    checks.push({
      id: "config_check", category: "Configuration", label: "Vérifications",
      status: "warn", message: "Lecture impossible",
      detail: e instanceof Error ? e.message : undefined,
    });
  }

  // ── RÉSUMÉ ─────────────────────────────────────────────
  const summary = {
    total: checks.length,
    ok: checks.filter((c) => c.status === "ok").length,
    warn: checks.filter((c) => c.status === "warn").length,
    error: checks.filter((c) => c.status === "error").length,
    skip: checks.filter((c) => c.status === "skip").length,
  };

  return NextResponse.json({
    runAt: new Date().toISOString(),
    summary,
    checks,
  });
}
