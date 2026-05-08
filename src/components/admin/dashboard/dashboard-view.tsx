"use client";
import {
  Users,
  Briefcase,
  AlertCircle,
  DollarSign,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
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
          label="Clients actifs"
          value={data.activeClientsCount}
          icon={Users}
          accent="bg-blue-500"
          deltaLabel={data.newClientsThisMonth > 0 ? `+${data.newClientsThisMonth} ce mois` : undefined}
          href="/admin/clients"
        />
        <StatCard
          label="Mandats actifs"
          value={data.activeMandatesCount}
          icon={Briefcase}
          accent="bg-violet-500"
          deltaLabel={data.pendingMandatesCount > 0 ? `${data.pendingMandatesCount} en attente` : undefined}
          href="/admin/mandates"
        />
        <StatCard
          label="A recevoir"
          value={formatCurrency(data.receivableAmount)}
          icon={AlertCircle}
          accent="bg-amber-500"
          deltaLabel={data.overdueCount > 0 ? `${data.overdueCount} en retard` : "Tout a jour"}
          href="/admin/invoices"
        />
        <StatCard
          label="Revenu ce mois"
          value={formatCurrency(data.thisMonthAmount)}
          icon={DollarSign}
          accent="bg-emerald-500"
          delta={data.revenueDelta !== 0 ? data.revenueDelta : undefined}
          deltaLabel="vs mois dernier"
          href="/admin/finance"
        />
      </div>

      {/* Graphique revenus + Alertes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueChart data={data.revenueByMonth} />
        </div>
        <div className="space-y-4">
          <OverdueAlerts invoices={data.overdueInvoices} />
        </div>
      </div>

      {/* RDV + Activite */}
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
