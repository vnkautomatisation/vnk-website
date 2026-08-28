// API · Diagnostics complet du portail.
// Vérifie : DB · variables d'environnement · intégrations · stockage · webhooks.
// Retourne un rapport JSON pour la page /admin/settings/diagnostics.
import { NextResponse } from "next/server";
import { getTranslations, getLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { adminApiForbiddenAll } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";
import { dateLocale } from "@/lib/i18n-format";

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

  const t = await getTranslations("settings");
  const dateTag = dateLocale(await getLocale());
  const checks: Check[] = [];

  // ── BASE DE DONNÉES ────────────────────────────────────
  try {
    const { ms } = await timeOp(() => prisma.$queryRaw`SELECT 1`);
    checks.push({
      id: "db_connect", category: t("diag_cat_base_de_donnees"), label: t("diag_lbl_connexion_postgresql"),
      status: ms < 200 ? "ok" : ms < 1000 ? "warn" : "error",
      message: t("diag_msg_reponse_ms", { ms }),
      ms,
    });
  } catch (e) {
    checks.push({
      id: "db_connect", category: t("diag_cat_base_de_donnees"), label: t("diag_lbl_connexion_postgresql"),
      status: "error",
      message: t("diag_msg_echec_de_connexion"),
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
      id: "db_counts", category: t("diag_cat_base_de_donnees"), label: t("diag_lbl_comptes"),
      status: "ok",
      message: t("diag_msg_comptes", { admins, clients, sessions }),
    });
  } catch {
    checks.push({
      id: "db_counts", category: t("diag_cat_base_de_donnees"), label: t("diag_lbl_comptes"),
      status: "warn", message: t("diag_msg_lecture_impossible"),
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
      id: "rbac_seed", category: t("diag_cat_base_de_donnees"), label: t("diag_lbl_rbac_seede"),
      status,
      message: t("diag_msg_rbac", { roles, positions }),
      detail: status !== "ok" ? "Lancer : npx tsx prisma/seed-rbac.ts" : undefined,
    });
  } catch {
    checks.push({
      id: "rbac_seed", category: t("diag_cat_base_de_donnees"), label: t("diag_lbl_rbac_seede"),
      status: "error", message: t("diag_msg_tables_non_creees"),
      detail: "Lancer : npx prisma db push && npx tsx prisma/seed-rbac.ts",
    });
  }

  // Catalogues
  try {
    const catalogCount = await prisma.catalogItem.count();
    checks.push({
      id: "catalogs_seed", category: t("diag_cat_base_de_donnees"), label: t("diag_lbl_catalogues_seedes"),
      status: catalogCount >= 40 ? "ok" : catalogCount > 0 ? "warn" : "error",
      message: t("diag_msg_items", { count: catalogCount }),
      detail: catalogCount < 40 ? "Lancer : npx tsx prisma/seed-catalogs.ts" : undefined,
    });
  } catch {
    checks.push({
      id: "catalogs_seed", category: t("diag_cat_base_de_donnees"), label: t("diag_lbl_catalogues_seedes"),
      status: "error", message: t("diag_msg_table_non_creee"),
    });
  }

  // ── VARIABLES D'ENVIRONNEMENT ──────────────────────────
  for (const v of ENV_VARS_REQUIRED) {
    const present = !!process.env[v];
    checks.push({
      id: `env_${v}`, category: t("diag_cat_variables_d_environnement"), label: v,
      status: present ? "ok" : "error",
      message: present ? t("diag_definie") : t("diag_manquante"),
    });
  }
  for (const v of ENV_VARS_OPTIONAL) {
    const present = !!process.env[v];
    checks.push({
      id: `env_${v}`, category: t("diag_cat_variables_d_environnement"), label: v,
      status: present ? "ok" : "skip",
      message: present ? t("diag_definie") : t("diag_non_definie_optionnelle"),
    });
  }

  // ── INTÉGRATIONS ──────────────────────────────────────
  try {
    const integrations = await prisma.integration.findMany();
    if (integrations.length === 0) {
      checks.push({
        id: "integrations_none", category: t("diag_cat_integrations"), label: t("diag_lbl_integrations_configurees"),
        status: "skip", message: t("diag_msg_aucune_integration_enregistree"),
      });
    } else {
      for (const i of integrations) {
        let status: CheckStatus = "skip";
        let msg = t("diag_configuree");
        if (i.isEnabled) {
          if (i.lastError) {
            status = "error";
            msg = t("diag_derniere_synchro_echouee");
          } else if (i.lastSyncAt) {
            status = "ok";
            msg = t("route_synchro_ok_le_p0", { p0: new Date(i.lastSyncAt).toLocaleDateString(dateTag) });
          } else {
            status = "warn";
            msg = t("diag_activee_jamais_synchronisee");
          }
        } else {
          status = "skip";
          msg = t("diag_desactivee");
        }
        checks.push({
          id: `integration_${i.provider}`, category: t("diag_cat_integrations"), label: i.name || i.provider,
          status, message: msg,
          detail: i.lastError ?? undefined,
        });
      }
    }
  } catch {
    checks.push({
      id: "integrations_check", category: t("diag_cat_integrations"), label: t("diag_lbl_lecture"),
      status: "warn", message: t("diag_msg_table_integrations_introuvable"),
    });
  }

  // ── STOCKAGE ───────────────────────────────────────────
  try {
    const settingsCount = await prisma.setting.count();
    const mediaCount = await prisma.setting.count({ where: { category: t("diag_cat_cms_media") } });
    const mediaSize = await prisma.setting.aggregate({
      where: { category: t("diag_cat_cms_media") },
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
      id: "storage_settings", category: t("diag_cat_stockage"), label: t("diag_lbl_parametres_medias"),
      status: totalBytes < 50 * 1024 * 1024 ? "ok" : totalBytes < 200 * 1024 * 1024 ? "warn" : "error",
      message: t("diag_msg_stockage", { settings: settingsCount, media: mediaCount, mb }),
      detail: totalBytes > 50 * 1024 * 1024 ? t("diag_considerer_s3") : undefined,
    });
    // anti unused
    void mediaSize;
  } catch (e) {
    checks.push({
      id: "storage_settings", category: t("diag_cat_stockage"), label: t("diag_lbl_parametres_medias"),
      status: "warn", message: t("diag_msg_calcul_impossible"),
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
        id: "stale_sessions", category: t("diag_cat_stockage"), label: t("diag_lbl_sessions_expirees"),
        status: oldSessions > 100 ? "warn" : "ok",
        message: t("diag_msg_sessions_expirees", { count: oldSessions }),
        detail: oldSessions > 100 ? t("diag_cron_sessions") : undefined,
      });
    } else {
      checks.push({
        id: "stale_sessions", category: t("diag_cat_stockage"), label: t("diag_lbl_sessions_expirees"),
        status: "ok", message: t("diag_msg_aucune_session_expiree_a_purger"),
      });
    }
  } catch {
    // skip
  }

  // ── CONFIGURATION CRITIQUE ─────────────────────────────
  try {
    const fiscalSettings = await prisma.setting.findMany({
      where: { category: t("diag_cat_fiscal"), key: { in: ["neq", "gst_number", "qst_number"] } },
    });
    const fiscalMap = Object.fromEntries(fiscalSettings.map((s) => [s.key, s.value]));
    const hasFiscal = !!(fiscalMap.neq && fiscalMap.gst_number && fiscalMap.qst_number);
    checks.push({
      id: "fiscal_config", category: t("diag_cat_configuration"), label: t("diag_lbl_identifiants_fiscaux"),
      status: hasFiscal ? "ok" : "warn",
      message: hasFiscal ? t("diag_fiscal_ok") : t("diag_fiscal_incomplet"),
      detail: !hasFiscal ? t("diag_completer_finance") : undefined,
    });

    const rprpName = await prisma.setting.findUnique({ where: { category_key: { category: t("diag_cat_legal"), key: "rprp_name" } } });
    checks.push({
      id: "rprp_config", category: t("diag_cat_configuration"), label: t("diag_lbl_rprp_loi_25"),
      status: rprpName?.value ? "ok" : "warn",
      message: rprpName?.value ? t("diag_designe", { name: rprpName.value }) : t("diag_rprp_non_designe"),
      detail: !rprpName?.value ? t("diag_loi25_completer") : undefined,
    });

    const logoPrimary = await prisma.setting.findUnique({ where: { category_key: { category: t("diag_cat_appearance"), key: "logo_primary" } } });
    checks.push({
      id: "branding_logo", category: t("diag_cat_configuration"), label: t("diag_lbl_logo_principal"),
      status: logoPrimary?.value ? "ok" : "warn",
      message: logoPrimary?.value ? t("diag_logo_televerse") : t("diag_aucun_logo"),
      detail: !logoPrimary?.value ? t("diag_televerser_branding") : undefined,
    });
  } catch (e) {
    checks.push({
      id: "config_check", category: t("diag_cat_configuration"), label: t("diag_lbl_verifications"),
      status: "warn", message: t("diag_msg_lecture_impossible"),
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
