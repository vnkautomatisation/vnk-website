"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Video,
  Phone,
  MapPin,
  XCircle,
  CalendarClock,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { StatusBadge } from "@/components/admin/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
};

const PAGE_SIZE = 5;

export function AppointmentsList({
  upcoming,
  past,
}: {
  upcoming: Appointment[];
  past: Appointment[];
}) {
  const router = useRouter();
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [upPage, setUpPage] = useState(1);
  const [pastPage, setPastPage] = useState(1);

  const upTotalPages = Math.max(1, Math.ceil(upcoming.length / PAGE_SIZE));
  const pastTotalPages = Math.max(1, Math.ceil(past.length / PAGE_SIZE));

  const upSlice = useMemo(() => {
    const start = (upPage - 1) * PAGE_SIZE;
    return upcoming.slice(start, start + PAGE_SIZE);
  }, [upcoming, upPage]);

  const pastSlice = useMemo(() => {
    const start = (pastPage - 1) * PAGE_SIZE;
    return past.slice(start, start + PAGE_SIZE);
  }, [past, pastPage]);

  async function handleCancel() {
    if (!cancelId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/appointments/${cancelId}/cancel`, {
        method: "POST",
      });
      if (res.ok) {
        setCancelId(null);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  function renderCard(a: Appointment, showActions: boolean) {
    const TypeIcon = a.meetingType === "video" ? Video : a.meetingType === "phone" ? Phone : MapPin;
    return (
      <Card key={a.id} className="border shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center shrink-0">
                <TypeIcon className="h-4 w-4 text-[#0F2D52]" />
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
          {showActions && (
            <div className="mt-3 flex gap-2">
              {a.meetingLink && (
                <Button size="sm" className="bg-[#0F2D52] hover:bg-[#1a3a66]" asChild>
                  <a href={a.meetingLink} target="_blank" rel="noreferrer">
                    <Video className="h-3.5 w-3.5 mr-1" />
                    Rejoindre
                  </a>
                </Button>
              )}
              <Button size="sm" variant="outline">Reprogrammer</Button>
              {a.status !== "cancelled" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => setCancelId(a.id)}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Annuler
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Upcoming */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">
            A venir ({upcoming.length})
          </h2>
        </div>
        {upcoming.length === 0 ? (
          <Card className="border shadow-sm">
            <CardContent className="p-8 text-center">
              <CalendarClock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Aucun rendez-vous a venir</p>
              <Button size="sm" asChild className="mt-3 bg-[#0F2D52] hover:bg-[#1a3a66]">
                <Link href="/portail/reserver">
                  <CalendarCheck className="h-3.5 w-3.5 mr-1" />
                  Reserver
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-2">
              {upSlice.map((a) => renderCard(a, true))}
            </div>
            {upTotalPages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted-foreground">
                  {(upPage - 1) * PAGE_SIZE + 1}-{Math.min(upPage * PAGE_SIZE, upcoming.length)} sur {upcoming.length}
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={upPage <= 1} onClick={() => setUpPage(upPage - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={upPage >= upTotalPages} onClick={() => setUpPage(upPage + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider mb-3">
            Passes ({past.length})
          </h2>
          <div className="space-y-2">
            {pastSlice.map((a) => renderCard(a, false))}
          </div>
          {pastTotalPages > 1 && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-muted-foreground">
                {(pastPage - 1) * PAGE_SIZE + 1}-{Math.min(pastPage * PAGE_SIZE, past.length)} sur {past.length}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={pastPage <= 1} onClick={() => setPastPage(pastPage - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={pastPage >= pastTotalPages} onClick={() => setPastPage(pastPage + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
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
