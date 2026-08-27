"use client";
// =============================================================
// SignatureStatusBadge - badge unifie pour l'etat de signature
// d'un document a double partie (employe + employeur).
//
// Conventions VNK :
//   - Couleurs : vert = actif (2/2), orange = en attente (1/2),
//     gris = non signe (0/2), rouge = resilie.
//   - Tooltip via <ActionTooltip> (jamais de title= natif).
//   - Variant "compact" = juste icone + label court ; "full" =
//     affiche les dates de signature inline.
//
// Usage :
//   <SignatureStatusBadge
//     employeeSignedAt={c.employeeSignedAt}
//     employerSignedAt={c.employerSignedAt}
//     terminatedAt={c.terminatedAt}
//   />
// =============================================================
import { CheckCircle2, Clock, AlertCircle, Ban } from "lucide-react";
import { useTranslations } from "next-intl";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { ToneBadge } from "@/components/admin/tone-badge";

function fmt(iso: Date | string | null | undefined): string {
  if (!iso) return "-";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" });
}

export interface SignatureStatusBadgeProps {
  employeeSignedAt: Date | string | null;
  employerSignedAt: Date | string | null;
  terminatedAt?: Date | string | null;
  /** "compact" = icone + label court (defaut). "full" = ajoute les dates. */
  variant?: "compact" | "full";
  className?: string;
}

export function SignatureStatusBadge({
  employeeSignedAt,
  employerSignedAt,
  terminatedAt,
  variant = "compact",
  className,
}: SignatureStatusBadgeProps) {
  const t = useTranslations("admin.ui");

  if (terminatedAt) {
    const date = fmt(terminatedAt);
    return (
      <ActionTooltip label={`Resilie le ${date}`}>
        <span className="inline-flex">
          <ToneBadge tone="danger" icon={Ban} className={className}>
            {variant === "full" ? `Resilie - ${date}` : t("resilie")}
          </ToneBadge>
        </span>
      </ActionTooltip>
    );
  }

  const emp = !!employeeSignedAt;
  const emr = !!employerSignedAt;


  if (emp && emr) {
    const tip = `Signe par employe le ${fmt(employeeSignedAt)} - employeur le ${fmt(employerSignedAt)}`;
    return (
      <ActionTooltip label={tip}>
        <span className="inline-flex">
          <ToneBadge tone="success" icon={CheckCircle2} className={className}>
            {variant === "full" ? `Actif - ${fmt(employerSignedAt)}` : t("actif")}
          </ToneBadge>
        </span>
      </ActionTooltip>
    );
  }


  if (emp || emr) {
    const waitingFor = emp ? "employeur" : "employe";
    const signedDate = emp ? fmt(employeeSignedAt) : fmt(employerSignedAt);
    const tip = emp
      ? `Signe par employe le ${signedDate} - en attente de l'employeur`
      : `Signe par employeur le ${signedDate} - en attente de l'employe`;
    const label = variant === "full"
      ? `En attente ${waitingFor} (${signedDate})`
      : `En attente ${waitingFor}`;
    return (
      <ActionTooltip label={tip}>
        <span className="inline-flex">
          <ToneBadge tone="warning" icon={Clock} className={className}>
            {label}
          </ToneBadge>
        </span>
      </ActionTooltip>
    );
  }


  return (
    <ActionTooltip label={t("aucune_signature_moment")}>
      <span className="inline-flex">
        <ToneBadge tone="neutral" icon={AlertCircle} className={className}>
          {t("non_signe")}
        </ToneBadge>
      </span>
    </ActionTooltip>
  );
}
