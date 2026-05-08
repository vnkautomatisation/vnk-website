// Admin · Messages — conversations + thread + envoi
import { prisma } from "@/lib/prisma";
import { MessagesView } from "./messages-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const conversations = await prisma.client.findMany({
    where: { messages: { some: {} } },
    select: {
      id: true,
      fullName: true,
      companyName: true,
      email: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, isRead: true, sender: true, channel: true, createdAt: true },
      },
      _count: { select: { messages: { where: { isRead: false, sender: "client" } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <MessagesView
      conversations={conversations.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        companyName: c.companyName,
        email: c.email,
        lastMessage: c.messages[0]
          ? {
              content: c.messages[0].content,
              sender: c.messages[0].sender,
              channel: c.messages[0].channel,
              createdAt: c.messages[0].createdAt.toISOString(),
            }
          : null,
        unreadCount: c._count.messages,
      }))}
    />
  );
}
