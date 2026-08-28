"use client";
// =============================================================
// LettersView — gestion admin des demandes de lettres d'emploi.
//
// Convention VNK : header navy gradient + DocumentStatsCard +
// sticky bar Finance + DocumentCard + modals header navy +
// PdfPreviewModal + ActionTooltip + ConfirmDialog.
// =============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { useDateLocale } from "@/lib/i18n-format";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Mail,
  CheckCircle2,
  XCircle,
  FileText,
  Loader2,
  Send,
  Sparkles,
  Inbox,
  Archive,
  Layers,
  Clock,
  UploadCloud,
  Calendar,
  Building2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { DocumentStatsCard } from "@/components/admin/document-stats-card";
import { DocumentCard } from "@/components/admin/document-card";
import { SettingsTabs, type TabItem } from "@/components/admin/settings-tabs";
import { FormSection, Field } from "@/components/admin/form-section";
import { FileUploadInput } from "@/components/admin/file-upload-input";
import { PdfPreviewModal } from "@/components/admin/pdf-preview-modal";
import { promptDialog } from "@/components/admin/prompt-dialog";
import { cn } from "@/lib/utils";
import {
  issueEmploymentLetterAction,
  rejectEmploymentLetterAction,
} from "@/app/actions/hr-tax-docs";

// ---------- Types -----------------------------------------------
type Req = {
  id: number;
  purpose: string;
  recipient: string | null;
  includeSalary: boolean;
  status: string;
  notes: string | null;
  letterUrl: string | null;
  createdAt: string;
  issuedAt: string | null;
  admin: { id: number; fullName: string | null; email: string; avatarUrl: string | null };
};

type TabKey = "pending" | "issued" | "rejected" | "all";

const PURPOSE_KEY: Record<string, string> = {
  bank: "banque",
  rental: "location",
  embassy: "ambassade_immigration",
  hypothec: "hypotheque",
  other: "autre",
};

const STATUS_KEY: Record<string, string> = {
  pending: "attente_statut",
  issued: "emise",
  rejected: "refusee",
};

// ---------- Helpers ---------------------------------------------
function formatDate(iso: string | null | undefined, tag: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric" });
}

function daysBetween(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function initials(name: string | null, email: string): string {
  const src = (name || email || "").trim();
  if (!src) return "?";
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return src[0].toUpperCase();
  return ((parts[0][0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

// ================================================================
//                       MAIN VIEW
// ================================================================
export function LettersView({ requests }: { requests: Req[] }) {
  const t = useTranslations("admin.letters");
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("pending");
  const [search, setSearch] = useState("");
  const [issueDialog, setIssueDialog] = useState<Req | null>(null);
  const [detailDialog, setDetailDialog] = useState<Req | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{
    url: string;
    title: string;
    description?: string;
    filename?: string;
  } | null>(null);


  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-64px 0px 0px 0px" }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, []);


  const [navExtraEl, setNavExtraEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setNavExtraEl(document.getElementById("vnk-module-nav-extra"));
  }, []);


  const kpis = useMemo(() => {
    const pending = requests.filter((r) => r.status === "pending");
    const issued = requests.filter((r) => r.status === "issued");
    const rejected = requests.filter((r) => r.status === "rejected");


    const now = new Date();
    const month0 = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const issuedThisMonth = issued.filter((r) => {
      if (!r.issuedAt) return false;
      const t = new Date(r.issuedAt).getTime();
      return Number.isFinite(t) && t >= month0;
    }).length;


    const treated = requests.filter((r) => r.status !== "pending" && r.issuedAt);
    let avgHours: number | null = null;
    if (treated.length > 0) {
      const sum = treated.reduce((acc, r) => {
        const c = new Date(r.createdAt).getTime();
        const i = new Date(r.issuedAt!).getTime();
        return acc + Math.max(0, (i - c) / 3600000);
      }, 0);
      avgHours = sum / treated.length;
    }


    const oldestPendingDays = pending.reduce<number>((acc, r) => {
      const d = daysBetween(r.createdAt);
      return d !== null && d > acc ? d : acc;
    }, 0);

    return {
      total: requests.length,
      pending: pending.length,
      issued: issued.length,
      rejected: rejected.length,
      issuedThisMonth,
      avgHours,
      oldestPendingDays,
    };
  }, [requests]);


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests
      .filter((r) => {
        if (tab === "pending" && r.status !== "pending") return false;
        if (tab === "issued" && r.status !== "issued") return false;
        if (tab === "rejected" && r.status !== "rejected") return false;
        if (q) {
          const hay = `${r.admin.fullName ?? ""} ${r.admin.email} ${
            PURPOSE_KEY[r.purpose] ?? r.purpose
          } ${r.recipient ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [requests, tab, search]);

  const TABS: TabItem<TabKey>[] = [
    {
      key: "pending",
      label: t("traiter"),
      icon: Inbox,
      count: kpis.pending,
      dot: kpis.pending > 0,
    },
    { key: "issued", label: t("emises_2"), icon: CheckCircle2, count: kpis.issued },
    { key: "rejected", label: t("refusees_2"), icon: XCircle, count: kpis.rejected },
    { key: "all", label: t("toutes"), icon: Layers, count: kpis.total },
  ];


  const handleReject = async (r: Req) => {
    const reason = await promptDialog({
      title: t("refuser_demande_lettre"),
      label: t("motif_refus"),
      placeholder: t("sera_communique_employe"),
      multiline: true,
      required: true,
      variant: "destructive",
      confirmLabel: t("refuser"),
    });
    if (!reason) return;
    const res = await rejectEmploymentLetterAction({ id: r.id, reason });
    if (res.success) {
      toast.success(t("demande_refusee"));
      router.refresh();
      setDetailDialog(null);
    } else {
      toast.error(res.error || "");
    }
  };

  return (
    <div className="space-y-4">

      <div className="rounded-xl bg-gradient-to-r from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-4 sm:px-5 py-4 text-white relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32"
          aria-hidden
        />
        <div className="relative flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center ring-2 ring-white/20 shrink-0">
              <Mail className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold">{t("lettres_apos_emploi")}</h1>
              <p className="text-xs text-white/80">{t("letters_view_demandes_des_employes_banque_location_ambassade_hypotheque")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {kpis.pending > 0 && (
              <Badge
                variant="outline"
                className="bg-amber-500/20 text-white border-amber-200/40 text-[11px]"
              >
                <Inbox className="h-3 w-3 mr-1" />
                {kpis.pending} a traiter
              </Badge>
            )}
          </div>
        </div>
      </div>


      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <DocumentStatsCard
          label={t("attente_2")}
          value={kpis.pending}
          icon={Inbox}
          accent={kpis.pending > 0 ? "warning" : "success"}
          hint={
            kpis.oldestPendingDays > 0
              ? `Plus ancienne : J-${kpis.oldestPendingDays}`
              : t("aucune_demande_attente")
          }
          onClick={() => setTab("pending")}
        />
        <DocumentStatsCard
          label={t("emises_mois")}
          value={kpis.issuedThisMonth}
          icon={CheckCircle2}
          accent="success"
          hint={t("emises_au_total", { count: kpis.issued })}
          onClick={() => setTab("issued")}
        />
        <DocumentStatsCard
          label={t("delai_moyen")}
          value={kpis.avgHours !== null ? formatHours(kpis.avgHours) : "-"}
          icon={Clock}
          accent={kpis.avgHours !== null && kpis.avgHours > 72 ? "warning" : "info"}
          hint={t("temps_moyen_traitement")}
        />
        <DocumentStatsCard
          label={t("total_demandes")}
          value={kpis.total}
          icon={Layers}
          accent="info"
          hint={`${kpis.rejected} refusees`}
          onClick={() => setTab("all")}
        />
      </div>


      <div ref={sentinelRef} aria-hidden className="h-px" />


      {navExtraEl && scrolled
        ? createPortal(
            <div className="flex items-center gap-x-2 sm:gap-x-3 text-[11px] sm:text-xs whitespace-nowrap lg:hidden">
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">{t("att")}</span>
                  <span className="hidden min-[480px]:inline">{t("attente")}</span>
                </span>
                <span className={cn("font-semibold", kpis.pending > 0 ? "text-amber-600" : "text-emerald-600")}>
                  {kpis.pending}
                </span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">{t("emi")}</span>
                  <span className="hidden min-[480px]:inline">{t("emises")}</span>
                </span>
                <span className="font-semibold text-emerald-700">{kpis.issued}</span>
              </span>
              {kpis.rejected > 0 && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="inline-flex items-baseline gap-1">
                    <span className="text-muted-foreground">
                      <span className="min-[480px]:hidden">{t("ref")}</span>
                      <span className="hidden min-[480px]:inline">{t("refusees")}</span>
                    </span>
                    <span className="font-semibold text-red-600">{kpis.rejected}</span>
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
            <Mail className="h-4 w-4" />
            {t("lettres_apos_emploi")}
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">{t("attente")}</span>
            <span className={cn("font-semibold", kpis.pending > 0 ? "text-amber-600" : "text-emerald-600")}>
              {kpis.pending}
            </span>
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">{t("emises")}</span>
            <span className="font-semibold text-emerald-700">{kpis.issued}</span>
          </span>
          {kpis.rejected > 0 && (
            <span className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-muted-foreground">{t("refusees")}</span>
              <span className="font-semibold text-red-600">{kpis.rejected}</span>
            </span>
          )}
        </div>
        <div className="px-4 sm:px-5 lg:px-4">
          <SettingsTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel={t("filtre_lettres")} />
        </div>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("rechercher_employe_type_destinataire")}
        className="h-9 text-sm"
      />


      {filtered.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <Mail className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {tab === "pending"
              ? t("aucune_demande_attente_2")
              : tab === "issued"
                ? t("aucune_lettre_emise")
                : tab === "rejected"
                  ? t("aucune_demande_refusee")
                  : t("aucune_demande_moment")}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((r) => (
            <LetterRequestCard
              key={r.id}
              req={r}
              onPreview={() =>
                setPdfPreview({
                  url: `/api/admin/employment-letters/${r.id}/pdf`,
                  title: `Lettre d'emploi - ${PURPOSE_KEY[r.purpose] ?? r.purpose}`,
                  description: r.admin.fullName || r.admin.email,
                  filename: `lettre-emploi-${r.id}.pdf`,
                })
              }
              onIssue={() => setIssueDialog(r)}
              onReject={() => handleReject(r)}
              onDetails={() => setDetailDialog(r)}
            />
          ))}
        </div>
      )}


      <IssueLetterDialog
        req={issueDialog}
        onClose={() => setIssueDialog(null)}
        onSaved={() => {
          router.refresh();
          setDetailDialog(null);
        }}
      />

      <RequestDetailDialog
        req={detailDialog}
        onClose={() => setDetailDialog(null)}
        onIssue={(r) => {
          setDetailDialog(null);
          setIssueDialog(r);
        }}
        onReject={handleReject}
        onPreview={(r) =>
          setPdfPreview({
            url: `/api/admin/employment-letters/${r.id}/pdf`,
            title: `Lettre d'emploi - ${PURPOSE_KEY[r.purpose] ?? r.purpose}`,
            description: r.admin.fullName || r.admin.email,
            filename: `lettre-emploi-${r.id}.pdf`,
          })
        }
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

// ================================================================
//                CARD : Letter request
// ================================================================
function LetterRequestCard({
  req,
  onPreview,
  onIssue,
  onReject,
  onDetails,
}: {
  req: Req;
  onPreview: () => void;
  onIssue: () => void;
  onReject: () => void;
  onDetails: () => void;
}) {
  const t = useTranslations("admin.letters");
  const dateTag = useDateLocale();
  const pending = req.status === "pending";
  const issued = req.status === "issued";
  const rejected = req.status === "rejected";
  const ageDays = daysBetween(req.createdAt);
  const urgent = pending && ageDays !== null && ageDays >= 3;

  const statusTone: "warning" | "success" | "danger" | "neutral" = pending
    ? "warning"
    : issued
      ? "success"
      : rejected
        ? "danger"
        : "neutral";

  return (
    <Card className="vnk-card-hover overflow-hidden">
      <div className="p-4 space-y-3">

        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 ring-1 ring-[#0F2D52]/15">
            {req.admin.avatarUrl && (
              <AvatarImage
                src={req.admin.avatarUrl}
                alt={req.admin.fullName ?? req.admin.email}
              />
            )}
            <AvatarFallback className="bg-[#0F2D52]/10 text-[#0F2D52]">
              {initials(req.admin.fullName, req.admin.email)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={onDetails}
              className="block text-left w-full"
            >
              <p className="text-sm font-semibold text-foreground truncate hover:text-[#0F2D52]">
                {req.admin.fullName ?? req.admin.email}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">{req.admin.email}</p>
            </button>
          </div>

          <div className="shrink-0">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                statusTone === "warning" && "bg-amber-50 text-amber-700 border-amber-200",
                statusTone === "success" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                statusTone === "danger" && "bg-red-50 text-red-700 border-red-200",
                statusTone === "neutral" && "bg-muted text-muted-foreground"
              )}
            >
              {STATUS_KEY[req.status] ?? req.status}
            </Badge>
          </div>
        </div>


        <div className="rounded-md border bg-muted/20 px-3 py-2 space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-[#0F2D52] shrink-0" />
            <span className="font-semibold">{PURPOSE_KEY[req.purpose] ?? req.purpose}</span>
            {req.includeSalary ? (
              <Badge
                variant="outline"
                className="text-[10px] bg-sky-50 text-sky-700 border-sky-200"
              >
                {t("salaire")}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {t("sans_salaire")}
              </Badge>
            )}
          </div>
          {req.recipient && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{req.recipient}</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Demande {formatDate(req.createdAt, dateTag)}
            </span>
            {issued && req.issuedAt && (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                Emise {formatDate(req.issuedAt, dateTag)}
              </span>
            )}
            {pending && ageDays !== null && (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  urgent ? "text-amber-700 font-semibold" : "text-muted-foreground"
                )}
              >
                <Clock className="h-3 w-3" />
                J-{ageDays}
              </span>
            )}
          </div>
        </div>


        {req.notes && (
          <p
            className={cn(
              "text-[11px] italic line-clamp-2 rounded-md px-2 py-1.5",
              rejected
                ? "bg-red-50 text-red-700 border border-red-100"
                : "bg-muted/40 text-muted-foreground"
            )}
          >
            {rejected ? t("motif_refus_prefixe") : ""}
            {req.notes}
          </p>
        )}


        <div className="flex items-center justify-end gap-1 pt-1 border-t">
          <ActionTooltip label={t("voir_detail")}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onDetails}
              aria-label={t("detail")}
            >
              <FileText className="h-4 w-4" />
            </Button>
          </ActionTooltip>
          {(issued || pending) && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={onPreview}
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              {t("apercu_pdf")}
            </Button>
          )}
          {pending && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs hover:text-destructive"
                onClick={onReject}
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                {t("refuser")}
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
                onClick={onIssue}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                {t("emettre")}
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

// ================================================================
//              DIALOG : Detail demande
// ================================================================
function RequestDetailDialog({
  req,
  onClose,
  onIssue,
  onReject,
  onPreview,
}: {
  req: Req | null;
  onClose: () => void;
  onIssue: (r: Req) => void;
  onReject: (r: Req) => void;
  onPreview: (r: Req) => void;
}) {
  const t = useTranslations("admin.letters");
  const tc = useTranslations("common");
  const dateTag = useDateLocale();
  if (!req) return null;
  const issued = req.status === "issued";
  const pending = req.status === "pending";
  const rejected = req.status === "rejected";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0" />
              {t("demande_lettre_apos_emploi")}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {PURPOSE_KEY[req.purpose] ?? req.purpose} -{" "}
              {req.admin.fullName ?? req.admin.email}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <FormSection icon={Sparkles} title={t("demandeur")}>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 ring-1 ring-[#0F2D52]/15">
                {req.admin.avatarUrl && (
                  <AvatarImage
                    src={req.admin.avatarUrl}
                    alt={req.admin.fullName ?? req.admin.email}
                  />
                )}
                <AvatarFallback className="bg-[#0F2D52]/10 text-[#0F2D52]">
                  {initials(req.admin.fullName, req.admin.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">
                  {req.admin.fullName ?? req.admin.email}
                </p>
                <p className="text-xs text-muted-foreground truncate">{req.admin.email}</p>
              </div>
            </div>
          </FormSection>

          <FormSection icon={FileText} title={t("details")}>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {t("type")}
                </p>
                <p className="font-medium mt-0.5">
                  {PURPOSE_KEY[req.purpose] ?? req.purpose}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {t("salaire_inclus")}
                </p>
                <p className="font-medium mt-0.5">{req.includeSalary ? t("oui") : t("non")}</p>
              </div>
              {req.recipient && (
                <div className="col-span-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {t("destinataire")}
                  </p>
                  <p className="font-medium mt-0.5">{req.recipient}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {t("demande")}
                </p>
                <p className="font-medium mt-0.5">{formatDate(req.createdAt, dateTag)}</p>
              </div>
              {req.issuedAt && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {rejected ? t("refusee") : t("emise")}
                  </p>
                  <p className="font-medium mt-0.5">{formatDate(req.issuedAt, dateTag)}</p>
                </div>
              )}
            </div>

            {req.notes && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  {rejected ? t("motif_refus") : t("note_employe")}
                </p>
                <p
                  className={cn(
                    "text-xs rounded-md px-3 py-2 italic",
                    rejected
                      ? "bg-red-50 text-red-700 border border-red-100"
                      : "bg-muted/30 text-foreground"
                  )}
                >
                  &laquo; {req.notes} &raquo;
                </p>
              </div>
            )}
          </FormSection>
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0 gap-2 flex-wrap">
          <Button variant="outline" onClick={onClose}>
            {tc("close")}
          </Button>
          {(issued || pending) && (
            <Button
              variant="outline"
              onClick={() => onPreview(req)}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              {t("apercu_pdf")}
            </Button>
          )}
          {pending && (
            <>
              <Button
                variant="outline"
                className="hover:text-destructive"
                onClick={() => onReject(req)}
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                {t("refuser")}
              </Button>
              <Button
                onClick={() => onIssue(req)}
                className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                {t("emettre")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ================================================================
//              DIALOG : Emission lettre
// ================================================================
function IssueLetterDialog({
  req,
  onClose,
  onSaved,
}: {
  req: Req | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.letters");
  const tc = useTranslations("common");
  const [letterUrl, setLetterUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmGenerate, setConfirmGenerate] = useState(false);

  useEffect(() => {
    if (req) {
      setLetterUrl("");
      setPending(false);
    }
  }, [req]);

  const submit = async (urlToUse?: string) => {
    if (!req) return;
    const final = urlToUse ?? letterUrl;
    if (!final) {
      toast.error(t("lettre_pdf_requise"));
      return;
    }
    setPending(true);
    const r = await issueEmploymentLetterAction({ id: req.id, letterUrl: final });
    setPending(false);
    if (r.success) {
      toast.success(t("lettre_emise"));
      onSaved();
      onClose();
    } else {
      toast.error(r.error || "");
    }
  };

  return (
    <>
      <Dialog open={!!req} onOpenChange={(o) => !o && !pending && onClose()}>
        <DialogContent className="max-w-lg p-0 overflow-hidden flex flex-col max-h-[92vh]">
          <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-base text-white flex items-center gap-2">
                <Send className="h-4 w-4" />
                {t("emettre_lettre_apos_emploi")}
              </DialogTitle>
              <DialogDescription className="text-white/80 text-xs">
                Pour {req?.admin.fullName || req?.admin.email}
                {req?.purpose && ` - ${PURPOSE_KEY[req.purpose] ?? req.purpose}`}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            <FormSection icon={Sparkles} title={t("generation_automatique")}>
              <p className="text-xs text-muted-foreground">{t("letters_view_le_portail_peut_generer_une_lettre_standard")}</p>
              <Button
                type="button"
                variant="outline"
                className="w-full h-9 text-xs border-[#0F2D52]/30 text-[#0F2D52]"
                onClick={() => setConfirmGenerate(true)}
                disabled={pending}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                {t("generer_lettre_automatique_emettre")}
              </Button>
            </FormSection>

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <div className="w-full border-t" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  ou
                </span>
              </div>
            </div>

            <FormSection icon={UploadCloud} title={t("lettre_pdf_personnalisee")}>
              <Field label={t("fichier_pdf")} required hint={t("maximum_5_mo")}>
                <FileUploadInput
                  value={letterUrl}
                  onChange={setLetterUrl}
                  accept="application/pdf"
                  folder="employment-letters"
                  maxSizeMB={5}
                />
              </Field>
            </FormSection>
          </div>

          <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0 gap-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              {tc("cancel")}
            </Button>
            <Button
              onClick={() => submit()}
              disabled={pending || !letterUrl}
              className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5 mr-1.5" />
              )}
              Emettre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmGenerate}
        onOpenChange={(o) => !o && setConfirmGenerate(false)}
        title={t("generer_emettre_lettre")}
        description={t("lettre_generee_automatiquement_dossier_rh")}
        confirmLabel={t("generer_emettre")}
        variant="default"
        loading={pending}
        onConfirm={async () => {
          if (!req) return;
          setConfirmGenerate(false);
          await submit(`/api/admin/employment-letters/${req.id}/pdf`);
        }}
      />
    </>
  );
}

// ---------- Format helpers --------------------------------------
function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} j`;
}

// Indicateurs reserves pour usage futur
export const _LetterIcons = { Archive };
