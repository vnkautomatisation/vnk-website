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
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  helper?: string;
  options?: { value: string; label: string }[];
};

export type IntegrationProvider = {
  key: string;
  name: string;
  category: "paiement" | "signature" | "courriel" | "calendrier" | "communication" | "automatisation";
  description: string;
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
    description: "Paiements en ligne, abonnements, paiements récurrents. Connecter votre compte Stripe pour encaisser les factures depuis le portail.",
    docsUrl: "https://dashboard.stripe.com/apikeys",
    iconKey: "credit-card",
    brandColor: "#635BFF",
    testable: true,
    fields: [
      { key: "secret_key", label: "Clé secrète (sk_live ou sk_test)", type: "secret", required: true, placeholder: "sk_live_…", helper: "À copier depuis votre tableau de bord Stripe, section Clés API." },
      { key: "publishable_key", label: "Clé publique (pk_live ou pk_test)", type: "text", required: true, placeholder: "pk_live_…" },
      { key: "webhook_secret", label: "Secret webhook (whsec_)", type: "secret", required: false, placeholder: "whsec_…", helper: "Permet à Stripe de notifier le portail à chaque paiement reçu (à configurer dans votre tableau de bord Stripe)." },
      { key: "account_id", label: "Identifiant de compte (acct_)", type: "text", required: false, placeholder: "acct_…" },
    ],
  },

  // ── Signature électronique ────────────────────────
  {
    key: "dropbox_sign",
    name: "Dropbox Sign",
    category: "signature",
    description: "Signature électronique des contrats et devis. Anciennement HelloSign.",
    docsUrl: "https://app.hellosign.com/home/myAccount#api",
    iconKey: "file-signature",
    brandColor: "#0061FF",
    testable: true,
    fields: [
      { key: "api_key", label: "Clé API", type: "secret", required: true, placeholder: "xxxxx", helper: "À copier depuis votre compte Dropbox Sign, section API et Webhooks." },
      { key: "client_id", label: "Identifiant client (app)", type: "text", required: false },
      { key: "test_mode", label: "Mode test", type: "select", options: [{ value: "true", label: "Activé" }, { value: "false", label: "Désactivé" }], required: false },
    ],
  },

  // ── Courriel transactionnel ────────────────────────
  {
    key: "sendgrid",
    name: "SendGrid",
    category: "courriel",
    description: "Envoi de courriels transactionnels (factures, notifications, confirmations) via SendGrid.",
    docsUrl: "https://app.sendgrid.com/settings/api_keys",
    iconKey: "mail",
    brandColor: "#1A82E2",
    testable: true,
    fields: [
      { key: "api_key", label: "Clé API SendGrid", type: "secret", required: true, placeholder: "SG.xxxxx" },
      { key: "from_email", label: "Adresse d'expédition", type: "email", required: true, placeholder: "no-reply@vnkautomatisation.ca" },
      { key: "from_name", label: "Nom d'expédition", type: "text", required: false, placeholder: "VNK Automatisation" },
    ],
  },
  {
    key: "smtp",
    name: "SMTP générique",
    category: "courriel",
    description: "Configurer un serveur SMTP (Gmail, Outlook, OVH, etc.) comme alternative à SendGrid.",
    docsUrl: "https://nodemailer.com/smtp/",
    iconKey: "mail",
    brandColor: "#34A853",
    testable: true,
    fields: [
      { key: "host", label: "Serveur SMTP", type: "text", required: true, placeholder: "smtp.gmail.com" },
      { key: "port", label: "Port", type: "text", required: true, placeholder: "587" },
      { key: "username", label: "Utilisateur", type: "text", required: true, placeholder: "user@domain.com" },
      { key: "password", label: "Mot de passe", type: "secret", required: true },
      { key: "secure", label: "Connexion sécurisée (TLS)", type: "select", required: false, options: [{ value: "true", label: "Activée" }, { value: "false", label: "Désactivée" }] },
      { key: "from_email", label: "Adresse d'expédition", type: "email", required: true },
    ],
  },

  // ── Calendrier ────────────────────────────────────
  {
    key: "google_calendar",
    name: "Google Calendar",
    category: "calendrier",
    description: "Synchroniser les rendez-vous du portail avec Google Calendar. Auto-création de liens Google Meet.",
    docsUrl: "https://console.cloud.google.com/apis/credentials",
    iconKey: "calendar",
    brandColor: "#4285F4",
    oauthFlow: "google",
    fields: [
      { key: "client_id", label: "Identifiant client (OAuth)", type: "text", required: true, placeholder: "xxxxxxxx.apps.googleusercontent.com", helper: "Créez un OAuth Client ID type Web dans la console Google Cloud." },
      { key: "client_secret", label: "Secret client (OAuth)", type: "secret", required: true, placeholder: "GOCSPX-…", helper: "Fourni avec l'identifiant client dans la console Google Cloud." },
    ],
  },
  {
    key: "microsoft_calendar",
    name: "Microsoft Outlook + Teams",
    category: "calendrier",
    description: "Synchronisation avec Outlook 365. Auto-création de réunions Teams lors de la prise de rendez-vous dans le portail.",
    docsUrl: "https://portal.azure.com",
    iconKey: "calendar",
    brandColor: "#0078D4",
    oauthFlow: "microsoft",
    fields: [
      { key: "client_id", label: "Identifiant d'application (Client ID)", type: "text", required: true, placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", helper: "Créez une App Registration dans le portail Azure puis copiez l'Application (client) ID." },
      { key: "client_secret", label: "Valeur du secret client", type: "secret", required: true, helper: "Dans Azure : Certificates & secrets > New client secret > copier la VALEUR (pas l'ID)." },
      { key: "tenant_id", label: "Identifiant de répertoire (Tenant ID)", type: "text", required: false, placeholder: "common", helper: "Laissez 'common' pour accepter tous les comptes Microsoft, ou collez votre Tenant ID spécifique." },
    ],
  },
  {
    key: "calendly",
    name: "Calendly",
    category: "calendrier",
    description: "Recevoir les rendez-vous pris via votre page Calendly directement dans le portail.",
    docsUrl: "https://calendly.com/integrations/api_webhooks",
    iconKey: "calendar",
    brandColor: "#006BFF",
    testable: true,
    fields: [
      { key: "api_key", label: "Token d'accès personnel", type: "secret", required: true, helper: "À créer dans Calendly > Intégrations > API et webhooks." },
      { key: "user_uri", label: "URI utilisateur Calendly", type: "url", required: false, placeholder: "https://api.calendly.com/users/…", helper: "Optionnel - sera détecté automatiquement à la première connexion." },
    ],
  },

  // ── Communication ─────────────────────────────────
  {
    key: "slack",
    name: "Slack",
    category: "communication",
    description: "Recevoir les notifications du portail (nouvelles demandes, factures, alertes) dans Slack.",
    docsUrl: "https://api.slack.com/messaging/webhooks",
    iconKey: "message-square",
    brandColor: "#4A154B",
    testable: true,
    fields: [
      { key: "webhook_url", label: "URL du webhook entrant Slack", type: "url", required: true, placeholder: "https://hooks.slack.com/services/…" },
      { key: "default_channel", label: "Canal par défaut", type: "text", required: false, placeholder: "#vnk-notifications" },
      { key: "username", label: "Nom du bot", type: "text", required: false, placeholder: "VNK Bot" },
    ],
  },

  // ── Automatisation ─────────────────────────────────
  {
    key: "zapier",
    name: "Zapier",
    category: "automatisation",
    description: "Connecter VNK à plus de 6 000 applications via Zapier (webhooks sortants).",
    docsUrl: "https://zapier.com/apps",
    iconKey: "zap",
    brandColor: "#FF4A00",
    testable: true,
    fields: [
      { key: "webhook_url", label: "URL du webhook Zapier (Catch Hook)", type: "url", required: true, placeholder: "https://hooks.zapier.com/hooks/catch/…", helper: "À copier depuis le déclencheur Catch Hook dans votre Zap." },
      { key: "events", label: "Évènements à transmettre", type: "select", required: false, options: [
        { value: "all", label: "Tous les évènements" },
        { value: "invoices", label: "Factures seulement" },
        { value: "requests", label: "Demandes seulement" },
        { value: "payments", label: "Paiements seulement" },
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
