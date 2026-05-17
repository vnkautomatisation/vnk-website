// Icônes SVG custom pour la sidebar admin VNK
// Style : dual-tone (trait + remplissage semi-transparent) pour plus de présence visuelle
// que les lucide-icons standard, tout en restant cohérentes avec currentColor.
//
// API : { className?: string } — drop-in compatibles avec les composants lucide.
// viewBox 24x24, stroke courant, fill = currentColor avec opacité réduite pour le secondary.

import { cn } from "@/lib/utils";

type IconProps = { className?: string };

const baseProps = {
  width: "1em",
  height: "1em",
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
} as const;

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const softFill = {
  fill: "currentColor",
  fillOpacity: 0.15,
};

// ─── DASHBOARD : grille de tuiles pleines + tuile accentuée ────
export function DashboardIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" {...softFill} {...stroke} />
      <rect x="14" y="3" width="7" height="5" rx="1.5" {...stroke} />
      <rect x="14" y="12" width="7" height="9" rx="1.5" {...softFill} {...stroke} />
      <rect x="3" y="16" width="7" height="5" rx="1.5" {...stroke} />
    </svg>
  );
}

// ─── WORKFLOW : nœuds connectés (kanban / pipeline) ───────────
export function WorkflowIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <rect x="3" y="3" width="6" height="5" rx="1.5" {...softFill} {...stroke} />
      <rect x="15" y="3" width="6" height="5" rx="1.5" {...stroke} />
      <rect x="9" y="16" width="6" height="5" rx="1.5" {...softFill} {...stroke} />
      <path d="M6 8v3a2 2 0 0 0 2 2h2" {...stroke} />
      <path d="M18 8v3a2 2 0 0 1-2 2h-2" {...stroke} />
      <path d="M12 13v3" {...stroke} />
    </svg>
  );
}

// ─── CLIENTS : 3 personnes (lead avant + 2 derrière) ──────────
export function ClientsIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <circle cx="9" cy="8" r="3.5" {...softFill} {...stroke} />
      <path d="M2.5 19c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6" {...stroke} />
      <circle cx="17" cy="6.5" r="2.5" {...stroke} />
      <path d="M15 13h.5c2.5 0 5 1.7 5 4.5" {...stroke} />
    </svg>
  );
}

// ─── OPERATIONS : mallette avec poignée + détail serrure ──────
export function OperationsIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <path d="M9 4h6a1 1 0 0 1 1 1v3" {...stroke} />
      <rect x="3" y="7" width="18" height="13" rx="2" {...softFill} {...stroke} />
      <path d="M3 13h18" {...stroke} />
      <path d="M11 12v2.5" {...stroke} />
      <path d="M13 12v2.5" {...stroke} />
    </svg>
  );
}

// ─── MANDATES : document avec sceau / signature ───────────────
export function MandatesIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <path d="M5 3h9l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" {...softFill} {...stroke} />
      <path d="M14 3v5h5" {...stroke} />
      <circle cx="11" cy="15" r="2.5" {...stroke} />
      <path d="M11 17.5v3" {...stroke} />
      <path d="M9.5 19.5L11 21l1.5-1.5" {...stroke} />
    </svg>
  );
}

// ─── REQUESTS : boîte de réception avec enveloppes empilées ───
export function RequestsIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <path d="M3 13l3-9h12l3 9" {...stroke} />
      <path d="M3 13v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6" {...softFill} {...stroke} />
      <path d="M3 13h5l1.5 2h5l1.5-2h5" {...stroke} />
    </svg>
  );
}

// ─── CALENDAR : calendrier avec un jour mis en évidence ───────
export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <rect x="3" y="5" width="18" height="16" rx="2" {...softFill} {...stroke} />
      <path d="M3 10h18" {...stroke} />
      <path d="M8 3v4" {...stroke} />
      <path d="M16 3v4" {...stroke} />
      <rect x="11" y="13" width="3" height="3" rx="0.5" fill="currentColor" />
    </svg>
  );
}

// ─── QUOTES : document avec lignes texte + ratio $ ────────────
export function QuotesIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <path d="M5 3h9l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" {...softFill} {...stroke} />
      <path d="M14 3v5h5" {...stroke} />
      <path d="M7 12h7" {...stroke} />
      <path d="M7 15h10" {...stroke} />
      <path d="M7 18h5" {...stroke} />
    </svg>
  );
}

// ─── INVOICES : reçu/facture déchirée en bas ──────────────────
export function InvoicesIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <path d="M5 3h14a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2-3-2v-15a1 1 0 0 1 1-1Z" {...softFill} {...stroke} />
      <path d="M9 8h6" {...stroke} />
      <path d="M9 12h6" {...stroke} />
      <path d="M12 14v3" {...stroke} />
      <path d="M10 15.5h4" {...stroke} />
    </svg>
  );
}

// ─── COMMUNICATION : avion en papier avec ligne de trajet ─────
export function CommunicationIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <path d="M21 3 11 13" {...stroke} />
      <path d="M21 3l-7 18-3-8-8-3 18-7Z" {...softFill} {...stroke} />
    </svg>
  );
}

// ─── MESSAGES : double bulle de chat ──────────────────────────
export function MessagesIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <path d="M3 7a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H9l-4 3v-3a3 3 0 0 1-2-3V7Z" {...softFill} {...stroke} />
      <path d="M21 11v3a3 3 0 0 1-3 3h-1" {...stroke} />
      <circle cx="8" cy="9.5" r="0.7" fill="currentColor" />
      <circle cx="11" cy="9.5" r="0.7" fill="currentColor" />
      <circle cx="14" cy="9.5" r="0.7" fill="currentColor" />
    </svg>
  );
}

// ─── TEMPLATES : éclair (raccourcis automatisés) ──────────────
export function TemplatesIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <path d="M13 2 4 14h7l-2 8 9-12h-7l2-8Z" {...softFill} {...stroke} />
    </svg>
  );
}

// ─── DOCUMENTS : dossier ouvert avec onglet ───────────────────
export function DocumentsIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v3" {...stroke} />
      <path d="M3 8h17.5a1.5 1.5 0 0 1 1.5 1.7l-1.4 9A2 2 0 0 1 18.6 20H4.5A1.5 1.5 0 0 1 3 18.5V8Z" {...softFill} {...stroke} />
    </svg>
  );
}

// ─── LEGAL : balance de la justice ────────────────────────────
export function LegalIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <path d="M12 3v18" {...stroke} />
      <path d="M5 8h14" {...stroke} />
      <path d="M8 3h8" strokeOpacity="0" />
      <path d="M5.5 21h13" {...stroke} />
      <path d="M5 8 2.5 14h6L6 8" {...softFill} {...stroke} />
      <path d="M19 8l-2.5 6h6L21 8" {...softFill} {...stroke} />
      <circle cx="12" cy="5" r="1.3" fill="currentColor" />
    </svg>
  );
}

// ─── CONTRACTS : document avec signature stylisée ─────────────
export function ContractsIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <path d="M5 3h9l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" {...softFill} {...stroke} />
      <path d="M14 3v5h5" {...stroke} />
      <path d="M7 16c1.5 0 2-2 3.5-2s2 2 3.5 2 2-2 3.5-2" {...stroke} />
    </svg>
  );
}

// ─── DISPUTES : triangle d'alerte avec exclamation ────────────
export function DisputesIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <path d="M10.5 3.5 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.5 3.5a2 2 0 0 0-3 0Z" {...softFill} {...stroke} />
      <path d="M12 9v4" {...stroke} />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" />
    </svg>
  );
}

// ─── FINANCE GROUP : graphique en croissance + $ ──────────────
export function FinanceGroupIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <path d="M3 17l5-5 4 3 4-6 5 5" {...stroke} />
      <path d="M3 17l5-5 4 3 4-6 5 5v4H3v-1Z" {...softFill} />
      <circle cx="8" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="15" r="1" fill="currentColor" />
      <circle cx="16" cy="9" r="1" fill="currentColor" />
      <circle cx="21" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}

// ─── FINANCE SUMMARY : tendance avec flèche ──────────────────
export function FinanceSummaryIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <path d="M3 17l5-5 4 4 6-7" {...stroke} />
      <path d="M14 9h5v5" {...stroke} />
      <rect x="2" y="20" width="20" height="1.2" rx="0.6" {...softFill} />
    </svg>
  );
}

// ─── STATISTICS : 3 barres + axe ─────────────────────────────
export function StatisticsIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <rect x="4" y="13" width="3.5" height="7" rx="0.6" {...softFill} {...stroke} />
      <rect x="10.25" y="9" width="3.5" height="11" rx="0.6" {...softFill} {...stroke} />
      <rect x="16.5" y="5" width="3.5" height="15" rx="0.6" {...softFill} {...stroke} />
      <path d="M3 20h18" {...stroke} />
    </svg>
  );
}

// ─── PAYMENTS GROUP : carte avec puce + bande ─────────────────
export function PaymentsGroupIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" {...softFill} {...stroke} />
      <path d="M2.5 10h19" {...stroke} />
      <rect x="5" y="13.5" width="3" height="2.5" rx="0.5" fill="currentColor" />
      <path d="M14 16h4" {...stroke} />
    </svg>
  );
}

// ─── TRANSACTIONS : carte CC stylisée ─────────────────────────
export function TransactionsIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" {...softFill} {...stroke} />
      <path d="M2.5 9h19" {...stroke} />
      <path d="M6 14h2" {...stroke} />
      <path d="M10 14h6" {...stroke} />
    </svg>
  );
}

// ─── RECONCILIATION : double check ───────────────────────────
export function ReconciliationIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <circle cx="12" cy="12" r="9" {...softFill} {...stroke} />
      <path d="M7 12.5l3 3 7-7" {...stroke} />
      <path d="M11 15.5l1 1" {...stroke} strokeOpacity="0.5" />
    </svg>
  );
}

// ─── SETTLEMENTS : 3 lignes calendrier (3 dates : paiement / règlement / versement) + $ ──
export function SettlementsIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <rect x="3" y="5" width="18" height="16" rx="2" {...softFill} {...stroke} />
      <path d="M3 10h18" {...stroke} />
      <path d="M8 3v4" {...stroke} />
      <path d="M16 3v4" {...stroke} />
      <path d="M7 14h4" {...stroke} />
      <path d="M7 17h6" {...stroke} />
      <circle cx="16" cy="16" r="2.5" {...stroke} />
      <path d="M16 14.5v3" {...stroke} />
    </svg>
  );
}

// ─── PAYOUTS : flèche descendante vers banque ─────────────────
export function PayoutsIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <path d="M12 3v11" {...stroke} />
      <path d="M7 9l5 5 5-5" {...stroke} />
      <path d="M3 17h18" {...stroke} />
      <rect x="3" y="17" width="18" height="4" rx="1" {...softFill} {...stroke} />
      <path d="M7 19h2" {...stroke} />
      <path d="M11 19h2" {...stroke} />
      <path d="M15 19h2" {...stroke} />
    </svg>
  );
}

// ─── RECEIPTS : reçu avec en-tête $ + lignes ─────────────────
export function ReceiptsIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <path d="M5 3h14a1 1 0 0 1 1 1v17l-2.5-2-2.5 2-2.5-2-2.5 2-2.5-2-2.5 2v-17a1 1 0 0 1 1-1Z" {...softFill} {...stroke} />
      <circle cx="12" cy="8" r="2" {...stroke} />
      <path d="M12 6v0.5M12 9.5V10" {...stroke} />
      <path d="M7 13h10" {...stroke} />
      <path d="M7 16h7" {...stroke} />
    </svg>
  );
}

// ─── REFUNDS : flèche circulaire en arrière + $ ───────────────
export function RefundsIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <path d="M3 12a9 9 0 1 0 3-6.7" {...stroke} />
      <path d="M3 4v5h5" {...stroke} />
      <path d="M14 10v0.5M14 14v0.5" {...stroke} strokeOpacity="0.6" />
      <path d="M11.5 11.5h4a1.2 1.2 0 0 1 0 2.5h-3a1.2 1.2 0 0 0 0 2.5h4" {...stroke} />
    </svg>
  );
}

// ─── ACCOUNTING GROUP : calculatrice avec touches ─────────────
export function AccountingGroupIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <rect x="4" y="2.5" width="16" height="19" rx="2" {...softFill} {...stroke} />
      <rect x="7" y="5" width="10" height="3" rx="0.5" {...stroke} />
      <circle cx="8.5" cy="11.5" r="0.9" fill="currentColor" />
      <circle cx="12" cy="11.5" r="0.9" fill="currentColor" />
      <circle cx="15.5" cy="11.5" r="0.9" fill="currentColor" />
      <circle cx="8.5" cy="14.5" r="0.9" fill="currentColor" />
      <circle cx="12" cy="14.5" r="0.9" fill="currentColor" />
      <circle cx="15.5" cy="14.5" r="0.9" fill="currentColor" />
      <circle cx="8.5" cy="17.5" r="0.9" fill="currentColor" />
      <circle cx="12" cy="17.5" r="0.9" fill="currentColor" />
      <circle cx="15.5" cy="17.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

// ─── EXPENSES : portefeuille avec billet visible ──────────────
export function ExpensesIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <path d="M3 7a2 2 0 0 1 2-2h12l2 3" {...stroke} />
      <rect x="3" y="7" width="18" height="13" rx="2" {...softFill} {...stroke} />
      <path d="M16 13.5h5" {...stroke} />
      <circle cx="17.5" cy="13.5" r="1.5" {...stroke} />
    </svg>
  );
}

// ─── FX RATES : billet avec symboles devises ──────────────────
export function FxRatesIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <rect x="2.5" y="6" width="19" height="12" rx="1.5" {...softFill} {...stroke} />
      <circle cx="12" cy="12" r="2.5" {...stroke} />
      <path d="M5 9.5h1.5M5 14.5h1.5" {...stroke} />
      <path d="M17.5 9.5h1.5M17.5 14.5h1.5" {...stroke} />
    </svg>
  );
}

// ─── TAX DECLARATIONS : doc avec barres + check fiscal ────────
export function TaxDeclarationsIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <path d="M5 3h9l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" {...softFill} {...stroke} />
      <path d="M14 3v5h5" {...stroke} />
      <rect x="7" y="13" width="2" height="5" rx="0.4" fill="currentColor" />
      <rect x="11" y="11" width="2" height="7" rx="0.4" fill="currentColor" />
      <rect x="15" y="14" width="2" height="4" rx="0.4" fill="currentColor" />
    </svg>
  );
}

// ─── AUDIT TRAIL : ligne de pulse / activité ──────────────────
export function AuditTrailIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <path d="M3 12h4l2-7 4 14 2-7h6" {...stroke} />
      <path d="M3 19h18" {...stroke} strokeOpacity="0.4" />
    </svg>
  );
}

// ─── PROFILE : personne dans un cercle ────────────────────────
export function ProfileIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <circle cx="12" cy="12" r="9" {...softFill} {...stroke} />
      <circle cx="12" cy="10" r="3" {...stroke} />
      <path d="M5.5 19c1.5-3 4-4.5 6.5-4.5s5 1.5 6.5 4.5" {...stroke} />
    </svg>
  );
}

// ─── SETTINGS : engrenage avec rouages internes ───────────────
export function SettingsIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={cn(className)}>
      <path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4M18.7 18.7l-1.4-1.4M6.7 6.7 5.3 5.3" {...stroke} />
      <circle cx="12" cy="12" r="6" {...softFill} {...stroke} />
      <circle cx="12" cy="12" r="2.5" {...stroke} />
    </svg>
  );
}
