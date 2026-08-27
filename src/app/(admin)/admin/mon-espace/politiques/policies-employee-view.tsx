"use client";
// =============================================================
// PoliciesEmployeeView - vue Mon espace > Politiques RH
// Refonte VNK : header navy + KPI + sticky bar + cartes politique
// avec Sheet de lecture (MarkdownView) + Apercu PDF via
// TemplatePdfPreviewButton (rendu a la volee depuis le markdown).
// =============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  ScrollText,
  Search,
  Calendar,
  FileText,
  CheckCircle2,
  Sparkles,
  Eye,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { MarkdownView } from "@/components/admin/markdown-view";
import { DocumentStatsCard } from "@/components/admin/document-stats-card";
import { TemplatePdfPreviewButton } from "@/components/admin/template-pdf-preview-button";
import { ActionTooltip } from "@/components/ui/action-tooltip";

type Policy = {
  id: number;
  key: string;
  title: string;
  version: string;
  bodyMarkdown: string;
  effectiveFrom: string;
  publisher: { fullName: string | null; email: string } | null;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" });
}

function isRecent(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const diff = Date.now() - d.getTime();
  return diff >= 0 && diff <= 30 * 86400000; // 30 jours
}

export function PoliciesEmployeeView({ policies }: { policies: Policy[] }) {
  const t = useTranslations("admin.my_dashboard");
  const tc = useTranslations("common");
  const [search, setSearch] = useState("");
  const [openPolicy, setOpenPolicy] = useState<Policy | null>(null);


  const recentCount = useMemo(
    () => policies.filter((p) => isRecent(p.effectiveFrom)).length,
    [policies],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return policies;
    return policies.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.bodyMarkdown.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q),
    );
  }, [policies, search]);


  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-64px 0px 0px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);


  const [navExtraEl, setNavExtraEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setNavExtraEl(document.getElementById("vnk-module-nav-extra"));
  }, []);

  return (
    <div className="space-y-4">

      <div className="rounded-xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-4 sm:px-5 py-4 text-white relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32"
          aria-hidden
        />
        <div className="relative flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center ring-2 ring-white/20 shrink-0">
            <ScrollText className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold">{t("policies_employee_view_politiques_de_l_entreprise")}</h1>
            <p className="text-xs text-white/80">{t("policies_employee_view_consultez_les_politiques_rh_en_vigueur_cliquez")}</p>
          </div>
        </div>
      </div>


      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <DocumentStatsCard
          label={t("politiques_actives")}
          value={policies.length}
          icon={ScrollText}
          accent="navy"
          hint={t("documents_vigueur")}
        />
        <DocumentStatsCard
          label={t("nouveautes_30_j")}
          value={recentCount}
          icon={Sparkles}
          accent={recentCount > 0 ? "info" : "navy"}
          hint={
            recentCount > 0
              ? `Mises a jour recentes a consulter`
              : t("aucun_changement_recent")
          }
        />
        <DocumentStatsCard
          label={tc("status")}
          value={policies.length > 0 ? t("a_jour") : "-"}
          icon={CheckCircle2}
          accent={policies.length > 0 ? "success" : "navy"}
          hint={t("toujours_disponibles_mon_espace")}
        />
      </div>


      <div ref={sentinelRef} aria-hidden className="h-px" />


      {navExtraEl && scrolled
        ? createPortal(
            <div className="flex items-center gap-x-2 sm:gap-x-3 text-[11px] sm:text-xs whitespace-nowrap lg:hidden">
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">{t("act")}</span>
                  <span className="hidden min-[480px]:inline">{t("actives")}</span>
                </span>
                <span className="font-semibold text-[#0F2D52]">{policies.length}</span>
              </span>
              {recentCount > 0 && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="inline-flex items-baseline gap-1">
                    <span className="text-muted-foreground">
                      <span className="min-[480px]:hidden">{t("nouv")}</span>
                      <span className="hidden min-[480px]:inline">{t("nouveautes")}</span>
                    </span>
                    <span className="font-semibold text-sky-700">{recentCount}</span>
                  </span>
                </>
              )}
            </div>,
            navExtraEl,
          )
        : null}


      <div
        className={cn(
          "sticky top-[92px] pt-4 lg:top-[64px] lg:pt-0 z-20 bg-background",
          "-mx-4 sm:-mx-5 lg:mx-0 transition-shadow",
          scrolled ? "shadow-sm border-b" : "border-b border-transparent",
        )}
      >
        <div className={cn(
          "hidden px-4 items-center gap-x-5 py-2 text-xs",
          scrolled ? "lg:flex" : "lg:hidden",
        )}>
          <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r shrink-0">
            <ScrollText className="h-4 w-4" />
            {t("politiques_rh")}
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">{t("actives")}</span>
            <span className="font-semibold text-[#0F2D52]">{policies.length}</span>
          </span>
          {recentCount > 0 && (
            <span className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-muted-foreground">{t("nouveautes")}</span>
              <span className="font-semibold text-sky-700">{recentCount}</span>
            </span>
          )}
        </div>
      </div>


      {policies.length > 4 && (
        <Card className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("rechercher_politique_titre_contenu_cle")}
              className="h-9 text-sm pl-8"
            />
          </div>
        </Card>
      )}


      {filtered.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <ScrollText className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm font-semibold">
            {search ? `Aucune politique pour "${search}"` : t("aucune_politique_publiee")}
          </p>
          <p className="text-xs text-muted-foreground">
            {search
              ? t("essayez_autres_mots_cles")
              : t("politiques_rh_apparaitront_ici_lorsqu")}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((p) => (
            <PolicyCard
              key={p.id}
              policy={p}
              onOpen={() => setOpenPolicy(p)}
            />
          ))}
        </div>
      )}


      <PolicyReaderSheet
        policy={openPolicy}
        onClose={() => setOpenPolicy(null)}
      />
    </div>
  );
}

// ================================================================
// CARD : Policy
// ================================================================
function PolicyCard({
  policy,
  onOpen,
}: {
  policy: Policy;
  onOpen: () => void;
}) {
  const t = useTranslations("admin.my_dashboard");
  const recent = isRecent(policy.effectiveFrom);
  const preview =
    policy.bodyMarkdown
      .replace(/^#+\s.*$/gm, "")
      .replace(/[*_`>#-]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 140);

  return (
    <Card className="vnk-card-hover overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-[#0F2D52]/8 ring-1 ring-[#0F2D52]/15 flex items-center justify-center shrink-0">
            <ScrollText className="h-5 w-5 text-[#0F2D52]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{policy.title}</p>
            <div className="flex flex-wrap items-center gap-1 mt-1">
              <Badge variant="outline" className="text-[10px]">
                v{policy.version}
              </Badge>
              <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                <Calendar className="h-2.5 w-2.5" />
                En vigueur le {formatDate(policy.effectiveFrom)}
              </span>
              {recent && (
                <Badge className="text-[10px] bg-sky-100 text-sky-700 border-sky-200">
                  {t("nouveau")}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {preview && (
          <p className="text-xs text-muted-foreground line-clamp-2 border-t pt-2">
            {preview}
            {preview.length >= 140 ? "..." : ""}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5 pt-1 border-t -mb-1">
          <Button
            type="button"
            size="sm"
            onClick={onOpen}
            className="h-8 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white flex-1"
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            {t("lire")}
          </Button>
          <TemplatePdfPreviewButton
            bodyMarkdown={policy.bodyMarkdown}
            title={policy.title}
            documentType="policy"
            metadata={{ version: policy.version }}
            signatureScope="none"
            size="sm"
            variant="outline"
            className="h-8 text-xs flex-1"
          />
        </div>
      </div>
    </Card>
  );
}

// ================================================================
// SHEET : reader
// ================================================================
function PolicyReaderSheet({
  policy,
  onClose,
}: {
  policy: Policy | null;
  onClose: () => void;
}) {
  const t = useTranslations("admin.my_dashboard");
  const tc = useTranslations("common");
  return (
    <Sheet open={!!policy} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="p-0 flex flex-col w-full sm:max-w-2xl gap-0"
      >
        {policy && (
          <>
            <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center ring-2 ring-white/20 shrink-0">
                  <ScrollText className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-white text-base truncate">
                    {policy.title}
                  </SheetTitle>
                  <p className="text-xs text-white/80 mt-0.5 flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] border-white/30 text-white bg-white/10">
                      v{policy.version}
                    </Badge>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5" />
                      En vigueur le {formatDate(policy.effectiveFrom)}
                    </span>
                    {policy.publisher && (
                      <span className="truncate">
                        Publie par {policy.publisher.fullName ?? policy.publisher.email}
                      </span>
                    )}
                  </p>
                </div>
                <ActionTooltip label={tc("close")}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    aria-label={tc("close")}
                    className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </ActionTooltip>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <MarkdownView>{policy.bodyMarkdown}</MarkdownView>
            </div>

            <div className="border-t bg-muted/30 px-5 py-3 shrink-0 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">
                {t("document_reference_consultez_rh_toute")}
              </p>
              <div className="flex items-center gap-1.5">
                <TemplatePdfPreviewButton
                  bodyMarkdown={policy.bodyMarkdown}
                  title={policy.title}
                  documentType="policy"
                  metadata={{ version: policy.version }}
                  signatureScope="none"
                  size="sm"
                  variant="outline"
                  trigger={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                    >
                      <FileText className="h-3.5 w-3.5 mr-1.5" />
                      {t("apercu_pdf")}
                    </Button>
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={onClose}
                  className="h-8 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
                >
                  {tc("close")}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
