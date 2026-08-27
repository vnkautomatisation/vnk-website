"use client";
// =============================================================
// TemplateLibraryCard - card unifiee pour un modele dans la
// bibliotheque (legal, contract ou policy).
//
// Affiche : titre, badges (categorie / version / obligatoire /
// starter | personnalise / archive), apercu du contenu, postes
// cibles, et actions (Apercu PDF, Utiliser, Dupliquer, Modifier,
// Archiver).
//
// Theme VNK : header navy compact, accent navy, ActionTooltip
// pour chaque bouton icone.
// =============================================================
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Award,
  Briefcase,
  Copy,
  Eye,
  FileText,
  Pencil,
  Play,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  Archive,
  ArchiveRestore,
  BookOpen,
  FileSignature,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { TemplatePdfPreviewButton } from "@/components/admin/template-pdf-preview-button";
import type { TemplateDocumentType } from "@/lib/services/pdf-template-renderer";
import { formatPreviewMarkdown } from "@/lib/document-templates/preview-helpers";
import { cn } from "@/lib/utils";

export type LibraryTemplateKind = "legal" | "contract" | "policy";

export interface LibraryTemplate {
  id: number;
  kind: LibraryTemplateKind;
  title: string;
  categoryLabel?: string;
  version?: string;
  isRequired?: boolean;
  isStarter: boolean;
  isActive: boolean;
  targetPositions: string[];
  targetDepartments: string[];
  bodyMarkdown: string;
  updatedAt: string;
  /**
   * Mission 5 : type d'engagement requis.
   * - "reading_only" : juste une case "J'ai lu et compris" (bouton "Envoyer pour lecture").
   * - "signature" : signature manuscrite obligatoire (bouton "Demander la signature").
   * Si absent, fallback "signature" pour rétrocompat.
   */
  acknowledgmentMode?: "reading_only" | "signature";
}

interface Props {
  template: LibraryTemplate;
  onUse?: (tpl: LibraryTemplate) => void;
  onEdit?: (tpl: LibraryTemplate) => void;
  onDuplicate?: (tpl: LibraryTemplate) => void;
  onArchive?: (tpl: LibraryTemplate) => void;
  /** Demander une signature ciblee (uniquement modeles legaux actifs). */
  onRequestSignature?: (tpl: LibraryTemplate) => void;
  /** Employe deja choisi pour resoudre les variables au preview PDF. */
  previewEmployeeId?: number;
  /** Si non fourni, ouvre PickEmployeeForPreviewDialog cote parent. */
  onPreviewWithoutEmployee?: (tpl: LibraryTemplate) => void;
}

// Convertit le kind en TemplateDocumentType pour le renderer PDF
function kindToDocType(kind: LibraryTemplateKind): TemplateDocumentType {
  return kind;
}

// Apercu propre : variables {{...}} remplacees par leur label FR,
// markdown strippe, troncature au mot.
function plainPreview(md: string, t: (k: string) => string): string {
  return formatPreviewMarkdown(md, 220, t);
}

export function TemplateLibraryCard({
  template,
  onUse,
  onEdit,
  onDuplicate,
  onArchive,
  onRequestSignature,
  previewEmployeeId,
  onPreviewWithoutEmployee,
}: Props) {
  const t = useTranslations("admin.ui");
  const tv = useTranslations("admin.library");
  const tc = useTranslations("common");
  const [busy] = useState(false);

  const preview = plainPreview(template.bodyMarkdown, tv);


  const KindIcon =
    template.kind === "legal"
      ? ShieldCheck
      : template.kind === "contract"
        ? FileText
        : Award;

  return (
    <div
      className={cn(
        "group flex flex-col rounded-lg border bg-card transition hover:shadow-md hover:border-[#0F2D52]/30",
        !template.isActive && "opacity-70",
      )}
    >

      <div className="flex items-start gap-2 px-4 pt-3 pb-2 border-b">
        <div className="h-8 w-8 rounded-md bg-[#0F2D52]/10 flex items-center justify-center shrink-0">
          <KindIcon className="h-4 w-4 text-[#0F2D52]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate" title={template.title}>
            {template.title}
          </p>
          <div className="flex flex-wrap items-center gap-1 mt-1">
            {template.isStarter ? (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 px-1.5 py-0 h-4 border-emerald-300 bg-emerald-50 text-emerald-700"
              >
                <Sparkles className="h-2.5 w-2.5" />
                {t("starter_vnk")}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 px-1.5 py-0 h-4 border-slate-300 bg-slate-50 text-slate-700"
              >
                {t("personnalise")}
              </Badge>
            )}
            {!template.isActive && (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 px-1.5 py-0 h-4 border-amber-300 bg-amber-50 text-amber-700"
              >
                <Archive className="h-2.5 w-2.5" />
                {t("archive")}
              </Badge>
            )}
            {template.categoryLabel && (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 px-1.5 py-0 h-4"
              >
                <Tag className="h-2.5 w-2.5" />
                {template.categoryLabel}
              </Badge>
            )}
            {template.version && (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 px-1.5 py-0 h-4"
              >
                v{template.version}
              </Badge>
            )}
            {template.isRequired && (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 px-1.5 py-0 h-4 border-red-300 bg-red-50 text-red-700"
              >
                {tc("required")}
              </Badge>
            )}
          </div>
        </div>
      </div>


      <div className="px-4 py-3 flex-1 space-y-2">
        <p className="text-xs text-muted-foreground line-clamp-2 leading-snug min-h-[2.4em]">
          {preview || t("aucun_apercu_disponible")}
        </p>
        {template.targetPositions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <Briefcase className="h-3 w-3 text-[#0F2D52]/70 shrink-0" />
            {template.targetPositions.slice(0, 3).map((p) => (
              <span
                key={p}
                className="text-[10px] px-1.5 py-0.5 rounded bg-[#0F2D52]/5 text-[#0F2D52] border border-[#0F2D52]/15"
              >
                {p}
              </span>
            ))}
            {template.targetPositions.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{template.targetPositions.length - 3}
              </span>
            )}
          </div>
        )}
        {template.targetPositions.length === 0 &&
          template.targetDepartments.length === 0 && (
            <p className="text-[10px] text-muted-foreground italic">
              {t("applicable_tous_employes")}
            </p>
          )}
      </div>


      <div className="flex items-center gap-1 px-3 py-2 border-t bg-muted/30">

        {previewEmployeeId !== undefined ? (
          <TemplatePdfPreviewButton
            bodyMarkdown={template.bodyMarkdown}
            title={template.title}
            documentType={kindToDocType(template.kind)}
            employeeId={previewEmployeeId}
            metadata={{ version: template.version || "1.0" }}
            trigger={
              <ActionTooltip label={t("apercu_pdf")}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-[#0F2D52]"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </ActionTooltip>
            }
          />
        ) : (
          <ActionTooltip label={t("apercu_pdf")}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-[#0F2D52]"
              onClick={() => onPreviewWithoutEmployee?.(template)}
              disabled={busy}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </ActionTooltip>
        )}

        {onUse && (
          <ActionTooltip label={t("utiliser_modele")}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-[#0F2D52]"
              onClick={() => onUse(template)}
              disabled={busy || !template.isActive}
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
          </ActionTooltip>
        )}

        {onRequestSignature && template.kind === "legal" && template.isActive && (() => {

          const ackMode = template.acknowledgmentMode ?? "signature";
          const isReadingOnly = ackMode === "reading_only";
          const Icon = isReadingOnly ? BookOpen : FileSignature;
          const tooltip = isReadingOnly
            ? t("envoyer_document_lecture")
            : t("demander_signature_document");
          return (
            <ActionTooltip label={tooltip}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-[#0F2D52]"
                onClick={() => onRequestSignature(template)}
                disabled={busy}
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            </ActionTooltip>
          );
        })()}

        {onDuplicate && (
          <ActionTooltip label={t("dupliquer")}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-[#0F2D52]"
              onClick={() => onDuplicate(template)}
              disabled={busy}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </ActionTooltip>
        )}

        {onEdit && (
          <ActionTooltip label={tc("edit")}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-[#0F2D52]"
              onClick={() => onEdit(template)}
              disabled={busy}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </ActionTooltip>
        )}

        <div className="flex-1" />

        {onArchive && !template.isStarter && (
          <ActionTooltip label={template.isActive ? t("archiver") : t("restaurer")}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 w-7 p-0",
                template.isActive ? "text-amber-700" : "text-emerald-700",
              )}
              onClick={() => onArchive(template)}
              disabled={busy}
            >
              {template.isActive ? (
                <Archive className="h-3.5 w-3.5" />
              ) : (
                <ArchiveRestore className="h-3.5 w-3.5" />
              )}
            </Button>
          </ActionTooltip>
        )}
      </div>
    </div>
  );
}
