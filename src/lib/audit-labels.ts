// ─────────────────────────────────────────────────────────
// Traductions humaines pour les actions d'audit et les
// événements de sécurité. Évite "Modification tax_declarations #31"
// au profit de "Déclaration fiscale modifiée".
// ─────────────────────────────────────────────────────────

// Action verbs (créer/modifier/...)
export const ACTION_LABELS: Record<string, string> = {
  create: "Création",
  update: "Modification",
  delete: "Suppression",
  login: "Connexion",
  logout: "Déconnexion",
  export: "Export",
  view: "Consultation",
  settings_update: "Paramètre modifié",
  password_reset: "Mot de passe réinitialisé",
  role_change: "Rôle changé",
  impersonate: "Imitation",
};

// Verbes au passé pour phrases naturelles
export const ACTION_VERBS: Record<string, string> = {
  create: "a créé",
  update: "a modifié",
  delete: "a supprimé",
  login: "s'est connecté",
  logout: "s'est déconnecté",
  export: "a exporté",
  view: "a consulté",
  settings_update: "a modifié les paramètres",
  password_reset: "a réinitialisé le mot de passe",
  role_change: "a changé le rôle",
  impersonate: "a imité",
};

// Type d'entité → libellé humain
export const ENTITY_LABELS: Record<string, { singular: string; plural: string; article: "le" | "la" | "l'" }> = {
  admin: { singular: "utilisateur", plural: "utilisateurs", article: "l'" },
  admin_bulk: { singular: "groupe d'utilisateurs", plural: "groupes d'utilisateurs", article: "le" },
  admin_invitation: { singular: "invitation", plural: "invitations", article: "l'" },
  admin_anonymized: { singular: "compte anonymisé", plural: "comptes anonymisés", article: "le" },
  admin_data_export: { singular: "export de données", plural: "exports", article: "l'" },
  admin_onboarding: { singular: "accueil", plural: "accueils", article: "l'" },
  role: { singular: "rôle", plural: "rôles", article: "le" },
  role_reorder: { singular: "ordre des rôles", plural: "ordres", article: "l'" },
  position: { singular: "poste", plural: "postes", article: "le" },
  position_reorder: { singular: "ordre des postes", plural: "ordres", article: "l'" },
  client: { singular: "client", plural: "clients", article: "le" },
  clients: { singular: "client", plural: "clients", article: "le" },
  quote: { singular: "devis", plural: "devis", article: "le" },
  quotes: { singular: "devis", plural: "devis", article: "le" },
  invoice: { singular: "facture", plural: "factures", article: "la" },
  invoices: { singular: "facture", plural: "factures", article: "la" },
  contract: { singular: "contrat", plural: "contrats", article: "le" },
  contracts: { singular: "contrat", plural: "contrats", article: "le" },
  mandate: { singular: "mandat", plural: "mandats", article: "le" },
  mandates: { singular: "mandat", plural: "mandats", article: "le" },
  payment: { singular: "paiement", plural: "paiements", article: "le" },
  payments: { singular: "paiement", plural: "paiements", article: "le" },
  refund: { singular: "remboursement", plural: "remboursements", article: "le" },
  refunds: { singular: "remboursement", plural: "remboursements", article: "le" },
  dispute: { singular: "litige", plural: "litiges", article: "le" },
  expense: { singular: "dépense", plural: "dépenses", article: "la" },
  expenses: { singular: "dépense", plural: "dépenses", article: "la" },
  tax_declaration: { singular: "déclaration fiscale", plural: "déclarations fiscales", article: "la" },
  tax_declarations: { singular: "déclaration fiscale", plural: "déclarations fiscales", article: "la" },
  document: { singular: "document", plural: "documents", article: "le" },
  documents: { singular: "document", plural: "documents", article: "le" },
  message: { singular: "message", plural: "messages", article: "le" },
  appointment: { singular: "rendez-vous", plural: "rendez-vous", article: "le" },
  settings: { singular: "paramètre", plural: "paramètres", article: "le" },
  security_policy: { singular: "politique de sécurité", plural: "politiques", article: "la" },
  branding: { singular: "charte graphique", plural: "chartes", article: "la" },
  config_export: { singular: "export config", plural: "exports", article: "l'" },
  config_import: { singular: "import config", plural: "imports", article: "l'" },
  catalog_item: { singular: "élément de catalogue", plural: "éléments", article: "l'" },
  service_catalog: { singular: "service", plural: "services", article: "le" },
  discount_code: { singular: "code promo", plural: "codes promo", article: "le" },
  blog_post: { singular: "article de blog", plural: "articles", article: "l'" },
  faq_item: { singular: "question FAQ", plural: "questions", article: "la" },
  testimonial: { singular: "témoignage", plural: "témoignages", article: "le" },
  email_template: { singular: "modèle de courriel", plural: "modèles", article: "le" },
  pdf_template: { singular: "modèle PDF", plural: "modèles", article: "le" },
  outgoing_webhook: { singular: "webhook sortant", plural: "webhooks", article: "le" },
  incoming_webhook_log: { singular: "webhook entrant", plural: "webhooks", article: "le" },
  api_token: { singular: "jeton API", plural: "jetons", article: "le" },
  maintenance_window: { singular: "maintenance", plural: "maintenances", article: "la" },
  incident_report: { singular: "incident", plural: "incidents", article: "l'" },
  announcement_banner: { singular: "bandeau d'annonce", plural: "bandeaux", article: "le" },
  force_logout_all: { singular: "déconnexion forcée", plural: "déconnexions", article: "la" },
  admin_locked: { singular: "blocage de compte", plural: "blocages", article: "le" },
  admin_unlocked: { singular: "déblocage de compte", plural: "déblocages", article: "le" },
  demo_mode_enabled: { singular: "mode démo", plural: "modes démo", article: "le" },
  demo_mode_disabled: { singular: "mode démo", plural: "modes démo", article: "le" },
  demo_data_purged: { singular: "purge des données démo", plural: "purges", article: "la" },
};

// Helpers
export function entityLabel(entityType: string, _entityId?: number | null): string {
  const meta = ENTITY_LABELS[entityType];
  if (!meta) return entityType.replace(/_/g, " ");
  return meta.singular;
}

export function entityLabelWithId(entityType: string, entityId?: number | null): string {
  const label = entityLabel(entityType);
  if (entityId) return `${label} #${entityId}`;
  return label;
}

// Phrase complète : "Émilie a modifié la facture #42"
export function formatAuditPhrase(opts: {
  actorName?: string | null;
  action: string;
  entityType: string;
  entityId?: number | null;
}): string {
  const verb = ACTION_VERBS[opts.action] ?? `a effectué « ${opts.action} »`;
  const meta = ENTITY_LABELS[opts.entityType];
  const article = meta?.article ?? "le";
  const label = meta?.singular ?? opts.entityType.replace(/_/g, " ");
  const articlePrefix = article === "l'" ? "l'" : `${article} `;
  const target = opts.entityId ? `${articlePrefix}${label} #${opts.entityId}` : `${articlePrefix}${label}`;
  const actor = opts.actorName ?? "Système";
  return `${actor} ${verb} ${target}`;
}

// Security event type → libellé humain
export const SECURITY_EVENT_LABELS: Record<string, string> = {
  login_success: "Connexion réussie",
  login_failed: "Tentative de connexion échouée",
  password_changed: "Mot de passe modifié",
  password_breach_detected: "Mot de passe compromis détecté",
  two_factor_enabled: "2FA activée",
  two_factor_disabled: "2FA désactivée",
  backup_codes_regenerated: "Codes de secours régénérés",
  backup_code_used: "Code de secours utilisé",
  session_revoked: "Session révoquée",
  all_sessions_revoked: "Toutes les sessions révoquées",
  trusted_device_added: "Appareil de confiance ajouté",
  trusted_device_removed: "Appareil de confiance retiré",
  api_token_created: "Jeton API créé",
  api_token_revoked: "Jeton API révoqué",
  data_export_requested: "Export de données demandé",
  data_export_ready: "Export de données prêt",
  account_deletion_requested: "Suppression de compte demandée",
  suspicious_login: "Connexion suspecte",
  passkey_added: "Clé d'accès (passkey) ajoutée",
  passkey_removed: "Clé d'accès retirée",
  profile_updated: "Profil mis à jour",
  preferences_updated: "Préférences mises à jour",
  notification_prefs_updated: "Notifications mises à jour",
  user_created: "Compte créé",
  user_updated: "Compte modifié",
  user_deactivated: "Compte désactivé",
  user_deleted: "Compte supprimé",
  role_created: "Rôle créé",
  role_updated: "Rôle modifié",
  role_deleted: "Rôle supprimé",
  position_created: "Poste créé",
  position_updated: "Poste modifié",
  position_deleted: "Poste supprimé",
};

export function securityEventLabel(type: string): string {
  return SECURITY_EVENT_LABELS[type] ?? type.replace(/_/g, " ");
}
