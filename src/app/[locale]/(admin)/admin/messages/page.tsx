import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { MessagesView } from "./messages-view";

export default async function MessagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Regrouper par client (dernière conversation)
  const conversations = await prisma.client.findMany({
    where: {
      messages: { some: {} },
    },
    select: {
      id: true,
      fullName: true,
      companyName: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, isRead: true, sender: true, createdAt: true },
      },
      _count: { select: { messages: { where: { isRead: false, sender: "client" } } } },
    },
    orderBy: { lastLogin: "desc" },
  });

  return <MessagesView conversations={conversations} />;
}
