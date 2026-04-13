"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { MessageCircle, X, Send, Paperclip, Maximize2, Minimize2, Check, CheckCheck, Smile, FileText, Download, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

type Message = {
  id: number;
  sender: "client" | "vnk";
  content: string;
  createdAt: string;
  isRead: boolean;
};

const EMOJIS = ["👍", "👋", "😊", "🙏", "✅", "⏰", "🔧", "⚡", "🎉", "💡", "📎", "❤️"];

// ── Rich message renderer pour les messages automatises ──
function RichMessageContent({ content }: { content: string }) {
  // Demande de projet
  if (content.includes("NOUVELLE DEMANDE DE PROJET")) {
    const lines = content.split("\n").filter((l) => l.trim());
    const fields: { key: string; val: string }[] = [];
    let desc = "";
    let inDesc = false;
    for (const line of lines) {
      if (line.includes("DESCRIPTION")) { inDesc = true; continue; }
      if (inDesc && !line.startsWith("─")) { desc += line.trim() + " "; continue; }
      const match = line.match(/^(\w[\w\s.]+?)\s*:\s*(.+)$/);
      if (match) fields.push({ key: match[1].trim(), val: match[2].trim() });
    }
    const urgence = fields.find((f) => f.key === "Urgence")?.val ?? "";
    const isUrgent = urgence.toLowerCase().includes("urgent");
    return (
      <div className="space-y-2">
        <div className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold", isUrgent ? "bg-red-50 text-red-700" : "bg-[#0F2D52]/10 text-[#0F2D52]")}>
          <span>{isUrgent ? "🔴" : "🚀"}</span>
          <span>Nouvelle demande de projet</span>
        </div>
        <div className="space-y-1 text-xs">
          {fields.map((f) => (
            <div key={f.key} className="flex gap-2">
              <span className="text-muted-foreground shrink-0 w-16">{f.key}</span>
              <span className="font-medium">{f.val}</span>
            </div>
          ))}
        </div>
        {desc.trim() && (
          <div className="border-t pt-1.5 mt-1">
            <p className="text-[0.625rem] text-muted-foreground uppercase font-semibold mb-0.5">Description</p>
            <p className="text-xs leading-relaxed">{desc.trim()}</p>
          </div>
        )}
      </div>
    );
  }

  // Facture / Devis / Contrat genere
  if (content.includes("Facture") && content.includes("generee") || content.includes("Devis") && content.includes("envoye") || content.includes("Contrat") && content.includes("genere")) {
    const numMatch = content.match(/(F-\d{4}-\d+|D-\d{4}-\d+|CT-\d{4}-\d+)/);
    const amountMatch = content.match(/([\d\s]+,?\d*)\s*\$/);
    const num = numMatch?.[1] ?? "";
    const amount = amountMatch?.[1]?.trim() ?? "";
    const isInvoice = num.startsWith("F-");
    const isQuote = num.startsWith("D-");
    const isContract = num.startsWith("CT-");
    const color = isInvoice ? "emerald" : isQuote ? "amber" : "blue";
    const label = isInvoice ? "Facture" : isQuote ? "Devis" : "Contrat";
    const icon = isInvoice ? "💰" : isQuote ? "📋" : "📝";

    return (
      <div className={cn("rounded-lg border p-2.5 space-y-1.5", `border-${color}-200 bg-${color}-50/50`)}>
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <div>
            <p className="text-xs font-semibold">{label} {num}</p>
            {amount && <p className="text-sm font-bold">{amount} $</p>}
          </div>
        </div>
      </div>
    );
  }

  // RDV reserve
  if (content.includes("RDV reserve") || content.includes("rendez-vous") && content.includes("confirme")) {
    return (
      <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">📅</span>
          <p className="text-xs font-semibold">{content}</p>
        </div>
      </div>
    );
  }

  // Message normal
  return <p className="whitespace-pre-wrap break-words leading-relaxed">{content}</p>;
}

export function ChatWidget({
  clientId,
  clientName,
}: {
  clientId?: number;
  clientName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [previewPdf, setPreviewPdf] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = (clientName ?? "C").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  // ── SSE pour les notifications (tourne TOUJOURS, meme chat ferme) ──
  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout>;
    const connectBg = () => {
      es = new EventSource("/api/messages/stream");
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "new_message" && data.message) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === data.message.id)) return prev;
              return [...prev, data.message];
            });
          }
          if (data.type === "read_update" && data.ids) {
            setMessages((prev) =>
              prev.map((m) => (data.ids.includes(m.id) ? { ...m, isRead: true } : m))
            );
          }
        } catch {}
      };
      es.onerror = () => { es?.close(); retry = setTimeout(connectBg, 5000); };
    };

    // Charger les messages initiaux pour le badge
    fetch("/api/messages")
      .then((r) => r.json())
      .then((data) => { if (data.messages) setMessages(data.messages); })
      .catch(() => {});

    connectBg();
    return () => { es?.close(); clearTimeout(retry); };
  }, []);

  // ── Marquer lu quand le chat s'ouvre ──
  useEffect(() => {
    if (!open) return;
    const unread = messages.some((m) => m.sender === "vnk" && !m.isRead);
    if (unread) {
      setMessages((prev) => prev.map((m) => (m.sender === "vnk" && !m.isRead ? { ...m, isRead: true } : m)));
      fetch("/api/messages/mark-read", { method: "POST" }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const prevCountRef = useRef(0);
  useEffect(() => {
    // Auto-scroll seulement si nouveaux messages (pas a chaque poll)
    if (messages.length > prevCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevCountRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setExpanded(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setShowEmojis(false);
    const tempId = Date.now();
    setMessages((prev) => [...prev, { id: tempId, sender: "client", content, createdAt: new Date().toISOString(), isRead: false }]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    try {
      const res = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, channel: "chat" }) });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages((prev) => prev.map((m) => (m.id === tempId ? data.message : m)));
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(content);
    } finally {
      setSending(false);
    }
  }, [input, sending]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setInput((v) => v + `[Fichier: ${file.name}]`);
    e.target.value = "";
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
  };

  const unreadCount = messages.filter((m) => m.sender === "vnk" && !m.isRead).length;

  // ── Grouper par date ──
  const groupedMessages = messages.reduce<{ date: string; msgs: Message[] }[]>((acc, msg) => {
    const date = new Date(msg.createdAt).toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
    const last = acc[acc.length - 1];
    if (last && last.date === date) last.msgs.push(msg);
    else acc.push({ date, msgs: [msg] });
    return acc;
  }, []);

  return (
    <>
      {/* ── Bouton flottant avec avatar client ── */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-[70px] right-3 lg:bottom-6 lg:right-6 z-40 group"
          aria-label="Ouvrir le chat"
        >
          <div className="relative h-12 w-12 lg:h-14 lg:w-14 rounded-full bg-[#0F2D52] text-white shadow-xl flex items-center justify-center group-hover:scale-110 group-active:scale-95 transition-all ring-2 ring-white/30">
            <span className="text-sm lg:text-base font-bold">{initials}</span>
            {/* Indicateur en ligne */}
            <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white" />
          </div>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-white text-[0.625rem] font-bold flex items-center justify-center shadow-md">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* ── Panel ── */}
      {open && (
        <>
          {/* Backdrop petit ecran */}
          <div className="sm:hidden fixed inset-0 bottom-14 z-40 bg-black/50" onClick={() => { setOpen(false); setExpanded(false); }} />

          <div
            role="dialog"
            aria-modal="true"
            className={cn(
              "fixed z-50 flex flex-col overflow-hidden shadow-2xl border",
              expanded
                ? "inset-3 bottom-[62px] lg:inset-6 lg:bottom-6 rounded-2xl"
                : "bottom-14 right-0 w-full sm:w-[380px] sm:right-4 sm:rounded-2xl rounded-t-2xl h-[65vh] max-h-[550px] lg:bottom-6 lg:right-6 lg:h-[520px]"
            )}
          >
            {/* Header */}
            <div className="shrink-0 h-14 px-4 flex items-center justify-between bg-gradient-to-r from-[#0F2D52] to-[#1a4a7a] text-white">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative h-9 w-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold">{initials}</span>
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-[#0F2D52]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">Support VNK</p>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <p className="text-[0.625rem] text-white/70">En ligne</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <button onClick={() => setExpanded((e) => !e)} className="h-8 w-8 rounded-lg hover:bg-white/10 flex items-center justify-center" aria-label={expanded ? "Reduire" : "Agrandir"}>
                  {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => { setOpen(false); setExpanded(false); }} className="h-8 w-8 rounded-lg hover:bg-white/10 flex items-center justify-center" aria-label="Fermer">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 bg-[#f0f2f5] dark:bg-muted/30" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}>
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-14 w-14 rounded-full bg-[#0F2D52] flex items-center justify-center mx-auto mb-3 shadow-lg">
                    <MessageCircle className="h-6 w-6 text-white" />
                  </div>
                  <p className="text-sm font-semibold">Besoin d'aide ?</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-[220px] mx-auto">Notre equipe est disponible pour vous assister.</p>
                </div>
              ) : (
                groupedMessages.map((group) => (
                  <div key={group.date}>
                    {/* Date separator */}
                    <div className="flex items-center justify-center my-3">
                      <span className="text-[0.625rem] text-muted-foreground bg-white/80 dark:bg-muted px-3 py-0.5 rounded-full shadow-sm">{group.date}</span>
                    </div>
                    <div className="space-y-1.5">
                      {group.msgs.map((msg) => {
                        const isClient = msg.sender === "client";
                        const fileMatch = msg.content.match(/^\[Fichier: (.+)\]$/);
                        const isFile = !!fileMatch;
                        const fileName = fileMatch?.[1] ?? "";
                        const isPdf = fileName.toLowerCase().endsWith(".pdf");

                        return (
                          <div key={msg.id} className={cn("flex items-end gap-1.5", isClient ? "justify-end" : "justify-start")}>
                            {/* Avatar VNK */}
                            {!isClient && (
                              <div className="h-6 w-6 rounded-full bg-[#0F2D52] flex items-center justify-center shrink-0 mb-0.5">
                                <span className="text-[0.5rem] font-bold text-white">VNK</span>
                              </div>
                            )}
                            <div className={cn(
                              "max-w-[78%] px-3 py-2 text-sm shadow-sm",
                              isClient
                                ? "bg-[#d9fdd3] dark:bg-emerald-900/40 rounded-xl rounded-tr-sm text-foreground"
                                : "bg-white dark:bg-card rounded-xl rounded-tl-sm"
                            )}>
                              {isFile ? (
                                <div className="py-0.5">
                                  <div className="flex items-center gap-2.5 mb-1.5">
                                    <div className="h-10 w-10 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                                      <FileText className="h-5 w-5 text-red-500" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-semibold truncate">{fileName}</p>
                                      <p className="text-[0.625rem] text-muted-foreground">Document PDF</p>
                                    </div>
                                  </div>
                                  <div className="flex gap-1.5">
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setPreviewPdf(fileName); }}
                                      className="flex-1 flex items-center justify-center gap-1 h-7 rounded-md bg-[#0F2D52]/10 text-[#0F2D52] text-xs font-medium hover:bg-[#0F2D52]/20 transition-colors"
                                    >
                                      <Eye className="h-3 w-3" />
                                      Voir
                                    </button>
                                    <a
                                      href={`/api/invoices/1/pdf`}
                                      download={fileName}
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex-1 flex items-center justify-center gap-1 h-7 rounded-md bg-[#0F2D52]/10 text-[#0F2D52] text-xs font-medium hover:bg-[#0F2D52]/20 transition-colors"
                                    >
                                      <Download className="h-3 w-3" />
                                      Telecharger
                                    </a>
                                  </div>
                                </div>
                              ) : (
                                <RichMessageContent content={msg.content} />
                              )}
                              <div className={cn("flex items-center gap-1 mt-0.5", isClient ? "justify-end" : "")}>
                                <time className="text-[0.5625rem] text-muted-foreground">
                                  {new Date(msg.createdAt).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
                                </time>
                                {isClient && (
                                  msg.isRead ? <CheckCheck className="h-3 w-3 text-blue-500" /> : <Check className="h-3 w-3 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                            {/* Avatar client */}
                            {isClient && (
                              <div className="h-6 w-6 rounded-full bg-[#0F2D52]/15 flex items-center justify-center shrink-0 mb-0.5">
                                <span className="text-[0.5rem] font-bold text-[#0F2D52]">{initials}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Emoji picker */}
            {showEmojis && (
              <div className="shrink-0 px-3 py-2 border-t bg-card flex flex-wrap gap-0.5">
                {EMOJIS.map((e) => (
                  <button key={e} type="button" onClick={() => { setInput((v) => v + e); setShowEmojis(false); inputRef.current?.focus(); }} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-base transition-colors">
                    {e}
                  </button>
                ))}
              </div>
            )}

            {/* Input bar */}
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="shrink-0 px-3 py-2.5 border-t bg-white dark:bg-card flex items-end gap-2">
              <input type="file" ref={fileRef} className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={handleFile} />
              <button type="button" onClick={() => fileRef.current?.click()} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center shrink-0 text-muted-foreground mb-0.5" aria-label="Fichier">
                <Paperclip className="h-4 w-4" />
              </button>
              <div className="flex-1 flex items-end bg-[#f0f2f5] dark:bg-muted rounded-2xl px-3 py-2 gap-1.5 min-h-[40px]">
                <button type="button" onClick={() => setShowEmojis((s) => !s)} className="h-6 w-6 rounded-full hover:bg-black/5 flex items-center justify-center shrink-0 text-muted-foreground" aria-label="Emoji">
                  <Smile className="h-4 w-4" />
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Ecrivez un message..."
                  disabled={sending}
                  rows={1}
                  className="flex-1 bg-transparent resize-none text-sm focus:outline-none min-h-[24px] max-h-[100px] leading-relaxed"
                />
              </div>
              <button type="submit" disabled={!input.trim() || sending} className="h-9 w-9 rounded-full bg-[#0F2D52] text-white flex items-center justify-center shrink-0 disabled:opacity-30 hover:bg-[#1a3a66] transition-all active:scale-95 mb-0.5" aria-label="Envoyer">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </>
      )}

      {/* ── PDF Preview Modal ── */}
      {previewPdf && (
        <div className="fixed inset-0 z-[9999]" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/80" onClick={() => setPreviewPdf(null)} />
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center justify-between px-4 h-12 bg-[#0F2D52] text-white shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium truncate">{previewPdf}</span>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={`/api/invoices/1/pdf`}
                  download={previewPdf}
                  className="h-8 w-8 rounded-md hover:bg-white/10 flex items-center justify-center"
                  aria-label="Telecharger"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  onClick={() => setPreviewPdf(null)}
                  className="h-8 w-8 rounded-md hover:bg-white/10 flex items-center justify-center"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-[#525659]">
              <iframe
                src={`/api/invoices/1/pdf`}
                className="w-full h-full border-0"
                title={previewPdf}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
