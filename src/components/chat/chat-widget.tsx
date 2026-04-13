"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { MessageCircle, X, Send, Paperclip, Maximize2, Minimize2, Check, CheckCheck, Smile, Image } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Message = {
  id: number;
  sender: "client" | "vnk";
  content: string;
  createdAt: string;
  isRead: boolean;
};

const EMOJIS = ["👍", "👋", "😊", "🙏", "✅", "❌", "⏰", "📎", "🔧", "⚡", "🎉", "💡"];

export function ChatWidget({
  clientId,
  clientName,
  initialMessages = [],
}: {
  clientId?: number;
  clientName?: string;
  initialMessages?: Message[];
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Initiales du client pour l'avatar
  const initials = (clientName ?? "C")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // ── Load messages ──
  useEffect(() => {
    if (!open) return;
    const load = async () => {
      try {
        const r = await fetch("/api/messages");
        const data = await r.json();
        if (data.messages) setMessages(data.messages);
      } catch {}
    };
    if (messages.length === 0) load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Mark as read quand on ouvre ──
  useEffect(() => {
    if (!open) return;
    const unread = messages.filter((m) => m.sender === "vnk" && !m.isRead);
    if (unread.length === 0) return;
    // Marquer localement
    setMessages((prev) =>
      prev.map((m) => (m.sender === "vnk" && !m.isRead ? { ...m, isRead: true } : m))
    );
    // Marquer sur le serveur
    fetch("/api/messages/mark-read", { method: "POST" }).catch(() => {});
  }, [open, messages]);

  // ── Auto-scroll ──
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  // ── Escape ──
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // ── Focus ──
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // ── Send ──
  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setShowEmojis(false);

    const tempId = Date.now();
    const optimisticMsg: Message = {
      id: tempId,
      sender: "client",
      content,
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, channel: "chat" }),
      });
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

  // ── File upload ──
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Pour l'instant, envoyer le nom du fichier comme message
    const content = `[Fichier: ${file.name}]`;
    setInput(content);
    e.target.value = "";
  };

  // ── Auto-resize textarea ──
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const unreadCount = messages.filter((m) => m.sender === "vnk" && !m.isRead).length;

  return (
    <>
      {/* ── Bouton flottant ── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-[70px] right-3 lg:bottom-6 lg:right-6 z-40",
          "h-13 w-13 lg:h-14 lg:w-14 rounded-full vnk-gradient text-white shadow-lg",
          "flex items-center justify-center",
          "hover:scale-105 active:scale-95 transition-transform",
          open && "hidden"
        )}
        aria-label="Ouvrir le chat"
      >
        <MessageCircle className="h-5 w-5 lg:h-6 lg:w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Panel chat ── */}
      {open && (
        <>
          <div
            className="sm:hidden fixed inset-0 bottom-14 z-40 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Messagerie VNK"
            className={cn(
              "fixed z-50 bg-card border shadow-2xl flex flex-col overflow-hidden",
              expanded
                ? "inset-4 lg:inset-8 rounded-2xl bottom-[70px] lg:bottom-8"
                : cn(
                    "lg:bottom-24 lg:right-6 lg:w-[400px] lg:h-[600px] lg:rounded-2xl",
                    "bottom-14 right-0 w-full sm:w-[400px] sm:right-3 rounded-t-2xl sm:rounded-2xl h-[70vh] max-h-[600px]"
                  )
            )}
          >
            {/* Header */}
            <div className="shrink-0 px-4 py-3 border-b flex items-center justify-between vnk-gradient text-white rounded-t-2xl">
              <div className="flex items-center gap-3 min-w-0">
                {/* Avatar client */}
                <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-xs font-bold">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">VNK Automatisation</div>
                  <div className="text-[10px] text-white/70">
                    Support technique
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setExpanded((e) => !e)}
                  className="h-8 w-8 rounded-md hover:bg-white/10 flex items-center justify-center"
                  aria-label={expanded ? "Reduire" : "Agrandir"}
                >
                  {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => { setOpen(false); setExpanded(false); }}
                  className="h-8 w-8 rounded-md hover:bg-white/10 flex items-center justify-center"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-3"
              aria-live="polite"
            >
              {messages.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-12">
                  <div className="h-14 w-14 rounded-full vnk-gradient flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="h-6 w-6 text-white" />
                  </div>
                  <p className="font-medium">Besoin d'aide ?</p>
                  <p className="text-xs mt-1 text-muted-foreground/70">Envoyez un message a notre equipe.</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn("flex gap-2", msg.sender === "client" ? "justify-end" : "justify-start")}
                  >
                    {/* Avatar VNK */}
                    {msg.sender === "vnk" && (
                      <div className="h-7 w-7 rounded-full vnk-gradient flex items-center justify-center shrink-0 mt-1">
                        <span className="text-[9px] font-bold text-white">VNK</span>
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[75%] px-3 py-2 rounded-2xl text-sm",
                        msg.sender === "client"
                          ? "bg-[#0F2D52] text-white rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <div className={cn("flex items-center gap-1 mt-1", msg.sender === "client" ? "justify-end" : "")}>
                        <time className="text-[9px] opacity-60">
                          {new Date(msg.createdAt).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
                        </time>
                        {msg.sender === "client" && (
                          msg.isRead
                            ? <CheckCheck className="h-3 w-3 text-sky-300" />
                            : <Check className="h-3 w-3 opacity-50" />
                        )}
                      </div>
                    </div>
                    {/* Avatar client */}
                    {msg.sender === "client" && (
                      <div className="h-7 w-7 rounded-full bg-[#0F2D52]/10 flex items-center justify-center shrink-0 mt-1">
                        <span className="text-[9px] font-bold text-[#0F2D52]">{initials}</span>
                      </div>
                    )}
                  </div>
                ))
              )}

              {typing && (
                <div className="flex gap-2 items-start">
                  <div className="h-7 w-7 rounded-full vnk-gradient flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-white">VNK</span>
                  </div>
                  <div className="px-3 py-2.5 rounded-2xl bg-muted rounded-bl-sm">
                    <span className="flex gap-1 items-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce" />
                      <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "100ms" }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "200ms" }} />
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Emoji picker inline */}
            {showEmojis && (
              <div className="px-3 py-2 border-t flex flex-wrap gap-1">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => { setInput((v) => v + e); setShowEmojis(false); inputRef.current?.focus(); }}
                    className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center text-lg"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="shrink-0 p-3 border-t flex items-end gap-2"
            >
              <input type="file" ref={fileRef} className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={handleFile} />
              <div className="flex gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => fileRef.current?.click()}
                  aria-label="Fichier"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setShowEmojis((s) => !s)}
                  aria-label="Emoji"
                >
                  <Smile className="h-4 w-4" />
                </Button>
              </div>
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Votre message..."
                disabled={sending}
                rows={1}
                className="flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2D52]/30 min-h-[36px] max-h-[120px]"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || sending}
                className="h-9 w-9 shrink-0 rounded-full vnk-gradient"
                aria-label="Envoyer"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </>
      )}
    </>
  );
}
