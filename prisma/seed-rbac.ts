// Seed des rôles et postes système. Idempotent (upsert).
// Exécution : npx tsx prisma/seed-rbac.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Liste des ressources (doit rester synchronisée avec src/lib/rbac.ts) ──
const RESOURCES = [
  "clients", "invoices", "quotes", "contracts", "mandates", "payments",
  "expenses", "refunds", "disputes", "documents", "requests",
  "messages", "calendar", "appointments", "message_templates",
  "transactions", "tax_declarations", "finance", "reconciliation",
  "hr", "hr_documents", "leaves", "timeclock", "payroll",
  "performance", "safety", "hr_comms",
  "client_portal", "website",
  "workflow", "audit_trail", "statistics",
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
    statistics: ["read"],
    payroll: ["read", "write", "export"],
    timeclock: ["read", "export"],
  },
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
  viewer: Object.fromEntries(RESOURCES.map((r) => [r, ["read"]])),
};

const POSITION_TEMPLATES = [
  // ─── Direction & administration (existants — conserver) ──────
  { name: "Super administrateur", description: "Accès complet au portail incluant la gestion des autres administrateurs.", defaultRoleName: "super_admin", department: "Direction", color: "#0F2D52" },
  { name: "Administrateur", description: "Gestion complète des données métier sans accès aux comptes administrateurs.", defaultRoleName: "admin", department: "Direction", color: "#1A5FB4" },
  { name: "Comptable", description: "Comptabilité, facturation, paiements, déclarations fiscales, dépenses.", defaultRoleName: "accountant", department: "Comptabilité", color: "#26A269" },
  { name: "Vendeur", description: "Gestion des clients, devis, contrats, calendrier et messages.", defaultRoleName: "sales", department: "Ventes", color: "#E5A50A" },
  { name: "Support client", description: "Messagerie, documents, litiges, prise de rendez-vous.", defaultRoleName: "support", department: "Support", color: "#613583" },
  { name: "Technicien", description: "Mandats en cours, workflow, documents techniques, calendrier.", defaultRoleName: "technician", department: "Technique", color: "#C01C28" },

  // ─── Ingénierie & automatisation (postes VNK) ────────────────
  { name: "Programmeur automatisation", description: "Programmation PLC, SCADA, IHM (B&R, Allen-Bradley, Siemens).", defaultRoleName: "technician", department: "Ingénierie", color: "#1565C0" },
  { name: "Programmeur robotique", description: "Programmation robots industriels (FANUC, ABB, KUKA).", defaultRoleName: "technician", department: "Ingénierie", color: "#0277BD" },
  { name: "Technicien automatisation", description: "Installation, mise en service, dépannage systèmes automatisés.", defaultRoleName: "technician", department: "Technique", color: "#C01C28" },
  { name: "Technicien électrique", description: "Câblage, panneaux de contrôle, mise en service électrique.", defaultRoleName: "technician", department: "Technique", color: "#B71C1C" },
  { name: "Technicien mécanique", description: "Assemblage mécanique, alignement, maintenance préventive.", defaultRoleName: "technician", department: "Technique", color: "#880E4F" },
  { name: "Ingénieur électrique", description: "Conception schémas électriques, calculs charges, sélection composants.", defaultRoleName: "technician", department: "Ingénierie", color: "#0D47A1" },
  { name: "Ingénieur mécanique", description: "Conception mécanique, modélisation CAO 3D, calculs structures.", defaultRoleName: "technician", department: "Ingénierie", color: "#1A237E" },
  { name: "Ingénieur logiciel / automatisation", description: "Architecture logicielle systèmes industriels, intégration HMI/MES.", defaultRoleName: "technician", department: "Ingénierie", color: "#311B92" },
  { name: "Concepteur / Dessinateur", description: "Plans CAO (AutoCAD, EPLAN, SolidWorks).", defaultRoleName: "technician", department: "Ingénierie", color: "#4527A0" },
  { name: "Chargé de projet", description: "Gestion de projets clients : échéanciers, budget, coordination équipes.", defaultRoleName: "admin", department: "Gestion de projet", color: "#00695C" },
  { name: "Soumissionnaire / Estimateur", description: "Préparation devis techniques, chiffrage projets automatisation.", defaultRoleName: "sales", department: "Ventes", color: "#F57F17" },
  { name: "Représentant des ventes", description: "Développement nouveaux comptes, suivi clients existants.", defaultRoleName: "sales", department: "Ventes", color: "#E65100" },
  { name: "Coordonnateur SAV", description: "Service après-vente, support technique post-installation.", defaultRoleName: "support", department: "Service après-vente", color: "#4A148C" },
  { name: "Coordonnateur RH", description: "Gestion ressources humaines, paie, conformité CNESST.", defaultRoleName: "hr", department: "Ressources humaines", color: "#1B5E20" },
  { name: "Adjoint(e) administratif", description: "Soutien administratif général, accueil, gestion documents.", defaultRoleName: "admin", department: "Administration", color: "#827717" },
  { name: "Responsable RH", description: "Gestion du personnel : dossiers, congés, paie, documents, conformité.", defaultRoleName: "hr", department: "Ressources humaines", color: "#1B5E20" },
  { name: "Directeur de département", description: "Direction d'une équipe : congés, pointage et évaluations de ses subordonnés (via hiérarchie).", defaultRoleName: "director", department: "Direction", color: "#37474F" },
  { name: "Informaticien / Développeur", description: "Développement et configuration du portail client et du site web : contenu, visuel, intégrations, modèles.", defaultRoleName: "it", department: "TI", color: "#00838F" },
];

const ROLE_DEFS = [
  { name: "super_admin", description: "Accès total au portail", color: "#0F2D52", sortOrder: 10 },
  { name: "admin", description: "Administrateur sans accès gestion comptes", color: "#1A5FB4", sortOrder: 20 },
  { name: "accountant", description: "Comptable — finances et fiscalité", color: "#26A269", sortOrder: 30 },
  { name: "sales", description: "Vendeur — clients et devis", color: "#E5A50A", sortOrder: 40 },
  { name: "support", description: "Support — messagerie et documents", color: "#613583", sortOrder: 50 },
  { name: "technician", description: "Technicien — mandats et workflow", color: "#C01C28", sortOrder: 60 },
  { name: "hr", description: "RH — gestion du personnel (dossiers, congés, paie)", color: "#1B5E20", sortOrder: 62 },
  { name: "director", description: "Directeur — gestion de son équipe via la hiérarchie", color: "#37474F", sortOrder: 64 },
  { name: "it", description: "Informaticien — portail client, site web, intégrations", color: "#00838F", sortOrder: 66 },
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
