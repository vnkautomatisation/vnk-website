// Admin · Clients — KPIs + table/filtres + creation + CDP
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { ClientsView } from "./clients-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("clients") };
}

export default async function AdminClientsPage() {
  const [clients, totalCount, activeCount, inactiveCount, newThisMonth] = await Promise.all([
    prisma.client.findMany({
      include: {
        _count: { select: { mandates: true, invoices: true } },
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.client.count(),
    prisma.client.count({ where: { isActive: true, archived: false } }),
    prisma.client.count({ where: { isActive: false, archived: false } }),
    prisma.client.count({
      where: {
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        archived: false,
      },
    }),
  ]);

  return (
    <ClientsView
      clients={clients.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        email: c.email,
        companyName: c.companyName,
        phone: c.phone,
        sector: c.sector,
        city: c.city,
        isActive: c.isActive,
        archived: c.archived,
        lastLogin: c.lastLogin?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
        technologies: c.technologies,
        mandateCount: c._count.mandates,
        invoiceCount: c._count.invoices,
      }))}
      counts={{ total: totalCount, active: activeCount, inactive: inactiveCount, newThisMonth }}
    />
  );
}
