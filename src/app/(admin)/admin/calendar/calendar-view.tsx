"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, Video, Phone, MapPin, Lock, CheckCircle2,
  CalendarDays, CalendarRange, X, Sparkles, Repeat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatCard } from "@/components/admin/stat-card";
import { FormSection } from "@/components/admin/client-form-fields";
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { useConfirm } from "@/hooks/use-confirm";
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

type ViewMode = "day" | "week" | "month";

const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const MEETING_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  video: Video,
  phone: Phone,
  onsite: MapPin,
};

// Sujets predefinis pour les RDV (alignes avec services VNK)
const SUBJECT_OPTIONS = [
  "Consultation initiale",
  "Audit PLC / Automate",
  "Démo SCADA / HMI",
  "Programmation PLC",
  "Modernisation système",
  "Formation",
  "Suivi de mandat",
  "Support technique",
  "Présentation devis",
  "Validation contrat",
];

// SubjectPicker — dropdown avec preset + option custom
function SubjectPicker({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const isCustom = value !== "" && !SUBJECT_OPTIONS.includes(value);
  const [showCustom, setShowCustom] = useState(isCustom);

  return (
    <div className="space-y-2">
      <Select
        value={isCustom ? "__custom__" : value || "__none__"}
        onValueChange={(v) => {
          if (v === "__custom__") { setShowCustom(true); onChange(""); }
          else if (v === "__none__") { setShowCustom(false); onChange(""); }
          else { setShowCustom(false); onChange(v); }
        }}
      >
        <SelectTrigger><SelectValue placeholder={placeholder ?? "Choisir un sujet"} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Aucun sujet</SelectItem>
          {SUBJECT_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          <SelectItem value="__custom__">+ Autre (personnalisé)</SelectItem>
        </SelectContent>
      </Select>
      {showCustom && (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Sujet personnalisé" autoFocus />
      )}
    </div>
  );
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function ymd(d: Date): string {
  return d.toISOString().split("T")[0];
}

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
  const { open: openEntity } = useEntityPanels();
  const { confirm, ConfirmModal } = useConfirm();

  // Date selectionnee (centre la vue jour/semaine/mois)
  const [selectedDate, setSelectedDate] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [createSlotOpen, setCreateSlotOpen] = useState(false);
  const [createApptOpen, setCreateApptOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [presetSlotId, setPresetSlotId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false); // anti-double-clic sur modaux

  // Sticky scroll detection (pattern dashboard finance)
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // KPIs
  const availableCount = slots.filter((s) => s.status === "available").length;
  const bookedCount = slots.filter((s) => s.status === "booked").length;
  const upcomingAppts = appointments.filter((a) => new Date(a.appointmentDate) >= today && a.status === "confirmed").length;
  const cancelledCount = appointments.filter((a) => a.status === "cancelled").length;

  // Navigation
  const goPrev = () => {
    const d = new Date(selectedDate);
    if (viewMode === "day") d.setDate(d.getDate() - 1);
    else if (viewMode === "week") d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setSelectedDate(d);
  };
  const goNext = () => {
    const d = new Date(selectedDate);
    if (viewMode === "day") d.setDate(d.getDate() + 1);
    else if (viewMode === "week") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setSelectedDate(d);
  };
  const goToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); setSelectedDate(d); };

  // Periode label
  const periodLabel = useMemo(() => {
    if (viewMode === "day") {
      return selectedDate.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    }
    if (viewMode === "week") {
      const start = getWeekStart(selectedDate);
      const end = new Date(start); end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString("fr-CA", { day: "numeric", month: "short" })} — ${end.toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" })}`;
    }
    return `${MONTHS_FR[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  }, [selectedDate, viewMode]);

  // ── Slot creation (avec assignation directe a un client optionnelle) ─
  const [slotDate, setSlotDate] = useState("");
  const [slotStart, setSlotStart] = useState("09:00");
  const [slotEnd, setSlotEnd] = useState("17:00");
  const [slotStatus, setSlotStatus] = useState<"available" | "blocked">("available");
  const [slotNotes, setSlotNotes] = useState("");
  const [slotClientId, setSlotClientId] = useState(""); // si non vide -> reservation directe (cree un RDV)
  const [slotSubject, setSlotSubject] = useState("");
  const [slotMeetingType, setSlotMeetingType] = useState("video");

  // Helper : ajoute 30 min a une heure HH:MM
  const addMinutes = (time: string, mins: number): string => {
    const [h, m] = time.split(":").map(Number);
    const total = h * 60 + m + mins;
    const nh = Math.floor(total / 60);
    const nm = total % 60;
    return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
  };

  const openCreateSlot = (preset?: { date?: string; startTime?: string }) => {
    setSlotDate(preset?.date ?? ymd(selectedDate));
    const start = preset?.startTime ?? "09:00";
    setSlotStart(start);
    // Si une heure precise a ete cliquee -> defaut 30min, sinon journee 9h-17h
    setSlotEnd(preset?.startTime ? addMinutes(start, 30) : "17:00");
    setSlotStatus("available");
    setSlotNotes("");
    setSlotClientId("");
    setSlotSubject("");
    setSlotMeetingType("video");
    setCreateSlotOpen(true);
  };

  const handleCreateSlot = async () => {
    if (submitting) return;
    if (!slotDate) { toast.error("Date requise"); return; }
    if (slotEnd <= slotStart) { toast.error("L'heure de fin doit être après l'heure de début"); return; }
    setSubmitting(true);
    try {

    // Si un client est selectionne, on cree directement un RDV (au lieu d'un slot disponible)
    if (slotClientId) {
      const client = clients.find((c) => c.id === Number(slotClientId));
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: Number(slotClientId),
          clientName: client?.fullName ?? "",
          clientEmail: client?.email,
          appointmentDate: slotDate,
          startTime: slotStart,
          endTime: slotEnd,
          subject: slotSubject.trim() || undefined,
          meetingType: slotMeetingType,
          notesAdmin: slotNotes.trim() || undefined,
        }),
      });
      if (res.ok) {
        toast.success("Rendez-vous créé pour " + (client?.fullName ?? "le client"));
        setCreateSlotOpen(false);
        router.refresh();
      } else {
        const d = await res.json();
        toast.error(d.error || "Erreur");
      }
      return;
    }

    // Sinon : creation d'une simple disponibilite (ouverte aux reservations)
    const res = await fetch("/api/calendar/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotDate, startTime: slotStart, endTime: slotEnd, status: slotStatus, notes: slotNotes.trim() || undefined }),
    });
    if (res.ok) {
      toast.success("Créneau créé");
      setCreateSlotOpen(false);
      router.refresh();
    } else {
      const d = await res.json();
      toast.error(d.error || "Erreur");
    }
    } finally { setSubmitting(false); }
  };

  // ── Appointment creation ─────────────────────────────────
  const [apptClientId, setApptClientId] = useState("");
  const [apptDate, setApptDate] = useState("");
  const [apptStart, setApptStart] = useState("09:00");
  const [apptEnd, setApptEnd] = useState("09:30");
  const [apptSubject, setApptSubject] = useState("");
  const [apptType, setApptType] = useState("video");
  const [apptLink, setApptLink] = useState("");
  const [apptNotes, setApptNotes] = useState("");

  const openCreateAppt = (preset?: { date?: string; startTime?: string; slotId?: number }) => {
    setApptClientId("");
    setApptDate(preset?.date ?? ymd(selectedDate));
    const start = preset?.startTime ?? "09:00";
    setApptStart(start);
    setApptEnd(addMinutes(start, 30));
    setApptSubject(""); setApptType("video"); setApptLink(""); setApptNotes("");
    setPresetSlotId(preset?.slotId ?? null);
    setCreateApptOpen(true);
  };

  const handleCreateAppt = async () => {
    if (submitting) return;
    if (!apptClientId || !apptDate) { toast.error("Client et date requis"); return; }
    if (apptEnd <= apptStart) { toast.error("L'heure de fin doit être après l'heure de début"); return; }
    setSubmitting(true);
    try {
    const client = clients.find((c) => c.id === Number(apptClientId));
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slotId: presetSlotId ?? undefined, // lie au creneau pour qu'il passe a "booked"
        clientId: Number(apptClientId),
        clientName: client?.fullName ?? "",
        clientEmail: client?.email,
        appointmentDate: apptDate,
        startTime: apptStart,
        endTime: apptEnd,
        subject: apptSubject.trim() || undefined,
        meetingType: apptType,
        meetingLink: apptLink.trim() || undefined,
        notesAdmin: apptNotes.trim() || undefined,
      }),
    });
    if (res.ok) {
      toast.success("Rendez-vous créé");
      setCreateApptOpen(false);
      setPresetSlotId(null);
      router.refresh();
    } else {
      const d = await res.json();
      toast.error(d.error || "Erreur");
    }
    } finally { setSubmitting(false); }
  };

  // ── Bulk creation (recurrence) ───────────────────────────
  const [bulkFrom, setBulkFrom] = useState("");
  const [bulkTo, setBulkTo] = useState("");
  const [bulkStart, setBulkStart] = useState("09:00");
  const [bulkEnd, setBulkEnd] = useState("17:00");
  const [bulkDays, setBulkDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5])); // Mon-Fri par defaut

  const openBulk = () => {
    const d = new Date(selectedDate);
    setBulkFrom(ymd(d));
    const end = new Date(d); end.setDate(d.getDate() + 28);
    setBulkTo(ymd(end));
    setBulkStart("09:00"); setBulkEnd("17:00");
    setBulkDays(new Set([1, 2, 3, 4, 5]));
    setBulkOpen(true);
  };

  const handleBulkCreate = async () => {
    if (submitting) return;
    if (!bulkFrom || !bulkTo || bulkDays.size === 0) {
      toast.error("Plage de dates et jours de la semaine requis"); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/calendar/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bulk: true,
          fromDate: bulkFrom,
          toDate: bulkTo,
          daysOfWeek: Array.from(bulkDays),
          startTime: bulkStart,
          endTime: bulkEnd,
          status: "available",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.count} créneaux générés`);
        setBulkOpen(false);
        router.refresh();
      } else {
        const d = await res.json();
        toast.error(d.error || "Erreur");
      }
    } finally { setSubmitting(false); }
  };

  // ── Slot actions ─────────────────────────────────────────
  const deleteSlot = async (slot: Slot) => {
    const ok = await confirm({
      title: "Supprimer ce créneau ?",
      description: "Le créneau sera supprimé. Si lié à un RDV confirmé, l'opération sera bloquée.",
      confirmLabel: "Supprimer",
      variant: "destructive",
    });
    if (!ok) return;
    const res = await fetch(`/api/calendar/slots/${slot.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Créneau supprimé"); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || "Erreur"); }
  };

  const toggleSlotStatus = async (slot: Slot) => {
    const newStatus = slot.status === "available" ? "blocked" : "available";
    const res = await fetch(`/api/calendar/slots/${slot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) { toast.success(newStatus === "blocked" ? "Créneau bloqué" : "Créneau libéré"); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || "Erreur"); }
  };

  // ── Vue helpers ──────────────────────────────────────────
  // Filtre les slots booked (l'appointment lie est plus informatif)
  const slotsByDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      if (s.status === "booked") continue;
      const k = s.slotDate.split("T")[0];
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return map;
  }, [slots]);

  const apptsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    const seen = new Set<number>(); // dedup defensif par id
    for (const a of appointments) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      const k = a.appointmentDate.split("T")[0];
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(a);
    }
    return map;
  }, [appointments]);

  // Mini calendrier (mois en cours) — affichage des jours du mois avec indicateurs
  const miniCalendarDays = useMemo(() => {
    const start = getMonthStart(selectedDate);
    const startWeekday = start.getDay();
    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const cells: Array<{ date: Date | null; inMonth: boolean }> = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ date: null, inMonth: false });
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(start); d.setDate(i);
      cells.push({ date: d, inMonth: true });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, inMonth: false });
    return cells;
  }, [selectedDate]);

  // Vue semaine : 7 jours autour de selectedDate
  const weekDays = useMemo(() => {
    const start = getWeekStart(selectedDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  // Vue mois : 6 semaines de cellules
  const monthCells = useMemo(() => {
    const start = getMonthStart(selectedDate);
    const startWeekday = start.getDay();
    const cells: Date[] = [];
    const cursor = new Date(start);
    cursor.setDate(cursor.getDate() - startWeekday);
    for (let i = 0; i < 42; i++) {
      cells.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return cells;
  }, [selectedDate]);

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100dvh-6.5rem)]">
      {/* Hero VNK */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <CalendarIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Calendrier</h1>
              <p className="text-white/70 text-sm mt-0.5">Disponibilités et rendez-vous client</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="bg-white/15 backdrop-blur hover:bg-white/25 text-white border border-white/20"
              onClick={openBulk}>
              <Repeat className="h-3.5 w-3.5" />Récurrence
            </Button>
            <Button size="sm" className="bg-white/15 backdrop-blur hover:bg-white/25 text-white border border-white/20"
              onClick={() => openCreateSlot()}>
              <Plus className="h-3.5 w-3.5" />Disponibilité
            </Button>
            <Button size="sm" className="bg-white text-[#0F2D52] hover:bg-white/90 font-semibold"
              onClick={() => openCreateAppt()}>
              <Plus className="h-3.5 w-3.5" />Rendez-vous
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Disponibles" value={availableCount} icon={Clock} accent="bg-emerald-500" />
        <StatCard label="Réservés" value={bookedCount} icon={CheckCircle2} accent="bg-blue-500" />
        <StatCard label="À venir" value={upcomingAppts} icon={CalendarIcon} accent="bg-violet-500" />
        <StatCard label="Annulés" value={cancelledCount} icon={X} accent="bg-red-500" />
      </div>

      {/* Sentinel + Sticky compact bar (pattern dashboard finance) */}
      <div ref={sentinelRef} aria-hidden className="h-px -mt-3" />
      {scrolled && (
        <div className="sticky top-[64px] z-20 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 bg-background/95 backdrop-blur shadow-sm border-b">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <CalendarIcon className="h-4 w-4" />
              Calendrier
            </span>
            <span className="text-muted-foreground">Disponibles <span className="font-semibold text-emerald-600">{availableCount}</span></span>
            <span className="text-muted-foreground">Réservés <span className="font-semibold text-blue-600">{bookedCount}</span></span>
            <span className="text-muted-foreground">À venir <span className="font-semibold text-violet-600">{upcomingAppts}</span></span>
            {cancelledCount > 0 && <span className="text-muted-foreground">Annulés <span className="font-semibold text-red-600">{cancelledCount}</span></span>}
          </div>
        </div>
      )}

      {/* Toolbar : navigation + toggle vue */}
      <div className="flex items-center justify-between gap-2 flex-wrap shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goPrev} aria-label="Précédent">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>Aujourd&apos;hui</Button>
          <Button variant="outline" size="sm" onClick={goNext} aria-label="Suivant">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium ml-2 capitalize">{periodLabel}</span>
        </div>
        <div className="flex bg-muted rounded-lg p-0.5">
          {(["day", "week", "month"] as const).map((mode) => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5",
                viewMode === mode ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {mode === "day" ? <CalendarDays className="h-3 w-3" /> : mode === "week" ? <CalendarRange className="h-3 w-3" /> : <CalendarIcon className="h-3 w-3" />}
              {mode === "day" ? "Jour" : mode === "week" ? "Semaine" : "Mois"}
            </button>
          ))}
        </div>
      </div>

      {/* Grille principale : mini calendrier (sidebar) + vue principale */}
      {/* Mobile/tablette : scroll de page natural — Desktop (lg+) : flex-1 min-h-0 + scroll interne */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 lg:flex-1 lg:min-h-0 lg:overflow-hidden">
        {/* Mini calendar — sidebar */}
        <Card className="p-3 h-fit lg:max-h-full lg:overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold capitalize">{MONTHS_FR[selectedDate.getMonth()]} {selectedDate.getFullYear()}</p>
            <div className="flex gap-1">
              <button onClick={() => { const d = new Date(selectedDate); d.setMonth(d.getMonth() - 1); setSelectedDate(d); }}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted" aria-label="Mois précédent">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => { const d = new Date(selectedDate); d.setMonth(d.getMonth() + 1); setSelectedDate(d); }}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted" aria-label="Mois suivant">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-[10px] text-muted-foreground font-semibold mb-1">
            {DAYS_FR.map((d) => <div key={d} className="h-6 flex items-center justify-center">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {miniCalendarDays.map((cell, i) => {
              if (!cell.date) return <div key={i} className="h-7" />;
              const k = ymd(cell.date);
              const hasSlots = slotsByDate.has(k);
              const hasAppts = apptsByDate.has(k);
              const isToday = isSameDay(cell.date, today);
              const isSelected = isSameDay(cell.date, selectedDate);
              return (
                <button key={i} onClick={() => setSelectedDate(cell.date!)}
                  className={cn(
                    "h-7 text-xs rounded relative flex items-center justify-center transition-colors",
                    isSelected ? "bg-[#0F2D52] text-white font-bold"
                      : isToday ? "bg-[#0F2D52]/10 text-[#0F2D52] font-bold"
                      : "hover:bg-muted text-foreground"
                  )}>
                  {cell.date.getDate()}
                  {(hasSlots || hasAppts) && (
                    <span className={cn("absolute bottom-0.5 h-1 w-1 rounded-full", isSelected ? "bg-white" : "bg-[#0F2D52]")} />
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t space-y-1.5 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Disponible</div>
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />Réservé</div>
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-500" />Bloqué</div>
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#0F2D52]" />RDV</div>
          </div>
        </Card>

        {/* Vue principale */}
        {viewMode === "day" && (
          <DayView date={selectedDate} slots={slotsByDate.get(ymd(selectedDate)) ?? []}
            appts={apptsByDate.get(ymd(selectedDate)) ?? []}
            onSlotClick={(s, action) => {
              if (action === "delete") deleteSlot(s);
              else if (action === "toggle") toggleSlotStatus(s);
              else if (action === "book") openCreateAppt({ date: ymd(selectedDate), startTime: s.startTime, slotId: s.id });
            }}
            onApptClick={(a) => openEntity("appointment", a.id)}
            onEmptyClick={(time) => openCreateSlot({ date: ymd(selectedDate), startTime: time })}
          />
        )}

        {viewMode === "week" && (
          <WeekView days={weekDays} slotsByDate={slotsByDate} apptsByDate={apptsByDate} today={today}
            onSlotClick={(s, action) => {
              if (action === "delete") deleteSlot(s);
              else if (action === "toggle") toggleSlotStatus(s);
              else if (action === "book") openCreateAppt({ date: s.slotDate.split("T")[0], startTime: s.startTime, slotId: s.id });
            }}
            onApptClick={(a) => openEntity("appointment", a.id)}
            onEmptyClick={(date, time) => openCreateSlot({ date: ymd(date), startTime: time })}
          />
        )}

        {viewMode === "month" && (
          <MonthView cells={monthCells} currentMonth={selectedDate.getMonth()} slotsByDate={slotsByDate} apptsByDate={apptsByDate} today={today}
            onDayClick={(date) => { setSelectedDate(date); setViewMode("day"); }}
          />
        )}
      </div>

      {ConfirmModal}

      {/* Modal creation slot — VNK navy avec assignation directe optionnelle */}
      <Dialog open={createSlotOpen} onOpenChange={setCreateSlotOpen}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
          <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-5 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-white">
                  {slotClientId ? "Réservation directe" : "Nouvelle disponibilité"}
                </DialogTitle>
                <DialogDescription className="text-white/70 mt-0.5">
                  {slotClientId ? "Réserver ce créneau pour un client spécifique" : "Bloque un créneau ou assigne directement à un client"}
                </DialogDescription>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-muted/30">
            <FormSection title="Créneau" icon={<Clock className="h-3.5 w-3.5" />}>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date *</Label>
                <Input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Début</Label>
                  <Input type="time" value={slotStart} onChange={(e) => {
                    setSlotStart(e.target.value);
                    // Auto-ajuste fin a +30 min si l'utilisateur tape un debut precis
                    if (slotEnd === "17:00" || slotEnd <= e.target.value) {
                      setSlotEnd(addMinutes(e.target.value, 30));
                    }
                  }} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fin</Label>
                  <Input type="time" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} />
                </div>
              </div>
              {!slotClientId && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type</Label>
                  <Select value={slotStatus} onValueChange={(v) => setSlotStatus(v as "available" | "blocked")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Disponible (réservable)</SelectItem>
                      <SelectItem value="blocked">Bloqué (non disponible)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </FormSection>

            <FormSection title="Réserver pour un client (optionnel)" icon={<Sparkles className="h-3.5 w-3.5" />}>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Client</Label>
                <Select value={slotClientId || "__none__"} onValueChange={(v) => setSlotClientId(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Aucun (créneau ouvert)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucun — créneau ouvert</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.fullName}{c.companyName ? ` — ${c.companyName}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!slotClientId && (
                  <p className="text-[10px] text-muted-foreground italic">
                    Si tu sélectionnes un client, un rendez-vous sera créé directement à la place d&apos;une disponibilité ouverte.
                  </p>
                )}
              </div>
              {slotClientId && (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Sujet du rendez-vous</Label>
                    <SubjectPicker value={slotSubject} onChange={setSlotSubject} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type de réunion</Label>
                    <Select value={slotMeetingType} onValueChange={setSlotMeetingType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="video">Réunion vidéo</SelectItem>
                        <SelectItem value="phone">Appel téléphonique</SelectItem>
                        <SelectItem value="onsite">Présentiel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </FormSection>

            <FormSection title="Notes" icon={<Sparkles className="h-3.5 w-3.5" />}>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  {slotClientId ? "Notes admin (privées)" : "Notes (optionnel)"}
                </Label>
                <Input value={slotNotes} onChange={(e) => setSlotNotes(e.target.value)}
                  placeholder={slotClientId ? "Notes internes" : "Ex : matinée disponible"} />
              </div>
            </FormSection>
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-card shrink-0 sm:gap-2">
            <Button variant="outline" onClick={() => setCreateSlotOpen(false)} disabled={submitting}>Annuler</Button>
            <Button onClick={handleCreateSlot} disabled={submitting} className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white shadow-md">
              {submitting ? "Création…" : (slotClientId ? "Créer le rendez-vous" : "Créer le créneau")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal creation RDV — VNK navy */}
      <Dialog open={createApptOpen} onOpenChange={setCreateApptOpen}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
          <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-5 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <CalendarIcon className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-white">Nouveau rendez-vous</DialogTitle>
                <DialogDescription className="text-white/70 mt-0.5">
                  {presetSlotId ? "Réservation sur un créneau existant" : "Réservation manuelle"}
                </DialogDescription>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-muted/30">
            <FormSection title="Client & timing" icon={<CalendarIcon className="h-3.5 w-3.5" />}>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Client *</Label>
                <Select value={apptClientId} onValueChange={setApptClientId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
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
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date *</Label>
                <Input type="date" value={apptDate} onChange={(e) => setApptDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Début</Label>
                  <Input type="time" value={apptStart} onChange={(e) => setApptStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fin</Label>
                  <Input type="time" value={apptEnd} onChange={(e) => setApptEnd(e.target.value)} />
                </div>
              </div>
            </FormSection>
            <FormSection title="Détails" icon={<Sparkles className="h-3.5 w-3.5" />}>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Sujet du rendez-vous</Label>
                <SubjectPicker value={apptSubject} onChange={setApptSubject} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type de réunion</Label>
                <Select value={apptType} onValueChange={setApptType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Réunion vidéo</SelectItem>
                    <SelectItem value="phone">Appel téléphonique</SelectItem>
                    <SelectItem value="onsite">Présentiel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Lien (optionnel)</Label>
                <Input value={apptLink} onChange={(e) => setApptLink(e.target.value)} placeholder="https://meet.google.com/…" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes admin (privées)</Label>
                <Textarea value={apptNotes} onChange={(e) => setApptNotes(e.target.value)} rows={2} placeholder="Notes internes" />
              </div>
            </FormSection>
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-card shrink-0 sm:gap-2">
            <Button variant="outline" onClick={() => setCreateApptOpen(false)} disabled={submitting}>Annuler</Button>
            <Button onClick={handleCreateAppt} disabled={submitting} className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white shadow-md">
              {submitting ? "Création…" : "Créer le rendez-vous"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal recurrence — bulk creation */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <Repeat className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-white">Génération récurrente</DialogTitle>
                <DialogDescription className="text-white/70 mt-0.5">Crée plusieurs disponibilités d&apos;un coup</DialogDescription>
              </div>
            </div>
          </div>
          <div className="px-6 py-5 space-y-4 bg-muted/30">
            <FormSection title="Plage de dates" icon={<CalendarIcon className="h-3.5 w-3.5" />}>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Du</Label>
                  <Input type="date" value={bulkFrom} onChange={(e) => setBulkFrom(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Au</Label>
                  <Input type="date" value={bulkTo} onChange={(e) => setBulkTo(e.target.value)} />
                </div>
              </div>
            </FormSection>
            <FormSection title="Jours et heures" icon={<Clock className="h-3.5 w-3.5" />}>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Jours de la semaine</Label>
                <div className="flex flex-wrap gap-1">
                  {DAYS_FR.map((d, i) => {
                    const isOn = bulkDays.has(i);
                    return (
                      <button key={i} type="button"
                        onClick={() => {
                          const set = new Set(bulkDays);
                          if (isOn) set.delete(i); else set.add(i);
                          setBulkDays(set);
                        }}
                        className={cn("px-3 py-1.5 rounded-md border text-xs font-medium transition-colors",
                          isOn ? "border-[#0F2D52] bg-[#0F2D52] text-white" : "border-input hover:bg-muted")}>
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Début</Label>
                  <Input type="time" value={bulkStart} onChange={(e) => setBulkStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fin</Label>
                  <Input type="time" value={bulkEnd} onChange={(e) => setBulkEnd(e.target.value)} />
                </div>
              </div>
            </FormSection>
            <div className="rounded-lg bg-[#0F2D52]/5 border border-[#0F2D52]/10 p-3 text-xs text-muted-foreground">
              Les créneaux seront créés comme <strong className="text-foreground">disponibles</strong>. Les doublons (même date/heure) sont ignorés.
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-card sm:gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={submitting}>Annuler</Button>
            <Button onClick={handleBulkCreate} disabled={submitting} className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white shadow-md">
              <Repeat className="h-4 w-4 mr-1.5" />{submitting ? "Génération…" : "Générer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Helper : genere les creneaux 30min de 7h a 19h ───
function buildTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 7; h < 19; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  slots.push("19:00");
  return slots;
}

// Helper : retourne true si une heure HH:MM tombe dans un creneau de 30min
function inHalfHour(time: string, slotTime: string): boolean {
  if (!time || !slotTime) return false;
  const [th, tm] = time.split(":").map(Number);
  const [sh, sm] = slotTime.split(":").map(Number);
  const total = th * 60 + tm;
  const slotTotal = sh * 60 + sm;
  return total >= slotTotal && total < slotTotal + 30;
}

// ─── Vue Jour ─────────────────────────────────────────────

function DayView({
  date, slots, appts, onSlotClick, onApptClick, onEmptyClick,
}: {
  date: Date;
  slots: Slot[];
  appts: Appointment[];
  onSlotClick: (s: Slot, action: "delete" | "toggle" | "book") => void;
  onApptClick: (a: Appointment) => void;
  onEmptyClick: (time: string) => void;
}) {
  const timeSlots = buildTimeSlots();
  return (
    <Card className="flex flex-col min-h-[600px] lg:h-full lg:min-h-0 overflow-hidden">
      {/* Header non-scrollable */}
      <div className="bg-card border-b px-4 py-3 shrink-0 shadow-sm">
        <p className="text-sm font-semibold capitalize">
          {date.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>
      {/* Contenu scrollable */}
      <div className="flex-1 overflow-y-auto divide-y">
        {timeSlots.slice(0, -1).map((time) => {
          const slotsAt = slots.filter((s) => inHalfHour(s.startTime, time));
          const apptsAt = appts.filter((a) => inHalfHour(a.startTime, time));
          const empty = slotsAt.length === 0 && apptsAt.length === 0;
          const isHourMark = time.endsWith(":00");
          return (
            <div key={time} className={cn("flex items-stretch min-h-[40px]", isHourMark && "bg-muted/10")}>
              <div className={cn(
                "w-16 shrink-0 px-3 py-1 text-[11px] font-mono text-muted-foreground border-r flex items-start",
                isHourMark ? "bg-muted/30 font-semibold" : "bg-muted/10"
              )}>
                {time}
              </div>
              <div className="flex-1 p-1 space-y-1">
                {empty ? (
                  <button onClick={() => onEmptyClick(time)}
                    className="w-full h-full min-h-[32px] rounded-md border border-dashed border-transparent hover:border-[#0F2D52]/30 hover:bg-[#0F2D52]/5 transition-colors flex items-center justify-center text-[10px] text-muted-foreground/40 hover:text-[#0F2D52]">
                    + Ajouter
                  </button>
                ) : (
                  <>
                    {slotsAt.map((s) => <SlotChip key={`s-${s.id}`} slot={s} onAction={onSlotClick} />)}
                    {apptsAt.map((a) => <ApptChip key={`a-${a.id}`} appt={a} onClick={onApptClick} />)}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Vue Semaine — grille horaire avec heures a gauche ──

function WeekView({
  days, slotsByDate, apptsByDate, today, onSlotClick, onApptClick, onEmptyClick,
}: {
  days: Date[];
  slotsByDate: Map<string, Slot[]>;
  apptsByDate: Map<string, Appointment[]>;
  today: Date;
  onSlotClick: (s: Slot, action: "delete" | "toggle" | "book") => void;
  onApptClick: (a: Appointment) => void;
  onEmptyClick: (date: Date, time?: string) => void;
}) {
  const timeSlots = buildTimeSlots();
  return (
    <Card className="flex flex-col min-h-[600px] lg:h-full lg:min-h-0 overflow-hidden">
      {/* Header non-scrollable : 1 colonne heures + 7 colonnes jours */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-card shrink-0 shadow-sm">
        <div className="bg-muted/30" />
        {days.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div key={i} className={cn("p-2 text-center border-l", isToday && "bg-[#0F2D52]/5")}>
              <div className="text-[10px] uppercase text-muted-foreground font-semibold">{DAYS_FR[d.getDay()]}</div>
              <div className={cn("text-lg font-bold mt-0.5", isToday && "text-[#0F2D52]")}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>
      {/* Body scrollable : lignes 30min */}
      <div className="flex-1 overflow-y-auto">
        {timeSlots.slice(0, -1).map((time) => {
          const isHourMark = time.endsWith(":00");
          return (
            <div key={time} className={cn(
              "grid grid-cols-[60px_repeat(7,1fr)] border-b min-h-[36px]",
              isHourMark && "border-t border-t-muted-foreground/10"
            )}>
              {/* Colonne heures */}
              <div className={cn(
                "px-2 py-0.5 text-[10px] font-mono text-muted-foreground border-r flex items-start",
                isHourMark ? "bg-muted/30 font-semibold" : "bg-muted/10"
              )}>
                {time}
              </div>
              {/* 7 colonnes jours */}
              {days.map((d, i) => {
                const k = ymd(d);
                const daySlots = slotsByDate.get(k) ?? [];
                const dayAppts = apptsByDate.get(k) ?? [];
                const slotsAt = daySlots.filter((s) => inHalfHour(s.startTime, time));
                const apptsAt = dayAppts.filter((a) => inHalfHour(a.startTime, time));
                const empty = slotsAt.length === 0 && apptsAt.length === 0;
                const isToday = isSameDay(d, today);
                return (
                  <div key={i} className={cn(
                    "p-0.5 space-y-0.5 border-l overflow-hidden",
                    isToday && "bg-[#0F2D52]/[0.03]"
                  )}>
                    {empty ? (
                      <button onClick={() => onEmptyClick(d, time)}
                        className="w-full h-full min-h-[32px] rounded border border-dashed border-transparent hover:border-[#0F2D52]/30 hover:bg-[#0F2D52]/5 transition-colors flex items-center justify-center text-[9px] text-muted-foreground/0 hover:text-[#0F2D52]">
                        +
                      </button>
                    ) : (
                      <>
                        {slotsAt.map((s) => <SlotChip key={`s-${s.id}`} slot={s} onAction={onSlotClick} compact />)}
                        {apptsAt.map((a) => <ApptChip key={`a-${a.id}`} appt={a} onClick={onApptClick} compact />)}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Vue Mois ─────────────────────────────────────────────

function MonthView({
  cells, currentMonth, slotsByDate, apptsByDate, today, onDayClick,
}: {
  cells: Date[];
  currentMonth: number;
  slotsByDate: Map<string, Slot[]>;
  apptsByDate: Map<string, Appointment[]>;
  today: Date;
  onDayClick: (d: Date) => void;
}) {
  return (
    <Card className="flex flex-col min-h-[600px] lg:h-full lg:min-h-0 overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/30 shrink-0 shadow-sm">
        {DAYS_FR.map((d) => (
          <div key={d} className="p-2 text-center text-[10px] uppercase font-semibold text-muted-foreground border-r last:border-0">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6 flex-1 overflow-y-auto">
        {cells.map((d, i) => {
          const k = ymd(d);
          const daySlots = slotsByDate.get(k) ?? [];
          const dayAppts = apptsByDate.get(k) ?? [];
          const isToday = isSameDay(d, today);
          const inMonth = d.getMonth() === currentMonth;
          return (
            <button key={i} onClick={() => onDayClick(d)}
              className={cn(
                "border-r border-b last:border-r-0 p-1.5 text-left min-h-[80px] hover:bg-[#0F2D52]/5 transition-colors",
                !inMonth && "bg-muted/20 text-muted-foreground/50",
                isToday && "bg-[#0F2D52]/10",
              )}>
              <div className={cn("text-xs font-bold mb-1", isToday && "text-[#0F2D52]")}>
                {d.getDate()}
              </div>
              <div className="space-y-0.5">
                {daySlots.slice(0, 2).map((s) => (
                  <div key={s.id} className={cn("text-[9px] px-1 py-0.5 rounded truncate",
                    s.status === "available" && "bg-emerald-100 text-emerald-700",
                    s.status === "blocked" && "bg-violet-100 text-violet-700",
                    s.status === "booked" && "bg-blue-100 text-blue-700",
                  )}>
                    {s.startTime}
                  </div>
                ))}
                {dayAppts.slice(0, 2).map((a) => (
                  <div key={a.id} className="text-[9px] px-1 py-0.5 rounded bg-[#0F2D52]/10 text-[#0F2D52] truncate font-medium">
                    {a.startTime} {a.clientName}
                  </div>
                ))}
                {daySlots.length + dayAppts.length > 4 && (
                  <p className="text-[9px] text-muted-foreground">+{daySlots.length + dayAppts.length - 4}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Chips ─────────────────────────────────────────────────

function SlotChip({ slot, onAction, compact }: { slot: Slot; onAction: (s: Slot, action: "delete" | "toggle" | "book") => void; compact?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn(
          "w-full text-left rounded-md p-1.5 text-[10px] leading-tight transition-all hover:shadow-sm hover:brightness-95 cursor-pointer",
          slot.status === "available" && "bg-emerald-50 border border-emerald-200 text-emerald-700",
          slot.status === "blocked" && "bg-violet-50 border border-violet-200 text-violet-700",
          slot.status === "booked" && "bg-blue-50 border border-blue-200 text-blue-700",
        )}>
          <div className="font-semibold flex items-center gap-1">
            {slot.status === "blocked" && <Lock className="h-2.5 w-2.5" />}
            {slot.startTime}{!compact && `-${slot.endTime}`}
          </div>
          {!compact && <div className="capitalize">{slot.status === "available" ? "Disponible" : slot.status === "blocked" ? "Bloqué" : "Réservé"}</div>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {slot.status === "available" && (
          <DropdownMenuItem onSelect={() => onAction(slot, "book")}>
            <CalendarIcon className="h-3 w-3 mr-2" />Réserver pour client
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => onAction(slot, "toggle")}>
          <Lock className="h-3 w-3 mr-2" />{slot.status === "blocked" ? "Débloquer" : "Bloquer"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onAction(slot, "delete")} className="text-destructive">
          <X className="h-3 w-3 mr-2" />Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ApptChip({ appt, onClick, compact }: { appt: Appointment; onClick: (a: Appointment) => void; compact?: boolean }) {
  const Icon = MEETING_ICONS[appt.meetingType] ?? Video;
  const isCancelled = appt.status === "cancelled";
  return (
    <button type="button" onClick={() => onClick(appt)}
      className={cn(
        "w-full text-left rounded-md p-1.5 text-[10px] leading-tight border-l-2 transition-all hover:shadow-sm",
        isCancelled
          ? "bg-muted/40 border-l-muted-foreground text-muted-foreground line-through"
          : "bg-[#0F2D52]/10 border-l-[#0F2D52] hover:bg-[#0F2D52]/15",
      )}>
      <div className="font-semibold flex items-center gap-1">
        <Icon className="h-2.5 w-2.5" />
        {appt.startTime}
      </div>
      <div className="truncate font-medium">{appt.clientName}</div>
      {appt.subject && !compact && <div className="truncate text-muted-foreground">{appt.subject}</div>}
    </button>
  );
}
