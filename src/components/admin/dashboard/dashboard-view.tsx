"use client";
import {
  Users,
  Briefcase,
  AlertCircle,
  DollarSign,
} from "lucide-react";

import { useTranslations } from "next-intl";
import { useCurrency } from "@/lib/i18n-format";
import { StatCard } from "@/components/admin/stat-card";
import { WelcomeBanner } from "./welcome-banner";
import { QuickActions } from "./quick-actions";
import { OverdueAlerts } from "./overdue-alerts";
import { UpcomingAppointments } from "./upcoming-appointments";
import { RecentActivity } from "./recent-activity";
import { RevenueChart } from "./revenue-chart";

type OverdueInvoice = {
  id: number;
  invoiceNumber: string;
  clientName: string;
  amountTtc: number;
  dueDate: string;
};

type UpcomingAppt = {
  id: number;
  clientName: string;
  subject: string | null;
  appointmentDate: string;
  startTime: string;
  meetingType: string;
};

type WorkflowEvent = {
  id: number;
  eventType: string;
  eventLabel: string | null;
  metadata?: unknown;
  clientName: string;
  companyName: string | null;
  createdAt: string;
};

export type DashboardData = {
  adminName: string;
  dateStr: string;
  activeClientsCount: number;
  newClientsThisMonth: number;
  activeMandatesCount: number;
  pendingMandatesCount: number;
  receivableAmount: number;
  overdueCount: number;
  thisMonthAmount: number;
  revenueDelta: number;
  overdueInvoices: OverdueInvoice[];
  upcomingAppointments: UpcomingAppt[];
  recentEvents: WorkflowEvent[];
  revenueByMonth: { month: string; revenue: number }[];
};

export function DashboardView({ data }: { data: DashboardData }) {
  const t = useTranslations("admin.ui");
  const tc = useTranslations("common");
  const formatCurrency = useCurrency();
  return (
    <div className="space-y-6">
      <WelcomeBanner
        adminName={data.adminName}
        date={data.dateStr}
        clientCount={data.activeClientsCount}
        mandateCount={data.activeMandatesCount}
      />

      <QuickActions />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label={t("clients_actifs")}
          value={data.activeClientsCount}
          icon={Users}
          accent="bg-blue-500"
          deltaLabel={data.newClientsThisMonth > 0 ? tc("this_month_count", { count: data.newClientsThisMonth }) : undefined}
          href="/admin/clients"
        />
        <StatCard
          label={t("mandats_actifs")}
          value={data.activeMandatesCount}
          icon={Briefcase}
          accent="bg-violet-500"
          deltaLabel={data.pendingMandatesCount > 0 ? t("n_en_attente", { count: data.pendingMandatesCount }) : undefined}
          href="/admin/mandates"
        />
        <StatCard
          label={t("recevoir")}
          value={formatCurrency(data.receivableAmount)}
          icon={AlertCircle}
          accent="bg-amber-500"
          deltaLabel={data.overdueCount > 0 ? `${data.overdueCount} en retard` : t("tout_jour")}
          href="/admin/invoices"
        />
        <StatCard
          label={t("revenu_mois")}
          value={formatCurrency(data.thisMonthAmount)}
          icon={DollarSign}
          accent="bg-emerald-500"
          delta={data.revenueDelta !== 0 ? data.revenueDelta : undefined}
          deltaLabel={t("vs_mois_dernier")}
          href="/admin/finance"
        />
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueChart data={data.revenueByMonth} />
        </div>
        <div className="space-y-4">
          <OverdueAlerts invoices={data.overdueInvoices} />
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div>
          <UpcomingAppointments appointments={data.upcomingAppointments} />
        </div>
        <div className="lg:col-span-2">
          <RecentActivity events={data.recentEvents} />
        </div>
      </div>
    </div>
  );
}
