"use client";
// Vue dossier employe : tabs identite/notes/evaluations/contrats/documents/conges/equipement/permis/paie/cnesst.
// Inclus le dialog VNK navy pour creer/editer une EmployeeNote.
import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Briefcase, User, Mail, Phone, MapPin, Calendar, Crown, Building2,
  Plus, Edit, Trash2, FileText, ShieldAlert, ThumbsUp, Eye, Stethoscope,
  GraduationCap, LogOut, Award, Package, FilePen, Download, FileDown,
  AlertTriangle, Banknote, FolderClosed, Heart, ClipboardList, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormSection, Field } from "@/components/admin/form-section";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { PdfPreviewModal } from "@/components/admin/pdf-preview-modal";
import { RequestDocumentUploadDialog } from "@/components/admin/request-document-upload-dialog";
import {
  createEmployeeNoteAction,
  updateEmployeeNoteAction,
  deleteEmployeeNoteAction,
} from "@/app/actions/hr-employee-notes";

// ─── Types ─────────────────────────────────────────────────────────
type AdminFull = {
  id: number;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  title: string | null;
  phone: string | null;
  department: string | null;
  startDate: string | null;
  endDate: string | null;
  birthdate: string | null;
  bio: string | null;
  internalNotes: string | null;
  isActive: boolean;
  civility: string | null;
  gender: string | null;
  preferredPronouns: string | null;
  position: { id: number; name: string; color: string | null } | null;
  customRole: { id: number; name: string; color: string | null } | null;
  team: { id: number; name: string; color: string | null } | null;
  manager: { id: number; fullName: string | null; email: string } | null;
};

type NoteCategory = "general" | "discipline" | "commendation" | "observation" | "medical" | "onboarding" | "exit";
type NoteSeverity = "info" | "warning" | "critical";

type Note = {
  id: number;
  adminId: number;
  authorId: number;
  category: string;
  severity: string | null;
  title: string;
  body: string;
  isConfidential: boolean;
  acknowledgedAt: string | null;
  occurredAt: string | null;
  attachmentUrl: string | null;
  createdAt: string;
  updatedAt: string;
  author: { id: number; fullName: string | null; email: string };
};

type EmployeeFileRow = {
  id: number;
  category: string;
  title: string;
  fileUrl: string;
  mimeType: string | null;
  createdAt: string;
};

type ContractRow = {
  id: number;
  title: string;
  contractType: string;
  status: string;
  startDate: string;
  endDate: string | null;
  salaryAnnual: number | null;
  hourlyRate: number | null;
};

type ReviewRow = {
  id: number;
  periodStart: string;
  periodEnd: string;
  status: string;
  rating: number | null;
  reviewer: { id: number; fullName: string | null; email: string };
};

type LeaveRow = {
  id: number;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string | null;
};

type EquipmentRow = {
  id: number;
  category: string;
  name: string;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  assignedAt: string;
};

type LicenseRow = {
  id: number;
  type: string;
  number: string | null;
  issuer: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  fileUrl: string | null;
};

type TrainingRow = {
  id: number;
  title: string;
  category: string;
  provider: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  isMandatory: boolean;
};

type CnesstRow = {
  id: number;
  incidentDate: string;
  location: string;
  description: string;
  injuryType: string | null;
  status: string;
  daysAbsent: number | null;
};

type EmergencyContactRow = {
  id: number;
  name: string;
  relationship: string;
  phone: string;
  isPrimary: boolean;
};

type FamilyRow = {
  id: number;
  type: string;
  fullName: string;
  isInsured: boolean;
  isTaxDependent: boolean;
};

type BankRow = {
  institutionLabel: string | null;
  accountLast4: string | null;
  verifiedAt: string | null;
};

// ─── Constantes ────────────────────────────────────────────────────
const CATEGORY_LABEL: Record<string, string> = {
  general: "General",
  discipline: "Discipline",
  commendation: "Felicitation",
  observation: "Observation",
  medical: "Medical",
  onboarding: "Onboarding",
  exit: "Depart",
};

const CATEGORY_COLOR: Record<string, string> = {
  general: "bg-slate-100 text-slate-700 border-slate-200",
  discipline: "bg-red-50 text-red-700 border-red-200",
  commendation: "bg-emerald-50 text-emerald-700 border-emerald-200",
  observation: "bg-blue-50 text-blue-700 border-blue-200",
  medical: "bg-violet-50 text-violet-700 border-violet-200",
  onboarding: "bg-cyan-50 text-cyan-700 border-cyan-200",
  exit: "bg-amber-50 text-amber-700 border-amber-200",
};

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  general: FileText,
  discipline: ShieldAlert,
  commendation: ThumbsUp,
  observation: Eye,
  medical: Stethoscope,
  onboarding: GraduationCap,
  exit: LogOut,
};

const SEVERITY_LABEL: Record<string, string> = {
  info: "Info",
  warning: "Avertissement",
  critical: "Critique",
};

const SEVERITY_COLOR: Record<string, string> = {
  info: "bg-blue-100 text-blue-700",
  warning: "bg-amber-100 text-amber-800",
  critical: "bg-red-600 text-white",
};

// ─── Helpers ───────────────────────────────────────────────────────
function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

function fmtDateShort(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-CA");
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${Number(n).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

function seniorityLabel(start: string | null): string {
  if (!start) return "—";
  const s = new Date(start);
  const now = new Date();
  const months = (now.getFullYear() - s.getFullYear()) * 12 + (now.getMonth() - s.getMonth());
  if (months < 1) return "Moins d'un mois";
  if (months < 12) return `${months} mois`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y} an${y > 1 ? "s" : ""}` : `${y} an${y > 1 ? "s" : ""} ${m} mois`;
}

function genderLabel(g: string | null | undefined): string {
  switch (g) {
    case "male": return "Homme";
    case "female": return "Femme";
    case "non_binary": return "Non-binaire";
    case "prefer_not_to_say": return "Préfère ne pas dire";
    default: return "—";
  }
}

// ─── Composant principal ──────────────────────────────────────────
export function DossierView(props: {
  actorId: number;
  isSuper: boolean;
  admin: AdminFull;
  notes: Note[];
  files: EmployeeFileRow[];
  contracts: ContractRow[];
  reviews: ReviewRow[];
  payAgg: { count: number; netPay: number; grossPay: number };
  leaves: LeaveRow[];
  equipment: EquipmentRow[];
  licenses: LicenseRow[];
  trainings: TrainingRow[];
  cnesst: CnesstRow[];
  emergencyContacts: EmergencyContactRow[];
  family: FamilyRow[];
  bank: BankRow | null;
}) {
  const tc = useTranslations("common");
  const router = useRouter();
  const {
    actorId, isSuper, admin, notes, files, contracts, reviews, payAgg,
    leaves, equipment, licenses, trainings, cnesst, emergencyContacts, family, bank,
  } = props;

  const [noteDialog, setNoteDialog] = useState<{ open: boolean; note: Note | null }>({ open: false, note: null });
  const [confirmDel, setConfirmDel] = useState<Note | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string; description?: string; filename?: string } | null>(null);
  const [docRequestOpen, setDocRequestOpen] = useState(false);

  const employeeLabel = admin.fullName || admin.email;

  const initials = (admin.fullName || admin.email)
    .split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  // Notes triees par categorie (discipline en premier)
  const notesOrdered = [...notes].sort((a, b) => {
    const order: Record<string, number> = {
      discipline: 0, exit: 1, medical: 2, observation: 3, onboarding: 4, commendation: 5, general: 6,
    };
    const ao = order[a.category] ?? 99;
    const bo = order[b.category] ?? 99;
    if (ao !== bo) return ao - bo;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const onDeleteNote = async () => {
    if (!confirmDel) return;
    const r = await deleteEmployeeNoteAction({ id: confirmDel.id });
    if (r.success) { toast.success("Note supprimee"); router.refresh(); }
    else toast.error(r.error || "Erreur");
    setConfirmDel(null);
  };

  return (
    <div className="space-y-4">
      {/* ── Header ───────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] px-5 py-4 text-white flex items-center gap-4 flex-wrap">
          <div className="h-16 w-16 rounded-full bg-white/10 ring-2 ring-white/30 flex items-center justify-center text-lg font-bold"
            style={admin.avatarUrl ? { backgroundImage: `url(${admin.avatarUrl})`, backgroundSize: "cover" } : undefined}
          >
            {!admin.avatarUrl && initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold truncate">{admin.fullName || admin.email}</h1>
              {!admin.isActive && (
                <Badge className="bg-red-500 text-white border-0">{tc("inactive")}</Badge>
              )}
              {admin.customRole && (
                <Badge variant="outline" className="border-white/40 text-white bg-white/10">
                  <Crown className="h-3 w-3 mr-1" />
                  {admin.customRole.name}
                </Badge>
              )}
            </div>
            <p className="text-sm text-white/85 truncate">
              {admin.position?.name || admin.title || "Sans poste"}
              {admin.team ? ` · ${admin.team.name}` : ""}
              {admin.manager ? ` · Manager : ${admin.manager.fullName || admin.manager.email}` : ""}
            </p>
            <p className="text-xs text-white/70 mt-0.5">
              {admin.email}{admin.phone ? ` · ${admin.phone}` : ""}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
              asChild
            >
              <Link href="/admin/employes">
                <FolderClosed className="h-4 w-4 mr-1.5" />
                {tc("back")}
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
              onClick={() => setDocRequestOpen(true)}
            >
              <Upload className="h-4 w-4 mr-1.5" />
              Demander un document
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
              onClick={() => setPdfPreview({
                url: `/api/admin/employees/${admin.id}/dossier/pdf`,
                title: `Dossier employé · ${employeeLabel}`,
                description: admin.position?.name || admin.title || undefined,
                filename: `dossier-${admin.id}.pdf`,
              })}
            >
              <FileDown className="h-4 w-4 mr-1.5" />
              Apercu PDF
            </Button>
          </div>
        </div>
      </Card>

      <RequestDocumentUploadDialog
        open={docRequestOpen}
        presetEmployeeId={admin.id}
        onClose={() => setDocRequestOpen(false)}
        onCreated={() => router.refresh()}
        availableEmployees={[
          {
            id: admin.id,
            fullName: admin.fullName,
            email: admin.email,
            team: admin.team ? { id: admin.team.id, name: admin.team.name } : null,
          },
        ]}
      />

      <Tabs defaultValue="identity" className="w-full">
        <TabsList className="flex flex-wrap h-auto justify-start gap-1">
          <TabsTrigger value="identity"><User className="h-3.5 w-3.5 mr-1.5" />Identite</TabsTrigger>
          <TabsTrigger value="notes"><FileText className="h-3.5 w-3.5 mr-1.5" />Notes ({notes.length})</TabsTrigger>
          <TabsTrigger value="reviews"><Award className="h-3.5 w-3.5 mr-1.5" />Evaluations ({reviews.length})</TabsTrigger>
          <TabsTrigger value="contracts"><FilePen className="h-3.5 w-3.5 mr-1.5" />Contrats ({contracts.length})</TabsTrigger>
          <TabsTrigger value="documents"><FolderClosed className="h-3.5 w-3.5 mr-1.5" />Documents ({files.length})</TabsTrigger>
          <TabsTrigger value="leaves"><Calendar className="h-3.5 w-3.5 mr-1.5" />Conges ({leaves.length})</TabsTrigger>
          <TabsTrigger value="equipment"><Package className="h-3.5 w-3.5 mr-1.5" />Equipement ({equipment.length})</TabsTrigger>
          <TabsTrigger value="learning"><GraduationCap className="h-3.5 w-3.5 mr-1.5" />Permis et Formations</TabsTrigger>
          <TabsTrigger value="payroll"><Banknote className="h-3.5 w-3.5 mr-1.5" />Paie</TabsTrigger>
          <TabsTrigger value="cnesst"><AlertTriangle className="h-3.5 w-3.5 mr-1.5" />CNESST ({cnesst.length})</TabsTrigger>
        </TabsList>

        {/* ── Identite ───────────────────────────────────── */}
        <TabsContent value="identity" className="mt-4 space-y-4">
          <Card className="p-5">
            <FormSection icon={User} title="Identite et emploi">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoRow icon={Mail} label="Courriel" value={admin.email} />
                <InfoRow icon={Phone} label="Telephone" value={admin.phone || "—"} />
                <InfoRow icon={Briefcase} label="Poste" value={admin.position?.name || admin.title || "—"} />
                <InfoRow icon={Building2} label="Departement" value={admin.department || "—"} />
                <InfoRow icon={Crown} label="Role" value={admin.customRole?.name || "—"} />
                <InfoRow icon={Building2} label="Equipe" value={admin.team?.name || "—"} />
                <InfoRow icon={User} label="Manager" value={admin.manager ? (admin.manager.fullName || admin.manager.email) : "—"} />
                <InfoRow icon={Calendar} label="Date d'embauche" value={fmtDate(admin.startDate)} />
                <InfoRow icon={Calendar} label="Anciennete" value={seniorityLabel(admin.startDate)} />
                <InfoRow icon={Calendar} label="Date de fin" value={fmtDate(admin.endDate)} />
                <InfoRow icon={Calendar} label="Naissance" value={fmtDate(admin.birthdate)} />
                <InfoRow icon={User} label="Civilité" value={admin.civility || "—"} />
                <InfoRow icon={User} label="Genre" value={genderLabel(admin.gender)} />
                {admin.preferredPronouns && (
                  <InfoRow icon={User} label="Pronoms" value={admin.preferredPronouns} />
                )}
              </div>
            </FormSection>
          </Card>

          {(emergencyContacts.length > 0 || family.length > 0 || bank) && (
            <Card className="p-5">
              <FormSection icon={Heart} title="Coordonnees et famille">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Contacts d&apos;urgence</p>
                    {emergencyContacts.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Aucun contact</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {emergencyContacts.map((c) => (
                          <li key={c.id} className="text-sm">
                            <span className="font-medium">{c.name}</span>
                            <span className="text-muted-foreground"> · {c.relationship} · {c.phone}</span>
                            {c.isPrimary && <Badge variant="outline" className="ml-2 text-[10px]">Principal</Badge>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Famille a charge</p>
                    {family.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Aucun dependant</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {family.map((f) => (
                          <li key={f.id} className="text-sm">
                            <span className="font-medium">{f.fullName}</span>
                            <span className="text-muted-foreground"> · {f.type}</span>
                            {f.isInsured && <Badge variant="outline" className="ml-1 text-[10px]">Assure</Badge>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {bank && (
                    <div className="md:col-span-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Depot direct</p>
                      <p className="text-sm">
                        {bank.institutionLabel || "—"}
                        {bank.accountLast4 ? ` · Compte ****${bank.accountLast4}` : ""}
                        {bank.verifiedAt ? <Badge variant="outline" className="ml-2 text-[10px] text-emerald-700 border-emerald-300">Verifie</Badge> : <Badge variant="outline" className="ml-2 text-[10px] text-amber-700 border-amber-300">Non verifie</Badge>}
                      </p>
                    </div>
                  )}
                </div>
              </FormSection>
            </Card>
          )}
        </TabsContent>

        {/* ── Notes ────────────────────────────────────────── */}
        <TabsContent value="notes" className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {notes.length} note{notes.length > 1 ? "s" : ""} dans le dossier
            </p>
            <Button size="sm" onClick={() => setNoteDialog({ open: true, note: null })}>
              <Plus className="h-4 w-4 mr-1.5" />
              Ajouter une note
            </Button>
          </div>

          {notesOrdered.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Aucune note dans ce dossier.
            </Card>
          ) : (
            <div className="space-y-2">
              {notesOrdered.map((n) => {
                const Icon = CATEGORY_ICON[n.category] || FileText;
                const canEdit = n.authorId === actorId || isSuper;
                return (
                  <Card key={n.id} className="p-4">
                    <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={CATEGORY_COLOR[n.category] || CATEGORY_COLOR.general}>
                          <Icon className="h-3 w-3 mr-1" />
                          {CATEGORY_LABEL[n.category] || n.category}
                        </Badge>
                        {n.severity && n.category === "discipline" && (
                          <Badge className={SEVERITY_COLOR[n.severity] || ""}>
                            {SEVERITY_LABEL[n.severity] || n.severity}
                          </Badge>
                        )}
                        {n.isConfidential && (
                          <Badge variant="outline" className="text-[10px] text-violet-700 border-violet-300 bg-violet-50">
                            Confidentiel
                          </Badge>
                        )}
                        {n.acknowledgedAt && (
                          <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50">
                            Lu le {fmtDateShort(n.acknowledgedAt)}
                          </Badge>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setNoteDialog({ open: true, note: n })} aria-label={tc("edit")}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          {isSuper && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setConfirmDel(n)} aria-label={tc("delete")}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm mb-1">{n.title}</h3>
                    <div className="text-sm whitespace-pre-wrap text-foreground/90">{n.body}</div>
                    <div className="mt-2 pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground gap-2 flex-wrap">
                      <span>Par <span className="font-medium">{n.author.fullName || n.author.email}</span></span>
                      <span>
                        {n.occurredAt ? `Evenement : ${fmtDateShort(n.occurredAt)} · ` : ""}
                        Cree : {fmtDateShort(n.createdAt)}
                      </span>
                      {n.attachmentUrl && (
                        <a href={n.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-[#0F2D52] hover:underline inline-flex items-center gap-1">
                          <Download className="h-3 w-3" /> Piece jointe
                        </a>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Evaluations ──────────────────────────────────── */}
        <TabsContent value="reviews" className="mt-4">
          <Card className="p-5">
            <FormSection icon={Award} title="Evaluations de performance">
              {reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Aucune evaluation</p>
              ) : (
                <ul className="divide-y">
                  {reviews.map((r) => (
                    <li key={r.id} className="py-2 flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-sm font-medium">
                          {fmtDateShort(r.periodStart)} → {fmtDateShort(r.periodEnd)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Reviewer : {r.reviewer.fullName || r.reviewer.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.rating != null && (
                          <Badge variant="outline" className="text-sm font-bold">
                            {r.rating} / 5
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/employes/evaluations/${r.id}`}>Ouvrir</Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </FormSection>
          </Card>
        </TabsContent>

        {/* ── Contrats ─────────────────────────────────────── */}
        <TabsContent value="contracts" className="mt-4">
          <Card className="p-5">
            <FormSection icon={FilePen} title="Historique des contrats">
              {contracts.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Aucun contrat</p>
              ) : (
                <ul className="divide-y">
                  {contracts.map((c) => (
                    <li key={c.id} className="py-2 flex items-center justify-between gap-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{c.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.contractType.toUpperCase()} · Debut {fmtDateShort(c.startDate)}
                          {c.endDate ? ` → ${fmtDateShort(c.endDate)}` : ""}
                          {c.salaryAnnual ? ` · ${fmtMoney(c.salaryAnnual)} / an` : c.hourlyRate ? ` · ${fmtMoney(c.hourlyRate)} / h` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                        <Button variant="ghost" size="sm" onClick={() => setPdfPreview({
                          url: `/api/admin/contracts/${c.id}/pdf`,
                          title: c.title,
                          description: `${employeeLabel} · ${c.contractType.toUpperCase()}`,
                          filename: `contrat-${c.id}.pdf`,
                        })}>
                          <FileText className="h-3.5 w-3.5 mr-1" />
                          Apercu PDF
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </FormSection>
          </Card>
        </TabsContent>

        {/* ── Documents ────────────────────────────────────── */}
        <TabsContent value="documents" className="mt-4">
          <Card className="p-5">
            <FormSection icon={FolderClosed} title="Documents employe">
              {files.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Aucun document</p>
              ) : (
                <ul className="divide-y">
                  {files.map((f) => (
                    <li key={f.id} className="py-2 flex items-center justify-between gap-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{f.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {f.category} · {fmtDateShort(f.createdAt)}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={f.fileUrl} target="_blank" rel="noopener noreferrer">
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Ouvrir
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </FormSection>
          </Card>
        </TabsContent>

        {/* ── Conges ───────────────────────────────────────── */}
        <TabsContent value="leaves" className="mt-4">
          <Card className="p-5">
            <FormSection icon={Calendar} title="Historique des conges">
              {leaves.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Aucun conge</p>
              ) : (
                <ul className="divide-y">
                  {leaves.map((l) => (
                    <li key={l.id} className="py-2 flex items-center justify-between gap-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {l.type} · {Number(l.daysCount).toFixed(1)} j
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDateShort(l.startDate)} → {fmtDateShort(l.endDate)}
                          {l.reason ? ` · ${l.reason}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{l.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </FormSection>
          </Card>
        </TabsContent>

        {/* ── Equipement ───────────────────────────────────── */}
        <TabsContent value="equipment" className="mt-4">
          <Card className="p-5">
            <FormSection icon={Package} title="Equipement actif">
              {equipment.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Aucun equipement assigne</p>
              ) : (
                <ul className="divide-y">
                  {equipment.map((e) => (
                    <li key={e.id} className="py-2 flex items-center justify-between gap-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{e.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.category}
                          {e.brand || e.model ? ` · ${[e.brand, e.model].filter(Boolean).join(" ")}` : ""}
                          {e.serialNumber ? ` · S/N ${e.serialNumber}` : ""}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">Depuis {fmtDateShort(e.assignedAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </FormSection>
          </Card>
        </TabsContent>

        {/* ── Permis & Formations ──────────────────────────── */}
        <TabsContent value="learning" className="mt-4 space-y-4">
          <Card className="p-5">
            <FormSection icon={ClipboardList} title="Permis professionnels">
              {licenses.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Aucun permis</p>
              ) : (
                <ul className="divide-y">
                  {licenses.map((l) => (
                    <li key={l.id} className="py-2 flex items-center justify-between gap-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{l.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.issuer || "—"}{l.number ? ` · #${l.number}` : ""}
                          {l.expiresAt ? ` · Expire ${fmtDateShort(l.expiresAt)}` : ""}
                        </p>
                      </div>
                      {l.fileUrl && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={l.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="h-3.5 w-3.5 mr-1" />PDF</a>
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </FormSection>
          </Card>
          <Card className="p-5">
            <FormSection icon={GraduationCap} title="Formations">
              {trainings.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Aucune formation</p>
              ) : (
                <ul className="divide-y">
                  {trainings.map((t) => (
                    <li key={t.id} className="py-2 flex items-center justify-between gap-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {t.title}
                          {t.isMandatory && <Badge variant="outline" className="ml-2 text-[10px] text-red-700 border-red-300">{tc("required")}</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.category} · {t.provider || "—"}
                          {t.completedAt ? ` · Termine ${fmtDateShort(t.completedAt)}` : ""}
                          {t.expiresAt ? ` · Expire ${fmtDateShort(t.expiresAt)}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </FormSection>
          </Card>
        </TabsContent>

        {/* ── Paie ──────────────────────────────────────────── */}
        <TabsContent value="payroll" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Bulletins emis</p>
              <p className="text-2xl font-bold mt-1 text-[#0F2D52]">{payAgg.count}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total brut</p>
              <p className="text-2xl font-bold mt-1 text-[#0F2D52]">{fmtMoney(payAgg.grossPay)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total net</p>
              <p className="text-2xl font-bold mt-1 text-emerald-700">{fmtMoney(payAgg.netPay)}</p>
            </Card>
          </div>
        </TabsContent>

        {/* ── CNESST ────────────────────────────────────────── */}
        <TabsContent value="cnesst" className="mt-4">
          <Card className="p-5">
            <FormSection icon={AlertTriangle} title="Incidents CNESST">
              {cnesst.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Aucun incident declare</p>
              ) : (
                <ul className="divide-y">
                  {cnesst.map((c) => (
                    <li key={c.id} className="py-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-medium">{fmtDate(c.incidentDate)} · {c.location}</p>
                        <div className="flex items-center gap-2">
                          {c.daysAbsent != null && (
                            <Badge variant="outline" className="text-[10px]">{c.daysAbsent} j absent</Badge>
                          )}
                          <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                        </div>
                      </div>
                      {c.injuryType && <p className="text-xs text-muted-foreground mt-0.5">Type : {c.injuryType}</p>}
                      <p className="text-sm mt-1 whitespace-pre-wrap text-foreground/90">{c.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </FormSection>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <EmployeeNoteDialog
        open={noteDialog.open}
        note={noteDialog.note}
        adminId={admin.id}
        onClose={() => setNoteDialog({ open: false, note: null })}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(o) => !o && setConfirmDel(null)}
        title={`Supprimer la note "${confirmDel?.title}" ?`}
        description="Cette action est irreversible et reservee aux super_admin."
        confirmLabel={tc("delete")}
        variant="destructive"
        onConfirm={onDeleteNote}
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

// ─── Helpers UI ──────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 text-[#0F2D52] mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}

// ─── Dialog Note ──────────────────────────────────────────────
function EmployeeNoteDialog({
  open, note, adminId, onClose, onSaved,
}: {
  open: boolean;
  note: Note | null;
  adminId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const tc = useTranslations("common");
  const [category, setCategory] = useState<NoteCategory>((note?.category as NoteCategory) || "general");
  const [severity, setSeverity] = useState<NoteSeverity | "">((note?.severity as NoteSeverity) || "");
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [isConfidential, setIsConfidential] = useState(note?.isConfidential ?? true);
  const [occurredAt, setOccurredAt] = useState(note?.occurredAt ? note.occurredAt.slice(0, 10) : "");
  const [attachmentUrl, setAttachmentUrl] = useState(note?.attachmentUrl ?? "");
  const [pending, setPending] = useState(false);

  // Reset a l'ouverture
  const reset = () => {
    setCategory((note?.category as NoteCategory) || "general");
    setSeverity((note?.severity as NoteSeverity) || "");
    setTitle(note?.title ?? "");
    setBody(note?.body ?? "");
    setIsConfidential(note?.isConfidential ?? true);
    setOccurredAt(note?.occurredAt ? note.occurredAt.slice(0, 10) : "");
    setAttachmentUrl(note?.attachmentUrl ?? "");
  };

  const submit = async () => {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    if (!body.trim()) { toast.error("Corps requis"); return; }
    setPending(true);
    const payload = {
      category,
      severity: category === "discipline" && severity ? severity : null,
      title: title.trim(),
      body: body.trim(),
      isConfidential,
      occurredAt: occurredAt || null,
      attachmentUrl: attachmentUrl.trim() || null,
    };
    const r = note
      ? await updateEmployeeNoteAction({ id: note.id, ...payload })
      : await createEmployeeNoteAction({ adminId, ...payload });
    setPending(false);
    if (r.success) {
      toast.success(note ? "Note modifiee" : "Note ajoutee");
      onSaved();
      onClose();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); else reset(); }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {note ? "Modifier la note" : "Nouvelle note au dossier"}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Documentez un evenement, un avis disciplinaire, une felicitation ou une observation.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto">
          <FormSection icon={FileText} title="Contenu">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Categorie" required>
                <Select value={category} onValueChange={(v) => setCategory(v as NoteCategory)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CATEGORY_LABEL) as NoteCategory[]).map((c) => (
                      <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {category === "discipline" && (
                <Field label="Severite" required>
                  <Select value={severity || "info"} onValueChange={(v) => setSeverity(v as NoteSeverity)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selectionner" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warning">Avertissement</SelectItem>
                      <SelectItem value="critical">Critique</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </div>

            <Field label="Titre" required>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex : Avis disciplinaire — retards repetes" />
            </Field>

            <Field label="Corps" required hint="Markdown supporte">
              <MarkdownEditor value={body} onChange={setBody} rows={8} placeholder="Decrivez l'evenement, le contexte, les mesures prises..." />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Date de l'evenement">
                <Input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
              </Field>
              <Field label="URL piece jointe">
                <Input value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} placeholder="https://..." />
              </Field>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <Checkbox checked={isConfidential} onCheckedChange={(v) => setIsConfidential(v === true)} />
              <span className="text-sm">Confidentiel (RH + manager + super_admin uniquement)</span>
            </label>
          </FormSection>
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>{tc("cancel")}</Button>
          <Button onClick={submit} disabled={pending || !title.trim() || !body.trim()}>
            {pending ? "..." : note ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
