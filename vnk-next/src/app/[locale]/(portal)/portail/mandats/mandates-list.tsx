"use client";
import { useTranslations } from "next-intl";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatDate } from "@/lib/utils";
import { Briefcase } from "lucide-react";

type M = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  progress: number;
  startDate: Date | null;
  endDate: Date | null;
};

export function PortalMandatesList({ mandates }: { mandates: M[] }) {
  const t = useTranslations("portal.mandates");

  const columns: Column<M>[] = [
    { key: "title", header: "Projet", accessor: (r) => r.title, sortable: true, sortBy: (r) => r.title },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.status} /> },
    { key: "progress", header: "Progression", accessor: (r) => (
      <div className="flex items-center gap-2 min-w-[120px]">
        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${r.progress}%` }} />
        </div>
        <span className="text-xs">{r.progress}%</span>
      </div>
    ), hiddenOnMobile: true },
    { key: "start", header: "Début", accessor: (r) => formatDate(r.startDate), hiddenOnMobile: true },
    { key: "end", header: "Fin est.", accessor: (r) => formatDate(r.endDate), hiddenOnMobile: true },
  ];

  const renderCard = (m: M) => (
    <Card className="vnk-card-hover">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm">{m.title}</p>
          <StatusBadge status={m.status} />
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${m.progress}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{m.progress}% complété</span>
          {m.endDate && <span>Fin : {formatDate(m.endDate)}</span>}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Briefcase className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">{t("page_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("page_subtitle")}</p>
        </div>
      </div>
      {mandates.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Briefcase className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-semibold">{t("empty")}</p>
            <p className="text-sm text-muted-foreground">{t("empty_subtitle")}</p>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          data={mandates}
          columns={columns}
          getRowId={(r) => r.id}
          searchPlaceholder="Rechercher un mandat…"
          renderCard={renderCard}
          pageSize={10}
        />
      )}
    </div>
  );
}
