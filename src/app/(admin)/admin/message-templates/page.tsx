// Admin · Templates de messages — CRUD reponses rapides utilisables via /shortcut dans le chat
import { prisma } from "@/lib/prisma";
import { TemplatesView } from "./templates-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Templates de messages" };

export default async function MessageTemplatesPage() {
  const templates = await prisma.messageTemplate.findMany({
    orderBy: [{ usageCount: "desc" }, { title: "asc" }],
  });

  return (
    <TemplatesView
      templates={templates.map((t) => ({
        id: t.id,
        shortcut: t.shortcut,
        title: t.title,
        body: t.body,
        category: t.category,
        usageCount: t.usageCount,
        createdAt: t.createdAt.toISOString(),
      }))}
    />
  );
}
