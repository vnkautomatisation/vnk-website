"use client";
// =============================================================
// MyPayrollView - the employee's own pay stubs.
//
// Conventions :
//  - Header navy gradient + KPI cards
//  - Sticky bar (pattern Finance)
//  - Tabs : Mes bulletins / Documents fiscaux
//  - PDFs via PdfPreviewModal
// =============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDateLocale } from "@/lib/i18n-format";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  Wallet, Receipt, DollarSign, FileText, Eye, Calendar, Sparkles,
  Search, Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingsTabs, type TabItem } from "@/components/admin/settings-tabs";
import { DocumentStatsCard } from "@/components/admin/document-stats-card";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { PdfPreviewModal } from "@/components/admin/pdf-preview-modal";

type Stub = {
  id: number;
  hoursRegular: number;
  hoursOvertime: number;
  hoursVacation: number;
  hoursSick: number;
  hoursHoliday: number;
  holidayIndemnity: number;
  rate: number;
  grossPay: number;
  deductionFederal: number;
  deductionProvincial: number;
  deductionRrq: number;
  deductionAe: number;
  deductionRqap: number;
  deductionOther: number;
  netPay: number;
  releasedAt: string | null;
  period: { id?: number; startDate: string; endDate: string; payDate?: string };
};

type TaxDoc = {
  id: number;
  type: string;
  taxYear: number | null;
  title: string;
  fileUrl: string;
  issuedAt: string;
};

const TAX_TYPE_META: Record<string, { label: string; short: string }> = {
  t4: { label: "T4 (Canada)", short: "T4" },
  releve1: { label: "Releve 1 (Quebec)", short: "RL-1" },
  nr4: { label: "NR4", short: "NR4" },
  t2200: { label: "T2200 (frais teletravail)", short: "T2200" },
  employment_letter: { label: "Lettre d'emploi", short: "Lettre" },
  other: { label: "Autre", short: "Autre" },
};

type TabKey = "stubs" | "tax";

function formatMoney(v: number | string, tag: string): string {
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return "-";
  return new Intl.NumberFormat(tag, { style: "currency", currency: "CAD" }).format(n);
}

function formatDate(iso: string | null | undefined, tag: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric" });
}

// A @db.Date column serializes at UTC midnight, so reading it locally shows the
// day before anywhere west of Greenwich. Pay period bounds are date-only.
function formatDateOnly(iso: string | null | undefined, tag: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function isThisYear(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === new Date().getFullYear();
}

export function MyPayrollView({
  stubs, taxDocs,
}: {
  stubs: Stub[];
  taxDocs: TaxDoc[];
}) {
  const t = useTranslations("admin.payroll");
  const [tab, setTab] = useState<TabKey>("stubs");
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string; description?: string; filename?: string } | null>(null);
  const dateTag = useDateLocale();


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

  const openStubPdf = useCallback((s: Stub) => {
    setPdfPreview({
      url: `/api/admin/pay-stubs/${s.id}/pdf`,
      title: t("my_payroll_view_bulletin_de_paie_p0", { p0: s.id }),
      description: `${formatDateOnly(s.period.startDate, dateTag)} - ${formatDateOnly(s.period.endDate, dateTag)}`,
      filename: `bulletin-paie-${s.id}.pdf`,
    });
  }, []);

  const openTaxPdf = useCallback((d: TaxDoc) => {
    const meta = TAX_TYPE_META[d.type] ?? { label: d.type, short: d.type };
    setPdfPreview({
      url: d.fileUrl,
      title: d.title,
      description: `${meta.label}${d.taxYear ? ` - ${d.taxYear}` : ""}`,
      filename: `${meta.short}-${d.taxYear ?? "doc"}-${d.id}.pdf`,
    });
  }, []);


  const kpis = useMemo(() => {
    const released = stubs.filter((s) => s.releasedAt);
    const ytd = released
      .filter((s) => isThisYear(s.releasedAt))
      .reduce((sum, s) => sum + Number(s.netPay), 0);
    const grossYtd = released
      .filter((s) => isThisYear(s.releasedAt))
      .reduce((sum, s) => sum + Number(s.grossPay), 0);
    const last = released[0] ?? null;
    return { count: released.length, ytd, grossYtd, last, taxCount: taxDocs.length };
  }, [stubs, taxDocs]);

  const TABS: TabItem<TabKey>[] = [
    { key: "stubs", label: t("mes_bulletins"), icon: Wallet, count: kpis.count },
    { key: "tax", label: t("documents_fiscaux"), icon: FileText, count: taxDocs.length },
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
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold">{t("ma_paie")}</h1>
              <p className="text-xs text-white/80">
                {t("consultez_bulletins_paie_documents_fiscaux")}
              </p>
            </div>
          </div>
        </div>
      </div>


      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <DocumentStatsCard
          label={t("bulletins_disponibles")}
          value={kpis.count}
          icon={Receipt}
          accent="info"
          hint={kpis.last
            ? `Dernier : ${formatDateOnly(kpis.last.period.startDate, dateTag)}`
            : t("aucun_bulletin_moment")}
          onClick={() => setTab("stubs")}
        />
        <DocumentStatsCard
          label={t("net_cumule_ytd")}
          value={formatMoney(kpis.ytd, dateTag)}
          icon={Wallet}
          accent="success"
          hint={`Annee ${new Date().getFullYear()}`}
        />
        <DocumentStatsCard
          label={t("brut_cumule_ytd")}
          value={formatMoney(kpis.grossYtd, dateTag)}
          icon={DollarSign}
          accent="navy"
          hint={t("avant_deductions_source")}
        />
        <DocumentStatsCard
          label={t("documents_fiscaux")}
          value={kpis.taxCount}
          icon={FileText}
          accent={kpis.taxCount > 0 ? "info" : "navy"}
          hint={t("t4_releve_1_lettres")}
          onClick={() => setTab("tax")}
        />
      </div>


      <div ref={sentinelRef} aria-hidden className="h-px" />


      {navExtraEl && scrolled
        ? createPortal(
            <div className="flex items-center gap-x-2 sm:gap-x-3 text-[11px] sm:text-xs whitespace-nowrap lg:hidden">
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">{t("bul")}</span>
                  <span className="hidden min-[480px]:inline">{t("bulletins")}</span>
                </span>
                <span className="font-semibold text-[#0F2D52]">{kpis.count}</span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">{t("ytd")}</span>
                  <span className="hidden min-[480px]:inline">{t("net_ytd")}</span>
                </span>
                <span className="font-semibold text-emerald-700">{formatMoney(kpis.ytd, dateTag)}</span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">{t("fisc")}</span>
                  <span className="hidden min-[480px]:inline">{t("docs_fiscaux")}</span>
                </span>
                <span className="font-semibold text-[#0F2D52]">{kpis.taxCount}</span>
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
            <Wallet className="h-4 w-4" />
            {t("ma_paie")}
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">{t("bulletins")}</span>
            <span className="font-semibold text-[#0F2D52]">{kpis.count}</span>
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">{t("net_ytd")}</span>
            <span className="font-semibold text-emerald-700">{formatMoney(kpis.ytd, dateTag)}</span>
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">{t("docs_fiscaux")}</span>
            <span className="font-semibold text-[#0F2D52]">{kpis.taxCount}</span>
          </span>
        </div>
        <div className="px-4 sm:px-5 lg:px-4">
          <SettingsTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel={t("navigation_ma_paie")} />
        </div>
      </div>

      {tab === "stubs" && <MyStubsTab stubs={stubs} onOpenPdf={openStubPdf} />}
      {tab === "tax" && <MyTaxDocsTab docs={taxDocs} onOpenPdf={openTaxPdf} />}

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
// TAB : MY STUBS
// =============================================================
function MyStubsTab({ stubs, onOpenPdf }: { stubs: Stub[]; onOpenPdf: (s: Stub) => void }) {
  const t = useTranslations("admin.payroll");
  if (stubs.length === 0) {
    return (
      <Card className="p-10 text-center space-y-3">
        <Wallet className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          {t("aucun_bulletin_paie_disponible_moment")}
        </p>
        <p className="text-[11px] text-muted-foreground/80">
          {t("bulletins_apparaitront_ici_fois_periode")}
        </p>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {stubs.map((s) => (
        <MyStubCard key={s.id} stub={s} onOpenPdf={() => onOpenPdf(s)} />
      ))}
    </div>
  );
}

function MyStubCard({ stub, onOpenPdf }: { stub: Stub; onOpenPdf: () => void }) {
  const t = useTranslations("admin.payroll");
  const dateTag = useDateLocale();
  const totalDeductions =
    Number(stub.deductionFederal) + Number(stub.deductionProvincial) +
    Number(stub.deductionRrq) + Number(stub.deductionAe) +
    Number(stub.deductionRqap) + Number(stub.deductionOther);

  return (
    <Card className="overflow-hidden vnk-card-hover">
      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center ring-2 ring-white/20 shrink-0">
            <Receipt className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider opacity-80">{t("periode")}</p>
            <h3 className="font-bold text-sm truncate">
              {formatDateOnly(stub.period.startDate, dateTag)} - {formatDateOnly(stub.period.endDate, dateTag)}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider opacity-80">{t("net_payer")}</p>
            <p className="text-2xl font-bold tabular-nums">{formatMoney(stub.netPay, dateTag)}</p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="bg-white/15 text-white hover:bg-white/25 border-0 h-8"
            onClick={onOpenPdf}
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            {t("apercu_pdf")}
          </Button>
        </div>
      </div>
      <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {t("heures_regulieres")}
          </p>
          <p className="font-mono">
            {Number(stub.hoursRegular).toFixed(2)} h x {formatMoney(stub.rate, dateTag)}
          </p>
        </div>
        {Number(stub.hoursOvertime) > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {t("heures_supplementaires")}
            </p>
            <p className="font-mono">{Number(stub.hoursOvertime).toFixed(2)} h x 1.5</p>
          </div>
        )}
        {Number(stub.hoursHoliday) > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {t("jour_ferie_travaille")}
            </p>
            <p className="font-mono">{Number(stub.hoursHoliday).toFixed(2)} h x 2</p>
          </div>
        )}
        {Number(stub.holidayIndemnity) > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {t("indemnite_ferie")}
            </p>
            <p className="font-mono">{formatMoney(stub.holidayIndemnity, dateTag)}</p>
          </div>
        )}
        {Number(stub.hoursVacation) > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {t("vacances")}
            </p>
            <p className="font-mono">{Number(stub.hoursVacation).toFixed(2)} h</p>
          </div>
        )}
        <div className="col-span-full border-t pt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">{t("brut")} </span>
            <strong className="tabular-nums">{formatMoney(stub.grossPay, dateTag)}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">{t("federal")} </span>
            <strong className="tabular-nums">-{formatMoney(stub.deductionFederal, dateTag)}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">{t("provincial")} </span>
            <strong className="tabular-nums">-{formatMoney(stub.deductionProvincial, dateTag)}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">{t("rrq")} </span>
            <strong className="tabular-nums">-{formatMoney(stub.deductionRrq, dateTag)}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">{t("ae")} </span>
            <strong className="tabular-nums">-{formatMoney(stub.deductionAe, dateTag)}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">{t("rqap")} </span>
            <strong className="tabular-nums">-{formatMoney(stub.deductionRqap, dateTag)}</strong>
          </div>
          <div className="md:col-span-2">
            <span className="text-muted-foreground">{t("total_deductions")} </span>
            <strong className="tabular-nums">-{formatMoney(totalDeductions, dateTag)}</strong>
          </div>
        </div>
      </div>
    </Card>
  );
}

// =============================================================
// TAB : MY TAX DOCS
// =============================================================
function MyTaxDocsTab({ docs, onOpenPdf }: { docs: TaxDoc[]; onOpenPdf: (d: TaxDoc) => void }) {
  const t = useTranslations("admin.payroll");
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const dateTag = useDateLocale();

  const years = useMemo(
    () => Array.from(new Set(docs.map((d) => d.taxYear).filter((y): y is number => y !== null))).sort((a, b) => b - a),
    [docs],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (yearFilter !== "all" && String(d.taxYear ?? "none") !== yearFilter) return false;
      if (q && !d.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [docs, search, yearFilter]);

  const byYear = useMemo(() => {
    const map = new Map<number | string, TaxDoc[]>();
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
        <p className="text-sm text-muted-foreground">
          {t("aucun_document_fiscal_disponible_moment")}
        </p>
        <p className="text-[11px] text-muted-foreground/80">
          {t("t4_releves_1_autres_documents")}
        </p>
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
              placeholder={t("rechercher_document")}
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
                {list.map((d) => {
                  const meta = TAX_TYPE_META[d.type] ?? { label: d.type, short: d.type };
                  return (
                    <div key={d.id} className="p-3 flex items-center gap-3 hover:bg-[#0F2D52]/5 transition">
                      <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/8 ring-1 ring-[#0F2D52]/15 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-[#0F2D52]" />
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase shrink-0">{meta.short}</Badge>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{d.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {meta.label} - emis le {formatDate(d.issuedAt, dateTag)}
                        </p>
                      </div>
                      <ActionTooltip label={t("apercu_pdf")}>
                        <Button
                          size="icon" variant="ghost" className="h-8 w-8"
                          aria-label={t("apercu_pdf")}
                          onClick={() => onOpenPdf(d)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </ActionTooltip>
                    </div>
                  );
                })}
              </div>
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
