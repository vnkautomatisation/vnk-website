"use client";
// ─────────────────────────────────────────────────────────
// SignatureRequestBanner — bandeau "Mon espace" qui liste les
// demandes de signature en attente pour l'utilisateur courant.
//
// Style :
//   - ambre par défaut (warning)
//   - rouge (danger) si au moins une demande approche de la dueDate (<3j)
//
// Cliquer "Signer maintenant" déclenche onSign(templateId).
//
// TODO(backend) : type DocumentSignatureRequest à importer depuis
// @prisma/client une fois le schema mergé. Pour l'instant on
// utilise le type local ci-dessous (data shape attendue depuis
// /api/admin/signature-requests).
// ─────────────────────────────────────────────────────────
import { useMemo } from "react";
import { FileSignature, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PendingSignatureRequest = {
  id: number;
  template: { id: number; title: string; key: string };
  dueDate: string | null;
  reason: string | null;
};

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

export function SignatureRequestBanner({
  requests,
  onSign,
  className,
}: {
  requests: PendingSignatureRequest[];
  /** Appelé avec le templateId à signer — ouvre <SignaturePadDialog>. */
  onSign: (templateId: number) => void;
  className?: string;
}) {
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
        chip: "bg-red-100 text-red-800 border-red-300",
        btn: "bg-red-600 hover:bg-red-700",
      }
    : {
        wrap: "border-amber-300 bg-amber-50",
        icon: "text-amber-700 bg-amber-100",
        title: "text-amber-900",
        sub: "text-amber-800/80",
        chip: "bg-amber-100 text-amber-800 border-amber-300",
        btn: "bg-[#0F2D52] hover:bg-[#1a3a66]",
      };

  return (
    <div
      className={cn(
        "rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center gap-3",
        palette.wrap,
        className
      )}
      role="alert"
    >
      <div
        className={cn(
          "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
          palette.icon
        )}
      >
        {isUrgent ? (
          <AlertTriangle className="h-5 w-5" />
        ) : (
          <FileSignature className="h-5 w-5" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-bold", palette.title)}>
          {requests.length === 1
            ? "1 document à signer"
            : `${requests.length} documents à signer`}
          {isUrgent && urgentCount > 0 && (
            <span className="ml-2 text-xs font-medium">
              · {urgentCount} urgent{urgentCount > 1 ? "s" : ""}
            </span>
          )}
        </p>
        <p className={cn("text-xs mt-0.5", palette.sub)}>
          {isUrgent
            ? "Au moins une signature arrive à échéance — merci de signer rapidement."
            : "Veuillez prendre quelques minutes pour signer les documents qui vous ont été assignés."}
        </p>

        {/* Liste compacte des demandes */}
        <div className="mt-2 flex flex-col gap-1.5">
          {requests.slice(0, 4).map((r) => {
            const days = daysUntil(r.dueDate);
            const due = formatDate(r.dueDate);
            const itemUrgent =
              days !== null && days <= URGENT_THRESHOLD_DAYS;
            return (
              <div
                key={r.id}
                className="flex items-center gap-2 rounded-md bg-white/60 px-2.5 py-1.5 border border-white/80"
              >
                <FileSignature className="h-3.5 w-3.5 text-[#0F2D52] shrink-0" />
                <span className="text-xs font-medium truncate flex-1">
                  {r.template.title}
                </span>
                {due && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium tabular-nums",
                      itemUrgent
                        ? "bg-red-100 text-red-800 border-red-300"
                        : "bg-muted text-muted-foreground border-input"
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
                  onClick={() => onSign(r.template.id)}
                  className={cn(
                    "h-6 text-[11px] px-2 text-white shrink-0",
                    palette.btn
                  )}
                >
                  Signer
                </Button>
              </div>
            );
          })}
          {requests.length > 4 && (
            <p className={cn("text-[10px]", palette.sub)}>
              + {requests.length - 4} autre{requests.length - 4 > 1 ? "s" : ""}…
            </p>
          )}
        </div>
      </div>
      {/* Bouton "Signer maintenant" retire : doublon visuel avec le bouton
          "Signer" en bout de chaque ligne. Le per-item suffit. */}
    </div>
  );
}
