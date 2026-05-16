// Settings · Templates — Emails et PDF.
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TemplatesView } from "./templates-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Modèles emails et PDF — VNK" };

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");

  const [emailTemplates, pdfTemplates] = await Promise.all([
    prisma.emailTemplate.findMany({ orderBy: [{ key: "asc" }, { locale: "asc" }] }),
    prisma.pdfTemplate.findMany({ orderBy: [{ key: "asc" }, { locale: "asc" }] }),
  ]);

  return (
    <TemplatesView
      emailTemplates={JSON.parse(JSON.stringify(emailTemplates))}
      pdfTemplates={JSON.parse(JSON.stringify(pdfTemplates))}
    />
  );
}
