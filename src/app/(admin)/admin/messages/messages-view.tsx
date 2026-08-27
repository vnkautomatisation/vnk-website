"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  MessageSquare, Search, Send, CheckCheck, Mail, MessageCircle, ArrowLeft,
  Inbox, CheckSquare, Calendar, Users, Paperclip, X, Image as ImageIcon, FileText,
  Reply, Pencil, Trash2, MoreVertical, SmilePlus, StickyNote, CornerUpLeft,
  Pin, Archive, BellOff, Clock, AtSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { StatCard } from "@/components/admin/stat-card";
import { EmojiPicker } from "@/components/messages/emoji-picker";
import { VoiceRecorderButton, type VoiceAttachment } from "@/components/messages/voice-recorder-button";
import { MessageAttachmentDisplay, type MessageAttachment } from "@/components/messages/message-attachment-display";
import { OnlineIndicator } from "@/components/messages/online-indicator";
import { TemplatePicker, type Template } from "@/components/messages/template-picker";
import { ScheduleSendDialog } from "@/components/messages/schedule-send-dialog";
import { ConversationMetaActions } from "@/components/messages/conversation-meta-actions";
import { ConversationTabsBar, ConversationFilesTab, ConversationLinksTab, type ConvTab, type MsgLite } from "@/components/messages/conversation-tabs";
import { useMessageStream } from "@/components/messages/use-message-stream";
import { NotificationToggle, playMessageSound, showDesktopNotification } from "@/components/messages/notification-toggle";
import { expandTemplateVariables } from "@/lib/template-variables";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { cn, initials } from "@/lib/utils";

type Conversation = {
  id: number;
  fullName: string;
  companyName: string | null;
  email: string;
  lastSeenAt: string | null;
  chatPinned: boolean;
  chatArchivedAt: string | null;
  chatSnoozedUntil: string | null;
  chatLabels: string[];
  lastMessage: {
    content: string | null;
    sender: string;
    channel: string;
    createdAt: string;
    isInternalNote: boolean;
  } | null;
  unreadCount: number;
};

type ReplyToSummary = {
  id: number;
  sender: string;
  content: string | null;
  attachmentsData: MessageAttachment[] | null;
  attachmentData: MessageAttachment | null;
  deletedAt: string | null;
};

type ReactionsMap = Record<string, string[]>;

type Message = {
  id: number;
  clientId: number;
  sender: string;
  content: string | null;
  channel: string;
  isRead: boolean;
  isInternalNote: boolean;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  attachmentData: MessageAttachment | null;
  attachmentsData: MessageAttachment[] | null;
  reactions: ReactionsMap | null;
  replyToId: number | null;
  replyTo: ReplyToSummary | null;
  scheduledFor: string | null;
};

const MAX_UPLOAD_MB = 10;
const MAX_ATTACHMENTS = 10;
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "🙏", "🔥"];

type FilterMode = "all" | "unread" | "chat" | "email" | "archived" | "snoozed";

const CHANNEL_BADGE: Record<string, { label: string; color: string }> = {
  chat: { label: "Chat", color: "bg-emerald-100 text-emerald-700" },
  email: { label: "Email", color: "bg-blue-100 text-blue-700" },
  both: { label: "Chat+Email", color: "bg-violet-100 text-violet-700" },
};

const FILTER_TABS: { key: FilterMode; labelKey: string }[] = [
  { key: "all", labelKey: "toutes" },
  { key: "unread", labelKey: "non_lus" },
  { key: "chat", labelKey: "chat" },
  { key: "email", labelKey: "email" },
  { key: "archived", labelKey: "archivees" },
  { key: "snoozed", labelKey: "snoozees" },
];

function formatTime(iso: string, justNow: string, locale: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return justNow;
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

function formatMsgTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
}

function formatMsgDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
}

function getAttachments(msg: Message | ReplyToSummary): MessageAttachment[] {
  if (msg.attachmentsData && msg.attachmentsData.length > 0) return msg.attachmentsData;
  if (msg.attachmentData) return [msg.attachmentData];
  return [];
}

function summarizeForReply(m: ReplyToSummary, deletedLabel: string, emptyLabel: string): string {
  if (m.deletedAt) return deletedLabel;
  if (m.content) return m.content;
  const atts = m.attachmentsData ?? (m.attachmentData ? [m.attachmentData] : []);
  if (atts.length > 0) {
    const a = atts[0];
    const more = atts.length > 1 ? ` +${atts.length - 1}` : "";
    return `📎 ${a.name}${more}`;
  }
  return emptyLabel;
}

function highlightSearch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 text-black rounded px-0.5">{p}</mark>
      : <span key={i}>{p}</span>
  );
}

function isSnoozeActive(c: Conversation): boolean {
  return !!c.chatSnoozedUntil && new Date(c.chatSnoozedUntil) > new Date();
}

// Windowing : nombre de messages rendus initialement (et incrément du "Charger plus")
const PAGE_SIZE_MESSAGES = 80;

export function MessagesView({
  conversations,
  templates,
  kpis,
}: {
  conversations: Conversation[];
  templates: Template[];
  kpis: { totalConversations: number; totalMessages: number; todayMessages: number; weekMessages: number; totalUnread: number };
}) {
  const t = useTranslations("admin.messages");
  const dateTag = useDateLocale();
  const tc = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { open: openEntity } = useEntityPanels();
  const { ConfirmModal } = useConfirm();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);


  const stickyBarSentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = stickyBarSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const cid = searchParams.get("clientId");
    if (cid) {
      const id = Number(cid);
      if (conversations.some((c) => c.id === id)) {
        setSelectedId(id);
        const url = new URL(window.location.href);
        url.searchParams.delete("clientId");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [searchParams, conversations]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);


  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE_MESSAGES);
  const [newMsg, setNewMsg] = useState("");
  const [pendingAtts, setPendingAtts] = useState<MessageAttachment[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [internalNote, setInternalNote] = useState(false);
  const [sending, setSending] = useState(false);
  const [channel, setChannel] = useState<"chat" | "email">("chat");
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteMsg, setDeleteMsg] = useState<Message | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState<ConvTab>("messages");
  const [threadSearchOpen, setThreadSearchOpen] = useState(false);
  const [threadSearch, setThreadSearch] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateQuery, setTemplateQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    let result = conversations;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.companyName?.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.chatLabels.some((l) => l.toLowerCase().includes(q))
      );
    }

    if (filter === "archived") {
      result = result.filter((c) => !!c.chatArchivedAt);
    } else if (filter === "snoozed") {
      result = result.filter(isSnoozeActive);
    } else {

      result = result.filter((c) => !c.chatArchivedAt);
      if (filter === "unread") result = result.filter((c) => c.unreadCount > 0);
      else if (filter === "chat") result = result.filter((c) => c.lastMessage?.channel === "chat" || c.lastMessage?.channel === "both");
      else if (filter === "email") result = result.filter((c) => c.lastMessage?.channel === "email" || c.lastMessage?.channel === "both");
    }
    return result;
  }, [conversations, search, filter]);

  const insertEmoji = useCallback((emoji: string) => {
    const ta = textareaRef.current;
    if (!ta) { setNewMsg((m) => m + emoji); return; }
    const start = ta.selectionStart ?? newMsg.length;
    const end = ta.selectionEnd ?? newMsg.length;
    const next = newMsg.slice(0, start) + emoji + newMsg.slice(end);
    setNewMsg(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }, [newMsg]);

  const insertMention = useCallback(() => {
    if (!selected) return;
    insertEmoji(`@${selected.fullName} `);
  }, [selected, insertEmoji]);

  const addAttachmentFromFile = useCallback((file: File) => {
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      toast.error(`"${file.name}" : trop volumineux (max ${MAX_UPLOAD_MB} Mo)`);
      return;
    }
    setPendingAtts((prev) => {
      if (prev.length >= MAX_ATTACHMENTS) {
        toast.error(`Maximum ${MAX_ATTACHMENTS} pièces jointes par message`);
        return prev;
      }
      return prev;
    });
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";
      const isAudio = file.type.startsWith("audio/");
      const kind: MessageAttachment["kind"] = isImage ? "image" : isPdf ? "pdf" : isAudio ? "audio" : "file";
      const att: MessageAttachment = {
        kind, name: file.name, mimeType: file.type || "application/octet-stream", size: file.size, dataUrl,
      };
      setPendingAtts((prev) => prev.length >= MAX_ATTACHMENTS ? prev : [...prev, att]);
    };
    reader.onerror = () => toast.error(t("lecture_fichier_impossible"));
    reader.readAsDataURL(file);
  }, []);

  const handleFilesSelected = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach(addAttachmentFromFile);
  }, [addAttachmentFromFile]);

  const handleVoiceRecorded = useCallback((att: VoiceAttachment) => {
    setPendingAtts((prev) => [...prev, att]);
  }, []);

  const removePendingAtt = useCallback((idx: number) => {
    setPendingAtts((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const filesFromPaste = items
      .filter((it) => it.kind === "file")
      .map((it) => it.getAsFile())
      .filter((f): f is File => f !== null);
    if (filesFromPaste.length > 0) {
      e.preventDefault();
      handleFilesSelected(filesFromPaste);
    }
  }, [handleFilesSelected]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  }, [handleFilesSelected]);

  const loadMessages = useCallback(async (clientId: number) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/messages?clientId=${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
        await fetch("/api/messages/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId }),
        });
        router.refresh();
      }
    } catch {
      toast.error(t("erreur_lors_chargement"));
    } finally {
      setLoadingMsgs(false);
    }
  }, [router]);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
    setReplyingTo(null);
    setInternalNote(false);
    setPendingAtts([]);
    setNewMsg("");
    setActiveTab("messages");
    setThreadSearch("");
    setThreadSearchOpen(false);
    setDisplayLimit(PAGE_SIZE_MESSAGES);  // reset window a la fin de l'historique
  }, [selectedId, loadMessages]);




  useMessageStream({
    enabled: !!selectedId,
    clientId: selectedId ?? undefined,
    onNewMessage: (msg) => {

      if (selectedId === msg.clientId) {
        fetch(`/api/messages?clientId=${selectedId}`).then((r) => r.ok ? r.json() : null).then((d) => {
          if (d?.messages) setMessages(d.messages);
        });
      }
    },
  });


  useMessageStream({
    enabled: true,
    onNewMessage: (msg) => {
      if (msg.sender !== "client") return;
      const conv = conversations.find((c) => c.id === msg.clientId);
      const name = conv?.fullName ?? t("client");
      playMessageSound();
      showDesktopNotification(`Message de ${name}`, msg.content?.slice(0, 80) ?? t("piece_jointe"), () => {
        setSelectedId(msg.clientId);
      });
      router.refresh();
    },
  });


  useEffect(() => {
    const lastSlashIdx = Math.max(newMsg.lastIndexOf("\n/"), newMsg.startsWith("/") ? 0 : -1);
    if (lastSlashIdx === -1) {
      setTemplatePickerOpen(false);
      return;
    }
    const startOffset = lastSlashIdx === 0 ? 1 : lastSlashIdx + 2;
    const tail = newMsg.slice(startOffset);
    if (tail.includes(" ") || tail.includes("\n")) {
      setTemplatePickerOpen(false);
      return;
    }
    setTemplatePickerOpen(true);
    setTemplateQuery(tail);
  }, [newMsg]);

  const applyTemplate = useCallback(async (tpl: Template) => {
    const lastSlashIdx = Math.max(newMsg.lastIndexOf("\n/"), newMsg.startsWith("/") ? 0 : -1);
    if (lastSlashIdx === -1) return;
    const before = lastSlashIdx === 0 ? "" : newMsg.slice(0, lastSlashIdx + 1);
    const expanded = expandTemplateVariables(tpl.body, {
      clientName: selected?.fullName,
      clientCompany: selected?.companyName,
      clientEmail: selected?.email,
    });
    setNewMsg(before + expanded);

    if (tpl.defaultChannel === "chat" || tpl.defaultChannel === "email") {
      setChannel(tpl.defaultChannel);
    }

    if (tpl.defaultAttachmentsData && Array.isArray(tpl.defaultAttachmentsData) && tpl.defaultAttachmentsData.length > 0) {
      const newAtts = tpl.defaultAttachmentsData as MessageAttachment[];
      setPendingAtts((prev) => {
        const existingNames = new Set(prev.map((a) => a.name));
        return [...prev, ...newAtts.filter((a) => !existingNames.has(a.name))];
      });
      toast.success(`${newAtts.length} pièce(s) jointe(s) ajoutée(s) du template`);
    }
    setTemplatePickerOpen(false);
    fetch(`/api/message-templates/${tpl.id}`, { method: "POST" }).catch(() => {});
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [newMsg, selected]);

  const sendInternal = async (extra: { scheduledFor?: string } = {}) => {
    if ((!newMsg.trim() && pendingAtts.length === 0) || !selectedId || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedId,
          content: newMsg.trim() || undefined,
          channel,
          attachmentsData: pendingAtts.length > 0 ? pendingAtts : undefined,
          replyToId: replyingTo?.id,
          isInternalNote: internalNote,
          scheduledFor: extra.scheduledFor,
        }),
      });
      if (res.ok) {
        setNewMsg("");
        setPendingAtts([]);
        setReplyingTo(null);
        setInternalNote(false);
        if (extra.scheduledFor) toast.success(t("envoi_programme"));
        await loadMessages(selectedId);
      } else {
        const data = await res.json();
        toast.error(data.error || t("erreur"));
      }
    } catch {
      toast.error(t("erreur_reseau"));
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => sendInternal();
  const handleSchedule = (iso: string) => { sendInternal({ scheduledFor: iso }); setScheduleOpen(false); };

  const handleMarkAllRead = async () => {
    const res = await fetch("/api/messages/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const data = await res.json();
      toast.success(`${data.count ?? 0} message(s) marqué(s) lus`);
      router.refresh();
    } else { toast.error(t("erreur")); }
  };

  const openEdit = (m: Message) => {
    setEditingMsg(m);
    setEditContent(m.content ?? "");
  };

  const handleEditSave = async () => {
    if (!editingMsg) return;
    const res = await fetch(`/api/messages/${editingMsg.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editContent }),
    });
    if (res.ok) {
      toast.success(t("message_modifie"));
      setEditingMsg(null);
      if (selectedId) loadMessages(selectedId);
    } else { const d = await res.json(); toast.error(d.error || t("erreur")); }
  };

  const handleDelete = async () => {
    if (!deleteMsg) return;
    const res = await fetch(`/api/messages/${deleteMsg.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(t("message_supprime"));
      setDeleteMsg(null);
      if (selectedId) loadMessages(selectedId);
    } else { const d = await res.json(); toast.error(d.error || t("erreur")); }
  };

  const handleToggleReaction = async (msgId: number, emoji: string) => {
    const res = await fetch(`/api/messages/${msgId}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (res.ok) {
      const data = await res.json();
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, reactions: data.reactions } : m));
    } else { toast.error(t("erreur")); }
  };


  const exportCsv = useCallback(() => {
    if (!selected) return;
    const rows = [
      [t("date"), t("heure"), t("auteur"), t("canal"), t("note_interne"), t("contenu"), t("pieces_jointes")],
      ...messages.filter((m) => !m.deletedAt).map((m) => {
        const d = new Date(m.createdAt);
        const atts = getAttachments(m);
        return [
          d.toLocaleDateString(dateTag),
          d.toLocaleTimeString(dateTag),
          m.sender === "vnk" ? t("admin") : t("client"),
          m.channel,
          m.isInternalNote ? t("oui") : t("non"),
          (m.content ?? "").replace(/"/g, '""'),
          atts.map((a) => a.name).join(" | "),
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${selected.fullName.replace(/\s+/g, "_")}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("csv_exporte"));
  }, [selected, messages]);

  const exportPdf = useCallback(() => {
    if (!selected) return;

    const w = window.open("", "_blank", "width=900,height=900");
    if (!w) { toast.error(t("bloqueur_popup")); return; }
    const rows = messages.filter((m) => !m.deletedAt).map((m) => {
      const d = new Date(m.createdAt);
      const atts = getAttachments(m);
      const isAdmin = m.sender === "vnk";
      const note = m.isInternalNote ? `<span style="background:#fef3c7;color:#92400e;padding:1px 4px;border-radius:3px;font-size:9px;margin-right:4px">${t("note_interne")}</span>` : "";
      return `
        <div style="margin-bottom:14px;padding:10px;border-left:3px solid ${isAdmin ? "#0F2D52" : "#94a3b8"};background:${isAdmin ? "#f1f5f9" : "#ffffff"};border-radius:4px">
          <div style="font-size:10px;color:#64748b;margin-bottom:4px">
            ${note}<strong>${isAdmin ? "VNK" : t("client")}</strong> · ${d.toLocaleString(dateTag)} · ${m.channel}${m.editedAt ? ` · ${t("modifie_mot")}` : ""}
          </div>
          <div style="font-size:13px;white-space:pre-wrap">${(m.content ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>
          ${atts.length > 0 ? `<div style="font-size:11px;color:#475569;margin-top:6px">📎 ${atts.map((a) => a.name).join(", ")}</div>` : ""}
        </div>
      `;
    }).join("");
    w.document.write(`
      <!DOCTYPE html><html><head><title>${t("conversation")} ${selected.fullName}</title>
      <style>body{font-family:system-ui,-apple-system,sans-serif;padding:24px;max-width:800px;margin:auto;color:#1e293b}
      h1{font-size:18px;color:#0F2D52;margin-bottom:4px}
      .meta{font-size:11px;color:#64748b;margin-bottom:24px;padding-bottom:12px;border-bottom:1px solid #e2e8f0}
      @media print{body{padding:0}}</style></head><body>
      <h1>${t("conversation")} — ${selected.fullName}</h1>
      <div class="meta">${selected.companyName ?? selected.email} · ${t("messages_exporte_le", { count: messages.filter((m) => !m.deletedAt).length, date: new Date().toLocaleDateString(dateTag) })}</div>
      ${rows}
      <script>window.onload=()=>setTimeout(window.print,300)</script>
      </body></html>
    `);
    w.document.close();
    toast.success(t("pdf_pret_imprimer"));
  }, [selected, messages]);



  const visibleMessages = useMemo(() => {
    if (threadSearch) {
      return messages.filter((m) => !m.deletedAt && m.content?.toLowerCase().includes(threadSearch.toLowerCase()));
    }

    return displayLimit >= messages.length ? messages : messages.slice(messages.length - displayLimit);
  }, [messages, threadSearch, displayLimit]);

  const totalNonDeleted = useMemo(() => messages.filter((m) => !m.deletedAt).length, [messages]);
  const hiddenOlderCount = useMemo(() => {
    if (threadSearch) return 0;
    return Math.max(0, messages.length - displayLimit);
  }, [messages, threadSearch, displayLimit]);

  const groupedMessages = useMemo(() => {
    return visibleMessages.reduce<{ date: string; msgs: Message[] }[]>((acc, msg) => {
      const date = formatMsgDate(msg.createdAt);
      const last = acc[acc.length - 1];
      if (last && last.date === date) last.msgs.push(msg);
      else acc.push({ date, msgs: [msg] });
      return acc;
    }, []);
  }, [visibleMessages]);


  type VirtItem = { type: "date"; key: string; date: string } | { type: "msg"; key: string; msg: Message };
  const virtualItems = useMemo<VirtItem[]>(() => {
    const out: VirtItem[] = [];
    let lastDate = "";
    for (const msg of visibleMessages) {
      const d = formatMsgDate(msg.createdAt);
      if (d !== lastDate) {
        out.push({ type: "date", key: `date-${d}`, date: d });
        lastDate = d;
      }
      out.push({ type: "msg", key: `msg-${msg.id}`, msg });
    }
    return out;
  }, [visibleMessages]);


  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [atBottom, setAtBottom] = useState(true);
  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({ index: virtualItems.length - 1, behavior: "smooth", align: "end" });
  }, [virtualItems.length]);


  const loadMoreOlder = useCallback(() => {
    setDisplayLimit((l) => l + PAGE_SIZE_MESSAGES);
  }, []);



  const filesCount = useMemo(() => messages.reduce((s, m) => !m.deletedAt ? s + getAttachments(m).length : s, 0), [messages]);
  const linksCount = useMemo(() => {
    let n = 0;
    for (const m of messages) {
      if (m.deletedAt || !m.content) continue;
      const matches = m.content.match(/https?:\/\/[^\s<>"]+/g);
      if (matches) n += matches.length;
    }
    return n;
  }, [messages]);

  const jumpToMessage = useCallback((msgId: number) => {
    setActiveTab("messages");
    requestAnimationFrame(() => {
      document.getElementById(`msg-${msgId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  return (
    <div className={cn(
      "space-y-4 lg:h-[calc(100dvh-6.5rem)] lg:flex lg:flex-col",


      selectedId && "h-[calc(100dvh-6rem)] sm:h-[calc(100dvh-6.5rem)] flex flex-col lg:h-[calc(100dvh-6.5rem)]",
    )}>

      <div className={cn(
        "rounded-2xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] p-5 sm:p-6 text-white shadow-md relative overflow-hidden shrink-0",
        selectedId && "hidden lg:block",
      )}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">{t("messages")}</h1>
              <p className="text-white/70 text-sm mt-0.5">{t("multi_pieces_reactions_notes_internes")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {kpis.totalUnread > 0 && (
              <div className="flex items-center gap-2 bg-red-500/20 border border-red-300/30 rounded-lg px-3 py-2 backdrop-blur">
                <Inbox className="h-4 w-4 text-red-200" />
                <span className="text-sm font-semibold text-white">{kpis.totalUnread} non lus</span>
              </div>
            )}
            {kpis.totalUnread > 0 && (
              <Button className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold" onClick={handleMarkAllRead}>
                <CheckSquare className="h-4 w-4" />{t("messages_view_tout_marquer_lu")}</Button>
            )}
            <div className="bg-white/10 rounded-lg p-1 backdrop-blur">
              <NotificationToggle />
            </div>
          </div>
        </div>
      </div>

      <div className={cn(
        "grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0",
        selectedId && "hidden lg:grid",
      )}>
        <StatCard label={t("conversations")} value={kpis.totalConversations} icon={Users} accent="bg-indigo-500" />
        <StatCard label={t("total_messages")} value={kpis.totalMessages} icon={MessageSquare} accent="bg-blue-500" />
        <StatCard label="Aujourd'hui" value={kpis.todayMessages} icon={Calendar} accent="bg-emerald-500" />
        <StatCard label={t("non_lus")} value={kpis.totalUnread} icon={Inbox} accent="bg-red-500" />
      </div>


      <div ref={stickyBarSentinelRef} aria-hidden className={cn("h-px", selectedId && "hidden lg:block")} />
      {scrolled && (
        <div className={cn(
          "sticky top-[64px] z-20 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 bg-background/95 backdrop-blur shadow-sm border-b animate-overlay-fade-in",
          selectedId && "hidden lg:block",
        )}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <MessageSquare className="h-4 w-4" />
              {t("messages")}
            </span>
            <span className="text-muted-foreground">{t("conversations")} <span className="font-semibold text-indigo-600">{kpis.totalConversations}</span></span>
            <span className="text-muted-foreground">{t("total")} <span className="font-semibold text-blue-600">{kpis.totalMessages}</span></span>
            <span className="text-muted-foreground">{t("aujourd_apos_hui")} <span className="font-semibold text-emerald-600">{kpis.todayMessages}</span></span>
            {kpis.totalUnread > 0 && <span className="ml-auto text-muted-foreground">{t("non_lus")} <span className="font-semibold text-red-600">{kpis.totalUnread}</span></span>}
          </div>
        </div>
      )}

      <div className={cn(
        "gap-4 lg:flex-1 lg:min-h-0 lg:grid lg:grid-cols-[340px_1fr]",



        selectedId
          ? "flex flex-col flex-1 min-h-0"
          : "grid grid-cols-1 min-h-[600px] md:grid-cols-[340px_1fr]",
      )}>

        <Card className={cn("overflow-hidden flex flex-col", selectedId && "hidden lg:flex")}>
          <div className="p-3 border-b space-y-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("rechercher_nom_etiquette")}
                className="pl-10 h-9"
              />
            </div>
            <div className="flex bg-muted rounded-lg p-0.5 overflow-x-auto">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={cn(
                    "flex-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap",
                    filter === tab.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t(tab.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <ul className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="p-6 text-center text-sm text-muted-foreground">{t("aucune_conversation")}</li>
            ) : (
              filtered.map((c) => {
                const isActive = selectedId === c.id;
                const channelBadge = c.lastMessage ? CHANNEL_BADGE[c.lastMessage.channel] : null;
                const snoozeActive = isSnoozeActive(c);
                return (
                  <li
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "p-3 border-b cursor-pointer transition-colors",
                      isActive ? "bg-[#0F2D52]/5 border-l-2 border-l-[#0F2D52]" : "hover:bg-muted/50",
                      c.unreadCount > 0 && !isActive && "bg-muted/30"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white text-xs font-bold">
                            {initials(c.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <OnlineIndicator lastSeenAt={c.lastSeenAt} className="absolute bottom-0 right-0 ring-2 ring-background" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 min-w-0">
                            {c.chatPinned && <Pin className="h-3 w-3 text-[#0F2D52] shrink-0" />}
                            <span className={cn("text-sm truncate", c.unreadCount > 0 ? "font-bold" : "font-medium")}>
                              {c.fullName}
                            </span>
                          </div>
                          {c.lastMessage && (
                            <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(c.lastMessage.createdAt, t("instant"), dateTag)}</span>
                          )}
                        </div>
                        {c.companyName && (
                          <div className="text-[10px] text-muted-foreground truncate">{c.companyName}</div>
                        )}
                        {c.lastMessage && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {c.lastMessage.isInternalNote && <StickyNote className="h-2.5 w-2.5 text-amber-500 inline mr-0.5" />}
                            {c.lastMessage.sender === "vnk" && <span className="text-[#0F2D52]">{t("vous")} </span>}
                            {c.lastMessage.content?.slice(0, 60) ?? t("piece_jointe")}
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {channelBadge && (
                            <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium", channelBadge.color)}>
                              {channelBadge.label}
                            </span>
                          )}
                          {snoozeActive && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium flex items-center gap-0.5">
                              <BellOff className="h-2.5 w-2.5" />{t("messages_view_snoozee")}</span>
                          )}
                          {c.chatArchivedAt && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium flex items-center gap-0.5">
                              <Archive className="h-2.5 w-2.5" />{t("messages_view_archivee")}</span>
                          )}
                          {c.chatLabels.slice(0, 2).map((l) => (
                            <span key={l} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#0F2D52]/10 text-[#0F2D52] font-medium">
                              {l}
                            </span>
                          ))}
                          {c.chatLabels.length > 2 && (
                            <span className="text-[9px] text-muted-foreground">+{c.chatLabels.length - 2}</span>
                          )}
                          {c.unreadCount > 0 && (
                            <Badge variant="destructive" className="text-[9px] h-4 min-w-4 px-1 ml-auto">{c.unreadCount}</Badge>
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


        <Card
          className={cn(
            "overflow-hidden flex flex-col relative min-h-0",
            !selectedId && "hidden lg:flex",
            selectedId && "flex-1",
            dragOver && "ring-2 ring-[#0F2D52]"
          )}
          onDragOver={(e) => { if (selectedId && activeTab === "messages") { e.preventDefault(); setDragOver(true); } }}
          onDragLeave={() => setDragOver(false)}
          onDrop={selectedId && activeTab === "messages" ? handleDrop : undefined}
        >
          {dragOver && selectedId && (
            <div className="absolute inset-0 z-10 bg-[#0F2D52]/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
              <div className="bg-white rounded-lg shadow-lg px-6 py-4 text-center">
                <Paperclip className="h-8 w-8 mx-auto text-[#0F2D52] mb-1" />
                <p className="text-sm font-semibold text-[#0F2D52]">{t("deposer_joindre")}</p>
              </div>
            </div>
          )}

          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">{t("selectionnez_conversation")}</p>
              </div>
            </div>
          ) : (
            <>

              <div className="flex items-center gap-2 p-3 border-b shrink-0">
                <Button variant="ghost" size="sm" className="lg:hidden h-8 w-8 p-0" onClick={() => setSelectedId(null)} aria-label={tc("back")}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <button
                  className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity text-left"
                  onClick={() => openEntity("client", selected.id)}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white text-xs font-bold">
                        {initials(selected.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <OnlineIndicator lastSeenAt={selected.lastSeenAt} className="absolute bottom-0 right-0 ring-2 ring-background" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      {selected.chatPinned && <Pin className="h-3 w-3 text-[#0F2D52] shrink-0" />}
                      <p className="font-semibold text-sm truncate">{selected.fullName}</p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {selected.companyName ?? selected.email} · {totalNonDeleted} message(s)
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setThreadSearchOpen((v) => !v)}
                  className={cn(
                    "h-8 w-8 flex items-center justify-center rounded-md transition-colors",
                    threadSearchOpen ? "bg-[#0F2D52] text-white" : "hover:bg-muted text-muted-foreground"
                  )}
                  aria-label={t("rechercher_conversation")}
                >
                  <Search className="h-4 w-4" />
                </button>
                <ConversationMetaActions
                  clientId={selected.id}
                  pinned={selected.chatPinned}
                  archived={!!selected.chatArchivedAt}
                  snoozedUntil={selected.chatSnoozedUntil}
                  labels={selected.chatLabels}
                  onChange={() => router.refresh()}
                  onExportCsv={exportCsv}
                  onExportPdf={exportPdf}
                />
              </div>

              {threadSearchOpen && (
                <div className="px-3 pb-2 border-b shrink-0 bg-muted/20">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      autoFocus
                      value={threadSearch}
                      onChange={(e) => setThreadSearch(e.target.value)}
                      placeholder={t("rechercher_thread")}
                      className="pl-9 h-8 text-sm"
                    />
                    {threadSearch && (
                      <button
                        type="button"
                        onClick={() => setThreadSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-background"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {threadSearch && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {groupedMessages.reduce((s, g) => s + g.msgs.length, 0)} résultat(s)
                    </p>
                  )}
                </div>
              )}

              <ConversationTabsBar active={activeTab} onChange={setActiveTab} filesCount={filesCount} linksCount={linksCount} />

              {activeTab === "files" ? (
                <ConversationFilesTab messages={messages as MsgLite[]} />
              ) : activeTab === "links" ? (
                <ConversationLinksTab messages={messages as MsgLite[]} onJumpToMessage={jumpToMessage} />
              ) : (
                <>
                  <div className="flex-1 min-h-0 min-w-0 relative overflow-hidden">
                    {loadingMsgs ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
                      </div>
                    ) : virtualItems.length === 0 ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-sm text-muted-foreground">{threadSearch ? t("aucun_resultat") : t("aucun_message_demarrez_conversation")}</p>
                      </div>
                    ) : (
                      <Virtuoso
                        ref={virtuosoRef}
                        data={virtualItems}
                        className="!h-full"
                        initialTopMostItemIndex={virtualItems.length - 1}
                        followOutput="smooth"
                        atBottomThreshold={120}
                        atBottomStateChange={setAtBottom}
                        startReached={() => { if (hiddenOlderCount > 0) loadMoreOlder(); }}
                        increaseViewportBy={{ top: 400, bottom: 200 }}
                        components={{
                          Header: hiddenOlderCount > 0 ? () => (
                            <div className="flex justify-center py-2 text-[10px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/30 animate-pulse" />
                                Chargement des messages plus anciens… ({hiddenOlderCount} restants)
                              </span>
                            </div>
                          ) : undefined,
                        }}
                        itemContent={(_index, item) => {
                          if (item.type === "date") {
                            return (
                              <div className="flex items-center gap-3 my-3 px-3 sm:px-4">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{item.date}</span>
                                <div className="flex-1 h-px bg-border" />
                              </div>
                            );
                          }
                          return (
                            <div className="px-3 sm:px-4">
                              <MessageBubble
                                msg={item.msg}
                                isLast={_index === virtualItems.length - 1}
                                searchHighlight={threadSearch}
                                onReply={() => setReplyingTo(item.msg)}
                                onEdit={() => openEdit(item.msg)}
                                onDelete={() => setDeleteMsg(item.msg)}
                                onReact={(emoji) => handleToggleReaction(item.msg.id, emoji)}
                                allMessages={messages}
                              />
                            </div>
                          );
                        }}
                      />
                    )}

                    {!atBottom && virtualItems.length > 0 && !loadingMsgs && (
                      <button
                        type="button"
                        onClick={scrollToBottom}
                        className="absolute bottom-4 right-4 h-9 w-9 rounded-full bg-[#0F2D52] text-white shadow-lg flex items-center justify-center hover:bg-[#15406d] transition-all"
                        aria-label={t("aller_dernier_message")}
                      >
                        <ArrowLeft className="h-4 w-4 -rotate-90" />
                      </button>
                    )}
                  </div>


                  <div className="border-t p-2 sm:p-3 shrink-0 bg-card space-y-1.5 sm:space-y-2 relative">

                    {replyingTo && (
                      <div className="flex items-start gap-2 rounded-lg border-l-2 border-[#0F2D52] bg-muted/40 px-2 py-1.5">
                        <CornerUpLeft className="h-3.5 w-3.5 text-[#0F2D52] shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-semibold text-[#0F2D52]">
                            Réponse à {replyingTo.sender === "vnk" ? "vous" : selected.fullName}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{summarizeForReply(replyingTo as ReplyToSummary, t("message_supprime"), t("vide"))}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReplyingTo(null)}
                          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-background"
                          aria-label={t("annuler_reponse")}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {internalNote && (
                      <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5">
                        <StickyNote className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                        <p className="text-[11px] text-amber-800 flex-1">{t("note_interne_visible_admin_uniquement")}</p>
                        <button
                          type="button"
                          onClick={() => setInternalNote(false)}
                          className="h-6 w-6 flex items-center justify-center rounded text-amber-700 hover:bg-amber-100"
                          aria-label={t("desactiver_note_interne")}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                      <button
                        onClick={() => setChannel("chat")}
                        className={cn(
                          "flex items-center gap-1 text-[11px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md transition-colors",
                          channel === "chat" ? "bg-emerald-100 text-emerald-700 font-medium" : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <MessageCircle className="h-3 w-3" /> Chat
                      </button>
                      <button
                        onClick={() => setChannel("email")}
                        className={cn(
                          "flex items-center gap-1 text-[11px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md transition-colors",
                          channel === "email" ? "bg-blue-100 text-blue-700 font-medium" : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <Mail className="h-3 w-3" /> Email
                      </button>
                      <button
                        onClick={() => setInternalNote((v) => !v)}
                        className={cn(
                          "flex items-center gap-1 text-[11px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md transition-colors",
                          internalNote ? "bg-amber-100 text-amber-700 font-medium" : "text-muted-foreground hover:bg-muted"
                        )}
                        title={t("note_visible_admin_seulement")}
                      >
                        <StickyNote className="h-3 w-3" /> Note interne
                      </button>
                      <button
                        type="button"
                        onClick={insertMention}
                        className="flex items-center gap-1 text-[11px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                        title={`Mentionner ${selected.fullName}`}
                      >
                        <AtSign className="h-3 w-3" />Mention
                      </button>
                    </div>

                    {pendingAtts.length > 0 && (
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {pendingAtts.map((att, i) => (
                          <div key={i} className="relative shrink-0 group">
                            <div className="h-16 w-16 rounded-lg border bg-muted/40 overflow-hidden flex items-center justify-center">
                              {att.kind === "image" ? (
                                <img src={att.dataUrl} alt="" className="h-full w-full object-cover" />
                              ) : att.kind === "pdf" ? (
                                <FileText className="h-6 w-6 text-red-600" />
                              ) : att.kind === "audio" ? (
                                <span className="text-lg">🎙</span>
                              ) : (
                                <Paperclip className="h-6 w-6 text-muted-foreground" />
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removePendingAtt(i)}
                              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full bg-destructive text-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label={t("retirer")}
                            >
                              <X className="h-3 w-3" />
                            </button>
                            <p className="text-[9px] text-muted-foreground truncate max-w-[64px] mt-0.5">{att.name}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <TemplatePicker
                      templates={templates}
                      query={templateQuery}
                      open={templatePickerOpen}
                      onSelect={applyTemplate}
                      onClose={() => setTemplatePickerOpen(false)}
                    />

                    <div className="flex items-end gap-1">
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) handleFilesSelected(e.target.files);
                          e.currentTarget.value = "";
                        }}
                      />
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) handleFilesSelected(e.target.files);
                          e.currentTarget.value = "";
                        }}
                      />

                      <button type="button" onClick={() => imageInputRef.current?.click()}
                        className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
                        aria-label={t("joindre_plusieurs_images")}>
                        <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
                        aria-label={t("joindre_fichiers")}>
                        <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                      <EmojiPicker onSelect={insertEmoji} />
                      <VoiceRecorderButton onRecorded={handleVoiceRecorded} />

                      <textarea
                        ref={textareaRef}
                        value={newMsg}
                        onChange={(e) => setNewMsg(e.target.value)}
                        onPaste={handlePaste}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && !templatePickerOpen) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        placeholder={
                          internalNote ? t("note_interne_placeholder") :
                          pendingAtts.length > 0 ? t("legende_optionnel") :
                          replyingTo ? t("repondre") : t("message")
                        }
                        className={cn(
                          "flex-1 min-w-0 resize-none rounded-lg border bg-background px-2.5 py-1.5 sm:px-3 sm:py-2 text-[12px] sm:text-[13px] min-h-[36px] sm:min-h-[40px] max-h-[120px] focus:outline-none focus:ring-2",
                          internalNote ? "focus:ring-amber-400 border-amber-200" : "focus:ring-ring"
                        )}
                        rows={1}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setScheduleOpen(true)}
                        disabled={sending || (!newMsg.trim() && pendingAtts.length === 0) || internalNote}
                        className="h-8 w-8 sm:h-9 sm:w-9 p-0 shrink-0"
                        title={t("programmer_envoi")}
                      >
                        <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                      <Button
                        onClick={handleSend}
                        disabled={sending || (!newMsg.trim() && pendingAtts.length === 0)}
                        size="sm"
                        className={cn(
                          "h-8 w-8 sm:h-9 sm:w-9 p-0 shrink-0",
                          internalNote ? "bg-amber-500 hover:bg-amber-600" : "bg-[#0F2D52] hover:bg-[#1a3a66]"
                        )}
                      >
                        <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground hidden sm:block">
                      Entrée envoie · / template · @ mention · 📋 paste image · drag & drop · max {MAX_ATTACHMENTS} fichiers ({MAX_UPLOAD_MB} Mo)
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </Card>
      </div>

      <Dialog open={!!editingMsg} onOpenChange={(o) => { if (!o) setEditingMsg(null); }}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-4 text-white">
            <DialogTitle className="text-white text-base">{t("modifier_message")}</DialogTitle>
            <DialogDescription className="text-white/70 text-xs mt-0.5">
              {t("apos_historique_sera_marque_modifie")}
            </DialogDescription>
          </div>
          <div className="p-4">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <DialogFooter className="px-4 py-3 border-t bg-card sm:gap-2">
            <Button variant="outline" onClick={() => setEditingMsg(null)}>{tc("cancel")}</Button>
            <Button onClick={handleEditSave} className="bg-[#0F2D52] hover:bg-[#1a3a66]">{tc("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteMsg}
        onOpenChange={(o) => { if (!o) setDeleteMsg(null); }}
        title={t("supprimer_message")}
        description={t("message_sera_masque_tous_texte")}
        confirmLabel={tc("delete")}
        onConfirm={handleDelete}
      />

      <ScheduleSendDialog open={scheduleOpen} onOpenChange={setScheduleOpen} onConfirm={handleSchedule} />

      {ConfirmModal}
    </div>
  );
}

// ─── MessageBubble ────────────────────────────────────────
// Detecte un message systeme/notification (genere automatiquement par le workflow)
// — Strip leading non-letters (emojis, symboles, espaces) puis test sur le keyword.
const SYSTEM_KEYWORDS = /^(NOUVELLE DEMANDE|NOUVEAU DEVIS|NOUVEAU CONTRAT|NOUVEAU MANDAT|NOUVELLE FACTURE|FACTURE|CONTRAT|MANDAT|DEVIS|RDV|RENDEZ-VOUS|PAIEMENT|REMBOURSEMENT|SIGNATURE|DOCUMENT)\b/i;
function isSystemMessage(content: string | null): boolean {
  if (!content) return false;

  const stripped = content.trim().replace(/^[^\p{L}]+/u, "");
  return SYSTEM_KEYWORDS.test(stripped);
}

// Extrait un resume one-line d'un message systeme (premiere ligne sans emoji/symbole)
function systemMessageSummary(content: string): string {
  const firstLine = content.split("\n")[0].trim();
  return firstLine.replace(/^[^\p{L}]+/u, "");
}

// Detecte une action liee a un message systeme.
// 1. D'abord : numero d'entite formel (CT-XXX, F-XXX, DEV-XXX, MAN-XXX, REM-XXX) → ouvre filtre exact
// 2. Sinon : mots-cles dans le texte → navigue vers la page admin correspondante
type SystemAction = { route: string; labelKey: string };
function detectSystemAction(content: string): SystemAction | null {

  const m = content.match(/\b(CT|F|DEV|MAN|REM)-(\d{4})-(\d+)\b/i);
  if (m) {
    const fullNumber = m[0].toUpperCase();
    const prefix = m[1].toUpperCase();
    const q = `?search=${encodeURIComponent(fullNumber)}`;
    switch (prefix) {
      case "CT":  return { route: `/admin/contracts${q}`, labelKey: "voir_contrat" };
      case "F":   return { route: `/admin/invoices${q}`, labelKey: "voir_facture" };
      case "DEV": return { route: `/admin/quotes${q}`, labelKey: "voir_devis" };
      case "MAN": return { route: `/admin/mandates${q}`, labelKey: "voir_mandat" };
      case "REM": return { route: `/admin/refunds${q}`, labelKey: "voir_remboursement" };
    }
  }

  if (/nouvelle demande|demande de projet/i.test(content)) return { route: "/admin/requests", labelKey: "voir_demande" };
  if (/contrat/i.test(content))                            return { route: "/admin/contracts", labelKey: "voir_contrats" };
  if (/facture/i.test(content))                            return { route: "/admin/invoices", labelKey: "voir_factures" };
  if (/devis/i.test(content))                              return { route: "/admin/quotes", labelKey: "voir_devis_2" };
  if (/mandat/i.test(content))                             return { route: "/admin/mandates", labelKey: "voir_mandats" };
  if (/remboursement/i.test(content))                      return { route: "/admin/refunds", labelKey: "voir_remboursements" };
  if (/rdv|rendez-?vous/i.test(content))                   return { route: "/admin/calendar", labelKey: "voir_calendrier" };
  if (/paiement/i.test(content))                           return { route: "/admin/finance/payments", labelKey: "voir_paiements" };
  if (/signature/i.test(content))                          return { route: "/admin/contracts", labelKey: "voir_contrat" };
  if (/document/i.test(content))                           return { route: "/admin/documents", labelKey: "voir_document" };
  return null;
}

function MessageBubble({
  msg, isLast, searchHighlight, onReply, onEdit, onDelete, onReact, allMessages,
}: {
  msg: Message;
  isLast: boolean;
  searchHighlight: string;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
  allMessages: Message[];
}) {
  const t = useTranslations("admin.messages");
  const isAdmin = msg.sender === "vnk";
  const isInternal = msg.isInternalNote;
  const channelInfo = CHANNEL_BADGE[msg.channel];
  const attachments = getAttachments(msg);
  const replyTarget = msg.replyTo ?? (msg.replyToId ? allMessages.find((m) => m.id === msg.replyToId) ?? null : null);
  const reactions = msg.reactions ?? {};
  const reactionEntries = Object.entries(reactions).filter(([, who]) => who.length > 0);
  const isSystem = !isInternal && isSystemMessage(msg.content);
  const [systemExpanded, setSystemExpanded] = useState(false);

  const ageMs = Date.now() - new Date(msg.createdAt).getTime();
  const canEditDelete = isAdmin && !msg.deletedAt && ageMs < 24 * 60 * 60 * 1000;


  if (isSystem && msg.content && !msg.deletedAt) {
    const summary = systemMessageSummary(msg.content);
    const action = detectSystemAction(msg.content);

    const otherLines = msg.content.split("\n").slice(1).join("\n").trim();
    const hasMore = otherLines.length > 0;
    return (
      <div className="my-1 flex justify-center min-w-0">
        <div className="max-w-full min-w-0 flex flex-col items-center gap-1">

          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-3 py-1.5 rounded-2xl bg-muted/40 text-[11px] text-muted-foreground max-w-full">
            {hasMore ? (
              <button
                type="button"
                onClick={() => setSystemExpanded((v) => !v)}
                className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors min-w-0 max-w-full"
                aria-label={systemExpanded ? t("reduire") : t("developper")}
              >
                <span className="font-semibold text-[#0F2D52] break-words [overflow-wrap:anywhere]">{summary}</span>
                <span className="opacity-60 shrink-0">·</span>
                <span className="shrink-0">{formatMsgTime(msg.createdAt)}</span>
                <span className="opacity-60 shrink-0">{systemExpanded ? "−" : "+"}</span>
              </button>
            ) : (

              <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
                <span className="font-semibold text-[#0F2D52] break-words [overflow-wrap:anywhere]">{summary}</span>
                <span className="opacity-60 shrink-0">·</span>
                <span className="shrink-0">{formatMsgTime(msg.createdAt)}</span>
              </span>
            )}
            {action && (
              <a
                href={action.route}
                className="text-[#0F2D52] font-semibold hover:underline inline-flex items-center gap-1 shrink-0"
                aria-label={t(action.labelKey)}
              >
                {t(action.labelKey)}
                <ArrowLeft className="h-2.5 w-2.5 rotate-180" />
              </a>
            )}
          </div>
          {systemExpanded && hasMore && (
            <pre className="text-left text-[11px] font-sans whitespace-pre-wrap [overflow-wrap:anywhere] mt-1 px-2 py-1.5 bg-background/60 rounded border max-w-full w-full">
              {msg.content}
            </pre>
          )}
        </div>
      </div>
    );
  }

  if (msg.deletedAt) {
    return (
      <div className={cn("flex mb-0.5 min-w-0", isAdmin ? "justify-end" : "justify-start")}>
        <div className="max-w-[85%] md:max-w-[480px] rounded-2xl px-2.5 py-1.5 bg-muted/40 border border-dashed">
          <p className="text-xs italic text-muted-foreground">{t("message_supprime")}</p>
          <span className="text-[10px] text-muted-foreground">{formatMsgTime(msg.createdAt)}</span>
        </div>
      </div>
    );
  }

  const isScheduled = msg.scheduledFor && new Date(msg.scheduledFor) > new Date();

  return (
    <div className={cn("group flex mb-0.5 min-w-0", isAdmin ? "justify-end" : "justify-start")}>

      <div className="max-w-[85%] md:max-w-[480px] min-w-0 flex flex-col items-stretch">
        {isInternal && (
          <div className="text-[10px] font-semibold text-amber-700 mb-0.5 self-end flex items-center gap-1">
            <StickyNote className="h-3 w-3" />Note interne
          </div>
        )}
        {isScheduled && (
          <div className="text-[10px] font-semibold text-blue-700 mb-0.5 self-end flex items-center gap-1">
            <Clock className="h-3 w-3" />Programmé pour {new Date(msg.scheduledFor!).toLocaleString("fr-CA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
        <div className="flex items-end gap-1">
          {isAdmin && (
            <MessageActionsButton onReply={onReply} onEdit={onEdit} onDelete={onDelete} canEditDelete={canEditDelete} onReact={onReact} />
          )}

          <div id={`msg-${msg.id}`} className={cn(
            "rounded-2xl px-2.5 py-1.5 space-y-1 min-w-0 overflow-hidden",
            isInternal ? "bg-amber-50 border border-amber-200 rounded-br-md text-amber-900"
            : isAdmin ? "bg-[#0F2D52] text-white rounded-br-md"
            : "bg-muted rounded-bl-md"
          )}>
            {replyTarget && (
              <button
                type="button"
                className={cn(
                  "block text-left rounded-md border-l-2 px-2 py-1 mb-1 text-[11px]",
                  isInternal ? "border-amber-400 bg-amber-100/60"
                  : isAdmin ? "border-white/40 bg-white/10"
                  : "border-[#0F2D52] bg-background"
                )}
                onClick={() => {
                  document.getElementById(`msg-${replyTarget.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              >
                <p className={cn("font-semibold", isAdmin && !isInternal ? "text-white/80" : "text-[#0F2D52]")}>
                  {replyTarget.sender === "vnk" ? t("vous_2") : t("client")}
                </p>
                <p className={cn("line-clamp-1", isAdmin && !isInternal ? "text-white/70" : "text-muted-foreground")}>
                  {summarizeForReply(replyTarget as ReplyToSummary, t("message_supprime"), t("vide"))}
                </p>
              </button>
            )}

            {attachments.length > 0 && (
              <div className={cn("space-y-1.5", attachments.length > 1 && attachments.every((a) => a.kind === "image") && "grid grid-cols-2 gap-1 space-y-0")}>
                {attachments.map((att, i) => (
                  <MessageAttachmentDisplay key={i} attachment={att} isAdmin={isAdmin && !isInternal} />
                ))}
              </div>
            )}

            {msg.content && (
              <p className="text-[12px] sm:text-[13px] leading-snug whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {searchHighlight ? highlightSearch(msg.content, searchHighlight) : msg.content}
              </p>
            )}

            <div className={cn("flex items-center gap-1.5 px-1", isAdmin ? "justify-end" : "justify-start")}>
              <span className={cn("text-[10px]",
                isInternal ? "text-amber-700"
                : isAdmin ? "text-white/60"
                : "text-muted-foreground"
              )}>
                {formatMsgTime(msg.createdAt)}
                {msg.editedAt && t("modifie")}
              </span>
              {channelInfo && !isInternal && (
                <span className={cn("text-[9px] px-1 py-0.5 rounded",
                  isAdmin ? "bg-white/15 text-white/70" : channelInfo.color
                )}>
                  {channelInfo.label}
                </span>
              )}
              {isAdmin && isLast && !isInternal && (
                <CheckCheck className={cn("h-3 w-3", msg.isRead ? "text-white" : "text-white/40")} />
              )}
            </div>
          </div>

          {!isAdmin && (
            <MessageActionsButton onReply={onReply} onReact={onReact} />
          )}
        </div>

        {reactionEntries.length > 0 && (
          <div className={cn("flex flex-wrap gap-1 mt-1", isAdmin ? "justify-end" : "justify-start")}>
            {reactionEntries.map(([emoji, who]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(emoji)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-colors",
                  who.includes("vnk") ? "border-[#0F2D52] bg-[#0F2D52]/10" : "border-input bg-background hover:bg-muted"
                )}
              >
                <span>{emoji}</span>
                <span className="text-[10px] text-muted-foreground">{who.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageActionsButton({
  onReply, onEdit, onDelete, canEditDelete, onReact,
}: {
  onReply: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canEditDelete?: boolean;
  onReact: (emoji: string) => void;
}) {
  const t = useTranslations("admin.messages");
  const tc = useTranslations("common");
  return (
    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 self-center">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t("reagir")}
          >
            <SmilePlus className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1" side="top">
          <div className="flex gap-0.5">
            {QUICK_REACTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onReact(e)}
                className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted text-lg transition-colors"
              >
                {e}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={tc("actions")}
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={onReply}>
            <Reply className="h-3.5 w-3.5 mr-2" />{t("messages_view_repondre")}</DropdownMenuItem>
          {canEditDelete && onEdit && (
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="h-3.5 w-3.5 mr-2" />{tc("edit")}
            </DropdownMenuItem>
          )}
          {canEditDelete && onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onDelete} className="text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-2" />{tc("delete")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

