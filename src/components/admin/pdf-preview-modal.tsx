"use client";
// Modal de prévisualisation PDF générique.
// Convention VNK : tous les PDF s'ouvrent via ce modal (jamais window.open direct).
// L'utilisateur peut prévisualiser, télécharger, ou ouvrir en nouvel onglet.
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, Loader2, FileText } from "lucide-react";

export function PdfPreviewModal({
  open, url, title, description, downloadFilename, onClose,
}: {
  open: boolean;
  /** URL de l'endpoint PDF (sans timestamp — on rajoute un cache-buster). */
  url: string | null;
  title: string;
  description?: string;
  /** Nom de fichier suggéré pour le téléchargement. */
  downloadFilename?: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Cache-buster pour éviter de servir un PDF stale après modification
  const [stamp, setStamp] = useState<number>(() => Date.now());
  useEffect(() => {
    if (open) {
      setStamp(Date.now());
      setLoading(true);
      setHasError(false);
    }
  }, [open, url]);

  // Refactor : on ne sort plus du composant avant le Dialog (sinon l'animation
  // d'ouverture/fermeture est cassée). On garde une URL optionnelle et on
  // affiche un état "Aucune URL fournie" si null.
  //
  // IMPORTANT : les blob URL (`blob:...`) et data URL (`data:...`) ne supportent
  // PAS de query string — y ajouter `?_t=...` casse l'iframe avec un message
  // "fichier deplace ou supprime". On applique le cache-buster uniquement sur
  // les URL HTTP(S).
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
              <p className="text-sm font-medium text-foreground">Aucune URL fournie</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                Le document n&apos;est pas disponible pour le moment.
              </p>
            </div>
          ) : (
            <>
              {loading && !hasError && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <div className="bg-background/90 rounded-md px-4 py-3 shadow-sm flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-[#0F2D52]" />
                    <span className="text-xs text-foreground">Chargement du PDF...</span>
                  </div>
                </div>
              )}
              {hasError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-foreground">Aperçu indisponible</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">
                    Le PDF n&apos;a pas pu être chargé. Le document a peut-être expiré, été supprimé,
                    ou votre navigateur ne sait pas l&apos;afficher inline. Utilisez les boutons
                    ci-dessous pour le télécharger ou l&apos;ouvrir dans un nouvel onglet.
                  </p>
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
            <span className="hidden sm:inline">Ouvrir dans un onglet</span>
            <span className="sm:hidden">Onglet</span>
          </Button>
          <Button size="sm" onClick={download} disabled={!fullUrl} className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white">
            <Download className="h-3.5 w-3.5 mr-1.5" />Télécharger
          </Button>
          <Button size="sm" variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
