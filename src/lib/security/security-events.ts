// ============================================================
// Security events feed — emission + lecture
// Centralise tous les events securite admin pour l'onglet
// "Activite" enrichi (timeline avec severite + icones).
// ============================================================

import { prisma } from "@/lib/prisma";
import { getRequestGeo } from "./geo";
import { dispatchWebhook, shouldDispatchForType } from "./webhook-dispatcher";

export type SecurityEventType =
  | "login_success"
  | "login_failed"
  | "password_changed"
  | "password_breach_detected"
  | "two_factor_enabled"
  | "two_factor_disabled"
  | "backup_codes_regenerated"
  | "backup_code_used"
  | "session_revoked"
  | "all_sessions_revoked"
  | "trusted_device_added"
  | "trusted_device_removed"
  | "api_token_created"
  | "api_token_revoked"
  | "data_export_requested"
  | "data_export_ready"
  | "account_deletion_requested"
  | "suspicious_login"
  | "passkey_added"
  | "passkey_removed"
  | "profile_updated"
  | "preferences_updated"
  | "notification_prefs_updated"
  | "user_created"
  | "user_updated"
  | "user_deactivated"
  | "user_deleted"
  | "role_created"
  | "role_updated"
  | "role_deleted"
  | "position_created"
  | "position_updated"
  | "position_deleted"
  | "consent_granted";

export type SecurityEventSeverity = "info" | "success" | "warning" | "critical";

export async function logSecurityEvent(params: {
  adminId: number;
  type: SecurityEventType;
  severity?: SecurityEventSeverity;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const geo = await getRequestGeo().catch(() => ({ ip: null, country: null, city: null }));
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const userAgent = h.get("user-agent");

    const severity = params.severity ?? defaultSeverity(params.type);
    await prisma.adminSecurityEvent.create({
      data: {
        adminId: params.adminId,
        type: params.type,
        severity,
        message: params.message,
        metadata: (params.metadata ?? {}) as never,
        ipAddress: geo.ip,
        userAgent,
        country: geo.country,
        city: geo.city,
      },
    });

    // ─── Notification intra-portail (cloche admin) pour events sur SON propre compte ───
    // Tout event qui concerne le compte ciblé est aussi déposé dans Notification.
    if (severity === "warning" || severity === "critical" || severity === "success") {
      const isAccountEvent = NOTIFY_INTRA_TYPES.has(params.type);
      if (isAccountEvent) {
        try {
          await prisma.notification.create({
            data: {
              recipientType: "admin",
              recipientId: params.adminId,
              type: severity === "critical" ? "error" : severity === "warning" ? "warning" : severity,
              title: notifTitleFor(params.type),
              body: params.message,
              icon: notifIconFor(params.type),
              link: "/admin/settings/security/activity",
            },
          });
        } catch (err) {
          console.error("[security-event] notification insert failed", err);
        }
      }
    }

    // ─── Webhook (Slack / Teams) pour events critiques uniquement ───
    if (shouldDispatchForType(params.type, severity)) {
      const fields: Array<{ label: string; value: string }> = [
        { label: "Type", value: params.type },
        { label: "Sévérité", value: severity },
      ];
      if (geo.country) fields.push({ label: "Pays", value: `${geo.city ? `${geo.city}, ` : ""}${geo.country}` });
      if (geo.ip) fields.push({ label: "IP", value: geo.ip });
      const baseUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || "https://vnkautomatisation.ca";
      // Non bloquant : fire-and-forget
      dispatchWebhook({
        level: severity === "critical" ? "critical" : "warning",
        title: `[VNK · Sécurité] ${params.message}`,
        message: params.message,
        fields,
        link: `${baseUrl.replace(/\/$/, "")}/admin/settings/security/activity`,
      }).catch(() => null);
    }
  } catch (err) {
    // Ne jamais bloquer l'action utilisateur si le log echoue
    console.error("[security-event] insert failed", err);
  }
}

function defaultSeverity(type: SecurityEventType): SecurityEventSeverity {
  if (type === "login_failed" || type === "suspicious_login" || type === "password_breach_detected") return "critical";
  if (type === "two_factor_disabled" || type === "trusted_device_added" || type === "api_token_created") return "warning";
  if (type === "login_success" || type === "two_factor_enabled" || type === "password_changed" || type === "backup_codes_regenerated") return "success";
  return "info";
}

// Types qui méritent une notification visible dans la cloche admin
const NOTIFY_INTRA_TYPES = new Set<string>([
  "password_changed",
  "two_factor_enabled",
  "two_factor_disabled",
  "trusted_device_added",
  "trusted_device_removed",
  "api_token_created",
  "api_token_revoked",
  "session_revoked",
  "all_sessions_revoked",
  "passkey_added",
  "passkey_removed",
  "suspicious_login",
  "password_breach_detected",
  "data_export_requested",
  "consent_granted",
]);

function notifTitleFor(type: string): string {
  switch (type) {
    case "password_changed": return "Mot de passe modifié";
    case "two_factor_enabled": return "2FA activée";
    case "two_factor_disabled": return "2FA désactivée";
    case "trusted_device_added": return "Nouvel appareil de confiance";
    case "trusted_device_removed": return "Appareil retiré";
    case "api_token_created": return "Nouveau jeton API créé";
    case "api_token_revoked": return "Jeton API révoqué";
    case "session_revoked": return "Session fermée";
    case "all_sessions_revoked": return "Toutes les sessions ont été fermées";
    case "passkey_added": return "Nouvelle passkey ajoutée";
    case "passkey_removed": return "Passkey retirée";
    case "suspicious_login": return "Connexion suspecte détectée";
    case "password_breach_detected": return "Mot de passe compromis détecté";
    case "data_export_requested": return "Export de données déclenché";
    case "consent_granted": return "Politiques acceptées";
    default: return "Événement de sécurité";
  }
}

function notifIconFor(type: string): string {
  if (type === "suspicious_login" || type === "password_breach_detected") return "alert-triangle";
  if (type.startsWith("two_factor")) return "shield";
  if (type === "password_changed") return "key";
  if (type.startsWith("api_token")) return "code";
  if (type.startsWith("passkey")) return "fingerprint";
  if (type.startsWith("trusted_device")) return "monitor";
  if (type === "data_export_requested") return "download";
  return "bell";
}
