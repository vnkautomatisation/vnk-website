// ─────────────────────────────────────────────────────────
// Traductions humaines pour les actions d'audit et les
// événements de sécurité. Évite "Modification tax_declarations #31"
// au profit de "Déclaration fiscale modifiée".
// ─────────────────────────────────────────────────────────

// Action verbs (créer/modifier/...)
export const ACTION_LABELS: Record<string, string> = {
  create: "action_create",
  update: "action_update",
  delete: "action_delete",
  login: "action_login",
  logout: "action_logout",
  export: "action_export",
  view: "action_view",
  settings_update: "action_settings_update",
  password_reset: "action_password_reset",
  role_change: "action_role_change",
  impersonate: "action_impersonate",

};

// Verbes au passé pour phrases naturelles
export const ACTION_VERBS: Record<string, string> = {
  create: "verb_create",
  update: "verb_update",
  delete: "verb_delete",
  login: "verb_login",
  logout: "verb_logout",
  export: "verb_export",
  view: "verb_view",
  settings_update: "verb_settings_update",
  password_reset: "verb_password_reset",
  role_change: "verb_role_change",
  impersonate: "verb_impersonate",

};

// Type d'entité → libellé humain
export const ENTITY_LABELS: Record<string, { key: string; pluralKey: string; article: "le" | "la" | "l'" }> = {
  admin: { key: "ent_admin", pluralKey: "ent_admin_plural", article: "l'" },
  admin_bulk: { key: "ent_admin_bulk", pluralKey: "ent_admin_bulk_plural", article: "le" },
  admin_invitation: { key: "ent_admin_invitation", pluralKey: "ent_admin_invitation_plural", article: "l'" },
  admin_anonymized: { key: "ent_admin_anonymized", pluralKey: "ent_admin_anonymized_plural", article: "le" },
  admin_data_export: { key: "ent_admin_data_export", pluralKey: "ent_admin_data_export_plural", article: "l'" },
  admin_onboarding: { key: "ent_admin_onboarding", pluralKey: "ent_admin_onboarding_plural", article: "l'" },
  role: { key: "ent_role", pluralKey: "ent_role_plural", article: "le" },
  role_reorder: { key: "ent_role_reorder", pluralKey: "ent_role_reorder_plural", article: "l'" },
  position: { key: "ent_position", pluralKey: "ent_position_plural", article: "le" },
  position_reorder: { key: "ent_position_reorder", pluralKey: "ent_position_reorder_plural", article: "l'" },
  client: { key: "ent_client", pluralKey: "ent_client_plural", article: "le" },
  clients: { key: "ent_clients", pluralKey: "ent_clients_plural", article: "le" },
  quote: { key: "ent_quote", pluralKey: "ent_quote_plural", article: "le" },
  quotes: { key: "ent_quotes", pluralKey: "ent_quotes_plural", article: "le" },
  invoice: { key: "ent_invoice", pluralKey: "ent_invoice_plural", article: "la" },
  invoices: { key: "ent_invoices", pluralKey: "ent_invoices_plural", article: "la" },
  contract: { key: "ent_contract", pluralKey: "ent_contract_plural", article: "le" },
  contracts: { key: "ent_contracts", pluralKey: "ent_contracts_plural", article: "le" },
  mandate: { key: "ent_mandate", pluralKey: "ent_mandate_plural", article: "le" },
  mandates: { key: "ent_mandates", pluralKey: "ent_mandates_plural", article: "le" },
  payment: { key: "ent_payment", pluralKey: "ent_payment_plural", article: "le" },
  payments: { key: "ent_payments", pluralKey: "ent_payments_plural", article: "le" },
  refund: { key: "ent_refund", pluralKey: "ent_refund_plural", article: "le" },
  refunds: { key: "ent_refunds", pluralKey: "ent_refunds_plural", article: "le" },
  dispute: { key: "ent_dispute", pluralKey: "ent_dispute_plural", article: "le" },
  expense: { key: "ent_expense", pluralKey: "ent_expense_plural", article: "la" },
  expenses: { key: "ent_expenses", pluralKey: "ent_expenses_plural", article: "la" },
  tax_declaration: { key: "ent_tax_declaration", pluralKey: "ent_tax_declaration_plural", article: "la" },
  tax_declarations: { key: "ent_tax_declarations", pluralKey: "ent_tax_declarations_plural", article: "la" },
  document: { key: "ent_document", pluralKey: "ent_document_plural", article: "le" },
  documents: { key: "ent_documents", pluralKey: "ent_documents_plural", article: "le" },
  message: { key: "ent_message", pluralKey: "ent_message_plural", article: "le" },
  appointment: { key: "ent_appointment", pluralKey: "ent_appointment_plural", article: "le" },
  settings: { key: "ent_settings", pluralKey: "ent_settings_plural", article: "le" },
  security_policy: { key: "ent_security_policy", pluralKey: "ent_security_policy_plural", article: "la" },
  branding: { key: "ent_branding", pluralKey: "ent_branding_plural", article: "la" },
  config_export: { key: "ent_config_export", pluralKey: "ent_config_export_plural", article: "l'" },
  config_import: { key: "ent_config_import", pluralKey: "ent_config_import_plural", article: "l'" },
  catalog_item: { key: "ent_catalog_item", pluralKey: "ent_catalog_item_plural", article: "l'" },
  service_catalog: { key: "ent_service_catalog", pluralKey: "ent_service_catalog_plural", article: "le" },
  discount_code: { key: "ent_discount_code", pluralKey: "ent_discount_code_plural", article: "le" },
  blog_post: { key: "ent_blog_post", pluralKey: "ent_blog_post_plural", article: "l'" },
  faq_item: { key: "ent_faq_item", pluralKey: "ent_faq_item_plural", article: "la" },
  testimonial: { key: "ent_testimonial", pluralKey: "ent_testimonial_plural", article: "le" },
  email_template: { key: "ent_email_template", pluralKey: "ent_email_template_plural", article: "le" },
  pdf_template: { key: "ent_pdf_template", pluralKey: "ent_pdf_template_plural", article: "le" },
  outgoing_webhook: { key: "ent_outgoing_webhook", pluralKey: "ent_outgoing_webhook_plural", article: "le" },
  incoming_webhook_log: { key: "ent_incoming_webhook_log", pluralKey: "ent_incoming_webhook_log_plural", article: "le" },
  api_token: { key: "ent_api_token", pluralKey: "ent_api_token_plural", article: "le" },
  maintenance_window: { key: "ent_maintenance_window", pluralKey: "ent_maintenance_window_plural", article: "la" },
  incident_report: { key: "ent_incident_report", pluralKey: "ent_incident_report_plural", article: "l'" },
  announcement_banner: { key: "ent_announcement_banner", pluralKey: "ent_announcement_banner_plural", article: "le" },
  force_logout_all: { key: "ent_force_logout_all", pluralKey: "ent_force_logout_all_plural", article: "la" },
  admin_locked: { key: "ent_admin_locked", pluralKey: "ent_admin_locked_plural", article: "le" },
  admin_unlocked: { key: "ent_admin_unlocked", pluralKey: "ent_admin_unlocked_plural", article: "le" },
  demo_mode_enabled: { key: "ent_demo_mode_enabled", pluralKey: "ent_demo_mode_enabled_plural", article: "le" },
  demo_mode_disabled: { key: "ent_demo_mode_disabled", pluralKey: "ent_demo_mode_disabled_plural", article: "le" },
  demo_data_purged: { key: "ent_demo_data_purged", pluralKey: "ent_demo_data_purged_plural", article: "la" },

};

// Helpers
type T = (key: string, values?: Record<string, string | number>) => string;

export function entityLabel(t: T, entityType: string): string {
  const meta = ENTITY_LABELS[entityType];
  if (!meta) return entityType.replace(/_/g, " ");
  return t(meta.key);
}

export function entityLabelWithId(t: T, entityType: string, entityId?: number | null): string {
  const label = entityLabel(t, entityType);
  if (entityId) return `${label} #${entityId}`;
  return label;
}

// Phrase complete : "Emilie a modifie la facture #42"
export function formatAuditPhrase(t: T, opts: {
  actorName?: string | null;
  action: string;
  entityType: string;
  entityId?: number | null;
}): string {
  const verbKey = ACTION_VERBS[opts.action];
  const verb = verbKey ? t(verbKey) : t("verb_fallback", { action: opts.action });
  const meta = ENTITY_LABELS[opts.entityType];
  const article = meta?.article ?? "le";
  const label = meta ? t(meta.key) : opts.entityType.replace(/_/g, " ");
  const target = t("cible_avec_article", {
    article: article === "l'" ? "l'" : `${article} `,
    label: opts.entityId ? `${label} #${opts.entityId}` : label,
  });
  const actor = opts.actorName ?? t("systeme");
  return `${actor} ${verb} ${target}`;
}

// Security event type → libellé humain
export const SECURITY_EVENT_LABELS: Record<string, string> = {
  login_success: "sec_login_success",
  login_failed: "sec_login_failed",
  password_changed: "sec_password_changed",
  password_breach_detected: "sec_password_breach_detected",
  two_factor_enabled: "sec_two_factor_enabled",
  two_factor_disabled: "sec_two_factor_disabled",
  backup_codes_regenerated: "sec_backup_codes_regenerated",
  backup_code_used: "sec_backup_code_used",
  session_revoked: "sec_session_revoked",
  all_sessions_revoked: "sec_all_sessions_revoked",
  trusted_device_added: "sec_trusted_device_added",
  trusted_device_removed: "sec_trusted_device_removed",
  api_token_created: "sec_api_token_created",
  api_token_revoked: "sec_api_token_revoked",
  data_export_requested: "sec_data_export_requested",
  data_export_ready: "sec_data_export_ready",
  account_deletion_requested: "sec_account_deletion_requested",
  suspicious_login: "sec_suspicious_login",
  passkey_added: "sec_passkey_added",
  passkey_removed: "sec_passkey_removed",
  profile_updated: "sec_profile_updated",
  preferences_updated: "sec_preferences_updated",
  notification_prefs_updated: "sec_notification_prefs_updated",
  user_created: "sec_user_created",
  user_updated: "sec_user_updated",
  user_deactivated: "sec_user_deactivated",
  user_deleted: "sec_user_deleted",
  role_created: "sec_role_created",
  role_updated: "sec_role_updated",
  role_deleted: "sec_role_deleted",
  position_created: "sec_position_created",
  position_updated: "sec_position_updated",
  position_deleted: "sec_position_deleted",

};

export function securityEventLabel(t: T, type: string): string {
  const key = SECURITY_EVENT_LABELS[type];
  return key ? t(key) : type.replace(/_/g, " ");
}
