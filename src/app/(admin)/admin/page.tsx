// Admin dashboard — KPIs + recent activity + presence
import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Briefcase, AlertCircle, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ namespace: "admin.dashboard" });
  return { title: t("active_clients") };
}

export default async function AdminDashboard() {
  const locale = await getLocale();
  const t = await getTranslations({ namespace: "admin.dashboard" });

  // Parallel queries
  const [
    activeClientsCount,
    activeMandatesCount,
    receivableResult,
    overdueCount,
    thisMonthRevenue,
    recentEvents,
  ] = await Promise.all([
    prisma.client.count({ where: { isActive: true, archived: false } }),
    prisma.mandate.count({
      where: { status: { in: ["active", "in_progress"] } },
    }),
    prisma.invoice.aggregate({
      _sum: { amountTtc: true },
      where: { status: { in: ["unpaid", "overdue"] } },
    }),
    prisma.invoice.count({ where: { status: "overdue" } }),
    prisma.invoice.aggregate({
      _sum: { amountTtc: true },
      where: {
        status: "paid",
        paidAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
    prisma.workflowEvent.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { client: { select: { fullName: true, companyName: true } } },
    }),
  ]);

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12
      ? t("greeting_morning")
      : hour < 18
      ? t("greeting_afternoon")
      : t("greeting_evening");

  const kpis = [
    {
      label: t("active_clients"),
      value: activeClientsCount,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: t("active_mandates"),
      value: activeMandatesCount,
      icon: Briefcase,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: t("receivable"),
      value: formatCurrency(Number(receivableResult._sum.amountTtc ?? 0)),
      secondary: t("overdue", { count: overdueCount }),
      icon: AlertCircle,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: t("month_revenue"),
      value: formatCurrency(Number(thisMonthRevenue._sum.amountTtc ?? 0)),
      icon: DollarSign,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {greeting}, Yan
        </h1>
        <p className="text-muted-foreground mt-1">
          {now.toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* KPI grid — responsive 1/2/4 cols */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="vnk-card-hover">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`h-11 w-11 rounded-lg ${k.bg} flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${k.color}`} />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    {k.label}
                  </p>
                  <p className="text-2xl font-bold mt-1">{k.value}</p>
                  {k.secondary && (
                    <p className="text-xs text-amber-600 mt-0.5">{k.secondary}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent activity */}
      <Card>
        <CardContent className="p-5">
          <h2 className="font-semibold text-lg mb-4">{t("recent_activity")}</h2>
          {recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune activité récente
            </p>
          ) : (
            <ul className="space-y-3">
              {recentEvents.map((ev) => (
                <li key={ev.id} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-semibold">
                    {ev.client.fullName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ev.eventLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {ev.client.fullName}
                      {ev.client.companyName && ` · ${ev.client.companyName}`}
                    </p>
                  </div>
                  <time className="text-xs text-muted-foreground shrink-0">
                    {new Date(ev.createdAt).toLocaleDateString(
                      locale === "fr" ? "fr-CA" : "en-CA",
                      { month: "short", day: "numeric" }
                    )}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
