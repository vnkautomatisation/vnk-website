"use client";
// =============================================================
// ContractsView - hub admin RH pour les contrats d'employes
//   - Onglets : Vue d'ensemble / Contrats / Templates (HR only)
//   - Header navy + KPIs + sticky compress-on-scroll
//   - Modals VNK (header navy + FormSection + DialogFooter sticky)
//   - PDF via PdfPreviewModal (jamais window.open direct)
//   - Tooltips via ActionTooltip (pas de title= natif)
//
// Logique metier preservee : createContractTemplate, sendContract,
// signContract (employee/employer), terminateContract.
// =============================================================
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { promptDialog } from "@/components/admin/prompt-dialog";
import {
  FileSignature,
  Plus,
  Send,
  CheckCircle2,
  AlertCircle,
  Ban,
  FileText,
  ChevronLeft,
  ChevronRight,
  Search,
  Sparkles,
  Layers,
  CalendarClock,
  Loader2,
  Eraser,
  Briefcase,
  Coins,
  Calendar as CalendarIcon,
  AlertTriangle,
  TrendingUp,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { SettingsTabs, type TabItem } from "@/components/admin/settings-tabs";
import { DocumentStatsCard } from "@/components/admin/document-stats-card";
import { PdfPreviewModal } from "@/components/admin/pdf-preview-modal";
import { ToneBadge } from "@/components/admin/tone-badge";
import { SignatureStatusBadge } from "@/components/admin/signature-status-badge";
import { SignaturePad } from "./signature-pad";
import {
  ContractWizard,
  type Employee as WizardEmployee,
  type ContractTemplate as WizardTemplate,
} from "@/components/admin/contract-wizard";
import { TemplateWizard } from "@/components/admin/template-wizard";
import { TemplatePdfPreviewButton } from "@/components/admin/template-pdf-preview-button";
import { PickEmployeeForPreviewDialog } from "@/components/admin/pick-employee-for-preview-dialog";
import {
  createContractTemplateAction,
  updateContractTemplateAction,
  deleteContractTemplateAction,
  createContractAction,
  sendContractAction,
  signContractAsEmployeeAction,
  signContractAsEmployerAction,
  terminateContractAction,
} from "@/app/actions/hr-contracts";
import {
  CONTRACT_TYPES,
  getContractTypeKey,
  normalizeContractType,
} from "@/lib/document-templates/contract-types";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
type TabKey = "overview" | "contracts" | "templates";
type EmpLite = {
  id: number;
  fullName: string | null;
  email: string;
  avatarUrl?: string | null;
  department?: string | null;
  position?: { name: string } | null;
  team?: { name: string } | null;
};
type PosLite = { id: number; name: string };
export type Template = {
  id: number;
  name: string;
  contractType: string;
  bodyMarkdown: string;
  defaultSalary: number | null;
  defaultRate: number | null;
  defaultHoursPerWeek: number | null;
  defaultVacationPct: number | null;
  probationDays: number | null;
  isActive: boolean;
  positionId: number | null;
  position: { id: number; name: string } | null;
  targetPositions?: string[];
  targetDepartments?: string[];
};
export type Contract = {
  id: number;
  title: string;
  contractType: string;
  status: string;
  startDate: string;
  endDate: string | null;
  probationEndDate: string | null;
  salaryAnnual: number | null;
  hourlyRate: number | null;
  hoursPerWeek: number | null;
  vacationPct: number | null;
  employeeSignedAt: string | null;
  employerSignedAt: string | null;
  terminatedAt: string | null;
  adminId: number;
  admin: { id: number; fullName: string | null; email: string; avatarUrl: string | null };
  template: { id: number; name: string } | null;
  employer: { fullName: string | null; email: string } | null;
};

const STATUS_TONE: Record<string, { labelKey: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  draft: { labelKey: "brouillon", tone: "neutral" },
  sent: { labelKey: "envoye", tone: "info" },
  signed_employee: { labelKey: "signe_employe", tone: "warning" },
  signed_employer: { labelKey: "signe_employeur", tone: "warning" },
  active: { labelKey: "actif", tone: "success" },
  terminated: { labelKey: "resilie", tone: "danger" },
  expired: { labelKey: "expire", tone: "neutral" },
};

// Conserve un fallback legacy ; pour les nouvelles valeurs, on délègue à
// getContractTypeLabel (terminologie QC + rétro-compat).
function typeLabel(value: string | null | undefined, autre: string, t: (k: string) => string): string {
  if (!value) return "-";
  if (value === "autre") return autre;
  const key = getContractTypeKey(value);
  return key ? t(key) : value;
}

function formatDate(iso: string | null | undefined, tag: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / 86400000);
}

function fmtMoney(v: number | null | undefined, tag: string): string | null {
  if (v == null) return null;
  return `${Number(v).toLocaleString(tag, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} $`;
}

// ================================================================
// MAIN VIEW
// ================================================================
export function ContractsView({
  contracts,
  templates,
  employees,
  positions,
  currentAdminId,
  isHr,
}: {
  contracts: Contract[];
  templates: Template[];
  employees: EmpLite[];
  positions: PosLite[];
  currentAdminId: number;
  isHr: boolean;
}) {
  const t = useTranslations("admin.contracts");
  const tc = useTranslations("common");
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>(isHr ? "overview" : "contracts");


  const [contractDialog, setContractDialog] = useState<{ open: boolean }>({ open: false });
  const [templateDialog, setTemplateDialog] = useState<{ open: boolean; existing: Template | null }>({
    open: false,
    existing: null,
  });
  const [signDialog, setSignDialog] = useState<{
    open: boolean;
    contract: Contract | null;
    as: "employee" | "employer";
  }>({ open: false, contract: null, as: "employee" });
  const [terminateDialog, setTerminateDialog] = useState<Contract | null>(null);
  const [confirmDelTpl, setConfirmDelTpl] = useState<Template | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{
    url: string;
    title: string;
    description?: string;
    filename?: string;
  } | null>(null);


  const [templatePreviewPicker, setTemplatePreviewPicker] = useState<Template | null>(null);
  const [templatePreviewCtx, setTemplatePreviewCtx] = useState<{
    template: Template;
    employeeId: number;
    nonce: number;
  } | null>(null);


  const templateById = useMemo(() => {
    const m = new Map<number, Template>();
    for (const t of templates) m.set(t.id, t);
    return m;
  }, [templates]);

  const openContractPdf = useCallback(
    (c: Contract) =>
      setPdfPreview({
        url: `/api/admin/contracts/${c.id}/pdf`,
        title: c.title,
        description: c.admin.fullName || c.admin.email,
        filename: `contrat-${c.id}.pdf`,
      }),
    [],
  );


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


  const kpis = useMemo(() => {
    const active = contracts.filter((c) => c.status === "active").length;
    const pendingSignature = contracts.filter(
      (c) => c.status === "sent" || c.status === "signed_employee" || c.status === "signed_employer",
    ).length;
    const expiringSoon = contracts.filter((c) => {
      if (!c.endDate) return false;
      const days = daysUntil(c.endDate);
      return days !== null && days >= 0 && days <= 30 && c.status === "active";
    }).length;
    const templatesActive = templates.filter((t) => t.isActive).length;
    return { active, pendingSignature, expiringSoon, templatesActive };
  }, [contracts, templates]);


  const TABS: TabItem<TabKey>[] = useMemo(() => {
    const items: TabItem<TabKey>[] = [];
    if (isHr) items.push({ key: "overview", label: t("vue_ensemble"), icon: Sparkles });
    items.push({
      key: "contracts",
      label: isHr ? t("contrats") : t("mes_contrats"),
      icon: FileSignature,
      count: contracts.length,
    });
    if (isHr) {
      items.push({
        key: "templates",
        label: t("templates"),
        icon: FileText,
        count: templates.length,
      });
    }
    return items;
  }, [isHr, contracts.length, templates.length]);


  const onSendContract = useCallback(
    async (c: Contract) => {
      const r = await sendContractAction({ id: c.id });
      if (r.success) {
        toast.success(t("contrat_envoye_employe"));
        router.refresh();
      } else toast.error(r.error || t("erreur"));
    },
    [router],
  );

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
              <FileSignature className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold">
                {isHr ? t("contrats_employes") : t("mes_contrats")}
              </h1>
              <p className="text-xs text-white/80">
                {isHr
                  ? t("templates_standardises_generation_double_signature")
                  : t("consultez_signez_electroniquement_contrats_emploi")}
              </p>
            </div>
          </div>
          {isHr && (
            <div className="flex items-center gap-2 flex-wrap">
              {tab === "templates" ? (
                <Button
                  size="sm"
                  onClick={() => setTemplateDialog({ open: true, existing: null })}
                  className="h-8 text-xs bg-white text-[#0F2D52] hover:bg-white/90 font-semibold"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  {t("nouveau_template")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setContractDialog({ open: true })}
                  className="h-8 text-xs bg-white text-[#0F2D52] hover:bg-white/90 font-semibold"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  {t("nouveau_contrat")}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>


      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <DocumentStatsCard
          label={t("contrats_actifs")}
          value={kpis.active}
          icon={CheckCircle2}
          accent="success"
          hint={t("contrats_au_total", { count: contracts.length })}
          onClick={() => setTab("contracts")}
        />
        <DocumentStatsCard
          label={t("attente_signature_2")}
          value={kpis.pendingSignature}
          icon={AlertCircle}
          accent={kpis.pendingSignature > 0 ? "warning" : "info"}
          hint={t("envoye_partiellement_signe")}
          onClick={() => setTab("contracts")}
        />
        <DocumentStatsCard
          label={t("echeance_30j")}
          value={kpis.expiringSoon}
          icon={CalendarClock}
          accent={kpis.expiringSoon > 0 ? "danger" : "info"}
          hint={t("contrats_actifs_arrivant_echeance")}
        />
        <DocumentStatsCard
          label={t("templates")}
          value={kpis.templatesActive}
          icon={FileText}
          accent="navy"
          hint={isHr ? t("disponibles_generation") : t("modeles_rh")}
          onClick={() => isHr && setTab("templates")}
        />
      </div>


      <div ref={sentinelRef} aria-hidden className="h-px" />


      {navExtraEl && scrolled
        ? createPortal(
            <div className="flex items-center gap-x-2 sm:gap-x-3 text-[11px] sm:text-xs whitespace-nowrap lg:hidden">
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">{t("act")}</span>
                  <span className="hidden min-[480px]:inline">{t("actifs")}</span>
                </span>
                <span className="font-semibold text-emerald-600">{kpis.active}</span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">{t("sig")}</span>
                  <span className="hidden min-[480px]:inline">{t("signer")}</span>
                </span>
                <span className={kpis.pendingSignature > 0 ? "font-semibold text-amber-600" : "font-semibold"}>
                  {kpis.pendingSignature}
                </span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">{t("ech")}</span>
                  <span className="hidden min-[480px]:inline">{t("echeance")}</span>
                </span>
                <span className={kpis.expiringSoon > 0 ? "font-semibold text-red-600" : "font-semibold"}>
                  {kpis.expiringSoon}
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
            <FileSignature className="h-4 w-4" />
            {t("contrats")}
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">{t("actifs")}</span>
            <span className="font-semibold text-emerald-600">{kpis.active}</span>
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">{t("signer")}</span>
            <span className={kpis.pendingSignature > 0 ? "font-semibold text-amber-600" : "font-semibold text-muted-foreground"}>
              {kpis.pendingSignature}
            </span>
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">{t("echeance_lt_30j")}</span>
            <span className={kpis.expiringSoon > 0 ? "font-semibold text-red-600" : "font-semibold text-muted-foreground"}>
              {kpis.expiringSoon}
            </span>
          </span>
          {isHr && (
            <Button
              size="sm"
              className="ml-auto h-7 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
              onClick={() => setContractDialog({ open: true })}
            >
              <Plus className="h-3 w-3 mr-1" />
              {t("nouveau")}
            </Button>
          )}
        </div>
        <div className="px-4 sm:px-5 lg:px-4">
          <SettingsTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel={t("navigation_contrats")} />
        </div>
      </div>


      {tab === "overview" && isHr && (
        <OverviewTab
          contracts={contracts}
          templates={templates}
          onGoContracts={() => setTab("contracts")}
          onGoTemplates={() => setTab("templates")}
          onNewContract={() => setContractDialog({ open: true })}
          onNewTemplate={() => setTemplateDialog({ open: true, existing: null })}
          onOpenPdf={openContractPdf}
        />
      )}

      {tab === "contracts" && (
        <ContractsTab
          contracts={contracts}
          currentAdminId={currentAdminId}
          isHr={isHr}
          onOpenPdf={openContractPdf}
          onSign={(c, as) => setSignDialog({ open: true, contract: c, as })}
          onTerminate={(c) => setTerminateDialog(c)}
          onSend={onSendContract}
          onNewContract={() => setContractDialog({ open: true })}
          templateById={templateById}
        />
      )}

      {tab === "templates" && isHr && (
        <TemplatesTab
          templates={templates}
          onCreate={() => setTemplateDialog({ open: true, existing: null })}
          onEdit={(t) => setTemplateDialog({ open: true, existing: t })}
          onDelete={(t) => setConfirmDelTpl(t)}
          onPreviewTemplate={(t) => setTemplatePreviewPicker(t)}
        />
      )}


      <ContractWizard
        open={contractDialog.open}
        onClose={() => setContractDialog({ open: false })}
        employees={employees.map<WizardEmployee>((e) => ({
          id: e.id,
          fullName: e.fullName,
          email: e.email,
          position: e.position?.name ?? null,
          department: e.department ?? null,
          team: e.team?.name ?? null,
          avatarUrl: e.avatarUrl ?? null,
        }))}
        templates={templates.map<WizardTemplate>((t) => ({
          id: t.id,
          name: t.name,
          bodyMarkdown: t.bodyMarkdown,
          targetPositions: t.position?.name ? [t.position.name] : [],
          targetDepartments: [],
          defaultSalary: t.defaultSalary,
          defaultHourlyRate: t.defaultRate,
          defaultHoursPerWeek: t.defaultHoursPerWeek,
          defaultVacationPct: t.defaultVacationPct,
          contractType: t.contractType,
        }))}
        onCreate={async (data) => {
          const r = await createContractAction({
            adminId: data.adminId,
            templateId: data.templateId,
            title: data.title,
            contractType: normalizeContractType(data.contractType),
            bodyMarkdown: data.bodyMarkdown,
            startDate: data.startDate,
            endDate: data.endDate ?? null,
            probationEndDate: data.probationEndDate ?? null,
            salaryAnnual: data.salaryAnnual ?? null,
            hourlyRate: data.hourlyRate ?? null,
            hoursPerWeek: data.hoursPerWeek ?? null,
            vacationPct: data.vacationPct ?? null,
          });
          if (!r.success) {
            toast.error(r.error || t("erreur"));
            throw new Error(r.error || t("erreur"));
          }
          if (data.sendForSignature && r.data?.id) {
            const sendRes = await sendContractAction({ id: r.data.id });
            if (sendRes.success) {
              toast.success(t("contrat_cree_envoye_signature"));
            } else {
              toast.success(t("contrat_cree_brouillon"));
              toast.error(sendRes.error || t("envoi_signature_impossible"));
            }
          } else {
            toast.success(t("contrat_cree_brouillon"));
          }
          router.refresh();
        }}
      />

      <TemplateWizard
        open={templateDialog.open}
        onClose={() => setTemplateDialog({ open: false, existing: null })}
        mode={templateDialog.existing ? "edit" : "create"}
        type="contract"
        initial={templateDialog.existing ? {
          title: templateDialog.existing.name,
          category: templateDialog.existing.contractType,
          version: "1.0",
          bodyMarkdown: templateDialog.existing.bodyMarkdown,
          targetPositions: templateDialog.existing.targetPositions ?? [],
          targetDepartments: templateDialog.existing.targetDepartments ?? [],
        } : undefined}
        onSave={async (data) => {
          const existing = templateDialog.existing;
          const contractType = normalizeContractType(data.category ?? "permanent_full_time");
          let r;
          if (existing) {
            r = await updateContractTemplateAction({
              id: existing.id,
              name: data.title,
              positionId: existing.positionId,
              contractType,
              bodyMarkdown: data.bodyMarkdown,
              defaultSalary: existing.defaultSalary,
              defaultRate: existing.defaultRate,
              defaultHoursPerWeek: existing.defaultHoursPerWeek,
              defaultVacationPct: existing.defaultVacationPct,
              probationDays: existing.probationDays,
              targetPositions: data.targetPositions,
              targetDepartments: data.targetDepartments,
            });
          } else {
            r = await createContractTemplateAction({
              name: data.title,
              positionId: null,
              contractType,
              bodyMarkdown: data.bodyMarkdown,
              defaultSalary: null,
              defaultRate: null,
              defaultHoursPerWeek: null,
              defaultVacationPct: null,
              probationDays: null,
              targetPositions: data.targetPositions,
              targetDepartments: data.targetDepartments,
            });
          }
          if (!r.success) throw new Error(r.error || t("erreur"));
          toast.success(existing ? t("template_modifie") : t("template_cree"));
          setTemplateDialog({ open: false, existing: null });
          router.refresh();
        }}
      />

      <SignDialog
        open={signDialog.open}
        contract={signDialog.contract}
        as={signDialog.as}
        onClose={() => setSignDialog({ open: false, contract: null, as: "employee" })}
        onSigned={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!terminateDialog}
        onOpenChange={(o) => !o && setTerminateDialog(null)}
        title={`Resilier ${terminateDialog?.title ?? ""} ?`}
        description={t("action_marquera_contrat_comme_termine")}
        confirmLabel={t("resilier")}
        variant="destructive"
        onConfirm={async () => {
          if (!terminateDialog) return;
          const reason = await promptDialog({
            title: t("motif_resiliation"),
            description: t("decrivez_precisement_raison_resiliation"),
            label: t("motif"),
            multiline: true,
            required: true,
            variant: "destructive",
            confirmLabel: t("resilier"),
          });
          if (!reason) {
            setTerminateDialog(null);
            return;
          }
          const r = await terminateContractAction({ id: terminateDialog.id, reason });
          if (r.success) {
            toast.success(t("contrat_resilie"));
            router.refresh();
          } else toast.error(r.error || "");
          setTerminateDialog(null);
        }}
      />

      <ConfirmDialog
        open={!!confirmDelTpl}
        onOpenChange={(o) => !o && setConfirmDelTpl(null)}
        title={`Supprimer ${confirmDelTpl?.name ?? ""} ?`}
        description={t("si_template_deja_utilise_il")}
        confirmLabel={tc("delete")}
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDelTpl) return;
          const r = await deleteContractTemplateAction({ id: confirmDelTpl.id });
          if (r.success) {
            toast.success(t("template_supprime"));
            router.refresh();
          } else toast.error(r.error || "");
          setConfirmDelTpl(null);
        }}
      />

      <PdfPreviewModal
        open={!!pdfPreview}
        url={pdfPreview?.url ?? null}
        title={pdfPreview?.title ?? ""}
        description={pdfPreview?.description}
        downloadFilename={pdfPreview?.filename}
        onClose={() => setPdfPreview(null)}
      />


      <PickEmployeeForPreviewDialog
        open={!!templatePreviewPicker}
        onClose={() => setTemplatePreviewPicker(null)}
        onPick={(employeeId) => {
          if (!templatePreviewPicker) return;
          setTemplatePreviewCtx({
            template: templatePreviewPicker,
            employeeId,
            nonce: Date.now(),
          });
        }}
        employees={employees.map((e) => ({
          id: e.id,
          fullName: e.fullName,
          position: e.position?.name ?? null,
          avatarUrl: e.avatarUrl ?? null,
        }))}
        title={t("choisir_employe_apercu_template")}
        description={t("selectionnez_employe_voir_contrat_genere")}
      />


      {templatePreviewCtx && (
        <TemplatePreviewAutoTrigger
          key={templatePreviewCtx.nonce}
          template={templatePreviewCtx.template}
          employeeId={templatePreviewCtx.employeeId}
          onDone={() => setTemplatePreviewCtx(null)}
        />
      )}
    </div>
  );
}

// =============================================================
// Helper : declenche programmatiquement TemplatePdfPreviewButton
// (clic auto sur le trigger interne au montage).
// =============================================================
function TemplatePreviewAutoTrigger({
  template,
  employeeId,
  onDone,
}: {
  template: Template;
  employeeId: number;
  onDone: () => void;
}) {
  const t = useTranslations("admin.contracts");
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {

    const timer = window.setTimeout(() => {
      triggerRef.current?.click();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="sr-only" aria-hidden>
      <TemplatePdfPreviewButton
        bodyMarkdown={template.bodyMarkdown}
        title={template.name}
        documentType="contract"
        employeeId={employeeId}
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
// TAB : OVERVIEW (HR only)
// ================================================================
function OverviewTab({
  contracts,
  templates,
  onGoContracts,
  onGoTemplates,
  onNewContract,
  onNewTemplate,
  onOpenPdf,
}: {
  contracts: Contract[];
  templates: Template[];
  onGoContracts: () => void;
  onGoTemplates: () => void;
  onNewContract: () => void;
  onNewTemplate: () => void;
  onOpenPdf: (c: Contract) => void;
}) {
  const t = useTranslations("admin.contracts");
  const dateTag = useDateLocale();
  const pendingContracts = useMemo(
    () =>
      contracts
        .filter(
          (c) =>
            c.status === "sent" ||
            c.status === "signed_employee" ||
            c.status === "signed_employer",
        )
        .slice(0, 5),
    [contracts],
  );

  const expiringContracts = useMemo(() => {
    const list = contracts.filter((c) => {
      if (!c.endDate || c.status !== "active") return false;
      const days = daysUntil(c.endDate);
      return days !== null && days <= 60;
    });
    return list
      .sort((a, b) => {
        const da = daysUntil(a.endDate) ?? 0;
        const db = daysUntil(b.endDate) ?? 0;
        return da - db;
      })
      .slice(0, 5);
  }, [contracts]);

  const typeDistribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of contracts.filter((x) => x.status === "active")) {
      map.set(c.contractType, (map.get(c.contractType) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [contracts]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[#0F2D52]" />
            {t("attente_signature")}
          </h3>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onGoContracts}>
            {t("voir_tout")}
          </Button>
        </div>
        {pendingContracts.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            {t("aucun_contrat_attente")}
          </p>
        ) : (
          <div className="space-y-1.5">
            {pendingContracts.map((c) => {
              const status = STATUS_TONE[c.status];
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onOpenPdf(c)}
                  className="w-full flex items-center justify-between gap-2 text-xs p-2 rounded-md hover:bg-muted/40 transition text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium truncate">{c.title}</span>
                    <span className="block text-[10px] text-muted-foreground truncate">
                      {c.admin.fullName ?? c.admin.email}
                    </span>
                  </span>
                  <ToneBadge tone={status?.tone ?? "neutral"}>{status ? t(status.labelKey) : c.status}</ToneBadge>
                </button>
              );
            })}
          </div>
        )}
        <Button
          size="sm"
          className="w-full h-8 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          onClick={onNewContract}
        >
          <Plus className="h-3 w-3 mr-1" />
          {t("nouveau_contrat")}
        </Button>
      </Card>


      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[#0F2D52]" />
            {t("echeances_prochaines")}
          </h3>
        </div>
        {expiringContracts.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            {t("aucun_contrat_echeance_60j")}
          </p>
        ) : (
          <div className="space-y-1.5">
            {expiringContracts.map((c) => {
              const days = daysUntil(c.endDate);
              const urgent = days !== null && days <= 14;
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 text-xs p-2 rounded-md bg-muted/20"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium truncate">{c.title}</span>
                    <span className="block text-[10px] text-muted-foreground truncate">
                      {c.admin.fullName ?? c.admin.email} - fin {formatDate(c.endDate, dateTag)}
                    </span>
                  </span>
                  <ToneBadge tone={urgent ? "danger" : "warning"}>
                    J-{days}
                  </ToneBadge>
                </div>
              );
            })}
          </div>
        )}
      </Card>


      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#0F2D52]" />
            {t("templates")}
          </h3>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onGoTemplates}>
            {t("gerer")}
          </Button>
        </div>
        <div className="rounded-md border bg-muted/20 p-3 space-y-2">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">{t("disponibles")}</span>
            <span className="font-semibold">{templates.filter((t) => t.isActive).length}</span>
          </div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">{t("lies_poste")}</span>
            <span className="font-semibold">
              {templates.filter((t) => t.positionId !== null).length}
            </span>
          </div>
        </div>
        {typeDistribution.length > 0 && (
          <div className="pt-2 border-t space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              {t("repartition_contrats_actifs")}
            </p>
            {typeDistribution.map(([type, count]) => (
              <div key={type} className="flex items-center justify-between text-xs gap-2">
                <span className="truncate flex-1">{typeLabel(type, t("autre"), t)}</span>
                <Badge variant="outline" className="text-[10px]">
                  {count}
                </Badge>
              </div>
            ))}
          </div>
        )}
        <Button
          size="sm"
          variant="outline"
          className="w-full h-8 text-xs border-[#0F2D52]/30 text-[#0F2D52]"
          onClick={onNewTemplate}
        >
          <Plus className="h-3 w-3 mr-1" />
          {t("nouveau_template")}
        </Button>
      </Card>
    </div>
  );
}

// ================================================================
// TAB : CONTRACTS
// ================================================================
function ContractsTab({
  contracts,
  currentAdminId,
  isHr,
  onOpenPdf,
  onSign,
  onTerminate,
  onSend,
  onNewContract,
  templateById,
}: {
  contracts: Contract[];
  currentAdminId: number;
  isHr: boolean;
  onOpenPdf: (c: Contract) => void;
  onSign: (c: Contract, as: "employee" | "employer") => void;
  onTerminate: (c: Contract) => void;
  onSend: (c: Contract) => void;
  onNewContract: () => void;
  templateById: Map<number, Template>;
}) {
  const t = useTranslations("admin.contracts");
  const tc = useTranslations("common");

  const myContracts = useMemo(
    () => contracts.filter((c) => c.adminId === currentAdminId),
    [contracts, currentAdminId],
  );
  const othersContracts = useMemo(
    () => contracts.filter((c) => c.adminId !== currentAdminId),
    [contracts, currentAdminId],
  );


  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  const contractTypes = useMemo(() => {
    const s = new Set<string>();
    othersContracts.forEach((c) => s.add(c.contractType));
    return Array.from(s).sort();
  }, [othersContracts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return othersContracts.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (typeFilter !== "all" && c.contractType !== typeFilter) return false;
      if (q) {
        const name = (c.admin.fullName || c.admin.email).toLowerCase();
        const title = c.title.toLowerCase();
        if (!name.includes(q) && !title.includes(q)) return false;
      }
      return true;
    });
  }, [othersContracts, search, statusFilter, typeFilter]);

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (contracts.length === 0) {
    return (
      <Card className="p-10 text-center space-y-3">
        <FileSignature className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          {isHr
            ? t("aucun_contrat_cree_commencez_template")
            : t("aucun_contrat_emis_compte")}
        </p>
        {isHr && (
          <Button
            size="sm"
            onClick={onNewContract}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {t("nouveau_contrat")}
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">

      {myContracts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-bold text-[#0F2D52] uppercase tracking-wider flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />
            {t("mes_contrats")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myContracts.map((c) => (
              <ContractRichCard
                key={c.id}
                contract={c}
                mine
                isHr={isHr}
                onOpenPdf={() => onOpenPdf(c)}
                onSign={(as) => onSign(c, as)}
                onTerminate={() => onTerminate(c)}
                onSend={() => onSend(c)}
                template={c.template ? templateById.get(c.template.id) ?? null : null}
              />
            ))}
          </div>
        </section>
      )}


      {isHr && othersContracts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[11px] font-bold text-[#0F2D52] uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Tous les employes ({othersContracts.length})
          </h2>


          <Card className="p-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("rechercher_employe_titre")}
                  className="h-9 text-sm pl-7"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={tc("status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("tous_statuts")}</SelectItem>
                  {Object.entries(STATUS_TONE).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {t(v.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={t("type")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("tous_types")}</SelectItem>
                  {contractTypes.map((ct) => (
                    <SelectItem key={ct} value={ct}>
                      {typeLabel(ct, t("autre"), t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {filtered.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              {t("aucun_resultat_filtres")}
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pageItems.map((c) => (
                  <ContractRichCard
                    key={c.id}
                    contract={c}
                    mine={false}
                    isHr={isHr}
                    onOpenPdf={() => onOpenPdf(c)}
                    onSign={(as) => onSign(c, as)}
                    onTerminate={() => onTerminate(c)}
                    onSend={() => onSend(c)}
                    template={c.template ? templateById.get(c.template.id) ?? null : null}
                  />
                ))}
              </div>

              {filtered.length > PAGE_SIZE && (
                <div className="flex items-center justify-between text-xs px-2">
                  <span className="text-muted-foreground">
                    Page {page + 1} / {totalPages} - {filtered.length} contrat
                    {filtered.length > 1 ? "s" : ""}
                  </span>
                  <div className="flex items-center gap-1">
                    <ActionTooltip label={t("page_precedente")}>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0}
                        aria-label={t("page_precedente")}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                    </ActionTooltip>
                    <ActionTooltip label={t("page_suivante")}>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        aria-label={t("page_suivante")}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </ActionTooltip>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

// ================================================================
// CARD : Contract (riche)
// ================================================================
function ContractRichCard({
  contract,
  mine,
  isHr,
  onOpenPdf,
  onSign,
  onTerminate,
  onSend,
  template,
}: {
  contract: Contract;
  mine: boolean;
  isHr: boolean;
  onOpenPdf: () => void;
  onSign: (as: "employee" | "employer") => void;
  onTerminate: () => void;
  onSend: () => void;

  template: Template | null;
}) {
  const t = useTranslations("admin.contracts");
  const tc = useTranslations("common");
  const dateTag = useDateLocale();
  const c = contract;
  const status = STATUS_TONE[c.status];
  const canSignEmployee = mine && c.status === "sent" && !c.employeeSignedAt;
  const canSignEmployer = isHr && c.employeeSignedAt && !c.employerSignedAt && c.status !== "terminated";
  const canSend = isHr && c.status === "draft";
  const canTerminate =
    isHr && (c.status === "active" || c.status === "signed_employer" || c.status === "signed_employee");
  const canDownloadPdf = c.status === "active" || (!!c.employeeSignedAt && !!c.employerSignedAt);

  const endingSoon = c.endDate ? (() => {
    const d = daysUntil(c.endDate);
    return d !== null && d >= 0 && d <= 30 && c.status === "active";
  })() : false;

  return (
    <Card className="vnk-card-hover overflow-hidden">
      <div className="p-4 space-y-3">

        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-[#0F2D52]/8 ring-1 ring-[#0F2D52]/15 flex items-center justify-center shrink-0">
            <FileSignature className="h-5 w-5 text-[#0F2D52]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{c.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {c.admin.fullName || c.admin.email}
            </p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              <ToneBadge tone={status?.tone ?? "neutral"}>{status ? t(status.labelKey) : c.status}</ToneBadge>
              <ToneBadge tone="info">{typeLabel(c.contractType, t("autre"), t)}</ToneBadge>
              {endingSoon && (
                <ToneBadge tone="danger" icon={AlertTriangle}>
                  Fin {formatDate(c.endDate, dateTag)}
                </ToneBadge>
              )}
            </div>
          </div>
        </div>


        <div className="grid grid-cols-2 gap-2 text-xs border-t pt-2">
          <InfoRow icon={CalendarIcon} label={t("debut")} value={formatDate(c.startDate, dateTag)} />
          {c.endDate && <InfoRow icon={CalendarIcon} label={t("fin")} value={formatDate(c.endDate, dateTag)} />}
          {c.salaryAnnual != null && (
            <InfoRow icon={Coins} label={t("salaire_an")} value={fmtMoney(c.salaryAnnual, dateTag) ?? "-"} />
          )}
          {c.hourlyRate != null && (
            <InfoRow icon={Coins} label={t("taux_h")} value={`${Number(c.hourlyRate).toFixed(2)} $`} />
          )}
          {c.hoursPerWeek != null && (
            <InfoRow icon={TrendingUp} label={t("heures_sem")} value={`${c.hoursPerWeek} h`} />
          )}
          {c.vacationPct != null && (
            <InfoRow icon={TrendingUp} label={t("vacances")} value={`${c.vacationPct} %`} />
          )}
        </div>


        <div className="flex flex-wrap gap-1.5 text-[10px]">
          <SignatureStatusBadge
            employeeSignedAt={c.employeeSignedAt}
            employerSignedAt={c.employerSignedAt}
            terminatedAt={c.terminatedAt}
            variant="full"
          />
        </div>


        <div className="flex flex-wrap gap-1.5 pt-1 border-t -mb-1">
          {canSend && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onSend}>
              <Send className="h-3 w-3 mr-1" />
              {tc("send")}
            </Button>
          )}
          {canSignEmployee && (
            <Button
              size="sm"
              className="h-7 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
              onClick={() => onSign("employee")}
            >
              <FileSignature className="h-3 w-3 mr-1" />
              {t("signer_2")}
            </Button>
          )}
          {canSignEmployer && (
            <Button
              size="sm"
              className="h-7 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
              onClick={() => onSign("employer")}
            >
              <FileSignature className="h-3 w-3 mr-1" />
              {t("contresigner")}
            </Button>
          )}
          {canDownloadPdf && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onOpenPdf}>
              <FileText className="h-3 w-3 mr-1" />
              {t("apercu_pdf")}
            </Button>
          )}
          {/* Brouillon ou en cours de signature : pas de PDF final stocke,
              on offre un apercu base sur le template + employe */}
          {!canDownloadPdf && template && (
            <TemplatePdfPreviewButton
              bodyMarkdown={template.bodyMarkdown}
              title={c.title}
              documentType="contract"
              employeeId={c.adminId}
              contractId={c.id}
              onError={(err) => toast.error(err.message || t("apercu_indisponible"))}
              trigger={
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  {t("apercu_pdf")}
                </Button>
              }
            />
          )}
          {canTerminate && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs hover:text-destructive ml-auto"
              onClick={onTerminate}
            >
              <Ban className="h-3 w-3 mr-1" />
              {t("resilier")}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground shrink-0">{label} :</span>
      <span className="font-medium truncate">{value}</span>
    </div>
  );
}

// ================================================================
// TAB : TEMPLATES
// ================================================================
function TemplatesTab({
  templates,
  onCreate,
  onEdit,
  onDelete,
  onPreviewTemplate,
}: {
  templates: Template[];
  onCreate: () => void;
  onEdit: (t: Template) => void;
  onDelete: (t: Template) => void;
  onPreviewTemplate: (t: Template) => void;
}) {
  const t = useTranslations("admin.contracts");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (typeFilter !== "all" && t.contractType !== typeFilter) return false;
      if (q && !`${t.name} ${t.position?.name ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [templates, search, typeFilter]);

  if (templates.length === 0) {
    return (
      <Card className="p-10 text-center space-y-3">
        <FileText className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          {t("aucun_template_creez_standardiser_contrats")}
        </p>
        <Button size="sm" onClick={onCreate} className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {t("nouveau_template")}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("rechercher_template")}
            className="h-9 text-sm pl-7"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 text-sm sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("tous_types")}</SelectItem>
            {CONTRACT_TYPES.map((ct) => (
              <SelectItem key={ct.value} value={ct.value}>
                {t(ct.labelKey)}
              </SelectItem>
            ))}
            <SelectItem value="autre">{t("autre")}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={onCreate}
          className="h-9 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {t("nouveau")}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          {t("aucun_template_trouve")}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((t) => (
            <TemplateCard
              key={t.id}
              t={t}
              onEdit={() => onEdit(t)}
              onDelete={() => onDelete(t)}
              onPreview={() => onPreviewTemplate(t)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  t: tpl,
  onEdit,
  onDelete,
  onPreview,
}: {
  t: Template;
  onEdit: () => void;
  onDelete: () => void;
  onPreview: () => void;
}) {
  const t = useTranslations("admin.contracts");
  const tc = useTranslations("common");
  const dateTag = useDateLocale();
  const meta: string[] = [];
  if (tpl.defaultSalary != null) meta.push(`${Number(tpl.defaultSalary).toLocaleString(dateTag)} $/an`);
  if (tpl.defaultRate != null) meta.push(`${Number(tpl.defaultRate).toFixed(2)} $/h`);
  if (tpl.defaultHoursPerWeek != null) meta.push(`${tpl.defaultHoursPerWeek} h/sem`);
  if (tpl.defaultVacationPct != null) meta.push(`${tpl.defaultVacationPct}% vac.`);
  if (tpl.probationDays != null) meta.push(`${tpl.probationDays}j probation`);

  return (
    <Card className="vnk-card-hover overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-[#0F2D52]/8 ring-1 ring-[#0F2D52]/15 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-[#0F2D52]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{tpl.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {typeLabel(tpl.contractType, t("autre"), t)}
              {tpl.position ? ` - ${tpl.position.name}` : ""}
            </p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              <ToneBadge tone={tpl.isActive ? "success" : "neutral"}>
                {tpl.isActive ? t("actif") : t("desactive")}
              </ToneBadge>
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <ActionTooltip label={t("apercu_pdf")}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onPreview}
                aria-label={t("apercu_pdf")}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </ActionTooltip>
            <ActionTooltip label={tc("edit")}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onEdit}
                aria-label={tc("edit")}
              >
                <FileText className="h-4 w-4" />
              </Button>
            </ActionTooltip>
            <ActionTooltip label={tc("delete")}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:text-destructive"
                onClick={onDelete}
                aria-label={tc("delete")}
              >
                <Ban className="h-4 w-4" />
              </Button>
            </ActionTooltip>
          </div>
        </div>
        {meta.length > 0 && (
          <div className="border-t pt-2 flex flex-wrap gap-1.5">
            {meta.map((m) => (
              <span
                key={m}
                className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground"
              >
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// ================================================================
// DIALOG : Sign (employee or employer)
// ================================================================
function SignDialog({
  open,
  contract,
  as,
  onClose,
  onSigned,
}: {
  open: boolean;
  contract: Contract | null;
  as: "employee" | "employer";
  onClose: () => void;
  onSigned: () => void;
}) {
  const t = useTranslations("admin.contracts");
  const tc = useTranslations("common");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);

  const [padKey, setPadKey] = useState(0);
  const dateTag = useDateLocale();

  useEffect(() => {
    if (open) {
      setSignatureData(null);
      setAcknowledged(false);
      setPending(false);
      setPadKey((k) => k + 1);
    }
  }, [open, contract?.id]);

  if (!contract) return null;

  const canSubmit = !!signatureData && acknowledged && !pending;

  const submit = async () => {
    if (!signatureData) {
      toast.error(t("signez_avant_soumettre"));
      return;
    }
    setPending(true);
    const r =
      as === "employee"
        ? await signContractAsEmployeeAction({ id: contract.id, signatureData })
        : await signContractAsEmployerAction({ id: contract.id, signatureData });
    setPending(false);
    if (r.success) {
      toast.success(as === "employee" ? t("signe") : t("contresigne_contrat_actif"));
      onSigned();
      onClose();
    } else toast.error(r.error || t("erreur"));
  };

  const clear = () => {
    setSignatureData(null);
    setPadKey((k) => k + 1);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="p-0 overflow-hidden flex flex-col w-screen h-[100dvh] max-w-none max-h-none rounded-none sm:w-[95vw] sm:max-w-xl sm:h-auto sm:max-h-[92vh] sm:rounded-lg">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-white text-sm sm:text-base flex items-center gap-2">
              <FileSignature className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {as === "employee" ? t("signer_mon_contrat") : t("contresigner_employeur")}
              </span>
            </DialogTitle>
            <DialogDescription className="text-white/80 text-[11px] sm:text-xs truncate">
              {contract.title} -{" "}
              {as === "employee"
                ? t("signature_confirme_engagement")
                : t("validation_finale_employeur")}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1">
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
              {t("resume_contrat")}
            </p>
            <p className="text-sm font-semibold">{contract.title}</p>
            <p className="text-xs text-muted-foreground">
              {contract.admin.fullName || contract.admin.email} -{" "}
              {typeLabel(contract.contractType, t("autre"), t)}
            </p>
            <p className="text-xs text-muted-foreground">
              Debut : {formatDate(contract.startDate, dateTag)}
              {contract.endDate ? ` - Fin : ${formatDate(contract.endDate, dateTag)}` : ""}
            </p>
          </div>

          <label className="flex items-start gap-2 text-xs cursor-pointer p-3 rounded-md border bg-muted/10 hover:bg-muted/20 transition">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="h-4 w-4 mt-0.5 rounded border-input shrink-0 accent-[#0F2D52]"
            />
            <span>
              {as === "employee"
                ? t("j_ai_lu_integralite_contrat")
                : t("j_atteste_avoir_verifie_contrat")}
            </span>
          </label>

          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              {t("signature")}
            </p>
            <SignaturePad key={padKey} onChange={setSignatureData} />
          </div>

          <p className="text-[10px] text-muted-foreground">{t("contracts_view_en_signant_vous_certifiez_avoir_lu_et")}</p>
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0 gap-2 flex-wrap [&>button]:flex-1 sm:[&>button]:flex-initial">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            disabled={pending || !signatureData}
          >
            <Eraser className="h-3.5 w-3.5 mr-1.5" />
            {t("effacer")}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {tc("cancel")}
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <FileSignature className="h-3.5 w-3.5 mr-1.5" />
            )}
            Confirmer ma signature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
