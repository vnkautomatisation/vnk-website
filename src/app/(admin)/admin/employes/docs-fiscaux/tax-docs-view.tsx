"use client";
// =============================================================
// TaxDocsView - hub admin Documents fiscaux (refonte VNK)
//
// Conventions :
//  - Header navy gradient + KPI cards (DocumentStatsCard)
//  - Sticky bar pattern Finance (sentinel + IntersectionObserver)
//  - Tabs SettingsTabs : Vue d'ensemble / T4 / Releve 1 / Autres
//  - PDFs via PdfPreviewModal (jamais window.open)
//  - Modals VNK : header navy + FormSection/Field + footer sticky
// =============================================================
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useDateLocale } from "@/lib/i18n-format";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileText, Upload, Sparkles, Users, Eye, Calendar, Archive,
  Receipt, BadgePercent, Briefcase, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingsTabs, type TabItem } from "@/components/admin/settings-tabs";
import { DocumentStatsCard } from "@/components/admin/document-stats-card";
import { FormSection, Field } from "@/components/admin/form-section";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { PdfPreviewModal } from "@/components/admin/pdf-preview-modal";
import {
  issueTaxDocumentAction, generateAnnualTaxDocAction, generateAnnualTaxDocsBulkAction,
} from "@/app/actions/hr-tax-docs";
import { FileUploadInput } from "@/components/admin/file-upload-input";

type Doc = {
  id: number;
  type: string;
  taxYear: number | null;
  title: string;
  fileUrl: string;
  issuedAt: string;
  admin: { id: number; fullName: string | null; email: string };
};
type Emp = { id: number; fullName: string | null; email: string };

type TabKey = "overview" | "t4" | "releve1" | "other";

const TYPE_META: Record<string, { label: string; short: string; tone: "info" | "success" | "warning" | "navy" }> = {
  t4: { label: "T4 (Canada)", short: "T4", tone: "info" },
  releve1: { label: "Releve 1 (Quebec)", short: "RL-1", tone: "success" },
  nr4: { label: "NR4", short: "NR4", tone: "warning" },
  t2200: { label: "T2200 (frais teletravail)", short: "T2200", tone: "warning" },
  employment_letter: { label: "Lettre d'emploi", short: "Lettre", tone: "navy" },
  other: { label: "Autre", short: "Autre", tone: "navy" },
};

function formatDate(iso: string | null | undefined, tag: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric" });
}

// =============================================================
// MAIN VIEW
// =============================================================
export function TaxDocsView({ employees, docs }: { employees: Emp[]; docs: Doc[] }) {
  const t = useTranslations("admin.tax_docs");
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("overview");
  const [issueDialog, setIssueDialog] = useState(false);
  const [autoDialog, setAutoDialog] = useState(false);
  const [bulkDialog, setBulkDialog] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string; description?: string; filename?: string } | null>(null);


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

  const openPdf = useCallback((d: Doc) => {
    setPdfPreview({
      url: d.fileUrl,
      title: d.title,
      description: `${d.admin.fullName ?? d.admin.email} - ${TYPE_META[d.type]?.label ?? d.type}${d.taxYear ? ` - ${d.taxYear}` : ""}`,
      filename: `${TYPE_META[d.type]?.short ?? d.type}-${d.taxYear ?? "doc"}-${d.id}.pdf`,
    });
  }, []);


  const kpis = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    const docsCurrentYear = docs.filter((d) => d.taxYear === currentYear).length;
    const docsLastYear = docs.filter((d) => d.taxYear === lastYear).length;
    const years = Array.from(new Set(docs.map((d) => d.taxYear).filter((y): y is number => y !== null))).sort((a, b) => b - a);
    const employeesWithDocs = new Set(docs.map((d) => d.admin.id)).size;
    return {
      total: docs.length,
      currentYear: docsCurrentYear,
      lastYear: docsLastYear,
      years,
      employeesWithDocs,
      coverage: employees.length > 0 ? Math.round((employeesWithDocs / employees.length) * 100) : 0,
    };
  }, [docs, employees]);


  const t4Docs = docs.filter((d) => d.type === "t4");
  const rl1Docs = docs.filter((d) => d.type === "releve1");
  const otherDocs = docs.filter((d) => d.type !== "t4" && d.type !== "releve1");

  const TABS: TabItem<TabKey>[] = [
    { key: "overview", label: t("vue_ensemble"), icon: Sparkles },
    { key: "t4", label: "T4", icon: Receipt, count: t4Docs.length },
    { key: "releve1", label: t("releve_1"), icon: BadgePercent, count: rl1Docs.length },
    { key: "other", label: t("autres"), icon: Briefcase, count: otherDocs.length },
  ];

  return (
    <div className="space-y-4">

      <div className="rounded-xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-4 sm:px-5 py-4 text-white relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32"
          aria-hidden
        />
        <div className="relative flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center ring-2 ring-white/20 shrink-0">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold">{t("documents_fiscaux")}</h1>
              <p className="text-xs text-white/80">
                {t("emission_t4_releve_1_nr4")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm" variant="outline"
              onClick={() => setBulkDialog(true)}
              className="h-8 text-xs bg-white/15 text-white border-white/30 hover:bg-white/25 hover:text-white"
            >
              <Users className="h-3.5 w-3.5 mr-1.5" />
              {t("generer_lot")}
            </Button>
            <Button
              size="sm" variant="outline"
              onClick={() => setAutoDialog(true)}
              className="h-8 text-xs bg-white/15 text-white border-white/30 hover:bg-white/25 hover:text-white"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              {t("generer_auto")}
            </Button>
            <Button
              size="sm"
              onClick={() => setIssueDialog(true)}
              className="h-8 text-xs bg-white text-[#0F2D52] hover:bg-white/90 font-semibold"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              {t("televerser")}
            </Button>
          </div>
        </div>
      </div>


      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <DocumentStatsCard
          label={t("documents_emis")}
          value={kpis.total}
          icon={Archive}
          accent="navy"
          hint={`${kpis.years.length} annee${kpis.years.length > 1 ? "s" : ""} couverte${kpis.years.length > 1 ? "s" : ""}`}
        />
        <DocumentStatsCard
          label={`Annee ${new Date().getFullYear()}`}
          value={kpis.currentYear}
          icon={Calendar}
          accent="info"
          hint={t("documents_emis_annee")}
        />
        <DocumentStatsCard
          label={`Annee ${new Date().getFullYear() - 1}`}
          value={kpis.lastYear}
          icon={Calendar}
          accent="info"
          hint={t("t4_rl_1_an_dernier")}
        />
        <DocumentStatsCard
          label={t("couverture_employes")}
          value={`${kpis.coverage}%`}
          icon={Users}
          accent={kpis.coverage >= 90 ? "success" : kpis.coverage >= 60 ? "warning" : "danger"}
          hint={`${kpis.employeesWithDocs} / ${employees.length} employes`}
        />
      </div>


      <div ref={sentinelRef} aria-hidden className="h-px" />


      {navExtraEl && scrolled
        ? createPortal(
            <div className="flex items-center gap-x-2 sm:gap-x-3 text-[11px] sm:text-xs whitespace-nowrap lg:hidden">
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">{t("tot")}</span>
                  <span className="hidden min-[480px]:inline">{t("total")}</span>
                </span>
                <span className="font-semibold text-[#0F2D52]">{kpis.total}</span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">{t("couv")}</span>
                  <span className="hidden min-[480px]:inline">{t("couverture")}</span>
                </span>
                <span className={kpis.coverage >= 90 ? "font-semibold text-emerald-600" : kpis.coverage >= 60 ? "font-semibold text-amber-600" : "font-semibold text-red-600"}>
                  {kpis.coverage}%
                </span>
              </span>
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
            <FileText className="h-4 w-4" />
            {t("documents_fiscaux")}
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">{t("total")}</span>
            <span className="font-semibold text-[#0F2D52]">{kpis.total}</span>
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">{t("couverture")}</span>
            <span className={kpis.coverage >= 90 ? "font-semibold text-emerald-600" : kpis.coverage >= 60 ? "font-semibold text-amber-600" : "font-semibold text-red-600"}>
              {kpis.coverage}%
            </span>
          </span>
          <Button
            size="sm"
            onClick={() => setIssueDialog(true)}
            className="h-7 text-xs ml-auto bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            {t("televerser")}
          </Button>
        </div>
        <div className="px-4 sm:px-5 lg:px-4">
          <SettingsTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel={t("navigation_documents_fiscaux")} />
        </div>
      </div>


      {tab === "overview" && (
        <OverviewTab
          docs={docs}
          years={kpis.years}
          employees={employees}
          onOpenPdf={openPdf}
          onIssue={() => setIssueDialog(true)}
          onAuto={() => setAutoDialog(true)}
          onBulk={() => setBulkDialog(true)}
        />
      )}

      {tab === "t4" && <DocsByYearTab docs={t4Docs} onOpenPdf={openPdf} emptyLabel={t("aucun_t4_emis")} />}
      {tab === "releve1" && <DocsByYearTab docs={rl1Docs} onOpenPdf={openPdf} emptyLabel={t("aucun_releve_1_emis")} />}
      {tab === "other" && <DocsByYearTab docs={otherDocs} onOpenPdf={openPdf} emptyLabel={t("aucun_autre_document_fiscal")} />}


      <IssueDialog
        open={issueDialog}
        employees={employees}
        onClose={() => setIssueDialog(false)}
        onSaved={() => router.refresh()}
      />
      <AutoGenerateDialog
        open={autoDialog}
        employees={employees}
        onClose={() => setAutoDialog(false)}
        onSaved={() => router.refresh()}
      />
      <BulkGenerateDialog
        open={bulkDialog}
        onClose={() => setBulkDialog(false)}
        onSaved={() => router.refresh()}
      />

      <PdfPreviewModal
        open={!!pdfPreview}
        url={pdfPreview?.url ?? null}
        title={pdfPreview?.title ?? ""}
        description={pdfPreview?.description}
        downloadFilename={pdfPreview?.filename}
        onClose={() => setPdfPreview(null)}
      />
    </div>
  );
}

// =============================================================
// TAB : OVERVIEW
// =============================================================
function OverviewTab({
  docs, years, employees, onOpenPdf, onIssue, onAuto, onBulk,
}: {
  docs: Doc[];
  years: number[];
  employees: Emp[];
  onOpenPdf: (d: Doc) => void;
  onIssue: () => void;
  onAuto: () => void;
  onBulk: () => void;
}) {
  const t = useTranslations("admin.tax_docs");
  const recentDocs = useMemo(
    () => [...docs].sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()).slice(0, 6),
    [docs],
  );
  const yearStats = useMemo(() => {
    return years.map((y) => ({
      year: y,
      total: docs.filter((d) => d.taxYear === y).length,
      t4: docs.filter((d) => d.taxYear === y && d.type === "t4").length,
      rl1: docs.filter((d) => d.taxYear === y && d.type === "releve1").length,
    })).slice(0, 5);
  }, [docs, years]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#0F2D52]" />
            {t("actions_rapides")}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("generation_automatique_partir_bulletins_paie")}
        </p>
        <Button
          size="sm"
          className="w-full h-8 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          onClick={onAuto}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          {t("generer_t4_rl_1_1")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-full h-8 text-xs border-[#0F2D52]/30 text-[#0F2D52]"
          onClick={onBulk}
        >
          <Users className="h-3.5 w-3.5 mr-1.5" />
          {t("generer_lot_tous")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-full h-8 text-xs"
          onClick={onIssue}
        >
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          {t("televerser_pdf")}
        </Button>
      </Card>


      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#0F2D52]" />
            {t("annee_fiscale")}
          </h3>
        </div>
        {yearStats.length > 0 ? (
          <div className="space-y-1.5">
            {yearStats.map((s) => (
              <div key={s.year} className="flex items-center justify-between text-xs gap-2 border-b last:border-0 pb-1.5 last:pb-0">
                <span className="font-medium">{s.year}</span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] text-sky-700 border-sky-300 bg-sky-50">
                    T4 : {s.t4}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50">
                    RL-1 : {s.rl1}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    Total : {s.total}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("aucun_document_emis")}</p>
        )}
        <p className="text-[10px] text-muted-foreground/80 pt-1">
          {t("employes_actifs_total", { count: employees.length })}
        </p>
      </Card>


      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Archive className="h-4 w-4 text-[#0F2D52]" />
            {t("recemment_emis")}
          </h3>
        </div>
        {recentDocs.length > 0 ? (
          <div className="space-y-1.5">
            {recentDocs.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => onOpenPdf(d)}
                className="w-full flex items-center justify-between text-xs gap-2 border-b last:border-0 pb-1.5 last:pb-0 hover:text-[#0F2D52] text-left"
              >
                <span className="truncate flex-1">
                  <span className="font-medium">{TYPE_META[d.type]?.short ?? d.type}</span>
                  {d.taxYear && <span className="text-muted-foreground"> {d.taxYear}</span>}
                  <span className="text-muted-foreground"> - {d.admin.fullName ?? d.admin.email}</span>
                </span>
                <Eye className="h-3.5 w-3.5 shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("aucun_document_recemment_emis")}</p>
        )}
      </Card>
    </div>
  );
}

// =============================================================
// TAB : DOCS BY YEAR (T4 / RL-1 / Autres)
// =============================================================
function DocsByYearTab({
  docs, onOpenPdf, emptyLabel,
}: {
  docs: Doc[];
  onOpenPdf: (d: Doc) => void;
  emptyLabel: string;
}) {
  const t = useTranslations("admin.tax_docs");
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");

  const years = useMemo(
    () => Array.from(new Set(docs.map((d) => d.taxYear).filter((y): y is number => y !== null))).sort((a, b) => b - a),
    [docs],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (yearFilter !== "all" && String(d.taxYear ?? "none") !== yearFilter) return false;
      if (q) {
        const name = (d.admin.fullName || d.admin.email).toLowerCase();
        const title = d.title.toLowerCase();
        if (!name.includes(q) && !title.includes(q)) return false;
      }
      return true;
    });
  }, [docs, search, yearFilter]);

  const byYear = useMemo(() => {
    const map = new Map<number | string, Doc[]>();
    for (const d of filtered) {
      const y = d.taxYear ?? t("sans_annee");
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(d);
    }
    return Array.from(map.entries()).sort((a, b) => {
      const aY = typeof a[0] === "number" ? a[0] : -Infinity;
      const bY = typeof b[0] === "number" ? b[0] : -Infinity;
      return bY - aY;
    });
  }, [filtered]);

  if (docs.length === 0) {
    return (
      <Card className="p-10 text-center space-y-3">
        <FileText className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("rechercher_employe_titre")}
              className="h-9 text-sm pl-7"
            />
          </div>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={t("annee")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("toutes_annees")}</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {byYear.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t("aucun_resultat_filtres")}
        </Card>
      ) : (
        byYear.map(([year, list]) => (
          <section key={String(year)} className="space-y-2">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52] inline-flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              Annee {year}
              <Badge variant="outline" className="text-[10px]">
                {list.length} document{list.length > 1 ? "s" : ""}
              </Badge>
            </h2>
            <Card className="overflow-hidden">
              <div className="divide-y">
                {list.map((d) => (
                  <DocRow key={d.id} doc={d} onOpenPdf={() => onOpenPdf(d)} />
                ))}
              </div>
            </Card>
          </section>
        ))
      )}
    </div>
  );
}

function DocRow({ doc, onOpenPdf }: { doc: Doc; onOpenPdf: () => void }) {
  const t = useTranslations("admin.tax_docs");
  const dateTag = useDateLocale();
  const meta = TYPE_META[doc.type] ?? { label: doc.type, short: doc.type, tone: "navy" as const };
  return (
    <div className="p-3 flex items-center gap-3 hover:bg-[#0F2D52]/5 transition">
      <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/8 ring-1 ring-[#0F2D52]/15 flex items-center justify-center shrink-0">
        <FileText className="h-4 w-4 text-[#0F2D52]" />
      </div>
      <Badge variant="outline" className="text-[10px] uppercase shrink-0">{meta.short}</Badge>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{doc.admin.fullName || doc.admin.email}</p>
        <p className="text-xs text-muted-foreground truncate">
          {doc.title} - emis le {formatDate(doc.issuedAt, dateTag)}
        </p>
      </div>
      <ActionTooltip label={t("apercu_pdf")}>
        <Button
          size="icon" variant="ghost" className="h-8 w-8"
          aria-label={t("apercu_pdf")}
          onClick={onOpenPdf}
        >
          <Eye className="h-4 w-4" />
        </Button>
      </ActionTooltip>
    </div>
  );
}

// =============================================================
// DIALOG : Auto generate (1 employe)
// =============================================================
function AutoGenerateDialog({
  open, employees, onClose, onSaved,
}: {
  open: boolean;
  employees: Emp[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.tax_docs");
  const tc = useTranslations("common");
  const lastYear = new Date().getFullYear() - 1;
  const [adminId, setAdminId] = useState("");
  const [type, setType] = useState<"t4" | "releve1">("t4");
  const [year, setYear] = useState(String(lastYear));
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setAdminId("");
      setType("t4");
      setYear(String(lastYear));
      setPending(false);
    }
  }, [open, lastYear]);

  const submit = async () => {
    if (!adminId) { toast.error(t("selectionnez_employe")); return; }
    const y = Number(year);
    if (!Number.isFinite(y) || y < 2000 || y > 2100) { toast.error(t("annee_invalide")); return; }
    setPending(true);
    const r = await generateAnnualTaxDocAction({ adminId: Number(adminId), year: y, type });
    setPending(false);
    if (r.success) {
      toast.success(t("tax_docs_view_p0_p1_genere_et_notifie", { p0: type === "t4" ? "T4" : t("releve_1"), p1: y }));
      onSaved();
      onClose();
    } else {
      toast.error(r.error || t("erreur"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {t("generation_automatique")}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {t("partir_bulletins_paie_publies_apos")}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-4">
          <FormSection icon={Users} title={t("employe")}>
            <Field label={t("employe")} required>
              <Select value={adminId} onValueChange={setAdminId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={t("selectionner")} /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.fullName || e.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FormSection>
          <FormSection icon={FileText} title={t("document")}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("type")} required>
                <Select value={type} onValueChange={(v) => setType(v as "t4" | "releve1")}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="t4">{t("t4_canada")}</SelectItem>
                    <SelectItem value="releve1">{t("releve_1_quebec")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("annee_fiscale_2")} required>
                <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="h-9" />
              </Field>
            </div>
          </FormSection>
          <div className="rounded-md border border-amber-300/60 bg-amber-50 p-2.5 text-[11px] text-amber-900">
            {t("resume_non_officiel_agrege_bulletins")}
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={pending}>{tc("cancel")}</Button>
          <Button
            onClick={submit}
            disabled={pending}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            {pending ? t("generation") : t("generer_pdf")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================
// DIALOG : Bulk generate
// =============================================================
function BulkGenerateDialog({
  open, onClose, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.tax_docs");
  const tc = useTranslations("common");
  const lastYear = new Date().getFullYear() - 1;
  const [type, setType] = useState<"t4" | "releve1">("t4");
  const [year, setYear] = useState(String(lastYear));
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setType("t4");
      setYear(String(lastYear));
      setPending(false);
    }
  }, [open, lastYear]);

  const submit = async () => {
    const y = Number(year);
    if (!Number.isFinite(y) || y < 2000 || y > 2100) { toast.error(t("annee_invalide")); return; }
    setPending(true);
    const r = await generateAnnualTaxDocsBulkAction({ year: y, type });
    setPending(false);
    if (r.success) {
      const { generated, skipped } = r.data;
      toast.success(t("docs_generes_ignores", { generated, skipped }));
      onSaved();
      onClose();
    } else {
      toast.error(r.error || t("erreur"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t("generation_lot")}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {t("genere_document_chaque_employe_actif")}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-4">
          <FormSection icon={FileText} title={t("parametres")}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("type")} required>
                <Select value={type} onValueChange={(v) => setType(v as "t4" | "releve1")}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="t4">{t("t4_canada")}</SelectItem>
                    <SelectItem value="releve1">{t("releve_1_quebec")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("annee_fiscale_2")} required>
                <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="h-9" />
              </Field>
            </div>
          </FormSection>
          <div className="rounded-md border border-amber-300/60 bg-amber-50 p-2.5 text-[11px] text-amber-900">
            {t("operation_potentiellement_longue_document_cree")}
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={pending}>{tc("cancel")}</Button>
          <Button
            onClick={submit}
            disabled={pending}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            {pending ? t("generation") : t("lancer_generation")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================
// DIALOG : Issue (upload manual)
// =============================================================
function IssueDialog({
  open, employees, onClose, onSaved,
}: {
  open: boolean;
  employees: Emp[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.tax_docs");
  const tc = useTranslations("common");
  const [adminId, setAdminId] = useState("");
  const [type, setType] = useState<"t4" | "releve1" | "employment_letter" | "nr4" | "t2200" | "other">("t4");
  const [taxYear, setTaxYear] = useState(new Date().getFullYear().toString());
  const [title, setTitle] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setAdminId("");
      setType("t4");
      setTaxYear(new Date().getFullYear().toString());
      setTitle("");
      setFileUrl("");
      setPending(false);
    }
  }, [open]);

  const submit = async () => {
    if (!adminId || !title || !fileUrl) {
      toast.error(t("employe_titre_fichier_requis"));
      return;
    }
    setPending(true);
    const r = await issueTaxDocumentAction({
      adminId: Number(adminId),
      type, taxYear: Number(taxYear), title, fileUrl,
    });
    setPending(false);
    if (r.success) {
      toast.success(t("document_emis_notifie_employe"));
      onSaved();
      onClose();
    } else {
      toast.error(r.error || "");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] p-0 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Upload className="h-4 w-4" />
              {t("televerser_document_fiscal")}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {t("apos_employe_sera_notifie_automatiquement")}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <FormSection icon={Users} title={t("destinataire")}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t("employe")} required>
                <Select value={adminId} onValueChange={setAdminId}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={t("selectionner")} /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>{e.fullName || e.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("type")} required>
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as "t4" | "releve1" | "employment_letter" | "nr4" | "t2200" | "other")}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="t4">{t("t4_canada")}</SelectItem>
                    <SelectItem value="releve1">{t("releve_1_quebec")}</SelectItem>
                    <SelectItem value="nr4">NR4</SelectItem>
                    <SelectItem value="t2200">{t("t2200_frais_teletravail")}</SelectItem>
                    <SelectItem value="employment_letter">{t("lettre_apos_emploi")}</SelectItem>
                    <SelectItem value="other">{t("autre")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FormSection>
          <FormSection icon={FileText} title={t("document")}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t("annee_fiscale_2")}>
                <Input type="number" value={taxYear} onChange={(e) => setTaxYear(e.target.value)} className="h-9" />
              </Field>
              <Field label={t("titre")} required>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="T4 - 2024" className="h-9" />
              </Field>
            </div>
            <Field label={t("fichier_pdf")} required>
              <FileUploadInput
                value={fileUrl}
                onChange={setFileUrl}
                accept="application/pdf"
                folder="tax-docs"
                maxSizeMB={10}
              />
            </Field>
          </FormSection>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={pending}>{tc("cancel")}</Button>
          <Button
            onClick={submit}
            disabled={pending}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            {pending ? "..." : t("emettre_document")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
