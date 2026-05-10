// Admin · Templates de messages
import { prisma } from "@/lib/prisma";
import { TemplatesView } from "./templates-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Templates de messages" };

export default async function MessageTemplatesPage() {
  const templates = await prisma.messageTemplate.findMany({
    orderBy: [{ isActive: "desc" }, { isSystem: "desc" }, { usageCount: "desc" }, { title: "asc" }],
  });

  return (
    <TemplatesView
      templates={templates.map((t) => ({
        id: t.id,
        shortcut: t.shortcut,
        title: t.title,
        body: t.body,
        category: t.category,
        categoryCustom: t.categoryCustom,
        defaultChannel: t.defaultChannel as "chat" | "email" | "both" | null,
        emailSubject: t.emailSubject,
        appendSignature: t.appendSignature,
        defaultAttachmentsData: (t.defaultAttachmentsData as unknown[] | null) ?? null,
        tags: (t.tags as string[] | null) ?? [],
        locale: t.locale,
        isSystem: t.isSystem,
        isActive: t.isActive,
        usageCount: t.usageCount,
        lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
      }))}
    />
  );
}
