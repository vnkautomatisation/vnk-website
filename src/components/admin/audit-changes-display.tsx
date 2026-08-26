"use client";
// An AuditLog rendered for a human: { decision: "approved" } -> "Decision: Approved".
// Users never see raw JSON.
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

// ─── Mappings FR ─────────────────────────────────────────────────
const ACTION_TONE: Record<string, string> = {
  create: "bg-cyan-50 text-cyan-800 border-cyan-200",
  update: "bg-amber-50 text-amber-800 border-amber-200",
  delete: "bg-red-50 text-red-800 border-red-200",
  approve: "bg-emerald-50 text-emerald-800 border-emerald-200",
  reject: "bg-red-50 text-red-800 border-red-200",
};

// Keys that carry a translated label; anything else is humanised as-is.
const KNOWN_FIELDS = new Set([
  "decision", "notes", "reason", "type", "startDate", "endDate", "status", "halfDay", "daysCount", "diff", "adminEdit", "adminCancelled", "adminDelete", "snapshot", "mandatoryClosure", "duplicatedFrom", "newId", "attachmentUrl", "attachmentName", "delegateApprovalTo", "blocked", "unblocked", "blockedUntil", "blockedReason", "policyId", "policyName", "balanceDelta", "delta", "created", "skipped", "conflicts", "period", "unapproved", "convertedFrom", "convertedTo",
]);

const VALUE_NAMESPACE: Record<string, string> = {
  decision: "decision",
  status: "status",
  type: "type",
  convertedFrom: "type",
  convertedTo: "type",
  halfDay: "half",
};

// ─── Helpers de formatage ────────────────────────────────────────
function isISODate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);
}

function formatDate(v: string): string {
  return new Date(v).toLocaleDateString("fr-CA");
}

type T = ReturnType<typeof useTranslations>;

function formatValue(key: string, value: unknown, t: T): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return t(value ? "yes" : "no");
  if (typeof value === "number") return value.toString();
  if (typeof value === "string") {
    // Decisions, statuses, leave types, half days.
    const ns = VALUE_NAMESPACE[key] ?? (key.endsWith("Status") ? "status" : null);
    if (ns) {
      const full = `${ns}.${value}`;
      return t.has(full) ? t(full) : value;
    }
    if (isISODate(value)) return formatDate(value);
    return value;
  }
  // Objets : recursive humanisation
  if (typeof value === "object") {
    try {
      return Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => `${KNOWN_FIELDS.has(k) ? t(`field.${k}`) : k} : ${formatValue(k, v, t)}`)
        .join(" · ");
    } catch {
      return t("complex");
    }
  }
  return String(value);
}

// ─── Composant principal ─────────────────────────────────────────
export function AuditActionBadge({ action }: { action: string }) {
  const t = useTranslations("admin.audit");
  const tone = ACTION_TONE[action] ?? "bg-slate-50 text-slate-800 border-slate-200";
  return (
    <Badge variant="outline" className={`text-[10px] uppercase ${tone}`}>
      {ACTION_TONE[action] ? t(`action.${action}`) : action}
    </Badge>
  );
}

export function AuditChangesDisplay({
  changes,
}: {
  changes: Record<string, unknown> | null | undefined;
}) {
  const t = useTranslations("admin.audit");
  if (!changes || Object.keys(changes).length === 0) return null;

  // Boolean flags worth a subtitle of their own.
  const FLAG_KEYS = ["adminEdit", "adminCancelled", "adminDelete", "mandatoryClosure", "unapproved"];
  const triggeredFlags = FLAG_KEYS.filter((k) => changes[k] === true);

  // Construit les lignes affichables : ignore les flags déjà rendus + clés techniques
  const skipKeys = new Set(["adminEdit", "adminCancelled", "adminDelete", "mandatoryClosure", "unapproved"]);
  const entries = Object.entries(changes).filter(([k]) => !skipKeys.has(k));

  // Cas spécial diff : on l'affiche déjà formatée en texte simple
  const diffEntry = entries.find(([k]) => k === "diff");

  return (
    <div className="mt-2 space-y-1.5">
      {triggeredFlags.map((k) => (
        <p key={k} className="text-[11px] font-medium text-[#0F2D52] flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0F2D52]" />
          {t(`flag.${k}`)}
        </p>
      ))}
      {diffEntry && typeof diffEntry[1] === "string" && diffEntry[1].length > 0 && (
        <div className="rounded bg-muted/40 p-2 text-[11px]">
          <span className="font-semibold text-muted-foreground">{t("details")} </span>
          <span className="text-foreground">{String(diffEntry[1])}</span>
        </div>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
        {entries
          .filter(([k]) => k !== "diff")
          .map(([k, v]) => {
            const label = KNOWN_FIELDS.has(k) ? t(`field.${k}`) : humanizeKey(k);
            const formatted = formatValue(k, v, t);
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
