"use client";
// Modal de prévisualisation PDF générique.
// Convention VNK : tous les PDF s'ouvrent via ce modal (jamais window.open direct).
// L'utilisateur peut prévisualiser, télécharger, ou ouvrir en nouvel onglet.
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, Loader2, FileText } from "lucide-react";

export function PdfPreviewModal({
  open, url, title, description, downloadFilename, onClose,
}: {
  open: boolean;

  url: string | null;
  title: string;
  description?: string;

  downloadFilename?: string;
  onClose: () => void;
}) {
  const t = useTranslations("admin.ui");
  const tc = useTranslations("common");
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);


  const [stamp, setStamp] = useState<number>(() => Date.now());
  useEffect(() => {
    if (open) {
      setStamp(Date.now());
      setLoading(true);
      setHasError(false);
    }
  }, [open, url]);









  const isOpaqueUrl = !!url && (url.startsWith("blob:") || url.startsWith("data:"));
  const fullUrl = url
    ? (isOpaqueUrl
      ? url
      : `${url}${url.includes("?") ? "&" : "?"}_t=${stamp}`)
    : null;

  const download = () => {
    if (!fullUrl) return;
    const a = document.createElement("a");
    a.href = fullUrl;
    if (downloadFilename) a.download = downloadFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {/* Responsive : fullscreen mobile (< sm), modal 95vw desktop. min-h-[100dvh] sur mobile
          pour utiliser TOUT l'écran disponible (dvh gère barre URL Safari iOS). */}
      <DialogContent
        className="p-0 overflow-hidden flex flex-col w-screen h-[100dvh] max-w-none max-h-none rounded-none sm:w-[95vw] sm:max-w-4xl sm:max-h-[92vh] sm:h-auto sm:rounded-lg"
        aria-describedby={undefined}
      >
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-4 sm:px-5 py-3 sm:py-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-white text-sm sm:text-base flex items-center gap-2 pr-8">
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">{title}</span>
            </DialogTitle>
            {description && (
              <DialogDescription className="text-white/80 text-[11px] sm:text-xs truncate">{description}</DialogDescription>
            )}
          </DialogHeader>
        </div>
        <div className="relative flex-1 bg-muted/20 min-h-[60vh] sm:min-h-[70vh]">
          {!fullUrl ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">{t("aucune_url_fournie")}</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                {t("document_n_apos_pas_disponible")}
              </p>
            </div>
          ) : (
            <>
              {loading && !hasError && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <div className="bg-background/90 rounded-md px-4 py-3 shadow-sm flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-[#0F2D52]" />
                    <span className="text-xs text-foreground">{t("chargement_pdf")}</span>
                  </div>
                </div>
              )}
              {hasError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-foreground">{t("apercu_indisponible")}</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">{t("pdf_preview_modal_le_pdf_n_a_pas_pu_etre")}</p>
                </div>
              ) : (
                <iframe
                  key={stamp}
                  src={fullUrl}
                  title={title}
                  className="absolute inset-0 w-full h-full border-0 bg-white"
                  onLoad={() => setLoading(false)}
                  onError={() => { setLoading(false); setHasError(true); }}
                />
              )}
            </>
          )}
        </div>
        <DialogFooter className="px-3 sm:px-5 py-2 sm:py-3 border-t bg-muted/30 shrink-0 gap-2 flex-wrap [&>button]:flex-1 sm:[&>button]:flex-initial">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fullUrl && window.open(fullUrl, "_blank", "noopener,noreferrer")}
            disabled={!fullUrl}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">{t("ouvrir_onglet")}</span>
            <span className="sm:hidden">{t("onglet")}</span>
          </Button>
          <Button size="sm" onClick={download} disabled={!fullUrl} className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white">
            <Download className="h-3.5 w-3.5 mr-1.5" />{tc("download")}
          </Button>
          <Button size="sm" variant="outline" onClick={onClose}>{tc("close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
