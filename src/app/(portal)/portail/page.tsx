// Portail · Tableau de bord client
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
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function PortalDashboard() {
  const session = await auth();
  const clientId = session!.user.clientId!;
  const t = await getTranslations({ namespace: "portal.dashboard" });

  const [activeMandates, pendingQuotes, pendingInvoices, unreadDocs, recentEvents, client] =
    await Promise.all([
      prisma.mandate.count({
        where: { clientId, status: { in: ["active", "in_progress"] } },
      }),
      prisma.quote.count({ where: { clientId, status: "pending" } }),
      prisma.invoice.count({
        where: { clientId, status: { in: ["unpaid", "overdue"] } },
      }),
      prisma.document.count({ where: { clientId, isRead: false } }),
      prisma.workflowEvent.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
      prisma.client.findUnique({ where: { id: clientId } }),
    ]);

  const kpis = [
    {
      label: t("active_mandates"),
      value: activeMandates,
      icon: Briefcase,
      color: "text-purple-600",
      bg: "bg-purple-50",
      href: "/portail/mandats",
    },
    {
      label: t("pending_quotes"),
      value: pendingQuotes,
      icon: FileText,
      color: "text-amber-600",
      bg: "bg-amber-50",
      href: "/portail/devis",
    },
    {
      label: t("pending_invoices"),
      value: pendingInvoices,
      icon: Receipt,
      color: "text-red-600",
      bg: "bg-red-50",
      href: "/portail/factures",
    },
    {
      label: t("unread_documents"),
      value: unreadDocs,
      icon: FolderOpen,
      color: "text-blue-600",
      bg: "bg-blue-50",
      href: "/portail/documents",
    },
  ];

  const quickActions = [
    { label: "Mes devis", href: "/portail/devis", icon: FileText },
    { label: "Mes factures", href: "/portail/factures", icon: Receipt },
    { label: "Nouvelle demande", href: "/portail/demandes", icon: Inbox },
  ];

  // Event type colors for timeline
  const eventColor = (type: string) => {
    if (type.includes("quote")) return "bg-amber-500";
    if (type.includes("invoice") || type.includes("payment")) return "bg-emerald-500";
    if (type.includes("contract")) return "bg-blue-500";
    if (type.includes("mandate")) return "bg-purple-500";
    return "bg-gray-400";
  };

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {t("greeting", { name: client?.fullName.split(" ")[0] ?? "" })}
        </h1>
        <p className="text-muted-foreground mt-1">{client?.companyName}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Link key={k.label} href={k.href}>
              <Card className="hover:shadow-md hover:border-[#0F2D52]/20 transition-all cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className={`h-11 w-11 rounded-lg ${k.bg} flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${k.color}`} />
                    </div>
                    {k.value > 0 && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${k.bg} ${k.color}`}>
                        {k.value}
                      </span>
                    )}
                  </div>
                  <p className="text-xs uppercase text-muted-foreground tracking-wider mt-4">
                    {k.label}
                  </p>
                  <p className="text-2xl font-bold mt-1">{k.value}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        {quickActions.map((a) => {
          const Icon = a.icon;
          return (
            <Button key={a.href} variant="outline" size="sm" asChild>
              <Link href={a.href}>
                <Icon className="h-4 w-4 mr-1.5" />
                {a.label}
                <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          );
        })}
      </div>

      {/* Activity timeline */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-lg">{t("recent_activity")}</h2>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>

          {recentEvents.length === 0 ? (
            <div className="text-center py-12">
              <Inbox className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Aucune activite recente</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border" />

              <ul className="space-y-4">
                {recentEvents.map((ev) => (
                  <li key={ev.id} className="flex items-start gap-4 relative">
                    {/* Dot */}
                    <div className={`h-4 w-4 rounded-full ${eventColor(ev.eventType)} shrink-0 mt-0.5 ring-2 ring-background z-10`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{ev.eventLabel}</p>
                      <time className="text-xs text-muted-foreground">
                        {formatDate(ev.createdAt)}
                      </time>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
