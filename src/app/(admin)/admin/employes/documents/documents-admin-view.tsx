"use client";
// =============================================================
// DocumentsAdminView - hub admin centralise pour les documents
// employes : templates legaux, conformite, demandes de signature,
// dossiers personnels.
//
// Reutilise les composants partages :
//   DocumentStatsCard, DocumentCard, DocumentConformityTable,
//   SignaturePadDialog, SignatureRequestDialog, PdfPreviewModal,
//   PersonalDocCard.
// =============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDateLocale } from "@/lib/i18n-format";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  FileSignature,
  ShieldCheck,
  ClipboardList,
  AlertTriangle,
  BellRing,
  XCircle,
  CalendarClock,
  Users,
  Eye,
  Send,
  FolderOpen,
  Mail,
  Loader2,
  Sparkles,
  Upload,
  Inbox,
  CheckCircle2,
  BookOpen,
  Library,
} from "lucide-react";
import Link from "next/link";
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
import { cn } from "@/lib/utils";
import { DocumentStatsCard } from "@/components/admin/document-stats-card";
import { DocumentCard } from "@/components/admin/document-card";
import { DocumentConformityTable } from "@/components/admin/document-conformity-table";
import {
  SignatureRequestDialog,
  type SignatureRequestTemplate,
} from "@/components/admin/signature-request-dialog";
import { TemplateFieldsDialog } from "@/components/admin/template-fields-dialog";
import { StartDraftDialog } from "@/components/admin/start-draft-dialog";
import { DocumentDraftEditor } from "@/components/admin/document-draft-editor";
import { SignaturePad } from "@/app/(admin)/admin/employes/contrats/signature-pad";
import { detectPlaceholders } from "@/lib/document-templates/placeholder-detector";
import { isLongFormTemplate } from "@/lib/document-templates/fill-field-parser";
import { PdfPreviewModal } from "@/components/admin/pdf-preview-modal";
import {
  PersonalDocCard,
  type PersonalDocCardData,
  type PersonalDocCategory,
} from "@/components/admin/personal-doc-card";
import { TemplateWizard } from "@/components/admin/template-wizard";
import { TemplatePdfPreviewButton } from "@/components/admin/template-pdf-preview-button";
import { PickEmployeeForPreviewDialog } from "@/components/admin/pick-employee-for-preview-dialog";
import {
  upsertLegalDocAction,
  deleteLegalDocAction,
  regenerateSignedPdfAction,
  employerSignLegalDocAction,
} from "@/app/actions/hr-legal-docs";
import {
  cancelSignatureRequestAction,
  remindSignatureRequestAction,
  createSignatureRequestAction,
} from "@/app/actions/hr-signature-requests";
import { verifyPersonalDocAction } from "@/app/actions/hr-personal-docs";
import {
  cancelUploadRequestAction,
  remindUploadRequestAction,
} from "@/app/actions/hr-document-requests";
import {
  RequestDocumentUploadDialog,
} from "@/components/admin/request-document-upload-dialog";
import {
  ReviewUploadRequestDialog,
  type ReviewableRequest,
} from "@/components/admin/review-upload-request-dialog";

// ---------- Types -----------------------------------------------
type Template = {
  id: number;
  key: string;
  title: string;
  category: string;
  version: string;
  bodyMarkdown: string;
  isRequired: boolean;
  targetPositions?: string[];
  targetDepartments?: string[];
  signatureScope?: "employee_only" | "employer_only" | "both" | "none";
  acknowledgmentMode?: "reading_only" | "signature";
  _count: { signatures: number };
};
type Signature = {
  id: number;
  adminId: number;
  templateId: number;
  version: string;
  signedAt: string;
  finalPdfUrl: string | null;
  signatureData: string | null;
  /** Contresignature employeur (null tant que le RH n'a pas contresigné).
   *  Optionnel : absent si le client Prisma n'est pas encore régénéré. */
  employerSignedAt?: string | null;
};
type Employee = {
  id: number;
  fullName: string | null;
  email: string;
  team: { id: number; name: string } | null;
};
type TeamLite = { id: number; name: string };
type PendingRequest = {
  id: number;
  templateId: number;
  template: { id: number; title: string; key: string; version: string; isRequired: boolean };
  requestedAt: string;
  requestedBy: { id: number; fullName: string | null; email: string };
  dueDate: string | null;
  reason: string | null;
  status: string;
  targetAdminId: number | null;
  targetAdmin: { id: number; fullName: string | null; email: string } | null;
  targetTeamId: number | null;
  targetAll: boolean;
};
type ExpiringDoc = {
  id: number;
  adminId: number;
  category: string;
  title: string;
  expiresAt: string;
  isVerified: boolean;
  isPrivate: boolean;
  admin: { id: number; fullName: string | null; email: string };
};

type UploadRequestAdmin = {
  id: number;
  title: string;
  description: string | null;
  category: string;
  isRequired: boolean;
  dueDate: string | null;
  status: string;
  uploadedAt: string | null;
  fileName: string | null;
  fileMimeType: string | null;
  fileSize: number | null;
  createdAt: string;
  targetAdmin: { id: number; fullName: string | null; email: string };
  requestedBy: { id: number; fullName: string | null; email: string };
};

// Mission 1 : cahier minimal pour conformite + filtres + KPIs.
type HandbookLite = {
  id: number;
  key: string;
  title: string;
  version: string;
  isActive: boolean;
  isRequired: boolean;
  items: Array<{ templateId: number; orderIndex: number }>;
};

type HandbookSignatureLite = {
  id: number;
  handbookId: number;
  adminId: number;
  version: string;
  signedAt: string;
  finalPdfUrl: string | null;
};

type TabKey =
  | "overview"
  | "templates"
  | "conformity"
  | "requests"
  | "uploads"
  | "signatures"
  | "employees";

// ---------- Helpers ---------------------------------------------
function formatDate(iso: string | null | undefined, tag: string): string {
  // Retour "—" (em dash) au lieu de "-" pour distinguer date manquante du
  // tiret-separateur. Plus lisible quand affiche seul dans une cellule.
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / 86400000);
}

const CATEGORY_KEYS: Record<string, string> = {
  policy: "politique",
  nda: "nda",
  acknowledgment: "accuse_reception",
};

// ================================================================
//                       MAIN VIEW
// ================================================================
export function DocumentsAdminView({
  templates,
  allSignatures,
  employees,
  teams,
  pendingRequests,
  completedRequests = [],
  expiringDocs,
  uploadRequests,
  handbooks = [],
  handbookSignatures = [],
  templateIdsInActiveHandbooks = [],
  isSuper,
}: {
  templates: Template[];
  allSignatures: Signature[];
  employees: Employee[];
  teams: TeamLite[];
  pendingRequests: PendingRequest[];
  completedRequests?: PendingRequest[];
  expiringDocs: ExpiringDoc[];
  uploadRequests: UploadRequestAdmin[];
  handbooks?: HandbookLite[];
  handbookSignatures?: HandbookSignatureLite[];
  templateIdsInActiveHandbooks?: number[];
  isSuper: boolean;
}) {
  const t = useTranslations("admin.hr_documents");
  const tc = useTranslations("common");
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("overview");

  // --- Modals state -------------------------------------------
  const [editDialog, setEditDialog] = useState<{ open: boolean; existing: Template | null }>({
    open: false,
    existing: null,
  });
  const [confirmDel, setConfirmDel] = useState<Template | null>(null);
  // Picker pour choisir un employe test avant de generer l'apercu PDF du template
  const [templatePreviewPicker, setTemplatePreviewPicker] = useState<Template | null>(null);
  const [templatePreviewCtx, setTemplatePreviewCtx] = useState<{
    template: Template;
    employeeId: number;
    nonce: number;
  } | null>(null);
  // Apercu PDF d'une demande de signature (template + employe cible deja connu)
  const [requestPreviewCtx, setRequestPreviewCtx] = useState<{
    template: Template;
    employeeId: number;
    nonce: number;
  } | null>(null);
  const [requestDialog, setRequestDialog] = useState<{
    open: boolean;
    template: SignatureRequestTemplate | null;
    customFieldValues: Record<string, string> | null;
  }>({ open: false, template: null, customFieldValues: null });
  // Dialog "Completer les champs" — affiche avant la creation de la demande
  // si le template contient des `[CHAMP]` libres a remplir.
  const [fieldsDialog, setFieldsDialog] = useState<{
    open: boolean;
    template: Template | null;
  }>({ open: false, template: null });
  // Dialog "Demarrer un brouillon" — pour les templates long-form qui passent
  // par le workflow Brouillon -> Editeur -> Envoyer-signature (pas inline).
  const [startDraftDialog, setStartDraftDialog] = useState<{
    open: boolean;
    template: Template | null;
  }>({ open: false, template: null });
  // ID du brouillon ouvert dans l'editeur plein ecran
  const [editorDraftId, setEditorDraftId] = useState<number | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<PendingRequest | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Upload requests (workflow demande/upload)
  const [uploadRequestDialog, setUploadRequestDialog] = useState<{
    open: boolean;
    presetEmployeeId: number | null;
  }>({ open: false, presetEmployeeId: null });
  const [reviewDialog, setReviewDialog] = useState<ReviewableRequest | null>(null);
  const [confirmCancelUpload, setConfirmCancelUpload] = useState<UploadRequestAdmin | null>(null);

  // --- Sticky bar detection (pattern Finance) -----------------------
  // rootMargin -64px top compense le topbar sticky (h-[64px], z-30) : le
  // sentinel est considere "out" des qu'il passe SOUS le topbar, pas
  // seulement hors viewport. Sans ca, la barre apparait trop tard.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-64px 0px 0px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // --- Portal target pour KPIs dans la module-nav mobile -----------
  // Le slot #vnk-module-nav-extra est defini dans module-sidebar-nav.tsx.
  // On porte les KPIs (Conformite / En attente / Expirations) dedans quand
  // scrolled, sur la MEME ligne que "Employes" → une seule bande compacte.
  const [navExtraEl, setNavExtraEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setNavExtraEl(document.getElementById("vnk-module-nav-extra"));
  }, []);

  // Mission 1 : Set des templates inclus dans un cahier actif (filtre Tab
  // Templates + Conformite).
  const templatesInHandbooksSet = useMemo(
    () => new Set<number>(templateIdsInActiveHandbooks),
    [templateIdsInActiveHandbooks],
  );

  // Templates STANDALONE (= non inclus dans un cahier actif).
  const standaloneTemplates = useMemo(
    () => templates.filter((t) => !templatesInHandbooksSet.has(t.id)),
    [templates, templatesInHandbooksSet],
  );

  // --- KPI computations ---------------------------------------
  // Mission 1 : Conformite calcule chaque cahier obligatoire comme 1 item
  // (et non N templates). Templates obligatoires standalone restent
  // comptabilises individuellement.
  const kpis = useMemo(() => {
    const requiredStandaloneTemplates = standaloneTemplates.filter((t) => t.isRequired);
    const requiredHandbooks = handbooks.filter((h) => h.isActive && h.isRequired);

    const totalRequiredItems =
      (requiredStandaloneTemplates.length + requiredHandbooks.length)
      * employees.length;

    let signedCurrent = 0;
    for (const t of requiredStandaloneTemplates) {
      for (const e of employees) {
        const sig = allSignatures.find(
          (s) => s.templateId === t.id && s.adminId === e.id && s.version === t.version
        );
        if (sig) signedCurrent += 1;
      }
    }
    for (const h of requiredHandbooks) {
      for (const e of employees) {
        const sig = handbookSignatures.find(
          (s) => s.handbookId === h.id && s.adminId === e.id && s.version === h.version,
        );
        if (sig) signedCurrent += 1;
      }
    }

    const conformity =
      totalRequiredItems > 0
        ? Math.round((signedCurrent / totalRequiredItems) * 100)
        : 100;
    const expiringSoon = expiringDocs.length;
    const expiredCount = expiringDocs.filter((d) => {
      const days = daysUntil(d.expiresAt);
      return days !== null && days < 0;
    }).length;
    const uploadsToReview = uploadRequests.filter((r) => r.status === "uploaded").length;
    const uploadsPending = uploadRequests.filter((r) => r.status === "pending").length;
    return {
      templates: templates.length,
      templatesStandalone: standaloneTemplates.length,
      templatesInHandbooks: templates.length - standaloneTemplates.length,
      handbooks: handbooks.length,
      conformity,
      pendingRequests: pendingRequests.length,
      completedRequests: completedRequests.length,
      expiringSoon,
      expiredCount,
      employees: employees.length,
      uploadsToReview,
      uploadsPending,
    };
  }, [
    templates,
    standaloneTemplates,
    handbooks,
    handbookSignatures,
    employees,
    allSignatures,
    pendingRequests,
    completedRequests,
    expiringDocs,
    uploadRequests,
  ]);

  const TABS: TabItem<TabKey>[] = [
    { key: "overview", label: t("vue_ensemble"), icon: Sparkles },
    { key: "templates", label: t("templates"), icon: FileText, count: templates.length },
    { key: "conformity", label: t("conformite_2"), icon: ShieldCheck },
    {
      key: "requests",
      label: t("demandes_signature"),
      icon: ClipboardList,
      count: pendingRequests.length,
      dot: pendingRequests.length > 0,
    },
    {
      key: "uploads",
      label: t("demandes_upload"),
      icon: Upload,
      count: uploadRequests.length,
      dot: kpis.uploadsToReview > 0,
    },
    {
      key: "signatures",
      label: t("signatures"),
      icon: FileSignature,
      count: allSignatures.length,
    },
    { key: "employees", label: t("dossiers_employes"), icon: FolderOpen, count: employees.length },
  ];

  // --- Conformity callbacks (used by table & overview) -------
  // Guard anti-double-clic : prevent un meme couple template+employes d'etre
  // envoye 2 fois si l'user clique rapidement. La clef est templateId +
  // employeeIds tries (insensible a l'ordre).
  const pendingRequestKeysRef = useRef<Set<string>>(new Set());
  const handleRequest = useCallback(
    async (templateId: number, employeeIds: number[]) => {
      const key = `${templateId}:${[...employeeIds].sort().join(",")}`;
      if (pendingRequestKeysRef.current.has(key)) {
        // Deja en cours, ignore le double-clic
        return;
      }
      pendingRequestKeysRef.current.add(key);
      try {
        const r = await createSignatureRequestAction({
          templateId,
          targets: { adminIds: employeeIds },
          dueDate: null,
          reason: null,
        });
        if (r.success) {
          toast.success(
            `${r.data.createdCount} demande${r.data.createdCount > 1 ? "s" : ""} creee${
              r.data.createdCount > 1 ? "s" : ""
            }` + (r.data.skipped > 0 ? ` - ${r.data.skipped} ignoree${r.data.skipped > 1 ? "s" : ""}` : "")
          );
          router.refresh();
        } else {
          toast.error(r.error || "");
        }
      } finally {
        pendingRequestKeysRef.current.delete(key);
      }
    },
    [router]
  );

  // Ouvre le flux "demande de signature" : si le template contient des
  // `[CHAMP]` libres, on passe d'abord par TemplateFieldsDialog. Sinon, on
  // ouvre directement SignatureRequestDialog.
  const startRequestFlowForTemplate = useCallback(
    (tpl: Template | null) => {
      if (!tpl) {
        setRequestDialog({ open: true, template: null, customFieldValues: null });
        return;
      }
      const fields = detectPlaceholders(tpl.bodyMarkdown);
      const isLongForm = isLongFormTemplate(tpl.bodyMarkdown);
      // Long-form -> ouvre StartDraftDialog (selection employe), puis
      // l'editeur 2 colonnes plein ecran avec autosave.
      // Court avec [CHAMP] -> TemplateFieldsDialog inline puis demande direct.
      // Aucun champ -> dialog demande direct (rien a remplir).
      if (isLongForm) {
        setStartDraftDialog({ open: true, template: tpl });
      } else if (fields.length > 0) {
        setFieldsDialog({ open: true, template: tpl });
      } else {
        setRequestDialog({
          open: true,
          template: {
            id: tpl.id,
            title: tpl.title,
            version: tpl.version,
            bodyMarkdown: tpl.bodyMarkdown,
            acknowledgmentMode: tpl.acknowledgmentMode ?? "reading_only",
          },
          customFieldValues: null,
        });
      }
    },
    [],
  );

  const handleRemindByTemplate = useCallback(
    async (templateId: number, employeeId: number) => {
      // On cherche une demande pending individuelle existante, sinon on en cree une
      const req = pendingRequests.find(
        (p) => p.templateId === templateId && p.targetAdminId === employeeId
      );
      if (req) {
        const r = await remindSignatureRequestAction({ id: req.id });
        if (r.success) {
          toast.success(`Rappel envoye (${r.data.notified} destinataire${r.data.notified > 1 ? "s" : ""})`);
          router.refresh();
        } else {
          toast.error(r.error || "");
        }
      } else {
        await handleRequest(templateId, [employeeId]);
      }
    },
    [pendingRequests, handleRequest, router]
  );

  return (
    <div className="space-y-4">
      {/* ====== Header navy gradient ======
          Responsive : title row + actions row, actions wrappent en grille
          2 colonnes sur mobile (lisible), passent en ligne horizontale a sm+. */}
      <div className="rounded-xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-4 sm:px-5 py-4 text-white relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32"
          aria-hidden
        />
        <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center ring-2 ring-white/20 shrink-0">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold leading-tight">{t("gestion_documents")}</h1>
              <p className="text-[11px] sm:text-xs text-white/80 leading-snug">
                {t("templates_legaux_conformite_signatures_dossiers")}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-2 sm:flex-wrap">
            <Button
              size="sm"
              variant="outline"
              asChild
              className="h-8 text-[11px] sm:text-xs bg-white/15 text-white border-white/30 hover:bg-white/25 hover:text-white justify-start sm:justify-center"
            >
              <Link href="/admin/employes/documents/bibliotheque">
                <Library className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                <span className="truncate">{t("bibliotheque")}</span>
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              asChild
              className="h-8 text-[11px] sm:text-xs bg-white/15 text-white border-white/30 hover:bg-white/25 hover:text-white justify-start sm:justify-center"
            >
              <Link href="/admin/employes/documents/cahiers">
                <BookOpen className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                <span className="truncate">Cahiers ({handbooks.length})</span>
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setUploadRequestDialog({ open: true, presetEmployeeId: null })}
              className="h-8 text-[11px] sm:text-xs bg-white/15 text-white border-white/30 hover:bg-white/25 hover:text-white justify-start sm:justify-center"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              <span className="truncate">{t("demander_doc")}</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRequestDialog({ open: true, template: null, customFieldValues: null })}
              className="h-8 text-[11px] sm:text-xs bg-white/15 text-white border-white/30 hover:bg-white/25 hover:text-white justify-start sm:justify-center"
            >
              <Send className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              <span className="truncate">{t("demande_signature")}</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setEditDialog({ open: true, existing: null })}
              className="h-8 text-[11px] sm:text-xs bg-white text-[#0F2D52] hover:bg-white/90 font-semibold col-span-2 sm:col-span-1 justify-center"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              <span className="truncate">{t("nouveau_template")}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ====== KPIs ====== */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <DocumentStatsCard
          label={t("templates_actifs")}
          value={kpis.templates}
          icon={FileText}
          accent="info"
          hint={tc("employees_concerned", { count: employees.length })}
        />
        <DocumentStatsCard
          label={t("conformite_globale")}
          value={`${kpis.conformity}%`}
          icon={ShieldCheck}
          accent={kpis.conformity >= 90 ? "success" : kpis.conformity >= 60 ? "warning" : "danger"}
          hint={t("signatures_jour_documents_obligatoires")}
          onClick={() => setTab("conformity")}
        />
        <DocumentStatsCard
          label={t("demandes_attente")}
          value={kpis.pendingRequests}
          icon={ClipboardList}
          accent={kpis.pendingRequests > 0 ? "warning" : "info"}
          hint={t("signatures_ciblees_relancer")}
          onClick={() => setTab("requests")}
        />
        <DocumentStatsCard
          label={t("docs_perso_venir")}
          value={kpis.expiringSoon}
          icon={CalendarClock}
          accent={kpis.expiredCount > 0 ? "danger" : kpis.expiringSoon > 0 ? "warning" : "success"}
          hint={
            kpis.expiredCount > 0
              ? `${kpis.expiredCount} deja expire${kpis.expiredCount > 1 ? "s" : ""}`
              : t("expirations_60_jours")
          }
          onClick={() => setTab("employees")}
        />
      </div>

      {/* Sentinel : detecte la sortie des KPIs pour activer le portal KPIs */}
      <div ref={sentinelRef} aria-hidden className="h-px" />

      {/* Portal : on injecte les KPIs DANS la module-nav mobile (sur la
          meme ligne que t("employes")) au scroll. Plus de 2e bande !
          Slot cible : #vnk-module-nav-extra (defini dans module-sidebar-nav).
          Labels compacts <480px pour rentrer sur petits ecrans. */}
      {navExtraEl && scrolled
        ? createPortal(
            <div className="flex items-center gap-x-2 sm:gap-x-3 text-[11px] sm:text-xs whitespace-nowrap lg:hidden">
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">{t("conf")}</span>
                  <span className="hidden min-[480px]:inline">{t("conformite")}</span>
                </span>
                <span
                  className={
                    kpis.conformity >= 90
                      ? "font-semibold text-emerald-600"
                      : kpis.conformity >= 60
                        ? "font-semibold text-amber-600"
                        : "font-semibold text-red-600"
                  }
                >
                  {kpis.conformity}%
                </span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">{t("att")}</span>
                  <span className="hidden min-[480px]:inline">{t("attente")}</span>
                </span>
                <span className="font-semibold text-amber-600">{kpis.pendingRequests}</span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">{t("exp")}</span>
                  <span className="hidden min-[480px]:inline">{t("expirations")}</span>
                </span>
                <span
                  className={
                    kpis.expiredCount > 0
                      ? "font-semibold text-red-600"
                      : "font-semibold text-amber-600"
                  }
                >
                  {kpis.expiringSoon}
                </span>
              </span>
            </div>,
            navExtraEl,
          )
        : null}

      {/* Sticky container : tabs uniquement (KPIs mobiles deplacees vers
          la module-nav via portal ci-dessus). Sur desktop (lg+), la
          module-nav devient sidebar verticale → on garde une mini-bar
          interne pour le contexte. */}
      <div
        className={cn(
          "sticky top-[92px] pt-4 lg:top-[64px] lg:pt-0 z-20 bg-background",
          "-mx-4 sm:-mx-5 lg:mx-0 transition-shadow",
          scrolled ? "shadow-sm border-b" : "border-b border-transparent",
        )}
      >
        {/* Mini-bar info DESKTOP UNIQUEMENT (lg+).
            Mobile : KPIs portales dans la module-nav (voir au-dessus). */}
        <div
          className={cn(
            "hidden px-4 lg:px-4 items-center gap-x-5 py-2 text-xs",
            scrolled ? "lg:flex" : "lg:hidden",
          )}
        >
          <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r shrink-0">
            <FileText className="h-4 w-4" />
            {t("documents")}
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">{t("conformite")}</span>
            <span
              className={
                kpis.conformity >= 90
                  ? "font-semibold text-emerald-600"
                  : kpis.conformity >= 60
                    ? "font-semibold text-amber-600"
                    : "font-semibold text-red-600"
              }
            >
              {kpis.conformity}%
            </span>
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">{t("attente")}</span>
            <span className="font-semibold text-amber-600">{kpis.pendingRequests}</span>
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">{t("expirations")}</span>
            <span
              className={
                kpis.expiredCount > 0
                  ? "font-semibold text-red-600"
                  : "font-semibold text-amber-600"
              }
            >
              {kpis.expiringSoon}
            </span>
          </span>
        </div>

        {/* Tabs : toujours sticky */}
        <div className="px-4 sm:px-5 lg:px-4">
          <SettingsTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel={t("navigation_documents")} />
        </div>
      </div>

      {/* ====== Tab content ====== */}
      {tab === "overview" && (
        <OverviewTab
          templates={templates}
          allSignatures={allSignatures}
          employees={employees}
          pendingRequests={pendingRequests}
          expiringDocs={expiringDocs}
          onGoTemplates={() => setTab("templates")}
          onGoConformity={() => setTab("conformity")}
          onGoRequests={() => setTab("requests")}
          onGoEmployees={() => setTab("employees")}
          onNewTemplate={() => setEditDialog({ open: true, existing: null })}
          onNewRequest={() => setRequestDialog({ open: true, template: null, customFieldValues: null })}
        />
      )}

      {tab === "templates" && (
        <TemplatesTab
          templates={templates}
          templatesInHandbooks={templatesInHandbooksSet}
          handbooks={handbooks}
          onCreate={() => setEditDialog({ open: true, existing: null })}
          onEdit={(t) => setEditDialog({ open: true, existing: t })}
          onDelete={(t) => setConfirmDel(t)}
          onPreview={(t) => setTemplatePreviewPicker(t)}
          onRequest={(t) => startRequestFlowForTemplate(t)}
        />
      )}

      {tab === "conformity" && (
        <DocumentConformityTable
          templates={standaloneTemplates}
          handbooks={handbooks.filter((h) => h.isActive)}
          handbookSignatures={handbookSignatures}
          employees={employees}
          signatures={allSignatures}
          onRemind={handleRemindByTemplate}
          onRequest={handleRequest}
        />
      )}

      {tab === "requests" && (
        <RequestsTab
          requests={pendingRequests}
          completedRequests={completedRequests}
          teams={teams}
          onCancel={(r) => setConfirmCancel(r)}
          onRemind={async (r) => {
            const res = await remindSignatureRequestAction({ id: r.id });
            if (res.success) {
              toast.success(`Rappel envoye (${res.data.notified} destinataire${res.data.notified > 1 ? "s" : ""})`);
              router.refresh();
            } else {
              toast.error(res.error || "");
            }
          }}
          onPreviewPdf={(req) => {
            const tpl = templates.find((t) => t.id === req.templateId);
            if (!tpl) {
              toast.error(t("template_introuvable"));
              return;
            }
            // Si la demande cible un employe precis, on l'utilise directement.
            // Sinon (equipe ou tout le monde), on ouvre le picker.
            if (req.targetAdminId) {
              setRequestPreviewCtx({
                template: tpl,
                employeeId: req.targetAdminId,
                nonce: Date.now(),
              });
            } else {
              setTemplatePreviewPicker(tpl);
            }
          }}
          onNewRequest={() => setRequestDialog({ open: true, template: null, customFieldValues: null })}
        />
      )}

      {tab === "uploads" && (
        <UploadRequestsTab
          requests={uploadRequests}
          onNewRequest={() => setUploadRequestDialog({ open: true, presetEmployeeId: null })}
          onReview={(r) =>
            setReviewDialog({
              id: r.id,
              title: r.title,
              description: r.description,
              category: r.category,
              isRequired: r.isRequired,
              dueDate: r.dueDate,
              uploadedAt: r.uploadedAt,
              fileName: r.fileName,
              fileMimeType: r.fileMimeType,
              targetAdmin: r.targetAdmin,
            })
          }
          onCancel={(r) => setConfirmCancelUpload(r)}
          onRemind={async (r) => {
            const res = await remindUploadRequestAction(r.id);
            if (res.success) {
              toast.success(t("documents_admin_view_rappel_envoye"));
              router.refresh();
            } else {
              toast.error(res.error || "");
            }
          }}
        />
      )}

      {tab === "signatures" && (
        <SignaturesTab
          signatures={allSignatures}
          templates={templates}
          employees={employees}
        />
      )}

      {tab === "employees" && (
        <EmployeesTab
          employees={employees}
          expiringDocs={expiringDocs}
          onSelect={(emp) => setSelectedEmployee(emp)}
        />
      )}

      {/* ============== Modals ============== */}
      <TemplateWizard
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, existing: null })}
        mode={editDialog.existing ? "edit" : "create"}
        type="legal"
        initial={editDialog.existing ? {
          key: editDialog.existing.key,
          title: editDialog.existing.title,
          category: editDialog.existing.category,
          version: editDialog.existing.version,
          bodyMarkdown: editDialog.existing.bodyMarkdown,
          targetPositions: editDialog.existing.targetPositions ?? [],
          targetDepartments: editDialog.existing.targetDepartments ?? [],
          isMandatory: editDialog.existing.isRequired,
          signatureScope: editDialog.existing.signatureScope ?? "employee_only",
          acknowledgmentMode: editDialog.existing.acknowledgmentMode ?? "reading_only",
        } : undefined}
        onSave={async (data) => {
          const existing = editDialog.existing;
          const payload = {
            id: existing?.id,
            key: existing?.key ?? (data.key ?? "").trim(),
            title: data.title,
            category: ((data.category ?? "policy") as "policy" | "nda" | "acknowledgment"),
            version: data.version,
            bodyMarkdown: data.bodyMarkdown,
            isRequired: data.isMandatory ?? false,
            targetPositions: data.targetPositions,
            targetDepartments: data.targetDepartments,
            signatureScope: data.signatureScope ?? "employee_only",
            acknowledgmentMode: data.acknowledgmentMode ?? "reading_only",
          };
          if (!payload.key) {
            throw new Error(t("cle_technique_requise"));
          }
          const r = await upsertLegalDocAction(payload);
          if (!r.success) throw new Error(r.error || t("erreur"));
          toast.success(existing ? t("template_mis_jour") : t("template_cree"));
          setEditDialog({ open: false, existing: null });
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(o) => !o && setConfirmDel(null)}
        title={`Supprimer ${confirmDel?.title ?? ""} ?`}
        description={t("si_document_deja_ete_signe")}
        confirmLabel={tc("delete")}
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDel) return;
          const r = await deleteLegalDocAction({ id: confirmDel.id });
          if (r.success) {
            toast.success(t("document_supprime"));
            router.refresh();
          } else {
            toast.error(r.error || "");
          }
          setConfirmDel(null);
        }}
      />

      <ConfirmDialog
        open={!!confirmCancel}
        onOpenChange={(o) => !o && setConfirmCancel(null)}
        title={t("annuler_demande")}
        description={confirmCancel?.template.title ?? ""}
        confirmLabel={t("annuler_demande_2")}
        variant="destructive"
        onConfirm={async () => {
          if (!confirmCancel) return;
          const r = await cancelSignatureRequestAction({ id: confirmCancel.id });
          if (r.success) {
            toast.success(t("demande_annulee"));
            router.refresh();
          } else {
            toast.error(r.error || "");
          }
          setConfirmCancel(null);
        }}
      />

      {/* Picker employe test pour apercu PDF d'un template */}
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
          position: null,
          avatarUrl: null,
        }))}
        title={t("choisir_employe_apercu_template")}
        description={t("selectionnez_employe_voir_document_genere")}
      />

      {/* Auto-trigger pour template standalone (apres choix employe) */}
      {templatePreviewCtx && (
        <DocsTemplatePreviewAutoTrigger
          key={`tpl-${templatePreviewCtx.nonce}`}
          template={templatePreviewCtx.template}
          employeeId={templatePreviewCtx.employeeId}
          onDone={() => setTemplatePreviewCtx(null)}
        />
      )}

      {/* Auto-trigger pour demandes de signature (employe cible deja connu) */}
      {requestPreviewCtx && (
        <DocsTemplatePreviewAutoTrigger
          key={`req-${requestPreviewCtx.nonce}`}
          template={requestPreviewCtx.template}
          employeeId={requestPreviewCtx.employeeId}
          onDone={() => setRequestPreviewCtx(null)}
        />
      )}

      <SignatureRequestDialog
        open={requestDialog.open}
        onClose={() =>
          setRequestDialog({ open: false, template: null, customFieldValues: null })
        }
        onCreated={() => router.refresh()}
        template={requestDialog.template}
        customFieldValues={requestDialog.customFieldValues}
        availableTemplates={templates.map((t) => ({
          id: t.id,
          title: t.title,
          version: t.version,
          bodyMarkdown: t.bodyMarkdown,
          acknowledgmentMode: t.acknowledgmentMode ?? "reading_only",
        }))}
        availableTeams={teams}
        availableEmployees={employees.map((e) => ({
          id: e.id,
          fullName: e.fullName,
          email: e.email,
          team: e.team ?? null,
        }))}
      />

      {/* Dialog t("completer_champs") — ouvert AVANT SignatureRequestDialog
          quand le template contient des `[CHAMP]` libres detectes par
          detectPlaceholders(). Une fois rempli, on passe au dialog suivant
          en transmettant les valeurs via customFieldValues. */}
      <TemplateFieldsDialog
        open={fieldsDialog.open}
        templateTitle={fieldsDialog.template?.title ?? ""}
        templateId={fieldsDialog.template?.id}
        bodyMarkdown={fieldsDialog.template?.bodyMarkdown ?? ""}
        onClose={() => setFieldsDialog({ open: false, template: null })}
        onSubmit={async (vals) => {
          const tpl = fieldsDialog.template;
          if (!tpl) return;
          setFieldsDialog({ open: false, template: null });
          setRequestDialog({
            open: true,
            template: {
              id: tpl.id,
              title: tpl.title,
              version: tpl.version,
              bodyMarkdown: tpl.bodyMarkdown,
              acknowledgmentMode: tpl.acknowledgmentMode ?? "reading_only",
            },
            customFieldValues: vals,
          });
        }}
      />

      {/* Flow brouillon (templates long-form Evaluation 30/60/90, etc.) :
          1. StartDraftDialog -> selectionne employe + cree brouillon
          2. DocumentDraftEditor -> editeur 2 colonnes plein ecran avec autosave
             + bouton t("envoyer_signature") qui cree DSR + archive brouillon */}
      <StartDraftDialog
        open={startDraftDialog.open}
        templateId={startDraftDialog.template?.id ?? null}
        templateTitle={startDraftDialog.template?.title ?? ""}
        onClose={() => setStartDraftDialog({ open: false, template: null })}
        onCreated={(draftId) => {
          setStartDraftDialog({ open: false, template: null });
          setEditorDraftId(draftId);
        }}
      />
      <DocumentDraftEditor
        open={editorDraftId !== null}
        draftId={editorDraftId}
        onClose={() => setEditorDraftId(null)}
        onSent={() => router.refresh()}
      />

      {selectedEmployee && (
        <EmployeePersonalDocsDialog
          employee={selectedEmployee}
          isSuper={isSuper}
          onClose={() => setSelectedEmployee(null)}
        />
      )}

      {/* === Upload requests modals === */}
      <RequestDocumentUploadDialog
        open={uploadRequestDialog.open}
        presetEmployeeId={uploadRequestDialog.presetEmployeeId}
        onClose={() =>
          setUploadRequestDialog({ open: false, presetEmployeeId: null })
        }
        onCreated={() => router.refresh()}
        availableEmployees={employees.map((e) => ({
          id: e.id,
          fullName: e.fullName,
          email: e.email,
          team: e.team ?? null,
        }))}
      />

      <ReviewUploadRequestDialog
        open={!!reviewDialog}
        request={reviewDialog}
        onClose={() => setReviewDialog(null)}
        onReviewed={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!confirmCancelUpload}
        onOpenChange={(o) => !o && setConfirmCancelUpload(null)}
        title={t("annuler_demande")}
        description={confirmCancelUpload?.title ?? ""}
        confirmLabel={t("annuler_demande_2")}
        variant="destructive"
        onConfirm={async () => {
          if (!confirmCancelUpload) return;
          const r = await cancelUploadRequestAction(confirmCancelUpload.id);
          if (r.success) {
            toast.success(t("demande_annulee_2"));
            router.refresh();
          } else {
            toast.error(r.error || "");
          }
          setConfirmCancelUpload(null);
        }}
      />
    </div>
  );
}

// ================================================================
//                       TAB : OVERVIEW
// ================================================================
function OverviewTab({
  templates,
  allSignatures,
  employees,
  pendingRequests,
  expiringDocs,
  onGoTemplates,
  onGoConformity,
  onGoRequests,
  onGoEmployees,
  onNewTemplate,
  onNewRequest,
}: {
  templates: Template[];
  allSignatures: Signature[];
  employees: Employee[];
  pendingRequests: PendingRequest[];
  expiringDocs: ExpiringDoc[];
  onGoTemplates: () => void;
  onGoConformity: () => void;
  onGoRequests: () => void;
  onGoEmployees: () => void;
  onNewTemplate: () => void;
  onNewRequest: () => void;
}) {
  const t = useTranslations("admin.hr_documents");
  const requiredCount = templates.filter((t) => t.isRequired).length;
  const topMissing = useMemo(() => {
    // Templates ayant le plus de signatures manquantes (parmi obligatoires)
    const required = templates.filter((t) => t.isRequired);
    const rows = required.map((t) => {
      const signedIds = new Set(
        allSignatures
          .filter((s) => s.templateId === t.id && s.version === t.version)
          .map((s) => s.adminId)
      );
      const missing = employees.filter((e) => !signedIds.has(e.id)).length;
      return { template: t, missing };
    });
    return rows.sort((a, b) => b.missing - a.missing).slice(0, 5);
  }, [templates, allSignatures, employees]);

  const upcomingExpirations = expiringDocs.slice(0, 5);
  const recentRequests = pendingRequests.slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      {/* Templates */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#0F2D52]" />
            {t("templates_legaux")}
          </h3>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onGoTemplates}>
            {t("voir_tout")}
          </Button>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">{t("actifs")}</span>
            <span className="font-semibold">{templates.length}</span>
          </div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">{t("obligatoires")}</span>
            <span className="font-semibold">{requiredCount}</span>
          </div>
        </div>
        {topMissing.length > 0 && (
          <div className="pt-2 border-t space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              {t("top_relancer")}
            </p>
            {topMissing.map(({ template, missing }) => (
              <div key={template.id} className="flex items-center justify-between text-xs gap-2">
                <span className="truncate flex-1">{template.title}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    missing > 0
                      ? "text-amber-700 border-amber-300 bg-amber-50"
                      : "text-emerald-700 border-emerald-300 bg-emerald-50"
                  }`}
                >
                  {t("n_manquants", { count: missing })}
                </Badge>
              </div>
            ))}
          </div>
        )}
        <Button size="sm" className="w-full h-8 text-xs bg-[#0F2D52] hover:bg-[#1a3a66]" onClick={onNewTemplate}>
          <Plus className="h-3 w-3 mr-1" />
          {t("nouveau_template")}
        </Button>
      </Card>

      {/* Conformite */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#0F2D52]" />
            {t("conformite_2")}
          </h3>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onGoConformity}>
            {t("tableau_detaille")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("documents_admin_view_suivi_des_signatures_obligatoires_par_employe_verifiez")}</p>
        <div className="rounded-md border bg-muted/20 p-3 space-y-2">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">{t("employes_actifs")}</span>
            <span className="font-semibold">{employees.length}</span>
          </div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">{t("demandes_attente")}</span>
            <span className="font-semibold text-amber-700">{pendingRequests.length}</span>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full h-8 text-xs border-[#0F2D52]/30 text-[#0F2D52]"
          onClick={onGoConformity}
        >
          <ShieldCheck className="h-3 w-3 mr-1" />
          {t("ouvrir_tableau_conformite")}
        </Button>
      </Card>

      {/* Actions / alertes */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#0F2D52]" />
            {t("actions_rapides")}
          </h3>
        </div>
        <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={onNewRequest}>
          <Send className="h-3 w-3 mr-1" />
          {t("nouvelle_demande_signature")}
        </Button>
        {recentRequests.length > 0 && (
          <div className="pt-2 border-t space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              {t("demandes_recentes")}
            </p>
            {recentRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs gap-2">
                <span className="truncate flex-1">{r.template.title}</span>
                <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">
                  {r.targetAll
                    ? t("tous")
                    : r.targetTeamId
                      ? t("equipe")
                      : r.targetAdmin?.fullName?.split(" ")[0] ?? "Individuel"}
                </Badge>
              </div>
            ))}
            <Button size="sm" variant="ghost" className="w-full h-7 text-xs mt-1" onClick={onGoRequests}>
              {t("voir_toutes_demandes")}
            </Button>
          </div>
        )}
        {upcomingExpirations.length > 0 && (
          <div className="pt-2 border-t space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              {t("expirations_prochaines")}
            </p>
            {upcomingExpirations.map((d) => {
              const days = daysUntil(d.expiresAt);
              const expired = days !== null && days < 0;
              return (
                <div key={d.id} className="flex items-center justify-between text-xs gap-2">
                  <span className="truncate flex-1">
                    {d.title} - {d.admin.fullName ?? d.admin.email}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      expired
                        ? "text-red-700 border-red-300 bg-red-50"
                        : "text-amber-700 border-amber-300 bg-amber-50"
                    }`}
                  >
                    {expired ? t("expire") : `J-${days}`}
                  </Badge>
                </div>
              );
            })}
            <Button size="sm" variant="ghost" className="w-full h-7 text-xs mt-1" onClick={onGoEmployees}>
              {t("ouvrir_dossiers")}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

// ================================================================
//                       TAB : TEMPLATES
// ================================================================
function TemplatesTab({
  templates,
  templatesInHandbooks,
  handbooks,
  onCreate,
  onEdit,
  onDelete,
  onPreview,
  onRequest,
}: {
  templates: Template[];
  templatesInHandbooks: Set<number>;
  handbooks: HandbookLite[];
  onCreate: () => void;
  onEdit: (t: Template) => void;
  onDelete: (t: Template) => void;
  onPreview: (t: Template) => void;
  onRequest: (t: Template) => void;
}) {
  const t = useTranslations("admin.hr_documents");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "required" | "optional">("all");
  // Mission 1 : par defaut on MASQUE les templates inclus dans un cahier.
  // Toggle pour reafficher tous (debug/exhaustif).
  const [showInHandbooks, setShowInHandbooks] = useState(false);

  // Map { templateId -> handbookTitle } pour afficher le badge "Inclus dans X".
  const handbookByTemplateId = useMemo(() => {
    const m = new Map<number, { id: number; title: string; key: string }>();
    for (const h of handbooks) {
      for (const it of h.items) {
        if (!m.has(it.templateId)) {
          m.set(it.templateId, { id: h.id, title: h.title, key: h.key });
        }
      }
    }
    return m;
  }, [handbooks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      // Filtre principal : masque les templates inclus dans un cahier sauf si toggle ON.
      if (!showInHandbooks && templatesInHandbooks.has(t.id)) return false;
      if (filter === "required" && !t.isRequired) return false;
      if (filter === "optional" && t.isRequired) return false;
      if (q && !`${t.title} ${t.key}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [templates, search, filter, showInHandbooks, templatesInHandbooks]);

  const hiddenInHandbooksCount = templates.filter((t) =>
    templatesInHandbooks.has(t.id),
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("rechercher_template")}
          className="h-9 text-sm flex-1"
        />
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="h-9 text-sm sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("tous_templates")}</SelectItem>
            <SelectItem value="required">{t("obligatoires")}</SelectItem>
            <SelectItem value="optional">{t("optionnels")}</SelectItem>
          </SelectContent>
        </Select>
        {hiddenInHandbooksCount > 0 && (
          <label className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={showInHandbooks}
              onChange={(e) => setShowInHandbooks(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#0F2D52]"
            />
            <span className="text-muted-foreground">
              Afficher inclus en cahier ({hiddenInHandbooksCount})
            </span>
          </label>
        )}
        <Button
          size="sm"
          onClick={onCreate}
          className="h-9 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {t("nouveau")}
        </Button>
      </div>

      {/* Mission 1 : bandeau d'info sur le filtrage cahiers */}
      {hiddenInHandbooksCount > 0 && !showInHandbooks && (
        <div className="rounded-md border border-[#0F2D52]/20 bg-[#0F2D52]/5 px-3 py-2 flex items-start gap-2.5">
          <BookOpen className="h-4 w-4 text-[#0F2D52] mt-0.5 shrink-0" />
          <div className="text-[12px] leading-snug">
            <span className="font-semibold text-[#0F2D52]">
              {hiddenInHandbooksCount} template{hiddenInHandbooksCount > 1 ? "s" : ""} masque{hiddenInHandbooksCount > 1 ? "s" : ""}
            </span>
            <span className="text-muted-foreground">
              {" "}: deja inclus dans un cahier actif (signature collective).
              Gerez-les depuis la page{" "}
              <Link
                href="/admin/employes/documents/cahiers"
                className="text-[#0F2D52] underline font-semibold"
              >
                {t("cahiers")}
              </Link>
              .
            </span>
          </div>
        </div>
      )}

      {/* Banniere d'aide : un template ne devient visible aux employes que si
          une demande de signature est creee. */}
      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 flex items-start gap-2.5">
        <BellRing className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
        <div className="text-[12px] leading-snug text-amber-900">
          <p className="font-semibold">{t("documents_admin_view_pour_qu_un_modele_soit_visible_aux")}</p>
          <p className="text-amber-800/90 mt-0.5">{t("documents_admin_view_cliquez_sur")}<span className="font-semibold">{t("demander_signature")}</span>{t("documents_admin_view_sur_une_carte_pour_cibler_un_employe")}</p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          {t("aucun_template_trouve")}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((tpl) => {
            const inHandbook = handbookByTemplateId.get(tpl.id);
            // Label follows acknowledgmentMode.
            const ackMode = tpl.acknowledgmentMode ?? "reading_only";
            const primaryAction = ackMode === "signature"
              ? { label: t("demander_signature_2"), icon: FileSignature, onClick: () => onRequest(tpl) }
              : { label: t("envoyer_lecture"), icon: BookOpen, onClick: () => onRequest(tpl) };
            return (
              <div key={tpl.id} className="relative">
                <DocumentCard
                  icon={FileSignature}
                  title={tpl.title}
                  subtitle={`v${tpl.version} - ${CATEGORY_KEYS[tpl.category] ?? tpl.category} - ${tpl._count.signatures} signature${tpl._count.signatures !== 1 ? "s" : ""}`}
                  iconTone="neutral"
                  status={
                    tpl.isRequired
                      ? { label: t("obligatoire"), tone: "danger" }
                      : { label: t("optionnel"), tone: "neutral" }
                  }
                  onPreview={() => onPreview(tpl)}
                  onEdit={() => onEdit(tpl)}
                  onDelete={() => onDelete(tpl)}
                  primaryAction={primaryAction}
                />
                {inHandbook && (
                  <div className="absolute top-2 right-2">
                    <Badge
                      variant="outline"
                      className="text-[9px] bg-[#0F2D52]/10 text-[#0F2D52] border-[#0F2D52]/30 gap-1"
                    >
                      <BookOpen className="h-2.5 w-2.5" />
                      Cahier : {inHandbook.title}
                    </Badge>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ================================================================
//                       TAB : REQUESTS
// ================================================================
function RequestsTab({
  requests,
  completedRequests = [],
  teams,
  onCancel,
  onRemind,
  onPreviewPdf,
  onNewRequest,
}: {
  requests: PendingRequest[];
  completedRequests?: PendingRequest[];
  teams: TeamLite[];
  onCancel: (r: PendingRequest) => void;
  onRemind: (r: PendingRequest) => Promise<void> | void;
  onPreviewPdf: (r: PendingRequest) => void;
  onNewRequest: () => void;
}) {
  const t = useTranslations("admin.hr_documents");
  const tc = useTranslations("common");
  const [busyId, setBusyId] = useState<number | null>(null);
  const dateTag = useDateLocale();
  // Mission 6 : toggle visibilite "En cours / Completees / Tout" (defaut "En cours").
  const [viewFilter, setViewFilter] = useState<"pending" | "completed" | "all">("pending");
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);

  const displayedRequests = useMemo(() => {
    if (viewFilter === "pending") return requests;
    if (viewFilter === "completed") return completedRequests;
    // "all" : on combine en triant par date desc (completedAt sinon requestedAt).
    return [...requests, ...completedRequests].sort((a, b) => {
      const da = new Date(a.requestedAt).getTime();
      const db = new Date(b.requestedAt).getTime();
      return db - da;
    });
  }, [viewFilter, requests, completedRequests]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {displayedRequests.length} demande{displayedRequests.length > 1 ? "s" : ""}
          </p>
          {/* Mission 6 : sub-toggle */}
          <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
            {(
              [
                { id: "pending", label: `En cours (${requests.length})` },
                { id: "completed", label: `Completees (${completedRequests.length})` },
                { id: "all", label: t("tout") },
              ] as const
            ).map((s) => {
              const active = viewFilter === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setViewFilter(s.id)}
                  className={`h-7 px-2.5 rounded text-[11px] font-semibold transition ${
                    active
                      ? "bg-[#0F2D52] text-white"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
        <Button size="sm" onClick={onNewRequest} className="h-8 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white">
          <Send className="h-3.5 w-3.5 mr-1.5" />
          {t("nouvelle_demande")}
        </Button>
      </div>

      {displayedRequests.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {viewFilter === "pending"
              ? t("aucune_demande_attente")
              : viewFilter === "completed"
                ? t("aucune_demande_completee_historique_recent")
                : t("aucune_demande_afficher")}
          </p>
          {viewFilter === "pending" && (
            <Button size="sm" onClick={onNewRequest} className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white">
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {t("nouvelle_demande")}
            </Button>
          )}
        </Card>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#0F2D52] text-white">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-[10px] uppercase tracking-wider">
                  {t("document")}
                </th>
                <th className="px-3 py-2 text-left font-semibold text-[10px] uppercase tracking-wider">
                  {t("cible")}
                </th>
                <th className="px-3 py-2 text-left font-semibold text-[10px] uppercase tracking-wider">
                  {tc("status")}
                </th>
                <th className="hidden md:table-cell px-3 py-2 text-left font-semibold text-[10px] uppercase tracking-wider">
                  {t("demandee")}
                </th>
                <th className="hidden lg:table-cell px-3 py-2 text-left font-semibold text-[10px] uppercase tracking-wider">
                  {t("echeance")}
                </th>
                <th className="px-3 py-2 text-right font-semibold text-[10px] uppercase tracking-wider">
                  {tc("actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedRequests.map((r, idx) => {
                const days = daysUntil(r.dueDate);
                const urgent = days !== null && days <= 3;
                const overdue = days !== null && days < 0;
                const isCompleted = r.status === "completed";
                const isCancelled = r.status === "cancelled";
                let targetLabel = t("tout_monde");
                if (r.targetAdmin) {
                  targetLabel = r.targetAdmin.fullName ?? r.targetAdmin.email;
                } else if (r.targetTeamId) {
                  targetLabel = `Equipe : ${teamMap.get(r.targetTeamId) ?? "?"}`;
                }
                return (
                  <tr
                    key={r.id}
                    className={`border-t ${idx % 2 === 0 ? "bg-card" : "bg-muted/20"} hover:bg-[#0F2D52]/5 transition ${
                      isCancelled ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium text-sm truncate">{r.template.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        v{r.template.version}
                        {r.template.isRequired && t("obligatoire")}
                      </p>
                      {r.reason && (
                        <p className="text-[11px] italic text-muted-foreground mt-0.5 line-clamp-1">
                          &laquo; {r.reason} &raquo;
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        {r.targetAll ? (
                          <Users className="h-3 w-3 text-[#0F2D52]" />
                        ) : r.targetTeamId ? (
                          <Users className="h-3 w-3 text-[#0F2D52]" />
                        ) : (
                          <Mail className="h-3 w-3 text-[#0F2D52]" />
                        )}
                        {targetLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {isCompleted ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                        >
                          <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                          {t("signee")}
                        </Badge>
                      ) : isCancelled ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-muted text-muted-foreground border-input"
                        >
                          <XCircle className="h-2.5 w-2.5 mr-1" />
                          {t("annulee")}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                        >
                          <ClipboardList className="h-2.5 w-2.5 mr-1" />
                          {t("attente_2")}
                        </Badge>
                      )}
                    </td>
                    <td className="hidden md:table-cell px-3 py-2 text-xs">
                      <p className="truncate">{r.requestedBy.fullName ?? r.requestedBy.email}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(r.requestedAt, dateTag)}</p>
                    </td>
                    <td className="hidden lg:table-cell px-3 py-2 text-xs">
                      {r.dueDate ? (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            isCompleted || isCancelled
                              ? "text-muted-foreground"
                              : overdue
                                ? "text-red-700 border-red-300 bg-red-50"
                                : urgent
                                  ? "text-amber-700 border-amber-300 bg-amber-50"
                                  : "text-muted-foreground"
                          }`}
                        >
                          <CalendarClock className="h-2.5 w-2.5 mr-1" />
                          {formatDate(r.dueDate, dateTag)}
                          {!isCompleted && !isCancelled && days !== null && (
                            <span className="ml-1">
                              ({overdue ? `expiree` : `J-${days}`})
                            </span>
                          )}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <ActionTooltip label={t("apercu_pdf")}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onPreviewPdf(r)}
                          aria-label={t("apercu_pdf")}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </ActionTooltip>
                      {!isCompleted && !isCancelled && (
                        <>
                          <ActionTooltip label={t("envoyer_rappel")}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={busyId === r.id}
                              onClick={async () => {
                                setBusyId(r.id);
                                try {
                                  await onRemind(r);
                                } finally {
                                  setBusyId(null);
                                }
                              }}
                              aria-label={t("relancer")}
                            >
                              {busyId === r.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <BellRing className="h-4 w-4" />
                              )}
                            </Button>
                          </ActionTooltip>
                          <ActionTooltip label={t("annuler_demande_2")}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:text-destructive"
                              onClick={() => onCancel(r)}
                              aria-label={tc("cancel")}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </ActionTooltip>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}

// ================================================================
//                       TAB : EMPLOYEES
// ================================================================
function EmployeesTab({
  employees,
  expiringDocs,
  onSelect,
}: {
  employees: Employee[];
  expiringDocs: ExpiringDoc[];
  onSelect: (e: Employee) => void;
}) {
  const t = useTranslations("admin.hr_documents");
  const [search, setSearch] = useState("");
  const expiringByEmployee = useMemo(() => {
    const map = new Map<number, ExpiringDoc[]>();
    for (const d of expiringDocs) {
      const arr = map.get(d.adminId) ?? [];
      arr.push(d);
      map.set(d.adminId, arr);
    }
    return map;
  }, [expiringDocs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      `${e.fullName ?? ""} ${e.email} ${e.team?.name ?? ""}`.toLowerCase().includes(q)
    );
  }, [employees, search]);

  return (
    <div className="space-y-3">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("rechercher_employe")}
        className="h-9 text-sm"
      />
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#0F2D52] text-white">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider font-semibold">
                  {t("employe")}
                </th>
                <th className="hidden sm:table-cell px-3 py-2 text-left text-[10px] uppercase tracking-wider font-semibold">
                  {t("equipe")}
                </th>
                <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wider font-semibold">
                  {t("alertes")}
                </th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider font-semibold">
                  {t("action")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, idx) => {
                const exp = expiringByEmployee.get(e.id) ?? [];
                const expired = exp.some((d) => {
                  const days = daysUntil(d.expiresAt);
                  return days !== null && days < 0;
                });
                return (
                  <tr
                    key={e.id}
                    className={`border-t ${idx % 2 === 0 ? "bg-card" : "bg-muted/20"} hover:bg-[#0F2D52]/5 transition cursor-pointer`}
                    onClick={() => onSelect(e)}
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium text-sm truncate">{e.fullName ?? e.email}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{e.email}</p>
                      <p className="sm:hidden text-[10px] text-muted-foreground truncate mt-0.5">
                        {e.team?.name ?? t("sans_equipe")}
                      </p>
                    </td>
                    <td className="hidden sm:table-cell px-3 py-2 text-xs">{e.team?.name ?? "-"}</td>
                    <td className="px-3 py-2 text-center">
                      {exp.length > 0 ? (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            expired
                              ? "text-red-700 border-red-300 bg-red-50"
                              : "text-amber-700 border-amber-300 bg-amber-50"
                          }`}
                        >
                          <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                          {exp.length} doc{exp.length > 1 ? "s" : ""}{" "}
                          {expired ? "expire" : t("renouveler")}
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onSelect(e);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        {t("dossier")}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    {t("aucun_employe_trouve")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ================================================================
//                       TAB : UPLOAD REQUESTS
// ================================================================
const UPLOAD_STATUS_LABEL: Record<string, { labelKey: string; tone: string }> = {
  pending: { labelKey: "attente_upload", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  uploaded: { labelKey: "valider", tone: "bg-blue-50 text-blue-700 border-blue-200" },
  approved: { labelKey: "approuve", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { labelKey: "rejete", tone: "bg-red-50 text-red-700 border-red-200" },
  cancelled: { labelKey: "annule", tone: "bg-muted text-muted-foreground border-input" },
};

const UPLOAD_CATEGORY_KEY: Record<string, string> = {
  licence: "licence_permis",
  diploma: "diplome",
  certification: "certification",
  id_card: "carte_d_identite",
  passport: "passeport",
  medical: "document_medical",
  other: "autre",
};

function UploadRequestsTab({
  requests,
  onNewRequest,
  onReview,
  onCancel,
  onRemind,
}: {
  requests: UploadRequestAdmin[];
  onNewRequest: () => void;
  onReview: (r: UploadRequestAdmin) => void;
  onCancel: (r: UploadRequestAdmin) => void;
  onRemind: (r: UploadRequestAdmin) => Promise<void> | void;
}) {
  const t = useTranslations("admin.hr_documents");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const dateTag = useDateLocale();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusFilter === "open" && !(r.status === "pending" || r.status === "uploaded")) {
        return false;
      }
      if (statusFilter !== "all" && statusFilter !== "open" && r.status !== statusFilter) {
        return false;
      }
      if (
        q
        && !`${r.title} ${r.targetAdmin.fullName ?? ""} ${r.targetAdmin.email}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [requests, statusFilter, search]);

  if (requests.length === 0) {
    return (
      <Card className="p-10 text-center space-y-3">
        <Inbox className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t("aucune_demande_televersement")}</p>
        <Button
          size="sm"
          onClick={onNewRequest}
          className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
        >
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          {t("demander_document")}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("rechercher_employe_titre")}
          className="h-9 text-sm flex-1"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 text-sm sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">{t("ouvertes_pending_valider")}</SelectItem>
            <SelectItem value="pending">{t("en_attente_upload")}</SelectItem>
            <SelectItem value="uploaded">{t("valider")}</SelectItem>
            <SelectItem value="approved">{t("approuvees")}</SelectItem>
            <SelectItem value="rejected">{t("rejetees")}</SelectItem>
            <SelectItem value="cancelled">{t("annulees")}</SelectItem>
            <SelectItem value="all">{t("toutes")}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={onNewRequest}
          className="h-9 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
        >
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          {t("demander_document")}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          {t("aucune_demande_ne_correspond_filtres")}
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((r) => {
            const meta =
              UPLOAD_STATUS_LABEL[r.status] ?? UPLOAD_STATUS_LABEL.pending;
            const days = daysUntil(r.dueDate);
            const overdue =
              days !== null
              && days < 0
              && (r.status === "pending" || r.status === "uploaded");
            const urgent =
              days !== null
              && days >= 0
              && days <= 3
              && (r.status === "pending" || r.status === "uploaded");
            return (
              <Card
                key={r.id}
                className={`p-4 space-y-3 border-l-4 ${
                  overdue
                    ? "border-l-red-500"
                    : r.status === "uploaded"
                      ? "border-l-blue-500"
                      : urgent
                        ? "border-l-amber-500"
                        : r.status === "approved"
                          ? "border-l-emerald-500"
                          : "border-l-muted"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{r.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {UPLOAD_CATEGORY_KEY[r.category] ?? r.category} ·{" "}
                      Demandé par{" "}
                      {r.requestedBy.fullName ?? r.requestedBy.email}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${meta.tone} shrink-0`}
                  >
                    {t(meta.labelKey)}
                  </Badge>
                </div>

                <div className="rounded-md bg-muted/30 px-2.5 py-1.5 flex items-center gap-2 text-xs">
                  <Users className="h-3 w-3 text-[#0F2D52]" />
                  <span className="font-medium truncate">
                    {r.targetAdmin.fullName ?? r.targetAdmin.email}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" />
                    {r.dueDate ? (
                      <span
                        className={
                          overdue
                            ? "text-red-700 font-semibold"
                            : urgent
                              ? "text-amber-700 font-semibold"
                              : ""
                        }
                      >
                        {overdue
                          ? t("documents_admin_view_expiree_le_p0", { p0: formatDate(r.dueDate, dateTag) })
                          : t("documents_admin_view_avant_le_p0", { p0: formatDate(r.dueDate, dateTag) })}
                      </span>
                    ) : (
                      t("sans_echeance")
                    )}
                  </span>
                  {r.status === "uploaded" && r.uploadedAt && (
                    <span className="text-blue-700">
                      Téléversé {formatDate(r.uploadedAt, dateTag)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1 pt-1 border-t">
                  {r.status === "uploaded" && (
                    <Button
                      size="sm"
                      onClick={() => onReview(r)}
                      className="h-7 text-[11px] bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      {t("examiner")}
                    </Button>
                  )}
                  {r.status === "pending" && (
                    <>
                      <ActionTooltip label={t("envoyer_rappel")}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={busyId === r.id}
                          onClick={async () => {
                            setBusyId(r.id);
                            try {
                              await onRemind(r);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          aria-label={t("envoyer_rappel")}
                        >
                          {busyId === r.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <BellRing className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </ActionTooltip>
                      <ActionTooltip label={t("annuler_demande_2")}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:text-destructive"
                          onClick={() => onCancel(r)}
                          aria-label={t("annuler_demande_2")}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </ActionTooltip>
                    </>
                  )}
                  {r.status === "approved" && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      {t("document_ajoute_dossier")}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ================================================================
//        DIALOG : Personal docs drill-down for an employee
// ================================================================
function EmployeePersonalDocsDialog({
  employee,
  isSuper,
  onClose,
}: {
  employee: Employee;
  isSuper: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("admin.hr_documents");
  const tc = useTranslations("common");
  const [docs, setDocs] = useState<PersonalDocCardData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<PersonalDocCardData | null>(null);
  const [confirmDel, setConfirmDel] = useState<PersonalDocCardData | null>(null);
  const router = useRouter();

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/employees/${employee.id}/personal-docs`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const mapped: PersonalDocCardData[] = (data.docs ?? []).map((d: {
        id: number;
        category: string;
        title: string;
        description: string | null;
        issuer: string | null;
        referenceNumber: string | null;
        issuedAt: string | null;
        expiresAt: string | null;
        isPrivate: boolean;
        verifiedAt: string | null;
        verifiedBy: { id: number; fullName: string | null } | null;
      }) => ({
        id: d.id,
        category: (d.category as PersonalDocCategory) ?? "other",
        title: d.title,
        description: d.description,
        issuer: d.issuer,
        refNumber: d.referenceNumber,
        issuedAt: d.issuedAt,
        expiresAt: d.expiresAt,
        isPrivate: d.isPrivate,
        verifiedAt: d.verifiedAt,
        verifiedBy: d.verifiedBy
          ? { id: d.verifiedBy.id, fullName: d.verifiedBy.fullName }
          : null,
      }));
      setDocs(mapped);
    } catch (err) {
      toast.error(t("impossible_charger_documents"));
      setDocs([]);
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [employee.id]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleVerify = async (docId: number, notes: string) => {
    const r = await verifyPersonalDocAction({ id: docId, verified: true, notes: notes || null });
    if (r.success) {
      toast.success(t("document_verifie"));
      await fetchDocs();
      router.refresh();
    } else {
      toast.error(r.error || "");
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-3xl max-h-[92vh] p-0 overflow-hidden flex flex-col">
          <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-base text-white flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Dossier de {employee.fullName ?? employee.email}
              </DialogTitle>
              <DialogDescription className="text-white/80 text-xs">
                {employee.email}
                {employee.team ? ` - Equipe ${employee.team.name}` : ""}
                {!isSuper && t("documents_prives_ne_pas_affiches")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-5 space-y-3 overflow-y-auto flex-1">
            {loading ? (
              <div className="py-10 flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t("chargement")}
              </div>
            ) : docs && docs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {docs.map((d) => (
                  <PersonalDocCard
                    key={d.id}
                    doc={d}
                    isAdmin
                    onPreview={() => setPreviewDoc(d)}
                    // Convention VNK : toujours PdfPreviewModal pour les PDF.
                    // Le bouton "Telecharger" de la card reutilise donc le
                    // meme PdfPreviewModal (l'utilisateur peut telecharger
                    // depuis la modal via le bouton dedie).
                    onDownload={() => setPreviewDoc(d)}
                    onDelete={() => setConfirmDel(d)}
                    onVerify={async (notes) => {
                      await handleVerify(d.id, notes);
                    }}
                  />
                ))}
              </div>
            ) : (
              <Card className="p-10 text-center text-sm text-muted-foreground">
                {t("aucun_document_personnel_cet_employe")}
              </Card>
            )}
          </div>

          <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0">
            <Button variant="outline" onClick={onClose}>
              {tc("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PdfPreviewModal
        open={!!previewDoc}
        url={previewDoc ? `/api/admin/employees/${employee.id}/personal-docs/${previewDoc.id}/file` : null}
        title={previewDoc?.title ?? ""}
        description={previewDoc?.issuer ?? undefined}
        onClose={() => setPreviewDoc(null)}
      />

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(o) => !o && setConfirmDel(null)}
        title={`Supprimer "${confirmDel?.title ?? ""}" ?`}
        description={t("action_irreversible")}
        confirmLabel={tc("delete")}
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDel) return;
          const { deletePersonalDocAction } = await import("@/app/actions/hr-personal-docs");
          const r = await deletePersonalDocAction({ id: confirmDel.id });
          if (r.success) {
            toast.success(t("document_supprime"));
            await fetchDocs();
            router.refresh();
          } else {
            toast.error(r.error || "");
          }
          setConfirmDel(null);
        }}
      />
    </>
  );
}

// =============================================================
// Helper : declenche programmatiquement TemplatePdfPreviewButton
// avec contexte (template legal + employe) - rendu invisible.
// =============================================================
function DocsTemplatePreviewAutoTrigger({
  template,
  employeeId,
  onDone,
}: {
  template: Template;
  employeeId: number;
  onDone: () => void;
}) {
  const t = useTranslations("admin.hr_documents");
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const t = window.setTimeout(() => {
      triggerRef.current?.click();
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  // Mappe la categorie du template legal sur le type PDF
  const documentType: "legal" | "policy" =
    template.category === "policy" ? "policy" : "legal";

  return (
    <div className="sr-only" aria-hidden>
      <TemplatePdfPreviewButton
        bodyMarkdown={template.bodyMarkdown}
        title={template.title}
        documentType={documentType}
        employeeId={employeeId}
        metadata={{ version: template.version }}
        signatureScope={template.signatureScope}
        templateKey={template.key}
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
//                       TAB : SIGNATURES
// ================================================================
// Liste recap de toutes les signatures employes avec actions :
//   - Apercu PDF (PdfPreviewModal) -> finalPdfUrl si dispo,
//     sinon proposer la regeneration via regenerateSignedPdfAction.
//   - Voir signature : modal compact qui affiche signatureData (PNG).
//   - Filtres : recherche employe + template + version.
// ================================================================
function SignaturesTab({
  signatures,
  templates,
  employees,
}: {
  signatures: Signature[];
  templates: Template[];
  employees: Employee[];
}) {
  const t = useTranslations("admin.hr_documents");
  const tc = useTranslations("common");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const dateTag = useDateLocale();
  const [pdfPreview, setPdfPreview] = useState<{
    url: string;
    title: string;
    description?: string;
  } | null>(null);
  const [sigPreview, setSigPreview] = useState<{
    dataUrl: string;
    title: string;
    employeeName: string;
    signedAt: string;
  } | null>(null);
  const [regenBusyId, setRegenBusyId] = useState<number | null>(null);
  // Contresignature employeur : dialog avec pad, pour les templates dont le
  // scope prevoit une signature employeur et pas encore contresignes.
  const [employerSignFor, setEmployerSignFor] = useState<{
    sigId: number;
    docTitle: string;
    employeeLabel: string;
  } | null>(null);
  const [employerPadValue, setEmployerPadValue] = useState<string | null>(null);
  const [employerSignBusy, setEmployerSignBusy] = useState(false);

  const templateById = useMemo(
    () => new Map(templates.map((t) => [t.id, t])),
    [templates],
  );
  const employeeById = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return signatures
      .map((s) => ({
        sig: s,
        template: templateById.get(s.templateId),
        employee: employeeById.get(s.adminId),
      }))
      .filter(({ sig, template, employee }) => {
        if (templateFilter !== "all" && String(sig.templateId) !== templateFilter) {
          return false;
        }
        if (!q) return true;
        const hay = `${employee?.fullName ?? ""} ${employee?.email ?? ""} ${
          template?.title ?? ""
        } ${sig.version}`.toLowerCase();
        return hay.includes(q);
      })
      .sort(
        (a, b) =>
          new Date(b.sig.signedAt).getTime() - new Date(a.sig.signedAt).getTime(),
      );
  }, [signatures, templateById, employeeById, search, templateFilter]);

  const handleRegen = useCallback(
    async (sigId: number, title: string, employeeLabel: string) => {
      setRegenBusyId(sigId);
      try {
        const r = await regenerateSignedPdfAction({ signatureId: sigId });
        if (r.success) {
          toast.success(t("pdf_regenere"));
          setPdfPreview({
            url: r.data.finalPdfUrl,
            title,
            description: employeeLabel,
          });
          router.refresh();
        } else {
          toast.error(r.error || t("echec_regeneration"));
        }
      } finally {
        setRegenBusyId(null);
      }
    },
    [router],
  );

  if (signatures.length === 0) {
    return (
      <Card className="p-10 text-center space-y-3">
        <FileSignature className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          {t("aucune_signature_enregistree_moment")}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("rechercher_employe_document_version")}
          className="h-9 text-sm flex-1"
        />
        <Select value={templateFilter} onValueChange={setTemplateFilter}>
          <SelectTrigger className="h-9 text-sm sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("tous_documents")}</SelectItem>
            {templates.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-[10px] uppercase tracking-wider">
                  {t("employe_2")}
                </th>
                <th className="px-3 py-2 text-left font-semibold text-[10px] uppercase tracking-wider">
                  {t("document")}
                </th>
                <th className="hidden lg:table-cell px-3 py-2 text-left font-semibold text-[10px] uppercase tracking-wider">
                  {t("version")}
                </th>
                <th className="hidden md:table-cell px-3 py-2 text-left font-semibold text-[10px] uppercase tracking-wider">
                  {t("date_signature")}
                </th>
                <th className="hidden sm:table-cell px-3 py-2 text-center font-semibold text-[10px] uppercase tracking-wider">
                  PDF
                </th>
                <th className="px-3 py-2 text-right font-semibold text-[10px] uppercase tracking-wider">
                  {tc("actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-10 text-center text-sm text-muted-foreground"
                  >
                    {t("aucune_signature_ne_correspond_filtres")}
                  </td>
                </tr>
              ) : (
                rows.map(({ sig, template, employee }, idx) => {
                  const employeeLabel =
                    employee?.fullName ?? employee?.email ?? `Admin #${sig.adminId}`;
                  const docTitle = template?.title ?? `Template #${sig.templateId}`;
                  const hasPdf = !!sig.finalPdfUrl;
                  const isBusy = regenBusyId === sig.id;
                  return (
                    <tr
                      key={sig.id}
                      className={`border-t ${
                        idx % 2 === 0 ? "bg-card" : "bg-muted/20"
                      } hover:bg-[#0F2D52]/5 transition`}
                    >
                      <td className="px-3 py-2">
                        <p className="font-medium text-sm truncate">{employeeLabel}</p>
                        {employee?.email && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            {employee.email}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-sm truncate">{docTitle}</p>
                        {template?.category && (
                          <p className="text-[10px] text-muted-foreground">
                            {CATEGORY_KEYS[template.category] ?? template.category}
                          </p>
                        )}
                        {/* Sur mobile : recap inline (version + date) */}
                        <p className="md:hidden text-[10px] text-muted-foreground mt-0.5">
                          v{sig.version} · {formatDate(sig.signedAt, dateTag)}
                        </p>
                      </td>
                      <td className="hidden lg:table-cell px-3 py-2 text-xs">
                        <Badge
                          variant="outline"
                          className="text-[10px] border-[#0F2D52]/30 text-[#0F2D52]"
                        >
                          v{sig.version}
                        </Badge>
                      </td>
                      <td className="hidden md:table-cell px-3 py-2 text-xs">{formatDate(sig.signedAt, dateTag)}</td>
                      <td className="hidden sm:table-cell px-3 py-2 text-center">
                        {hasPdf ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                          >
                            <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                            {t("disponible")}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                          >
                            <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                            {t("regenerer")}
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {hasPdf ? (
                          <ActionTooltip label={t("apercu_pdf_signe")}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                setPdfPreview({
                                  url: sig.finalPdfUrl as string,
                                  title: docTitle,
                                  description: `${employeeLabel} · v${sig.version}`,
                                })
                              }
                              aria-label={t("apercu_pdf_2")}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </ActionTooltip>
                        ) : (
                          <ActionTooltip label={t("regenerer_pdf")}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={isBusy}
                              onClick={() => handleRegen(sig.id, docTitle, employeeLabel)}
                              aria-label={t("regenerer_pdf")}
                            >
                              {isBusy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FileText className="h-4 w-4" />
                              )}
                            </Button>
                          </ActionTooltip>
                        )}
                        {(() => {
                          // Contresignature employeur : scope both/employer_only,
                          // mode signature, pas encore contresigne.
                          const scope = (template as { signatureScope?: string } | undefined)
                            ?.signatureScope;
                          const ack = (template as { acknowledgmentMode?: string } | undefined)
                            ?.acknowledgmentMode;
                          const needsEmployer =
                            (scope === "both" || scope === "employer_only")
                            && ack !== "reading_only";
                          if (!needsEmployer || sig.employerSignedAt) return null;
                          return (
                            <ActionTooltip label={t("contresigner_employeur")}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-amber-600 hover:text-amber-700"
                                onClick={() => {
                                  setEmployerPadValue(null);
                                  setEmployerSignFor({
                                    sigId: sig.id,
                                    docTitle,
                                    employeeLabel,
                                  });
                                }}
                                aria-label={t("contresigner_employeur")}
                              >
                                <FileSignature className="h-4 w-4" />
                              </Button>
                            </ActionTooltip>
                          );
                        })()}
                        {sig.signatureData && (
                          <ActionTooltip label={t("voir_signature_manuscrite")}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                setSigPreview({
                                  dataUrl: sig.signatureData as string,
                                  title: docTitle,
                                  employeeName: employeeLabel,
                                  signedAt: sig.signedAt,
                                })
                              }
                              aria-label={t("voir_signature")}
                            >
                              <FileSignature className="h-4 w-4" />
                            </Button>
                          </ActionTooltip>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PdfPreviewModal
        open={!!pdfPreview}
        url={pdfPreview?.url ?? null}
        title={pdfPreview?.title ?? ""}
        description={pdfPreview?.description}
        onClose={() => setPdfPreview(null)}
      />

      {/* Dialog contresignature employeur */}
      <Dialog
        open={!!employerSignFor}
        onOpenChange={(o) => !o && !employerSignBusy && setEmployerSignFor(null)}
      >
        <DialogContent className="p-0 overflow-hidden flex flex-col w-[95vw] max-w-lg rounded-lg" aria-describedby={undefined}>
          <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-3 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-white text-sm flex items-center gap-2">
                <FileSignature className="h-4 w-4" />
                {t("contresignature_employeur")}
              </DialogTitle>
              <DialogDescription className="text-white/80 text-[11px]">
                {employerSignFor?.docTitle} · signé par {employerSignFor?.employeeLabel}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-xs text-muted-foreground">{t("documents_admin_view_votre_signature_sera_ajoutee_au_bloc_signature")}</p>
            <div className="rounded-md border bg-white p-3">
              <SignaturePad value={employerPadValue} onChange={setEmployerPadValue} />
            </div>
          </div>
          <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEmployerSignFor(null)}
              disabled={employerSignBusy}
            >
              {tc("cancel")}
            </Button>
            <Button
              size="sm"
              className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
              disabled={!employerPadValue || employerSignBusy}
              onClick={async () => {
                if (!employerSignFor || !employerPadValue) return;
                setEmployerSignBusy(true);
                try {
                  const r = await employerSignLegalDocAction({
                    signatureId: employerSignFor.sigId,
                    signatureDataUrl: employerPadValue,
                  });
                  if (r.success) {
                    toast.success(t("document_contresigne"));
                    setEmployerSignFor(null);
                    router.refresh();
                  } else {
                    toast.error(r.error || t("echec_contresignature"));
                  }
                } finally {
                  setEmployerSignBusy(false);
                }
              }}
            >
              {employerSignBusy ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <FileSignature className="h-3.5 w-3.5 mr-1.5" />
              )}
              Contresigner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!sigPreview}
        onOpenChange={(o) => !o && setSigPreview(null)}
      >
        <DialogContent className="p-0 overflow-hidden flex flex-col w-[95vw] max-w-lg rounded-lg">
          <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-3 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-white text-sm flex items-center gap-2">
                <FileSignature className="h-4 w-4" />
                {t("signature_manuscrite")}
              </DialogTitle>
              <DialogDescription className="text-white/80 text-[11px]">
                {sigPreview?.employeeName} · {sigPreview?.title}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-5 space-y-3 bg-slate-50">
            {sigPreview && (
              <>
                <div className="rounded-md border border-slate-300 bg-white p-4 flex items-center justify-center min-h-[160px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sigPreview.dataUrl}
                    alt={t("documents_admin_view_signature_de_p0", { p0: sigPreview.employeeName })}
                    className="max-h-40 max-w-full object-contain"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground text-center">
                  Signé le {formatDate(sigPreview.signedAt, dateTag)}
                </p>
              </>
            )}
          </div>
          <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0">
            <Button variant="outline" onClick={() => setSigPreview(null)}>
              {tc("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
