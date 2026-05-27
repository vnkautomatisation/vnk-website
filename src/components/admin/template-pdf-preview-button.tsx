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
  const [open, setOpen] = useState(false);
  // On stocke une DATA URL (immutable, survit aux re-renders) au lieu d'un blob URL.
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // AbortController courant (annulation si user ferme avant la fin du fetch)
  const abortRef = useRef<AbortController | null>(null);
  // Marque si on a ete demonte ou si l'utilisateur a annule, pour eviter
  // d'ouvrir un modal sur un blob qui ne sera plus utilise.
  const cancelledRef = useRef(false);

  // Cleanup au demontage : abort fetch en cours (data URL n'a pas besoin de revoke)
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      abortRef.current?.abort();
    };
  }, []);

  const reportError = useCallback(
    (err: Error) => {
      console.error("[TemplatePdfPreviewButton] PDF preview error:", err);
      // onError prend priorite ; sinon toast par defaut
      if (props.onError) {
        props.onError(err);
      } else {
        toast.error(err.message || "Impossible de generer l'apercu");
      }
    },
    [props],
  );

  const handleOpen = useCallback(async () => {
    if (loading) return;

    // Garde-fou : pas de body utilisable -> message clair plutot que POST cassé
    const body = (props.bodyMarkdown ?? "").trim();
    if (!body) {
      reportError(
        new Error(
          "Aucun contenu a previsualiser. Verifiez que le modele n'est pas vide.",
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
        // Modal ferme / composant demonte pendant le fetch : on jette le blob
        return;
      }
      if (blob.size === 0) {
        throw new Error("Aperçu vide retourne par le serveur");
      }
      // Verifie que c'est bien un PDF (header %PDF-) — evite d'afficher
      // un faux PDF en iframe (qui donnerait l'icone "fichier casse").
      const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
      const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46 && head[4] === 0x2d;
      if (!isPdf) {
        // Le serveur a peut-etre renvoye du JSON 500 (cas extreme) ; on tente de
        // le decoder pour afficher un message clair.
        try {
          const txt = await blob.text();
          const data = JSON.parse(txt);
          if (data?.error) throw new Error(String(data.error));
        } catch { /* pas du JSON */ }
        throw new Error("Reponse serveur invalide (pas un PDF). Consultez les logs.");
      }
      // Conversion en data URL (FileReader) : immutable + survit aux re-renders +
      // pas d'invalidation comme avec blob URLs.
      const url = await blobToDataUrl(blob);
      if (cancelledRef.current) return;
      setDataUrl(url);
      setOpen(true);
    } catch (e) {
      // AbortError n'est pas une vraie erreur : l'user a juste ferme
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
    // Data URL : pas besoin de revoke. On nettoie l'etat apres la fermeture
    // du modal (animation Radix ~200ms) pour eviter de blanker l'iframe.
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
          Generation…
        </>
      ) : (
        <>
          <FileText className="h-3.5 w-3.5" />
          Aperçu PDF
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
        title={`Aperçu : ${props.title}`}
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
