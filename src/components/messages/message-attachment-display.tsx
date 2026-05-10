"use client";
// Affiche l'attachement d'un message selon son type (image / audio / pdf / file)
import { useState } from "react";
import { FileText, Download, Paperclip } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PdfViewerModal } from "@/components/ui/pdf-viewer-modal";
import { cn } from "@/lib/utils";

export type MessageAttachment = {
  kind: "image" | "audio" | "pdf" | "file";
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  durationSec?: number;
};

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

export function MessageAttachmentDisplay({
  attachment,
  isAdmin,
}: {
  attachment: MessageAttachment;
  isAdmin: boolean;
}) {
  const [imgOpen, setImgOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);

  if (attachment.kind === "image") {
    return (
      <>
        <button
          type="button"
          onClick={() => setImgOpen(true)}
          className="block max-w-[280px] rounded-lg overflow-hidden border border-white/10 hover:opacity-95 transition-opacity"
        >
          <img src={attachment.dataUrl} alt={attachment.name} className="block max-h-[200px] w-full object-cover" />
        </button>
        <Dialog open={imgOpen} onOpenChange={setImgOpen}>
          <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 sm:p-3">
            <DialogTitle className="sr-only">{attachment.name}</DialogTitle>
            <img
              src={attachment.dataUrl}
              alt={attachment.name}
              className="max-w-full max-h-[80vh] mx-auto block rounded"
            />
            <div className="flex items-center justify-between gap-2 px-2 pt-1">
              <p className="text-xs text-muted-foreground truncate">{attachment.name} · {fmtSize(attachment.size)}</p>
              <a
                href={attachment.dataUrl}
                download={attachment.name}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-[#0F2D52] text-white hover:bg-[#1a3a66] transition-colors"
              >
                <Download className="h-3 w-3" />Télécharger
              </a>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (attachment.kind === "audio") {
    return (
      <div className={cn("flex items-center gap-2 rounded-lg p-2", isAdmin ? "bg-white/10" : "bg-background border")}>
        <audio controls src={attachment.dataUrl} className="h-8 max-w-[220px]" />
        <span className={cn("text-[10px] tabular-nums", isAdmin ? "text-white/70" : "text-muted-foreground")}>
          {attachment.durationSec != null ? `${attachment.durationSec}s` : fmtSize(attachment.size)}
        </span>
      </div>
    );
  }

  if (attachment.kind === "pdf") {
    return (
      <>
        <button
          type="button"
          onClick={() => setPdfOpen(true)}
          className={cn(
            "flex items-center gap-2 rounded-lg p-2 transition-colors text-left max-w-[280px]",
            isAdmin ? "bg-white/10 hover:bg-white/15" : "bg-background border hover:bg-muted"
          )}
        >
          <div className={cn("h-9 w-9 rounded flex items-center justify-center shrink-0", isAdmin ? "bg-white/15" : "bg-red-100")}>
            <FileText className={cn("h-5 w-5", isAdmin ? "text-white" : "text-red-600")} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn("text-xs font-medium truncate", isAdmin ? "text-white" : "text-foreground")}>{attachment.name}</p>
            <p className={cn("text-[10px]", isAdmin ? "text-white/60" : "text-muted-foreground")}>PDF · {fmtSize(attachment.size)}</p>
          </div>
        </button>
        {pdfOpen && (
          <PdfViewerModal
            open
            onClose={() => setPdfOpen(false)}
            pdfUrl={attachment.dataUrl}
            title={attachment.name}
            downloadName={attachment.name.replace(/\.pdf$/i, "")}
          />
        )}
      </>
    );
  }

  // Generic file
  return (
    <a
      href={attachment.dataUrl}
      download={attachment.name}
      className={cn(
        "flex items-center gap-2 rounded-lg p-2 transition-colors max-w-[280px]",
        isAdmin ? "bg-white/10 hover:bg-white/15" : "bg-background border hover:bg-muted"
      )}
    >
      <div className={cn("h-9 w-9 rounded flex items-center justify-center shrink-0", isAdmin ? "bg-white/15" : "bg-muted")}>
        <Paperclip className={cn("h-5 w-5", isAdmin ? "text-white" : "text-muted-foreground")} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-xs font-medium truncate", isAdmin ? "text-white" : "text-foreground")}>{attachment.name}</p>
        <p className={cn("text-[10px]", isAdmin ? "text-white/60" : "text-muted-foreground")}>{fmtSize(attachment.size)}</p>
      </div>
      <Download className={cn("h-4 w-4 shrink-0", isAdmin ? "text-white" : "text-muted-foreground")} />
    </a>
  );
}
