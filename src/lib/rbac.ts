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
  // Données métier
  "clients", "invoices", "quotes", "contracts", "mandates", "payments",
  "expenses", "refunds", "disputes", "documents",
  // Communication
  "messages", "calendar", "appointments",
  // Comptabilité
  "transactions", "tax_declarations", "finance", "reconciliation",
  // Système
  "workflow", "audit_trail",
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
  },
  sales: {
    clients: ["read", "write"],
    quotes: ["read", "write", "delete"],
    contracts: ["read", "write"],
    mandates: ["read", "write"],
    invoices: ["read"],
    messages: ["read", "write"],
    calendar: ["read", "write"],
    appointments: ["read", "write", "delete"],
    documents: ["read", "write"],
  },
  support: {
    clients: ["read", "write"],
    messages: ["read", "write", "delete"],
    documents: ["read", "write"],
    disputes: ["read", "write"],
    appointments: ["read", "write"],
    calendar: ["read"],
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
];
