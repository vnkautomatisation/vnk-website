// Seed Prisma — valeurs par défaut de la section Paramètres + compte admin VNK
// Exécution : npm run db:seed

import { PrismaClient, SettingType, AdminRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════
// VALEURS PAR DÉFAUT DES PARAMÈTRES (15 catégories)
// ═══════════════════════════════════════════════════════════

type SeedSetting = {
  category: string;
  key: string;
  value: string;
  type?: SettingType;
  label: string;
  description?: string;
  isPublic?: boolean;
  isSecret?: boolean;
  sortOrder?: number;
};

const SETTINGS: SeedSetting[] = [
  // ─── A. GÉNÉRAL ────────────────────────────────────────────
  { category: "general", key: "company_name", value: "VNK Automatisation Inc.", label: "Nom de l'entreprise", isPublic: true, sortOrder: 10 },
  { category: "general", key: "company_tagline", value: "Value. Network. Knowledge.", label: "Slogan", isPublic: true, sortOrder: 20 },
  { category: "general", key: "default_locale", value: "fr", label: "Langue par défaut", description: "fr ou en", sortOrder: 30 },
  { category: "general", key: "available_locales", value: "fr,en", type: "json", label: "Langues disponibles", sortOrder: 40 },
  { category: "general", key: "timezone", value: "America/Montreal", label: "Fuseau horaire", sortOrder: 50 },
  { category: "general", key: "date_format", value: "yyyy-MM-dd", label: "Format de date", sortOrder: 60 },
  { category: "general", key: "currency", value: "CAD", label: "Devise", sortOrder: 70 },
  { category: "general", key: "business_hours", value: JSON.stringify({ mon: "08:00-17:00", tue: "08:00-17:00", wed: "08:00-17:00", thu: "08:00-17:00", fri: "08:00-17:00", sat: "closed", sun: "closed" }), type: "json", label: "Heures d'ouverture", sortOrder: 80 },

  // ─── B. ENTREPRISE (infos légales) ─────────────────────────
  { category: "company", key: "neq", value: "", label: "Numéro d'entreprise du Québec (NEQ)", sortOrder: 10 },
  { category: "company", key: "tps_number", value: "", label: "Numéro de TPS", description: "9 chiffres + RT0001", sortOrder: 20 },
  { category: "company", key: "tvq_number", value: "", label: "Numéro de TVQ", description: "10 chiffres + TQ0001", sortOrder: 30 },
  { category: "company", key: "tps_rate", value: "5", type: "number", label: "Taux TPS (%)", sortOrder: 40 },
  { category: "company", key: "tvq_rate", value: "9.975", type: "number", label: "Taux TVQ (%)", sortOrder: 50 },
  { category: "company", key: "address", value: "", label: "Adresse civique", sortOrder: 60 },
  { category: "company", key: "city", value: "Lévis", label: "Ville", sortOrder: 70 },
  { category: "company", key: "province", value: "QC", label: "Province", sortOrder: 80 },
  { category: "company", key: "postal_code", value: "", label: "Code postal", sortOrder: 90 },
  { category: "company", key: "phone", value: "", label: "Téléphone principal", isPublic: true, sortOrder: 100 },
  { category: "company", key: "email", value: "vnkautomatisation@gmail.com", label: "Courriel principal", isPublic: true, sortOrder: 110 },
  { category: "company", key: "website", value: "https://vnk.ca", label: "Site web", isPublic: true, sortOrder: 120 },
  { category: "company", key: "logo_url", value: "/images/vnk-logo-horizontal-dark.svg", label: "Logo principal", isPublic: true, sortOrder: 130 },
  { category: "company", key: "logo_light_url", value: "/images/vnk-logo-horizontal-light.svg", label: "Logo fond sombre", isPublic: true, sortOrder: 140 },

  // ─── C. PORTAIL CLIENT ─────────────────────────────────────
  { category: "portal", key: "document_categories", value: JSON.stringify(["Rapports", "Devis", "Factures", "Contrats", "Plans", "Photos", "Manuels"]), type: "json", label: "Catégories de documents", sortOrder: 10 },
  { category: "portal", key: "industry_sectors", value: JSON.stringify(["Fabrication industrielle", "Agroalimentaire", "Chimie", "Pharmaceutique", "Aéronautique", "Pâtes et papiers", "Énergie", "Métallurgie", "Automobile", "Électronique", "Mines", "Transport", "Autres"]), type: "json", label: "Secteurs industriels", sortOrder: 20 },
  { category: "portal", key: "service_types", value: JSON.stringify(["Support PLC", "Audit technique", "Documentation industrielle", "Refactorisation PLC", "Formation", "Démarrage", "Diagnostic à distance"]), type: "json", label: "Types de service", sortOrder: 30 },
  { category: "portal", key: "plc_brands", value: JSON.stringify(["Siemens", "Rockwell / Allen-Bradley", "B&R Automation", "Schneider Electric", "Omron", "Mitsubishi", "Beckhoff", "Phoenix Contact", "Autres"]), type: "json", label: "Marques d'automates", isPublic: true, sortOrder: 40 },
  { category: "portal", key: "technologies", value: JSON.stringify(["Siemens S7-1500", "Siemens S7-1200", "TIA Portal", "Step 7", "WinCC", "Allen-Bradley ControlLogix", "Studio 5000", "FactoryTalk", "B&R Automation Studio", "Schneider Modicon", "EcoStruxure", "Ignition", "SCADA générique"]), type: "json", label: "Technologies / tags disponibles", sortOrder: 50 },
  { category: "portal", key: "mandate_statuses", value: JSON.stringify({ pending: "En attente", active: "Actif", in_progress: "En cours", paused: "En pause", completed: "Complété", cancelled: "Annulé" }), type: "json", label: "Libellés des statuts de mandats", sortOrder: 60 },
  { category: "portal", key: "dispute_priorities", value: JSON.stringify({ low: { label: "Faible", color: "#64748B" }, medium: { label: "Moyenne", color: "#D97706" }, high: { label: "Élevée", color: "#EA580C" }, critical: { label: "Critique", color: "#DC2626" } }), type: "json", label: "Priorités de litiges (labels + couleurs)", sortOrder: 70 },
  { category: "portal", key: "tabs_enabled", value: JSON.stringify({ dashboard: true, profile: true, mandates: true, my_requests: true, quotes: true, invoices: true, contracts: true, documents: true, booking: true, appointments: true }), type: "json", label: "Onglets activés du portail", sortOrder: 80 },
  { category: "portal", key: "welcome_message", value: "", label: "Message d'accueil (bannière top)", sortOrder: 90 },
  { category: "portal", key: "maintenance_enabled", value: "false", type: "boolean", label: "Mode maintenance", sortOrder: 100 },
  { category: "portal", key: "maintenance_message", value: "Le portail est temporairement indisponible pour maintenance. Merci de votre patience.", label: "Message de maintenance", sortOrder: 110 },

  // ─── D. FACTURATION & PAIEMENTS ────────────────────────────
  { category: "billing", key: "default_payment_plan", value: "split_50_50", label: "Plan de paiement par défaut", sortOrder: 10 },
  { category: "billing", key: "payment_plans", value: JSON.stringify([
    { key: "full", label: "Paiement complet", splits: [100] },
    { key: "split_50_50", label: "50% acompte, 50% solde", splits: [50, 50] },
    { key: "split_30_70", label: "30% acompte, 70% solde", splits: [30, 70] },
    { key: "split_25_75", label: "25% acompte, 75% solde", splits: [25, 75] },
    { key: "custom", label: "Personnalisé", splits: [] },
  ]), type: "json", label: "Plans de paiement disponibles", sortOrder: 20 },
  { category: "billing", key: "default_payment_conditions", value: "Paiement dû à la réception de la facture. Intérêts de 2% par mois sur tout solde impayé.", label: "Conditions de paiement par défaut", sortOrder: 30 },
  { category: "billing", key: "default_payment_due_days", value: "30", type: "number", label: "Délai de paiement par défaut (jours)", sortOrder: 40 },
  { category: "billing", key: "default_quote_expiry_days", value: "30", type: "number", label: "Durée de validité des devis (jours)", sortOrder: 50 },
  { category: "billing", key: "auto_reminder_enabled", value: "true", type: "boolean", label: "Relances automatiques factures", sortOrder: 60 },
  { category: "billing", key: "reminder_days_before", value: "[3]", type: "json", label: "Jours avant échéance pour rappel", sortOrder: 70 },
  { category: "billing", key: "reminder_days_after", value: "[1, 7, 14, 30]", type: "json", label: "Jours après échéance pour relance", sortOrder: 80 },
  { category: "billing", key: "invoice_number_prefix", value: "F-{YYYY}-", label: "Préfixe numérotation factures", sortOrder: 90 },
  { category: "billing", key: "quote_number_prefix", value: "D-{YYYY}-", label: "Préfixe numérotation devis", sortOrder: 100 },
  { category: "billing", key: "contract_number_prefix", value: "CT-{YYYY}-", label: "Préfixe numérotation contrats", sortOrder: 110 },
  { category: "billing", key: "refund_number_prefix", value: "RMB-{YYYY}-", label: "Préfixe numérotation remboursements", sortOrder: 120 },

  // ─── E. SIGNATURE ÉLECTRONIQUE (canvas interne) ───────────
  { category: "signature", key: "provider", value: "internal", label: "Fournisseur de signature", description: "Canvas de signature interne (dessin à la main)", sortOrder: 10 },
  { category: "signature", key: "legal_footer", value: "En signant électroniquement, vous confirmez avoir lu et accepté les conditions du présent contrat.", label: "Texte légal en pied de contrat", sortOrder: 20 },
  { category: "signature", key: "signing_order", value: "admin_first", label: "Ordre de signature", description: "admin_first | client_first | simultaneous", sortOrder: 30 },
  { category: "signature", key: "expiry_days", value: "30", type: "number", label: "Expiration des demandes (jours)", sortOrder: 40 },
  { category: "signature", key: "reminder_days_before_expiry", value: "[7, 3, 1]", type: "json", label: "Rappels avant expiration", sortOrder: 50 },
  { category: "signature", key: "capture_ip", value: "true", type: "boolean", label: "Capturer l'IP du signataire", description: "Pour preuve légale", sortOrder: 60 },
  { category: "signature", key: "require_full_name", value: "true", type: "boolean", label: "Exiger le nom complet en plus du dessin", sortOrder: 70 },

  // ─── F. EMAILS (SMTP + envois) ─────────────────────────────
  { category: "emails", key: "smtp_host", value: "", label: "Serveur SMTP", sortOrder: 10 },
  { category: "emails", key: "smtp_port", value: "587", type: "number", label: "Port SMTP", sortOrder: 20 },
  { category: "emails", key: "smtp_secure", value: "true", type: "boolean", label: "Connexion sécurisée (TLS)", sortOrder: 30 },
  { category: "emails", key: "smtp_user", value: "", label: "Utilisateur SMTP", sortOrder: 40 },
  { category: "emails", key: "smtp_password", value: "", type: "secret", label: "Mot de passe SMTP", isSecret: true, sortOrder: 50 },
  { category: "emails", key: "from_email", value: "noreply@vnk.ca", label: "Courriel expéditeur (from)", sortOrder: 60 },
  { category: "emails", key: "from_name", value: "VNK Automatisation Inc.", label: "Nom expéditeur", sortOrder: 70 },
  { category: "emails", key: "reply_to", value: "vnkautomatisation@gmail.com", label: "Courriel de réponse", sortOrder: 80 },
  { category: "emails", key: "signature_html", value: "<p>—<br><strong>Yan Verone Kengne</strong><br>VNK Automatisation Inc.<br><a href='https://vnk.ca'>vnk.ca</a></p>", label: "Signature HTML", sortOrder: 90 },
  { category: "emails", key: "bcc_admin_on_outgoing", value: "false", type: "boolean", label: "CCI admin sur envois clients", sortOrder: 100 },

  // ─── G. INTÉGRATIONS (clés API) ────────────────────────────
  { category: "integrations", key: "stripe_mode", value: "test", label: "Stripe : mode", description: "test | live", sortOrder: 10 },
  { category: "integrations", key: "stripe_publishable_key", value: "", label: "Stripe : clé publique", sortOrder: 20 },
  { category: "integrations", key: "stripe_secret_key", value: "", type: "secret", label: "Stripe : clé secrète", isSecret: true, sortOrder: 30 },
  { category: "integrations", key: "stripe_webhook_secret", value: "", type: "secret", label: "Stripe : webhook secret", isSecret: true, sortOrder: 40 },
  { category: "integrations", key: "calendly_api_key", value: "", type: "secret", label: "Calendly : clé API", isSecret: true, sortOrder: 50 },
  { category: "integrations", key: "calendly_webhook_secret", value: "", type: "secret", label: "Calendly : webhook secret", isSecret: true, sortOrder: 60 },
  { category: "integrations", key: "google_client_id", value: "", label: "Google SSO : client ID", sortOrder: 70 },
  { category: "integrations", key: "google_client_secret", value: "", type: "secret", label: "Google SSO : client secret", isSecret: true, sortOrder: 80 },
  { category: "integrations", key: "microsoft_client_id", value: "", label: "Microsoft SSO : client ID", sortOrder: 90 },
  { category: "integrations", key: "microsoft_client_secret", value: "", type: "secret", label: "Microsoft SSO : client secret", isSecret: true, sortOrder: 100 },
  { category: "integrations", key: "google_analytics_id", value: "", label: "Google Analytics ID", sortOrder: 110 },
  { category: "integrations", key: "recaptcha_site_key", value: "", label: "reCAPTCHA / hCaptcha : site key", sortOrder: 120 },
  { category: "integrations", key: "recaptcha_secret_key", value: "", type: "secret", label: "reCAPTCHA / hCaptcha : secret", isSecret: true, sortOrder: 130 },

  // ─── H. SYSTÈME ────────────────────────────────────────────
  { category: "system", key: "log_level", value: "info", label: "Niveau de log", description: "debug | info | warn | error", sortOrder: 10 },
  { category: "system", key: "log_retention_days", value: "90", type: "number", label: "Rétention logs (jours)", sortOrder: 20 },
  { category: "system", key: "message_retention_years", value: "2", type: "number", label: "Rétention messages (années, 0=illimité)", sortOrder: 30 },
  { category: "system", key: "backup_enabled", value: "true", type: "boolean", label: "Sauvegardes DB activées", sortOrder: 40 },
  { category: "system", key: "backup_schedule", value: "0 3 * * *", label: "Fréquence des sauvegardes (cron)", sortOrder: 50 },
  { category: "system", key: "backup_destination", value: "local", label: "Destination sauvegardes", description: "local | s3 | b2", sortOrder: 60 },
  { category: "system", key: "max_upload_mb", value: "10", type: "number", label: "Taille max upload (Mo)", sortOrder: 70 },
  { category: "system", key: "allowed_file_extensions", value: ".pdf,.docx,.xlsx,.zip,.txt,.png,.jpg,.jpeg,.dwg", label: "Extensions fichiers autorisées", sortOrder: 80 },
  { category: "system", key: "jwt_session_days", value: "7", type: "number", label: "Durée session JWT (jours)", sortOrder: 90 },
  { category: "system", key: "websocket_enabled", value: "true", type: "boolean", label: "WebSocket activé", sortOrder: 100 },
  { category: "system", key: "rate_limit_per_min", value: "120", type: "number", label: "Limite req/min par IP", sortOrder: 110 },
  { category: "system", key: "auto_purge_old_data", value: "false", type: "boolean", label: "Purge auto des vieilles données", sortOrder: 120 },

  // ─── I. UTILISATEURS & RÔLES ───────────────────────────────
  { category: "users", key: "enable_sso", value: "false", type: "boolean", label: "Activer SSO (Google/Microsoft)", sortOrder: 10 },
  { category: "users", key: "require_2fa_admin", value: "false", type: "boolean", label: "2FA obligatoire pour admins", sortOrder: 20 },
  { category: "users", key: "require_2fa_client", value: "false", type: "boolean", label: "2FA obligatoire pour clients", sortOrder: 30 },
  { category: "users", key: "password_min_length", value: "12", type: "number", label: "Longueur min du mot de passe", sortOrder: 40 },
  { category: "users", key: "password_require_uppercase", value: "true", type: "boolean", label: "Mot de passe : majuscule requise", sortOrder: 50 },
  { category: "users", key: "password_require_numbers", value: "true", type: "boolean", label: "Mot de passe : chiffres requis", sortOrder: 60 },
  { category: "users", key: "password_require_symbols", value: "false", type: "boolean", label: "Mot de passe : symboles requis", sortOrder: 70 },
  { category: "users", key: "session_timeout_min", value: "60", type: "number", label: "Délai d'inactivité avant déconnexion (min)", sortOrder: 80 },
  { category: "users", key: "max_login_attempts", value: "5", type: "number", label: "Tentatives max avant verrouillage", sortOrder: 90 },
  { category: "users", key: "lockout_duration_min", value: "30", type: "number", label: "Durée du verrouillage (min)", sortOrder: 100 },

  // ─── J. APPARENCE (thème) ──────────────────────────────────
  { category: "appearance", key: "primary_color", value: "#0F2D52", label: "Couleur primaire (VNK Navy)", isPublic: true, sortOrder: 10 },
  { category: "appearance", key: "primary_light_color", value: "#1B4F8A", label: "Couleur primaire claire", isPublic: true, sortOrder: 20 },
  { category: "appearance", key: "secondary_color", value: "#64748B", label: "Couleur secondaire", isPublic: true, sortOrder: 30 },
  { category: "appearance", key: "success_color", value: "#059669", label: "Couleur succès", isPublic: true, sortOrder: 40 },
  { category: "appearance", key: "warning_color", value: "#D97706", label: "Couleur avertissement", isPublic: true, sortOrder: 50 },
  { category: "appearance", key: "error_color", value: "#DC2626", label: "Couleur erreur", isPublic: true, sortOrder: 60 },
  { category: "appearance", key: "font_family", value: "Inter", label: "Famille de police", isPublic: true, sortOrder: 70 },
  { category: "appearance", key: "hero_image_url", value: "/images/hero-bg.jpg", label: "Image hero par défaut", isPublic: true, sortOrder: 80 },
  { category: "appearance", key: "favicon_url", value: "/favicon.ico", label: "Favicon", isPublic: true, sortOrder: 90 },
  { category: "appearance", key: "custom_css", value: "", type: "string", label: "CSS personnalisé (avancé)", sortOrder: 100 },

  // ─── K. SEO & MÉTADONNÉES ──────────────────────────────────
  { category: "seo", key: "meta_title_template", value: "{{pageTitle}} | VNK Automatisation Inc.", label: "Template meta title", isPublic: true, sortOrder: 10 },
  { category: "seo", key: "meta_description_default", value: "VNK Automatisation Inc. — Services d'automatisation industrielle : support PLC, SCADA, HMI, audit, documentation, refactorisation. Québec.", label: "Meta description par défaut", isPublic: true, sortOrder: 20 },
  { category: "seo", key: "og_image_url", value: "/images/vnk-twitter-card-1200x600.png", label: "Image Open Graph", isPublic: true, sortOrder: 30 },
  { category: "seo", key: "twitter_handle", value: "", label: "@handle Twitter/X", isPublic: true, sortOrder: 40 },
  { category: "seo", key: "google_search_console", value: "", label: "Google Search Console verification", sortOrder: 50 },
  { category: "seo", key: "robots_txt", value: "User-agent: *\nAllow: /\nSitemap: https://vnk.ca/sitemap.xml", label: "robots.txt", isPublic: true, sortOrder: 60 },
  { category: "seo", key: "enable_jsonld", value: "true", type: "boolean", label: "Activer JSON-LD Organization", isPublic: true, sortOrder: 70 },

  // ─── L. NOTIFICATIONS ──────────────────────────────────────
  { category: "notifications", key: "admin_new_client", value: "true", type: "boolean", label: "Notifier admin : nouveau client", sortOrder: 10 },
  { category: "notifications", key: "admin_new_message", value: "true", type: "boolean", label: "Notifier admin : nouveau message", sortOrder: 20 },
  { category: "notifications", key: "admin_new_payment", value: "true", type: "boolean", label: "Notifier admin : paiement reçu", sortOrder: 30 },
  { category: "notifications", key: "admin_quote_accepted", value: "true", type: "boolean", label: "Notifier admin : devis accepté", sortOrder: 40 },
  { category: "notifications", key: "admin_contract_signed", value: "true", type: "boolean", label: "Notifier admin : contrat signé", sortOrder: 50 },
  { category: "notifications", key: "admin_dispute_opened", value: "true", type: "boolean", label: "Notifier admin : litige ouvert", sortOrder: 60 },
  { category: "notifications", key: "client_new_quote", value: "true", type: "boolean", label: "Notifier client : nouveau devis", sortOrder: 70 },
  { category: "notifications", key: "client_new_invoice", value: "true", type: "boolean", label: "Notifier client : nouvelle facture", sortOrder: 80 },
  { category: "notifications", key: "client_new_document", value: "true", type: "boolean", label: "Notifier client : nouveau document", sortOrder: 90 },
  { category: "notifications", key: "client_new_message", value: "true", type: "boolean", label: "Notifier client : nouveau message", sortOrder: 100 },
  { category: "notifications", key: "quiet_hours_start", value: "22:00", label: "Heures silencieuses début", sortOrder: 110 },
  { category: "notifications", key: "quiet_hours_end", value: "07:00", label: "Heures silencieuses fin", sortOrder: 120 },

  // ─── M. LÉGAL / RGPD ───────────────────────────────────────
  { category: "legal", key: "cookie_banner_enabled", value: "true", type: "boolean", label: "Afficher bandeau de cookies", isPublic: true, sortOrder: 10 },
  { category: "legal", key: "privacy_policy_url", value: "/politique-confidentialite", label: "URL politique de confidentialité", isPublic: true, sortOrder: 20 },
  { category: "legal", key: "terms_of_service_url", value: "/conditions-generales", label: "URL conditions générales", isPublic: true, sortOrder: 30 },
  { category: "legal", key: "gdpr_enabled", value: "true", type: "boolean", label: "Conformité RGPD", sortOrder: 40 },
  { category: "legal", key: "data_retention_days", value: "1095", type: "number", label: "Rétention des données (jours)", description: "1095 = 3 ans", sortOrder: 50 },
  { category: "legal", key: "allow_data_export", value: "true", type: "boolean", label: "Permettre export des données client", sortOrder: 60 },
  { category: "legal", key: "allow_account_deletion", value: "true", type: "boolean", label: "Permettre suppression de compte", sortOrder: 70 },

  // ─── N. BLOG / CMS ─────────────────────────────────────────
  { category: "blog", key: "blog_enabled", value: "false", type: "boolean", label: "Activer le blog", isPublic: true, sortOrder: 10 },
  { category: "blog", key: "blog_path", value: "/blog", label: "URL du blog", isPublic: true, sortOrder: 20 },
  { category: "blog", key: "posts_per_page", value: "10", type: "number", label: "Articles par page", sortOrder: 30 },
  { category: "blog", key: "blog_categories", value: JSON.stringify(["Tutoriels", "Études de cas", "Nouvelles", "Tech"]), type: "json", label: "Catégories disponibles", sortOrder: 40 },

  // ─── O. ANALYTICS & DASHBOARD ──────────────────────────────
  { category: "analytics", key: "track_pageviews", value: "true", type: "boolean", label: "Tracker les pages vues", sortOrder: 10 },
  { category: "analytics", key: "track_session_duration", value: "true", type: "boolean", label: "Tracker durée des sessions", sortOrder: 20 },
  { category: "analytics", key: "hash_ip_addresses", value: "true", type: "boolean", label: "Hasher les IP (RGPD)", sortOrder: 30 },
  { category: "analytics", key: "dashboard_kpi_period", value: "30", type: "number", label: "Période KPI dashboard (jours)", sortOrder: 40 },
];

// ═══════════════════════════════════════════════════════════
// SEED EXECUTION
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log("🌱 Seed : démarrage…");

  // 1) Compte admin principal
  const adminEmail = "vnkautomatisation@gmail.com";
  const existingAdmin = await prisma.admin.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("AdminVNK2026!", 12);
    await prisma.admin.create({
      data: {
        email: adminEmail,
        passwordHash,
        fullName: "Yan Verone Kengne",
        role: AdminRole.super_admin,
        isActive: true,
      },
    });
    console.log("✓ Admin VNK créé (" + adminEmail + ")");
  } else {
    console.log("• Admin VNK déjà présent, non modifié");
  }

  // 2) Settings par défaut (upsert pour idempotence)
  let created = 0;
  let skipped = 0;
  for (const s of SETTINGS) {
    const existing = await prisma.setting.findUnique({
      where: { category_key: { category: s.category, key: s.key } },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.setting.create({
      data: {
        category: s.category,
        key: s.key,
        value: s.value,
        type: s.type ?? "string",
        label: s.label,
        description: s.description,
        isPublic: s.isPublic ?? false,
        isSecret: s.isSecret ?? false,
        sortOrder: s.sortOrder ?? 0,
      },
    });
    created++;
  }
  console.log(`✓ Settings : ${created} créés, ${skipped} déjà présents`);

  // 3) Service catalog de base
  const catalog = [
    { key: "support_plc_hourly", name: "Support PLC à distance", description: "Diagnostic et résolution de pannes", basePrice: 125, priceUnit: "hour", category: "Support", sortOrder: 10 },
    { key: "audit_standard", name: "Audit technique", description: "Évaluation complète du système", basePrice: 2500, priceUnit: "fixed", category: "Audit", sortOrder: 20 },
    { key: "documentation", name: "Documentation industrielle", description: "Procédures et manuels", basePrice: 1500, priceUnit: "fixed", category: "Documentation", sortOrder: 30 },
    { key: "refactoring_plc", name: "Refactorisation PLC", description: "Modernisation code legacy", basePrice: 10000, priceUnit: "fixed", category: "Refactoring", sortOrder: 40 },
  ];
  for (const s of catalog) {
    await prisma.serviceCatalog.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
  console.log("✓ Service catalog seedé (" + catalog.length + " services)");

  console.log("🌱 Seed : terminé.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
