// Variables dynamiques pour les templates de messages
// + parser conditional {{#if var}}...{{/if}}

export type VariableDef = { key: string; label: string; example: string; group: string };

export const TEMPLATE_VARIABLES: VariableDef[] = [
  // Client
  { key: "client_name", label: "Nom complet du client", example: "Jean Tremblay", group: "Client" },
  { key: "client_first_name", label: "Prénom du client", example: "Jean", group: "Client" },
  { key: "client_last_name", label: "Nom de famille", example: "Tremblay", group: "Client" },
  { key: "client_company", label: "Entreprise du client", example: "ACME Inc.", group: "Client" },
  { key: "client_email", label: "Courriel du client", example: "jean@acme.com", group: "Client" },
  { key: "client_phone", label: "Téléphone du client", example: "514-555-1234", group: "Client" },
  { key: "client_city", label: "Ville du client", example: "Montréal", group: "Client" },
  { key: "client_address", label: "Adresse du client", example: "123 rue Principale", group: "Client" },

  // Admin
  { key: "admin_name", label: "Votre nom", example: "Yan Verone", group: "Admin" },
  { key: "admin_email", label: "Votre courriel", example: "yan@vnkautomatisation.ca", group: "Admin" },
  { key: "admin_phone", label: "Votre téléphone", example: "450-555-9876", group: "Admin" },
  { key: "admin_signature", label: "Signature complète", example: "Cordialement,\nYan Verone\nVNK Automatisation", group: "Admin" },

  // Entreprise
  { key: "company", label: "Nom entreprise", example: "VNK Automatisation", group: "Entreprise" },
  { key: "company_address", label: "Adresse entreprise", example: "...", group: "Entreprise" },
  { key: "company_phone", label: "Téléphone entreprise", example: "...", group: "Entreprise" },
  { key: "company_email", label: "Courriel entreprise", example: "info@vnkautomatisation.ca", group: "Entreprise" },
  { key: "portal_url", label: "URL du portail client", example: "https://vnk.ca/portail", group: "Entreprise" },
  { key: "website_url", label: "URL du site web", example: "https://vnkautomatisation.ca", group: "Entreprise" },

  // Date / Heure
  { key: "date", label: "Date du jour", example: "10 mai 2026", group: "Temps" },
  { key: "date_short", label: "Date courte (AAAA-MM-JJ)", example: "2026-05-10", group: "Temps" },
  { key: "time", label: "Heure", example: "14:30", group: "Temps" },
  { key: "day", label: "Jour de la semaine", example: "lundi", group: "Temps" },
  { key: "month", label: "Mois en lettres", example: "mai", group: "Temps" },
  { key: "year", label: "Année", example: "2026", group: "Temps" },
  { key: "tomorrow", label: "Date de demain", example: "11 mai 2026", group: "Temps" },
  { key: "next_week", label: "Date dans 7 jours", example: "17 mai 2026", group: "Temps" },

  // Documents (utilisé seulement si template appliqué dans le contexte)
  { key: "quote_number", label: "Numéro de devis (contexte)", example: "D-2026-001", group: "Documents" },
  { key: "quote_amount", label: "Montant devis TTC", example: "1 250,00 $", group: "Documents" },
  { key: "invoice_number", label: "Numéro de facture (contexte)", example: "F-2026-042", group: "Documents" },
  { key: "invoice_amount", label: "Montant facture TTC", example: "874,33 $", group: "Documents" },
  { key: "invoice_due_date", label: "Date d'échéance facture", example: "15 juin 2026", group: "Documents" },
  { key: "contract_number", label: "Numéro de contrat", example: "CT-2026-007", group: "Documents" },
  { key: "appointment_date", label: "Date du rendez-vous", example: "12 mai 2026", group: "Documents" },
  { key: "appointment_time", label: "Heure du rendez-vous", example: "10:00", group: "Documents" },
];

export type TemplateContext = {
  clientName?: string | null;
  clientFirstName?: string | null;
  clientLastName?: string | null;
  clientCompany?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientCity?: string | null;
  clientAddress?: string | null;
  adminName?: string | null;
  adminEmail?: string | null;
  adminPhone?: string | null;
  adminSignature?: string | null;
  companyName?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  portalUrl?: string | null;
  websiteUrl?: string | null;
  // Doc context
  quoteNumber?: string | null;
  quoteAmount?: string | null;
  invoiceNumber?: string | null;
  invoiceAmount?: string | null;
  invoiceDueDate?: string | null;
  contractNumber?: string | null;
  appointmentDate?: string | null;
  appointmentTime?: string | null;
};

const FR_MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const FR_DAYS = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];

function buildVarMap(ctx: TemplateContext): Record<string, string> {
  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(now); nextWeek.setDate(nextWeek.getDate() + 7);
  const fmtFull = (d: Date) => `${d.getDate()} ${FR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const fmtShort = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const firstName = ctx.clientFirstName ?? (ctx.clientName ? ctx.clientName.split(/\s+/)[0] : "");
  const lastName = ctx.clientLastName ?? (ctx.clientName ? ctx.clientName.split(/\s+/).slice(1).join(" ") : "");
  return {
    client_name: ctx.clientName ?? "",
    client_first_name: firstName,
    client_last_name: lastName,
    client_company: ctx.clientCompany ?? "",
    client_email: ctx.clientEmail ?? "",
    client_phone: ctx.clientPhone ?? "",
    client_city: ctx.clientCity ?? "",
    client_address: ctx.clientAddress ?? "",
    admin_name: ctx.adminName ?? "",
    admin_email: ctx.adminEmail ?? "",
    admin_phone: ctx.adminPhone ?? "",
    admin_signature: ctx.adminSignature ?? "",
    company: ctx.companyName ?? "VNK Automatisation",
    company_address: ctx.companyAddress ?? "",
    company_phone: ctx.companyPhone ?? "",
    company_email: ctx.companyEmail ?? "",
    portal_url: ctx.portalUrl ?? "https://vnkautomatisation.ca/portail",
    website_url: ctx.websiteUrl ?? "https://vnkautomatisation.ca",
    date: fmtFull(now),
    date_short: fmtShort(now),
    time: now.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }),
    day: FR_DAYS[now.getDay()],
    month: FR_MONTHS[now.getMonth()],
    year: String(now.getFullYear()),
    tomorrow: fmtFull(tomorrow),
    next_week: fmtFull(nextWeek),
    quote_number: ctx.quoteNumber ?? "",
    quote_amount: ctx.quoteAmount ?? "",
    invoice_number: ctx.invoiceNumber ?? "",
    invoice_amount: ctx.invoiceAmount ?? "",
    invoice_due_date: ctx.invoiceDueDate ?? "",
    contract_number: ctx.contractNumber ?? "",
    appointment_date: ctx.appointmentDate ?? "",
    appointment_time: ctx.appointmentTime ?? "",
  };
}

// Resout les blocs conditionnels :
// {{#if client_company}}Entreprise : {{client_company}}{{/if}}
// {{#if client_company}}OUI{{else}}NON{{/if}}
function resolveConditionals(body: string, vars: Record<string, string>): string {
  const ifElseRegex = /\{\{#if\s+(\w+)\s*\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g;
  const ifRegex = /\{\{#if\s+(\w+)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g;
  let out = body;
  out = out.replace(ifElseRegex, (_m, key, ifBlock, elseBlock) => {
    return vars[key] && vars[key].length > 0 ? ifBlock : elseBlock;
  });
  out = out.replace(ifRegex, (_m, key, ifBlock) => {
    return vars[key] && vars[key].length > 0 ? ifBlock : "";
  });
  return out;
}

export function expandTemplateVariables(body: string, ctx: TemplateContext): string {
  const vars = buildVarMap(ctx);
  let out = resolveConditionals(body, vars);
  out = out.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) => {
    return name in vars ? vars[name] : match;
  });
  return out;
}

// Detecte les variables invalides dans un body (typos)
export function findInvalidVariables(body: string): string[] {
  const known = new Set(TEMPLATE_VARIABLES.map((v) => v.key));
  const invalid: string[] = [];
  const re = /\{\{\s*(\w+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const name = m[1];
    if (name === "else") continue;
    if (!known.has(name)) invalid.push(name);
  }
  return Array.from(new Set(invalid));
}

// Mini markdown -> HTML (pour preview email)
export function markdownToHtml(md: string): string {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/__(.+?)__/g, "<u>$1</u>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" style="color:#0F2D52">$1</a>')
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n/g, "<br>");
}
