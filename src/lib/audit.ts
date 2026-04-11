// Audit log helper — enregistre toutes les actions admin pour traçabilité
import "server-only";
import { prisma } from "./prisma";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "export"
  | "settings_update"
  | "impersonate"
  | "password_reset"
  | "role_change";

export async function logAudit(params: {
  adminId?: number | null;
  action: AuditAction;
  entityType: string;
  entityId?: number | null;
  changes?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: params.adminId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        changes: (params.changes as object) ?? null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  } catch (err) {
    // Ne jamais bloquer une action admin à cause d'un log qui échoue
    console.error("[audit] failed to log:", err);
  }
}
