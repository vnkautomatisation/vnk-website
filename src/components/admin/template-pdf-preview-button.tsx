"use client";
// Bouton client qui declenche l'apercu PDF d'un template de document.
//
// Pipeline :
//   1. POST le markdown + ids vers /api/admin/document-templates/preview-pdf
//   2. Recupere le Blob de reponse
//   3. Cree une URL temporaire (URL.createObjectURL)
//   4. Ouvre PdfPreviewModal sur cette URL
//   5. Revoke l'URL a la fermeture
//
// Robustesse :
//   - Si bodyMarkdown est vide/null, on n'envoie pas la requete et on
//     affiche un toast clair.
//   - Si l'utilisateur ferme le modal avant la fin du fetch, on annule
//     proprement (via AbortController) au lieu d'ouvrir un modal "fantome".
//   - Si le fetch echoue, on affiche un toast par defaut + log console
//     pour faciliter le debug en prod.
//
// Usage minimal :
//   <TemplatePdfPreviewButton bodyMarkdown={md} title="Contrat CDI" documentType="contract" />
//
// Avec un trigger custom :
//   <TemplatePdfPreviewButton ... trigger={<Button variant="ghost">Voir PDF</Button>} />
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfPreviewModal } from "@/components/admin/pdf-preview-modal";
import type { TemplateDocumentType } from "@/lib/services/pdf-template-renderer";

// Convertit un Blob en data URL via FileReader. On utilise des data URL au lieu
// de blob URLs car elles sont immutables, survivent aux re-renders React Strict
// Mode, et s'affichent fiablement dans les iframes (Chrome ne renvoie pas
// d'icone "fichier deplace").
async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.readAsDataURL(blob);
  });
}

export interface TemplatePdfPreviewButtonProps {
  bodyMarkdown: string;
  title: string;
  documentType: TemplateDocumentType;
  /** ID de l'employe pour resoudre le contexte des variables. */
  employeeId?: number;
  /** ID du contrat (override les valeurs salaire/poste/etc.). */
  contractId?: number;
  /** Metadonnees optionnelles (affichees dans le header du PDF). */
  metadata?: {
    version?: string;
    employeeName?: string;
    companyName?: string;
    documentNumber?: string;
  };
  /** Contexte additionnel a injecter ({{key}} => value). */
  extraContext?: Record<string, string>;
  /**
   * Scope de signature du template. Si fourni, l'apercu PDF affiche uniquement
   * les blocs signature correspondants (employee_only -> EMPLOYE seul,
   * employer_only -> EMPLOYEUR seul, both -> les deux, none -> aucun).
   * Si omis, defaut "both" pour retrocompat.
   */
  signatureScope?: "employee_only" | "employer_only" | "both" | "none";
  /**
   * Cle du template (ex. "engagement_cpa_accountant") — sert au serveur
   * a appliquer un poste suggere pour l'apercu (CPA -> Comptable, etc.).
   */
  templateKey?: string;
  /** Element declencheur custom (par defaut : Button "Aperçu PDF"). */
  trigger?: React.ReactNode;
  /** Variante par defaut du bouton si pas de trigger custom. */
  variant?: "default" | "outline" | "secondary" | "ghost" | "link";
  /** Taille par defaut du bouton si pas de trigger custom. */
  size?: "default" | "sm" | "lg" | "icon";
  /** Classe additionnelle sur le bouton par defaut. */
  className?: string;
  /** Appele si la generation echoue (affichage toast par exemple). */
  onError?: (err: Error) => void;
}

export function TemplatePdfPreviewButton(props: TemplatePdfPreviewButtonProps) {
  const t = useTranslations("admin.ui");
  const [open, setOpen] = useState(false);

  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);


  const cancelledRef = useRef(false);


  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      abortRef.current?.abort();
    };
  }, []);

  const reportError = useCallback(
    (err: Error) => {
      console.error("[TemplatePdfPreviewButton] PDF preview error:", err);

      if (props.onError) {
        props.onError(err);
      } else {
        toast.error(err.message || t("impossible_generer_apercu"));
      }
    },
    [props],
  );

  const handleOpen = useCallback(async () => {
    if (loading) return;


    const body = (props.bodyMarkdown ?? "").trim();
    if (!body) {
      reportError(
        new Error(
          t("aucun_contenu_previsualiser_verifiez_modele"),
        ),
      );
      return;
    }

    cancelledRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    try {
      const res = await fetch("/api/admin/document-templates/preview-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bodyMarkdown: props.bodyMarkdown,
          title: props.title,
          documentType: props.documentType,
          employeeId: props.employeeId,
          contractId: props.contractId,
          metadata: props.metadata,
          extraContext: props.extraContext,
          signatureScope: props.signatureScope,
          templateKey: props.templateKey,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        let msg = `Erreur ${res.status}`;
        try {
          const data = await res.json();
          if (data?.error) msg = String(data.error);
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      const blob = await res.blob();
      if (cancelledRef.current) {

        return;
      }
      if (blob.size === 0) {
        throw new Error(t("apercu_vide_retourne_serveur"));
      }


      const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
      const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46 && head[4] === 0x2d;
      if (!isPdf) {


        try {
          const txt = await blob.text();
          const data = JSON.parse(txt);
          if (data?.error) throw new Error(String(data.error));
        } catch { /* pas du JSON */ }
        throw new Error(t("reponse_serveur_invalide_pas_pdf"));
      }


      const url = await blobToDataUrl(blob);
      if (cancelledRef.current) return;
      setDataUrl(url);
      setOpen(true);
    } catch (e) {

      if ((e as Error)?.name === "AbortError") return;
      reportError(e as Error);
    } finally {
      if (!cancelledRef.current) setLoading(false);
      abortRef.current = null;
    }
  }, [props, loading, reportError]);

  const handleClose = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    setOpen(false);


    window.setTimeout(() => setDataUrl(null), 300);
  }, []);

  const triggerNode = props.trigger ? (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); void handleOpen(); }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          void handleOpen();
        }
      }}
      style={{ display: "inline-flex" }}
      aria-busy={loading}
    >
      {props.trigger}
    </span>
  ) : (
    <Button
      type="button"
      variant={props.variant ?? "outline"}
      size={props.size ?? "sm"}
      onClick={() => void handleOpen()}
      disabled={loading}
      className={props.className}
    >
      {loading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("generation")}
        </>
      ) : (
        <>
          <FileText className="h-3.5 w-3.5" />
          {t("apercu_pdf")}
        </>
      )}
    </Button>
  );

  return (
    <>
      {triggerNode}
      <PdfPreviewModal
        open={open}
        url={dataUrl}
        title={t("template_pdf_preview_apercu_p0", { p0: props.title })}
        description={props.metadata?.employeeName
          ? `Destinataire : ${props.metadata.employeeName}`
          : undefined}
        downloadFilename={`${props.title
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-zA-Z0-9-_]+/g, "-")
          .toLowerCase()
          .slice(0, 80) || "apercu"}.pdf`}
        onClose={handleClose}
      />
    </>
  );
}
