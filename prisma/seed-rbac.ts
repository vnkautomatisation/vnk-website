// Seed des rôles et postes système. Idempotent (upsert).
// Exécution : npx tsx prisma/seed-rbac.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Liste des ressources (doit rester synchronisée avec src/lib/rbac.ts) ──
const RESOURCES = [
  "clients", "invoices", "quotes", "contracts", "mandates", "payments",
  "expenses", "refunds", "disputes", "documents",
  "messages", "calendar", "appointments",
  "transactions", "tax_declarations", "finance", "reconciliation",
  "workflow", "audit_trail",
  "settings", "users", "roles", "positions",
  "integrations", "automations", "branding",
  "blog", "pages", "email_templates", "pdf_templates",
  "industries", "client_tags", "client_sources", "expense_categories",
] as const;

type PermissionsMatrix = Partial<Record<string, string[]>>;

const ROLE_TEMPLATES: Record<string, PermissionsMatrix> = {
  super_admin: Object.fromEntries(RESOURCES.map((r) => [r, ["read", "write", "delete", "export"]])),
  admin: Object.fromEntries(RESOURCES.filter((r) => r !== "roles" && r !== "users").map((r) => [r, ["read", "write", "delete", "export"]])),
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
  viewer: Object.fromEntries(RESOURCES.map((r) => [r, ["read"]])),
};

const POSITION_TEMPLATES = [
  { name: "Super administrateur", description: "Accès complet au portail incluant la gestion des autres administrateurs.", defaultRoleName: "super_admin", department: "Direction", color: "#0F2D52" },
  { name: "Administrateur", description: "Gestion complète des données métier sans accès aux comptes administrateurs.", defaultRoleName: "admin", department: "Direction", color: "#1A5FB4" },
  { name: "Comptable", description: "Comptabilité, facturation, paiements, déclarations fiscales, dépenses.", defaultRoleName: "accountant", department: "Comptabilité", color: "#26A269" },
  { name: "Vendeur", description: "Gestion des clients, devis, contrats, calendrier et messages.", defaultRoleName: "sales", department: "Ventes", color: "#E5A50A" },
  { name: "Support client", description: "Messagerie, documents, litiges, prise de rendez-vous.", defaultRoleName: "support", department: "Support", color: "#613583" },
  { name: "Technicien", description: "Mandats en cours, workflow, documents techniques, calendrier.", defaultRoleName: "technician", department: "Technique", color: "#C01C28" },
];

const ROLE_DEFS = [
  { name: "super_admin", description: "Accès total au portail", color: "#0F2D52", sortOrder: 10 },
  { name: "admin", description: "Administrateur sans accès gestion comptes", color: "#1A5FB4", sortOrder: 20 },
  { name: "accountant", description: "Comptable — finances et fiscalité", color: "#26A269", sortOrder: 30 },
  { name: "sales", description: "Vendeur — clients et devis", color: "#E5A50A", sortOrder: 40 },
  { name: "support", description: "Support — messagerie et documents", color: "#613583", sortOrder: 50 },
  { name: "technician", description: "Technicien — mandats et workflow", color: "#C01C28", sortOrder: 60 },
  { name: "viewer", description: "Consultation uniquement", color: "#6b7280", sortOrder: 70 },
];

async function main() {
  // 1. Rôles système
  const roles: Record<string, number> = {};
  for (const r of ROLE_DEFS) {
    const created = await prisma.role.upsert({
      where: { name: r.name },
      update: {
        description: r.description,
        permissions: ROLE_TEMPLATES[r.name] as never,
        color: r.color,
        sortOrder: r.sortOrder,
        isSystem: true,
      },
      create: {
        name: r.name,
        description: r.description,
        permissions: ROLE_TEMPLATES[r.name] as never,
        color: r.color,
        sortOrder: r.sortOrder,
        isSystem: true,
      },
    });
    roles[r.name] = created.id;
  }
  console.log(`OK ${Object.keys(roles).length} roles seedes`);

  // 2. Postes système
  for (const [i, p] of POSITION_TEMPLATES.entries()) {
    await prisma.position.upsert({
      where: { name: p.name },
      update: {
        description: p.description,
        defaultRoleId: roles[p.defaultRoleName],
        defaultDepartment: p.department,
        color: p.color,
        sortOrder: (i + 1) * 10,
        isSystem: true,
      },
      create: {
        name: p.name,
        description: p.description,
        defaultRoleId: roles[p.defaultRoleName],
        defaultDepartment: p.department,
        color: p.color,
        sortOrder: (i + 1) * 10,
        isSystem: true,
      },
    });
  }
  console.log(`OK ${POSITION_TEMPLATES.length} postes seedes`);
}

main().then(() => prisma.$disconnect()).catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
