// HR · Rapports & people analytics.
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isHrAdmin } from "@/lib/services/hr-access";
import { redirect } from "next/navigation";
import { FileBarChart, TrendingUp, Users, AlertTriangle, Clock, Calendar, FileDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getHrReportData } from "@/lib/services/hr-reports";
import { HrReportPdfButton } from "./hr-report-pdf-button";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  if (!(await isHrAdmin(session.user.adminId!))) redirect("/admin/employes/organigramme");

  const today = new Date();
  const yearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  const oneYearFromNow = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());

  const [
    report,
    byDepartment,
    expiringLicenses,
    openTimeClocks,
    totalPayStubs,
    cnesstThisYear,
  ] = await Promise.all([
    getHrReportData(),
    prisma.admin.groupBy({
      by: ["department"],
      where: { isActive: true, department: { not: null } },
      _count: { _all: true },
    }),
    prisma.professionalLicense.count({ where: { expiresAt: { gte: today, lte: oneYearFromNow } } }),
    prisma.timeClock.count({ where: { clockOut: null } }),
    prisma.payStub.count(),
    prisma.cnesstIncident.count({ where: { incidentDate: { gte: yearAgo } } }),
  ]);

  const totalActive = report.headcountActive;
  const totalInactive = report.headcountInactive;
  const hiredThisYear = report.hiresLast12Months;
  const deactivatedThisYear = report.departuresLast12Months;
  const turnoverPct = report.turnoverPct.toFixed(1);
  const pendingLeaves = report.pendingLeaves;
  const byPosition = report.positionsBreakdown;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><FileBarChart className="h-5 w-5 text-[#0F2D52]" />Rapports RH</h1>
          <p className="text-sm text-muted-foreground">Vue d&apos;ensemble des effectifs et indicateurs clés sur les 12 derniers mois.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <HrReportPdfButton />
          <Button variant="outline" size="sm" asChild>
            <a href="/api/admin/reports/hr/csv">
              <FileDown className="h-4 w-4 mr-1.5 text-[#0F2D52]" />Exporter CSV
            </a>
          </Button>
        </div>
      </div>

      {/* KPIs principaux */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Effectif actif</p>
          <p className="text-3xl font-bold">{totalActive}</p>
        </Card>
        <Card className="p-4 bg-emerald-50/30 border-emerald-200">
          <p className="text-xs uppercase tracking-wider text-emerald-700 font-semibold">Embauches 12 mois</p>
          <p className="text-3xl font-bold text-emerald-900">+{hiredThisYear}</p>
        </Card>
        <Card className="p-4 bg-red-50/30 border-red-200">
          <p className="text-xs uppercase tracking-wider text-red-700 font-semibold">Départs 12 mois</p>
          <p className="text-3xl font-bold text-red-900">-{deactivatedThisYear}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Taux turnover</p>
          <p className="text-3xl font-bold">{turnoverPct}%</p>
        </Card>
      </div>

      {/* Alertes opérationnelles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 flex items-center gap-2 bg-amber-50/50 border-amber-200">
          <Calendar className="h-4 w-4 text-amber-600" />
          <div>
            <p className="text-xs font-semibold">{pendingLeaves} congé{pendingLeaves > 1 ? "s" : ""} à approuver</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-2 bg-amber-50/50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <div>
            <p className="text-xs font-semibold">{expiringLicenses} permis &lt; 1 an</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#0F2D52]" />
          <div>
            <p className="text-xs font-semibold">{openTimeClocks} pointage{openTimeClocks > 1 ? "s" : ""} ouvert{openTimeClocks > 1 ? "s" : ""}</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-2 bg-red-50/40 border-red-200">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <div>
            <p className="text-xs font-semibold">{cnesstThisYear} déclaration{cnesstThisYear > 1 ? "s" : ""} CNESST</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h2 className="font-bold text-sm flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-[#0F2D52]" />Par département
          </h2>
          {byDepartment.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun département défini.</p>
          ) : (
            <div className="space-y-1.5">
              {byDepartment.map((d) => {
                const pct = Math.round((d._count._all / totalActive) * 100);
                return (
                  <div key={d.department}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span>{d.department}</span>
                      <span className="font-mono">{d._count._all} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                      <div className="h-full bg-[#0F2D52]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-bold text-sm flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-[#0F2D52]" />Par poste
          </h2>
          {byPosition.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun poste assigné.</p>
          ) : (
            <div className="space-y-1.5">
              {byPosition.sort((a, b) => b.count - a.count).map((p) => (
                <div key={p.name} className="flex items-center justify-between text-xs">
                  <span>{p.name}</span>
                  <Badge variant="outline" className="text-[10px]">{p.count}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-bold text-sm mb-3">Volume opérationnel</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Bulletins émis (total)</p>
            <p className="text-2xl font-bold">{totalPayStubs}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Effectif inactif</p>
            <p className="text-2xl font-bold text-muted-foreground">{totalInactive}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
