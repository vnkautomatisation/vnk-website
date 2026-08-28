"use client";
// =============================================================
// MyDocumentsView - hub employe pour tous ses documents :
// signatures a faire, contrats, paie/fiscaux, lettres d'emploi,
// dossier personnel (permis, diplomes, certifications).
//
// Reutilise les composants partages :
//   DocumentStatsCard, DocumentCard, PersonalDocCard,
//   SignaturePadDialog, SignatureRequestBanner, DocumentUploader,
//   PdfPreviewModal.
// =============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { useDateLocale } from "@/lib/i18n-format";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileText,
  FileSignature,
  Mail,
  CreditCard,
  Award,
  Plus,
  Upload,
  Send,
  CheckCircle2,
  Receipt,
  FileCheck,
  Loader2,
  Inbox,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SettingsTabs, type TabItem } from "@/components/admin/settings-tabs";
import { cn } from "@/lib/utils";
import { DocumentStatsCard } from "@/components/admin/document-stats-card";
import { DocumentCard } from "@/components/admin/document-card";
import {
  PersonalDocCard,
  type PersonalDocCardData,
  type PersonalDocCategory,
} from "@/components/admin/personal-doc-card";
import {
  SignaturePadDialog,
  type SignaturePadDialogDoc,
} from "@/components/admin/signature-pad-dialog";
import {
  SignatureRequestBanner,
  type PendingSignatureRequest,
} from "@/components/admin/signature-request-banner";
import {
  MyUploadRequestsBanner,
  type PendingUploadRequest,
} from "@/components/admin/my-upload-requests-banner";
import {
  UploadDocumentResponseDialog,
  type UploadResponseRequest,
} from "@/components/admin/upload-document-response-dialog";
import { PdfPreviewModal } from "@/components/admin/pdf-preview-modal";
import { TemplatePdfPreviewButton } from "@/components/admin/template-pdf-preview-button";
import { SignatureStatusBadge } from "@/components/admin/signature-status-badge";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { FormSection, Field } from "@/components/admin/form-section";
import {
  signLegalDocAction,
  regenerateMyOwnSignedPdfAction,
} from "@/app/actions/hr-legal-docs";
import { requestEmploymentLetterAction } from "@/app/actions/hr-tax-docs";
import { deletePersonalDocAction } from "@/app/actions/hr-personal-docs";
import { signHandbookAction } from "@/app/actions/hr-document-handbooks";
import { HandbookSignatureDialog } from "@/components/admin/handbook-signature-dialog";
import type { HandbookSignatureDialogHandbook } from "@/components/admin/handbook-signature-types";
import { BookOpen, ScrollText } from "lucide-react";

// ---------- Types ------------------------------------------------
type LegalDoc = {
  id: number;
  key: string;
  title: string;
  version: string;
  category: string;
  isRequired: boolean;
  bodyMarkdown: string;
  signatureScope?: "employee_only" | "employer_only" | "both" | "none";
  acknowledgmentMode?: "reading_only" | "signature";
};
type Signature = {
  id: number;
  templateId: number;
  version: string;
  signedAt: string;
  /** URL du PDF final embarquant signature + cases cochées (null si encore en
   *  génération ou si la génération a échoué : preview fallback à la volée). */
  finalPdfUrl: string | null;
  /** Infos template embarquees (titre disponible meme si template archive/
   *  desactive donc plus dans legalDocs cote employe). */
  template?: { title: string; key: string; category: string } | null;
};
type TaxDoc = {
  id: number;
  type: string;
  taxYear: number | null;
  title: string;
  fileUrl: string;
  issuedAt: string;
  issuer: { id: number; fullName: string | null; email: string } | null;
};
type PayStub = {
  id: number;
  netPay: string | number;
  grossPay: string | number;
  releasedAt: string | null;
  pdfUrl: string | null;
  period: { id: number; startDate: string; endDate: string };
};
type Contract = {
  id: number;
  title: string;
  contractType: string;
  startDate: string;
  endDate: string | null;
  status: string;
  pdfUrl: string | null;
  employeeSignedAt: string | null;
  employerSignedAt: string | null;
  createdAt: string;
};
type LetterRequest = {
  id: number;
  purpose: string;
  recipient: string | null;
  status: string;
  letterUrl: string | null;
  createdAt: string;
  issuedAt: string | null;
  notes: string | null;
};
type PersonalDoc = {
  id: number;
  category: string;
  title: string;
  description: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileMimeType: string | null;
  issuer: string | null;
  referenceNumber: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  isPrivate: boolean;
  isVerified: boolean;
  verifiedAt: string | null;
  verifiedBy: { id: number; fullName: string | null; email: string } | null;
};
type SignatureRequest = {
  id: number;
  templateId: number;
  template: { id: number; key: string; title: string; version: string };
  requestedAt: string;
  dueDate: string | null;
  reason: string | null;
  requestedBy: { id: number; fullName: string | null; email: string };
};

type HandbookToSign = {
  id: number;
  title: string;
  subtitle: string | null;
  coverIntro: string | null;
  version: string;
  isRequired: boolean;
  signatureScope: string;
  items: Array<{
    id: number;
    orderIndex: number;
    template: {
      id: number;
      title: string;
      version: string;
      bodyMarkdown: string;
    };
  }>;
};
type HandbookSignature = {
  id: number;
  handbookId: number;
  version: string;
  signedAt: string;
  finalPdfUrl: string | null;
  /** Infos handbook embarquees pour affichage dans tab "Signes". */
  handbook?: { title: string; key: string } | null;
};

type UploadRequest = {
  id: number;
  title: string;
  description: string | null;
  category: string;
  isRequired: boolean;
  dueDate: string | null;
  createdAt: string;
  requestedBy: { id: number; fullName: string | null; email: string };
};

type TabKey = "to-sign" | "contracts" | "payroll" | "letters" | "personal" | "signed";

// ---------- Helpers ----------------------------------------------
const PURPOSE_LABEL: Record<string, string> = {
  bank: "Banque",
  rental: "Location",
  embassy: "Ambassade / immigration",
  hypothec: "Hypotheque",
  other: "Autre",
};
const TAX_TYPE_LABEL: Record<string, string> = {
  t4: "T4 (Canada)",
  releve1: "Releve 1 (Quebec)",
  employment_letter: "Lettre d'emploi",
  nr4: "NR4",
  t2200: "T2200",
  other: "Autre",
};
const CONTRACT_STATUS_LABEL: Record<string, { labelKey: string; tone: "success" | "warning" | "neutral" | "info" }> = {
  draft: { labelKey: "cs_draft", tone: "neutral" },
  sent: { labelKey: "cs_sent", tone: "info" },
  signed_employee: { labelKey: "cs_signed_employee", tone: "warning" },
  signed_employer: { labelKey: "cs_signed_employer", tone: "warning" },
  active: { labelKey: "cs_active", tone: "success" },
  terminated: { labelKey: "cs_terminated", tone: "neutral" },
  expired: { labelKey: "cs_expired", tone: "neutral" },
};

function formatDate(iso: string | null | undefined, tag: string): string {

  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric" });
}

function formatPeriod(start: string, end: string, tag: string): string {
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "-";
  return `${a.toLocaleDateString(tag, { day: "numeric", month: "short" })} - ${b.toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric" })}`;
}

function formatMoney(v: string | number, tag: string): string {
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return "-";
  return new Intl.NumberFormat(tag, { style: "currency", currency: "CAD" }).format(n);
}

function isThisMonth(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / 86400000);
}

// ================================================================
//                       MAIN VIEW
// ================================================================
export function MyDocumentsView({
  employeeId,
  legalDocs,
  mySignatures,
  taxDocs,
  payStubs,
  contracts,
  letterRequests,
  personalDocs,
  signatureRequests,
  pendingUploadRequests,
  handbooksToSign = [],
  myHandbookSignatures = [],
}: {
  employeeId: number;
  legalDocs: LegalDoc[];
  mySignatures: Signature[];
  taxDocs: TaxDoc[];
  payStubs: PayStub[];
  contracts: Contract[];
  letterRequests: LetterRequest[];
  personalDocs: PersonalDoc[];
  signatureRequests: SignatureRequest[];
  pendingUploadRequests: UploadRequest[];
  handbooksToSign?: HandbookToSign[];
  myHandbookSignatures?: HandbookSignature[];
}) {
  const t = useTranslations("admin.my_documents");
  const tc = useTranslations("common");
  const router = useRouter();
  const dateTag = useDateLocale();


  const signedMap = useMemo(() => {
    const m = new Map<number, Signature>();
    for (const s of mySignatures) {
      const cur = m.get(s.templateId);
      if (!cur || new Date(s.signedAt) > new Date(cur.signedAt)) m.set(s.templateId, s);
    }
    return m;
  }, [mySignatures]);

  const legalToSign = useMemo(() => {
    return legalDocs.filter((d) => {
      const sig = signedMap.get(d.id);
      return !sig || sig.version !== d.version;
    });
  }, [legalDocs, signedMap]);






  const pendingSignatureRequests = useMemo(() => {
    return signatureRequests.filter((r) => {
      const sig = signedMap.get(r.template.id);
      if (!sig) return true;
      if (sig.version !== r.template.version) return true;
      const sigTime = new Date(sig.signedAt).getTime();
      const reqTime = new Date(r.requestedAt).getTime();

      return sigTime < reqTime;
    });
  }, [signatureRequests, signedMap]);

  const personalDocsExpiring = useMemo(() => {
    return personalDocs.filter((d) => {
      const days = daysUntil(d.expiresAt);
      return days !== null && days >= 0 && days <= 60;
    });
  }, [personalDocs]);

  const personalDocsExpired = useMemo(() => {
    return personalDocs.filter((d) => {
      const days = daysUntil(d.expiresAt);
      return days !== null && days < 0;
    });
  }, [personalDocs]);

  const payStubsThisMonth = useMemo(
    () => payStubs.filter((p) => isThisMonth(p.releasedAt)).length,
    [payStubs]
  );

  const activeContracts = useMemo(
    () => contracts.filter((c) => ["active", "signed_employee", "signed_employer"].includes(c.status)).length,
    [contracts]
  );

  const toSignTotal = legalToSign.length + pendingSignatureRequests.filter(
    (r) => !legalToSign.some((d) => d.id === r.template.id)
  ).length;


  const [tab, setTab] = useState<TabKey>(toSignTotal > 0 ? "to-sign" : "contracts");
  const [signDialog, setSignDialog] = useState<SignaturePadDialogDoc & { templateId: number } | null>(null);
  const [letterDialog, setLetterDialog] = useState(false);
  const [responseDialog, setResponseDialog] = useState<UploadResponseRequest | null>(null);
  const [previewPdf, setPreviewPdf] = useState<{ url: string; title: string; description?: string; filename?: string } | null>(null);
  const [confirmDelDoc, setConfirmDelDoc] = useState<PersonalDoc | null>(null);

  const [handbookDialog, setHandbookDialog] = useState<HandbookSignatureDialogHandbook | null>(null);

  const openResponseFor = (requestId: number) => {
    const r = pendingUploadRequests.find((x) => x.id === requestId);
    if (!r) {
      toast.error(t("demande_introuvable"));
      return;
    }
    setResponseDialog({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      isRequired: r.isRequired,
      dueDate: r.dueDate,
      requestedBy: r.requestedBy,
    });
  };

  const bannerUploadRequests: PendingUploadRequest[] = pendingUploadRequests.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    isRequired: r.isRequired,
    dueDate: r.dueDate,
    createdAt: r.createdAt,
  }));





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






  const [navExtraEl, setNavExtraEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setNavExtraEl(document.getElementById("vnk-module-nav-extra"));
  }, []);

  const openSignByTemplateId = (templateId: number) => {
    const tpl = legalDocs.find((d) => d.id === templateId);
    if (!tpl) {
      toast.error(t("document_introuvable"));
      return;
    }


    const req = signatureRequests.find((r) => r.template.id === templateId);
    setSignDialog({
      templateId: tpl.id,
      signatureRequestId: req?.id,
      title: tpl.title,
      version: tpl.version,
      bodyMarkdown: tpl.bodyMarkdown,
      subtitle: tpl.isRequired ? t("document_obligatoire") : t("document_optionnel"),
      signatureScope: tpl.signatureScope ?? "employee_only",
      acknowledgmentMode: tpl.acknowledgmentMode ?? "reading_only",
      employeeId,
    });
  };

  const submitSignature = async (
    signatureDataUrl: string,
    checkboxStates: Record<string | number, unknown>,
  ) => {
    if (!signDialog) return;



    let employeeFieldValues: Record<string, string> | undefined;
    const checkboxStatesStr: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(checkboxStates)) {
      if (k === "__employeeFieldValues" && v && typeof v === "object") {
        const obj: Record<string, string> = {};
        for (const [fk, fv] of Object.entries(v as Record<string, unknown>)) {
          if (typeof fv === "string") obj[fk] = fv;
        }
        if (Object.keys(obj).length > 0) employeeFieldValues = obj;
        continue;
      }
      if (typeof v === "boolean") checkboxStatesStr[String(k)] = v;
    }
    const r = await signLegalDocAction({
      templateId: signDialog.templateId,
      signatureData: signatureDataUrl,
      checkboxStates: checkboxStatesStr,
      employeeFieldValues,
    });
    if (r.success) {
      toast.success(t("document_signe"));
      setSignDialog(null);
      router.refresh();
    } else {
      toast.error(r.error || "");
    }
  };

  const bannerRequests: PendingSignatureRequest[] = pendingSignatureRequests.map((r) => ({
    id: r.id,
    template: { id: r.template.id, title: r.template.title, key: r.template.key },
    dueDate: r.dueDate,
    reason: r.reason,
  }));

  const TABS: TabItem<TabKey>[] = [
    {
      key: "to-sign",
      label: t("signer_2"),
      icon: FileSignature,
      count: toSignTotal,
      dot: toSignTotal > 0,
    },
    { key: "contracts", label: t("contrats_2"), icon: FileCheck, count: contracts.length },
    { key: "payroll", label: t("paie_fiscal"), icon: Receipt, count: payStubs.length + taxDocs.length },
    { key: "letters", label: t("lettres"), icon: Mail, count: letterRequests.length },
    { key: "personal", label: t("mon_dossier"), icon: Award, count: personalDocs.length },
    {
      key: "signed",
      label: t("signes"),
      icon: CheckCircle2,
      count:
        mySignatures.length
        + myHandbookSignatures.length
        + contracts.filter((c) => c.employeeSignedAt).length,
    },
  ];

  return (
    <div className="space-y-4">
      {/* ====== Header navy ======
          Responsive : title row stack au-dessus du bouton sur mobile,
          ligne horizontale a partir de sm+. */}
      <div className="rounded-xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-4 sm:px-5 py-4 text-white relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32"
          aria-hidden
        />
        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center ring-2 ring-white/20 shrink-0">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold leading-tight">{t("mes_documents")}</h1>
              <p className="text-[11px] sm:text-xs text-white/80 leading-snug">
                {t("contrats_paie_documents_fiscaux_lettres")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => setLetterDialog(true)}
              className="h-8 text-[11px] sm:text-xs bg-white text-[#0F2D52] hover:bg-white/90 font-semibold w-full sm:w-auto"
            >
              <Mail className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              <span className="truncate">{t("demander_lettre")}</span>
            </Button>
          </div>
        </div>
      </div>


      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <DocumentStatsCard
          label={t("signer_2")}
          value={toSignTotal}
          icon={FileSignature}
          accent={toSignTotal > 0 ? "warning" : "success"}
          hint={toSignTotal > 0 ? t("documents_attente") : t("tout_jour")}
          onClick={toSignTotal > 0 ? () => setTab("to-sign") : undefined}
        />
        <DocumentStatsCard
          label={t("contrats_actifs")}
          value={activeContracts}
          icon={FileCheck}
          accent="info"
          hint={t("contrats_au_total", { count: contracts.length })}
          onClick={() => setTab("contracts")}
        />
        <DocumentStatsCard
          label={t("bulletins_mois")}
          value={payStubsThisMonth}
          icon={Receipt}
          accent="info"
          hint={`${payStubs.length} bulletin${payStubs.length > 1 ? "s" : ""} disponibles`}
          onClick={() => setTab("payroll")}
        />
        <DocumentStatsCard
          label={t("mon_dossier")}
          value={personalDocs.length}
          icon={Award}
          accent={personalDocsExpired.length > 0 ? "danger" : personalDocsExpiring.length > 0 ? "warning" : "navy"}
          hint={
            personalDocsExpired.length > 0
              ? `${personalDocsExpired.length} expire${personalDocsExpired.length > 1 ? "s" : ""}`
              : personalDocsExpiring.length > 0
                ? `${personalDocsExpiring.length} a renouveler`
                : t("diplomes_permis_certifications")
          }
          onClick={() => setTab("personal")}
        />
      </div>


      <div ref={sentinelRef} aria-hidden className="h-px" />

      {/* Portal : on injecte les KPIs DANS la module-nav mobile (sur la
          meme ligne que t("mon_espace")) au scroll. Plus de 2e bande !
          Slot cible : #vnk-module-nav-extra (defini dans module-sidebar-nav).
          createPortal est SSR-safe (rendu seulement apres hydration).
          Labels compacts pour rentrer sur tres petits ecrans :
          - <480px : t("sign_contr_doss")
          - >=480px : t("signer_contrats_dossier") (complet) */}
      {navExtraEl && scrolled
        ? createPortal(
            <div className="flex items-center gap-x-2 sm:gap-x-3 text-[11px] sm:text-xs whitespace-nowrap lg:hidden">
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">{t("sign")}</span>
                  <span className="hidden min-[480px]:inline">{t("signer")}</span>
                </span>
                <span className={toSignTotal > 0 ? "font-semibold text-amber-600" : "font-semibold text-emerald-600"}>
                  {toSignTotal}
                </span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">{t("contr")}</span>
                  <span className="hidden min-[480px]:inline">{t("contrats")}</span>
                </span>
                <span className="font-semibold">{activeContracts}</span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">{t("doss")}</span>
                  <span className="hidden min-[480px]:inline">{t("dossier")}</span>
                </span>
                <span className={personalDocsExpired.length > 0 ? "font-semibold text-red-600" : "font-semibold"}>
                  {personalDocs.length}
                </span>
              </span>
            </div>,
            navExtraEl,
          )
        : null}

      {/* Sticky container : tabs uniquement (mini-bar deplacee vers la
          module-nav via portal ci-dessus). Pattern conges + filtre KPIs
          dans module-nav au scroll.
          - Mobile : top-[92px] pt-4 → overlap 16px cache derriere module-nav.
          - Desktop (lg+) : top-[64px] pt-0 + mini-bar visible (pas de
            module-nav en haut sur desktop, elle devient sidebar). */}
      <div
        className={cn(
          "sticky top-[92px] pt-4 lg:top-[64px] lg:pt-0 z-20 bg-background",
          "-mx-4 sm:-mx-5 lg:mx-0 transition-shadow",
          scrolled ? "shadow-sm border-b" : "border-b border-transparent",
        )}
      >
        {/* Mini-bar info DESKTOP UNIQUEMENT (lg+).
            Mobile : les KPIs sont portales dans la module-nav (voir au-dessus). */}
        <div
          className={cn(
            "hidden lg:flex px-4 lg:px-4 items-center gap-x-5 py-2 text-xs",
            scrolled ? "lg:flex" : "lg:hidden",
          )}
        >
          <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r shrink-0">
            <FileText className="h-4 w-4" />
            {t("mes_documents")}
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">{t("signer")}</span>
            <span className={toSignTotal > 0 ? "font-semibold text-amber-600" : "font-semibold text-emerald-600"}>
              {toSignTotal}
            </span>
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">{t("contrats")}</span>
            <span className="font-semibold">{activeContracts}</span>
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">{t("dossier")}</span>
            <span className={personalDocsExpired.length > 0 ? "font-semibold text-red-600" : "font-semibold"}>
              {personalDocs.length}
            </span>
          </span>
        </div>


        <div className="px-4 sm:px-5 lg:px-4">
          <SettingsTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel={t("navigation_documents")} />
        </div>
      </div>

      {/* ====== Bandeaux d'actions urgentes ======
          Visibles UNIQUEMENT sur les tabs "to-sign" (signatures, cahiers)
          et "personal" (uploads en attente). Pas sur Contrats/Paie/Lettres/
          Signes pour ne pas polluer la lecture passive. */}


      {(tab === "to-sign" || tab === "personal") && (
        <MyUploadRequestsBanner
          requests={bannerUploadRequests}
          onUpload={openResponseFor}
        />
      )}


      {tab === "to-sign" && handbooksToSign.length > 0 && (
        <div className="rounded-md border border-[#0F2D52]/20 bg-gradient-to-br from-[#0F2D52]/5 to-[#15406d]/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#0F2D52]" />
            <h2 className="text-sm font-bold text-[#0F2D52]">
              Cahier{handbooksToSign.length > 1 ? "s" : ""} a signer ({handbooksToSign.length})
            </h2>
          </div>
          <p className="text-[11px] text-muted-foreground">{t("my_documents_view_ces_cahiers_regroupent_plusieurs_politiques_internes_signez")}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {handbooksToSign.map((hb) => (
              <div
                key={hb.id}
                className="rounded-md border bg-card p-3 flex flex-col gap-2.5"
              >

                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="h-9 w-9 rounded-md bg-[#0F2D52]/10 flex items-center justify-center shrink-0">
                    <BookOpen className="h-4 w-4 text-[#0F2D52]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold line-clamp-2 leading-snug break-words">{hb.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      <span>{hb.items.length} politique{hb.items.length > 1 ? "s" : ""}</span>
                      <span className="mx-1">·</span>
                      <span>v{hb.version}</span>
                      {hb.isRequired && (
                        <>
                          <span className="mx-1">·</span>
                          <span className="text-red-700 font-medium">{tc("required")}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  className="h-8 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white w-full"
                  onClick={() => {
                    setHandbookDialog({
                      id: hb.id,
                      title: hb.title,
                      subtitle: hb.subtitle ?? undefined,
                      coverIntro: hb.coverIntro ?? undefined,
                      version: hb.version,
                      signatureScope:
                        (hb.signatureScope as
                          | "employee_only"
                          | "employer_only"
                          | "both"
                          | "none") ?? "employee_only",
                      chapters: hb.items.map((it) => ({
                        templateId: it.template.id,
                        title: it.template.title,
                        bodyMarkdown: it.template.bodyMarkdown,
                      })),
                    });
                  }}
                >
                  <FileSignature className="h-3 w-3 mr-1" />
                  {t("ouvrir_cahier")}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}


      {tab === "to-sign" && (
        <SignatureRequestBanner requests={bannerRequests} onSign={(tplId) => openSignByTemplateId(tplId)} />
      )}

      {/* ====== Tab content ======
          NB : SettingsTabs deja dans le sticky container plus haut. */}
      {tab === "to-sign" && (
        <ToSignTab
          legalToSign={legalToSign}
          signatureRequests={pendingSignatureRequests}
          allLegalDocs={legalDocs}
          onSign={(tplId) => openSignByTemplateId(tplId)}
        />
      )}

      {tab === "contracts" && (
        <ContractsTab
          contracts={contracts}
          onPreview={(c) => {
            if (!c.pdfUrl) {
              toast.info(t("aucun_pdf_disponible_contrat"));
              return;
            }
            setPreviewPdf({
              url: c.pdfUrl,
              title: c.title,
              description: t("my_documents_view_p0_du_p1_p2", { p0: c.contractType, p1: formatDate(c.startDate, dateTag), p2: c.endDate ? ` au ${formatDate(c.endDate, dateTag)}` : "" }),
              filename: `${c.title}.pdf`,
            });
          }}
        />
      )}

      {tab === "payroll" && (
        <PayrollTab
          payStubs={payStubs}
          taxDocs={taxDocs}
          onPreviewStub={(s) => {
            const url = s.pdfUrl ?? `/api/admin/pay-stubs/${s.id}/pdf`;
            setPreviewPdf({
              url,
              title: `Bulletin ${formatPeriod(s.period.startDate, s.period.endDate, dateTag)}`,
              description: `Net : ${formatMoney(s.netPay, dateTag)} - Brut : ${formatMoney(s.grossPay, dateTag)}`,
              filename: `bulletin-${s.id}.pdf`,
            });
          }}
          onPreviewTax={(d) => {
            setPreviewPdf({
              url: d.fileUrl,
              title: d.title,
              description: `${TAX_TYPE_LABEL[d.type] ?? d.type}${d.taxYear ? ` - ${d.taxYear}` : ""}`,
              filename: d.title.replace(/\s+/g, "_") + ".pdf",
            });
          }}
        />
      )}

      {tab === "letters" && (
        <LettersTab
          letterRequests={letterRequests}
          onNew={() => setLetterDialog(true)}
          onPreview={(l) => {
            if (!l.letterUrl) {
              toast.info(t("lettre_n_pas_encore_disponible"));
              return;
            }
            setPreviewPdf({
              url: l.letterUrl,
              title: `Lettre d'emploi - ${PURPOSE_LABEL[l.purpose] ?? l.purpose}`,
              description: l.recipient ?? undefined,
              filename: `lettre-emploi-${l.id}.pdf`,
            });
          }}
        />
      )}

      {tab === "personal" && (
        <PersonalTab
          employeeId={employeeId}
          personalDocs={personalDocs}
          pendingUploadRequests={pendingUploadRequests}
          onRespond={openResponseFor}
          onPreview={(d) => {
            const url = `/api/admin/employees/${employeeId}/personal-docs/${d.id}/file`;
            setPreviewPdf({
              url,
              title: d.title,
              description: d.issuer ?? undefined,
              filename: d.fileName ?? `document-${d.id}`,
            });
          }}
          onDelete={(d) => setConfirmDelDoc(d)}
        />
      )}

      {tab === "signed" && (
        <SignedTab
          signatures={mySignatures}
          handbookSignatures={myHandbookSignatures}
          contracts={contracts}
          legalDocs={legalDocs}
          onOpenPdf={(item) => {
            if (item.pdfUrl) {
              setPreviewPdf({
                url: item.pdfUrl,
                title: item.title,
                description: item.description,
                filename: item.filename,
              });
            } else {
              toast.info(t("pdf_cours_generation_reessayez_quelques"));
            }
          }}
        />
      )}


      <SignaturePadDialog
        open={!!signDialog}
        doc={signDialog}
        onClose={() => setSignDialog(null)}
        onSigned={submitSignature}
      />

      <HandbookSignatureDialog
        open={!!handbookDialog}
        handbook={handbookDialog}
        employeeId={employeeId}
        onClose={() => setHandbookDialog(null)}
        onSigned={async (signatureDataUrl, checkboxStates) => {
          if (!handbookDialog) return;
          const states: Record<string, boolean> = {};
          for (const [k, v] of Object.entries(checkboxStates)) {
            states[String(k)] = v;
          }
          const r = await signHandbookAction({
            handbookId: handbookDialog.id,
            signatureData: signatureDataUrl,
            checkboxStates: states,
          });
          if (r.success) {
            toast.success(t("cahier_signe"));
            setHandbookDialog(null);
            router.refresh();
          } else {
            toast.error(r.error || "");
          }
        }}
      />

      <RequestLetterDialog
        open={letterDialog}
        onClose={() => setLetterDialog(false)}
        onSaved={() => router.refresh()}
      />

      <UploadDocumentResponseDialog
        open={!!responseDialog}
        request={responseDialog}
        onClose={() => setResponseDialog(null)}
        onUploaded={() => router.refresh()}
      />

      <PdfPreviewModal
        open={!!previewPdf}
        url={previewPdf?.url ?? null}
        title={previewPdf?.title ?? ""}
        description={previewPdf?.description}
        downloadFilename={previewPdf?.filename}
        onClose={() => setPreviewPdf(null)}
      />

      <ConfirmDialog
        open={!!confirmDelDoc}
        onOpenChange={(o) => !o && setConfirmDelDoc(null)}
        title={`Supprimer "${confirmDelDoc?.title ?? ""}" ?`}
        description={t("action_irreversible")}
        confirmLabel={tc("delete")}
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDelDoc) return;
          const r = await deletePersonalDocAction({ id: confirmDelDoc.id });
          if (r.success) {
            toast.success(t("document_supprime"));
            router.refresh();
          } else {
            toast.error(r.error || "");
          }
          setConfirmDelDoc(null);
        }}
      />
    </div>
  );
}

// ================================================================
//                       TAB : TO SIGN
// ================================================================
function ToSignTab({
  legalToSign,
  signatureRequests,
  allLegalDocs,
  onSign,
}: {
  legalToSign: LegalDoc[];
  signatureRequests: SignatureRequest[];
  allLegalDocs: LegalDoc[];
  onSign: (templateId: number) => void;
}) {
  const t = useTranslations("admin.my_documents");
  const dateTag = useDateLocale();



  const legalIds = new Set(legalToSign.map((d) => d.id));
  const extraFromRequests = signatureRequests
    .filter((r) => !legalIds.has(r.template.id))
    .map((r) => {
      const tpl = allLegalDocs.find((d) => d.id === r.template.id);
      return tpl ? { doc: tpl, request: r } : null;
    })
    .filter((x): x is { doc: LegalDoc; request: SignatureRequest } => !!x);

  if (legalToSign.length === 0 && extraFromRequests.length === 0) {
    return (
      <Card className="p-10 text-center space-y-3">
        <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-600" />
        <p className="text-sm font-semibold">{t("tout_jour")}</p>
        <p className="text-xs text-muted-foreground">
          {t("vous_avez_signe_tous_documents")}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {legalToSign.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("documents_obligatoires")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {legalToSign.map((d) => (
              <ToSignCard
                key={d.id}
                doc={d}
                badge={{
                  label: d.isRequired ? t("obligatoire") : t("optionnel"),
                  tone: d.isRequired ? "danger" : "neutral",
                }}
                iconTone="warning"
                onSign={() => onSign(d.id)}
              />
            ))}
          </div>
        </section>
      )}

      {extraFromRequests.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("signatures_demandees")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {extraFromRequests.map(({ doc, request }) => {
              const days = daysUntil(request.dueDate);
              const urgent = days !== null && days <= 3;
              return (
                <ToSignCard
                  key={request.id}
                  doc={doc}
                  subtitle={t("my_documents_view_demande_par_p0", { p0: request.requestedBy.fullName ?? request.requestedBy.email })}
                  iconTone={urgent ? "danger" : "warning"}
                  badge={
                    request.dueDate
                      ? {
                          label: urgent ? `Echeance J-${days}` : `Avant ${formatDate(request.dueDate, dateTag)}`,
                          tone: urgent ? "danger" : "warning",
                        }
                      : undefined
                  }
                  urgent={urgent}
                  onSign={() => onSign(doc.id)}
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// ================================================================
//                       TAB : CONTRACTS
// ================================================================
function ContractsTab({
  contracts,
  onPreview,
}: {
  contracts: Contract[];
  onPreview: (c: Contract) => void;
}) {
  const t = useTranslations("admin.my_documents");
  const dateTag = useDateLocale();
  if (contracts.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        {t("aucun_contrat_enregistre")}
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {contracts.map((c) => {
        const meta = CONTRACT_STATUS_LABEL[c.status] ?? { labelKey: "", tone: "neutral" as const };
        const subtitle = c.endDate
          ? t("contrat_du_au", { type: c.contractType, from: formatDate(c.startDate, dateTag), to: formatDate(c.endDate, dateTag) })
          : t("contrat_du", { type: c.contractType, from: formatDate(c.startDate, dateTag) });
        return (
          <div key={c.id} className="space-y-1.5">
            <DocumentCard
              icon={FileCheck}
              title={c.title}
              subtitle={subtitle}
              iconTone="info"
              status={{ label: meta.labelKey ? t(meta.labelKey) : c.status, tone: meta.tone }}
              date={formatDate(c.createdAt, dateTag)}
              onPreview={c.pdfUrl ? () => onPreview(c) : undefined}


              onDownload={c.pdfUrl ? () => onPreview(c) : undefined}
            />
            <div className="flex flex-wrap gap-1.5 pl-1">
              <SignatureStatusBadge
                employeeSignedAt={c.employeeSignedAt}
                employerSignedAt={c.employerSignedAt}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ================================================================
//                       CARD : TO SIGN
// ================================================================
function ToSignCard({
  doc,
  badge,
  subtitle,
  iconTone,
  urgent,
  onSign,
}: {
  doc: LegalDoc;
  badge?: { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" };
  subtitle?: string;
  iconTone: "warning" | "danger" | "info" | "success" | "neutral";
  urgent?: boolean;
  onSign: () => void;
}) {
  const t = useTranslations("admin.my_documents");





  return (
    <DocumentCard
      icon={FileSignature}
      title={doc.title}
      subtitle={subtitle ?? `v${doc.version}`}
      iconTone={iconTone}
      status={badge}
      primaryAction={{
        label: t("lire_signer"),
        icon: FileSignature,
        onClick: onSign,
        tone: urgent ? "danger" : "primary",
      }}
    />
  );
}

// ================================================================
//                       TAB : PAYROLL & TAX
// ================================================================
function PayrollTab({
  payStubs,
  taxDocs,
  onPreviewStub,
  onPreviewTax,
}: {
  payStubs: PayStub[];
  taxDocs: TaxDoc[];
  onPreviewStub: (s: PayStub) => void;
  onPreviewTax: (d: TaxDoc) => void;
}) {
  const t = useTranslations("admin.my_documents");
  const dateTag = useDateLocale();
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Receipt className="h-3.5 w-3.5 text-[#0F2D52]" />
          {t("bulletins_paie")}
        </h2>
        {payStubs.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            {t("aucun_bulletin_disponible")}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {payStubs.map((s) => (
              <DocumentCard
                key={s.id}
                icon={CreditCard}
                title={`Bulletin ${formatPeriod(s.period.startDate, s.period.endDate, dateTag)}`}
                subtitle={`Net : ${formatMoney(s.netPay, dateTag)} - Brut : ${formatMoney(s.grossPay, dateTag)}`}
                iconTone="info"
                date={s.releasedAt ? t("my_documents_view_emis_le_p0", { p0: formatDate(s.releasedAt, dateTag) }) : undefined}
                onPreview={() => onPreviewStub(s)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-[#0F2D52]" />
          {t("documents_fiscaux")}
        </h2>
        {taxDocs.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">{t("my_documents_view_aucun_document_fiscal_pour_l_instant")}</Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {taxDocs.map((d) => (
              <DocumentCard
                key={d.id}
                icon={FileText}
                title={d.title}
                subtitle={`${TAX_TYPE_LABEL[d.type] ?? d.type}${d.taxYear ? ` - ${d.taxYear}` : ""}`}
                iconTone="success"
                date={t("my_documents_view_emis_le_p0", { p0: formatDate(d.issuedAt, dateTag) })}
                onPreview={() => onPreviewTax(d)}


                onDownload={() => onPreviewTax(d)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ================================================================
//                       TAB : LETTERS
// ================================================================
function LettersTab({
  letterRequests,
  onNew,
  onPreview,
}: {
  letterRequests: LetterRequest[];
  onNew: () => void;
  onPreview: (l: LetterRequest) => void;
}) {
  const t = useTranslations("admin.my_documents");
  const dateTag = useDateLocale();
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">
          {letterRequests.length} demande{letterRequests.length > 1 ? "s" : ""}
        </p>
        <Button size="sm" onClick={onNew} className="h-8 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {t("demander_nouvelle_lettre")}
        </Button>
      </div>

      {letterRequests.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <Mail className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {t("pas_encore_demande_lettre_emploi")}
          </p>
          <Button size="sm" onClick={onNew} className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {t("premiere_demande")}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {letterRequests.map((l) => {
            const statusBadge =
              l.status === "issued"
                ? { label: t("emise"), tone: "success" as const }
                : l.status === "rejected"
                  ? { label: t("refusee"), tone: "danger" as const }
                  : { label: t("attente"), tone: "warning" as const };
            return (
              <DocumentCard
                key={l.id}
                icon={Mail}
                title={PURPOSE_LABEL[l.purpose] ?? l.purpose}
                subtitle={
                  l.recipient
                    ? `Destinataire : ${l.recipient}`
                    : t("my_documents_view_demandee_le_p0", { p0: formatDate(l.createdAt, dateTag) })
                }
                iconTone={l.status === "issued" ? "success" : "warning"}
                status={statusBadge}
                date={l.issuedAt ? t("my_documents_view_emise_le_p0", { p0: formatDate(l.issuedAt, dateTag) }) : t("my_documents_view_demande_le_p0", { p0: formatDate(l.createdAt, dateTag) })}
                onPreview={l.letterUrl ? () => onPreview(l) : undefined}

                onDownload={l.letterUrl ? () => onPreview(l) : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ================================================================
//                       TAB : PERSONAL
// ================================================================
function PersonalTab({
  employeeId,
  personalDocs,
  pendingUploadRequests,
  onRespond,
  onPreview,
  onDelete,
}: {
  employeeId: number;
  personalDocs: PersonalDoc[];
  pendingUploadRequests: UploadRequest[];
  onRespond: (requestId: number) => void;
  onPreview: (d: PersonalDoc) => void;
  onDelete: (d: PersonalDoc) => void;
}) {
  const t = useTranslations("admin.my_documents");
  const tc = useTranslations("common");
  const dateTag = useDateLocale();
  void employeeId;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  const categories = useMemo(() => {
    const set = new Set<string>();
    personalDocs.forEach((d) => set.add(d.category));
    return Array.from(set);
  }, [personalDocs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return personalDocs.filter((d) => {
      if (category !== "all" && d.category !== category) return false;
      if (q && !`${d.title} ${d.issuer ?? ""} ${d.referenceNumber ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [personalDocs, search, category]);

  return (
    <div className="space-y-4">

      {pendingUploadRequests.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Inbox className="h-3.5 w-3.5 text-[#0F2D52]" />
            Demandes en attente ({pendingUploadRequests.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingUploadRequests.map((r) => {
              const due = r.dueDate ? formatDate(r.dueDate, dateTag) : null;
              const days = r.dueDate ? Math.floor((new Date(r.dueDate).getTime() - Date.now()) / 86400000) : null;
              const urgent = days !== null && days <= 3;
              return (
                <Card
                  key={r.id}
                  className={`p-4 space-y-2 border-l-4 ${urgent ? "border-l-red-500" : "border-l-amber-500"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{r.title}</p>
                      {r.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                          {r.description}
                        </p>
                      )}
                    </div>
                    {r.isRequired && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-semibold shrink-0">
                        {tc("required")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <CalendarClock className="h-3 w-3" />
                      {due ? (urgent && days! >= 0 ? t("my_documents_view_echeance_j_p0", { p0: days }) : t("my_documents_view_avant_le_p0", { p0: due })) : t("sans_echeance")}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => onRespond(r.id)}
                      className={`h-7 text-[11px] text-white ${
                        urgent ? "bg-red-600 hover:bg-red-700" : "bg-[#0F2D52] hover:bg-[#1a3a66]"
                      }`}
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      {tc("upload")}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}


      <section className="space-y-2">
        {pendingUploadRequests.length > 0 && (
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Award className="h-3.5 w-3.5 text-[#0F2D52]" />
            Documents validés ({personalDocs.length})
          </h2>
        )}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("rechercher_document")}
            className="h-9 text-sm flex-1"
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 text-sm sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("toutes_categories")}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <Award className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm font-semibold">{t("aucun_document")}</p>
          <p className="text-xs text-muted-foreground">{t("my_documents_view_les_rh_ou_votre_superviseur_vous_demanderont")}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((d) => {
            const cardData: PersonalDocCardData = {
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
            };
            return (
              <div key={d.id} className="space-y-1">
                <PersonalDocCard
                  doc={cardData}
                  onPreview={d.fileUrl ? () => onPreview(d) : undefined}
                  onDownload={d.fileUrl ? () => onPreview(d) : undefined}
                  onDelete={() => onDelete(d)}
                />
                {d.isVerified && (
                  <p className="text-[10px] text-emerald-700 pl-1 inline-flex items-center gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {t("verifie_rh")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
      </section>
    </div>
  );
}

// ================================================================
//                       TAB : SIGNED
// ================================================================
// Historique UNIFIE de tout ce que l'employe a signe :
//   - Politiques / NDA / acknowledgments (LegalDocumentSignature)
//   - Cahiers / handbooks (DocumentHandbookSignature)
//   - Contrats d'emploi (EmployeeContract avec employeeSignedAt non-null)
//
// Tri global par date de signature decroissante (plus recent en haut).
// Chaque card a un badge "Type" pour distinguer (Politique / Cahier / Contrat).
// Click ouvre le PDF si disponible.

type SignedItem = {
  key: string;
  type: "Politique" | "Cahier" | "Contrat";
  title: string;
  description: string;
  date: string; // ISO
  pdfUrl: string | null;
  filename: string;
  /** Si politique : id signature legale pour permettre la regeneration cote
   *  employe (regenerateMyOwnSignedPdfAction). Null pour Cahier/Contrat. */
  legalSignatureId: number | null;
};

function SignedTab({
  signatures,
  handbookSignatures,
  contracts,
  legalDocs,
  onOpenPdf,
}: {
  signatures: Signature[];
  handbookSignatures: HandbookSignature[];
  contracts: Contract[];
  legalDocs: LegalDoc[];
  onOpenPdf: (item: SignedItem) => void;
}) {
  const t = useTranslations("admin.my_documents");
  const router = useRouter();
  const dateTag = useDateLocale();





  const autoRegenTriedRef = useRef<Set<number>>(new Set());
  const [autoRegenBusy, setAutoRegenBusy] = useState(false);

  useEffect(() => {
    const broken = signatures.filter(
      (s) => !s.finalPdfUrl && !autoRegenTriedRef.current.has(s.id),
    );
    if (broken.length === 0) return;
    broken.forEach((s) => autoRegenTriedRef.current.add(s.id));
    setAutoRegenBusy(true);
    Promise.all(
      broken.map((s) =>
        regenerateMyOwnSignedPdfAction({ signatureId: s.id }).catch(() => ({
          success: false as const,
          error: t("echec_silencieux"),
        })),
      ),
    )
      .then((results) => {
        const okCount = results.filter((r) => r.success).length;
        if (okCount > 0) router.refresh();
      })
      .finally(() => setAutoRegenBusy(false));
  }, [signatures, router]);
  const tplMap = useMemo(() => {
    const m = new Map<number, LegalDoc>();
    for (const d of legalDocs) m.set(d.id, d);
    return m;
  }, [legalDocs]);


  const items = useMemo<SignedItem[]>(() => {
    const result: SignedItem[] = [];


    for (const sig of signatures) {
      const tpl = tplMap.get(sig.templateId);
      const title = sig.template?.title ?? tpl?.title ?? `Document #${sig.templateId}`;
      const keySuffix = sig.template?.key ?? tpl?.key ?? "document";
      result.push({
        key: `legal-${sig.id}`,
        type: "Politique",
        title,
        description: t("my_documents_view_v_p0_signe_le_p1", { p0: sig.version, p1: formatDate(sig.signedAt, dateTag) }),
        date: sig.signedAt,
        pdfUrl: sig.finalPdfUrl,
        filename: `${keySuffix}-signe.pdf`,
        legalSignatureId: sig.id,
      });
    }


    for (const hs of handbookSignatures) {
      const title = hs.handbook?.title ?? `Cahier #${hs.handbookId}`;
      const keySuffix = hs.handbook?.key ?? "cahier";
      result.push({
        key: `handbook-${hs.id}`,
        type: "Cahier",
        title,
        description: t("my_documents_view_v_p0_signe_le_p1", { p0: hs.version, p1: formatDate(hs.signedAt, dateTag) }),
        date: hs.signedAt,
        pdfUrl: hs.finalPdfUrl,
        filename: `${keySuffix}-signe.pdf`,
        legalSignatureId: null,
      });
    }


    for (const c of contracts) {
      if (!c.employeeSignedAt) continue;
      const fullySigned = !!c.employerSignedAt;
      result.push({
        key: `contract-${c.id}`,
        type: "Contrat",
        title: c.title,
        description: fullySigned
          ? t("my_documents_view_p0_signe_le_p1_contresigne", { p0: c.contractType, p1: formatDate(c.employeeSignedAt, dateTag) })
          : t("my_documents_view_p0_signe_le_p1_en_attente_rh", { p0: c.contractType, p1: formatDate(c.employeeSignedAt, dateTag) }),
        date: c.employeeSignedAt,
        pdfUrl: c.pdfUrl,
        filename: `${c.title.replace(/\s+/g, "-").toLowerCase()}.pdf`,
        legalSignatureId: null,
      });
    }


    result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return result;
  }, [signatures, handbookSignatures, contracts, tplMap]);

  if (items.length === 0) {
    return (
      <Card className="p-10 text-center space-y-3">
        <CheckCircle2 className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <p className="text-sm font-semibold">{t("aucune_signature_enregistree")}</p>
        <p className="text-xs text-muted-foreground">
          {t("signatures_politiques_cahiers_contrats_apparaitront")}
        </p>
      </Card>
    );
  }


  const iconByType: Record<SignedItem["type"], typeof CheckCircle2> = {
    Politique: ScrollText,
    Cahier: BookOpen,
    Contrat: FileCheck,
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {items.length} signature{items.length > 1 ? "s" : ""} enregistree{items.length > 1 ? "s" : ""}.
        Politiques, cahiers et contrats reunis. Cliquez pour voir le PDF.
      </p>
      {autoRegenBusy && (
        <div className="rounded-md border border-[#0F2D52]/20 bg-[#0F2D52]/5 px-3 py-2 text-xs text-[#0F2D52] inline-flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("generation_pdfs_cours")}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((item) => {
          const Icon = iconByType[item.type];



          const isPolicy = item.legalSignatureId !== null;
          const statusLabel = item.pdfUrl
            ? t("pdf_disponible")
            : isPolicy
              ? t("generation")
              : t("indisponible");
          return (
            <DocumentCard
              key={item.key}
              icon={Icon}
              title={item.title}
              subtitle={item.description}
              iconTone="success"
              status={{
                label: statusLabel,
                tone: item.pdfUrl ? "success" : "neutral",
              }}
              badges={[{ label: t(`type_${item.type.toLowerCase()}`), tone: "info" }]}
              date={formatDate(item.date, dateTag)}
              onPreview={item.pdfUrl ? () => onOpenPdf(item) : undefined}
              onDownload={item.pdfUrl ? () => onOpenPdf(item) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

// ================================================================
//                  DIALOG : Request employment letter
// ================================================================
function RequestLetterDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.my_documents");
  const tc = useTranslations("common");
  const [purpose, setPurpose] = useState<"bank" | "rental" | "embassy" | "hypothec" | "other">("bank");
  const [recipient, setRecipient] = useState("");
  const [includeSalary, setIncludeSalary] = useState(true);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setPurpose("bank");
      setRecipient("");
      setIncludeSalary(true);
      setNotes("");
      setPending(false);
    }
  }, [open]);

  const submit = async () => {
    setPending(true);
    const r = await requestEmploymentLetterAction({
      purpose,
      recipient: recipient.trim() || null,
      includeSalary,
      notes: notes.trim() || null,
    });
    setPending(false);
    if (r.success) {
      toast.success(t("demande_envoyee_rh"));
      onSaved();
      onClose();
    } else {
      toast.error(r.error || "");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Mail className="h-4 w-4" />{t("my_documents_view_demander_une_lettre_d_emploi")}</DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {t("rh_rediront_vous_mettront_disposition")}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <FormSection icon={Mail} title={t("details_demande")}>
            <Field label={t("quel_usage")} required>
              <Select value={purpose} onValueChange={(v) => setPurpose(v as typeof purpose)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">{t("banque")}</SelectItem>
                  <SelectItem value="rental">{t("location_logement")}</SelectItem>
                  <SelectItem value="embassy">{t("ambassade_immigration")}</SelectItem>
                  <SelectItem value="hypothec">{t("hypotheque")}</SelectItem>
                  <SelectItem value="other">{t("autre")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("destinataire_optionnel")}>
              <Input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={t("ex_banque_royale_proprietaire_x")}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={includeSalary}
                onChange={(e) => setIncludeSalary(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-[#0F2D52]"
              />
              {t("inclure_salaire_annuel_lettre")}
            </label>
            <Field label={t("notes_rh")}>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="text-sm resize-y"
                placeholder={t("precisions_urgence_format_particulier")}
              />
            </Field>
          </FormSection>
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {tc("cancel")}
          </Button>
          <Button onClick={submit} disabled={pending} className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white">
            {pending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
            Envoyer la demande
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
