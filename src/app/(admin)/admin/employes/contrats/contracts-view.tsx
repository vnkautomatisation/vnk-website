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
  getContractTypeLabel,
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

const STATUS_TONE: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  draft: { label: "Brouillon", tone: "neutral" },
  sent: { label: "Envoye", tone: "info" },
  signed_employee: { label: "Signe employe", tone: "warning" },
  signed_employer: { label: "Signe employeur", tone: "warning" },
  active: { label: "Actif", tone: "success" },
  terminated: { label: "Resilie", tone: "danger" },
  expired: { label: "Expire", tone: "neutral" },
};

// Conserve un fallback legacy ; pour les nouvelles valeurs, on délègue à
// getContractTypeLabel (terminologie QC + rétro-compat).
function typeLabel(value: string | null | undefined): string {
  if (!value) return "-";
  if (value === "autre") return "Autre";
  return getContractTypeLabel(value) || value;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / 86400000);
}

function fmtMoney(v: number | null | undefined): string | null {
  if (v == null) return null;
  return `${Number(v).toLocaleString("fr-CA", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} $`;
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
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>(isHr ? "overview" : "contracts");

  // --- Modals state ----------------------------------------------
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
  // Apercu PDF template standalone : on choisit d'abord l'employe test,
  // puis on rend le PDF via TemplatePdfPreviewButton (declenche programmaticly).
  const [templatePreviewPicker, setTemplatePreviewPicker] = useState<Template | null>(null);
  const [templatePreviewCtx, setTemplatePreviewCtx] = useState<{
    template: Template;
    employeeId: number;
    nonce: number;
  } | null>(null);

  // Map id->template pour relooker depuis les contrats
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

  // --- Sticky bar pattern STANDARD (ref my-documents-view.tsx) ----
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

  // Portal target KPIs dans module-nav mobile
  const [navExtraEl, setNavExtraEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setNavExtraEl(document.getElementById("vnk-module-nav-extra"));
  }, []);

  // --- KPI computations ------------------------------------------
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

  // --- Tabs --------------------------------------------------------
  const TABS: TabItem<TabKey>[] = useMemo(() => {
    const items: TabItem<TabKey>[] = [];
    if (isHr) items.push({ key: "overview", label: "Vue d'ensemble", icon: Sparkles });
    items.push({
      key: "contracts",
      label: isHr ? "Contrats" : "Mes contrats",
      icon: FileSignature,
      count: contracts.length,
    });
    if (isHr) {
      items.push({
        key: "templates",
        label: "Templates",
        icon: FileText,
        count: templates.length,
      });
    }
    return items;
  }, [isHr, contracts.length, templates.length]);

  // --- Send / Sign / Terminate handlers (commun aux tabs) --------
  const onSendContract = useCallback(
    async (c: Contract) => {
      const r = await sendContractAction({ id: c.id });
      if (r.success) {
        toast.success("Contrat envoye a l'employe");
        router.refresh();
      } else toast.error(r.error || "Erreur");
    },
    [router],
  );

  return (
    <div className="space-y-4">
      {/* ====== Header navy gradient ====== */}
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
                {isHr ? "Contrats d'employes" : "Mes contrats"}
              </h1>
              <p className="text-xs text-white/80">
                {isHr
                  ? "Templates standardises, generation et double signature des contrats."
                  : "Consultez et signez electroniquement vos contrats d'emploi."}
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
                  Nouveau template
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setContractDialog({ open: true })}
                  className="h-8 text-xs bg-white text-[#0F2D52] hover:bg-white/90 font-semibold"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Nouveau contrat
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ====== KPIs ====== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <DocumentStatsCard
          label="Contrats actifs"
          value={kpis.active}
          icon={CheckCircle2}
          accent="success"
          hint={`${contracts.length} contrat${contracts.length > 1 ? "s" : ""} au total`}
          onClick={() => setTab("contracts")}
        />
        <DocumentStatsCard
          label="En attente signature"
          value={kpis.pendingSignature}
          icon={AlertCircle}
          accent={kpis.pendingSignature > 0 ? "warning" : "info"}
          hint="Envoye ou partiellement signe"
          onClick={() => setTab("contracts")}
        />
        <DocumentStatsCard
          label="Echeance < 30j"
          value={kpis.expiringSoon}
          icon={CalendarClock}
          accent={kpis.expiringSoon > 0 ? "danger" : "info"}
          hint="Contrats actifs arrivant a echeance"
        />
        <DocumentStatsCard
          label="Templates"
          value={kpis.templatesActive}
          icon={FileText}
          accent="navy"
          hint={isHr ? "Disponibles pour generation" : "Modeles RH"}
          onClick={() => isHr && setTab("templates")}
        />
      </div>

      {/* Sentinel */}
      <div ref={sentinelRef} aria-hidden className="h-px" />

      {/* Portal KPIs vers module-nav mobile */}
      {navExtraEl && scrolled
        ? createPortal(
            <div className="flex items-center gap-x-2 sm:gap-x-3 text-[11px] sm:text-xs whitespace-nowrap lg:hidden">
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">Act :</span>
                  <span className="hidden min-[480px]:inline">Actifs :</span>
                </span>
                <span className="font-semibold text-emerald-600">{kpis.active}</span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">À sig :</span>
                  <span className="hidden min-[480px]:inline">A signer :</span>
                </span>
                <span className={kpis.pendingSignature > 0 ? "font-semibold text-amber-600" : "font-semibold"}>
                  {kpis.pendingSignature}
                </span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">Éch :</span>
                  <span className="hidden min-[480px]:inline">Echeance :</span>
                </span>
                <span className={kpis.expiringSoon > 0 ? "font-semibold text-red-600" : "font-semibold"}>
                  {kpis.expiringSoon}
                </span>
              </span>
            </div>,
            navExtraEl,
          )
        : null}

      {/* Sticky container : mini-bar desktop + tabs (toujours) */}
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
            Contrats
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">Actifs :</span>
            <span className="font-semibold text-emerald-600">{kpis.active}</span>
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">A signer :</span>
            <span className={kpis.pendingSignature > 0 ? "font-semibold text-amber-600" : "font-semibold text-muted-foreground"}>
              {kpis.pendingSignature}
            </span>
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">Echeance &lt; 30j :</span>
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
              Nouveau
            </Button>
          )}
        </div>
        <div className="px-4 sm:px-5 lg:px-4">
          <SettingsTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel="Navigation contrats" />
        </div>
      </div>

      {/* ====== Tab content ====== */}
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

      {/* ============== Modals ============== */}
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
            toast.error(r.error || "Erreur");
            throw new Error(r.error || "Erreur");
          }
          if (data.sendForSignature && r.data?.id) {
            const sendRes = await sendContractAction({ id: r.data.id });
            if (sendRes.success) {
              toast.success("Contrat cree et envoye pour signature");
            } else {
              toast.success("Contrat cree en brouillon");
              toast.error(sendRes.error || "Envoi pour signature impossible");
            }
          } else {
            toast.success("Contrat cree en brouillon");
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
          if (!r.success) throw new Error(r.error || "Erreur");
          toast.success(existing ? "Template modifie" : "Template cree");
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
        description="Cette action marquera le contrat comme termine. Conserve pour l'historique legal."
        confirmLabel="Resilier"
        variant="destructive"
        onConfirm={async () => {
          if (!terminateDialog) return;
          const reason = await promptDialog({
            title: "Motif de resiliation",
            description: "Decrivez precisement la raison de la resiliation (conserve pour l'historique legal).",
            label: "Motif *",
            multiline: true,
            required: true,
            variant: "destructive",
            confirmLabel: "Resilier",
          });
          if (!reason) {
            setTerminateDialog(null);
            return;
          }
          const r = await terminateContractAction({ id: terminateDialog.id, reason });
          if (r.success) {
            toast.success("Contrat resilie");
            router.refresh();
          } else toast.error(r.error || "");
          setTerminateDialog(null);
        }}
      />

      <ConfirmDialog
        open={!!confirmDelTpl}
        onOpenChange={(o) => !o && setConfirmDelTpl(null)}
        title={`Supprimer ${confirmDelTpl?.name ?? ""} ?`}
        description="Si le template est deja utilise, il sera desactive au lieu d'etre supprime."
        confirmLabel="Supprimer"
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDelTpl) return;
          const r = await deleteContractTemplateAction({ id: confirmDelTpl.id });
          if (r.success) {
            toast.success("Template supprime");
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

      {/* Dialog : choisir un employe test pour l'apercu PDF d'un template */}
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
        title="Choisir un employe pour l'apercu du template"
        description="Selectionnez un employe pour voir le contrat genere avec ses informations (poste, salaire, dates...)."
      />

      {/* Auto-trigger TemplatePdfPreviewButton apres choix employe */}
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // Au prochain frame, clic sur le bouton pour declencher l'apercu PDF
    const t = window.setTimeout(() => {
      triggerRef.current?.click();
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="sr-only" aria-hidden>
      <TemplatePdfPreviewButton
        bodyMarkdown={template.bodyMarkdown}
        title={template.name}
        documentType="contract"
        employeeId={employeeId}
        onError={(err) => {
          toast.error(err.message || "Apercu indisponible");
          onDone();
        }}
        trigger={<button ref={triggerRef} type="button">Apercu</button>}
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
      {/* En attente signature */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[#0F2D52]" />
            En attente de signature
          </h3>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onGoContracts}>
            Voir tout
          </Button>
        </div>
        {pendingContracts.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Aucun contrat en attente.
          </p>
        ) : (
          <div className="space-y-1.5">
            {pendingContracts.map((c) => {
              const status = STATUS_TONE[c.status] ?? { label: c.status, tone: "neutral" as const };
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
                  <ToneBadge tone={status.tone}>{status.label}</ToneBadge>
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
          Nouveau contrat
        </Button>
      </Card>

      {/* Echeances proches */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[#0F2D52]" />
            Echeances prochaines
          </h3>
        </div>
        {expiringContracts.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Aucun contrat n'arrive a echeance dans les 60 jours.
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
                      {c.admin.fullName ?? c.admin.email} - fin {formatDate(c.endDate)}
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

      {/* Templates + repartition */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#0F2D52]" />
            Templates
          </h3>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onGoTemplates}>
            Gerer
          </Button>
        </div>
        <div className="rounded-md border bg-muted/20 p-3 space-y-2">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Disponibles</span>
            <span className="font-semibold">{templates.filter((t) => t.isActive).length}</span>
          </div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Lies a un poste</span>
            <span className="font-semibold">
              {templates.filter((t) => t.positionId !== null).length}
            </span>
          </div>
        </div>
        {typeDistribution.length > 0 && (
          <div className="pt-2 border-t space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              Repartition (contrats actifs)
            </p>
            {typeDistribution.map(([type, count]) => (
              <div key={type} className="flex items-center justify-between text-xs gap-2">
                <span className="truncate flex-1">{typeLabel(type)}</span>
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
          Nouveau template
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
  // Mes contrats vs ceux des autres
  const myContracts = useMemo(
    () => contracts.filter((c) => c.adminId === currentAdminId),
    [contracts, currentAdminId],
  );
  const othersContracts = useMemo(
    () => contracts.filter((c) => c.adminId !== currentAdminId),
    [contracts, currentAdminId],
  );

  // Filtres pour "Tous les employes"
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
            ? "Aucun contrat cree. Commencez par un template puis generez un contrat pour un employe."
            : "Aucun contrat emis pour votre compte."}
        </p>
        {isHr && (
          <Button
            size="sm"
            onClick={onNewContract}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Nouveau contrat
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mes contrats */}
      {myContracts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-bold text-[#0F2D52] uppercase tracking-wider flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />
            Mes contrats
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

      {/* Autres employes (HR only) */}
      {isHr && othersContracts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[11px] font-bold text-[#0F2D52] uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Tous les employes ({othersContracts.length})
          </h2>

          {/* Filtres */}
          <Card className="p-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher employe ou titre..."
                  className="h-9 text-sm pl-7"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {Object.entries(STATUS_TONE).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {contractTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {typeLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {filtered.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Aucun resultat avec ces filtres.
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
                    <ActionTooltip label="Page precedente">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0}
                        aria-label="Page precedente"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                    </ActionTooltip>
                    <ActionTooltip label="Page suivante">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        aria-label="Page suivante"
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
  /** Template source pour activer l'apercu PDF des contrats brouillons. */
  template: Template | null;
}) {
  const c = contract;
  const status = STATUS_TONE[c.status] ?? { label: c.status, tone: "neutral" as const };
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
        {/* Header */}
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
              <ToneBadge tone={status.tone}>{status.label}</ToneBadge>
              <ToneBadge tone="info">{typeLabel(c.contractType)}</ToneBadge>
              {endingSoon && (
                <ToneBadge tone="danger" icon={AlertTriangle}>
                  Fin {formatDate(c.endDate)}
                </ToneBadge>
              )}
            </div>
          </div>
        </div>

        {/* Infos cles */}
        <div className="grid grid-cols-2 gap-2 text-xs border-t pt-2">
          <InfoRow icon={CalendarIcon} label="Debut" value={formatDate(c.startDate)} />
          {c.endDate && <InfoRow icon={CalendarIcon} label="Fin" value={formatDate(c.endDate)} />}
          {c.salaryAnnual != null && (
            <InfoRow icon={Coins} label="Salaire / an" value={fmtMoney(c.salaryAnnual) ?? "-"} />
          )}
          {c.hourlyRate != null && (
            <InfoRow icon={Coins} label="Taux / h" value={`${Number(c.hourlyRate).toFixed(2)} $`} />
          )}
          {c.hoursPerWeek != null && (
            <InfoRow icon={TrendingUp} label="Heures / sem" value={`${c.hoursPerWeek} h`} />
          )}
          {c.vacationPct != null && (
            <InfoRow icon={TrendingUp} label="Vacances" value={`${c.vacationPct} %`} />
          )}
        </div>

        {/* Signatures status (dual party) */}
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          <SignatureStatusBadge
            employeeSignedAt={c.employeeSignedAt}
            employerSignedAt={c.employerSignedAt}
            terminatedAt={c.terminatedAt}
            variant="full"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-1.5 pt-1 border-t -mb-1">
          {canSend && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onSend}>
              <Send className="h-3 w-3 mr-1" />
              Envoyer
            </Button>
          )}
          {canSignEmployee && (
            <Button
              size="sm"
              className="h-7 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
              onClick={() => onSign("employee")}
            >
              <FileSignature className="h-3 w-3 mr-1" />
              Signer
            </Button>
          )}
          {canSignEmployer && (
            <Button
              size="sm"
              className="h-7 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
              onClick={() => onSign("employer")}
            >
              <FileSignature className="h-3 w-3 mr-1" />
              Contresigner
            </Button>
          )}
          {canDownloadPdf && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onOpenPdf}>
              <FileText className="h-3 w-3 mr-1" />
              Apercu PDF
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
              onError={(err) => toast.error(err.message || "Apercu indisponible")}
              trigger={
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  Apercu PDF
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
              Resilier
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
          Aucun template. Creez-en un pour standardiser les contrats par poste.
        </p>
        <Button size="sm" onClick={onCreate} className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Nouveau template
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
            placeholder="Rechercher un template..."
            className="h-9 text-sm pl-7"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 text-sm sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {CONTRACT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
            <SelectItem value="autre">Autre</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={onCreate}
          className="h-9 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Nouveau
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Aucun template trouve.
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
  t,
  onEdit,
  onDelete,
  onPreview,
}: {
  t: Template;
  onEdit: () => void;
  onDelete: () => void;
  onPreview: () => void;
}) {
  const meta: string[] = [];
  if (t.defaultSalary != null) meta.push(`${Number(t.defaultSalary).toLocaleString("fr-CA")} $/an`);
  if (t.defaultRate != null) meta.push(`${Number(t.defaultRate).toFixed(2)} $/h`);
  if (t.defaultHoursPerWeek != null) meta.push(`${t.defaultHoursPerWeek} h/sem`);
  if (t.defaultVacationPct != null) meta.push(`${t.defaultVacationPct}% vac.`);
  if (t.probationDays != null) meta.push(`${t.probationDays}j probation`);

  return (
    <Card className="vnk-card-hover overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-[#0F2D52]/8 ring-1 ring-[#0F2D52]/15 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-[#0F2D52]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{t.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {typeLabel(t.contractType)}
              {t.position ? ` - ${t.position.name}` : ""}
            </p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              <ToneBadge tone={t.isActive ? "success" : "neutral"}>
                {t.isActive ? "Actif" : "Desactive"}
              </ToneBadge>
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <ActionTooltip label="Apercu PDF">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onPreview}
                aria-label="Apercu PDF"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </ActionTooltip>
            <ActionTooltip label="Modifier">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onEdit}
                aria-label="Modifier"
              >
                <FileText className="h-4 w-4" />
              </Button>
            </ActionTooltip>
            <ActionTooltip label="Supprimer">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:text-destructive"
                onClick={onDelete}
                aria-label="Supprimer"
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
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  // Force remount du SignaturePad apres clear
  const [padKey, setPadKey] = useState(0);

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
      toast.error("Signez avant de soumettre");
      return;
    }
    setPending(true);
    const r =
      as === "employee"
        ? await signContractAsEmployeeAction({ id: contract.id, signatureData })
        : await signContractAsEmployerAction({ id: contract.id, signatureData });
    setPending(false);
    if (r.success) {
      toast.success(as === "employee" ? "Signe !" : "Contresigne - contrat actif");
      onSigned();
      onClose();
    } else toast.error(r.error || "Erreur");
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
                {as === "employee" ? "Signer mon contrat" : "Contresigner (employeur)"}
              </span>
            </DialogTitle>
            <DialogDescription className="text-white/80 text-[11px] sm:text-xs truncate">
              {contract.title} -{" "}
              {as === "employee"
                ? "Votre signature confirme votre engagement."
                : "Validation finale de l'employeur."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1">
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
              Resume du contrat
            </p>
            <p className="text-sm font-semibold">{contract.title}</p>
            <p className="text-xs text-muted-foreground">
              {contract.admin.fullName || contract.admin.email} -{" "}
              {typeLabel(contract.contractType)}
            </p>
            <p className="text-xs text-muted-foreground">
              Debut : {formatDate(contract.startDate)}
              {contract.endDate ? ` - Fin : ${formatDate(contract.endDate)}` : ""}
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
                ? "J'ai lu l'integralite du contrat et j'accepte ses termes en toute connaissance de cause."
                : "J'atteste avoir verifie le contrat et je le contresigne au nom de l'employeur."}
            </span>
          </label>

          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              Votre signature
            </p>
            <SignaturePad key={padKey} onChange={setSignatureData} />
          </div>

          <p className="text-[10px] text-muted-foreground">
            En signant, vous certifiez avoir lu et accepte l'integralite des termes du contrat.
            Votre signature est horodatee et archivee pour conformite legale.
          </p>
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
            Effacer
          </Button>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Annuler
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
