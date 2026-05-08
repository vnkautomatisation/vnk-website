"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MessageSquare,
  Search,
  Send,
  CheckCheck,
  Mail,
  MessageCircle,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn, initials } from "@/lib/utils";

type Conversation = {
  id: number;
  fullName: string;
  companyName: string | null;
  email: string;
  lastMessage: {
    content: string | null;
    sender: string;
    channel: string;
    createdAt: string;
  } | null;
  unreadCount: number;
};

type Message = {
  id: number;
  clientId: number;
  sender: string;
  content: string | null;
  channel: string;
  isRead: boolean;
  createdAt: string;
};

const CHANNEL_BADGE: Record<string, { label: string; color: string }> = {
  chat: { label: "Chat", color: "bg-emerald-100 text-emerald-700" },
  email: { label: "Email", color: "bg-blue-100 text-blue-700" },
  both: { label: "Chat+Email", color: "bg-violet-100 text-violet-700" },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "A l'instant";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}

function formatMsgTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
}

function formatMsgDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
}

export function MessagesView({ conversations }: { conversations: Conversation[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [channel, setChannel] = useState<"chat" | "email">("chat");
  const scrollRef = useRef<HTMLDivElement>(null);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  // Filtrer conversations
  const filtered = conversations.filter((c) =>
    c.fullName.toLowerCase().includes(search.toLowerCase()) ||
    c.companyName?.toLowerCase().includes(search.toLowerCase())
  );

  // Charger messages quand on selectionne un client
  const loadMessages = useCallback(async (clientId: number) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/messages?clientId=${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
        // Marquer comme lu
        await fetch("/api/messages/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId }),
        });
      }
    } catch {
      toast.error("Erreur lors du chargement");
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  // Auto-scroll en bas
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Polling messages toutes les 5s quand conversation ouverte
  useEffect(() => {
    if (!selectedId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/messages?clientId=${selectedId}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages);
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedId]);

  // Envoyer message
  const handleSend = async () => {
    if (!newMsg.trim() || !selectedId) return;
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedId,
          content: newMsg.trim(),
          channel,
        }),
      });
      if (res.ok) {
        setNewMsg("");
        await loadMessages(selectedId);
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erreur");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setSending(false);
    }
  };

  // Grouper messages par date
  const groupedMessages = messages.reduce<{ date: string; msgs: Message[] }[]>((acc, msg) => {
    const date = formatMsgDate(msg.createdAt);
    const last = acc[acc.length - 1];
    if (last && last.date === date) {
      last.msgs.push(msg);
    } else {
      acc.push({ date, msgs: [msg] });
    }
    return acc;
  }, []);

  // Total non-lus
  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <MessageSquare className="h-6 w-6" />
            Messages
            {totalUnread > 0 && (
              <Badge variant="destructive" className="text-xs">{totalUnread}</Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {conversations.length} conversation{conversations.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Layout 2 colonnes */}
      <div className="grid md:grid-cols-[340px_1fr] gap-4 h-[calc(100vh-200px)]">
        {/* ── Sidebar conversations ───────────────────────── */}
        <Card className="overflow-hidden flex flex-col">
          {/* Recherche */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un client..."
                className="pl-10"
              />
            </div>
          </div>

          {/* Liste */}
          <ul className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="p-6 text-center text-sm text-muted-foreground">
                Aucune conversation
              </li>
            ) : (
              filtered.map((c) => {
                const isActive = selectedId === c.id;
                const channelBadge = c.lastMessage ? CHANNEL_BADGE[c.lastMessage.channel] : null;
                return (
                  <li
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "p-3 border-b cursor-pointer transition-colors",
                      isActive ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/50",
                      c.unreadCount > 0 && !isActive && "bg-muted/30"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className="vnk-gradient text-white text-xs font-bold">
                          {initials(c.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn("text-sm truncate", c.unreadCount > 0 ? "font-bold" : "font-medium")}>
                            {c.fullName}
                          </span>
                          {c.lastMessage && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {formatTime(c.lastMessage.createdAt)}
                            </span>
                          )}
                        </div>
                        {c.companyName && (
                          <div className="text-[10px] text-muted-foreground truncate">{c.companyName}</div>
                        )}
                        {c.lastMessage && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {c.lastMessage.sender === "vnk" && <span className="text-primary">Vous : </span>}
                            {c.lastMessage.content?.slice(0, 50) ?? ""}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {channelBadge && (
                            <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium", channelBadge.color)}>
                              {channelBadge.label}
                            </span>
                          )}
                          {c.unreadCount > 0 && (
                            <Badge variant="destructive" className="text-[9px] h-4 min-w-4 px-1">
                              {c.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </Card>

        {/* ── Zone conversation ───────────────────────────── */}
        <Card className="overflow-hidden flex flex-col">
          {!selected ? (
            /* Etat vide */
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Selectionnez une conversation</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header conversation */}
              <div className="flex items-center gap-3 p-4 border-b">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="vnk-gradient text-white text-xs font-bold">
                    {initials(selected.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{selected.fullName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selected.companyName ?? selected.email} · {messages.length} messages
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground">Chargement...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground">Aucun message</p>
                  </div>
                ) : (
                  groupedMessages.map((group) => (
                    <div key={group.date}>
                      {/* Separateur date */}
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] text-muted-foreground font-medium uppercase">
                          {group.date}
                        </span>
                        <div className="flex-1 h-px bg-border" />
                      </div>

                      {group.msgs.map((msg, idx) => {
                        const isAdmin = msg.sender === "vnk";
                        const isLast = idx === group.msgs.length - 1;
                        const channelInfo = CHANNEL_BADGE[msg.channel];
                        return (
                          <div
                            key={msg.id}
                            className={cn("flex mb-2", isAdmin ? "justify-end" : "justify-start")}
                          >
                            <div
                              className={cn(
                                "max-w-[75%] rounded-2xl px-4 py-2.5",
                                isAdmin
                                  ? "bg-primary text-primary-foreground rounded-br-md"
                                  : "bg-muted rounded-bl-md"
                              )}
                            >
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {msg.content}
                              </p>
                              <div className={cn(
                                "flex items-center gap-1.5 mt-1",
                                isAdmin ? "justify-end" : "justify-start"
                              )}>
                                <span className={cn("text-[10px]", isAdmin ? "text-primary-foreground/60" : "text-muted-foreground")}>
                                  {formatMsgTime(msg.createdAt)}
                                </span>
                                {channelInfo && (
                                  <span className={cn(
                                    "text-[9px] px-1 py-0.5 rounded",
                                    isAdmin ? "bg-white/15 text-primary-foreground/70" : channelInfo.color
                                  )}>
                                    {channelInfo.label}
                                  </span>
                                )}
                                {isAdmin && isLast && (
                                  <CheckCheck className={cn("h-3 w-3", msg.isRead ? "text-primary-foreground" : "text-primary-foreground/40")} />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Zone composition */}
              <div className="border-t p-3">
                {/* Toggle canal */}
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setChannel("chat")}
                    className={cn(
                      "flex items-center gap-1 text-xs px-2.5 py-1 rounded-md transition-colors",
                      channel === "chat" ? "bg-emerald-100 text-emerald-700 font-medium" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <MessageCircle className="h-3 w-3" /> Chat
                  </button>
                  <button
                    onClick={() => setChannel("email")}
                    className={cn(
                      "flex items-center gap-1 text-xs px-2.5 py-1 rounded-md transition-colors",
                      channel === "email" ? "bg-blue-100 text-blue-700 font-medium" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Mail className="h-3 w-3" /> Email
                  </button>
                  <span className="text-[10px] text-muted-foreground ml-2">
                    {channel === "chat" ? "Message dans le portail client" : "Envoyer par courriel"}
                  </span>
                </div>

                {/* Input + send */}
                <div className="flex items-end gap-2">
                  <textarea
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Ecrivez un message..."
                    className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm min-h-[40px] max-h-[120px] focus:outline-none focus:ring-2 focus:ring-ring"
                    rows={1}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={sending || !newMsg.trim()}
                    size="sm"
                    className="h-10 w-10 p-0 shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
