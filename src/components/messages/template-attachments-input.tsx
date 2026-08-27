"use client";
// Uploader pour les pieces jointes par defaut d'un template (multi-files)
import { useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Paperclip, X, FileText, Image as ImageIcon, Music } from "lucide-react";
import { toast } from "sonner";
import type { MessageAttachment } from "@/components/messages/message-attachment-display";
import { cn } from "@/lib/utils";

const MAX_MB = 10;
const MAX_FILES = 10;

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

export function TemplateAttachmentsInput({
  attachments,
  onChange,
}: {
  attachments: MessageAttachment[];
  onChange: (next: MessageAttachment[]) => void;
}) {
  const t = useTranslations("admin.messages");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    if (attachments.length + arr.length > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} pièces jointes`);
      return;
    }
    arr.forEach((file) => {
      if (file.size > MAX_MB * 1024 * 1024) {
        toast.error(`${file.name} : trop volumineux (max ${MAX_MB} Mo)`);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const isImage = file.type.startsWith("image/");
        const isPdf = file.type === "application/pdf";
        const isAudio = file.type.startsWith("audio/");
        const kind: MessageAttachment["kind"] = isImage ? "image" : isPdf ? "pdf" : isAudio ? "audio" : "file";
        onChange([...attachments, {
          kind, name: file.name, mimeType: file.type || "application/octet-stream", size: file.size, dataUrl,
        }]);
      };
      reader.onerror = () => toast.error(t("lecture_impossible"));
      reader.readAsDataURL(file);
    });
  }, [attachments, onChange]);

  const removeAt = (idx: number) => onChange(attachments.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{t("fichiers_seront_automatiquement_attaches_messages")}</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-xs px-2.5 py-1 rounded-md border hover:bg-muted flex items-center gap-1 transition-colors"
        >
          <Paperclip className="h-3 w-3" />Ajouter
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.currentTarget.value = "";
          }}
        />
      </div>
      {attachments.length > 0 && (
        <ul className="space-y-1">
          {attachments.map((att, i) => {
            const Icon = att.kind === "image" ? ImageIcon : att.kind === "pdf" ? FileText : att.kind === "audio" ? Music : Paperclip;
            const iconClr = att.kind === "image" ? "text-emerald-600" : att.kind === "pdf" ? "text-red-600" : att.kind === "audio" ? "text-violet-600" : "text-muted-foreground";
            return (
              <li key={i} className={cn("flex items-center gap-2 rounded-md border p-2 bg-muted/20")}>
                <div className="h-9 w-9 rounded bg-background flex items-center justify-center shrink-0 overflow-hidden border">
                  {att.kind === "image" ? <img src={att.dataUrl} alt="" className="h-full w-full object-cover" /> : <Icon className={cn("h-5 w-5", iconClr)} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{att.name}</p>
                  <p className="text-[10px] text-muted-foreground">{fmtSize(att.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  aria-label={t("retirer")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {attachments.length === 0 && (
        <p className="text-[10px] text-muted-foreground italic">{t("aucune_piece_jointe_defaut")}</p>
      )}
    </div>
  );
}
