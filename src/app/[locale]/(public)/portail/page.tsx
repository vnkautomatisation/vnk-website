// Portail · Tableau de bord client — Design SaaS pro
import { cache } from "react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Briefcase,
  FileText,
  Receipt,
  FolderOpen,
  ArrowRight,
  Clock,
  Inbox,
  TrendingUp,
  CalendarCheck,
  FileSignature,
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";

const getDashboardData = cache(async (clientId: number) => {
  const [
    activeMandates,
    pendingQuotes,
    pendingInvoices,
    unreadDocs,
    totalMandates,
    totalContracts,
    overdueInvoices,
  ] = await prisma.$transaction([
    prisma.mandate.count({ where: { clientId, status: { in: ["active", "in_progress"] } } }),
    prisma.quote.count({ where: { clientId, status: "pending" } }),
    prisma.invoice.count({ where: { clientId, status: { in: ["unpaid", "overdue"] } } }),
    prisma.document.count({ where: { clientId, isRead: false } }),
    prisma.mandate.count({ where: { clientId } }),
    prisma.contract.count({ where: { clientId, status: "signed" } }),
    prisma.invoice.count({ where: { clientId, status: "overdue" } }),
  ]);

  const [recentEvents, client, nextAppointment] = await Promise.all([
    prisma.workflowEvent.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.client.findUnique({ where: { id: clientId } }),
    prisma.appointment.findFirst({
      where: { clientId, appointmentDate: { gte: new Date() } },
      orderBy: { appointmentDate: "asc" },
    }),
  ]);

  return { activeMandates, pendingQuotes, pendingInvoices, unreadDocs, totalMandates, totalContracts, overdueInvoices, recentEvents, client, nextAppointment };
});

export default async function PortalDashboard() {
  const session = await auth();
  const clientId = session!.user.clientId!;
  const t = await getTranslations({ namespace: "portal.dashboard" });

  const { activeMandates, pendingQuotes, pendingInvoices, unreadDocs, totalMandates, totalContracts, overdueInvoices, recentEvents, client, nextAppointment } = await getDashboardData(clientId);

  const kpis = [
    {
      label: t("active_mandates"),
      value: activeMandates,
      icon: Briefcase,
      bg: "bg-emerald-50/60",
      labelColor: "text-emerald-600",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      href: "/portail/mandats",
    },
    {
      label: t("pending_quotes"),
      value: pendingQuotes,
      icon: FileText,
      bg: "bg-amber-50/60",
      labelColor: "text-amber-600",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      href: "/portail/devis",
    },
    {
      label: t("pending_invoices"),
      value: pendingInvoices,
      icon: Receipt,
      bg: "bg-red-50/60",
      labelColor: "text-red-600",
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      href: "/portail/factures",
    },
    {
      label: t("unread_documents"),
      value: unreadDocs,
      icon: FolderOpen,
      bg: "bg-[#0F2D52]/5",
      labelColor: "text-[#0F2D52]",
      iconBg: "bg-[#0F2D52]/10",
      iconColor: "text-[#0F2D52]",
      href: "/portail/documents",
    },
  ];

  const quickActions = [
    { label: "Devis", href: "/portail/devis", icon: FileText },
    { label: "Factures", href: "/portail/factures", icon: Receipt },
    { label: "Contrats", href: "/portail/contrats", icon: FileSignature },
    { label: "Nouvelle demande", href: "/portail/demandes", icon: Inbox },
  ];

  // Event type colors for timeline
  const eventColor = (type: string) => {
    if (type.includes("quote")) return "bg-amber-500";
    if (type.includes("invoice") || type.includes("payment"))
      return "bg-emerald-500";
    if (type.includes("contract")) return "bg-blue-500";
    if (type.includes("mandate")) return "bg-purple-500";
    return "bg-gray-400";
  };

  const eventIcon = (type: string) => {
    if (type.includes("quote")) return FileText;
    if (type.includes("invoice") || type.includes("payment")) return Receipt;
    if (type.includes("contract")) return FileSignature;
    if (type.includes("mandate")) return Briefcase;
    return Clock;
  };

  const firstName = client?.fullName.split(" ")[0] ?? "";

  return (
    <div className="space-y-4">
      {/* ── Banner + KPIs + actions ── */}
      <div className="space-y-4">

      {/* ── Welcome Banner ───────────────────────────── */}
      <div className="relative overflow-hidden rounded-xl sm:rounded-2xl vnk-gradient p-4 sm:p-6 lg:p-8 text-white">
        {/* Decorative circles — hidden on small screens */}
        <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/5 hidden sm:block" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5 hidden sm:block" />

        <div className="relative z-10">
          <h1 className="portal-title text-white tracking-tight">
            {t("greeting", { name: firstName })}
          </h1>
          <p className="text-white/70 mt-0.5 portal-subtitle">
            {client?.companyName}
          </p>

          {/* Quick stats row inside banner */}
          <div className="mt-3 sm:mt-5 flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5 bg-white/10 rounded-md px-2 py-1 sm:px-3 sm:py-1.5">
              <Briefcase className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
              <span className="font-semibold">{activeMandates}</span>
              <span className="text-white/70">mandats</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 rounded-md px-2 py-1 sm:px-3 sm:py-1.5">
              <FileSignature className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
              <span className="font-semibold">{totalContracts}</span>
              <span className="text-white/70">contrats</span>
            </div>
            {nextAppointment && (
              <div className="flex items-center gap-1.5 bg-white/10 rounded-md px-2 py-1 sm:px-3 sm:py-1.5">
                <CalendarCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                <span className="text-white/70">RDV :</span>
                <span className="font-semibold">
                  {formatDate(nextAppointment.appointmentDate)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 portal-kpi-grid">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Link key={k.label} href={k.href}>
              <div className={`rounded-xl border ${k.bg} portal-kpi-card hover:shadow-md transition-shadow cursor-pointer`}>
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`portal-icon-sm rounded-lg ${k.iconBg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${k.iconColor}`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`portal-kpi-label ${k.labelColor} truncate`}>
                      {k.label}
                    </p>
                    <p className="portal-kpi-number">{k.value}</p>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Quick Actions ────────────────────────────── */}
      <div>
        <h2 className="portal-kpi-label text-muted-foreground mb-2 sm:mb-3">
          Actions rapides
        </h2>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Button
                key={a.href}
                variant="outline"
                size="sm"
                asChild
                className="shadow-sm hover:shadow-md hover:border-primary/30 transition-all h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3"
              >
                <Link href={a.href}>
                  <Icon className="h-3.5 w-3.5 mr-1 shrink-0" />
                  <span className="truncate">{a.label}</span>
                  <ArrowRight className="h-3 w-3 ml-1 opacity-50 shrink-0" />
                </Link>
              </Button>
            );
          })}
        </div>
      </div>
      </div>

      {/* ── Activity Timeline ────────────────────────── */}
      <div className="mt-4">
      <Card className="shadow-sm border-0 ring-1 ring-border/50">
        <CardContent className="p-3 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="portal-icon-sm rounded-lg vnk-gradient flex items-center justify-center shrink-0">
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
              </div>
              <h2 className="font-semibold text-sm sm:text-lg">{t("recent_activity")}</h2>
            </div>
            <span className="text-[10px] sm:text-xs text-muted-foreground px-2 py-0.5 sm:px-2.5 sm:py-1 bg-muted rounded-full shrink-0">
              {recentEvents.length} evenements
            </span>
          </div>

          {recentEvents.length === 0 ? (
            <div className="text-center py-16">
              <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Inbox className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Aucune activite recente
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Vos prochaines actions apparaitront ici
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[15px] sm:left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-border via-border to-transparent" />

              <ul className="space-y-0.5">
                {recentEvents.map((ev, i) => {
                  const EvIcon = eventIcon(ev.eventType);
                  return (
                    <li
                      key={ev.id}
                      className="flex items-start gap-2.5 sm:gap-4 relative py-2 sm:py-2.5 px-1 sm:px-2 -mx-1 sm:-mx-2 rounded-lg hover:bg-muted/30 transition-colors group"
                    >
                      {/* Icon dot */}
                      <div
                        className={`h-8 w-8 sm:h-10 sm:w-10 rounded-lg ${eventColor(ev.eventType)} flex items-center justify-center shrink-0 z-10 shadow-sm`}
                      >
                        <EvIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0 py-0.5">
                        <p className="text-xs sm:text-sm font-medium leading-snug">
                          {ev.eventLabel}
                        </p>
                        <time className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 block">
                          {formatDate(ev.createdAt)}
                        </time>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-colors shrink-0 mt-1 hidden sm:block" />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
