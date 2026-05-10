// Admin · Messages — conversations + thread + envoi + KPIs + meta
import { prisma } from "@/lib/prisma";
import { MessagesView } from "./messages-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - 6);

  const [conversations, totalMessages, todayMessages, weekMessages, totalUnreadAdmin, templates] = await Promise.all([
    prisma.client.findMany({
      where: { messages: { some: {} } },
      select: {
        id: true,
        fullName: true,
        companyName: true,
        email: true,
        lastSeenAt: true,
        chatPinned: true,
        chatArchivedAt: true,
        chatSnoozedUntil: true,
        chatLabels: true,
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, isRead: true, sender: true, channel: true, createdAt: true, isInternalNote: true },
        },
        _count: { select: { messages: { where: { isRead: false, sender: "client", deletedAt: null } } } },
      },
      orderBy: [{ chatPinned: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.message.count({ where: { deletedAt: null } }),
    prisma.message.count({ where: { deletedAt: null, createdAt: { gte: startOfDay } } }),
    prisma.message.count({ where: { deletedAt: null, createdAt: { gte: startOfWeek } } }),
    prisma.message.count({ where: { isRead: false, sender: "client", deletedAt: null } }),
    prisma.messageTemplate.findMany({ orderBy: [{ usageCount: "desc" }, { title: "asc" }] }),
  ]);

  return (
    <MessagesView
      conversations={conversations.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        companyName: c.companyName,
        email: c.email,
        lastSeenAt: c.lastSeenAt?.toISOString() ?? null,
        chatPinned: c.chatPinned,
        chatArchivedAt: c.chatArchivedAt?.toISOString() ?? null,
        chatSnoozedUntil: c.chatSnoozedUntil?.toISOString() ?? null,
        chatLabels: (c.chatLabels as string[] | null) ?? [],
        lastMessage: c.messages[0]
          ? {
              content: c.messages[0].content,
              sender: c.messages[0].sender,
              channel: c.messages[0].channel,
              createdAt: c.messages[0].createdAt.toISOString(),
              isInternalNote: c.messages[0].isInternalNote,
            }
          : null,
        unreadCount: c._count.messages,
      }))}
      templates={templates.map((t) => ({
        id: t.id,
        shortcut: t.shortcut,
        title: t.title,
        body: t.body,
        category: t.category,
        usageCount: t.usageCount,
      }))}
      kpis={{
        totalConversations: conversations.length,
        totalMessages,
        todayMessages,
        weekMessages,
        totalUnread: totalUnreadAdmin,
      }}
    />
  );
}
