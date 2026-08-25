// ─────────────────────────────────────────────────────────
// Contrôle d'accès basé sur les rôles (RBAC) avec matrice
// granulaire : { ressource: ["read","write","delete","export"] }
//
// Ressources connues du portail :
//   clients · invoices · quotes · contracts · mandates · payments
//   expenses · refunds · disputes · messages · calendar · documents
//   transactions · tax_declarations · audit_trail · finance · workflow
//   settings · users · roles · positions · integrations · automations
//   blog · pages · email_templates · pdf_templates · branding
// ─────────────────────────────────────────────────────────
import "server-only";

export const RESOURCES = [
  // Données métier (côté CLIENTS — ne pas confondre avec les ressources RH)
  "clients", "invoices", "quotes", "contracts", "mandates", "payments",
  "expenses", "refunds", "disputes", "documents", "requests",
  // Communication
  "messages", "calendar", "appointments", "message_templates",
  // Comptabilité
  "transactions", "tax_declarations", "finance", "reconciliation",
  // Ressources humaines (module /admin/employes) :
  //   hr           = passe-partout du module : dossiers, liste, notes,
  //                  onboarding/offboarding, lettres, rapports. hr.write
  //                  donne AUSSI accès à tous les domaines RH ci-dessous.
  //   hr_documents = documents & signatures RH, cahiers, bibliothèque,
  //                  contrats d'emploi, politiques RH
  //   leaves       = congés : approbations globales, fenêtres, politiques
  //   timeclock    = pointage + codes de tâche
  //   payroll      = paie, salaires/bonus, docs fiscaux (T4/RL-1)
  //   performance  = évaluations, 1-on-1
  //   safety       = CNESST, formations, permis professionnels
  //   hr_comms     = annonces internes
  // NB : l'accès "mon équipe seulement" des managers/directeurs ne passe PAS
  // par ces permissions — il vient de la hiérarchie (Admin.managerId /
  // Team.leadAdminId, cf. timesheet-scope.ts).
  "hr", "hr_documents", "leaves", "timeclock", "payroll",
  "performance", "safety", "hr_comms",
  // Portail client & site web (config depuis l'admin) :
  //   client_portal = configuration & visuel du portail client
  //   website       = site web public (apparence, config, contenu technique)
  "client_portal", "website",
  // Système
  "workflow", "audit_trail", "statistics",
  // Configuration
  "settings", "users", "roles", "positions",
  "integrations", "automations", "branding",
  "blog", "pages", "email_templates", "pdf_templates",
  "industries", "client_tags", "client_sources", "expense_categories",
] as const;

export type Resource = typeof RESOURCES[number];
export type Action = "read" | "write" | "delete" | "export";

export type PermissionsMatrix = Partial<Record<Resource, Action[]>>;

// ── Permissions par défaut pour les rôles système ──────────
export const ROLE_TEMPLATES: Record<string, PermissionsMatrix> = {
  super_admin: Object.fromEntries(RESOURCES.map((r) => [r, ["read", "write", "delete", "export"]])) as PermissionsMatrix,
  admin: Object.fromEntries(RESOURCES.filter((r) => r !== "roles" && r !== "users").map((r) => [r, ["read", "write", "delete", "export"]])) as PermissionsMatrix,
  accountant: {
    clients: ["read"],
    invoices: ["read", "write", "export"],
    payments: ["read", "write", "export"],
    refunds: ["read", "write"],
    expenses: ["read", "write", "delete", "export"],
    transactions: ["read", "write", "export"],
    tax_declarations: ["read", "write", "export"],
    finance: ["read", "export"],
    reconciliation: ["read", "write"],
    documents: ["read"],
    audit_trail: ["read"],
    statistics: ["read"],
    // Paie : le comptable gère la paie, le pointage et les docs fiscaux
    payroll: ["read", "write", "export"],
    timeclock: ["read", "export"],
  },
  // RH — gestion du personnel : tout le module /admin/employes sans la
  // gestion des comptes admin (users/roles restent super_admin).
  hr: {
    hr: ["read", "write", "delete", "export"],
    hr_documents: ["read", "write", "delete", "export"],
    leaves: ["read", "write", "export"],
    timeclock: ["read", "write", "export"],
    payroll: ["read", "write", "export"],
    performance: ["read", "write", "export"],
    safety: ["read", "write", "export"],
    hr_comms: ["read", "write", "delete"],
    users: ["read"],
    documents: ["read", "write"],
    calendar: ["read"],
    messages: ["read", "write"],
    audit_trail: ["read"],
  },
  // Informaticien / Développeur : gère le développement et la configuration
  // du portail client ET du site web depuis l'admin. Aucune donnée métier
  // (clients/factures) ni RH.
  it: {
    client_portal: ["read", "write", "delete", "export"],
    website: ["read", "write", "delete", "export"],
    blog: ["read", "write", "delete"],
    pages: ["read", "write", "delete"],
    email_templates: ["read", "write"],
    pdf_templates: ["read", "write"],
    branding: ["read", "write"],
    integrations: ["read", "write", "delete"],
    automations: ["read", "write"],
    settings: ["read"],
    workflow: ["read"],
    audit_trail: ["read"],
    statistics: ["read"],
  },
  // Directeur de département : PAS de permission RH globale — son accès
  // congés/pointage/évaluations est limité à SON équipe via la hiérarchie
  // (managerId / leadAdminId). Le rôle couvre le reste de son quotidien.
  director: {
    clients: ["read"],
    mandates: ["read", "write"],
    workflow: ["read", "write"],
    documents: ["read", "write"],
    messages: ["read", "write"],
    calendar: ["read", "write"],
    appointments: ["read", "write"],
    audit_trail: ["read"],
  },
  sales: {
    clients: ["read", "write"],
    quotes: ["read", "write", "delete"],
    contracts: ["read", "write"],
    mandates: ["read", "write"],
    invoices: ["read"],
    requests: ["read", "write"],
    messages: ["read", "write"],
    calendar: ["read", "write"],
    appointments: ["read", "write", "delete"],
    message_templates: ["read"],
    documents: ["read", "write"],
  },
  support: {
    clients: ["read", "write"],
    messages: ["read", "write", "delete"],
    documents: ["read", "write"],
    disputes: ["read", "write"],
    requests: ["read", "write"],
    appointments: ["read", "write"],
    calendar: ["read"],
    message_templates: ["read", "write"],
  },
  technician: {
    clients: ["read"],
    mandates: ["read", "write"],
    documents: ["read", "write"],
    workflow: ["read", "write"],
    messages: ["read", "write"],
    calendar: ["read", "write"],
  },
  viewer: Object.fromEntries(RESOURCES.map((r) => [r, ["read"]])) as PermissionsMatrix,
};

// ── Helper : vérifier si une matrice autorise une action ──
export function hasPermission(matrix: PermissionsMatrix | null | undefined, resource: Resource, action: Action): boolean {
  if (!matrix) return false;
  return (matrix[resource] ?? []).includes(action);
}

// ── Postes prédéfinis (templates de profils) ──────────────
export const POSITION_TEMPLATES = [
  { name: "Super administrateur", description: "Accès complet au portail incluant la gestion des autres administrateurs.", defaultRoleName: "super_admin", department: "Direction", color: "#0F2D52" },
  { name: "Administrateur", description: "Gestion complète des données métier sans accès aux comptes administrateurs.", defaultRoleName: "admin", department: "Direction", color: "#1A5FB4" },
  { name: "Comptable", description: "Comptabilité, facturation, paiements, déclarations fiscales, dépenses.", defaultRoleName: "accountant", department: "Comptabilité", color: "#26A269" },
  { name: "Vendeur", description: "Gestion des clients, devis, contrats, calendrier et messages.", defaultRoleName: "sales", department: "Ventes", color: "#E5A50A" },
  { name: "Support client", description: "Messagerie, documents, litiges, prise de rendez-vous.", defaultRoleName: "support", department: "Support", color: "#613583" },
  { name: "Technicien", description: "Mandats en cours, workflow, documents techniques, calendrier.", defaultRoleName: "technician", department: "Technique", color: "#C01C28" },
  { name: "Responsable RH", description: "Gestion du personnel : dossiers, congés, paie, documents, conformité.", defaultRoleName: "hr", department: "Ressources humaines", color: "#1B5E20" },
  { name: "Directeur de département", description: "Direction d'une équipe : congés, pointage et évaluations de ses subordonnés (via hiérarchie).", defaultRoleName: "director", department: "Direction", color: "#37474F" },
  { name: "Informaticien / Développeur", description: "Développement et configuration du portail client et du site web : contenu, visuel, intégrations, modèles.", defaultRoleName: "it", department: "TI", color: "#00838F" },
];
