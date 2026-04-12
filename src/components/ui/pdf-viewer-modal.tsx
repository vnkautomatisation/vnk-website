"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  /** API URL to fetch the PDF blob, e.g. "/api/quotes/123/pdf" */
  pdfUrl: string;
  /** Document info displayed in header */
  title: string;
  documentNumber?: string;
  date?: string;
  /** Optional extra action buttons in the footer (e.g., "Accepter", "Signer") */
  actions?: React.ReactNode;
  /** Filename for download (without .pdf) */
  downloadName?: string;
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
}: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch PDF blob when modal opens
  useEffect(() => {
    if (!open) {
      // Cleanup on close
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
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Le PDF n'est pas disponible pour le moment.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, pdfUrl]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Download
  const handleDownload = useCallback(() => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${downloadName ?? documentNumber ?? "document"}.pdf`;
    a.click();
  }, [blobUrl, downloadName, documentNumber]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-[95vw] h-[92vh] max-w-5xl flex flex-col rounded-xl overflow-hidden bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#0F2D52] text-white">
          <div className="min-w-0">
            <h2 className="font-bold text-base truncate">{title}</h2>
            <div className="flex items-center gap-3 text-xs text-white/70">
              {documentNumber && <span className="font-mono">{documentNumber}</span>}
              {date && <span>{date}</span>}
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

        {/* Body */}
        <div className="flex-1 bg-gray-100 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">{error}</p>
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

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t bg-background">
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!blobUrl}>
            <Download className="h-4 w-4 mr-1" />
            Telecharger
          </Button>
          <div className="flex items-center gap-2">
            {actions}
            <Button variant="outline" size="sm" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
