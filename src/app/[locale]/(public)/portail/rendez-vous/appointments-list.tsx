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
  Link2,
  FileText,
  X,
} from "lucide-react";
import { DataTable, type Column, type FilterOption } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
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
  meetingId: string | null;
  meetingPassword: string | null;
  status: string;
  isUpcoming: boolean;
  notesClient: string | null;
  notesAdmin: string | null;
  durationMin: number | null;
};

const FILTER_OPTIONS: FilterOption[] = [
  { value: "upcoming", label: "A venir" },
  { value: "past", label: "Passes" },
  { value: "with_link", label: "Avec lien" },
  { value: "cancelled", label: "Annules" },
];

const TYPE_ICON = { video: Video, phone: Phone, onsite: MapPin } as Record<string, typeof Video>;
const TYPE_LABEL: Record<string, string> = { video: "Video", phone: "Telephone", onsite: "Sur place" };

export function AppointmentsList({ appointments }: { appointments: Appointment[] }) {
  const router = useRouter();
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(false);

  // Tri : a venir (prochain en haut), passes (recent en haut), annules en dernier
  const sorted = useMemo(() => {
    const active = appointments.filter((a) => a.status !== "cancelled");
    const cancelled = appointments.filter((a) => a.status === "cancelled");
    const upcoming = active.filter((a) => a.isUpcoming).sort(
      (a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime()
    );
    const past = active.filter((a) => !a.isUpcoming).sort(
      (a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime()
    );
    return [...upcoming, ...past, ...cancelled];
  }, [appointments]);

  const kpis = useMemo(() => ({
    total: appointments.length,
    upcoming: appointments.filter((a) => a.isUpcoming && a.status !== "cancelled").length,
    past: appointments.filter((a) => !a.isUpcoming).length,
    withLink: appointments.filter((a) => !!a.meetingLink).length,
  }), [appointments]);

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
      key: "type",
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
      key: "info",
      header: "Rendez-vous",
      accessor: (r) => (
        <div>
          <span className="font-medium text-sm">{r.subject ?? "Rendez-vous"}</span>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDate(r.appointmentDate)} · {formatTime(r.startTime)} - {formatTime(r.endTime)}
          </p>
          {r.meetingLink && r.status !== "cancelled" && (
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              <Link2 className="h-3 w-3" />
              Lien disponible
            </span>
          )}
          {!r.meetingLink && r.isUpcoming && r.status !== "cancelled" && (
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              <Clock className="h-3 w-3" />
              En attente du lien
            </span>
          )}
        </div>
      ),
      sortable: true,
      sortBy: (r) => new Date(r.appointmentDate).getTime(),
    },
    {
      key: "meetingType",
      header: "Type",
      accessor: (r) => (
        <span className="text-xs text-muted-foreground">{TYPE_LABEL[r.meetingType] ?? r.meetingType}</span>
      ),
      hiddenOnMobile: true,
    },
    {
      key: "status",
      header: "Statut",
      accessor: (r) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={r.status} />
          {r.isUpcoming && r.status !== "cancelled" && (
            <span className="text-[10px] text-emerald-600 font-medium">A venir</span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-[80px]",
      accessor: (r) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" onClick={() => setDetail(r)}>
            Voir
          </Button>
        </div>
      ),
    },
  ];

  const renderCard = (a: Appointment) => {
    const Icon = TYPE_ICON[a.meetingType] ?? Video;
    const isCancelled = a.status === "cancelled";
    return (
      <Card className={`border shadow-sm hover:shadow-md transition-shadow ${isCancelled ? "opacity-60" : ""}`}>
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
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{TYPE_LABEL[a.meetingType] ?? a.meetingType}</Badge>
                  {a.meetingLink && <Link2 className="h-3 w-3 text-emerald-600" />}
                </div>
              </div>
            </div>
            <StatusBadge status={a.status} />
          </div>
          {a.isUpcoming && !isCancelled && (
            <div className="mt-3 flex gap-2">
              {a.meetingLink && (
                <Button size="sm" className="bg-[#0F2D52] hover:bg-[#1a3a66]" asChild>
                  <a href={a.meetingLink} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    Rejoindre
                  </a>
                </Button>
              )}
              <Button size="sm" variant="outline" className="text-destructive" onClick={(e) => { e.stopPropagation(); setCancelId(a.id); }}>
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Annuler
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const filterFn = (r: Appointment) => {
    if (r.status === "cancelled") return "cancelled";
    if (r.meetingLink) return "with_link";
    if (r.isUpcoming) return "upcoming";
    return "past";
  };

  return (
    <>
      <DataTable
        data={sorted}
        columns={columns}
        getRowId={(r) => r.id}
        renderCard={renderCard}
        onRowClick={(r) => setDetail(r)}
        storageKey="portal-appointments"
        searchPlaceholder="Rechercher un rendez-vous..."
        searchFn={(r) => `${r.subject ?? ""} ${TYPE_LABEL[r.meetingType] ?? ""}`}
        filterOptions={FILTER_OPTIONS}
        filterFn={filterFn}
        filterLabel="Tous"
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
              <div className="rounded-xl border bg-[#0F2D52]/5 p-3">
                <p className="text-2xl font-bold">{kpis.total}</p>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Total</p>
              </div>
              <div className="rounded-xl border bg-emerald-50/60 p-3">
                <p className="text-2xl font-bold">{kpis.upcoming}</p>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-emerald-600">A venir</p>
              </div>
              <div className="rounded-xl border bg-[#0F2D52]/5 p-3">
                <p className="text-2xl font-bold">{kpis.past}</p>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Passes</p>
              </div>
              <div className="rounded-xl border bg-[#0F2D52]/5 p-3">
                <p className="text-2xl font-bold">{kpis.withLink}</p>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Avec lien</p>
              </div>
            </div>
          </>
        }
      />

      {/* Detail modal */}
      {detail && (
        <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
          <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
            <DialogTitle className="sr-only">{detail.subject ?? "Rendez-vous"}</DialogTitle>
            <div className="bg-[#0F2D52] px-6 py-5 text-white relative">
              <button onClick={() => setDetail(null)} className="absolute top-4 right-4 h-8 w-8 rounded-lg hover:bg-white/10 flex items-center justify-center">
                <X className="h-4 w-4 text-white/70" />
              </button>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center">
                  {(() => { const I = TYPE_ICON[detail.meetingType] ?? Video; return <I className="h-6 w-6 text-white" />; })()}
                </div>
                <div>
                  <h2 className="text-lg font-bold">{detail.subject ?? "Rendez-vous"}</h2>
                  <p className="text-white/60 text-sm">{TYPE_LABEL[detail.meetingType] ?? detail.meetingType}</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Date/heure */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="text-sm font-medium">{formatDate(detail.appointmentDate)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Heure</p>
                    <p className="text-sm font-medium">{formatTime(detail.startTime)} - {formatTime(detail.endTime)}</p>
                  </div>
                </div>
              </div>

              {/* Statut + duree */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Statut :</span>
                  <StatusBadge status={detail.status} />
                </div>
                {detail.durationMin && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {detail.durationMin} min
                  </div>
                )}
              </div>

              {/* Reunion */}
              {detail.meetingLink && detail.status !== "cancelled" ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-700">Reunion programmee</span>
                  </div>
                  {(detail.meetingId || detail.meetingPassword) && (
                    <div className="space-y-1 text-sm">
                      {detail.meetingId && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ID</span>
                          <span className="font-mono font-medium">{detail.meetingId}</span>
                        </div>
                      )}
                      {detail.meetingPassword && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Code</span>
                          <span className="font-mono font-medium">{detail.meetingPassword}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <Button className="w-full bg-[#0F2D52] hover:bg-[#1a3a66]" asChild>
                    <a href={detail.meetingLink} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Rejoindre la reunion
                    </a>
                  </Button>
                </div>
              ) : detail.status !== "cancelled" && detail.isUpcoming ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-700">En attente — le lien de reunion sera disponible prochainement</span>
                  </div>
                </div>
              ) : null}

              {/* Notes VNK */}
              {detail.notesAdmin && (
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-3.5 w-3.5 text-[#0F2D52]" />
                    <span className="text-xs font-semibold text-[#0F2D52] uppercase tracking-wider">Notes VNK</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{detail.notesAdmin}</p>
                </div>
              )}

              {/* Notes client */}
              {detail.notesClient && (
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vos notes</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{detail.notesClient}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              {detail.isUpcoming && detail.status !== "cancelled" && (
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => { setDetail(null); setCancelId(detail.id); }}>
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Annuler
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setDetail(null)}>Fermer</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

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
