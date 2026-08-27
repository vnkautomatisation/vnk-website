"use client";
// ─────────────────────────────────────────────────────────
// HandbookSignatureDialog — signature d'un cahier (handbook).
//
// Option A (refonte) : layout 2 colonnes desktop / empile mobile.
//   - Gauche  (~60%) : iframe PDF preview du cahier complet
//                      (via /api/admin/document-handbooks/[id]/preview-pdf)
//   - Droite (~40%, sticky scrollable) : panneau "Actions a completer"
//
// Demande 4 : UNE SEULE case "J'ai lu" + initiales a la FIN du manuel
// (plus de case par chapitre). Le panneau actions contient :
//   1. Bandeau progression (lecture / acceptation / signature)
//   2. Acceptation finale : grosse card "J'ai lu et compris l'ensemble"
//      + un seul champ initiales
//   3. Acceptation globale (case)
//   4. Signature manuscrite (SignaturePad) si signatureScope != "none"
//
// Lecture du PDF : la checkbox "J'ai lu" est desactivee pendant 5 secondes
// apres l'ouverture du dialog (incentive lecture).
//
// Persistance via signHandbookAction (Demande 4) :
//   checkboxStates = {
//     __handbook: {
//       finalRead: true,
//       finalInitials: "AB",
//       globalAccepted: true,
//     }
//   }
// ─────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  Book,
  BookOpen,
  CheckCircle2,
  Eraser,
  ExternalLink,
  FileSignature,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import type {
  CheckboxStates,
} from "@/components/admin/interactive-document-view-types";
import { SignaturePad } from "@/app/(admin)/admin/employes/contrats/signature-pad";
import { HandbookSignatureMobile } from "@/components/admin/handbook-signature-mobile";
// Types deplaces dans handbook-signature-types.ts pour permettre a
// Fast Refresh de hot-reload ce composant (Fast Refresh impose que
// les fichiers React n'exportent QUE des composants).
import type { HandbookSignatureDialogHandbook } from "@/components/admin/handbook-signature-types";

// Delai (ms) avant de pouvoir cocher la case finale : incentive lecture du PDF.
const READ_DELAY_MS = 5_000;

export function HandbookSignatureDialog({
  open,
  handbook,
  employeeId,
  onClose,
  onSigned,
}: {
  open: boolean;
  handbook: HandbookSignatureDialogHandbook | null;

  employeeId?: number;
  onClose: () => void;
  onSigned: (
    signatureDataUrl: string,
    checkboxStates: CheckboxStates,
  ) => Promise<void> | void;
}) {
  const t = useTranslations("admin.ui");
  const tc = useTranslations("common");



  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 1280px)");
    setIsDesktop(mq.matches);
    const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [padKey, setPadKey] = useState(0);


  const [finalRead, setFinalRead] = useState(false);
  const [finalInitials, setFinalInitials] = useState("");


  const [readUnlocked, setReadUnlocked] = useState(false);
  const readTimerRef = useRef<NodeJS.Timeout | null>(null);


  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfRefreshing, setPdfRefreshing] = useState(false);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentBlobUrlRef = useRef<string | null>(null);


  useEffect(() => {
    if (open) {
      setSignatureData(null);
      setPending(false);
      setPadKey((k) => k + 1);
      setFinalRead(false);
      setFinalInitials("");
      setReadUnlocked(false);
      if (readTimerRef.current) clearTimeout(readTimerRef.current);
      readTimerRef.current = setTimeout(() => setReadUnlocked(true), READ_DELAY_MS);
    }
    return () => {
      if (readTimerRef.current) {
        clearTimeout(readTimerRef.current);
        readTimerRef.current = null;
      }
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
        currentBlobUrlRef.current = null;
      }
    };
  }, [open, handbook?.id]);

  const scope = handbook?.signatureScope ?? "employee_only";
  const requiresSignature = scope !== "none";

  const initialsValid = finalInitials.trim().length >= 2;
  const finalAckDone = finalRead && initialsValid;


  useEffect(() => {
    if (!open || !handbook?.id) return;
    let cancelled = false;
    const fetchInitial = async () => {
      try {
        setPdfRefreshing(true);
        const url = `/api/admin/document-handbooks/${handbook.id}/preview-pdf${
          employeeId ? `?employeeId=${employeeId}` : ""
        }`;
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        if (currentBlobUrlRef.current) {
          URL.revokeObjectURL(currentBlobUrlRef.current);
        }
        currentBlobUrlRef.current = objectUrl;
        setPdfBlobUrl(objectUrl);
      } catch (err) {
        console.warn("[HandbookSignatureDialog] initial PDF fetch failed:", err);
      } finally {
        if (!cancelled) setPdfRefreshing(false);
      }
    };
    void fetchInitial();
    return () => {
      cancelled = true;
    };
  }, [open, handbook?.id, employeeId]);





  useEffect(() => {
    if (!open || !handbook?.id) return;

    if (!finalRead && !finalInitials && !signatureData) return;
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(async () => {
      try {
        setPdfRefreshing(true);
        const res = await fetch(
          `/api/admin/document-handbooks/${handbook.id}/preview-pdf`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              employeeId: employeeId ?? undefined,
              finalRead,
              finalInitials: finalInitials.trim().toUpperCase(),

              globalAccepted: finalRead,
              signatureDataUrl: signatureData ?? undefined,
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
        console.warn("[HandbookSignatureDialog] refresh PDF failed:", err);
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

  }, [open, handbook?.id, employeeId, finalRead, finalInitials, signatureData]);

  if (!handbook) return null;



  if (!isDesktop) {
    return (
      <HandbookSignatureMobile
        open={open}
        handbook={handbook}
        employeeId={employeeId}
        onClose={onClose}
        onSigned={onSigned}
      />
    );
  }



  const canSubmit =
    finalAckDone
    && (!requiresSignature || !!signatureData)
    && !pending;

  const submit = async () => {
    if (!canSubmit) return;
    setPending(true);
    try {

      const flat: CheckboxStates = {};
      Object.assign(flat, {
        __handbook: {
          finalRead: true,
          finalInitials: finalInitials.trim().toUpperCase(),
          globalAccepted: true,
        },
      });
      await onSigned(signatureData ?? "", flat as unknown as CheckboxStates);
    } finally {
      setPending(false);
    }
  };

  const clearSignature = () => {
    setSignatureData(null);
    setPadKey((k) => k + 1);
  };


  const submitLabel = requiresSignature
    ? t("confirmer_ma_signature")
    : t("confirmer_ma_lecture");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent
        className="p-0 overflow-hidden flex flex-col w-screen h-[100dvh] max-w-none max-h-none rounded-none sm:w-[97vw] sm:max-w-[1400px] sm:h-[92vh] sm:max-h-[92vh] sm:rounded-lg"
      >

        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-white text-sm sm:text-base flex items-center gap-2 pr-8">
              <BookOpen className="h-4 w-4 shrink-0" />
              <span className="truncate">{handbook.title}</span>
              <span className="text-white/70 text-xs font-normal">
                v{handbook.version}
              </span>
            </DialogTitle>
            <DialogDescription className="text-white/80 text-[11px] sm:text-xs">
              {handbook.subtitle
                ?? `v${handbook.version} - Manuel de l'employe VNK`}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body : grid 2 col desktop / 1 col mobile + tablet.
            Breakpoint xl: (1280px+) : iframe + actions cote a cote.
            En dessous : layout empile avec PDF compact (bouton t("ouvrir")) en haut
            et panneau actions scrollable en dessous (le footer du dialog ne
            cache plus le contenu). */}
        <div className="flex-1 overflow-hidden bg-slate-100">
          <div className="h-full grid grid-cols-1 xl:grid-cols-[3fr_2fr] overflow-hidden">

            <div className="flex flex-col bg-slate-200 xl:border-r border-slate-300 overflow-hidden shrink-0 xl:shrink xl:min-h-[260px]">
              <div className="px-3 py-2 bg-white border-b shrink-0 flex items-center gap-2">
                <Book className="h-3.5 w-3.5 text-[#0F2D52]" />
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[#0F2D52]">
                  {t("apercu_manuel")}
                </span>
                {pdfRefreshing ? (
                  <span className="text-[10px] text-[#0F2D52] ml-auto inline-flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t("apercu_actualise")}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {t("lisez_apos_integralite_avant_confirmer")}
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-hidden bg-slate-200 flex flex-col">
                {pdfBlobUrl ? (
                  <>
                    {/* Mobile + Tablet (< xl, soit < 1280px) : iframe PDF
                       peu fiable + prend trop de place et cache le panneau
                       actions. On propose une carte compacte avec bouton qui
                       ouvre le PDF en plein ecran. */}
                    <div className="xl:hidden flex flex-col items-center justify-center p-4 sm:p-6 text-center bg-white">
                      <BookOpen className="h-8 w-8 sm:h-10 sm:w-10 text-[#0F2D52] mb-2 sm:mb-3" />
                      <p className="text-xs sm:text-sm font-semibold text-[#0F2D52] mb-1">
                        {t("apercu_disponible")}
                      </p>
                      <p className="text-[11px] sm:text-xs text-slate-600 mb-3 sm:mb-4 max-w-xs">{t("handbook_signature_dialog_ouvrez_le_manuel_dans_votre_navigateur_pour")}</p>
                      <Button
                        asChild
                        size="sm"
                        className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white w-full max-w-xs"
                      >
                        <a
                          href={pdfBlobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          {t("ouvrir_manuel")}
                        </a>
                      </Button>
                      <p className="text-[10px] text-muted-foreground mt-2 sm:mt-3">
                        {t("revenez_ici_fois_lecture_terminee")}
                      </p>
                    </div>

                    <iframe
                      src={pdfBlobUrl}
                      className="hidden xl:block w-full h-full min-h-[500px] border-0 bg-white"
                      title={`Manuel - ${handbook.title}`}
                    />
                  </>
                ) : (
                  <div className="w-full h-full min-h-[260px] lg:min-h-[500px] flex items-center justify-center bg-white">
                    <div className="text-center text-[#0F2D52]">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <p className="text-xs">{t("generation_apos_apercu")}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>


            <div className="overflow-y-auto bg-slate-50">
              <div className="p-4 space-y-3">

                <div
                  className={`rounded-md border px-3 py-2.5 space-y-2 ${
                    finalAckDone
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-[#0F2D52]/30 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    {finalAckDone ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-[#0F2D52] shrink-0" />
                    )}
                    <span className={finalAckDone ? "text-emerald-900" : "text-[#0F2D52]"}>
                      {t("etat_signature")}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                    <span className="inline-flex items-center gap-1">
                      Lecture finale
                      {finalAckDone ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <span className="text-amber-700">[ ]</span>
                      )}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="inline-flex items-center gap-1">
                      Initiales
                      {initialsValid ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <span className="text-amber-700">[ ]</span>
                      )}
                    </span>
                    {requiresSignature && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="inline-flex items-center gap-1">
                          Signature
                          {signatureData ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <span className="text-amber-700">[ ]</span>
                          )}
                        </span>
                      </>
                    )}
                  </div>
                  {!readUnlocked && (
                    <p className="text-[10px] text-amber-700 inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {t("prenez_quelques_secondes_parcourir_document")}
                    </p>
                  )}
                </div>


                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-[#0F2D52] px-1">
                    {t("acceptation_finale_manuel")}
                  </p>
                  <Card
                    className={`p-4 space-y-3 border-2 transition ${
                      finalAckDone
                        ? "border-emerald-400 bg-emerald-50/50"
                        : "border-[#0F2D52]"
                    }`}
                  >
                    <p className="text-xs text-slate-700 leading-relaxed">{t("handbook_signature_dialog_en_cochant_la_case_ci_dessous_je")}</p>
                    <label
                      className={`flex items-start gap-2 text-xs p-2.5 rounded border ${
                        readUnlocked ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                      } ${
                        finalRead
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-[#0F2D52]/40 bg-white hover:bg-[#0F2D52]/5"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={finalRead}
                        disabled={!readUnlocked}
                        onChange={(e) => setFinalRead(e.target.checked)}
                        className="h-4 w-4 mt-0.5 rounded border-input shrink-0 accent-[#0F2D52]"
                      />
                      <span className="font-semibold text-[#0F2D52]">
                        {t("j_ai_lu_compris_manuel")}
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-muted-foreground shrink-0">
                        {t("mes_initiales")}
                      </label>
                      <Input
                        value={finalInitials}
                        maxLength={5}
                        onChange={(e) =>
                          setFinalInitials(e.target.value.toUpperCase().slice(0, 5))
                        }
                        placeholder="AB"
                        className="h-8 text-sm font-semibold tracking-widest text-center uppercase w-24"
                      />
                      {finalInitials.length > 0 && !initialsValid && (
                        <span className="text-[10px] text-amber-700">
                          {t("min_2_caracteres")}
                        </span>
                      )}
                      {finalAckDone && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 ml-auto" />
                      )}
                    </div>
                  </Card>
                </div>


                {requiresSignature && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-[#0F2D52] px-1">
                      {t("signature_manuscrite")}
                    </p>
                    <div
                      className={`rounded-md border bg-white p-3 ${
                        !finalAckDone ? "opacity-50 pointer-events-none" : ""
                      }`}
                    >
                      <SignaturePad key={padKey} onChange={setSignatureData} />
                      <div className="flex justify-end pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px]"
                          onClick={clearSignature}
                          disabled={!signatureData}
                        >
                          <Eraser className="h-3 w-3 mr-1" />
                          {t("effacer")}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>


        <DialogFooter className="px-4 py-3 border-t bg-muted/30 shrink-0 gap-2 flex-col sm:flex-row sm:items-center">

          <div className="flex-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-700">
            <span className="inline-flex items-center gap-1">
              Lecture finale
              {finalAckDone ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
              )}
            </span>
            {requiresSignature && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="inline-flex items-center gap-1">
                  Signature
                  {signatureData ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  )}
                </span>
              </>
            )}
          </div>

          <div className="flex gap-2 [&>button]:flex-1 sm:[&>button]:flex-initial">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={pending}
            >
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={submit}
              disabled={!canSubmit}
              className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <FileSignature className="h-3.5 w-3.5 mr-1.5" />
              )}
              {submitLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
