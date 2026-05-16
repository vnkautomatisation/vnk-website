// ============================================================
// Security events feed — emission + lecture
// Centralise tous les events securite admin pour l'onglet
// "Activite" enrichi (timeline avec severite + icones).
// ============================================================

import { prisma } from "@/lib/prisma";
import { getRequestGeo } from "./geo";

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
  | "position_deleted";

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

    await prisma.adminSecurityEvent.create({
      data: {
        adminId: params.adminId,
        type: params.type,
        severity: params.severity ?? defaultSeverity(params.type),
        message: params.message,
        metadata: (params.metadata ?? {}) as never,
        ipAddress: geo.ip,
        userAgent,
        country: geo.country,
        city: geo.city,
      },
    });
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
