"use client";
// ─────────────────────────────────────────────────────────
// PersonalDocCard — carte dédiée pour EmployeePersonalDocument
//
// Affiche : icône catégorie + titre + issuer + numéro + dates
// (highlight rouge si expiration <30j), badges (Vérifié /
// À vérifier / Privé), actions (aperçu / télécharger / éditer
// / supprimer), action admin "Vérifier".
//
// TODO(backend) : type EmployeePersonalDocument à importer depuis
// @prisma/client une fois le schema mergé. Pour l'instant on
// définit le type localement.
// ─────────────────────────────────────────────────────────
import { useState } from "react";
import {
  BadgeCheck,
  GraduationCap,
  Award,
  IdCard,
  BookUser,
  Stethoscope,
  FileText,
  Eye,
  Download,
  Pencil,
  Trash2,
  Lock,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Loader2,
  Check,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { ToneBadge } from "@/components/admin/tone-badge";
import { cn } from "@/lib/utils";

export type PersonalDocCategory =
  | "licence"
  | "diploma"
  | "certification"
  | "id_card"
  | "passport"
  | "medical"
  | "other";

const CATEGORY_META: Record<
  PersonalDocCategory,
  { label: string; icon: LucideIcon; tone: string; bg: string }
> = {
  licence: { label: "Licence", icon: BadgeCheck, tone: "text-sky-700", bg: "bg-sky-50 ring-sky-200" },
  diploma: { label: "Diplôme", icon: GraduationCap, tone: "text-violet-700", bg: "bg-violet-50 ring-violet-200" },
  certification: { label: "Certification", icon: Award, tone: "text-amber-700", bg: "bg-amber-50 ring-amber-200" },
  id_card: { label: "Carte d'identité", icon: IdCard, tone: "text-emerald-700", bg: "bg-emerald-50 ring-emerald-200" },
  passport: { label: "Passeport", icon: BookUser, tone: "text-indigo-700", bg: "bg-indigo-50 ring-indigo-200" },
  medical: { label: "Médical", icon: Stethoscope, tone: "text-rose-700", bg: "bg-rose-50 ring-rose-200" },
  other: { label: "Autre", icon: FileText, tone: "text-slate-700", bg: "bg-slate-50 ring-slate-200" },
};

export type PersonalDocCardData = {
  id: number;
  category: PersonalDocCategory;
  title: string;
  description?: string | null;
  issuer?: string | null;
  refNumber?: string | null;
  issuedAt?: string | null; // ISO date
  expiresAt?: string | null; // ISO date
  isPrivate?: boolean;
  verifiedAt?: string | null;
  verifiedBy?: { id: number; fullName?: string | null } | null;
};

function formatDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = d.getTime() - Date.now();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function PersonalDocCard({
  doc,
  isAdmin = false,
  onPreview,
  onDownload,
  onEdit,
  onDelete,
  onVerify,
  className,
}: {
  doc: PersonalDocCardData;
  /** Affiche les badges admin (Vérifié / À vérifier) et l'action "Vérifier". */
  isAdmin?: boolean;
  onPreview?: () => void;
  onDownload?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Callback de vérification (admin). Reçoit les notes saisies dans le dialog. */
  onVerify?: (notes: string) => Promise<void> | void;
  className?: string;
}) {
  const meta = CATEGORY_META[doc.category] ?? CATEGORY_META.other;
  const Icon = meta.icon;
  const issued = formatDate(doc.issuedAt);
  const expires = formatDate(doc.expiresAt);
  const expiresInDays = daysUntil(doc.expiresAt);
  const isExpired = expiresInDays !== null && expiresInDays < 0;
  const isExpiringSoon =
    expiresInDays !== null && expiresInDays >= 0 && expiresInDays < 30;

  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState("");
  const [verifying, setVerifying] = useState(false);

  const submitVerify = async () => {
    if (!onVerify) return;
    setVerifying(true);
    try {
      await onVerify(verifyNotes.trim());
      setVerifyOpen(false);
      setVerifyNotes("");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <>
      <Card className={cn("vnk-card-hover overflow-hidden", className)}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "h-11 w-11 rounded-lg flex items-center justify-center shrink-0 ring-1",
                meta.bg
              )}
            >
              <Icon className={cn("h-5 w-5", meta.tone)} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{doc.title}</p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {meta.label}
                {doc.issuer ? ` · ${doc.issuer}` : ""}
                {doc.refNumber ? ` · #${doc.refNumber}` : ""}
              </p>

              {(isAdmin || doc.isPrivate) && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {isAdmin && doc.verifiedAt ? (
                    <ToneBadge tone="success" icon={ShieldCheck}>
                      Vérifié
                    </ToneBadge>
                  ) : isAdmin ? (
                    <ToneBadge tone="warning" icon={ShieldAlert}>
                      À vérifier
                    </ToneBadge>
                  ) : null}
                  {doc.isPrivate && (
                    <ToneBadge tone="info" icon={Lock}>
                      Privé
                    </ToneBadge>
                  )}
                  {isExpired && (
                    <ToneBadge tone="danger" icon={AlertTriangle}>
                      Expiré
                    </ToneBadge>
                  )}
                  {isExpiringSoon && (
                    <ToneBadge tone="warning" icon={AlertTriangle}>
                      Expire bientôt
                    </ToneBadge>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
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
          </div>

          {/* Dates */}
          {(issued || expires) && (
            <div className="grid grid-cols-2 gap-2 text-[11px] border-t pt-2">
              <div>
                <p className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
                  Émission
                </p>
                <p className="tabular-nums">{issued ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">
                  Expiration
                </p>
                <p
                  className={cn(
                    "tabular-nums",
                    isExpired && "text-red-700 font-semibold",
                    !isExpired && isExpiringSoon && "text-amber-700 font-semibold"
                  )}
                >
                  {expires ?? "—"}
                  {expiresInDays !== null && !isExpired && isExpiringSoon && (
                    <span className="ml-1 text-[10px] font-medium">
                      ({expiresInDays}&nbsp;j)
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Description courte */}
          {doc.description && (
            <p className="text-[11px] text-muted-foreground border-t pt-2 line-clamp-2">
              {doc.description}
            </p>
          )}

          {/* Action admin : Vérifier */}
          {isAdmin && !doc.verifiedAt && onVerify && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full h-8 text-xs border-[#0F2D52]/30 text-[#0F2D52] hover:bg-[#0F2D52]/5"
              onClick={() => setVerifyOpen(true)}
            >
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
              Marquer comme vérifié
            </Button>
          )}

          {/* Mention "vérifié par" */}
          {isAdmin && doc.verifiedAt && doc.verifiedBy && (
            <p className="text-[10px] text-muted-foreground border-t pt-2">
              Vérifié par {doc.verifiedBy.fullName ?? `#${doc.verifiedBy.id}`} le{" "}
              {formatDate(doc.verifiedAt)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dialog de vérification admin */}
      <Dialog open={verifyOpen} onOpenChange={(o) => !o && !verifying && setVerifyOpen(false)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
            <DialogHeader>
              <DialogTitle className="text-base text-white flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Vérifier le document
              </DialogTitle>
              <DialogDescription className="text-white/80 text-xs">
                Confirmez que «&nbsp;{doc.title}&nbsp;» est conforme et authentique.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-5 space-y-2">
            <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              Notes (optionnel)
            </label>
            <Textarea
              value={verifyNotes}
              onChange={(e) => setVerifyNotes(e.target.value)}
              placeholder="Ex : Original vu en main propre, copie conforme…"
              rows={4}
              className="text-sm"
            />
          </div>
          <DialogFooter className="px-5 py-3 border-t bg-muted/30">
            <Button
              type="button"
              variant="outline"
              onClick={() => setVerifyOpen(false)}
              disabled={verifying}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={submitVerify}
              disabled={verifying}
              className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            >
              {verifying ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5 mr-1.5" />
              )}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
