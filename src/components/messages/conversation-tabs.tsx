"use client";
// Onglets Messages / Fichiers / Liens dans une conversation
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
import { MessageSquare, Paperclip, Link as LinkIcon, FileText, Image as ImageIcon, Music } from "lucide-react";
import { PdfViewerModal } from "@/components/ui/pdf-viewer-modal";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type AttachmentLite = {
  kind: "image" | "audio" | "pdf" | "file";
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  durationSec?: number;
};

export type MsgLite = {
  id: number;
  sender: string;
  content: string | null;
  createdAt: string;
  attachmentData: AttachmentLite | null;
  attachmentsData: AttachmentLite[] | null;
  deletedAt: string | null;
};

export type ConvTab = "messages" | "files" | "links";

const URL_REGEX = /https?:\/\/[^\s<>"]+/g;

function getAtts(m: MsgLite): AttachmentLite[] {
  if (m.attachmentsData && m.attachmentsData.length > 0) return m.attachmentsData;
  if (m.attachmentData) return [m.attachmentData];
  return [];
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

function extractLinks(messages: MsgLite[]): { url: string; msgId: number; date: string; sender: string }[] {
  const out: { url: string; msgId: number; date: string; sender: string }[] = [];
  for (const m of messages) {
    if (m.deletedAt || !m.content) continue;
    const matches = m.content.match(URL_REGEX);
    if (matches) {
      for (const url of matches) {
        out.push({ url, msgId: m.id, date: m.createdAt, sender: m.sender });
      }
    }
  }
  return out.reverse();
}

export function ConversationTabsBar({
  active,
  onChange,
  filesCount,
  linksCount,
}: {
  active: ConvTab;
  onChange: (t: ConvTab) => void;
  filesCount: number;
  linksCount: number;
}) {
  const t = useTranslations("admin.messages");
  return (
    <div className="border-b shrink-0 flex items-center gap-1 px-2 py-1 bg-muted/20">
      <TabBtn active={active === "messages"} onClick={() => onChange("messages")} icon={<MessageSquare className="h-3.5 w-3.5" />} label={t("messages")} />
      <TabBtn active={active === "files"} onClick={() => onChange("files")} icon={<Paperclip className="h-3.5 w-3.5" />} label={t("fichiers")} badge={filesCount} />
      <TabBtn active={active === "links"} onClick={() => onChange("links")} icon={<LinkIcon className="h-3.5 w-3.5" />} label={t("liens")} badge={linksCount} />
    </div>
  );
}

function TabBtn({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
        active ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
      )}
    >
      {icon}
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="text-[9px] bg-muted rounded-full px-1.5">{badge}</span>
      )}
    </button>
  );
}

export function ConversationFilesTab({ messages }: { messages: MsgLite[] }) {
  const t = useTranslations("admin.messages");
  const [pdfPreview, setPdfPreview] = useState<AttachmentLite | null>(null);
  const [imgPreview, setImgPreview] = useState<AttachmentLite | null>(null);
  const dateTag = useDateLocale();

  const allAtts = useMemo(() => {
    const out: { att: AttachmentLite; msgId: number; date: string; sender: string }[] = [];
    for (const m of messages) {
      if (m.deletedAt) continue;
      for (const att of getAtts(m)) {
        out.push({ att, msgId: m.id, date: m.createdAt, sender: m.sender });
      }
    }
    return out.reverse();
  }, [messages]);

  if (allAtts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center p-8">
        <div>
          <Paperclip className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{t("aucun_fichier_partage")}</p>
        </div>
      </div>
    );
  }

  const images = allAtts.filter((a) => a.att.kind === "image");
  const others = allAtts.filter((a) => a.att.kind !== "image");

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {images.length > 0 && (
        <section>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <ImageIcon className="h-3 w-3" />Images ({images.length})
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
            {images.map(({ att, msgId, date }) => (
              <button
                key={`${msgId}-${att.name}`}
                type="button"
                onClick={() => setImgPreview(att)}
                className="aspect-square rounded-lg overflow-hidden border hover:opacity-90 transition-opacity"
                title={`${att.name} · ${new Date(date).toLocaleDateString(dateTag)}`}
              >
                <img src={att.dataUrl} alt={att.name} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </section>
      )}
      {others.length > 0 && (
        <section>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <FileText className="h-3 w-3" />Documents ({others.length})
          </p>
          <ul className="space-y-1">
            {others.map(({ att, msgId, date, sender }) => {
              const Icon = att.kind === "pdf" ? FileText : att.kind === "audio" ? Music : Paperclip;
              const iconColor = att.kind === "pdf" ? "text-red-600" : att.kind === "audio" ? "text-violet-600" : "text-muted-foreground";
              return (
                <li key={`${msgId}-${att.name}`}>
                  <button
                    type="button"
                    onClick={() => att.kind === "pdf" ? setPdfPreview(att) : null}
                    className={cn(
                      "w-full flex items-center gap-2 rounded-lg border p-2 text-left transition-colors",
                      att.kind === "pdf" ? "hover:bg-muted cursor-pointer" : "cursor-default"
                    )}
                  >
                    <div className="h-9 w-9 rounded bg-muted/40 flex items-center justify-center shrink-0">
                      <Icon className={cn("h-5 w-5", iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{att.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {fmtSize(att.size)} · {sender === "vnk" ? t("vous_seul") : t("client")} · {new Date(date).toLocaleDateString(dateTag)}
                      </p>
                    </div>
                    {att.kind !== "pdf" && (
                      <a
                        href={att.dataUrl}
                        download={att.name}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] px-2 py-0.5 rounded bg-[#0F2D52] text-white hover:bg-[#1a3a66] shrink-0"
                      >
                        {t("telecharger")}
                      </a>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {pdfPreview && (
        <PdfViewerModal
          open
          onClose={() => setPdfPreview(null)}
          pdfUrl={pdfPreview.dataUrl}
          title={pdfPreview.name}
          downloadName={pdfPreview.name.replace(/\.pdf$/i, "")}
        />
      )}
      <Dialog open={!!imgPreview} onOpenChange={(o) => { if (!o) setImgPreview(null); }}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 sm:p-3">
          <DialogTitle className="sr-only">{imgPreview?.name}</DialogTitle>
          {imgPreview && (
            <>
              <img src={imgPreview.dataUrl} alt={imgPreview.name} className="max-w-full max-h-[80vh] mx-auto block rounded" />
              <div className="flex items-center justify-between gap-2 px-2 pt-1">
                <p className="text-xs text-muted-foreground truncate">{imgPreview.name} · {fmtSize(imgPreview.size)}</p>
                <a href={imgPreview.dataUrl} download={imgPreview.name}
                   className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-[#0F2D52] text-white hover:bg-[#1a3a66]">
                  {t("telecharger")}
                </a>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ConversationLinksTab({ messages, onJumpToMessage }: { messages: MsgLite[]; onJumpToMessage: (id: number) => void }) {
  const t = useTranslations("admin.messages");
  const dateTag = useDateLocale();
  const links = useMemo(() => extractLinks(messages), [messages]);

  if (links.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center p-8">
        <div>
          <LinkIcon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{t("aucun_lien_partage")}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <ul className="space-y-1">
        {links.map((l, i) => {
          let host = "";
          try { host = new URL(l.url).host; } catch { host = l.url; }
          return (
            <li key={`${l.msgId}-${i}`}>
              <div className="flex items-start gap-2 rounded-lg border p-2 hover:bg-muted transition-colors">
                <div className="h-8 w-8 rounded bg-muted/40 flex items-center justify-center shrink-0">
                  <LinkIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-[#0F2D52] hover:underline truncate block"
                  >
                    {l.url}
                  </a>
                  <p className="text-[10px] text-muted-foreground">
                    {host} · {l.sender === "vnk" ? t("vous_seul") : t("client")} · {new Date(l.date).toLocaleDateString(dateTag)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onJumpToMessage(l.msgId)}
                  className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-background border shrink-0"
                >
                  {t("voir")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
