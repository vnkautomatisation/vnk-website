// Portail · Tableau de bord client
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, FileText, Receipt, FolderOpen } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function PortalDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  const clientId = session!.user.clientId!;
  const t = await getTranslations({ locale, namespace: "portal.dashboard" });

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
        take: 10,
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
    },
    {
      label: t("pending_quotes"),
      value: pendingQuotes,
      icon: FileText,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: t("pending_invoices"),
      value: pendingInvoices,
      icon: Receipt,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      label: t("unread_documents"),
      value: unreadDocs,
      icon: FolderOpen,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {t("greeting", { name: client?.fullName.split(" ")[0] ?? "" })}
        </h1>
        <p className="text-muted-foreground mt-1">{client?.companyName}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="vnk-card-hover">
              <CardContent className="p-5">
                <div className={`h-11 w-11 rounded-lg ${k.bg} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${k.color}`} />
                </div>
                <p className="text-xs uppercase text-muted-foreground tracking-wider mt-4">
                  {k.label}
                </p>
                <p className="text-2xl font-bold mt-1">{k.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
                <li
                  key={ev.id}
                  className="flex items-start justify-between gap-3 pb-3 border-b last:border-0 last:pb-0"
                >
                  <p className="text-sm">{ev.eventLabel}</p>
                  <time className="text-xs text-muted-foreground shrink-0">
                    {formatDate(ev.createdAt)}
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
