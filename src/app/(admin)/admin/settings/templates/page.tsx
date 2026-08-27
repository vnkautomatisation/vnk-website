// Settings · Templates — Emails et PDF.
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getCurrentAdminPermissions, canAct } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { TemplatesView } from "./templates-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("modeles_emails_pdf_vnk") };
}

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  // Acces reglages : settings.write (ou email_templates.write) requis.
  const perms = await getCurrentAdminPermissions();
  if (!canAct(perms, "settings", "write") && !canAct(perms, "email_templates", "write")) redirect("/admin");

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
