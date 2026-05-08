"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Video,
  Phone,
  MapPin,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/admin/stat-card";
import { CreateModal } from "@/components/admin/create-modal";
import { cn } from "@/lib/utils";

type Slot = {
  id: number;
  slotDate: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  status: string;
  notes: string | null;
};

type Appointment = {
  id: number;
  slotId: number | null;
  clientId: number | null;
  clientName: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  subject: string | null;
  status: string;
  meetingType: string;
  meetingLink: string | null;
};

type ClientOption = { id: number; fullName: string; companyName: string | null; email: string };

const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DAYS_FULL = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const MEETING_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  video: Video,
  phone: Phone,
  onsite: MapPin,
};

export function CalendarView({
  slots,
  appointments,
  clients,
}: {
  slots: Slot[];
  appointments: Appointment[];
  clients: ClientOption[];
}) {
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(0);
  const [createSlotOpen, setCreateSlotOpen] = useState(false);
  const [createApptOpen, setCreateApptOpen] = useState(false);

  // Navigation
  const baseWeekStart = getWeekStart(new Date());
  const currentWeekStart = new Date(baseWeekStart);
  currentWeekStart.setDate(currentWeekStart.getDate() + weekOffset * 7);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(currentWeekStart.getDate() + i);
    return d;
  });

  const today = new Date();

  // KPIs
  const availableCount = slots.filter((s) => s.status === "available").length;
  const bookedCount = slots.filter((s) => s.status === "booked").length;
  const upcomingAppts = appointments.filter(
    (a) => new Date(a.appointmentDate) >= today && a.status === "confirmed"
  ).length;

  // Periode label
  const periodLabel = `${currentWeekStart.toLocaleDateString("fr-CA", { day: "numeric", month: "short" })} — ${days[6].toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" })}`;

  // ── Slot creation form ────────────────────────────────
  const [slotDate, setSlotDate] = useState("");
  const [slotStart, setSlotStart] = useState("09:00");
  const [slotEnd, setSlotEnd] = useState("17:00");
  const [slotStatus, setSlotStatus] = useState<"available" | "blocked">("available");

  const handleCreateSlot = async (): Promise<{ success: boolean; error?: string }> => {
    if (!slotDate) return { success: false, error: "Date requise" };
    try {
      const res = await fetch("/api/calendar/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotDate, startTime: slotStart, endTime: slotEnd, status: slotStatus }),
      });
      if (res.ok) { router.refresh(); return { success: true }; }
      const data = await res.json();
      return { success: false, error: data.error };
    } catch { return { success: false, error: "Erreur reseau" }; }
  };

  // ── Appointment creation form ─────────────────────────
  const [apptClientId, setApptClientId] = useState("");
  const [apptDate, setApptDate] = useState("");
  const [apptStart, setApptStart] = useState("09:00");
  const [apptEnd, setApptEnd] = useState("09:30");
  const [apptSubject, setApptSubject] = useState("");
  const [apptType, setApptType] = useState("video");

  const handleCreateAppt = async (): Promise<{ success: boolean; error?: string }> => {
    if (!apptClientId || !apptDate) return { success: false, error: "Client et date requis" };
    const client = clients.find((c) => c.id === Number(apptClientId));
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: Number(apptClientId),
          clientName: client?.fullName ?? "",
          clientEmail: client?.email,
          appointmentDate: apptDate,
          startTime: apptStart,
          endTime: apptEnd,
          subject: apptSubject || undefined,
          meetingType: apptType,
        }),
      });
      if (res.ok) { router.refresh(); return { success: true }; }
      const data = await res.json();
      return { success: false, error: data.error };
    } catch { return { success: false, error: "Erreur reseau" }; }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Calendar className="h-6 w-6" />
            Calendrier
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Disponibilites et rendez-vous</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setSlotDate(""); setCreateSlotOpen(true); }}>
            <Plus className="h-3.5 w-3.5" /> Disponibilite
          </Button>
          <Button size="sm" onClick={() => { setApptClientId(""); setApptSubject(""); setCreateApptOpen(true); }}>
            <Plus className="h-3.5 w-3.5" /> Rendez-vous
          </Button>
        </div>
      </div>

      {/* ── KPIs ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Disponibles" value={availableCount} icon={Clock} accent="bg-emerald-500" />
        <StatCard label="Reserves" value={bookedCount} icon={CheckCircle2} accent="bg-blue-500" />
        <StatCard label="A venir" value={upcomingAppts} icon={Calendar} accent="bg-violet-500" />
      </div>

      {/* ── Navigation semaine ────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>
            Aujourd&apos;hui
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <span className="text-sm font-medium">{periodLabel}</span>
      </div>

      {/* ── Grille semaine ────────────────────────────────── */}
      <Card className="overflow-hidden">
        {/* Header jours */}
        <div className="grid grid-cols-7 border-b">
          {days.map((d, i) => {
            const isToday = isSameDay(d, today);
            return (
              <div
                key={i}
                className={cn(
                  "p-3 text-center border-r last:border-0",
                  isToday && "bg-primary/5"
                )}
              >
                <div className="text-[10px] uppercase text-muted-foreground font-semibold">
                  {DAYS_FR[d.getDay()]}
                </div>
                <div className={cn(
                  "text-lg font-bold mt-0.5",
                  isToday && "text-primary"
                )}>
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Contenu jours */}
        <div className="grid grid-cols-7 min-h-[450px]">
          {days.map((d, i) => {
            const dateStr = d.toISOString().split("T")[0];
            const daySlots = slots.filter((s) => s.slotDate.startsWith(dateStr));
            const dayAppts = appointments.filter((a) => a.appointmentDate.startsWith(dateStr));
            const isToday = isSameDay(d, today);

            return (
              <div
                key={i}
                className={cn(
                  "border-r last:border-0 p-1.5 space-y-1 overflow-y-auto",
                  isToday && "bg-primary/5"
                )}
              >
                {/* Slots */}
                {daySlots.map((s) => (
                  <div
                    key={`s-${s.id}`}
                    className={cn(
                      "rounded-md p-1.5 text-[10px] leading-tight",
                      s.status === "available" && "bg-emerald-50 border border-emerald-200 text-emerald-700",
                      s.status === "blocked" && "bg-violet-50 border border-violet-200 text-violet-700",
                      s.status === "booked" && "bg-blue-50 border border-blue-200 text-blue-700"
                    )}
                  >
                    <div className="font-semibold flex items-center gap-1">
                      {s.status === "blocked" && <Lock className="h-2.5 w-2.5" />}
                      {s.startTime}-{s.endTime}
                    </div>
                    <div className="capitalize">{s.status === "available" ? "Dispo" : s.status === "blocked" ? "Bloque" : "Reserve"}</div>
                  </div>
                ))}

                {/* RDV */}
                {dayAppts.map((a) => {
                  const MeetIcon = MEETING_ICONS[a.meetingType] ?? Video;
                  return (
                    <div
                      key={`a-${a.id}`}
                      className="rounded-md bg-primary/10 border-l-2 border-primary p-1.5 text-[10px] leading-tight"
                    >
                      <div className="font-semibold flex items-center gap-1">
                        <MeetIcon className="h-2.5 w-2.5" />
                        {a.startTime}
                      </div>
                      <div className="truncate font-medium">{a.clientName}</div>
                      {a.subject && <div className="truncate text-muted-foreground">{a.subject}</div>}
                    </div>
                  );
                })}

                {daySlots.length === 0 && dayAppts.length === 0 && (
                  <div className="h-full flex items-center justify-center">
                    <span className="text-[10px] text-muted-foreground/40">—</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Legende ───────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Disponible
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Reserve
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> Bloque
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Rendez-vous
        </span>
      </div>

      {/* ── Modale creation slot ──────────────────────────── */}
      <CreateModal
        open={createSlotOpen}
        onOpenChange={setCreateSlotOpen}
        title="Ajouter une disponibilite"
        icon={Clock}
        accent="bg-emerald-500"
        submitLabel="Creer"
        onSubmit={handleCreateSlot}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slot-date">Date *</Label>
            <Input id="slot-date" type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="slot-start">Debut</Label>
              <Input id="slot-start" type="time" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slot-end">Fin</Label>
              <Input id="slot-end" type="time" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={slotStatus} onValueChange={(v) => setSlotStatus(v as "available" | "blocked")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Disponible</SelectItem>
                <SelectItem value="blocked">Bloque</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CreateModal>

      {/* ── Modale creation RDV ───────────────────────────── */}
      <CreateModal
        open={createApptOpen}
        onOpenChange={setCreateApptOpen}
        title="Nouveau rendez-vous"
        icon={Calendar}
        accent="bg-blue-500"
        submitLabel="Creer le rendez-vous"
        onSubmit={handleCreateAppt}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select value={apptClientId} onValueChange={setApptClientId}>
              <SelectTrigger><SelectValue placeholder="Selectionner" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.fullName}{c.companyName ? ` — ${c.companyName}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="appt-date">Date *</Label>
            <Input id="appt-date" type="date" value={apptDate} onChange={(e) => setApptDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="appt-start">Debut</Label>
              <Input id="appt-start" type="time" value={apptStart} onChange={(e) => setApptStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appt-end">Fin</Label>
              <Input id="appt-end" type="time" value={apptEnd} onChange={(e) => setApptEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="appt-subject">Sujet</Label>
            <Input id="appt-subject" value={apptSubject} onChange={(e) => setApptSubject(e.target.value)} placeholder="Objet du rendez-vous" />
          </div>
          <div className="space-y-2">
            <Label>Type de reunion</Label>
            <Select value={apptType} onValueChange={setApptType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="video">Reunion video</SelectItem>
                <SelectItem value="phone">Appel telephonique</SelectItem>
                <SelectItem value="onsite">Presentiel</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CreateModal>
    </div>
  );
}
