"use client";
// ─────────────────────────────────────────────────────────
// DocumentCard — carte unifiée pour tout type de document
// (légal, contrat, paie, fiscal, lettre, perso) avec actions
// communes (preview / download / sign / edit / delete) et
// une action principale optionnelle.
//
// Convention VNK : icônes lucide uniquement, tooltips via
// <ActionTooltip>, navy #0F2D52, badges via <ToneBadge>.
// ─────────────────────────────────────────────────────────
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Eye,
  Download,
  FileSignature,
  Pencil,
  Trash2,
  Calendar,
  HardDrive,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { ToneBadge } from "@/components/admin/tone-badge";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

// Couleurs pastel pour l'icône à gauche (cohérent avec StatBox)
const ICON_TONE: Record<Tone, { bg: string; fg: string; ring: string }> = {
  success: { bg: "bg-emerald-50", fg: "text-emerald-700", ring: "ring-emerald-200" },
  warning: { bg: "bg-amber-50", fg: "text-amber-700", ring: "ring-amber-200" },
  danger: { bg: "bg-red-50", fg: "text-red-700", ring: "ring-red-200" },
  info: { bg: "bg-sky-50", fg: "text-sky-700", ring: "ring-sky-200" },
  neutral: { bg: "bg-[#0F2D52]/8", fg: "text-[#0F2D52]", ring: "ring-[#0F2D52]/15" },
};

export type DocumentCardProps = {
  /** Icône principale (lucide) affichée dans la pastille de gauche. */
  icon: LucideIcon;
  /** Titre du document. */
  title: string;
  /** Sous-titre (ex: "Bulletin de paie", "v1.2", catégorie…). */
  subtitle?: string;
  /** Tonalité de l'icône & teinte principale. */
  iconTone?: Tone;
  /** Badge principal de statut (ex: "Signé", "À signer"). */
  status?: { label: string; tone: Tone };
  /** Badges secondaires (ex: "Obligatoire", "Nouvelle version"). */
  badges?: Array<{ label: string; tone?: Tone }>;
  /** Date formatée (ex: "30 avril 2026"). */
  date?: string;
  /** Taille formatée (ex: "1.2 MB"). */
  size?: string;
  /** Aperçu PDF — ouvre via <PdfPreviewModal>. */
  onPreview?: () => void;
  /** Téléchargement direct. */
  onDownload?: () => void;
  /** Signature électronique. */
  onSign?: () => void;
  /** Édition (admin). */
  onEdit?: () => void;
  /** Suppression (admin). */
  onDelete?: () => void;
  /** Lien vers page détail (optionnel). */
  href?: string;
  /** Action principale proéminente en bas de carte. */
  primaryAction?: {
    label: string;
    icon?: LucideIcon;
    onClick: () => void;
    tone?: "primary" | "danger";
  };
  className?: string;
};

export function DocumentCard({
  icon: Icon,
  title,
  subtitle,
  iconTone = "neutral",
  status,
  badges,
  date,
  size,
  onPreview,
  onDownload,
  onSign,
  onEdit,
  onDelete,
  href,
  primaryAction,
  className,
}: DocumentCardProps) {
  const tone = ICON_TONE[iconTone];
  const hasActions = Boolean(onPreview || onDownload || onSign || onEdit || onDelete);

  // `line-clamp-2 leading-snug break-words` : autorise jusqu'a 2 lignes
  // avant troncature (au lieu de couper brutalement). break-words evite
  // l'overflow horizontal sur les titres très longs sans espaces.
  const titleNode = href ? (
    <Link
      href={href}
      className="text-sm font-semibold text-foreground hover:text-[#0F2D52] hover:underline line-clamp-2 leading-snug break-words block"
    >
      {title}
    </Link>
  ) : (
    <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug break-words">{title}</p>
  );

  return (
    <Card className={cn("vnk-card-hover overflow-hidden", className)}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          {/* Pastille icône */}
          <div
            className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ring-1",
              tone.bg,
              tone.ring
            )}
          >
            <Icon className={cn("h-5 w-5", tone.fg)} />
          </div>

          {/* Titre + sous-titre + badges */}
          <div className="min-w-0 flex-1">
            {titleNode}
            {subtitle && (
              <p className="text-xs text-muted-foreground line-clamp-2 leading-snug mt-0.5 break-words">{subtitle}</p>
            )}
            {(status || (badges && badges.length > 0)) && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {status && <ToneBadge tone={status.tone}>{status.label}</ToneBadge>}
                {badges?.map((b, i) => (
                  <ToneBadge key={i} tone={b.tone ?? "neutral"}>
                    {b.label}
                  </ToneBadge>
                ))}
              </div>
            )}
          </div>

          {/* Boutons icônes à droite */}
          {hasActions && (
            <div className="flex items-center gap-0.5 shrink-0">
              {onPreview && (
                <ActionTooltip label="Aperçu">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onPreview}
                    aria-label="Aperçu"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </ActionTooltip>
              )}
              {onDownload && (
                <ActionTooltip label="Télécharger">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onDownload}
                    aria-label="Télécharger"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </ActionTooltip>
              )}
              {onSign && (
                <ActionTooltip label="Signer">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[#0F2D52]"
                    onClick={onSign}
                    aria-label="Signer"
                  >
                    <FileSignature className="h-4 w-4" />
                  </Button>
                </ActionTooltip>
              )}
              {onEdit && (
                <ActionTooltip label="Modifier">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onEdit}
                    aria-label="Modifier"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </ActionTooltip>
              )}
              {onDelete && (
                <ActionTooltip label="Supprimer">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:text-destructive"
                    onClick={onDelete}
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </ActionTooltip>
              )}
            </div>
          )}
        </div>

        {/* Métadonnées (date + taille) */}
        {(date || size) && (
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground border-t pt-2">
            {date && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {date}
              </span>
            )}
            {size && (
              <span className="inline-flex items-center gap-1">
                <HardDrive className="h-3 w-3" />
                {size}
              </span>
            )}
          </div>
        )}

        {/* Action principale (ex: "Signer maintenant") */}
        {primaryAction && (
          <Button
            type="button"
            onClick={primaryAction.onClick}
            className={cn(
              "w-full h-9 text-xs font-semibold",
              primaryAction.tone === "danger"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            )}
          >
            {primaryAction.icon && <primaryAction.icon className="h-3.5 w-3.5 mr-1.5" />}
            {primaryAction.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
