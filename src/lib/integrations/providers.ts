// ─────────────────────────────────────────────────────────
// Définition des fournisseurs d'intégrations disponibles
// dans le portail VNK (Stripe, Dropbox Sign, Slack, etc.)
//
// Chaque fournisseur déclare ses champs de configuration
// (avec type, validation, sensibilité) afin que l'UI puisse
// générer le formulaire automatiquement.
// ─────────────────────────────────────────────────────────

export type FieldType = "text" | "secret" | "url" | "email" | "select";

export type ProviderField = {
  key: string;
  labelKey: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  helperKey?: string;
  options?: { value: string; labelKey: string }[];
};

export type IntegrationProvider = {
  key: string;
  name: string;
  category: "paiement" | "signature" | "courriel" | "calendrier" | "communication" | "automatisation";
  descriptionKey: string;
  docsUrl: string;
  // Champs de configuration affichés à l'utilisateur
  fields: ProviderField[];
  // Endpoint test (optionnel)
  testable?: boolean;
  // Icône représentant le fournisseur (emoji ou clé d'icône Lucide)
  iconKey: string;
  brandColor: string;
  // OAuth : si présent, l'UI affiche un bouton "Se connecter" au lieu du formulaire de credentials
  oauthFlow?: "microsoft" | "google";
};

export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  // ── Paiement ───────────────────────────────────────
  {
    key: "stripe",
    name: "Stripe",
    category: "paiement",
    descriptionKey: "int_desc_paiements_en_ligne_abonnements_paiements_recurrents",
    docsUrl: "https://dashboard.stripe.com/apikeys",
    iconKey: "credit-card",
    brandColor: "#635BFF",
    testable: true,
    fields: [
      { key: "secret_key", labelKey: "int_lbl_cle_secrete_sk_live_ou_sk", type: "secret", required: true, placeholder: "sk_live_…", helperKey: "int_help_a_copier_depuis_votre_tableau_de" },
      { key: "publishable_key", labelKey: "int_lbl_cle_publique_pk_live_ou_pk", type: "text", required: true, placeholder: "pk_live_…" },
      { key: "webhook_secret", labelKey: "int_lbl_secret_webhook_whsec", type: "secret", required: false, placeholder: "whsec_…", helperKey: "int_help_permet_a_stripe_de_notifier_le" },
      { key: "account_id", labelKey: "int_lbl_identifiant_de_compte_acct", type: "text", required: false, placeholder: "acct_…" },
    ],
  },

  // ── Signature électronique ────────────────────────
  {
    key: "dropbox_sign",
    name: "Dropbox Sign",
    category: "signature",
    descriptionKey: "int_desc_signature_electronique_des_contrats_et_devis",
    docsUrl: "https://app.hellosign.com/home/myAccount#api",
    iconKey: "file-signature",
    brandColor: "#0061FF",
    testable: true,
    fields: [
      { key: "api_key", labelKey: "int_lbl_cle_api", type: "secret", required: true, placeholder: "xxxxx", helperKey: "int_help_a_copier_depuis_votre_compte_dropbox" },
      { key: "client_id", labelKey: "int_lbl_identifiant_client_app", type: "text", required: false },
      { key: "test_mode", labelKey: "int_lbl_mode_test", type: "select", options: [{ value: "true", labelKey: "int_lbl_active" }, { value: "false", labelKey: "int_lbl_desactive" }], required: false },
    ],
  },

  // ── Courriel transactionnel ────────────────────────
  {
    key: "sendgrid",
    name: "SendGrid",
    category: "courriel",
    descriptionKey: "int_desc_envoi_de_courriels_transactionnels_factures_notifications",
    docsUrl: "https://app.sendgrid.com/settings/api_keys",
    iconKey: "mail",
    brandColor: "#1A82E2",
    testable: true,
    fields: [
      { key: "api_key", labelKey: "int_lbl_cle_api_sendgrid", type: "secret", required: true, placeholder: "SG.xxxxx" },
      { key: "from_email", labelKey: "int_lbl_adresse_d_expedition", type: "email", required: true, placeholder: "no-reply@vnkautomatisation.ca" },
      { key: "from_name", labelKey: "int_lbl_nom_d_expedition", type: "text", required: false, placeholder: "VNK Automatisation" },
    ],
  },
  {
    key: "smtp",
    name: "SMTP générique",
    category: "courriel",
    descriptionKey: "int_desc_configurer_un_serveur_smtp_gmail_outlook",
    docsUrl: "https://nodemailer.com/smtp/",
    iconKey: "mail",
    brandColor: "#34A853",
    testable: true,
    fields: [
      { key: "host", labelKey: "int_lbl_serveur_smtp", type: "text", required: true, placeholder: "smtp.gmail.com" },
      { key: "port", labelKey: "int_lbl_port", type: "text", required: true, placeholder: "587" },
      { key: "username", labelKey: "int_lbl_utilisateur", type: "text", required: true, placeholder: "user@domain.com" },
      { key: "password", labelKey: "int_lbl_mot_de_passe", type: "secret", required: true },
      { key: "secure", labelKey: "int_lbl_connexion_securisee_tls", type: "select", required: false, options: [{ value: "true", labelKey: "int_lbl_activee" }, { value: "false", labelKey: "int_lbl_desactivee" }] },
      { key: "from_email", labelKey: "int_lbl_adresse_d_expedition", type: "email", required: true },
    ],
  },

  // ── Calendrier ────────────────────────────────────
  {
    key: "google_calendar",
    name: "Google Calendar",
    category: "calendrier",
    descriptionKey: "int_desc_synchroniser_les_rendez_vous_du_portail",
    docsUrl: "https://console.cloud.google.com/apis/credentials",
    iconKey: "calendar",
    brandColor: "#4285F4",
    oauthFlow: "google",
    fields: [
      { key: "client_id", labelKey: "int_lbl_identifiant_client_oauth", type: "text", required: true, placeholder: "xxxxxxxx.apps.googleusercontent.com", helperKey: "int_help_creez_un_oauth_client_id_type" },
      { key: "client_secret", labelKey: "int_lbl_secret_client_oauth", type: "secret", required: true, placeholder: "GOCSPX-…", helperKey: "int_help_fourni_avec_l_identifiant_client_dans" },
    ],
  },
  {
    key: "microsoft_calendar",
    name: "Microsoft Outlook + Teams",
    category: "calendrier",
    descriptionKey: "int_desc_synchronisation_avec_outlook_365_auto_creation",
    docsUrl: "https://portal.azure.com",
    iconKey: "calendar",
    brandColor: "#0078D4",
    oauthFlow: "microsoft",
    fields: [
      { key: "client_id", labelKey: "int_lbl_identifiant_d_application_client_id", type: "text", required: true, placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", helperKey: "int_help_creez_une_app_registration_dans_le" },
      { key: "client_secret", labelKey: "int_lbl_valeur_du_secret_client", type: "secret", required: true, helperKey: "int_help_dans_azure_certificates_secrets_new_client" },
      { key: "tenant_id", labelKey: "int_lbl_identifiant_de_repertoire_tenant_id", type: "text", required: false, placeholder: "common", helperKey: "int_help_laissez_common_pour_accepter_tous_les" },
    ],
  },
  {
    key: "calendly",
    name: "Calendly",
    category: "calendrier",
    descriptionKey: "int_desc_recevoir_les_rendez_vous_pris_via",
    docsUrl: "https://calendly.com/integrations/api_webhooks",
    iconKey: "calendar",
    brandColor: "#006BFF",
    testable: true,
    fields: [
      { key: "api_key", labelKey: "int_lbl_token_d_acces_personnel", type: "secret", required: true, helperKey: "int_help_a_creer_dans_calendly_integrations_api" },
      { key: "user_uri", labelKey: "int_lbl_uri_utilisateur_calendly", type: "url", required: false, placeholder: "https://api.calendly.com/users/…", helperKey: "int_help_optionnel_sera_detecte_automatiquement_a_la" },
    ],
  },

  // ── Communication ─────────────────────────────────
  {
    key: "slack",
    name: "Slack",
    category: "communication",
    descriptionKey: "int_desc_recevoir_les_notifications_du_portail_nouvelles",
    docsUrl: "https://api.slack.com/messaging/webhooks",
    iconKey: "message-square",
    brandColor: "#4A154B",
    testable: true,
    fields: [
      { key: "webhook_url", labelKey: "int_lbl_url_du_webhook_entrant_slack", type: "url", required: true, placeholder: "https://hooks.slack.com/services/…" },
      { key: "default_channel", labelKey: "int_lbl_canal_par_defaut", type: "text", required: false, placeholder: "#vnk-notifications" },
      { key: "username", labelKey: "int_lbl_nom_du_bot", type: "text", required: false, placeholder: "VNK Bot" },
    ],
  },

  // ── Automatisation ─────────────────────────────────
  {
    key: "zapier",
    name: "Zapier",
    category: "automatisation",
    descriptionKey: "int_desc_connecter_vnk_a_plus_de_6",
    docsUrl: "https://zapier.com/apps",
    iconKey: "zap",
    brandColor: "#FF4A00",
    testable: true,
    fields: [
      { key: "webhook_url", labelKey: "int_lbl_url_du_webhook_zapier_catch_hook", type: "url", required: true, placeholder: "https://hooks.zapier.com/hooks/catch/…", helperKey: "int_help_a_copier_depuis_le_declencheur_catch" },
      { key: "events", labelKey: "int_lbl_evenements_a_transmettre", type: "select", required: false, options: [
        { value: "all", labelKey: "int_lbl_tous_les_evenements" },
        { value: "invoices", labelKey: "int_lbl_factures_seulement" },
        { value: "requests", labelKey: "int_lbl_demandes_seulement" },
        { value: "payments", labelKey: "int_lbl_paiements_seulement" },
      ] },
    ],
  },
];

export function getProvider(key: string): IntegrationProvider | undefined {
  return INTEGRATION_PROVIDERS.find((p) => p.key === key);
}

export const CATEGORY_LABELS: Record<string, string> = {
  paiement: "Paiement",
  signature: "Signature électronique",
  courriel: "Courriel",
  calendrier: "Calendrier",
  communication: "Communication",
  automatisation: "Automatisation",
};
