// Seed des catalogues de base (idempotent).
// Exécution : npx tsx prisma/seed-catalogs.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Item = {
  type: string;
  key: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  metadata?: Record<string, unknown>;
  sortOrder?: number;
};

// ── Étiquettes clients (badges visuels sur fiche client) ──
const CLIENT_TAGS: Item[] = [
  { type: "client_tag", key: "vip", name: "VIP", color: "#E5A50A", icon: "Star", sortOrder: 10 },
  { type: "client_tag", key: "manufacturier", name: "Manufacturier", color: "#1A5FB4", icon: "Factory", sortOrder: 20 },
  { type: "client_tag", key: "automatisation", name: "Automatisation", color: "#26A269", icon: "Cog", sortOrder: 30 },
  { type: "client_tag", key: "support_continu", name: "Support continu", color: "#613583", icon: "Headphones", sortOrder: 40 },
  { type: "client_tag", key: "prospect", name: "Prospect", color: "#6b7280", icon: "Eye", sortOrder: 50 },
];

// ── Sources d'acquisition clients ──
const CLIENT_SOURCES: Item[] = [
  { type: "client_source", key: "site_web", name: "Site web", color: "#1A5FB4", icon: "Globe", sortOrder: 10 },
  { type: "client_source", key: "referencement", name: "Référencement", color: "#26A269", icon: "Search", sortOrder: 20 },
  { type: "client_source", key: "bouche_oreille", name: "Bouche-à-oreille", color: "#E5A50A", icon: "MessageCircle", sortOrder: 30 },
  { type: "client_source", key: "linkedin", name: "LinkedIn", color: "#0a66c2", icon: "Linkedin", sortOrder: 40 },
  { type: "client_source", key: "salon", name: "Salon professionnel", color: "#613583", icon: "Calendar", sortOrder: 50 },
  { type: "client_source", key: "publicite", name: "Publicité", color: "#C01C28", icon: "Megaphone", sortOrder: 60 },
  { type: "client_source", key: "autre", name: "Autre", color: "#6b7280", icon: "MoreHorizontal", sortOrder: 100 },
];

// ── Industries / secteurs d'activité ──
const INDUSTRIES: Item[] = [
  { type: "industry", key: "manufacturing", name: "Manufacturier", color: "#1A5FB4", sortOrder: 10 },
  { type: "industry", key: "automotive", name: "Automobile", color: "#C01C28", sortOrder: 20 },
  { type: "industry", key: "aerospace", name: "Aérospatiale", color: "#0F2D52", sortOrder: 30 },
  { type: "industry", key: "food_beverage", name: "Agroalimentaire", color: "#26A269", sortOrder: 40 },
  { type: "industry", key: "pharma", name: "Pharmaceutique / Cosmétique", color: "#613583", sortOrder: 50 },
  { type: "industry", key: "logistics", name: "Logistique / Entreposage", color: "#E5A50A", sortOrder: 60 },
  { type: "industry", key: "energy", name: "Énergie / Mines", color: "#6b7280", sortOrder: 70 },
  { type: "industry", key: "other", name: "Autre", color: "#9ca3af", sortOrder: 100 },
];

// ── Catégories de dépenses (pour comptabilité) ──
const EXPENSE_CATEGORIES: Item[] = [
  { type: "expense_category", key: "equipment", name: "Équipement", color: "#1A5FB4", icon: "Wrench", sortOrder: 10 },
  { type: "expense_category", key: "software", name: "Logiciels & abonnements", color: "#613583", icon: "Box", sortOrder: 20 },
  { type: "expense_category", key: "travel", name: "Déplacement", color: "#E5A50A", icon: "Plane", sortOrder: 30 },
  { type: "expense_category", key: "meals", name: "Repas & représentation", color: "#26A269", icon: "UtensilsCrossed", sortOrder: 40 },
  { type: "expense_category", key: "office", name: "Fournitures de bureau", color: "#6b7280", icon: "Briefcase", sortOrder: 50 },
  { type: "expense_category", key: "marketing", name: "Marketing & publicité", color: "#C01C28", icon: "Megaphone", sortOrder: 60 },
  { type: "expense_category", key: "rent", name: "Loyer & utilités", color: "#0F2D52", icon: "Home", sortOrder: 70 },
  { type: "expense_category", key: "subcontract", name: "Sous-traitance", color: "#9ca3af", icon: "Users", sortOrder: 80 },
  { type: "expense_category", key: "training", name: "Formation", color: "#26A269", icon: "GraduationCap", sortOrder: 90 },
  { type: "expense_category", key: "fees", name: "Honoraires professionnels", color: "#1A5FB4", icon: "FileText", sortOrder: 100 },
  { type: "expense_category", key: "other", name: "Autre", color: "#6b7280", icon: "MoreHorizontal", sortOrder: 200 },
];

// ── Statuts du workflow technique ──
const WORKFLOW_STATUSES: Item[] = [
  { type: "workflow_status", key: "draft", name: "Brouillon", color: "#9ca3af", icon: "FileEdit", sortOrder: 10 },
  { type: "workflow_status", key: "scheduled", name: "Planifié", color: "#1A5FB4", icon: "Calendar", sortOrder: 20 },
  { type: "workflow_status", key: "in_progress", name: "En cours", color: "#E5A50A", icon: "Play", sortOrder: 30 },
  { type: "workflow_status", key: "blocked", name: "Bloqué", color: "#C01C28", icon: "AlertCircle", sortOrder: 40 },
  { type: "workflow_status", key: "review", name: "En révision", color: "#613583", icon: "Eye", sortOrder: 50 },
  { type: "workflow_status", key: "done", name: "Terminé", color: "#26A269", icon: "CheckCircle", sortOrder: 60 },
  { type: "workflow_status", key: "archived", name: "Archivé", color: "#6b7280", icon: "Archive", sortOrder: 70 },
];

// ── Devises supportées (avec code ISO + symbole) ──
const CURRENCIES: Item[] = [
  { type: "currency", key: "CAD", name: "Dollar canadien", color: "#C01C28", metadata: { symbol: "$", iso: "CAD", decimals: 2 }, sortOrder: 10 },
  { type: "currency", key: "USD", name: "Dollar américain", color: "#1A5FB4", metadata: { symbol: "$", iso: "USD", decimals: 2 }, sortOrder: 20 },
  { type: "currency", key: "EUR", name: "Euro", color: "#26A269", metadata: { symbol: "€", iso: "EUR", decimals: 2 }, sortOrder: 30 },
  { type: "currency", key: "GBP", name: "Livre sterling", color: "#613583", metadata: { symbol: "£", iso: "GBP", decimals: 2 }, sortOrder: 40 },
];

// ── Méthodes de paiement acceptées ──
const PAYMENT_METHODS: Item[] = [
  { type: "payment_method", key: "stripe", name: "Stripe (carte de crédit)", color: "#635bff", icon: "CreditCard", sortOrder: 10 },
  { type: "payment_method", key: "etransfer", name: "Virement Interac", color: "#26A269", icon: "Send", sortOrder: 20 },
  { type: "payment_method", key: "bank_transfer", name: "Virement bancaire", color: "#1A5FB4", icon: "Building2", sortOrder: 30 },
  { type: "payment_method", key: "check", name: "Chèque", color: "#6b7280", icon: "FileCheck", sortOrder: 40 },
  { type: "payment_method", key: "cash", name: "Comptant", color: "#E5A50A", icon: "Banknote", sortOrder: 50 },
];

// ── Méthodes de contact préférées ──
const CONTACT_METHODS: Item[] = [
  { type: "contact_method", key: "email", name: "Courriel", color: "#1A5FB4", icon: "Mail", sortOrder: 10 },
  { type: "contact_method", key: "phone", name: "Téléphone", color: "#26A269", icon: "Phone", sortOrder: 20 },
  { type: "contact_method", key: "sms", name: "SMS", color: "#E5A50A", icon: "MessageSquare", sortOrder: 30 },
  { type: "contact_method", key: "in_person", name: "En personne", color: "#613583", icon: "Users", sortOrder: 40 },
];

const ALL: Item[] = [
  ...CLIENT_TAGS,
  ...CLIENT_SOURCES,
  ...INDUSTRIES,
  ...EXPENSE_CATEGORIES,
  ...WORKFLOW_STATUSES,
  ...CURRENCIES,
  ...PAYMENT_METHODS,
  ...CONTACT_METHODS,
];

async function main() {
  let created = 0;
  let updated = 0;
  for (const item of ALL) {
    const result = await prisma.catalogItem.upsert({
      where: { type_key: { type: item.type, key: item.key } },
      update: {
        name: item.name,
        description: item.description ?? null,
        color: item.color ?? "#0F2D52",
        icon: item.icon ?? null,
        metadata: (item.metadata ?? {}) as never,
        sortOrder: item.sortOrder ?? 0,
        isSystem: true,
      },
      create: {
        type: item.type,
        key: item.key,
        name: item.name,
        description: item.description ?? null,
        color: item.color ?? "#0F2D52",
        icon: item.icon ?? null,
        metadata: (item.metadata ?? {}) as never,
        sortOrder: item.sortOrder ?? 0,
        isSystem: true,
        isActive: true,
      },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) created++;
    else updated++;
  }
  console.log(`OK ${created} crees, ${updated} mis a jour (${ALL.length} items)`);
}

main().then(() => prisma.$disconnect()).catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
