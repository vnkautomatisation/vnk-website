"use client";
// =============================================================
// PoliciesAdminView — hub admin pour les politiques RH internes
// (harcelement, code de conduite, IT, teletravail, etc.).
//
// Convention VNK : header navy gradient + DocumentStatsCard +
// sticky bar Finance + DocumentCard + modals header navy +
// MarkdownEditor + ActionTooltip + ConfirmDialog.
// =============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { useDateLocale } from "@/lib/i18n-format";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  Edit3,
  Eye,
  Calendar,
  ShieldCheck,
  Archive,
  Sparkles,
  Layers,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { DocumentStatsCard } from "@/components/admin/document-stats-card";
import { DocumentCard } from "@/components/admin/document-card";
import { SettingsTabs, type TabItem } from "@/components/admin/settings-tabs";
import { MarkdownView } from "@/components/admin/markdown-view";
import { TemplateWizard } from "@/components/admin/template-wizard";
import { TemplatePdfPreviewButton } from "@/components/admin/template-pdf-preview-button";
import { cn } from "@/lib/utils";
import { upsertHrPolicyAction } from "@/app/actions/hr-communications";

// ---------- Types ------------------------------------------------
type Policy = {
  id: number;
  key: string;
  title: string;
  version: string;
  bodyMarkdown: string;
  effectiveFrom: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  publisher: { fullName: string | null; email: string };
};

type TabKey = "all" | "active" | "archived";

// ---------- Helpers ----------------------------------------------
function formatDate(iso: string | null | undefined, tag: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric" });
}

// ================================================================
//                       MAIN VIEW
// ================================================================
export function PoliciesAdminView({
  policies,
  activeAdminCount,
}: {
  policies: Policy[];
  activeAdminCount: number;
}) {
  const t = useTranslations("admin.hr_nav");
  const tc = useTranslations("common");
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const dateTag = useDateLocale();
  const [editDialog, setEditDialog] = useState<{ open: boolean; existing: Policy | null }>({
    open: false,
    existing: null,
  });
  const [previewPolicy, setPreviewPolicy] = useState<Policy | null>(null);

  const [pdfPreviewCtx, setPdfPreviewCtx] = useState<{ policy: Policy; nonce: number } | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Policy | null>(null);
  const [archiving, setArchiving] = useState(false);


  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-64px 0px 0px 0px" }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, []);


  const kpis = useMemo(() => {
    const active = policies.filter((p) => p.isActive);
    const archived = policies.filter((p) => !p.isActive);

    const now = Date.now();
    const recent = policies.filter((p) => {
      const t = new Date(p.effectiveFrom).getTime();
      return Number.isFinite(t) && now - t < 30 * 86400000;
    }).length;
    return {
      total: policies.length,
      active: active.length,
      archived: archived.length,
      recent,
    };
  }, [policies]);


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return policies.filter((p) => {
      if (tab === "active" && !p.isActive) return false;
      if (tab === "archived" && p.isActive) return false;
      if (q && !`${p.title} ${p.key} ${p.version}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [policies, tab, search]);

  const TABS: TabItem<TabKey>[] = [
    { key: "all", label: t("toutes"), icon: Layers, count: policies.length },
    { key: "active", label: t("actives_2"), icon: CheckCircle2, count: kpis.active },
    { key: "archived", label: t("archivees_2"), icon: Archive, count: kpis.archived },
  ];

  return (
    <div className="space-y-4">

      <div className="rounded-xl bg-gradient-to-r from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-4 sm:px-5 py-4 text-white relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32"
          aria-hidden
        />
        <div className="relative flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center ring-2 ring-white/20 shrink-0">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold">{t("politiques_apos_entreprise")}</h1>
              <p className="text-xs text-white/80">{t("policies_view_politiques_internes_harcelement_teletravail_it_code_de")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => setEditDialog({ open: true, existing: null })}
              className="h-8 text-xs bg-white text-[#0F2D52] hover:bg-white/90 font-semibold"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t("nouvelle_politique")}
            </Button>
          </div>
        </div>
      </div>


      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <DocumentStatsCard
          label={t("politiques_actives")}
          value={kpis.active}
          icon={ShieldCheck}
          accent="success"
          hint={tc("employees_concerned", { count: activeAdminCount })}
          onClick={() => setTab("active")}
        />
        <DocumentStatsCard
          label={t("total_publiees")}
          value={kpis.total}
          icon={FileText}
          accent="info"
          hint={t("tout_statut_confondu")}
          onClick={() => setTab("all")}
        />
        <DocumentStatsCard
          label={t("recentes_30_jours")}
          value={kpis.recent}
          icon={Sparkles}
          accent={kpis.recent > 0 ? "warning" : "info"}
          hint={t("mises_vigueur_recemment")}
        />
        <DocumentStatsCard
          label={t("archivees_2")}
          value={kpis.archived}
          icon={Archive}
          accent="info"
          hint={t("inactives_historique")}
          onClick={() => setTab("archived")}
        />
      </div>


      <div ref={sentinelRef} aria-hidden className="h-px" />


      {scrolled && (
        <div className="sticky top-[64px] z-20 py-2 bg-background/95 backdrop-blur shadow-sm border-b rounded-md px-3 animate-overlay-fade-in">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <ShieldCheck className="h-4 w-4" />
              {t("politiques")}
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-muted-foreground">{t("actives")}</span>
              <span className="font-semibold text-emerald-700">{kpis.active}</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-muted-foreground">{t("archivees")}</span>
              <span className="font-semibold text-muted-foreground">{kpis.archived}</span>
            </span>
            <Button
              size="sm"
              className="h-7 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white ml-auto"
              onClick={() => setEditDialog({ open: true, existing: null })}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t("nouvelle")}
            </Button>
          </div>
        </div>
      )}


      <SettingsTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel={t("filtre_politiques")} />

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("rechercher_politique_titre_cle_version")}
        className="h-9 text-sm"
      />


      {filtered.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {policies.length === 0
              ? t("aucune_politique_publiee_moment")
              : t("aucune_politique_ne_correspond_filtres")}
          </p>
          {policies.length === 0 && (
            <Button
              size="sm"
              onClick={() => setEditDialog({ open: true, existing: null })}
              className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t("creer_premiere_politique")}
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((p) => (
            <DocumentCard
              key={p.id}
              icon={ShieldCheck}
              title={p.title}
              subtitle={`v${p.version} - cle ${p.key}`}
              iconTone={p.isActive ? "neutral" : "info"}
              status={
                p.isActive
                  ? { label: t("active"), tone: "success" }
                  : { label: t("archivee"), tone: "neutral" }
              }
              date={`En vigueur depuis ${formatDate(p.effectiveFrom, dateTag)}`}
              onPreview={() => setPreviewPolicy(p)}
              onEdit={() => setEditDialog({ open: true, existing: p })}
              onDelete={p.isActive ? () => setConfirmArchive(p) : undefined}
              primaryAction={{
                label: t("apercu_pdf"),
                icon: FileText,
                onClick: () => setPdfPreviewCtx({ policy: p, nonce: Date.now() }),
              }}
            />
          ))}
        </div>
      )}


      <TemplateWizard
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, existing: null })}
        mode={editDialog.existing ? "edit" : "create"}
        type="policy"
        initial={editDialog.existing ? {
          key: editDialog.existing.key,
          title: editDialog.existing.title,
          version: editDialog.existing.version,
          bodyMarkdown: editDialog.existing.bodyMarkdown,
        } : undefined}
        onSave={async (data) => {
          const existing = editDialog.existing;
          const keyToUse = existing?.key ?? (data.key ?? "").trim();
          if (!keyToUse) {
            throw new Error("Cle technique requise");
          }
          const effectiveFrom = existing
            ? existing.effectiveFrom.split("T")[0]
            : new Date().toISOString().slice(0, 10);
          const r = await upsertHrPolicyAction({
            id: existing?.id,
            key: keyToUse,
            title: data.title,
            version: data.version,
            bodyMarkdown: data.bodyMarkdown,
            effectiveFrom,
            isActive: existing?.isActive ?? true,
          });
          if (!r.success) throw new Error(r.error || t("erreur"));
          toast.success(existing ? t("politique_mise_jour") : t("politique_creee"));
          setEditDialog({ open: false, existing: null });
          router.refresh();
        }}
      />

      <PolicyPreviewDialog
        policy={previewPolicy}
        onClose={() => setPreviewPolicy(null)}
        onEdit={(p) => {
          setPreviewPolicy(null);
          setEditDialog({ open: true, existing: p });
        }}
      />

      <ConfirmDialog
        open={!!confirmArchive}
        onOpenChange={(o) => !o && !archiving && setConfirmArchive(null)}
        title={`Archiver "${confirmArchive?.title ?? ""}" ?`}
        description={t("politique_restera_consultable_historique_mais")}
        confirmLabel={t("archiver")}
        variant="destructive"
        loading={archiving}
        onConfirm={async () => {
          if (!confirmArchive) return;
          setArchiving(true);
          const r = await upsertHrPolicyAction({
            id: confirmArchive.id,
            key: confirmArchive.key,
            title: confirmArchive.title,
            version: confirmArchive.version,
            bodyMarkdown: confirmArchive.bodyMarkdown,
            effectiveFrom: confirmArchive.effectiveFrom.split("T")[0],
            isActive: false,
          });
          setArchiving(false);
          if (r.success) {
            toast.success(t("politique_archivee"));
            router.refresh();
          } else {
            toast.error(r.error || "");
          }
          setConfirmArchive(null);
        }}
      />


      {pdfPreviewCtx && (
        <PolicyPdfPreviewAutoTrigger
          key={pdfPreviewCtx.nonce}
          policy={pdfPreviewCtx.policy}
          onDone={() => setPdfPreviewCtx(null)}
        />
      )}
    </div>
  );
}

// =============================================================
// Helper : declenche programmatiquement TemplatePdfPreviewButton
// pour une politique (rendu invisible).
// =============================================================
function PolicyPdfPreviewAutoTrigger({
  policy,
  onDone,
}: {
  policy: Policy;
  onDone: () => void;
}) {
  const t = useTranslations("admin.hr_nav");
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const t = window.setTimeout(() => {
      triggerRef.current?.click();
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="sr-only" aria-hidden>
      <TemplatePdfPreviewButton
        bodyMarkdown={policy.bodyMarkdown}
        title={policy.title}
        documentType="policy"
        metadata={{ version: policy.version }}
        signatureScope="none"
        onError={(err) => {
          toast.error(err.message || t("apercu_indisponible"));
          onDone();
        }}
        trigger={<button ref={triggerRef} type="button">{t("apercu")}</button>}
      />
    </div>
  );
}

// ================================================================
//              DIALOG : Preview (lecture seule)
// ================================================================
function PolicyPreviewDialog({
  policy,
  onClose,
  onEdit,
}: {
  policy: Policy | null;
  onClose: () => void;
  onEdit: (p: Policy) => void;
}) {
  const t = useTranslations("admin.hr_nav");
  const tc = useTranslations("common");
  const dateTag = useDateLocale();
  return (
    <Dialog open={!!policy} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] p-0 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-base text-white flex items-center gap-2 pr-8">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span className="truncate">{policy?.title ?? ""}</span>
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>v{policy?.version}</span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                En vigueur depuis {formatDate(policy?.effectiveFrom, dateTag)}
              </span>
              {policy && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] border-white/40",
                    policy.isActive ? "bg-emerald-500/20 text-white" : "bg-white/10 text-white/80"
                  )}
                >
                  {policy.isActive ? t("active") : t("archivee")}
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1 bg-card">
          {policy?.bodyMarkdown ? (
            <MarkdownView>{policy.bodyMarkdown}</MarkdownView>
          ) : (
            <p className="text-sm text-muted-foreground italic">{t("aucun_contenu")}</p>
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0 gap-2">
          <Button variant="outline" onClick={onClose}>
            {tc("close")}
          </Button>
          {policy && (
            <TemplatePdfPreviewButton
              bodyMarkdown={policy.bodyMarkdown}
              title={policy.title}
              documentType="policy"
              metadata={{ version: policy.version }}
              signatureScope="none"
              onError={(err) => toast.error(err.message || t("apercu_indisponible"))}
              trigger={
                <Button variant="outline">
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  {t("apercu_pdf")}
                </Button>
              }
            />
          )}
          {policy && (
            <Button
              onClick={() => onEdit(policy)}
              className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            >
              <Edit3 className="h-3.5 w-3.5 mr-1.5" />
              {tc("edit")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Indicateurs reserves pour usage futur
export const _PolicyIcons = { Eye, XCircle, ActionTooltip, FileText, Layers };
