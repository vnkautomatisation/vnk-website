"use client";
// ─────────────────────────────────────────────────────────
// SignaturePadMobile — variante mobile/tablet (< 1280px) du
// SignaturePadDialog desktop. Pattern identique a
// HandbookSignatureMobile (2 onglets Apercu / Actions).
//
// Onglet 1 — Apercu : iframe PDF inline du document a signer
//            (avec customFieldValues RH appliques). PDF identique
//            byte-pour-byte au PDF qui sera stocke apres signature.
// Onglet 2 — Actions : cases `- [ ]` detectees + accuse de lecture
//            + signature manuscrite (selon scope).
//
// Le payload soumis est identique au desktop :
//   onSigned(signatureDataUrl, checkboxStates)
// ─────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Eraser,
  FileSignature,
  FileText,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  CheckboxStates,
} from "@/components/admin/interactive-document-view-types";
import { SignaturePad } from "@/app/(admin)/admin/employes/contrats/signature-pad";
import type { SignaturePadDialogDoc } from "@/components/admin/signature-pad-dialog-types";
import { detectPlaceholdersWithInfo } from "@/lib/document-templates/placeholder-detector";
import { Input } from "@/components/ui/input";

// Pattern checkbox markdown — meme regex que SignaturePadDialog desktop
const LIST_CHECKBOX_RE = /^(\s*[-*])\s+\[([ xX])\]\s+(.+)$/gm;

function detectCheckboxes(md: string): {
  items: { idx: number; label: string; initialChecked: boolean }[];
  initialStates: CheckboxStates;
} {
  const items: { idx: number; label: string; initialChecked: boolean }[] = [];
  const initialStates: CheckboxStates = {};
  let m: RegExpExecArray | null;
  let idx = 0;
  LIST_CHECKBOX_RE.lastIndex = 0;
  while ((m = LIST_CHECKBOX_RE.exec(md)) !== null) {
    const mark = m[2];
    const label = (m[3] ?? "").trim();
    const checked = mark === "x" || mark === "X";
    items.push({ idx, label, initialChecked: checked });
    initialStates[idx] = checked;
    idx += 1;
  }
  return { items, initialStates };
}

type Tab = "preview" | "actions";

export function SignaturePadMobile({
  open,
  doc,
  onClose,
  onSigned,
  requireAcknowledgment = true,
  acknowledgmentLabel,
}: {
  open: boolean;
  doc: SignaturePadDialogDoc | null;
  onClose: () => void;
  onSigned: (
    signatureDataUrl: string,
    checkboxStates: CheckboxStates,
  ) => Promise<void> | void;
  requireAcknowledgment?: boolean;
  acknowledgmentLabel?: string;
}) {
  const [tab, setTab] = useState<Tab>("preview");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [padKey, setPadKey] = useState(0);
  const [pdfOpenedOnce, setPdfOpenedOnce] = useState(false);

  // Cases a cocher detectees dans le markdown
  const sourceMd = doc?.resolvedMarkdown ?? doc?.bodyMarkdown ?? "";
  const { items: checkboxItems, initialStates: defaultCheckStates } = useMemo(
    () => detectCheckboxes(sourceMd),
    [sourceMd],
  );
  const totalCheckboxes = checkboxItems.length;
  const [checkboxStates, setCheckboxStates] = useState<CheckboxStates>({});
  const checkedCount = useMemo(
    () => Object.values(checkboxStates).filter(Boolean).length,
    [checkboxStates],
  );
  const allChecked = totalCheckboxes === 0 || checkedCount === totalCheckboxes;

  // Champs `[CHAMP]` que l'employe doit remplir lui-meme (numero de membre
  // OIQ/CPA, permis, etc.) — parite avec le variant desktop.
  const employeeFields = useMemo(
    () => detectPlaceholdersWithInfo(sourceMd).filter((p) => p.fillBy === "employee"),
    [sourceMd],
  );
  const [employeeFieldValues, setEmployeeFieldValues] = useState<Record<string, string>>({});
  const allEmployeeFieldsFilled = employeeFields.length === 0
    || employeeFields.every((p) => (employeeFieldValues[p.key] ?? "").trim().length > 0);

  // PDF blob URL
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfRefreshing, setPdfRefreshing] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const currentBlobUrlRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset a chaque ouverture
  useEffect(() => {
    if (open) {
      setTab("preview");
      setSignatureData(null);
      setAcknowledged(false);
      setPending(false);
      setPadKey((k) => k + 1);
      setCheckboxStates({ ...defaultCheckStates });
      setEmployeeFieldValues({});
      setPdfOpenedOnce(false);
      setPdfError(null);
    }
    return () => {
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
        currentBlobUrlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, doc?.title]);

  // Fetch PDF preview a l'ouverture
  useEffect(() => {
    if (!open || !doc || !doc.templateId) return;
    let cancelled = false;
    const fetchPdf = async () => {
      try {
        setPdfLoading(true);
        setPdfError(null);
        const res = await fetch(
          `/api/admin/document-templates/${doc.templateId}/signature-preview-pdf`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestId: doc.signatureRequestId }),
          },
        );
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(txt.slice(0, 200) || `HTTP ${res.status}`);
        }
        const blob = await res.blob();
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        if (currentBlobUrlRef.current) {
          URL.revokeObjectURL(currentBlobUrlRef.current);
        }
        currentBlobUrlRef.current = objectUrl;
        setPdfBlobUrl(objectUrl);
      } catch (err) {
        if (cancelled) return;
        console.warn("[SignaturePadMobile] PDF preview fetch failed:", err);
        setPdfError("Impossible de charger l'apercu du document.");
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    };
    void fetchPdf();
    return () => {
      cancelled = true;
    };
  }, [open, doc]);

  // Live refresh PDF debounce quand acknowledged / signatureData / cases /
  // champs employe changent.
  useEffect(() => {
    if (!open || !doc || !doc.templateId) return;
    const hasEmployeeValues = Object.values(employeeFieldValues).some(
      (v) => v.trim().length > 0,
    );
    if (!acknowledged && !signatureData && checkedCount === 0 && !hasEmployeeValues) return;
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(async () => {
      try {
        setPdfRefreshing(true);
        const checkboxStatesStr: Record<string, boolean> = {};
        for (const [k, v] of Object.entries(checkboxStates)) {
          checkboxStatesStr[String(k)] = !!v;
        }
        const res = await fetch(
          `/api/admin/document-templates/${doc.templateId}/signature-preview-pdf`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requestId: doc.signatureRequestId,
              acknowledged,
              signatureDataUrl: signatureData ?? undefined,
              checkboxStates: checkboxStatesStr,
              employeeFieldValues,
            }),
          },
        );
        if (!res.ok) return;
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        if (currentBlobUrlRef.current) {
          URL.revokeObjectURL(currentBlobUrlRef.current);
        }
        currentBlobUrlRef.current = objectUrl;
        setPdfBlobUrl(objectUrl);
      } catch (err) {
        console.warn("[SignaturePadMobile] live refresh failed:", err);
      } finally {
        setPdfRefreshing(false);
      }
    }, 1500);
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, doc, acknowledged, signatureData, checkedCount, checkboxStates, employeeFieldValues]);

  if (!doc) return null;

  const isReadingOnly = doc.acknowledgmentMode === "reading_only";
  const effectiveAckLabel =
    acknowledgmentLabel ??
    (isReadingOnly
      ? "J'ai lu et compris intégralement le document ci-dessus."
      : "J'ai lu intégralement le document ci-dessus et j'accepte ses termes en toute connaissance de cause.");

  const canSubmit = isReadingOnly
    ? (!requireAcknowledgment || acknowledged) && allChecked && allEmployeeFieldsFilled && !pending
    : !!signatureData &&
      (!requireAcknowledgment || acknowledged) &&
      allChecked &&
      allEmployeeFieldsFilled &&
      !pending;

  // Encode les valeurs employe sous la cle reservee __employeeFieldValues
  // (extraites par my-documents-view avant l'appel a signLegalDocAction).
  // Meme pattern que le variant desktop (buildSubmitStates).
  const buildSubmitStates = (): CheckboxStates => {
    if (employeeFields.length === 0 || Object.keys(employeeFieldValues).length === 0) {
      return checkboxStates;
    }
    return {
      ...checkboxStates,
      __employeeFieldValues: employeeFieldValues,
    } as unknown as CheckboxStates;
  };

  const submit = async () => {
    if (isReadingOnly) {
      setPending(true);
      try {
        await onSigned("", buildSubmitStates());
      } finally {
        setPending(false);
      }
      return;
    }
    if (!signatureData) return;
    setPending(true);
    try {
      await onSigned(signatureData, buildSubmitStates());
    } finally {
      setPending(false);
    }
  };

  const clear = () => {
    setSignatureData(null);
    setPadKey((k) => k + 1);
  };

  const toggleCheckbox = (idx: number) => {
    setCheckboxStates((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const HeaderIcon = isReadingOnly ? BookOpen : FileSignature;
  const submitLabel = isReadingOnly
    ? "Confirmer ma lecture"
    : "Confirmer ma signature";

  // Etat synthese pour les pastilles d'onglets
  const actionsComplete = allChecked && (!requireAcknowledgment || acknowledged)
    && (isReadingOnly || !!signatureData);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent
        className="p-0 overflow-hidden flex flex-col w-screen h-[100dvh] max-w-none max-h-none rounded-none"
        aria-describedby={undefined}
      >
        {/* Header navy */}
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-4 py-3 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-white text-sm flex items-center gap-2 pr-8">
              <HeaderIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">{doc.title}</span>
              {doc.version && (
                <span className="text-white/70 text-[11px] font-normal">
                  v{doc.version}
                </span>
              )}
            </DialogTitle>
            {doc.subtitle && (
              <DialogDescription className="text-white/80 text-[11px] truncate">
                {doc.subtitle}
              </DialogDescription>
            )}
          </DialogHeader>
        </div>

        {/* Onglets : Apercu / Actions */}
        <div className="shrink-0 bg-white border-b flex">
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={cn(
              "flex-1 px-3 py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition",
              tab === "preview"
                ? "border-[#0F2D52] text-[#0F2D52] bg-[#0F2D52]/5"
                : "border-transparent text-slate-600 hover:text-[#0F2D52] hover:bg-slate-50",
            )}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Aperçu</span>
            {pdfOpenedOnce && (
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab("actions")}
            className={cn(
              "flex-1 px-3 py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition",
              tab === "actions"
                ? "border-[#0F2D52] text-[#0F2D52] bg-[#0F2D52]/5"
                : "border-transparent text-slate-600 hover:text-[#0F2D52] hover:bg-slate-50",
            )}
          >
            <FileSignature className="h-3.5 w-3.5" />
            <span>Actions</span>
            {actionsComplete && (
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            )}
          </button>
        </div>

        {/* Body : un seul onglet visible a la fois */}
        <div className="flex-1 overflow-hidden bg-slate-50 flex flex-col">
          {/* ───── Onglet APERCU ───── */}
          {tab === "preview" && (
            <div className="flex-1 overflow-hidden bg-white flex flex-col">
              {pdfRefreshing && (
                <div className="shrink-0 px-3 py-1.5 bg-[#0F2D52]/5 border-b border-[#0F2D52]/10 text-[10px] text-[#0F2D52] inline-flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Aperçu actualisé…</span>
                </div>
              )}
              {pdfLoading && !pdfBlobUrl ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-[#0F2D52]" />
                  <p className="text-sm text-slate-600">
                    Génération de l&apos;aperçu…
                  </p>
                </div>
              ) : pdfError && !pdfBlobUrl ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-2">
                  <AlertCircle className="h-8 w-8 text-amber-600" />
                  <p className="text-sm font-semibold text-slate-800">
                    {pdfError}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Réessayez ou contactez le support si le problème persiste.
                  </p>
                </div>
              ) : pdfBlobUrl ? (
                <iframe
                  src={pdfBlobUrl}
                  title={`Aperçu - ${doc.title}`}
                  className="flex-1 w-full border-0 bg-white"
                  onLoad={() => setPdfOpenedOnce(true)}
                />
              ) : null}
            </div>
          )}

          {/* ───── Onglet ACTIONS ───── */}
          {tab === "actions" && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {/* Bandeau progression */}
              <div
                className={cn(
                  "rounded-md border px-3 py-2.5 space-y-2",
                  actionsComplete
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-[#0F2D52]/30 bg-white",
                )}
              >
                <div className="flex items-center gap-2 text-xs font-semibold">
                  {actionsComplete ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-[#0F2D52] shrink-0" />
                  )}
                  <span className={actionsComplete ? "text-emerald-900" : "text-[#0F2D52]"}>
                    État de la signature
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                  {totalCheckboxes > 0 && (
                    <>
                      <span className="inline-flex items-center gap-1">
                        Confirmations ({checkedCount}/{totalCheckboxes})
                        {allChecked ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <span className="text-amber-700">[ ]</span>
                        )}
                      </span>
                      <span className="text-muted-foreground">·</span>
                    </>
                  )}
                  {requireAcknowledgment && (
                    <>
                      <span className="inline-flex items-center gap-1">
                        Lecture
                        {acknowledged ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <span className="text-amber-700">[ ]</span>
                        )}
                      </span>
                      {!isReadingOnly && (
                        <span className="text-muted-foreground">·</span>
                      )}
                    </>
                  )}
                  {!isReadingOnly && (
                    <span className="inline-flex items-center gap-1">
                      Signature
                      {signatureData ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <span className="text-amber-700">[ ]</span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Champs personnels a remplir par l'employe */}
              {employeeFields.length > 0 && (
                <div className="rounded-md border bg-white overflow-hidden">
                  <div className="px-3 py-2 bg-[#0F2D52]/5 border-b border-[#0F2D52]/10">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-[#0F2D52]">
                      À remplir par vous ({employeeFields.length})
                    </span>
                  </div>
                  <div className="p-3 space-y-3">
                    {employeeFields.map((p) => (
                      <div key={p.key} className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-800 flex items-center gap-1">
                          {p.label}
                          <span className="text-red-500">*</span>
                        </label>
                        {p.hint && (
                          <p className="text-[10px] text-muted-foreground italic leading-snug">
                            « {p.hint} »
                          </p>
                        )}
                        <Input
                          value={employeeFieldValues[p.key] ?? ""}
                          onChange={(e) =>
                            setEmployeeFieldValues((prev) => ({
                              ...prev,
                              [p.key]: e.target.value,
                            }))
                          }
                          placeholder={p.inputPlaceholder}
                          className="h-8 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cases a cocher detectees */}
              {checkboxItems.length > 0 && (
                <div className="rounded-md border bg-white overflow-hidden">
                  <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-900">
                      Confirmations requises ({checkedCount}/{totalCheckboxes})
                    </span>
                  </div>
                  <ul className="divide-y">
                    {checkboxItems.map((item) => {
                      const checked = !!checkboxStates[item.idx];
                      return (
                        <li key={item.idx}>
                          <label className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-slate-50 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCheckbox(item.idx)}
                              className="h-4 w-4 mt-0.5 rounded border-slate-400 accent-[#0F2D52] shrink-0"
                              aria-label={`Case ${item.idx + 1}`}
                            />
                            <span className={checked ? "text-slate-900" : "text-slate-700"}>
                              {item.label}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Accuse de lecture */}
              {requireAcknowledgment && (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-[#0F2D52] px-1">
                    Accusé de lecture
                  </p>
                  <label
                    className={cn(
                      "flex items-start gap-2 text-xs p-3 rounded-md border transition",
                      !allChecked
                        ? "bg-muted/10 opacity-50 cursor-not-allowed"
                        : "bg-white hover:bg-[#0F2D52]/5 cursor-pointer border-[#0F2D52]/30",
                      acknowledged && "border-emerald-300 bg-emerald-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      disabled={!allChecked}
                      onChange={(e) => setAcknowledged(e.target.checked)}
                      className="h-4 w-4 mt-0.5 rounded border-input shrink-0 accent-[#0F2D52] disabled:cursor-not-allowed"
                    />
                    <span>{effectiveAckLabel}</span>
                  </label>
                </div>
              )}

              {/* Signature manuscrite — SignaturePad gere son propre bouton Effacer. */}
              {!isReadingOnly && (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-[#0F2D52] px-1">
                    Signature manuscrite
                  </p>
                  <div
                    className={cn(
                      "rounded-md border bg-white p-3",
                      !allChecked && "opacity-50 pointer-events-none",
                    )}
                  >
                    <SignaturePad
                      key={padKey}
                      value={signatureData}
                      onChange={setSignatureData}
                    />
                  </div>
                  {!allChecked && totalCheckboxes > 0 && (
                    <p className="text-[10px] text-amber-700 italic px-1">
                      Cochez toutes les confirmations pour activer la zone
                      de signature.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer sticky : Annuler + Passer aux actions / Confirmer */}
        <div className="shrink-0 border-t bg-muted/30 px-3 py-2.5 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={pending}
            className="flex-1"
          >
            Annuler
          </Button>
          {tab === "preview" ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setTab("actions")}
              className="flex-1 bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            >
              <FileSignature className="h-3.5 w-3.5 mr-1.5" />
              Passer aux actions
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={submit}
              disabled={!canSubmit}
              className="flex-1 bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <FileSignature className="h-3.5 w-3.5 mr-1.5" />
              )}
              <span className="truncate">{submitLabel}</span>
            </Button>
          )}
        </div>

        {/* Annotation discrete : pdf-loading background */}
        {pdfLoading && pdfBlobUrl && (
          <div className="absolute bottom-16 right-3 bg-white/95 border rounded-full shadow-sm px-2.5 py-1 text-[10px] text-[#0F2D52] inline-flex items-center gap-1.5 pointer-events-none">
            <Loader2 className="h-3 w-3 animate-spin" />
            <FileText className="h-3 w-3" />
            <span>Aperçu actualisé…</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
