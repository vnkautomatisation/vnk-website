"use client";
// =============================================================
// MesContratsView - vue employe (mon-espace) pour consulter et
// signer ses contrats.
//   - Header navy gradient compact
//   - KPI : Actifs / A signer / Archives
//   - Bandeau urgent si contrat en attente de signature
//   - Cartes contrats (riche : infos cles + double signature status)
//   - Modal PdfPreviewModal pour visualiser le PDF
//   - Modal SignDialog (header navy + pad + accuse reception)
// =============================================================
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileSignature,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar as CalendarIcon,
  Coins,
  TrendingUp,
  Loader2,
  Eraser,
  Briefcase,
  Archive,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DocumentStatsCard } from "@/components/admin/document-stats-card";
import { cn } from "@/lib/utils";
import { PdfPreviewModal } from "@/components/admin/pdf-preview-modal";
import { ToneBadge } from "@/components/admin/tone-badge";
import { SignatureStatusBadge } from "@/components/admin/signature-status-badge";
import { SignaturePad } from "../../employes/contrats/signature-pad";
import { signContractAsEmployeeAction } from "@/app/actions/hr-contracts";
import { getContractTypeLabel } from "@/lib/document-templates/contract-types";

export type EmployeeContract = {
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
};

const STATUS_TONE: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  draft: { label: "Brouillon", tone: "neutral" },
  sent: { label: "A signer", tone: "warning" },
  signed_employee: { label: "En attente employeur", tone: "info" },
  signed_employer: { label: "En attente de votre signature", tone: "warning" },
  active: { label: "Actif", tone: "success" },
  terminated: { label: "Resilie", tone: "danger" },
  expired: { label: "Expire", tone: "neutral" },
};

// Label de type de contrat (terminologie QC + rétro-compat legacy via getContractTypeLabel)
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

function fmtMoney(v: number | null | undefined): string | null {
  if (v == null) return null;
  return `${Number(v).toLocaleString("fr-CA", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} $`;
}

// ================================================================
// MAIN VIEW
// ================================================================
export function MesContratsView({
  contracts,
  meName,
}: {
  contracts: EmployeeContract[];
  meName: string;
}) {
  const router = useRouter();
  const [pdfPreview, setPdfPreview] = useState<{
    url: string;
    title: string;
    description?: string;
    filename?: string;
  } | null>(null);
  const [signDialog, setSignDialog] = useState<EmployeeContract | null>(null);

  const openContractPdf = useCallback(
    (c: EmployeeContract) =>
      setPdfPreview({
        url: `/api/admin/contracts/${c.id}/pdf`,
        title: c.title,
        description: meName,
        filename: `contrat-${c.id}.pdf`,
      }),
    [meName],
  );

  // KPIs
  const kpis = useMemo(() => {
    const actifs = contracts.filter((c) => c.status === "active").length;
    const aSigner = contracts.filter(
      (c) => c.status === "sent" && !c.employeeSignedAt,
    ).length;
    const archives = contracts.filter(
      (c) => c.status === "terminated" || c.status === "expired",
    ).length;
    return { actifs, aSigner, archives };
  }, [contracts]);

  // Buckets pour affichage : a signer / actifs / archives
  const buckets = useMemo(() => {
    const aSigner = contracts.filter((c) => c.status === "sent" && !c.employeeSignedAt);
    const enCours = contracts.filter(
      (c) =>
        c.status === "active" ||
        c.status === "signed_employee" ||
        c.status === "signed_employer",
    );
    const archives = contracts.filter(
      (c) => c.status === "terminated" || c.status === "expired",
    );
    const autres = contracts.filter(
      (c) => !aSigner.includes(c) && !enCours.includes(c) && !archives.includes(c),
    );
    return { aSigner, enCours, archives, autres };
  }, [contracts]);

  // Sticky bar pattern STANDARD (ref my-documents-view.tsx)
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

  return (
    <div className="space-y-4">
      {/* ====== Header navy ====== */}
      <div className="rounded-xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-4 sm:px-5 py-4 text-white relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32"
          aria-hidden
        />
        <div className="relative flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center ring-2 ring-white/20 shrink-0">
            <FileSignature className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold">Mes contrats</h1>
            <p className="text-xs text-white/80">
              Consultez vos contrats d'emploi et signez electroniquement ceux qui sont en attente.
            </p>
          </div>
        </div>
      </div>

      {/* ====== Bandeau urgent : contrats a signer ====== */}
      {buckets.aSigner.length > 0 && (
        <UrgentSignBanner
          contracts={buckets.aSigner}
          onSign={(c) => setSignDialog(c)}
        />
      )}

      {/* ====== KPIs ====== */}
      <div className="grid grid-cols-3 gap-3">
        <DocumentStatsCard
          label="Actifs"
          value={kpis.actifs}
          icon={CheckCircle2}
          accent="success"
          hint="Contrats en cours d'execution"
        />
        <DocumentStatsCard
          label="A signer"
          value={kpis.aSigner}
          icon={AlertCircle}
          accent={kpis.aSigner > 0 ? "warning" : "info"}
          hint={kpis.aSigner > 0 ? "Action requise" : "Aucune signature requise"}
        />
        <DocumentStatsCard
          label="Archives"
          value={kpis.archives}
          icon={Archive}
          accent="navy"
          hint="Resilies ou expires"
        />
      </div>

      {/* Sentinel : detecte la sortie des KPIs */}
      <div ref={sentinelRef} aria-hidden className="h-px" />

      {/* Portal KPIs vers module-nav mobile (sur la meme ligne que "Mon espace") */}
      {navExtraEl && scrolled
        ? createPortal(
            <div className="flex items-center gap-x-2 sm:gap-x-3 text-[11px] sm:text-xs whitespace-nowrap lg:hidden">
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">Act :</span>
                  <span className="hidden min-[480px]:inline">Actifs :</span>
                </span>
                <span className="font-semibold text-emerald-600">{kpis.actifs}</span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">À sig :</span>
                  <span className="hidden min-[480px]:inline">A signer :</span>
                </span>
                <span className={kpis.aSigner > 0 ? "font-semibold text-amber-600" : "font-semibold"}>
                  {kpis.aSigner}
                </span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">Arch :</span>
                  <span className="hidden min-[480px]:inline">Archives :</span>
                </span>
                <span className="font-semibold text-muted-foreground">{kpis.archives}</span>
              </span>
            </div>,
            navExtraEl,
          )
        : null}

      {/* Sticky container : mini-bar DESKTOP uniquement (mobile = portal) */}
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
            Mes contrats
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">Actifs :</span>
            <span className="font-semibold text-emerald-600">{kpis.actifs}</span>
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">A signer :</span>
            <span className={kpis.aSigner > 0 ? "font-semibold text-amber-600" : "font-semibold text-muted-foreground"}>
              {kpis.aSigner}
            </span>
          </span>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">Archives :</span>
            <span className="font-semibold text-muted-foreground">{kpis.archives}</span>
          </span>
        </div>
      </div>

      {/* ====== Sections ====== */}
      {contracts.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <FileSignature className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Aucun contrat emis pour votre compte.
          </p>
          <p className="text-xs text-muted-foreground">
            Lorsqu'un contrat vous sera assigne, vous le retrouverez ici.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {buckets.aSigner.length > 0 && (
            <ContractSection
              title="A signer"
              icon={AlertCircle}
              contracts={buckets.aSigner}
              onOpenPdf={openContractPdf}
              onSign={(c) => setSignDialog(c)}
            />
          )}

          {buckets.enCours.length > 0 && (
            <ContractSection
              title="En cours"
              icon={Briefcase}
              contracts={buckets.enCours}
              onOpenPdf={openContractPdf}
              onSign={(c) => setSignDialog(c)}
            />
          )}

          {buckets.autres.length > 0 && (
            <ContractSection
              title="Autres"
              icon={FileText}
              contracts={buckets.autres}
              onOpenPdf={openContractPdf}
              onSign={(c) => setSignDialog(c)}
            />
          )}

          {buckets.archives.length > 0 && (
            <ContractSection
              title="Archives"
              icon={Archive}
              contracts={buckets.archives}
              onOpenPdf={openContractPdf}
              onSign={(c) => setSignDialog(c)}
            />
          )}
        </div>
      )}

      {/* Modals */}
      <PdfPreviewModal
        open={!!pdfPreview}
        url={pdfPreview?.url ?? null}
        title={pdfPreview?.title ?? ""}
        description={pdfPreview?.description}
        downloadFilename={pdfPreview?.filename}
        onClose={() => setPdfPreview(null)}
      />

      <SignDialog
        open={!!signDialog}
        contract={signDialog}
        onClose={() => setSignDialog(null)}
        onSigned={() => router.refresh()}
      />
    </div>
  );
}

// ================================================================
// BANNER : Urgent sign
// ================================================================
function UrgentSignBanner({
  contracts,
  onSign,
}: {
  contracts: EmployeeContract[];
  onSign: (c: EmployeeContract) => void;
}) {
  return (
    <div
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3"
      role="alert"
    >
      <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 text-amber-700 bg-amber-100">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-amber-900">
          {contracts.length === 1
            ? "1 contrat a signer"
            : `${contracts.length} contrats a signer`}
        </p>
        <p className="text-xs text-amber-800/80 mt-0.5">
          Veuillez signer electroniquement vos contrats afin de finaliser votre engagement.
        </p>
        <div className="mt-2 flex flex-col gap-1.5">
          {contracts.slice(0, 4).map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-md bg-white/60 px-2.5 py-1.5 border border-white/80"
            >
              <FileSignature className="h-3.5 w-3.5 text-[#0F2D52] shrink-0" />
              <span className="text-xs font-medium truncate flex-1">{c.title}</span>
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium bg-muted text-muted-foreground border-input">
                <Clock className="h-2.5 w-2.5" />
                Debut {formatDate(c.startDate)}
              </span>
              <Button
                type="button"
                size="sm"
                onClick={() => onSign(c)}
                className="h-6 text-[11px] px-2 text-white shrink-0 bg-[#0F2D52] hover:bg-[#1a3a66]"
              >
                Signer
              </Button>
            </div>
          ))}
          {contracts.length > 4 && (
            <p className="text-[10px] text-amber-800/80">
              + {contracts.length - 4} autre{contracts.length - 4 > 1 ? "s" : ""}...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ================================================================
// SECTION
// ================================================================
function ContractSection({
  title,
  icon: Icon,
  contracts,
  onOpenPdf,
  onSign,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  contracts: EmployeeContract[];
  onOpenPdf: (c: EmployeeContract) => void;
  onSign: (c: EmployeeContract) => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-[11px] font-bold text-[#0F2D52] uppercase tracking-wider flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {title} ({contracts.length})
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {contracts.map((c) => (
          <EmployeeContractCard
            key={c.id}
            contract={c}
            onOpenPdf={() => onOpenPdf(c)}
            onSign={() => onSign(c)}
          />
        ))}
      </div>
    </section>
  );
}

// ================================================================
// CARD : employee contract
// ================================================================
function EmployeeContractCard({
  contract,
  onOpenPdf,
  onSign,
}: {
  contract: EmployeeContract;
  onOpenPdf: () => void;
  onSign: () => void;
}) {
  const c = contract;
  const status = STATUS_TONE[c.status] ?? { label: c.status, tone: "neutral" as const };
  const canSign = c.status === "sent" && !c.employeeSignedAt;
  // Apercu PDF disponible des qu'un contrat est emis (pas seulement signe) :
  // l'API /api/admin/contracts/[id]/pdf rend a la volee depuis le markdown stocke.
  const canPreviewPdf = c.status !== "draft";

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
            <div className="flex flex-wrap gap-1 mt-1.5">
              <ToneBadge tone={status.tone}>{status.label}</ToneBadge>
              <ToneBadge tone="info">
                {typeLabel(c.contractType)}
              </ToneBadge>
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
        {(canSign || canPreviewPdf) && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t -mb-1">
            {canSign && (
              <Button
                size="sm"
                className="h-8 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white flex-1"
                onClick={onSign}
              >
                <FileSignature className="h-3.5 w-3.5 mr-1.5" />
                Signer maintenant
              </Button>
            )}
            {canPreviewPdf && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs flex-1"
                onClick={onOpenPdf}
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Apercu PDF
              </Button>
            )}
          </div>
        )}
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
// DIALOG : Sign (employee)
// ================================================================
function SignDialog({
  open,
  contract,
  onClose,
  onSigned,
}: {
  open: boolean;
  contract: EmployeeContract | null;
  onClose: () => void;
  onSigned: () => void;
}) {
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
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
    const r = await signContractAsEmployeeAction({
      id: contract.id,
      signatureData,
    });
    setPending(false);
    if (r.success) {
      toast.success("Contrat signe avec succes !");
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
              <span className="truncate">Signer mon contrat</span>
            </DialogTitle>
            <DialogDescription className="text-white/80 text-[11px] sm:text-xs truncate">
              {contract.title} - Votre signature confirme votre engagement.
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
              {typeLabel(contract.contractType)} - Debut{" "}
              {formatDate(contract.startDate)}
              {contract.endDate ? ` - Fin ${formatDate(contract.endDate)}` : ""}
            </p>
            {(contract.salaryAnnual != null ||
              contract.hourlyRate != null ||
              contract.hoursPerWeek != null) && (
              <p className="text-xs text-muted-foreground mt-1">
                {contract.salaryAnnual != null && (
                  <>Salaire annuel : {fmtMoney(contract.salaryAnnual)} </>
                )}
                {contract.hourlyRate != null && (
                  <>- Taux horaire : {Number(contract.hourlyRate).toFixed(2)} $ </>
                )}
                {contract.hoursPerWeek != null && (
                  <>- {contract.hoursPerWeek} h/sem</>
                )}
              </p>
            )}
          </div>

          <label className="flex items-start gap-2 text-xs cursor-pointer p-3 rounded-md border bg-muted/10 hover:bg-muted/20 transition">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="h-4 w-4 mt-0.5 rounded border-input shrink-0 accent-[#0F2D52]"
            />
            <span>
              J'ai lu l'integralite du contrat et j'accepte ses termes en toute connaissance de cause.
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
