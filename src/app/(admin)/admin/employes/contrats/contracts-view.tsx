"use client";
// Vue Contrats — 2 onglets : Contrats individuels / Templates par poste.
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { promptDialog } from "@/components/admin/prompt-dialog";
import {
  FileSignature, Plus, Edit, Trash2, Send, CheckCircle2, AlertCircle,
  Ban, FileText, ChevronLeft, ChevronRight, Search, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SettingsTabs, type TabItem } from "@/components/admin/settings-tabs";
import { SignaturePad } from "./signature-pad";
import {
  createContractTemplateAction, updateContractTemplateAction, deleteContractTemplateAction,
  createContractAction, sendContractAction,
  signContractAsEmployeeAction, signContractAsEmployerAction, terminateContractAction,
} from "@/app/actions/hr-contracts";
import { MarkdownEditor } from "@/components/admin/markdown-editor";

type Tab = "contracts" | "templates";
type EmpLite = { id: number; fullName: string | null; email: string };
type PosLite = { id: number; name: string };
type Template = {
  id: number; name: string; contractType: string; bodyMarkdown: string;
  defaultSalary: number | null; defaultRate: number | null;
  defaultHoursPerWeek: number | null; defaultVacationPct: number | null;
  probationDays: number | null; isActive: boolean;
  positionId: number | null;
  position: { id: number; name: string } | null;
};
type Contract = {
  id: number; title: string; contractType: string; status: string;
  startDate: string; endDate: string | null; probationEndDate: string | null;
  salaryAnnual: number | null; hourlyRate: number | null;
  hoursPerWeek: number | null; vacationPct: number | null;
  employeeSignedAt: string | null; employerSignedAt: string | null; terminatedAt: string | null;
  adminId: number;
  admin: { id: number; fullName: string | null; email: string; avatarUrl: string | null };
  template: { id: number; name: string } | null;
  employer: { fullName: string | null; email: string } | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-700" },
  sent: { label: "Envoyé", color: "bg-blue-100 text-blue-700" },
  signed_employee: { label: "Signé employé", color: "bg-amber-100 text-amber-700" },
  signed_employer: { label: "Signé employeur", color: "bg-amber-100 text-amber-700" },
  active: { label: "Actif", color: "bg-emerald-100 text-emerald-700" },
  terminated: { label: "Terminé", color: "bg-red-100 text-red-700" },
  expired: { label: "Expiré", color: "bg-gray-100 text-gray-600" },
};

export function ContractsView({
  contracts, templates, employees, positions, currentAdminId, isHr,
}: {
  contracts: Contract[];
  templates: Template[];
  employees: EmpLite[];
  positions: PosLite[];
  currentAdminId: number;
  isHr: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("contracts");
  const [contractDialog, setContractDialog] = useState<{ open: boolean; existing: Contract | null }>({ open: false, existing: null });
  const [templateDialog, setTemplateDialog] = useState<{ open: boolean; existing: Template | null }>({ open: false, existing: null });
  const [signDialog, setSignDialog] = useState<{ open: boolean; contract: Contract | null; as: "employee" | "employer" }>({ open: false, contract: null, as: "employee" });
  const [terminateDialog, setTerminateDialog] = useState<Contract | null>(null);
  const [confirmDelTpl, setConfirmDelTpl] = useState<Template | null>(null);

  const TABS: TabItem<Tab>[] = [
    { key: "contracts", label: "Contrats", icon: FileSignature, count: contracts.length },
    ...(isHr ? [{ key: "templates" as Tab, label: "Templates", icon: FileText, count: templates.length }] : []),
  ];

  // Mes contrats vs ceux des autres
  const myContracts = contracts.filter((c) => c.adminId === currentAdminId);
  const othersContracts = contracts.filter((c) => c.adminId !== currentAdminId);

  // Filtres pour "Tous les employés"
  const [othersSearch, setOthersSearch] = useState("");
  const [othersStatus, setOthersStatus] = useState<string>("all");
  const [othersType, setOthersType] = useState<string>("all");
  const [othersPage, setOthersPage] = useState(0);
  const OTHERS_PAGE_SIZE = 10;

  const contractTypes = useMemo(() => {
    const s = new Set<string>();
    othersContracts.forEach((c) => s.add(c.contractType));
    return Array.from(s).sort();
  }, [othersContracts]);

  const filteredOthers = useMemo(() => {
    const q = othersSearch.trim().toLowerCase();
    return othersContracts.filter((c) => {
      if (othersStatus !== "all" && c.status !== othersStatus) return false;
      if (othersType !== "all" && c.contractType !== othersType) return false;
      if (q) {
        const name = (c.admin.fullName || c.admin.email).toLowerCase();
        const title = c.title.toLowerCase();
        if (!name.includes(q) && !title.includes(q)) return false;
      }
      return true;
    });
  }, [othersContracts, othersSearch, othersStatus, othersType]);

  useEffect(() => { setOthersPage(0); }, [othersSearch, othersStatus, othersType]);

  const othersTotalPages = Math.max(1, Math.ceil(filteredOthers.length / OTHERS_PAGE_SIZE));
  const othersPageItems = filteredOthers.slice(othersPage * OTHERS_PAGE_SIZE, (othersPage + 1) * OTHERS_PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-[#0F2D52]" />
            {isHr ? "Contrats d'employés" : "Mes contrats"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isHr
              ? "Créez, envoyez et gérez les contrats de vos employés."
              : "Consultez et signez vos contrats d'emploi."}
          </p>
        </div>
        {isHr && tab === "contracts" && (
          <Button onClick={() => setContractDialog({ open: true, existing: null })}>
            <Plus className="h-4 w-4 mr-1.5" />Nouveau contrat
          </Button>
        )}
        {isHr && tab === "templates" && (
          <Button onClick={() => setTemplateDialog({ open: true, existing: null })}>
            <Plus className="h-4 w-4 mr-1.5" />Nouveau template
          </Button>
        )}
      </div>

      <SettingsTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "contracts" && (
        <div className="space-y-4">
          {myContracts.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Mes contrats</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {myContracts.map((c) => (
                  <ContractCard
                    key={c.id} c={c} mine isHr={isHr}
                    onSign={(as) => setSignDialog({ open: true, contract: c, as })}
                    onTerminate={() => setTerminateDialog(c)}
                    onSend={async () => { const r = await sendContractAction({ id: c.id }); if (r.success) router.refresh(); else toast.error(r.error || ""); }}
                  />
                ))}
              </div>
            </section>
          )}

          {isHr && othersContracts.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tous les employés</h2>

              {/* Filtres */}
              <Card className="p-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={othersSearch}
                      onChange={(e) => setOthersSearch(e.target.value)}
                      placeholder="Rechercher employé ou titre…"
                      className="h-9 text-sm pl-7"
                    />
                  </div>
                  <Select value={othersStatus} onValueChange={setOthersStatus}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Statut" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={othersType} onValueChange={setOthersType}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les types</SelectItem>
                      {contractTypes.map((t) => <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </Card>

              {filteredOthers.length === 0 ? (
                <Card className="p-8 text-center text-sm text-muted-foreground">Aucun résultat avec ces filtres.</Card>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {othersPageItems.map((c) => (
                      <ContractCard
                        key={c.id} c={c} mine={false} isHr={isHr}
                        onSign={(as) => setSignDialog({ open: true, contract: c, as })}
                        onTerminate={() => setTerminateDialog(c)}
                        onSend={async () => { const r = await sendContractAction({ id: c.id }); if (r.success) router.refresh(); else toast.error(r.error || ""); }}
                      />
                    ))}
                  </div>

                  {filteredOthers.length > OTHERS_PAGE_SIZE && (
                    <div className="flex items-center justify-between text-xs px-2">
                      <span className="text-muted-foreground">
                        Page {othersPage + 1} / {othersTotalPages} · {filteredOthers.length} contrat{filteredOthers.length > 1 ? "s" : ""}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setOthersPage((p) => Math.max(0, p - 1))} disabled={othersPage === 0} aria-label="Page précédente">
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setOthersPage((p) => Math.min(othersTotalPages - 1, p + 1))} disabled={othersPage >= othersTotalPages - 1} aria-label="Page suivante">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {contracts.length === 0 && (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              {isHr ? "Aucun contrat créé. Commencez par un template puis générez un contrat pour un employé."
                    : "Aucun contrat émis pour votre compte."}
            </Card>
          )}
        </div>
      )}

      {tab === "templates" && isHr && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map((t) => (
            <Card key={t.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-sm">{t.name}</h3>
                  <p className="text-xs text-muted-foreground">{t.contractType.toUpperCase()}</p>
                  {t.position && (
                    <Badge variant="outline" className="mt-1 text-[10px]">{t.position.name}</Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTemplateDialog({ open: true, existing: t })} aria-label="Modifier">
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setConfirmDelTpl(t)} aria-label="Supprimer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground border-t pt-2">
                {t.defaultSalary != null && <div>Salaire/an : <strong>{Number(t.defaultSalary).toLocaleString("fr-CA")} $</strong></div>}
                {t.defaultRate != null && <div>Taux/h : <strong>{Number(t.defaultRate).toFixed(2)} $</strong></div>}
                {t.defaultHoursPerWeek != null && <div>Heures/sem : <strong>{t.defaultHoursPerWeek}h</strong></div>}
                {t.defaultVacationPct != null && <div>Vacances : <strong>{t.defaultVacationPct}%</strong></div>}
                {t.probationDays != null && <div>Probation : <strong>{t.probationDays}j</strong></div>}
              </div>
            </Card>
          ))}
          {templates.length === 0 && (
            <Card className="p-10 text-center text-sm text-muted-foreground col-span-full">
              Aucun template. Créez-en un pour standardiser les contrats par poste.
            </Card>
          )}
        </div>
      )}

      {/* Dialogs */}
      <NewContractDialog
        open={contractDialog.open}
        templates={templates}
        employees={employees}
        onClose={() => setContractDialog({ open: false, existing: null })}
        onSaved={() => router.refresh()}
      />

      <TemplateDialog
        open={templateDialog.open}
        existing={templateDialog.existing}
        positions={positions}
        onClose={() => setTemplateDialog({ open: false, existing: null })}
        onSaved={() => router.refresh()}
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
        title={`Résilier ${terminateDialog?.title} ?`}
        description="Cette action marquera le contrat comme terminé. Conservé pour l'historique."
        confirmLabel="Résilier"
        variant="destructive"
        onConfirm={async () => {
          if (!terminateDialog) return;
          const reason = await promptDialog({
            title: "Motif de résiliation",
            description: "Décrivez précisément la raison de la résiliation (conservé pour l'historique légal).",
            label: "Motif *",
            multiline: true,
            required: true,
            variant: "destructive",
            confirmLabel: "Résilier",
          });
          if (!reason) { setTerminateDialog(null); return; }
          const r = await terminateContractAction({ id: terminateDialog.id, reason });
          if (r.success) { toast.success("Contrat résilié"); router.refresh(); }
          else toast.error(r.error || "");
          setTerminateDialog(null);
        }}
      />

      <ConfirmDialog
        open={!!confirmDelTpl}
        onOpenChange={(o) => !o && setConfirmDelTpl(null)}
        title={`Supprimer ${confirmDelTpl?.name} ?`}
        description="Si le template est déjà utilisé, il sera désactivé au lieu d'être supprimé."
        confirmLabel="Supprimer"
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDelTpl) return;
          const r = await deleteContractTemplateAction({ id: confirmDelTpl.id });
          if (r.success) { toast.success("Template supprimé"); router.refresh(); }
          else toast.error(r.error || "");
          setConfirmDelTpl(null);
        }}
      />
    </div>
  );
}

function ContractCard({
  c, mine, isHr, onSign, onTerminate, onSend,
}: {
  c: Contract; mine: boolean; isHr: boolean;
  onSign: (as: "employee" | "employer") => void;
  onTerminate: () => void;
  onSend: () => void;
}) {
  const status = STATUS_LABELS[c.status] ?? { label: c.status, color: "bg-gray-100 text-gray-700" };
  const canSignEmployee = mine && c.status === "sent" && !c.employeeSignedAt;
  const canSignEmployer = isHr && c.employeeSignedAt && !c.employerSignedAt && c.status !== "terminated";
  const canSend = isHr && c.status === "draft";
  const canTerminate = isHr && (c.status === "active" || c.status === "signed_employer" || c.status === "signed_employee");
  const canDownloadPdf = c.status === "active" || (!!c.employeeSignedAt && !!c.employerSignedAt);

  return (
    <Card className="overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-sm">{c.title}</h3>
            <p className="text-xs text-muted-foreground">{c.admin.fullName || c.admin.email}</p>
          </div>
          <Badge className={`text-[10px] ${status.color}`}>{status.label}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>Début : <strong>{new Date(c.startDate).toLocaleDateString("fr-CA")}</strong></div>
          {c.endDate && <div>Fin : <strong>{new Date(c.endDate).toLocaleDateString("fr-CA")}</strong></div>}
          {c.salaryAnnual && <div>Salaire/an : <strong>{Number(c.salaryAnnual).toLocaleString("fr-CA")} $</strong></div>}
          {c.hourlyRate && <div>Taux/h : <strong>{Number(c.hourlyRate).toFixed(2)} $</strong></div>}
          {c.hoursPerWeek && <div>Heures/sem : <strong>{c.hoursPerWeek}h</strong></div>}
          {c.vacationPct && <div>Vacances : <strong>{c.vacationPct}%</strong></div>}
        </div>

        <div className="flex flex-wrap gap-1.5 text-[10px]">
          {c.employeeSignedAt ? (
            <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
              <CheckCircle2 className="h-2.5 w-2.5 mr-1" />Signé employé
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              <AlertCircle className="h-2.5 w-2.5 mr-1" />Signature employé en attente
            </Badge>
          )}
          {c.employerSignedAt ? (
            <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
              <CheckCircle2 className="h-2.5 w-2.5 mr-1" />Signé employeur
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              <AlertCircle className="h-2.5 w-2.5 mr-1" />Signature employeur en attente
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {canSend && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onSend}>
              <Send className="h-3 w-3 mr-1" />Envoyer à l&apos;employé
            </Button>
          )}
          {canSignEmployee && (
            <Button size="sm" className="h-7 text-xs" onClick={() => onSign("employee")}>
              <FileSignature className="h-3 w-3 mr-1" />Signer
            </Button>
          )}
          {canSignEmployer && (
            <Button size="sm" className="h-7 text-xs" onClick={() => onSign("employer")}>
              <FileSignature className="h-3 w-3 mr-1" />Contresigner
            </Button>
          )}
          {canTerminate && (
            <Button size="sm" variant="outline" className="h-7 text-xs hover:text-destructive" onClick={onTerminate}>
              <Ban className="h-3 w-3 mr-1" />Résilier
            </Button>
          )}
          {canDownloadPdf && (
            <Button asChild size="sm" variant="outline" className="h-7 text-xs">
              <a href={`/api/admin/contracts/${c.id}/pdf`} target="_blank" rel="noopener">
                <Download className="h-3 w-3 mr-1" />Télécharger PDF
              </a>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function NewContractDialog({
  open, templates, employees, onClose, onSaved,
}: {
  open: boolean;
  templates: Template[];
  employees: EmpLite[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [employeeId, setEmployeeId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("none");
  const [title, setTitle] = useState("");
  const [contractType, setContractType] = useState<"cdi" | "cdd" | "contractuel" | "stagiaire" | "autre">("cdi");
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [salaryAnnual, setSalaryAnnual] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [hoursPerWeek, setHoursPerWeek] = useState("");
  const [vacationPct, setVacationPct] = useState("4");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setEmployeeId("");
      setTemplateId("none");
      setTitle("");
      setContractType("cdi");
      setBodyMarkdown("");
      setStartDate(new Date().toISOString().slice(0, 10));
      setEndDate("");
      setSalaryAnnual("");
      setHourlyRate("");
      setHoursPerWeek("");
      setVacationPct("4");
    }
  }, [open]);

  const onTemplateChange = (v: string) => {
    setTemplateId(v);
    if (v === "none") return;
    const t = templates.find((x) => String(x.id) === v);
    if (!t) return;
    setTitle(t.name);
    setContractType(t.contractType as "cdi" | "cdd" | "contractuel" | "stagiaire" | "autre");
    setBodyMarkdown(t.bodyMarkdown);
    if (t.defaultSalary) setSalaryAnnual(String(t.defaultSalary));
    if (t.defaultRate) setHourlyRate(String(t.defaultRate));
    if (t.defaultHoursPerWeek) setHoursPerWeek(String(t.defaultHoursPerWeek));
    if (t.defaultVacationPct) setVacationPct(String(t.defaultVacationPct));
  };

  const submit = async () => {
    if (!employeeId || !title.trim() || !bodyMarkdown.trim() || !startDate) {
      toast.error("Employé, titre, corps et date début requis"); return;
    }
    setPending(true);
    const r = await createContractAction({
      adminId: Number(employeeId),
      templateId: templateId !== "none" ? Number(templateId) : null,
      title, contractType, bodyMarkdown,
      startDate,
      endDate: endDate || null,
      salaryAnnual: salaryAnnual ? Number(salaryAnnual) : null,
      hourlyRate: hourlyRate ? Number(hourlyRate) : null,
      hoursPerWeek: hoursPerWeek ? Number(hoursPerWeek) : null,
      vacationPct: vacationPct ? Number(vacationPct) : null,
    });
    setPending(false);
    if (r.success) {
      toast.success("Contrat créé en brouillon");
      onSaved(); onClose();
      // Reset complet
      setEmployeeId("");
      setTemplateId("none");
      setTitle("");
      setContractType("cdi");
      setBodyMarkdown("");
      setStartDate(new Date().toISOString().slice(0, 10));
      setEndDate("");
      setSalaryAnnual("");
      setHourlyRate("");
      setHoursPerWeek("");
      setVacationPct("4");
    } else toast.error(r.error || "Erreur");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <FileSignature className="h-4 w-4" />Nouveau contrat
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Créé en brouillon · à envoyer ensuite pour signature.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Employé *</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.fullName || e.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Template (optionnel)</Label>
              <Select value={templateId} onValueChange={onTemplateChange}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sans template —</SelectItem>
                  {templates.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Titre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contrat CDI - …" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Type *</Label>
              <Select value={contractType} onValueChange={(v: string) => setContractType(v as "cdi" | "cdd" | "contractuel" | "stagiaire" | "autre")}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cdi">CDI</SelectItem>
                  <SelectItem value="cdd">CDD</SelectItem>
                  <SelectItem value="contractuel">Contractuel</SelectItem>
                  <SelectItem value="stagiaire">Stagiaire</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Début *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Fin</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Salaire/an</Label>
              <Input type="number" step="0.01" value={salaryAnnual} onChange={(e) => setSalaryAnnual(e.target.value)} className="h-9" placeholder="—" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Taux/h</Label>
              <Input type="number" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} className="h-9" placeholder="—" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Heures/sem</Label>
              <Input type="number" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} className="h-9" placeholder="40" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Vacances %</Label>
              <Input type="number" step="0.1" value={vacationPct} onChange={(e) => setVacationPct(e.target.value)} className="h-9" placeholder="4" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Corps du contrat (Markdown) *</Label>
            <textarea
              value={bodyMarkdown}
              onChange={(e) => setBodyMarkdown(e.target.value)}
              rows={10}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-y"
              placeholder={"# Contrat d'embauche\n\nEntre VNK Automatisation Inc. (ci-après « l'employeur ») et …"}
            />
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "..." : "Créer le contrat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateDialog({
  open, existing, positions, onClose, onSaved,
}: {
  open: boolean;
  existing: Template | null;
  positions: PosLite[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [positionId, setPositionId] = useState(existing?.positionId ? String(existing.positionId) : "none");
  const [contractType, setContractType] = useState(existing?.contractType ?? "cdi");
  const [body, setBody] = useState(existing?.bodyMarkdown ?? "");
  const [salary, setSalary] = useState(existing?.defaultSalary ? String(existing.defaultSalary) : "");
  const [rate, setRate] = useState(existing?.defaultRate ? String(existing.defaultRate) : "");
  const [hours, setHours] = useState(existing?.defaultHoursPerWeek ? String(existing.defaultHoursPerWeek) : "40");
  const [vac, setVac] = useState(existing?.defaultVacationPct ? String(existing.defaultVacationPct) : "4");
  const [probation, setProbation] = useState(existing?.probationDays ? String(existing.probationDays) : "90");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setName(existing?.name ?? "");
      setPositionId(existing?.positionId ? String(existing.positionId) : "none");
      setContractType(existing?.contractType ?? "cdi");
      setBody(existing?.bodyMarkdown ?? "");
      setSalary(existing?.defaultSalary ? String(existing.defaultSalary) : "");
      setRate(existing?.defaultRate ? String(existing.defaultRate) : "");
      setHours(existing?.defaultHoursPerWeek ? String(existing.defaultHoursPerWeek) : "40");
      setVac(existing?.defaultVacationPct ? String(existing.defaultVacationPct) : "4");
      setProbation(existing?.probationDays ? String(existing.probationDays) : "90");
    }
  }, [open, existing]);

  const submit = async () => {
    if (!name.trim() || !body.trim()) { toast.error("Nom et corps requis"); return; }
    setPending(true);
    const payload = {
      name: name.trim(),
      positionId: positionId !== "none" ? Number(positionId) : null,
      contractType: contractType as "cdi" | "cdd" | "contractuel" | "stagiaire" | "autre",
      bodyMarkdown: body,
      defaultSalary: salary ? Number(salary) : null,
      defaultRate: rate ? Number(rate) : null,
      defaultHoursPerWeek: hours ? Number(hours) : null,
      defaultVacationPct: vac ? Number(vac) : null,
      probationDays: probation ? Number(probation) : null,
    };
    const r = existing
      ? await updateContractTemplateAction({ ...payload, id: existing.id })
      : await createContractTemplateAction(payload);
    setPending(false);
    if (r.success) { toast.success(existing ? "Template modifié" : "Template créé"); onSaved(); onClose(); }
    else toast.error(r.error || "Erreur");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <FileText className="h-4 w-4" />{existing ? "Modifier template" : "Nouveau template de contrat"}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Standardise les contrats par poste. Réutilisable lors de la création d&apos;un contrat.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Nom *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contrat CDI Comptable" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Poste lié</Label>
              <Select value={positionId} onValueChange={setPositionId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Aucun —</SelectItem>
                  {positions.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Type</Label>
              <Select value={contractType} onValueChange={setContractType}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cdi">CDI</SelectItem>
                  <SelectItem value="cdd">CDD</SelectItem>
                  <SelectItem value="contractuel">Contractuel</SelectItem>
                  <SelectItem value="stagiaire">Stagiaire</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Salaire</Label>
              <Input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Taux/h</Label>
              <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">H/sem</Label>
              <Input type="number" value={hours} onChange={(e) => setHours(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Vac %</Label>
              <Input type="number" value={vac} onChange={(e) => setVac(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Probation (jours)</Label>
            <Input type="number" value={probation} onChange={(e) => setProbation(e.target.value)} className="h-9 w-24" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Corps Markdown *</Label>
            <MarkdownEditor
              value={body}
              onChange={setBody}
              rows={14}
              placeholder="Corps du contrat avec placeholders {{employeeName}}, {{startDate}}, etc."
              helpText="Markdown + placeholders {{...}} qui seront remplacés lors de la génération du contrat"
            />
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "..." : existing ? "Enregistrer" : "Créer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SignDialog({
  open, contract, as, onClose, onSigned,
}: {
  open: boolean;
  contract: Contract | null;
  as: "employee" | "employer";
  onClose: () => void;
  onSigned: () => void;
}) {
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setSignatureData(null);
    }
  }, [open, contract]);

  if (!contract) return null;

  const submit = async () => {
    if (!signatureData) { toast.error("Signez avant de soumettre"); return; }
    setPending(true);
    const r = as === "employee"
      ? await signContractAsEmployeeAction({ id: contract.id, signatureData })
      : await signContractAsEmployerAction({ id: contract.id, signatureData });
    setPending(false);
    if (r.success) {
      toast.success(as === "employee" ? "Signé !" : "Contresigné — contrat actif");
      onSigned(); onClose();
    } else toast.error(r.error || "Erreur");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <FileSignature className="h-4 w-4" />
              {as === "employee" ? "Signer mon contrat" : "Contresigner (employeur)"}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {contract.title} · {as === "employee" ? "Votre signature confirme votre engagement." : "Validation finale de l'employeur."}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <div className="rounded-lg border bg-muted/20 p-3 max-h-48 overflow-y-auto">
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">Aperçu du contrat</p>
            <pre className="text-xs font-mono whitespace-pre-wrap">{contract.title}</pre>
          </div>
          <SignaturePad onChange={setSignatureData} />
          <p className="text-[10px] text-muted-foreground">
            En signant, vous certifiez avoir lu et accepté l&apos;intégralité des termes du contrat.
            Votre signature est horodatée et archivée pour conformité légale.
          </p>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button onClick={submit} disabled={pending || !signatureData}>
            {pending ? "..." : "Signer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
