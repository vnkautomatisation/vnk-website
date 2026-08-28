"use client";
// ─────────────────────────────────────────────────────────
// HandbookSignatureMobile — variante mobile/tablet (< 1280px)
// du HandbookSignatureDialog desktop.
//
// Approche TABS : 2 onglets en haut du dialog plein ecran.
//   Onglet 1 — Apercu : bouton "Ouvrir le manuel" qui ouvre
//              le PDF dans le navigateur natif (plein ecran).
//   Onglet 2 — Actions : acceptation finale + initiales +
//              signature manuscrite (si requise).
//
// L'utilisateur peut switcher librement entre les onglets sans
// perdre son etat. Plus fluide qu'un wizard 3 etapes rigide.
//
// Le payload soumis est identique au desktop :
//   { __handbook: { finalRead, finalInitials, globalAccepted } }
// ─────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  FileSignature,
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
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  CheckboxStates,
} from "@/components/admin/interactive-document-view-types";
import type {
  HandbookSignatureDialogHandbook,
} from "@/components/admin/handbook-signature-types";
import { SignaturePad } from "@/app/(admin)/admin/employes/contrats/signature-pad";

// Delai (ms) avant de pouvoir cocher "J'ai lu" : incentive lecture du PDF.
const READ_DELAY_MS = 5_000;

type Tab = "preview" | "actions";

export function HandbookSignatureMobile({
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

  const [tab, setTab] = useState<Tab>("preview");


  const [finalRead, setFinalRead] = useState(false);
  const [finalInitials, setFinalInitials] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [pending, setPending] = useState(false);


  const [readUnlocked, setReadUnlocked] = useState(false);
  const readTimerRef = useRef<NodeJS.Timeout | null>(null);


  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfRefreshing, setPdfRefreshing] = useState(false);
  const currentBlobUrlRef = useRef<string | null>(null);

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);



  const [pdfOpenedOnce, setPdfOpenedOnce] = useState(false);


  useEffect(() => {
    if (open) {
      setTab("preview");
      setFinalRead(false);
      setFinalInitials("");
      setSignatureData(null);
      setPending(false);
      setReadUnlocked(false);
      setPdfOpenedOnce(false);
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


  useEffect(() => {
    if (!open || !handbook?.id) return;
    let cancelled = false;
    const fetchPdf = async () => {
      try {
        setPdfLoading(true);
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
        console.warn("[HandbookSignatureMobile] PDF fetch failed:", err);
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    };
    void fetchPdf();
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
        console.warn("[HandbookSignatureMobile] refresh PDF failed:", err);
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

  const scope = handbook.signatureScope ?? "employee_only";
  const requiresSignature = scope !== "none";
  const initialsValid = finalInitials.trim().length >= 2;
  const finalAckDone = finalRead && initialsValid;

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

  const submitLabel = requiresSignature ? t("confirmer_ma_signature") : t("confirmer_ma_lecture");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent
        className="p-0 overflow-hidden flex flex-col w-screen h-[100dvh] max-w-none max-h-none rounded-none"
      >

        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-4 py-3 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-white text-sm flex items-center gap-2 pr-8">
              <BookOpen className="h-4 w-4 shrink-0" />
              <span className="truncate">{handbook.title}</span>
              <span className="text-white/70 text-[11px] font-normal">
                v{handbook.version}
              </span>
            </DialogTitle>
            <DialogDescription className="text-white/80 text-[11px]">
              {handbook.subtitle ?? t("handbook_signature_mobile_manuel_de_l_employe_vnk_v_p0", { p0: handbook.version })}
            </DialogDescription>
          </DialogHeader>
        </div>


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
            <span>{t("apercu")}</span>
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
            <span>{tc("actions")}</span>
            {finalAckDone && (
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            )}
          </button>
        </div>

        {/* Body : un seul onglet visible a la fois.
            HandbookSignatureMobile n'est rendu que sous 1280px (cf. parent
            HandbookSignatureDialog). Au dessus, le layout 2 colonnes desktop
            prend le relais (iframe gauche + actions droite). */}
        <div className="flex-1 overflow-hidden bg-slate-50 flex flex-col">
          {/* ───── Onglet APERCU ─────
              Iframe PDF inline directement dans l'onglet, prend toute la
              hauteur disponible. Le user peut zoomer/scroller dans l'iframe.
              Bouton t("ouvrir_plein_ecran") en option si l'iframe est trop
              petite. */}
          {tab === "preview" && (
            <div className="flex-1 overflow-hidden bg-white flex flex-col">
              {/* Petite barre de statut : indique le re-render live du PDF
                  quand l'utilisateur remplit l'onglet Actions. */}
              {pdfRefreshing && (
                <div className="shrink-0 px-3 py-1.5 bg-[#0F2D52]/5 border-b border-[#0F2D52]/10 text-[10px] text-[#0F2D52] inline-flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>{t("apercu_actualise")}</span>
                </div>
              )}
              {pdfLoading || !pdfBlobUrl ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-[#0F2D52] mb-4" />
                  <p className="text-sm text-slate-600">
                    {t("generation_apos_apercu")}
                  </p>
                </div>
              ) : (
                <iframe
                  src={pdfBlobUrl}
                  title={`Manuel - ${handbook.title}`}
                  className="flex-1 w-full border-0 bg-white"
                  onLoad={() => setPdfOpenedOnce(true)}
                />
              )}
            </div>
          )}


          {tab === "actions" && (
            <div className="p-4 sm:p-5 space-y-4">

              <div
                className={cn(
                  "rounded-md border px-3 py-2.5 space-y-2",
                  finalAckDone
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-[#0F2D52]/30 bg-white",
                )}
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
                    {finalRead ? (
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
                  className={cn(
                    "p-4 space-y-3 border-2 transition",
                    finalAckDone
                      ? "border-emerald-400 bg-emerald-50/50"
                      : "border-[#0F2D52]",
                  )}
                >
                  <p className="text-xs text-slate-700 leading-relaxed">{t("handbook_signature_mobile_en_cochant_la_case_ci_dessous_je")}</p>
                  <label
                    className={cn(
                      "flex items-start gap-2 text-xs p-2.5 rounded border",
                      readUnlocked ? "cursor-pointer" : "cursor-not-allowed opacity-60",
                      finalRead
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-[#0F2D52]/40 bg-white hover:bg-[#0F2D52]/5",
                    )}
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
                      className="h-8 text-xs uppercase tracking-widest font-semibold text-center max-w-[80px]"
                    />
                    {initialsValid && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    )}
                  </div>
                </Card>
              </div>

              {/* Signature manuscrite
                  - value={signatureData} : SignaturePad redessine la signature
                    apres remount (switch onglet). Sinon le canvas est blanc
                    meme si l'etat parent retient la dataURL.
                  - Statut + bouton Effacer sont dans SignaturePad lui-meme,
                    ne pas dupliquer ici. */}
              {requiresSignature && (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-[#0F2D52] px-1">
                    {t("signature_manuscrite")}
                  </p>
                  <div
                    className={cn(
                      "rounded-md border bg-white p-3",
                      !finalAckDone && "opacity-50 pointer-events-none",
                    )}
                  >
                    <SignaturePad
                      value={signatureData}
                      onChange={setSignatureData}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>


        <div className="shrink-0 border-t bg-muted/30 px-3 py-2.5 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={pending}
            className="flex-1"
          >
            {tc("cancel")}
          </Button>
          {tab === "preview" ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setTab("actions")}
              className="flex-1 bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            >
              {t("passer_actions")}
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
      </DialogContent>
    </Dialog>
  );
}
