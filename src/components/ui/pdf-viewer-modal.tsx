"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Download, Loader2, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onClose: () => void;
  pdfUrl: string;
  title: string;
  documentNumber?: string;
  date?: string;
  /** Action buttons rendered in the footer (e.g. Accepter, Signer, Payer) */
  actions?: React.ReactNode;
  downloadName?: string;
  /** Change this to force re-fetch the PDF (e.g. after signing) */
  refreshKey?: number;
};

export function PdfViewerModal({
  open,
  onClose,
  pdfUrl,
  title,
  documentNumber,
  date,
  actions,
  downloadName,
  refreshKey,
}: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(pdfUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        setBlobUrl(URL.createObjectURL(blob));
      })
      .catch(() => {
        if (cancelled) return;
        setError("Le PDF n'est pas disponible pour le moment.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, pdfUrl, refreshKey]);

  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [blobUrl]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleDownload = useCallback(() => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${downloadName ?? documentNumber ?? "document"}.pdf`;
    a.click();
  }, [blobUrl, downloadName, documentNumber]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#0a1628]" onClick={onClose} />

      <div className="relative z-10 flex flex-col h-full">
        {/* Header — titre + info */}
        <div className="flex items-center justify-between px-4 sm:px-6 h-14 bg-[#0F2D52] text-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-sm sm:text-base truncate">{title}</h2>
              <div className="flex items-center gap-2 text-[11px] text-white/60">
                {documentNumber && <span className="font-mono">{documentNumber}</span>}
                {documentNumber && date && <span>·</span>}
                {date && <span>{date}</span>}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-8 w-8 rounded-md hover:bg-white/10 flex items-center justify-center transition-colors shrink-0"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* PDF body */}
        <div className="flex-1 bg-[#525659] relative">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-white/40" />
              <p className="text-sm text-white/50">Chargement du document...</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <AlertCircle className="h-10 w-10 text-white/30" />
              <p className="text-sm text-white/50">{error}</p>
              <Button variant="outline" size="sm" onClick={onClose} className="text-white border-white/30 hover:bg-white/10">
                Fermer
              </Button>
            </div>
          )}
          {blobUrl && (
            <iframe
              src={blobUrl}
              className="w-full h-full border-0"
              title={title}
            />
          )}
        </div>

        {/* Footer — actions bien visibles */}
        <div className="flex items-center justify-between px-4 sm:px-6 h-16 bg-white border-t border-gray-200 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={!blobUrl}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Telecharger
          </Button>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={onClose}>
              Fermer
            </Button>
            {actions}
          </div>
        </div>
      </div>
    </div>
  );
}
