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
    { label: "Mes devis", href: "/portail/devis", icon: FileText },
    { label: "Mes factures", href: "/portail/factures", icon: Receipt },
    { label: "Mes contrats", href: "/portail/contrats", icon: FileSignature },
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
    <div className="space-y-8">
      {/* ── Welcome Banner ───────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl vnk-gradient p-6 sm:p-8 text-white">
        {/* Decorative circles */}
        <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute top-1/2 right-1/4 h-20 w-20 rounded-full bg-white/5" />

        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {t("greeting", { name: firstName })}
          </h1>
          <p className="text-white/70 mt-1 text-sm sm:text-base">
            {client?.companyName}
          </p>

          {/* Quick stats row inside banner */}
          <div className="mt-5 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
              <Briefcase className="h-3.5 w-3.5" />
              <span className="font-semibold">{activeMandates}</span>
              <span className="text-white/70">mandats actifs</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
              <FileSignature className="h-3.5 w-3.5" />
              <span className="font-semibold">{totalContracts}</span>
              <span className="text-white/70">contrats signes</span>
            </div>
            {nextAppointment && (
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
                <CalendarCheck className="h-3.5 w-3.5" />
                <span className="text-white/70">Prochain RDV :</span>
                <span className="font-semibold">
                  {formatDate(nextAppointment.appointmentDate)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Link key={k.label} href={k.href}>
              <div className={`rounded-xl border ${k.bg} p-4 hover:shadow-md transition-shadow cursor-pointer`}>
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg ${k.iconBg} flex items-center justify-center`}>
                    <Icon className={`h-4 w-4 ${k.iconColor}`} />
                  </div>
                  <div>
                    <p className={`text-[11px] uppercase tracking-wider font-semibold ${k.labelColor}`}>
                      {k.label}
                    </p>
                    <p className="text-2xl font-bold">{k.value}</p>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Quick Actions ────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Actions rapides
        </h2>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Button
                key={a.href}
                variant="outline"
                size="sm"
                asChild
                className="shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
              >
                <Link href={a.href}>
                  <Icon className="h-4 w-4 mr-1.5" />
                  {a.label}
                  <ArrowRight className="h-3 w-3 ml-1.5 opacity-50" />
                </Link>
              </Button>
            );
          })}
        </div>
      </div>

      {/* ── Activity Timeline ────────────────────────── */}
      <Card className="shadow-sm border-0 ring-1 ring-border/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg vnk-gradient flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <h2 className="font-semibold text-lg">{t("recent_activity")}</h2>
            </div>
            <span className="text-xs text-muted-foreground px-2.5 py-1 bg-muted rounded-full">
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
              <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-border via-border to-transparent" />

              <ul className="space-y-1">
                {recentEvents.map((ev, i) => {
                  const EvIcon = eventIcon(ev.eventType);
                  return (
                    <li
                      key={ev.id}
                      className="flex items-start gap-4 relative py-2.5 px-2 -mx-2 rounded-lg hover:bg-muted/30 transition-colors group"
                    >
                      {/* Icon dot */}
                      <div
                        className={`h-10 w-10 rounded-lg ${eventColor(ev.eventType)} flex items-center justify-center shrink-0 z-10 shadow-sm`}
                      >
                        <EvIcon className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0 py-0.5">
                        <p className="text-sm font-medium leading-snug">
                          {ev.eventLabel}
                        </p>
                        <time className="text-xs text-muted-foreground mt-0.5 block">
                          {formatDate(ev.createdAt)}
                        </time>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-colors shrink-0 mt-1.5" />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
