"use client";
// =============================================================
// ContractWizard - multi-step modal VNK pour creer un contrat
// a partir d'un template + employe.
//
// Etapes :
//   1. Choisir l'employe (grid de cards + recherche)
//   2. Choisir le template (recommandes par poste / tous)
//   3. Pre-rempli + ajustements (auto-fill maximal, edition optionnelle)
//   4. Apercu PDF (TemplatePdfPreviewButton + recap + Sheet pour editer le markdown)
//   5. Action : sauvegarder en brouillon ou envoyer pour signature
//
// Philosophie :
//   - Tout se remplit automatiquement depuis le profil employe +
//     valeurs par defaut du template. Les RH n'ont qu'a ajuster
//     ce qui differe vraiment (discute en entrevue).
//
// Conventions VNK : header navy gradient, FormSection/Field,
// DialogFooter sticky, DatePopover, ActionTooltip, texte FR.
// =============================================================
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FileSignature,
  Search,
  Sparkles,
  Layers,
  Briefcase,
  FileText,
  Coins,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Send,
  Save,
  Eye,
  Edit3,
  CalendarClock,
  Settings2,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { FormSection, Field } from "@/components/admin/form-section";
import { DatePopover } from "@/components/admin/date-popover";
import { TemplateRichEditor } from "@/components/admin/template-rich-editor";
import { TemplatePdfPreviewButton } from "@/components/admin/template-pdf-preview-button";
import { formatPreviewMarkdown } from "@/lib/document-templates/preview-helpers";
import { cn } from "@/lib/utils";
import {
  CONTRACT_TYPES,
  getContractTypeLabel,
  normalizeContractType,
} from "@/lib/document-templates/contract-types";

// ---------- Types --------------------------------------------------
export interface Employee {
  id: number;
  fullName: string | null;
  email: string;
  position: string | null;
  department: string | null;
  team: string | null;
  avatarUrl: string | null;
  salary?: number | null;
  hourlyRate?: number | null;
}

export interface ContractTemplate {
  id: number;
  name: string;
  bodyMarkdown: string;
  targetPositions: string[];
  targetDepartments: string[];
  defaultSalary?: number | null;
  defaultHourlyRate?: number | null;
  defaultHoursPerWeek?: number | null;
  defaultVacationPct?: number | null;
  contractType?: string;
}

export interface ContractWizardSubmitData {
  adminId: number;
  templateId: number;
  title: string;
  contractType: string;
  startDate: string;
  endDate?: string;
  probationEndDate?: string;
  salaryAnnual?: number;
  hourlyRate?: number;
  hoursPerWeek?: number;
  vacationPct?: number;
  bodyMarkdown: string;
  sendForSignature?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
  templates: ContractTemplate[];
  onCreate: (data: ContractWizardSubmitData) => Promise<void>;
}

// ---------- Helpers -----------------------------------------------
function labelForContractType(value: string | null | undefined): string {
  if (!value) return "";
  if (value === "autre") return "Autre";
  return getContractTypeLabel(value);
}

const STEPS = [
  { id: 1, label: "Employe", icon: Briefcase },
  { id: 2, label: "Template", icon: FileText },
  { id: 3, label: "Details", icon: Coins },
  { id: 4, label: "Apercu", icon: Eye },
  { id: 5, label: "Action", icon: Sparkles },
] as const;

function initials(name: string | null | undefined, email: string): string {
  const src = (name && name.trim()) || email;
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysISO(iso: string, days: number): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function fmtMoney(n: number | string | null | undefined, suffix = "$"): string {
  if (n == null || n === "") return "-";
  const num = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(num)) return "-";
  return `${num.toLocaleString("fr-CA", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${suffix}`;
}

function fmtDateFr(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("fr-CA", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ================================================================
//                       MAIN WIZARD COMPONENT
// ================================================================
export function ContractWizard({
  open,
  onClose,
  employees,
  templates,
  onCreate,
}: Props) {
  // ---- Wizard state ---------------------------------------------
  const [step, setStep] = useState(1);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [template, setTemplate] = useState<ContractTemplate | null>(null);
  const [expertMode, setExpertMode] = useState(false);

  // Step 3 : details (tous auto-remplis, "unlocks" individuels)
  const [title, setTitle] = useState("");
  const [contractType, setContractType] = useState<string>("permanent_full_time");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState("");
  const [probationEndDate, setProbationEndDate] = useState("");
  const [salaryAnnual, setSalaryAnnual] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [hoursPerWeek, setHoursPerWeek] = useState("40");
  // Quel champ pilote l'autre lors d'un changement d'heures/sem :
  // - "annual" : taux horaire recalculé depuis salaire annuel (défaut)
  // - "hourly" : salaire annuel recalculé depuis taux horaire
  const [salaryDriver, setSalaryDriver] = useState<"annual" | "hourly">("annual");

  // Helpers auto-calcul bidirectionnel (52 semaines/an conformément à pratique RH QC)
  const calcHourly = (annualStr: string, hoursStr: string): string => {
    const a = parseFloat(annualStr.replace(",", "."));
    const h = parseFloat(hoursStr.replace(",", "."));
    if (!Number.isFinite(a) || !Number.isFinite(h) || a <= 0 || h <= 0) return "";
    return (a / 52 / h).toFixed(2);
  };
  const calcAnnual = (hourlyStr: string, hoursStr: string): string => {
    const r = parseFloat(hourlyStr.replace(",", "."));
    const h = parseFloat(hoursStr.replace(",", "."));
    if (!Number.isFinite(r) || !Number.isFinite(h) || r <= 0 || h <= 0) return "";
    return (r * 52 * h).toFixed(2);
  };

  // Wrappers exposés au panneau du wizard : changement d'un champ → recalcule l'autre
  const handleSalaryAnnualChange = (v: string) => {
    setSalaryAnnual(v);
    setSalaryDriver("annual");
    markCustomized("salaryAnnual");
    const newHourly = calcHourly(v, hoursPerWeek);
    if (newHourly) setHourlyRate(newHourly);
  };
  const handleHourlyRateChange = (v: string) => {
    setHourlyRate(v);
    setSalaryDriver("hourly");
    markCustomized("hourlyRate");
    const newAnnual = calcAnnual(v, hoursPerWeek);
    if (newAnnual) setSalaryAnnual(newAnnual);
  };
  const handleHoursPerWeekChange = (v: string) => {
    setHoursPerWeek(v);
    markCustomized("hoursPerWeek");
    // Recalcule le champ "dérivé" selon le pilote actuel
    if (salaryDriver === "annual") {
      const newHourly = calcHourly(salaryAnnual, v);
      if (newHourly) setHourlyRate(newHourly);
    } else {
      const newAnnual = calcAnnual(hourlyRate, v);
      if (newAnnual) setSalaryAnnual(newAnnual);
    }
  };
  const [vacationPct, setVacationPct] = useState("4");
  const [signingBonus, setSigningBonus] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  // Track which fields RH a personalises (UI badge "Personnalise")
  const [customizedFields, setCustomizedFields] = useState<Set<string>>(new Set());
  const markCustomized = (field: string) =>
    setCustomizedFields((prev) => {
      if (prev.has(field)) return prev;
      const next = new Set(prev);
      next.add(field);
      return next;
    });

  // Step 4 : PDF preview + edition optionnelle du markdown
  const [customBody, setCustomBody] = useState<string | null>(null);
  const [editorSheetOpen, setEditorSheetOpen] = useState(false);
  const [editorDraft, setEditorDraft] = useState<string>("");

  // Step 5
  const [submitting, setSubmitting] = useState(false);

  // ---- Search filters -------------------------------------------
  const [empSearch, setEmpSearch] = useState("");
  const [tplSearch, setTplSearch] = useState("");

  // ---- Reset on open --------------------------------------------
  useEffect(() => {
    if (open) {
      setStep(1);
      setEmployee(null);
      setTemplate(null);
      setExpertMode(false);
      setTitle("");
      setContractType("permanent_full_time");
      setStartDate(todayISO());
      setEndDate("");
      setProbationEndDate(addDaysISO(todayISO(), 90));
      setSalaryAnnual("");
      setHourlyRate("");
      setHoursPerWeek("40");
      setVacationPct("4");
      setSigningBonus("");
      setInternalNotes("");
      setCustomizedFields(new Set());
      setCustomBody(null);
      setEditorSheetOpen(false);
      setEditorDraft("");
      setSubmitting(false);
      setEmpSearch("");
      setTplSearch("");
    }
  }, [open]);

  // ---- Auto-fill details when entering step 3 --------------------
  // Pas de "prev ||" pour les valeurs auto : on les rafraichit a chaque entree
  // SAUF si l'utilisateur a personnalise le champ explicitement.
  useEffect(() => {
    if (!template || !employee || step !== 3) return;
    const positionLabel = employee.position ?? "Employe";

    if (!customizedFields.has("title")) {
      setTitle(`Contrat de travail - ${positionLabel}`);
    }
    if (!customizedFields.has("contractType") && template.contractType) {
      setContractType(normalizeContractType(template.contractType));
    }
    if (!customizedFields.has("startDate")) {
      setStartDate(todayISO());
    }
    if (!customizedFields.has("probationEndDate")) {
      setProbationEndDate(addDaysISO(todayISO(), 90));
    }
    if (!customizedFields.has("salaryAnnual")) {
      if (employee.salary != null) setSalaryAnnual(String(employee.salary));
      else if (template.defaultSalary != null) setSalaryAnnual(String(template.defaultSalary));
      else setSalaryAnnual("");
    }
    if (!customizedFields.has("hourlyRate")) {
      if (employee.hourlyRate != null) setHourlyRate(String(employee.hourlyRate));
      else if (template.defaultHourlyRate != null) setHourlyRate(String(template.defaultHourlyRate));
      else setHourlyRate("");
    }
    if (!customizedFields.has("hoursPerWeek")) {
      setHoursPerWeek(template.defaultHoursPerWeek != null ? String(template.defaultHoursPerWeek) : "40");
    }
    if (!customizedFields.has("vacationPct")) {
      setVacationPct(template.defaultVacationPct != null ? String(template.defaultVacationPct) : "4");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, employee, step]);

  // ---- Probation auto-update when startDate changes -------------
  useEffect(() => {
    if (!startDate) return;
    if (!customizedFields.has("probationEndDate")) {
      setProbationEndDate(addDaysISO(startDate, 90));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate]);

  // ---- Filtered lists -------------------------------------------
  const filteredEmployees = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      `${e.fullName ?? ""} ${e.email} ${e.position ?? ""} ${e.department ?? ""} ${e.team ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [employees, empSearch]);

  const { recommendedTemplates, otherTemplates } = useMemo(() => {
    const q = tplSearch.trim().toLowerCase();
    const filterFn = (t: ContractTemplate) =>
      !q || `${t.name} ${t.bodyMarkdown}`.toLowerCase().includes(q);
    const pos = employee?.position?.trim().toLowerCase() ?? "";
    const dept = employee?.department?.trim().toLowerCase() ?? "";
    const matches = (t: ContractTemplate) => {
      const targets = [
        ...(t.targetPositions ?? []).map((s) => s.toLowerCase()),
        ...(t.targetDepartments ?? []).map((s) => s.toLowerCase()),
      ];
      if (targets.length === 0) return false;
      return targets.some((target) => target === pos || target === dept);
    };
    const recos: ContractTemplate[] = [];
    const others: ContractTemplate[] = [];
    for (const t of templates.filter(filterFn)) {
      if (matches(t)) recos.push(t);
      else others.push(t);
    }
    return { recommendedTemplates: recos, otherTemplates: others };
  }, [templates, employee, tplSearch]);

  // ---- Step navigation guards -----------------------------------
  const canNext = useMemo(() => {
    if (step === 1) return !!employee;
    if (step === 2) return !!template;
    if (step === 3) {
      if (!title.trim() || !startDate) return false;
      const ct = normalizeContractType(contractType);
      const needsEnd =
        ct === "temporary" ||
        ct === "internship" ||
        ct === "student" ||
        ct === "freelance" ||
        ct === "seasonal";
      if (needsEnd && !endDate) return false;
      return true;
    }
    return true;
  }, [step, employee, template, title, startDate, contractType, endDate]);

  // ---- Effective body (custom override OU template original) ----
  const effectiveBody = customBody ?? template?.bodyMarkdown ?? "";

  // ---- Extra context envoye au preview PDF ----------------------
  const extraContext = useMemo<Record<string, string>>(() => {
    return {
      "contract.title": title,
      "contract.type": labelForContractType(contractType) || contractType,
      "contract.startDate": startDate,
      "contract.endDate": endDate,
      "contract.probationEndDate": probationEndDate,
      "contract.salaryAnnual": salaryAnnual || "",
      "contract.hourlyRate": hourlyRate || "",
      "contract.hoursPerWeek": hoursPerWeek || "",
      "contract.vacationPct": vacationPct || "",
      "contract.signingBonus": signingBonus || "",
    };
  }, [
    title,
    contractType,
    startDate,
    endDate,
    probationEndDate,
    salaryAnnual,
    hourlyRate,
    hoursPerWeek,
    vacationPct,
    signingBonus,
  ]);

  // ---- Submit ---------------------------------------------------
  const submit = async (sendForSignature: boolean) => {
    if (!employee || !template) {
      toast.error("Employe et template requis");
      return;
    }
    if (!title.trim() || !startDate) {
      toast.error("Titre et date de debut requis");
      return;
    }
    setSubmitting(true);
    try {
      await onCreate({
        adminId: employee.id,
        templateId: template.id,
        title: title.trim(),
        contractType,
        startDate,
        endDate: endDate || undefined,
        probationEndDate: probationEndDate || undefined,
        salaryAnnual: salaryAnnual ? Number(salaryAnnual) : undefined,
        hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
        hoursPerWeek: hoursPerWeek ? Number(hoursPerWeek) : undefined,
        vacationPct: vacationPct ? Number(vacationPct) : undefined,
        bodyMarkdown: effectiveBody,
        sendForSignature,
      });
      onClose();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Open markdown editor sheet ------------------------------
  const openEditor = () => {
    setEditorDraft(effectiveBody);
    setEditorSheetOpen(true);
  };
  const saveEditor = () => {
    setCustomBody(editorDraft);
    setEditorSheetOpen(false);
    toast.success("Contenu personnalise enregistre");
  };
  const resetCustomBody = () => {
    setCustomBody(null);
    toast.info("Contenu remis a la version du template");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] p-0 overflow-hidden flex flex-col">
        {/* ===== Header navy ===== */}
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] text-white px-5 py-4 shrink-0">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base text-white flex items-center gap-2">
                  <FileSignature className="h-4 w-4 shrink-0" />
                  Nouveau contrat
                </DialogTitle>
                <DialogDescription className="text-white/80 text-xs">
                  Assistant en {STEPS.length} etapes : selection, personnalisation et signature.
                </DialogDescription>
              </div>
              {step === 3 && (
                <ActionTooltip label="Mode expert : deploie automatiquement toutes les sections d'ajustement.">
                  <button
                    type="button"
                    onClick={() => setExpertMode((v) => !v)}
                    className={cn(
                      "shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition",
                      expertMode
                        ? "bg-amber-300 text-amber-900"
                        : "bg-white/10 text-white hover:bg-white/20",
                    )}
                  >
                    <Settings2 className="h-3 w-3" />
                    {expertMode ? "Mode expert ON" : "Mode expert"}
                  </button>
                </ActionTooltip>
              )}
            </div>
          </DialogHeader>

          {/* Stepper */}
          <div className="mt-3 flex items-center gap-1 sm:gap-2">
            {STEPS.map((s, idx) => {
              const isActive = step === s.id;
              const isDone = step > s.id;
              const Icon = s.icon;
              return (
                <div key={s.id} className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] sm:text-xs font-semibold transition whitespace-nowrap",
                      isActive
                        ? "bg-white text-[#0F2D52]"
                        : isDone
                          ? "bg-white/20 text-white"
                          : "bg-white/5 text-white/60",
                    )}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <Icon className="h-3 w-3" />
                    )}
                    <span className="hidden sm:inline">
                      {s.id}. {s.label}
                    </span>
                    <span className="sm:hidden">{s.id}</span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={cn(
                        "flex-1 h-px",
                        step > s.id ? "bg-white/40" : "bg-white/10",
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== Body ===== */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {step === 1 && (
            <StepEmployee
              employees={filteredEmployees}
              selected={employee}
              search={empSearch}
              onSearch={setEmpSearch}
              onSelect={setEmployee}
            />
          )}

          {step === 2 && employee && (
            <StepTemplate
              employee={employee}
              recommended={recommendedTemplates}
              others={otherTemplates}
              selected={template}
              search={tplSearch}
              onSearch={setTplSearch}
              onSelect={setTemplate}
            />
          )}

          {step === 3 && employee && template && (
            <StepDetails
              employee={employee}
              template={template}
              expertMode={expertMode}
              customizedFields={customizedFields}
              markCustomized={markCustomized}
              title={title}
              onTitle={(v) => { setTitle(v); markCustomized("title"); }}
              contractType={contractType}
              onContractType={(v) => { setContractType(v); markCustomized("contractType"); }}
              startDate={startDate}
              onStartDate={(v) => { setStartDate(v); markCustomized("startDate"); }}
              endDate={endDate}
              onEndDate={(v) => { setEndDate(v); markCustomized("endDate"); }}
              probationEndDate={probationEndDate}
              onProbationEndDate={(v) => { setProbationEndDate(v); markCustomized("probationEndDate"); }}
              salaryAnnual={salaryAnnual}
              onSalaryAnnual={handleSalaryAnnualChange}
              hourlyRate={hourlyRate}
              onHourlyRate={handleHourlyRateChange}
              hoursPerWeek={hoursPerWeek}
              onHoursPerWeek={handleHoursPerWeekChange}
              vacationPct={vacationPct}
              onVacationPct={(v) => { setVacationPct(v); markCustomized("vacationPct"); }}
              signingBonus={signingBonus}
              onSigningBonus={(v) => { setSigningBonus(v); markCustomized("signingBonus"); }}
              internalNotes={internalNotes}
              onInternalNotes={setInternalNotes}
            />
          )}

          {step === 4 && template && employee && (
            <StepPreview
              employee={employee}
              template={template}
              title={title}
              contractType={contractType}
              startDate={startDate}
              endDate={endDate}
              probationEndDate={probationEndDate}
              salaryAnnual={salaryAnnual}
              hourlyRate={hourlyRate}
              hoursPerWeek={hoursPerWeek}
              vacationPct={vacationPct}
              signingBonus={signingBonus}
              effectiveBody={effectiveBody}
              extraContext={extraContext}
              hasCustomBody={customBody !== null}
              onOpenEditor={openEditor}
              onResetCustomBody={resetCustomBody}
            />
          )}

          {step === 5 && (
            <StepFinal
              employee={employee}
              template={template}
              title={title}
              contractType={contractType}
              startDate={startDate}
              endDate={endDate}
              probationEndDate={probationEndDate}
              salaryAnnual={salaryAnnual}
              hourlyRate={hourlyRate}
              hoursPerWeek={hoursPerWeek}
              vacationPct={vacationPct}
              signingBonus={signingBonus}
              internalNotes={internalNotes}
            />
          )}
        </div>

        {/* ===== Footer ===== */}
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0 gap-2 flex-wrap">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
            className="mr-auto"
          >
            Annuler
          </Button>
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={submitting}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1.5" />
              Precedent
            </Button>
          )}
          {step < 5 && (
            <Button
              onClick={() => setStep((s) => Math.min(5, s + 1))}
              disabled={!canNext}
              className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            >
              Suivant
              <ChevronRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          )}
          {step === 5 && (
            <>
              <Button
                variant="outline"
                onClick={() => submit(false)}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                )}
                Sauvegarder en brouillon
              </Button>
              <Button
                onClick={() => submit(true)}
                disabled={submitting}
                className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                )}
                Envoyer pour signature
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      {/* ===== Sheet : edition markdown du contrat ===== */}
      <Sheet open={editorSheetOpen} onOpenChange={setEditorSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
          <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] text-white px-5 py-4">
            <SheetHeader>
              <SheetTitle className="text-white text-base flex items-center gap-2">
                <Edit3 className="h-4 w-4" />
                Modifier le contenu du contrat
              </SheetTitle>
              <SheetDescription className="text-white/80 text-xs">
                Modifications appliquees uniquement a ce contrat. Le template d'origine
                reste inchange.
              </SheetDescription>
            </SheetHeader>
          </div>
          <div className="p-5 flex-1 overflow-y-auto">
            <p className="text-[11px] text-muted-foreground italic mb-2">
              Les champs dynamiques (ex. Nom complet, Date d&apos;embauche) sont
              affiches comme pastilles bleues et seront remplaces par les valeurs
              reelles dans le PDF.
            </p>
            <TemplateRichEditor
              value={editorDraft}
              onChange={setEditorDraft}
              minHeight="420px"
              placeholder="Commencez a rediger le contrat…"
            />
          </div>
          <div className="border-t bg-muted/30 px-5 py-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditorSheetOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={saveEditor}
              className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              Appliquer les modifications
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </Dialog>
  );
}

// ================================================================
//                       STEP 1 : EMPLOYEE
// ================================================================
function StepEmployee({
  employees,
  selected,
  search,
  onSearch,
  onSelect,
}: {
  employees: Employee[];
  selected: Employee | null;
  search: string;
  onSearch: (v: string) => void;
  onSelect: (e: Employee) => void;
}) {
  return (
    <FormSection icon={Briefcase} title="Choisir l'employe" description="Selectionnez l'employe pour lequel generer le contrat.">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Rechercher par nom, poste, departement..."
          className="h-9 text-sm pl-7"
        />
      </div>

      {employees.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          Aucun employe trouve.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
          {employees.map((e) => {
            const isSelected = selected?.id === e.id;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => onSelect(e)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border text-left transition",
                  isSelected
                    ? "border-[#0F2D52] bg-[#0F2D52]/5 ring-2 ring-[#0F2D52]/20"
                    : "border-input hover:bg-muted/40",
                )}
              >
                <Avatar className="h-10 w-10 shrink-0">
                  {e.avatarUrl ? <AvatarImage src={e.avatarUrl} alt={e.fullName ?? e.email} /> : null}
                  <AvatarFallback className="bg-[#0F2D52]/10 text-[#0F2D52]">
                    {initials(e.fullName, e.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">
                    {e.fullName ?? e.email}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {e.position ?? "Poste non defini"}
                    {e.department ? ` - ${e.department}` : ""}
                  </p>
                  {e.team && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      Equipe : {e.team}
                    </p>
                  )}
                </div>
                {isSelected && <CheckCircle2 className="h-4 w-4 text-[#0F2D52] shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </FormSection>
  );
}

// ================================================================
//                       STEP 2 : TEMPLATE
// ================================================================
function StepTemplate({
  employee,
  recommended,
  others,
  selected,
  search,
  onSearch,
  onSelect,
}: {
  employee: Employee;
  recommended: ContractTemplate[];
  others: ContractTemplate[];
  selected: ContractTemplate | null;
  search: string;
  onSearch: (v: string) => void;
  onSelect: (t: ContractTemplate) => void;
}) {
  const hasRecommended = recommended.length > 0;
  const positionLabel = employee.position ?? "ce poste";

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Rechercher un template..."
          className="h-9 text-sm pl-7"
        />
      </div>

      {hasRecommended && (
        <FormSection
          icon={Sparkles}
          title={`Recommandes pour ${positionLabel}`}
          description="Templates dont le ciblage correspond au poste ou departement de l'employe."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recommended.map((t) => (
              <TemplateCardChoice
                key={t.id}
                template={t}
                isSelected={selected?.id === t.id}
                onSelect={() => onSelect(t)}
                recommended
              />
            ))}
          </div>
        </FormSection>
      )}

      <FormSection
        icon={Layers}
        title={hasRecommended ? "Tous les templates" : "Templates disponibles"}
      >
        {others.length === 0 && !hasRecommended ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Aucun template disponible. Creez-en un d'abord depuis l'onglet Templates.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {others.map((t) => (
              <TemplateCardChoice
                key={t.id}
                template={t}
                isSelected={selected?.id === t.id}
                onSelect={() => onSelect(t)}
              />
            ))}
          </div>
        )}
      </FormSection>
    </div>
  );
}

function TemplateCardChoice({
  template,
  isSelected,
  onSelect,
  recommended,
}: {
  template: ContractTemplate;
  isSelected: boolean;
  onSelect: () => void;
  recommended?: boolean;
}) {
  const preview = useMemo(
    () => formatPreviewMarkdown(template.bodyMarkdown, 140),
    [template.bodyMarkdown],
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-1.5 p-3 rounded-lg border text-left transition",
        isSelected
          ? "border-[#0F2D52] bg-[#0F2D52]/5 ring-2 ring-[#0F2D52]/20"
          : "border-input hover:bg-muted/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{template.name}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {template.contractType && (
              <Badge variant="outline" className="text-[10px]">
                {labelForContractType(template.contractType) || template.contractType}
              </Badge>
            )}
            {recommended && (
              <Badge
                variant="outline"
                className="text-[10px] bg-amber-50 text-amber-700 border-amber-300"
              >
                <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                Recommande
              </Badge>
            )}
          </div>
        </div>
        {isSelected && <CheckCircle2 className="h-4 w-4 text-[#0F2D52] shrink-0" />}
      </div>
      {preview && (
        <p className="text-[11px] text-muted-foreground line-clamp-2">
          {preview}
        </p>
      )}
    </button>
  );
}

// ================================================================
//                STEP 3 : DETAILS (auto-fill + ajustements)
// ================================================================
interface StepDetailsProps {
  employee: Employee;
  template: ContractTemplate;
  expertMode: boolean;
  customizedFields: Set<string>;
  markCustomized: (field: string) => void;
  title: string;
  onTitle: (v: string) => void;
  contractType: string;
  onContractType: (v: string) => void;
  startDate: string;
  onStartDate: (v: string) => void;
  endDate: string;
  onEndDate: (v: string) => void;
  probationEndDate: string;
  onProbationEndDate: (v: string) => void;
  salaryAnnual: string;
  onSalaryAnnual: (v: string) => void;
  hourlyRate: string;
  onHourlyRate: (v: string) => void;
  hoursPerWeek: string;
  onHoursPerWeek: (v: string) => void;
  vacationPct: string;
  onVacationPct: (v: string) => void;
  signingBonus: string;
  onSigningBonus: (v: string) => void;
  internalNotes: string;
  onInternalNotes: (v: string) => void;
}

function StepDetails(props: StepDetailsProps) {
  const {
    employee,
    template,
    expertMode,
    customizedFields,
    title,
    onTitle,
    contractType,
    onContractType,
    startDate,
    onStartDate,
    endDate,
    onEndDate,
    probationEndDate,
    onProbationEndDate,
    salaryAnnual,
    onSalaryAnnual,
    hourlyRate,
    onHourlyRate,
    hoursPerWeek,
    onHoursPerWeek,
    vacationPct,
    onVacationPct,
    signingBonus,
    onSigningBonus,
    internalNotes,
    onInternalNotes,
  } = props;

  const _ct = normalizeContractType(contractType);
  const needsEndDate =
    _ct === "temporary" ||
    _ct === "internship" ||
    _ct === "student" ||
    _ct === "freelance" ||
    _ct === "seasonal";

  // Section "Ajustements" : ouverte par defaut si mode expert OU si type
  // necessite un endDate OU si l'utilisateur a deja personnalise un champ
  const [adjustOpen, setAdjustOpen] = useState(false);
  useEffect(() => {
    if (expertMode || needsEndDate || customizedFields.size > 0) {
      setAdjustOpen(true);
    }
  }, [expertMode, needsEndDate, customizedFields.size]);

  return (
    <div className="space-y-5">
      {/* Recap context */}
      <div className="rounded-lg border bg-muted/20 p-3 flex items-center gap-3">
        <Avatar className="h-9 w-9">
          {employee.avatarUrl ? <AvatarImage src={employee.avatarUrl} alt="" /> : null}
          <AvatarFallback className="bg-[#0F2D52]/10 text-[#0F2D52]">
            {initials(employee.fullName, employee.email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">
            {employee.fullName ?? employee.email}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {employee.position ?? "Poste non defini"} - {template.name}
          </p>
        </div>
      </div>

      {/* ====== SECTION : Pre-rempli automatiquement ====== */}
      <FormSection
        icon={Sparkles}
        title="Pre-rempli automatiquement"
        description="Valeurs deduites du profil employe et des defauts du template. Toutes modifiables ci-dessous."
      >
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
          <AutoRow label="Titre" value={title} customized={customizedFields.has("title")} />
          <AutoRow
            label="Type de contrat"
            value={labelForContractType(contractType) || contractType}
            customized={customizedFields.has("contractType")}
          />
          <AutoRow label="Date de debut" value={fmtDateFr(startDate)} customized={customizedFields.has("startDate")} />
          <AutoRow label="Fin probation" value={fmtDateFr(probationEndDate)} customized={customizedFields.has("probationEndDate")} hint="+90 jours" />
          {salaryAnnual && (
            <AutoRow label="Salaire annuel" value={fmtMoney(salaryAnnual)} customized={customizedFields.has("salaryAnnual")} />
          )}
          {hourlyRate && (
            <AutoRow label="Taux horaire" value={`${fmtMoney(hourlyRate)}/h`} customized={customizedFields.has("hourlyRate")} />
          )}
          <AutoRow label="Heures / semaine" value={`${hoursPerWeek} h`} customized={customizedFields.has("hoursPerWeek")} />
          <AutoRow label="Vacances" value={`${vacationPct} %`} customized={customizedFields.has("vacationPct")} />
        </div>
      </FormSection>

      {/* ====== SECTION : Ajustements ====== */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setAdjustOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 border-b pb-2 group"
        >
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-[#0F2D52]" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52]">
              Ajustements (optionnel)
            </h3>
            {customizedFields.size > 0 && (
              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300">
                {customizedFields.size} personnalise{customizedFields.size > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          {adjustOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        {adjustOpen && (
          <div className="space-y-5 pt-1">
            <FormSection icon={FileText} title="Identification">
              <Field label="Titre" required>
                <Input
                  value={title}
                  onChange={(e) => onTitle(e.target.value)}
                  placeholder="Contrat de travail - Technicien"
                />
              </Field>
              <Field label="Type de contrat" required>
                <Select value={contractType} onValueChange={onContractType}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </FormSection>

            <FormSection icon={CalendarClock} title="Periode">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Date de debut" required>
                  <DatePopover value={startDate} onChange={onStartDate} />
                </Field>
                {needsEndDate && (
                  <Field label="Date de fin" required>
                    <DatePopover value={endDate} onChange={onEndDate} min={startDate} />
                  </Field>
                )}
                <Field label="Fin periode probatoire" hint="Defaut : +90 jours">
                  <DatePopover
                    value={probationEndDate}
                    onChange={onProbationEndDate}
                    min={startDate}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection icon={Coins} title="Remuneration">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="Salaire annuel ($ CAD)">
                  <Input
                    type="number"
                    step="0.01"
                    value={salaryAnnual}
                    onChange={(e) => onSalaryAnnual(e.target.value)}
                    className="h-9"
                    placeholder="-"
                  />
                </Field>
                <Field label="Taux horaire ($)">
                  <Input
                    type="number"
                    step="0.01"
                    value={hourlyRate}
                    onChange={(e) => onHourlyRate(e.target.value)}
                    className="h-9"
                    placeholder="-"
                  />
                </Field>
                <Field label="Heures / sem">
                  <Input
                    type="number"
                    value={hoursPerWeek}
                    onChange={(e) => onHoursPerWeek(e.target.value)}
                    className="h-9"
                    placeholder="40"
                  />
                </Field>
                <Field label="Vacances %">
                  <Input
                    type="number"
                    step="0.1"
                    value={vacationPct}
                    onChange={(e) => onVacationPct(e.target.value)}
                    className="h-9"
                    placeholder="4"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <Field label="Bonus a la signature ($)" hint="Discute en entrevue, optionnel">
                  <Input
                    type="number"
                    step="0.01"
                    value={signingBonus}
                    onChange={(e) => onSigningBonus(e.target.value)}
                    className="h-9"
                    placeholder="-"
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection icon={FileText} title="Notes internes (RH uniquement)">
              <Field
                label="Notes"
                hint="Visible uniquement par les RH. N'apparait pas dans le contrat envoye a l'employe."
              >
                <Textarea
                  value={internalNotes}
                  onChange={(e) => onInternalNotes(e.target.value)}
                  rows={3}
                  placeholder="Ex : Conditions particulieres discutees en entrevue, contacts references..."
                  className="text-sm"
                />
              </Field>
            </FormSection>
          </div>
        )}
      </div>
    </div>
  );
}

// Ligne d'affichage "auto-rempli" (lecture seule, badge Auto/Personnalise)
function AutoRow({
  label,
  value,
  customized,
  hint,
}: {
  label: string;
  value: string;
  customized?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-1.5 min-w-0">
        {customized ? (
          <Unlock className="h-3 w-3 text-amber-600 shrink-0" />
        ) : (
          <Lock className="h-3 w-3 text-emerald-600 shrink-0" />
        )}
        <span className="text-muted-foreground truncate">{label}</span>
        {hint && (
          <span className="text-[10px] text-muted-foreground/70">({hint})</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-medium text-right truncate">{value || "-"}</span>
        <Badge
          variant="outline"
          className={cn(
            "text-[9px] px-1 py-0",
            customized
              ? "bg-amber-50 text-amber-700 border-amber-300"
              : "bg-emerald-50 text-emerald-700 border-emerald-300",
          )}
        >
          {customized ? "Personnalise" : "Auto"}
        </Badge>
      </div>
    </div>
  );
}

// ================================================================
//                       STEP 4 : PREVIEW (PDF)
// ================================================================
function StepPreview({
  employee,
  template,
  title,
  contractType,
  startDate,
  endDate,
  probationEndDate,
  salaryAnnual,
  hourlyRate,
  hoursPerWeek,
  vacationPct,
  signingBonus,
  effectiveBody,
  extraContext,
  hasCustomBody,
  onOpenEditor,
  onResetCustomBody,
}: {
  employee: Employee;
  template: ContractTemplate;
  title: string;
  contractType: string;
  startDate: string;
  endDate: string;
  probationEndDate: string;
  salaryAnnual: string;
  hourlyRate: string;
  hoursPerWeek: string;
  vacationPct: string;
  signingBonus: string;
  effectiveBody: string;
  extraContext: Record<string, string>;
  hasCustomBody: boolean;
  onOpenEditor: () => void;
  onResetCustomBody: () => void;
}) {
  const employeeName = employee.fullName ?? employee.email;

  return (
    <div className="space-y-5">
      {/* Bouton apercu PDF en vedette */}
      <FormSection
        icon={Eye}
        title="Apercu du contrat"
        description="Genere un apercu PDF identique au document final, avec toutes les variables resolues."
        action={
          hasCustomBody ? (
            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300">
              Contenu personnalise
            </Badge>
          ) : null
        }
      >
        <TemplatePdfPreviewButton
          bodyMarkdown={effectiveBody}
          title={`Contrat - ${employeeName}`}
          documentType="contract"
          employeeId={employee.id}
          extraContext={extraContext}
          metadata={{
            employeeName,
            companyName: "VNK Automatisation Inc.",
          }}
          trigger={
            <Button
              type="button"
              className="w-full bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
              size="lg"
            >
              <FileText className="h-4 w-4 mr-2" />
              Voir l'apercu PDF complet
            </Button>
          }
          onError={(err) => toast.error(`Apercu indisponible : ${err.message}`)}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenEditor}
            className="text-xs"
          >
            <Edit3 className="h-3 w-3 mr-1.5" />
            {hasCustomBody ? "Continuer l'edition" : "Modifier le contenu"}
          </Button>
          {hasCustomBody && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResetCustomBody}
              className="text-xs text-muted-foreground"
            >
              Reinitialiser au template d'origine
            </Button>
          )}
        </div>
      </FormSection>

      {/* Recap lecture seule */}
      <FormSection icon={FileText} title="Recapitulatif">
        <div className="rounded-lg border bg-muted/20 p-4 space-y-2 text-sm">
          <SummaryRow label="Beneficiaire" value={employeeName} />
          <SummaryRow label="Template" value={template.name} />
          <SummaryRow label="Titre" value={title} />
          <SummaryRow
            label="Type"
            value={labelForContractType(contractType) || contractType}
          />
          <SummaryRow label="Debut" value={fmtDateFr(startDate)} />
          {endDate && <SummaryRow label="Fin" value={fmtDateFr(endDate)} />}
          {probationEndDate && (
            <SummaryRow label="Fin probation" value={fmtDateFr(probationEndDate)} />
          )}
          {salaryAnnual && (
            <SummaryRow label="Salaire annuel" value={fmtMoney(salaryAnnual)} />
          )}
          {hourlyRate && <SummaryRow label="Taux horaire" value={`${fmtMoney(hourlyRate)}/h`} />}
          {hoursPerWeek && <SummaryRow label="Heures / sem" value={`${hoursPerWeek} h`} />}
          {vacationPct && <SummaryRow label="Vacances" value={`${vacationPct} %`} />}
          {signingBonus && (
            <SummaryRow label="Bonus a la signature" value={fmtMoney(signingBonus)} />
          )}
        </div>
      </FormSection>
    </div>
  );
}

// ================================================================
//                       STEP 5 : FINAL
// ================================================================
function StepFinal({
  employee,
  template,
  title,
  contractType,
  startDate,
  endDate,
  probationEndDate,
  salaryAnnual,
  hourlyRate,
  hoursPerWeek,
  vacationPct,
  signingBonus,
  internalNotes,
}: {
  employee: Employee | null;
  template: ContractTemplate | null;
  title: string;
  contractType: string;
  startDate: string;
  endDate: string;
  probationEndDate: string;
  salaryAnnual: string;
  hourlyRate: string;
  hoursPerWeek: string;
  vacationPct: string;
  signingBonus: string;
  internalNotes: string;
}) {
  return (
    <FormSection
      icon={Sparkles}
      title="Tout est pret"
      description="Choisissez l'action finale : sauvegarder en brouillon pour relecture, ou envoyer immediatement pour signature electronique."
    >
      <div className="rounded-lg border bg-muted/20 p-4 space-y-2 text-sm">
        <SummaryRow label="Beneficiaire" value={employee?.fullName ?? employee?.email ?? "-"} />
        <SummaryRow label="Template" value={template?.name ?? "-"} />
        <SummaryRow label="Titre" value={title} />
        <SummaryRow
          label="Type"
          value={labelForContractType(contractType) || contractType}
        />
        <SummaryRow label="Debut" value={fmtDateFr(startDate)} />
        {endDate && <SummaryRow label="Fin" value={fmtDateFr(endDate)} />}
        {probationEndDate && (
          <SummaryRow label="Fin probation" value={fmtDateFr(probationEndDate)} />
        )}
        {salaryAnnual && <SummaryRow label="Salaire annuel" value={fmtMoney(salaryAnnual)} />}
        {hourlyRate && <SummaryRow label="Taux horaire" value={`${fmtMoney(hourlyRate)}/h`} />}
        {hoursPerWeek && <SummaryRow label="Heures / sem" value={`${hoursPerWeek} h`} />}
        {vacationPct && <SummaryRow label="Vacances" value={`${vacationPct} %`} />}
        {signingBonus && <SummaryRow label="Bonus" value={fmtMoney(signingBonus)} />}
      </div>

      {internalNotes && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 text-xs">
          <p className="font-semibold text-amber-800 mb-1">Notes internes RH</p>
          <p className="whitespace-pre-wrap text-amber-900">{internalNotes}</p>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        En cliquant sur <strong>Envoyer pour signature</strong>, l'employe recevra une
        notification pour signer electroniquement son contrat. Vous pourrez contresigner
        une fois sa signature recue.
      </p>
    </FormSection>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right truncate">{value}</span>
    </div>
  );
}
