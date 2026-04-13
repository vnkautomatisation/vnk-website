"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { MessageCircle, X, Send, Paperclip, Maximize2, Minimize2, Check, CheckCheck, Smile, FileText, Download } from "lucide-react";
import { cn } from "@/lib/utils";

type Message = {
  id: number;
  sender: "client" | "vnk";
  content: string;
  createdAt: string;
  isRead: boolean;
};

const EMOJIS = ["👍", "👋", "😊", "🙏", "✅", "⏰", "🔧", "⚡", "🎉", "💡", "📎", "❤️"];

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = (clientName ?? "C").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  // ── Load + poll ──
  useEffect(() => {
    if (!open) return;
    const load = async () => {
      try {
        const r = await fetch("/api/messages");
        const data = await r.json();
        if (data.messages) setMessages(data.messages);
      } catch {}
    };
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [open]);

  // ── Mark read ──
  useEffect(() => {
    if (!open) return;
    const unread = messages.filter((m) => m.sender === "vnk" && !m.isRead);
    if (unread.length === 0) return;
    setMessages((prev) => prev.map((m) => (m.sender === "vnk" && !m.isRead ? { ...m, isRead: true } : m)));
    fetch("/api/messages/mark-read", { method: "POST" }).catch(() => {});
  }, [open, messages]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
      {/* ── Bouton flottant ── */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-[70px] right-3 lg:bottom-6 lg:right-6 z-40 h-12 w-12 lg:h-14 lg:w-14 rounded-full bg-[#0F2D52] text-white shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
          aria-label="Ouvrir le chat"
        >
          <MessageCircle className="h-5 w-5 lg:h-6 lg:w-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
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
            <div className="shrink-0 h-14 px-4 flex items-center justify-between bg-[#0F2D52] text-white">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">VNK Support</p>
                  <p className="text-[10px] text-white/60">En ligne</p>
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
                <div className="text-center py-16">
                  <div className="h-16 w-16 rounded-2xl bg-[#0F2D52]/10 flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="h-7 w-7 text-[#0F2D52]/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Besoin d'aide ?</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Envoyez un message a notre equipe.</p>
                </div>
              ) : (
                groupedMessages.map((group) => (
                  <div key={group.date}>
                    {/* Date separator */}
                    <div className="flex items-center justify-center my-3">
                      <span className="text-[10px] text-muted-foreground bg-white/80 dark:bg-muted px-3 py-0.5 rounded-full shadow-sm">{group.date}</span>
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
                                <span className="text-[7px] font-bold text-white">VNK</span>
                              </div>
                            )}
                            <div className={cn(
                              "max-w-[75%] px-3 py-1.5 text-sm shadow-sm",
                              isClient
                                ? "bg-[#d9fdd3] dark:bg-emerald-900/40 rounded-2xl rounded-tr-md text-foreground"
                                : "bg-white dark:bg-card rounded-2xl rounded-tl-md"
                            )}>
                              {isFile ? (
                                <a
                                  href={isPdf ? `/api/invoices/1/pdf` : "#"}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2 py-1 hover:opacity-80 transition-opacity"
                                >
                                  <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                                    <FileText className="h-4 w-4 text-red-600" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium truncate">{fileName}</p>
                                    <p className="text-[10px] text-muted-foreground">PDF</p>
                                  </div>
                                  <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                </a>
                              ) : (
                                <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                              )}
                              <div className={cn("flex items-center gap-1 mt-0.5", isClient ? "justify-end" : "")}>
                                <time className="text-[9px] text-muted-foreground">
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
                                <span className="text-[7px] font-bold text-[#0F2D52]">{initials}</span>
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
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="shrink-0 px-2 py-2 border-t bg-card flex items-end gap-1.5">
              <input type="file" ref={fileRef} className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={handleFile} />
              <button type="button" onClick={() => fileRef.current?.click()} className="h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center shrink-0 text-muted-foreground" aria-label="Fichier">
                <Paperclip className="h-4 w-4" />
              </button>
              <div className="flex-1 flex items-end bg-muted/50 rounded-2xl border px-3 py-1.5 gap-1">
                <button type="button" onClick={() => setShowEmojis((s) => !s)} className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center shrink-0 text-muted-foreground mb-0.5" aria-label="Emoji">
                  <Smile className="h-4 w-4" />
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Message..."
                  disabled={sending}
                  rows={1}
                  className="flex-1 bg-transparent resize-none text-sm focus:outline-none min-h-[28px] max-h-[100px] py-0.5"
                />
              </div>
              <button type="submit" disabled={!input.trim() || sending} className="h-9 w-9 rounded-full bg-[#0F2D52] text-white flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-[#1a3a66] transition-colors" aria-label="Envoyer">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </>
      )}
    </>
  );
}
