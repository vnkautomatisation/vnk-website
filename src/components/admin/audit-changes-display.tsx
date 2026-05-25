"use client";
// Affichage humain des changements d'un AuditLog (jamais de JSON brut côté utilisateur).
// Sert dans les modaux Historique de demandes de congé, pointage, etc.
// Le but : transformer { decision: "approved" } → "Décision : Approuvée"
import { Badge } from "@/components/ui/badge";

// ─── Mappings FR ─────────────────────────────────────────────────
const ACTION_LABELS: Record<string, { label: string; tone: string }> = {
  create: { label: "Création", tone: "bg-cyan-50 text-cyan-800 border-cyan-200" },
  update: { label: "Modification", tone: "bg-amber-50 text-amber-800 border-amber-200" },
  delete: { label: "Suppression", tone: "bg-red-50 text-red-800 border-red-200" },
  approve: { label: "Approbation", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  reject: { label: "Refus", tone: "bg-red-50 text-red-800 border-red-200" },
};

const TYPE_LABELS: Record<string, string> = {
  vacation: "Vacances", sick: "Maladie", parental: "Parental",
  unpaid: "Sans solde", bereavement: "Décès", other: "Autre congé",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "En attente", approved: "Approuvée", rejected: "Refusée", cancelled: "Annulée",
};
const DECISION_LABELS: Record<string, string> = { approved: "Approuvée", rejected: "Refusée" };
const HALF_LABELS: Record<string, string> = { AM: "Avant-midi", PM: "Après-midi" };

// Labels des clés (changes) → libellé FR
const FIELD_LABELS: Record<string, string> = {
  decision: "Décision",
  notes: "Note de revue",
  reason: "Raison",
  type: "Type de congé",
  startDate: "Date de début",
  endDate: "Date de fin",
  status: "Statut",
  halfDay: "Demi-journée",
  daysCount: "Nombre de jours",
  diff: "Modifications",
  adminEdit: "Modification administrative",
  adminCancelled: "Annulation administrative",
  adminDelete: "Suppression administrative",
  snapshot: "État avant suppression",
  mandatoryClosure: "Fermeture obligatoire",
  duplicatedFrom: "Dupliquée depuis la demande",
  newId: "Nouvelle demande créée",
  attachmentUrl: "Justificatif",
  attachmentName: "Nom du fichier joint",
  delegateApprovalTo: "Délégation d'approbation",
  blocked: "Soumissions bloquées",
  unblocked: "Soumissions débloquées",
  blockedUntil: "Bloqué jusqu'au",
  blockedReason: "Raison du blocage",
  policyId: "Politique de congés",
  policyName: "Politique de congés",
  balanceDelta: "Ajustement de solde",
  delta: "Ajustement",
  created: "Créé(s)",
  skipped: "Ignoré(s)",
  conflicts: "Conflit(s)",
  period: "Période",
  unapproved: "Approbation retirée",
  convertedFrom: "Type d'origine",
  convertedTo: "Nouveau type",
};

// ─── Helpers de formatage ────────────────────────────────────────
function isISODate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);
}

function formatDate(v: string): string {
  return new Date(v).toLocaleDateString("fr-CA");
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "number") return value.toString();
  if (typeof value === "string") {
    // Décisions / statuts / types / demi-journée
    if (key === "decision") return DECISION_LABELS[value] ?? value;
    if (key === "status" || key.endsWith("Status")) return STATUS_LABELS[value] ?? value;
    if (key === "type" || key === "convertedFrom" || key === "convertedTo") return TYPE_LABELS[value] ?? value;
    if (key === "halfDay") return HALF_LABELS[value] ?? value;
    if (isISODate(value)) return formatDate(value);
    return value;
  }
  // Objets : recursive humanisation
  if (typeof value === "object") {
    try {
      return Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => `${FIELD_LABELS[k] ?? k} : ${formatValue(k, v)}`)
        .join(" · ");
    } catch {
      return "(détails complexes)";
    }
  }
  return String(value);
}

// ─── Composant principal ─────────────────────────────────────────
export function AuditActionBadge({ action }: { action: string }) {
  const meta = ACTION_LABELS[action] ?? { label: action, tone: "bg-slate-50 text-slate-800 border-slate-200" };
  return (
    <Badge variant="outline" className={`text-[10px] uppercase ${meta.tone}`}>
      {meta.label}
    </Badge>
  );
}

export function AuditChangesDisplay({
  changes,
}: {
  changes: Record<string, unknown> | null | undefined;
}) {
  if (!changes || Object.keys(changes).length === 0) return null;

  // Détecte les flags booléens pertinents pour montrer un sous-titre clair
  const knownFlags: Array<{ key: string; label: string }> = [
    { key: "adminEdit", label: "Modification par un administrateur" },
    { key: "adminCancelled", label: "Annulation administrative" },
    { key: "adminDelete", label: "Suppression définitive par un administrateur" },
    { key: "mandatoryClosure", label: "Fermeture obligatoire de l'entreprise" },
    { key: "unapproved", label: "Approbation retirée — repassée en attente" },
  ];
  const triggeredFlags = knownFlags.filter((f) => changes[f.key] === true);

  // Construit les lignes affichables : ignore les flags déjà rendus + clés techniques
  const skipKeys = new Set(["adminEdit", "adminCancelled", "adminDelete", "mandatoryClosure", "unapproved"]);
  const entries = Object.entries(changes).filter(([k]) => !skipKeys.has(k));

  // Cas spécial diff : on l'affiche déjà formatée en texte simple
  const diffEntry = entries.find(([k]) => k === "diff");

  return (
    <div className="mt-2 space-y-1.5">
      {triggeredFlags.map((f) => (
        <p key={f.key} className="text-[11px] font-medium text-[#0F2D52] flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0F2D52]" />
          {f.label}
        </p>
      ))}
      {diffEntry && typeof diffEntry[1] === "string" && diffEntry[1].length > 0 && (
        <div className="rounded bg-muted/40 p-2 text-[11px]">
          <span className="font-semibold text-muted-foreground">Détails : </span>
          <span className="text-foreground">{String(diffEntry[1])}</span>
        </div>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
        {entries
          .filter(([k]) => k !== "diff")
          .map(([k, v]) => {
            const label = FIELD_LABELS[k] ?? humanizeKey(k);
            const formatted = formatValue(k, v);
            if (!formatted || formatted === "—") return null;
            return (
              <div key={k} className="contents">
                <dt className="text-muted-foreground font-medium">{label} :</dt>
                <dd className="text-foreground break-words">{formatted}</dd>
              </div>
            );
          })}
      </dl>
    </div>
  );
}

// Fallback : transforme camelCase en libellé lisible si non mappé
function humanizeKey(k: string): string {
  return k
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/_/g, " ")
    .trim();
}
