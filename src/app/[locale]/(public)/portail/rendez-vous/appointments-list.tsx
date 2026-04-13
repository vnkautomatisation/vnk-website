"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CalendarCheck,
  Video,
  Phone,
  MapPin,
  XCircle,
  ExternalLink,
  Hash,
  CalendarClock,
  Clock,
} from "lucide-react";
import { DataTable, type Column, type FilterOption } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatTime } from "@/lib/utils";
import Link from "next/link";

type Appointment = {
  id: number;
  subject: string | null;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  meetingType: string;
  meetingLink: string | null;
  status: string;
  isUpcoming: boolean;
};

const FILTER_OPTIONS: FilterOption[] = [
  { value: "upcoming", label: "A venir" },
  { value: "past", label: "Passes" },
  { value: "confirmed", label: "Confirmes" },
  { value: "cancelled", label: "Annules" },
];

const TYPE_ICON = { video: Video, phone: Phone, onsite: MapPin } as Record<string, typeof Video>;

export function AppointmentsList({ appointments }: { appointments: Appointment[] }) {
  const router = useRouter();
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const kpis = useMemo(() => {
    const total = appointments.length;
    const upcoming = appointments.filter((a) => a.isUpcoming).length;
    const past = appointments.filter((a) => !a.isUpcoming).length;
    const video = appointments.filter((a) => a.meetingType === "video").length;
    return { total, upcoming, past, video };
  }, [appointments]);

  async function handleCancel() {
    if (!cancelId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/appointments/${cancelId}/cancel`, { method: "POST" });
      if (res.ok) { setCancelId(null); router.refresh(); }
    } finally { setLoading(false); }
  }

  const columns: Column<Appointment>[] = [
    {
      key: "icon",
      header: "",
      className: "w-10",
      accessor: (r) => {
        const Icon = TYPE_ICON[r.meetingType] ?? Video;
        return (
          <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-[#0F2D52]" />
          </div>
        );
      },
    },
    {
      key: "subject",
      header: "Sujet",
      accessor: (r) => (
        <div>
          <span className="font-medium text-sm">{r.subject ?? "Rendez-vous"}</span>
          <p className="text-xs text-muted-foreground mt-0.5">
            {r.meetingType === "video" ? "Video" : r.meetingType === "phone" ? "Telephone" : "Sur place"}
          </p>
        </div>
      ),
      sortable: true,
      sortBy: (r) => r.subject ?? "",
    },
    {
      key: "date",
      header: "Date",
      accessor: (r) => (
        <span className="text-sm">{formatDate(r.appointmentDate)}</span>
      ),
      sortable: true,
      sortBy: (r) => new Date(r.appointmentDate).getTime(),
    },
    {
      key: "time",
      header: "Heure",
      accessor: (r) => (
        <span className="text-sm text-muted-foreground">
          {formatTime(r.startTime)} - {formatTime(r.endTime)}
        </span>
      ),
      hiddenOnMobile: true,
    },
    {
      key: "status",
      header: "Statut",
      accessor: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "actions",
      header: "",
      className: "w-[180px]",
      accessor: (r) => (
        <div className="flex gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
          {r.meetingLink && r.isUpcoming && (
            <Button size="sm" className="bg-[#0F2D52] hover:bg-[#1a3a66]" asChild>
              <a href={r.meetingLink} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Rejoindre
              </a>
            </Button>
          )}
          {r.isUpcoming && r.status !== "cancelled" && (
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => setCancelId(r.id)}>
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const renderCard = (a: Appointment) => {
    const Icon = TYPE_ICON[a.meetingType] ?? Video;
    return (
      <Card className="border shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-[#0F2D52]" />
              </div>
              <div>
                <p className="font-medium text-sm">{a.subject ?? "Rendez-vous"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(a.appointmentDate)} · {formatTime(a.startTime)} - {formatTime(a.endTime)}
                </p>
              </div>
            </div>
            <StatusBadge status={a.status} />
          </div>
          {a.isUpcoming && (
            <div className="mt-3 flex gap-2">
              {a.meetingLink && (
                <Button size="sm" className="bg-[#0F2D52] hover:bg-[#1a3a66]" asChild>
                  <a href={a.meetingLink} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    Rejoindre
                  </a>
                </Button>
              )}
              {a.status !== "cancelled" && (
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => setCancelId(a.id)}>
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Annuler
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const filterFn = (r: Appointment) => {
    if (r.isUpcoming) return "upcoming";
    if (r.status === "cancelled") return "cancelled";
    if (r.status === "confirmed") return "confirmed";
    return "past";
  };

  return (
    <>
      <DataTable
        data={appointments}
        columns={columns}
        getRowId={(r) => r.id}
        renderCard={renderCard}
        storageKey="portal-appointments"
        searchPlaceholder="Rechercher un rendez-vous..."
        searchFn={(r) => `${r.subject ?? ""} ${r.meetingType}`}
        filterOptions={FILTER_OPTIONS}
        filterFn={filterFn}
        filterLabel="Tous les statuts"
        pageSize={8}
        emptyMessage="Aucun rendez-vous"
        stickyHeader={
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl vnk-gradient flex items-center justify-center shadow-lg">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Mes rendez-vous</h1>
                  <p className="text-sm text-muted-foreground">Planifiez et gerez vos rendez-vous</p>
                </div>
              </div>
              <Button asChild className="bg-[#0F2D52] hover:bg-[#1a3a66] shadow-sm">
                <Link href="/portail/reserver">
                  <CalendarCheck className="h-4 w-4 mr-1.5" />
                  Reserver
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border bg-[#0F2D52]/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
                    <Hash className="h-4 w-4 text-[#0F2D52]" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{kpis.total}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-emerald-50/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <CalendarClock className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-emerald-600">A venir</p>
                    <p className="text-2xl font-bold">{kpis.upcoming}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-[#0F2D52]/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-[#0F2D52]" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Passes</p>
                    <p className="text-2xl font-bold">{kpis.past}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-[#0F2D52]/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
                    <Video className="h-4 w-4 text-[#0F2D52]" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Video</p>
                    <p className="text-2xl font-bold">{kpis.video}</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        }
      />

      <ConfirmDialog
        open={cancelId !== null}
        onOpenChange={(open) => { if (!open) setCancelId(null); }}
        title="Annuler le rendez-vous"
        description="Etes-vous sur de vouloir annuler ce rendez-vous ?"
        confirmLabel="Oui, annuler"
        cancelLabel="Non, garder"
        variant="destructive"
        loading={loading}
        onConfirm={handleCancel}
      />
    </>
  );
}
