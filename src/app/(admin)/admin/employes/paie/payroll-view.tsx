"use client";
// =============================================================
// PayrollView - hub admin Paie & bulletins (refonte VNK)
//
// Conventions :
//  - Header navy gradient + KPI cards (DocumentStatsCard)
//  - Sticky bar pattern Finance (sentinel + IntersectionObserver)
//  - Tabs SettingsTabs (Vue d'ensemble / Periodes / Bulletins / Mes bulletins)
//  - PDFs via PdfPreviewModal (jamais window.open)
//  - Modals VNK : header navy + FormSection/Field + footer sticky
//  - ActionTooltip (jamais title="...")
// =============================================================
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Calculator, Plus, Lock, CheckCircle2, Calendar, DollarSign,
  ChevronLeft, ChevronRight, Search, FileText, Sparkles, Wallet,
  TrendingUp, Receipt, Layers, Eye,
} from "lucide-react";
import { PdfPreviewModal } from "@/components/admin/pdf-preview-modal";
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
import {
  createPayPeriodAction, generatePayStubsAction, lockPayPeriodAction, markPayPeriodPaidAction,
} from "@/app/actions/hr-payroll";
import { confirmDialog } from "@/components/admin/prompt-dialog";

const STUBS_PAGE_SIZE = 25;

type Period = {
  id: number;
  startDate: string;
  endDate: string;
  payDate: string;
  status: string;
  _count: { stubs: number };
};
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
  period: { id?: number; startDate: string; endDate: string; payDate?: string; status?: string };
  admin?: { id: number; fullName: string | null; email: string };
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  open: { label: "Ouverte", color: "bg-blue-100 text-blue-700 border-blue-200" },
  locked: { label: "Verrouillee", color: "bg-amber-100 text-amber-700 border-amber-200" },
  paid: { label: "Payee", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

type TabKey = "overview" | "periods" | "stubs" | "my";

function formatMoney(v: number | string): string {
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" });
}

// A @db.Date column serializes at UTC midnight, so reading it locally shows the
// day before anywhere west of Greenwich. Pay period bounds are date-only.
function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function isThisMonth(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function isThisYear(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === new Date().getFullYear();
}

// =============================================================
// MAIN VIEW
// =============================================================
export function PayrollView({
  periods, myStubs, allStubs, isPayrollAdmin,
}: {
  periods: Period[];
  myStubs: Stub[];
  allStubs: Stub[];
  isPayrollAdmin: boolean;
}) {
  const t = useTranslations("admin.payroll");
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>(isPayrollAdmin ? "overview" : "my");
  const [createOpen, setCreateOpen] = useState(false);
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

  const openStubPdf = useCallback((s: Stub) => {
    const employeeName = s.admin?.fullName || s.admin?.email || t("employe");
    const periodLabel = `${formatDateOnly(s.period.startDate)} - ${formatDateOnly(s.period.endDate)}`;
    setPdfPreview({
      url: `/api/admin/pay-stubs/${s.id}/pdf`,
      title: `Bulletin de paie #${s.id}`,
      description: `${employeeName} - ${periodLabel}`,
      filename: `bulletin-paie-${s.id}.pdf`,
    });
  }, []);


  const kpis = useMemo(() => {
    const currentPeriod = periods.find((p) => p.status === "open")
      || periods.find((p) => p.status === "locked")
      || periods[0]
      || null;
    const stubsThisMonth = allStubs.filter((s) => isThisMonth(s.releasedAt)).length;
    const stubsPending = allStubs.filter((s) => !s.releasedAt).length;
    const totalYtd = allStubs
      .filter((s) => s.releasedAt && isThisYear(s.releasedAt))
      .reduce((sum, s) => sum + Number(s.netPay), 0);
    return { currentPeriod, stubsThisMonth, stubsPending, totalYtd };
  }, [periods, allStubs]);


  const myKpis = useMemo(() => {
    const released = myStubs.filter((s) => s.releasedAt);
    const ytd = released
      .filter((s) => isThisYear(s.releasedAt))
      .reduce((sum, s) => sum + Number(s.netPay), 0);
    const grossYtd = released
      .filter((s) => isThisYear(s.releasedAt))
      .reduce((sum, s) => sum + Number(s.grossPay), 0);
    const last = released[0] ?? null;
    return { count: released.length, ytd, grossYtd, last };
  }, [myStubs]);


  const TABS: TabItem<TabKey>[] = isPayrollAdmin
    ? [
        { key: "overview", label: t("vue_ensemble"), icon: Sparkles },
        { key: "periods", label: t("periodes"), icon: Calendar, count: periods.length },
        { key: "stubs", label: t("bulletins_2"), icon: Receipt, count: allStubs.length },
        { key: "my", label: t("mes_bulletins"), icon: Wallet, count: myStubs.length },
      ]
    : [
        { key: "my", label: t("mes_bulletins"), icon: Wallet, count: myStubs.length },
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
              <Calculator className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold">
                {isPayrollAdmin ? t("paie_bulletins") : t("mes_bulletins_paie")}
              </h1>
              <p className="text-xs text-white/80">
                {isPayrollAdmin
                  ? t("gerez_cycles_paie_generez_bulletins")
                  : t("consultez_telechargez_bulletins_paie_publies")}
              </p>
            </div>
          </div>
          {isPayrollAdmin && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={() => setCreateOpen(true)}
                className="h-8 text-xs bg-white text-[#0F2D52] hover:bg-white/90 font-semibold"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                {t("nouvelle_periode")}
              </Button>
            </div>
          )}
        </div>
      </div>


      {isPayrollAdmin ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DocumentStatsCard
            label={t("periode_cours")}
            value={kpis.currentPeriod
              ? STATUS_META[kpis.currentPeriod.status]?.label ?? kpis.currentPeriod.status
              : t("aucune")}
            icon={Calendar}
            accent={kpis.currentPeriod?.status === "paid" ? "success" : kpis.currentPeriod ? "info" : "navy"}
            hint={kpis.currentPeriod
              ? `${formatDateOnly(kpis.currentPeriod.startDate)} - ${formatDateOnly(kpis.currentPeriod.endDate)}`
              : t("creez_nouvelle_periode")}
            onClick={() => setTab("periods")}
          />
          <DocumentStatsCard
            label={t("bulletins_mois")}
            value={kpis.stubsThisMonth}
            icon={Receipt}
            accent="info"
            hint={t("bulletins_publies_mois_ci")}
            onClick={() => setTab("stubs")}
          />
          <DocumentStatsCard
            label={t("attente_2")}
            value={kpis.stubsPending}
            icon={Layers}
            accent={kpis.stubsPending > 0 ? "warning" : "success"}
            hint={t("bulletins_generes_non_publies")}
            onClick={() => setTab("stubs")}
          />
          <DocumentStatsCard
            label={t("total_verse_ytd")}
            value={formatMoney(kpis.totalYtd)}
            icon={TrendingUp}
            accent="navy"
            hint={t("net_cumule_depuis_1er_janvier")}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <DocumentStatsCard
            label={t("bulletins_disponibles")}
            value={myKpis.count}
            icon={Receipt}
            accent="info"
            hint={myKpis.last
              ? `Dernier : ${formatDateOnly(myKpis.last.period.startDate)}`
              : t("aucun_bulletin_moment")}
          />
          <DocumentStatsCard
            label={t("net_cumule_ytd")}
            value={formatMoney(myKpis.ytd)}
            icon={Wallet}
            accent="success"
            hint={`Annee ${new Date().getFullYear()}`}
          />
          <DocumentStatsCard
            label={t("brut_cumule_ytd")}
            value={formatMoney(myKpis.grossYtd)}
            icon={DollarSign}
            accent="navy"
            hint={t("avant_deductions_source")}
          />
        </div>
      )}


      <div ref={sentinelRef} aria-hidden className="h-px" />


      {navExtraEl && scrolled
        ? createPortal(
            <div className="flex items-center gap-x-2 sm:gap-x-3 text-[11px] sm:text-xs whitespace-nowrap lg:hidden">
              {isPayrollAdmin ? (
                <>
                  <span className="inline-flex items-baseline gap-1">
                    <span className="text-muted-foreground">
                      <span className="min-[480px]:hidden">{t("mois")}</span>
                      <span className="hidden min-[480px]:inline">{t("mois_2")}</span>
                    </span>
                    <span className="font-semibold text-[#0F2D52]">{kpis.stubsThisMonth}</span>
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="inline-flex items-baseline gap-1">
                    <span className="text-muted-foreground">
                      <span className="min-[480px]:hidden">{t("att")}</span>
                      <span className="hidden min-[480px]:inline">{t("attente")}</span>
                    </span>
                    <span className={kpis.stubsPending > 0 ? "font-semibold text-amber-600" : "font-semibold text-emerald-600"}>
                      {kpis.stubsPending}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-flex items-baseline gap-1">
                    <span className="text-muted-foreground">
                      <span className="min-[480px]:hidden">{t("bul")}</span>
                      <span className="hidden min-[480px]:inline">{t("bulletins")}</span>
                    </span>
                    <span className="font-semibold text-[#0F2D52]">{myKpis.count}</span>
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="inline-flex items-baseline gap-1">
                    <span className="text-muted-foreground">
                      <span className="min-[480px]:hidden">{t("ytd")}</span>
                      <span className="hidden min-[480px]:inline">{t("net_ytd")}</span>
                    </span>
                    <span className="font-semibold text-emerald-700">{formatMoney(myKpis.ytd)}</span>
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
            <Calculator className="h-4 w-4" />
            {isPayrollAdmin ? t("paie") : t("mes_bulletins")}
          </span>
          {isPayrollAdmin ? (
            <>
              <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="text-muted-foreground">{t("mois_2")}</span>
                <span className="font-semibold text-[#0F2D52]">{kpis.stubsThisMonth}</span>
              </span>
              <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="text-muted-foreground">{t("attente")}</span>
                <span className={kpis.stubsPending > 0 ? "font-semibold text-amber-600" : "font-semibold text-emerald-600"}>
                  {kpis.stubsPending}
                </span>
              </span>
              <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="text-muted-foreground">{t("ytd")}</span>
                <span className="font-semibold text-[#0F2D52]">{formatMoney(kpis.totalYtd)}</span>
              </span>
              <Button
                size="sm"
                onClick={() => setCreateOpen(true)}
                className="h-7 text-xs ml-auto bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                {t("nouvelle_periode")}
              </Button>
            </>
          ) : (
            <>
              <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="text-muted-foreground">{t("bulletins")}</span>
                <span className="font-semibold text-[#0F2D52]">{myKpis.count}</span>
              </span>
              <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="text-muted-foreground">{t("net_ytd")}</span>
                <span className="font-semibold text-emerald-700">{formatMoney(myKpis.ytd)}</span>
              </span>
            </>
          )}
        </div>
        <div className="px-4 sm:px-5 lg:px-4">
          <SettingsTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel={t("navigation_paie")} />
        </div>
      </div>


      {tab === "overview" && isPayrollAdmin && (
        <OverviewTab
          periods={periods}
          stubs={allStubs}
          kpis={kpis}
          onGoPeriods={() => setTab("periods")}
          onGoStubs={() => setTab("stubs")}
          onNewPeriod={() => setCreateOpen(true)}
        />
      )}

      {tab === "periods" && isPayrollAdmin && (
        <PeriodsTab periods={periods} onChanged={() => router.refresh()} onCreate={() => setCreateOpen(true)} />
      )}

      {tab === "stubs" && isPayrollAdmin && (
        <StubsList stubs={allStubs} periods={periods} onOpenPdf={openStubPdf} />
      )}

      {tab === "my" && (
        <MyStubsTab stubs={myStubs} onOpenPdf={openStubPdf} />
      )}


      <CreatePeriodDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
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
  periods, stubs, kpis, onGoPeriods, onGoStubs, onNewPeriod,
}: {
  periods: Period[];
  stubs: Stub[];
  kpis: {
    currentPeriod: Period | null;
    stubsThisMonth: number;
    stubsPending: number;
    totalYtd: number;
  };
  onGoPeriods: () => void;
  onGoStubs: () => void;
  onNewPeriod: () => void;
}) {
  const t = useTranslations("admin.payroll");
  const recentPeriods = periods.slice(0, 5);
  const recentStubs = stubs.slice(0, 6);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#0F2D52]" />
            {t("periode_cours")}
          </h3>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onGoPeriods}>
            {t("voir_tout")}
          </Button>
        </div>
        {kpis.currentPeriod ? (
          <div className="rounded-md border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                {formatDateOnly(kpis.currentPeriod.startDate)} - {formatDateOnly(kpis.currentPeriod.endDate)}
              </span>
              <Badge className={`text-[10px] border ${STATUS_META[kpis.currentPeriod.status]?.color ?? "bg-gray-100 text-gray-700"}`}>
                {STATUS_META[kpis.currentPeriod.status]?.label ?? kpis.currentPeriod.status}
              </Badge>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">{t("date_paie")}</span>
              <span className="font-medium">{formatDateOnly(kpis.currentPeriod.payDate)}</span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">{t("bulletins_generes")}</span>
              <span className="font-semibold text-[#0F2D52]">{kpis.currentPeriod._count.stubs}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("aucune_periode_active")}</p>
        )}
        <Button
          size="sm"
          className="w-full h-8 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          onClick={onNewPeriod}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {t("nouvelle_periode")}
        </Button>
      </Card>


      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#0F2D52]" />
            {t("periodes_recentes")}
          </h3>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onGoPeriods}>
            {t("voir_tout")}
          </Button>
        </div>
        {recentPeriods.length > 0 ? (
          <div className="space-y-1.5">
            {recentPeriods.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs gap-2 border-b last:border-0 pb-1.5 last:pb-0">
                <span className="truncate flex-1">
                  {formatDateOnly(p.startDate)} - {formatDateOnly(p.endDate)}
                </span>
                <Badge variant="outline" className={`text-[10px] ${STATUS_META[p.status]?.color ?? "bg-gray-100"}`}>
                  {STATUS_META[p.status]?.label ?? p.status}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("aucune_periode")}</p>
        )}
      </Card>


      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Receipt className="h-4 w-4 text-[#0F2D52]" />
            {t("bulletins_recents")}
          </h3>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onGoStubs}>
            {t("voir_tout")}
          </Button>
        </div>
        {recentStubs.length > 0 ? (
          <div className="space-y-1.5">
            {recentStubs.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs gap-2 border-b last:border-0 pb-1.5 last:pb-0">
                <span className="truncate flex-1">
                  {s.admin?.fullName || s.admin?.email}
                </span>
                <span className="font-mono font-semibold tabular-nums text-[#0F2D52]">
                  {formatMoney(s.netPay)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("aucun_bulletin")}</p>
        )}
      </Card>
    </div>
  );
}

// =============================================================
// TAB : PERIODS
// =============================================================
function PeriodsTab({
  periods, onChanged, onCreate,
}: {
  periods: Period[];
  onChanged: () => void;
  onCreate: () => void;
}) {
  const t = useTranslations("admin.payroll");
  if (periods.length === 0) {
    return (
      <Card className="p-10 text-center space-y-3">
        <Calendar className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t("aucune_periode_paie_creee")}</p>
        <Button
          size="sm"
          onClick={onCreate}
          className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {t("creer_periode")}
        </Button>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {periods.map((p) => (
        <PeriodCard key={p.id} period={p} onChanged={onChanged} />
      ))}
    </div>
  );
}

function PeriodCard({ period, onChanged }: { period: Period; onChanged: () => void }) {
  const t = useTranslations("admin.payroll");
  const s = STATUS_META[period.status] ?? { label: period.status, color: "bg-gray-100 text-gray-700" };
  const [busy, setBusy] = useState<"gen" | "lock" | "pay" | null>(null);

  return (
    <Card className="p-4 vnk-card-hover">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-[#0F2D52]/8 ring-1 ring-[#0F2D52]/15 flex items-center justify-center shrink-0">
            <Calendar className="h-5 w-5 text-[#0F2D52]" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">
              {formatDateOnly(period.startDate)} - {formatDateOnly(period.endDate)}
            </h3>
            <p className="text-xs text-muted-foreground">
              Date de paie : {formatDateOnly(period.payDate)} - {period._count.stubs} bulletin{period._count.stubs > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`text-[10px] border ${s.color}`}>{s.label}</Badge>
          {period.status === "open" && (
            <>
              <Button
                size="sm" variant="outline" className="h-7 text-xs"
                disabled={busy !== null}
                onClick={async () => {
                  setBusy("gen");
                  const r = await generatePayStubsAction({ periodId: period.id });
                  setBusy(null);
                  if (r.success) {
                    toast.success(`${r.data.stubsCreated} bulletin(s) genere(s)`);
                    if (r.data.provisionalRates) {
                      toast.warning(
                        t("taux_fiscaux_provisoires_annee_validez"),
                        { duration: 12000 },
                      );
                    }
                    onChanged();
                  }
                  else toast.error(r.error || "");
                }}
              >
                <Calculator className="h-3 w-3 mr-1" />
                {busy === "gen" ? "..." : t("generer")}
              </Button>
              <Button
                size="sm" variant="outline" className="h-7 text-xs"
                disabled={busy !== null}
                onClick={async () => {
                  setBusy("lock");
                  const r = await lockPayPeriodAction({ id: period.id });
                  setBusy(null);
                  if (r.success) { toast.success(t("periode_verrouillee")); onChanged(); }
                  else toast.error(r.error || "");
                }}
              >
                <Lock className="h-3 w-3 mr-1" />
                {busy === "lock" ? "..." : t("verrouiller")}
              </Button>
            </>
          )}
          {period.status === "locked" && (
            <Button
              size="sm" className="h-7 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
              disabled={busy !== null}
              onClick={async () => {
                const ok = await confirmDialog({
                  title: t("marquer_periode_comme_payee"),
                  description: t("bulletins_deviendront_visibles_employes_action"),
                  confirmLabel: t("marquer_payee"),
                });
                if (!ok) return;
                setBusy("pay");
                const r = await markPayPeriodPaidAction({ id: period.id });
                setBusy(null);
                if (r.success) { toast.success(t("periode_marquee_payee")); onChanged(); }
                else toast.error(r.error || "");
              }}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {busy === "pay" ? "..." : t("marquer_payee")}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// =============================================================
// TAB : STUBS (admin)
// =============================================================
function StubsList({ stubs, periods, onOpenPdf }: { stubs: Stub[]; periods: Period[]; onOpenPdf: (s: Stub) => void }) {
  const t = useTranslations("admin.payroll");
  const tc = useTranslations("common");
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all"); // all | released | draft
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stubs.filter((s) => {
      if (periodFilter !== "all" && String(s.period.id ?? "") !== periodFilter) return false;
      if (statusFilter === "released" && !s.releasedAt) return false;
      if (statusFilter === "draft" && s.releasedAt) return false;
      if (q) {
        const name = (s.admin?.fullName || s.admin?.email || "").toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [stubs, search, periodFilter, statusFilter]);

  useEffect(() => { setPage(0); }, [search, periodFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / STUBS_PAGE_SIZE));
  const pageItems = filtered.slice(page * STUBS_PAGE_SIZE, (page + 1) * STUBS_PAGE_SIZE);

  if (stubs.length === 0) {
    return (
      <Card className="p-10 text-center space-y-3">
        <Receipt className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t("aucun_bulletin_paie_moment")}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("rechercher_employe")}
              className="h-9 text-sm pl-7"
            />
          </div>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={t("periode")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("toutes_periodes")}</SelectItem>
              {periods.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {formatDateOnly(p.startDate)} - {formatDateOnly(p.endDate)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={tc("status")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tous_statuts")}</SelectItem>
              <SelectItem value="released">{t("publies")}</SelectItem>
              <SelectItem value="draft">{t("brouillons")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="divide-y">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {t("aucun_resultat_filtres")}
            </div>
          ) : pageItems.map((s) => (
            <div key={s.id} className="p-3 flex items-center gap-3 hover:bg-[#0F2D52]/5 transition">
              <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/8 ring-1 ring-[#0F2D52]/15 flex items-center justify-center shrink-0">
                <Receipt className="h-4 w-4 text-[#0F2D52]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{s.admin?.fullName || s.admin?.email}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {formatDateOnly(s.period.startDate)} - {formatDateOnly(s.period.endDate)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-sm font-bold tabular-nums">{formatMoney(s.netPay)}</p>
                <p className="text-[10px] text-muted-foreground">net</p>
              </div>
              {s.releasedAt ? (
                <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-[10px]">
                  {t("publie")}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px]">
                  {t("brouillon")}
                </Badge>
              )}
              <ActionTooltip label={t("apercu_pdf")}>
                <Button
                  size="icon" variant="ghost" className="h-8 w-8"
                  aria-label={t("apercu_pdf")}
                  onClick={() => onOpenPdf(s)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </ActionTooltip>
            </div>
          ))}
        </div>
        {filtered.length > STUBS_PAGE_SIZE && (
          <div className="px-3 py-2 border-t bg-muted/30 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Page {page + 1} / {totalPages} - {filtered.length} bulletin{filtered.length > 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline" size="icon" className="h-7 w-7"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                aria-label={t("page_precedente")}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline" size="icon" className="h-7 w-7"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                aria-label={t("page_suivante")}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// =============================================================
// TAB: MY STUBS (employee)
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
              {formatDateOnly(stub.period.startDate)} - {formatDateOnly(stub.period.endDate)}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider opacity-80">{t("net_payer")}</p>
            <p className="text-2xl font-bold tabular-nums">{formatMoney(stub.netPay)}</p>
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
            {Number(stub.hoursRegular).toFixed(2)} h x {formatMoney(stub.rate)}
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
            <p className="font-mono">{formatMoney(stub.holidayIndemnity)}</p>
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
            <strong className="tabular-nums">{formatMoney(stub.grossPay)}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">{t("federal")} </span>
            <strong className="tabular-nums">-{formatMoney(stub.deductionFederal)}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">{t("provincial")} </span>
            <strong className="tabular-nums">-{formatMoney(stub.deductionProvincial)}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">{t("rrq")} </span>
            <strong className="tabular-nums">-{formatMoney(stub.deductionRrq)}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">{t("ae")} </span>
            <strong className="tabular-nums">-{formatMoney(stub.deductionAe)}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">{t("rqap")} </span>
            <strong className="tabular-nums">-{formatMoney(stub.deductionRqap)}</strong>
          </div>
          <div className="md:col-span-2">
            <span className="text-muted-foreground">{t("total_deductions")} </span>
            <strong className="tabular-nums">-{formatMoney(totalDeductions)}</strong>
          </div>
        </div>
      </div>
    </Card>
  );
}

// =============================================================
// DIALOG : Create period
// =============================================================
function CreatePeriodDialog({
  open, onClose, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.payroll");
  const tc = useTranslations("common");
  const today = new Date();
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
  const [start, setStart] = useState(twoWeeksAgo.toISOString().slice(0, 10));
  const [end, setEnd] = useState(today.toISOString().slice(0, 10));
  const [pay, setPay] = useState(new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      const t = new Date();
      const ago = new Date(t.getTime() - 14 * 24 * 60 * 60 * 1000);
      setStart(ago.toISOString().slice(0, 10));
      setEnd(t.toISOString().slice(0, 10));
      setPay(new Date(t.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
      setPending(false);
    }
  }, [open]);

  const submit = async () => {
    setPending(true);
    const r = await createPayPeriodAction({ startDate: start, endDate: end, payDate: pay });
    setPending(false);
    if (r.success) { toast.success(t("periode_creee")); onSaved(); onClose(); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t("nouvelle_periode_paie")}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {t("definissez_bornes_periode_date_versement")}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-4">
          <FormSection icon={Calendar} title={t("periode")}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("debut")} required>
                <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9" />
              </Field>
              <Field label={t("fin")} required>
                <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9" />
              </Field>
            </div>
            <Field label={t("date_paie")} required hint={t("jour_versement_employes")}>
              <Input type="date" value={pay} onChange={(e) => setPay(e.target.value)} className="h-9" />
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
            {pending ? "..." : t("creer_periode")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
