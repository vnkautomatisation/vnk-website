// Admin · Mandats — KPIs + table avec filtres + creation + edition
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { MandatesView } from "./mandates-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("mandats") };
}

export default async function MandatesPage() {
  const [rawMandates, clients, activeCount, pendingCount, completedCount] = await Promise.all([
    prisma.mandate.findMany({
      include: { client: { select: { id: true, fullName: true, companyName: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { isActive: true, archived: false },
      select: { id: true, fullName: true, companyName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.mandate.count({ where: { status: { in: ["active", "in_progress"] } } }),
    prisma.mandate.count({ where: { status: "pending" } }),
    prisma.mandate.count({ where: { status: "completed" } }),
  ]);

  const mandates = rawMandates.map((m) => ({
    id: m.id,
    clientId: m.clientId,
    clientName: m.client.fullName,
    companyName: m.client.companyName,
    title: m.title,
    description: m.description,
    serviceType: m.serviceType,
    status: m.status,
    progress: m.progress,
    notes: m.notes,
    startDate: m.startDate?.toISOString() ?? null,
    endDate: m.endDate?.toISOString() ?? null,
    estimatedHours: m.estimatedHours != null ? Number(m.estimatedHours) : null,
    actualHours: m.actualHours != null ? Number(m.actualHours) : null,
    hourlyRate: m.hourlyRate != null ? Number(m.hourlyRate) : null,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <MandatesView
      mandates={mandates}
      clients={clients}
      counts={{ active: activeCount, pending: pendingCount, completed: completedCount, total: rawMandates.length }}
    />
  );
}
