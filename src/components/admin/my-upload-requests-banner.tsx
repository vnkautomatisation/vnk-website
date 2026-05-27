"use client";
// ─────────────────────────────────────────────────────────
// MyUploadRequestsBanner — bandeau "Mon espace" qui liste les
// demandes RH de téléversement de documents en attente.
//
// Style aligné sur SignatureRequestBanner :
//   - ambre par défaut (warning)
//   - rouge (danger) si au moins une demande approche de la dueDate (<3j)
//
// Clic "Téléverser" → onUpload(requestId) ouvre UploadDocumentResponseDialog.
// ─────────────────────────────────────────────────────────
import { useMemo } from "react";
import {
  FileText, AlertTriangle, Clock, Upload,
  IdCard, GraduationCap, Award, CreditCard, Globe, Stethoscope, FileQuestion,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DOC_REQUEST_CATEGORIES, type DocRequestCategory } from "@/lib/document-requests/categories";

export type PendingUploadRequest = {
  id: number;
  title: string;
  description: string | null;
  category: string;
  isRequired: boolean;
  dueDate: string | null;
  createdAt: string;
};

// Méta affichage par catégorie : icône lucide + libellé court visible
const CATEGORY_ICON: Record<DocRequestCategory, React.ComponentType<{ className?: string }>> = {
  licence: IdCard,
  diploma: GraduationCap,
  certification: Award,
  id_card: CreditCard,
  passport: Globe,
  medical: Stethoscope,
  other: FileQuestion,
};

function getCategoryLabel(value: string): string {
  return DOC_REQUEST_CATEGORIES.find((c) => c.value === value)?.label ?? "Document";
}

function getCategoryIcon(value: string): React.ComponentType<{ className?: string }> {
  return CATEGORY_ICON[value as DocRequestCategory] ?? FileQuestion;
}

const URGENT_THRESHOLD_DAYS = 3;

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}

export function MyUploadRequestsBanner({
  requests,
  onUpload,
  className,
}: {
  requests: PendingUploadRequest[];
  onUpload: (requestId: number) => void;
  className?: string;
}) {
  const sorted = useMemo(() => {
    return [...requests].sort((a, b) => {
      // dueDate asc (nulls last), puis createdAt desc
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      if (ad !== bd) return ad - bd;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [requests]);

  const { isUrgent, urgentCount } = useMemo(() => {
    const urgent = requests.filter((r) => {
      const days = daysUntil(r.dueDate);
      return days !== null && days <= URGENT_THRESHOLD_DAYS;
    });
    return { isUrgent: urgent.length > 0, urgentCount: urgent.length };
  }, [requests]);

  if (requests.length === 0) return null;

  const palette = isUrgent
    ? {
        wrap: "border-red-300 bg-red-50",
        icon: "text-red-700 bg-red-100",
        title: "text-red-900",
        sub: "text-red-700/80",
        btn: "bg-red-600 hover:bg-red-700",
      }
    : {
        wrap: "border-amber-300 bg-amber-50",
        icon: "text-amber-700 bg-amber-100",
        title: "text-amber-900",
        sub: "text-amber-800/80",
        btn: "bg-[#0F2D52] hover:bg-[#1a3a66]",
      };

  return (
    <div
      className={cn(
        "rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center gap-3",
        palette.wrap,
        className,
      )}
      role="alert"
    >
      <div
        className={cn(
          "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
          palette.icon,
        )}
      >
        {isUrgent ? (
          <AlertTriangle className="h-5 w-5" />
        ) : (
          <FileText className="h-5 w-5" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-bold", palette.title)}>
          {requests.length === 1
            ? "1 document à téléverser"
            : `${requests.length} documents à téléverser`}
          {isUrgent && urgentCount > 0 && (
            <span className="ml-2 text-xs font-medium">
              · {urgentCount} urgent{urgentCount > 1 ? "s" : ""}
            </span>
          )}
        </p>
        <p className={cn("text-xs mt-0.5", palette.sub)}>
          {isUrgent
            ? "Au moins une demande arrive à échéance — merci de téléverser rapidement."
            : "Les RH vous demandent de téléverser les documents listés ci-dessous."}
        </p>

        {/* Liste compacte des demandes */}
        <div className="mt-2 flex flex-col gap-1.5">
          {sorted.slice(0, 4).map((r) => {
            const days = daysUntil(r.dueDate);
            const due = formatDate(r.dueDate);
            const itemUrgent = days !== null && days <= URGENT_THRESHOLD_DAYS;
            const CatIcon = getCategoryIcon(r.category);
            const catLabel = getCategoryLabel(r.category);
            return (
              <div
                key={r.id}
                className="flex items-center gap-2 rounded-md bg-white/60 px-2.5 py-1.5 border border-white/80"
              >
                <CatIcon className="h-4 w-4 text-[#0F2D52] shrink-0" />
                <span className="text-xs font-medium truncate flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#0F2D52]/10 text-[#0F2D52] text-[10px] font-semibold uppercase tracking-wide border border-[#0F2D52]/20">
                    {catLabel}
                  </span>
                  <span className="truncate">{r.title}</span>
                  {r.isRequired && (
                    <span className="text-[10px] text-red-700 font-semibold">
                      · obligatoire
                    </span>
                  )}
                </span>
                {due && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium tabular-nums",
                      itemUrgent
                        ? "bg-red-100 text-red-800 border-red-300"
                        : "bg-muted text-muted-foreground border-input",
                    )}
                  >
                    <Clock className="h-2.5 w-2.5" />
                    {itemUrgent && days !== null && days >= 0
                      ? `J-${days}`
                      : `Avant ${due}`}
                  </span>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onUpload(r.id)}
                  className={cn(
                    "h-6 text-[11px] px-2 text-white shrink-0",
                    palette.btn,
                  )}
                >
                  <Upload className="h-3 w-3 mr-1" />
                  Téléverser
                </Button>
              </div>
            );
          })}
          {sorted.length > 4 && (
            <p className={cn("text-[10px]", palette.sub)}>
              + {sorted.length - 4} autre{sorted.length - 4 > 1 ? "s" : ""}…
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
