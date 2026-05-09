"use client";
// AppointmentDetailPanel — slide-out VNK avec edition inline
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Calendar, User, Pencil, Check, X, Video, Phone, MapPin,
  Clock, FileText, ClipboardList, Trash2, Lock, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/admin/status-badge";
import { DetailPanelBase, PanelStatBox } from "@/components/admin/detail-panel-base";
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { useConfirm } from "@/hooks/use-confirm";
import { formatDate, cn } from "@/lib/utils";

type AppointmentFull = {
  id: number;
  clientId: number | null;
  clientName: string;
  clientEmail: string | null;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  subject: string | null;
  meetingType: string;
  meetingLink: string | null;
  notesAdmin: string | null;
  status: string;
  cancelledAt: string | null;
  cancelledBy: string | null;
  slotId: number | null;
  client: { id: number; fullName: string; companyName: string | null; email: string; phone: string | null } | null;
};

const MEETING_LABELS: Record<string, string> = {
  video: "Réunion vidéo",
  phone: "Appel téléphonique",
  onsite: "Présentiel",
};

const MEETING_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  video: Video,
  phone: Phone,
  onsite: MapPin,
};

export function AppointmentDetailPanel({
  appointmentId,
  open,
  onOpenChange,
}: {
  appointmentId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { open: openEntity } = useEntityPanels();
  const { confirm, ConfirmModal } = useConfirm();
  const [appt, setAppt] = useState<AppointmentFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!appointmentId || !open) return;
    setLoading(true);
    setAppt(null);
    fetch(`/api/appointments/${appointmentId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setAppt(data.appointment))
      .finally(() => setLoading(false));
  }, [appointmentId, open]);

  const refresh = async () => {
    if (!appointmentId) return;
    const res = await fetch(`/api/appointments/${appointmentId}`, { cache: "no-store" });
    const data = await res.json();
    setAppt(data.appointment);
    router.refresh();
  };

  const patch = async (data: Record<string, unknown>, msg?: string) => {
    if (!appt) return false;
    setBusy(true);
    try {
      const res = await fetch(`/api/appointments/${appt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) { if (msg) toast.success(msg); await refresh(); return true; }
      const d = await res.json();
      toast.error(d.error || "Erreur");
      return false;
    } finally { setBusy(false); }
  };

  const handleCancel = async () => {
    if (!appt) return;
    const ok = await confirm({
      title: "Annuler ce rendez-vous ?",
      description: `${appt.clientName} sera prévenu et le créneau sera libéré.`,
      confirmLabel: "Annuler le RDV",
      variant: "destructive",
    });
    if (!ok) return;
    await patch({ status: "cancelled" }, "Rendez-vous annulé");
  };

  const handleComplete = async () => {
    if (!appt) return;
    const ok = await confirm({
      title: "Marquer comme complété ?",
      description: `Le rendez-vous avec ${appt.clientName} sera marqué comme complété.`,
      confirmLabel: "Marquer complété",
    });
    if (!ok) return;
    await patch({ status: "completed" }, "Rendez-vous complété");
  };

  const handleDelete = async () => {
    if (!appt) return;
    const ok = await confirm({
      title: "Supprimer ce rendez-vous ?",
      description: "Le rendez-vous sera supprimé définitivement et le créneau libéré.",
      confirmLabel: "Supprimer",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/appointments/${appt.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Rendez-vous supprimé");
        onOpenChange(false);
        router.refresh();
      } else { const d = await res.json(); toast.error(d.error || "Erreur"); }
    } finally { setBusy(false); }
  };

  const isLocked = appt?.status === "cancelled" || appt?.status === "completed";
  const MeetIcon = appt ? (MEETING_ICONS[appt.meetingType] ?? Video) : Video;

  // Calcule l'heure de fin a afficher : si endTime <= startTime, utilise startTime + 30min
  const displayEndTime = (() => {
    if (!appt) return "";
    if (appt.endTime > appt.startTime) return appt.endTime;
    const [h, m] = appt.startTime.split(":").map(Number);
    const total = h * 60 + m + 30;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  })();

  return (
    <DetailPanelBase
      open={open}
      onOpenChange={onOpenChange}
      loading={loading || !appt}
      title={appt?.subject || (appt ? `RDV ${appt.startTime}` : "Rendez-vous")}
      subtitle={appt?.clientName ? `${appt.clientName}${appt.client?.companyName ? ` · ${appt.client.companyName}` : ""}` : undefined}
      icon={<Calendar className="h-7 w-7 text-white" />}
      headerStats={
        appt ? (
          <div className="grid grid-cols-3 gap-2">
            <PanelStatBox icon={Calendar} label="Date" value={formatDate(new Date(appt.appointmentDate))} />
            <PanelStatBox icon={Clock} label="Heure" value={`${appt.startTime} - ${displayEndTime}`} />
            <PanelStatBox icon={MeetIcon} label="Type" value={MEETING_LABELS[appt.meetingType] ?? appt.meetingType} />
          </div>
        ) : undefined
      }
      headerActions={
        appt ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {appt.client && (
              <Button size="sm" variant="secondary" disabled={busy}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
                onClick={() => openEntity("client", appt.clientId!)}>
                <User className="h-3 w-3" />Voir client
              </Button>
            )}
            {!isLocked && (
              <>
                <Button size="sm" variant="secondary" disabled={busy}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
                  onClick={handleComplete}>
                  <Check className="h-3 w-3" />Compléter
                </Button>
                <Button size="sm" variant="secondary" disabled={busy}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
                  onClick={handleCancel}>
                  <X className="h-3 w-3" />Annuler
                </Button>
              </>
            )}
          </div>
        ) : undefined
      }
    >
      {appt && (
        <div className="space-y-4">
          {/* Bandeau si annule */}
          {appt.status === "cancelled" && (
            <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3 flex items-center gap-2">
              <Lock className="h-4 w-4 text-red-600" />
              <div className="text-sm text-red-700">
                Annulé{appt.cancelledBy ? ` par ${appt.cancelledBy === "admin" ? "l'administrateur" : "le client"}` : ""}
                {appt.cancelledAt ? ` le ${formatDate(new Date(appt.cancelledAt))}` : ""}
              </div>
            </div>
          )}
          {appt.status === "completed" && (
            <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" />
              <span className="text-sm text-emerald-700 font-medium">Rendez-vous complété</span>
            </div>
          )}

          {/* Section Statut */}
          <PanelSection icon={Calendar} title="Statut & timing">
            <EditableField
              label="Statut"
              display={<StatusBadge status={appt.status} />}
              renderEdit={(v, setV) => (
                <Select value={v} onValueChange={setV}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">Confirmé</SelectItem>
                    <SelectItem value="completed">Complété</SelectItem>
                    <SelectItem value="cancelled">Annulé</SelectItem>
                    <SelectItem value="no_show">Absent</SelectItem>
                  </SelectContent>
                </Select>
              )}
              initialValue={appt.status}
              onSave={(v) => patch({ status: v }, "Statut modifié")}
              disabled={busy}
            />
            <EditableField
              label="Date"
              display={<span className="text-sm">{formatDate(new Date(appt.appointmentDate))}</span>}
              renderEdit={(v, setV) => <Input type="date" value={v} onChange={(e) => setV(e.target.value)} />}
              initialValue={appt.appointmentDate.slice(0, 10)}
              onSave={(v) => v ? patch({ appointmentDate: v }, "Date modifiée") : false}
              disabled={busy || isLocked}
            />
            <div className="grid grid-cols-2 gap-2">
              <EditableField
                label="Début"
                display={<span className="text-sm font-mono">{appt.startTime}</span>}
                renderEdit={(v, setV) => <Input type="time" value={v} onChange={(e) => setV(e.target.value)} />}
                initialValue={appt.startTime}
                onSave={(v) => v ? patch({ startTime: v }, "Heure de début modifiée") : false}
                disabled={busy || isLocked}
              />
              <EditableField
                label="Fin"
                display={<span className="text-sm font-mono">{displayEndTime}</span>}
                renderEdit={(v, setV) => <Input type="time" value={v} onChange={(e) => setV(e.target.value)} />}
                initialValue={displayEndTime}
                onSave={(v) => {
                  if (!v) return false;
                  if (v <= appt.startTime) {
                    toast.error("L'heure de fin doit être après l'heure de début");
                    return false;
                  }
                  return patch({ endTime: v }, "Heure de fin modifiée");
                }}
                disabled={busy || isLocked}
              />
            </div>
          </PanelSection>

          {/* Section Détails */}
          <PanelSection icon={FileText} title="Détails">
            <EditableField
              label="Sujet"
              display={<span className="text-sm">{appt.subject || "—"}</span>}
              renderEdit={(v, setV) => <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="Objet du RDV" />}
              initialValue={appt.subject ?? ""}
              onSave={(v) => patch({ subject: v.trim() || null }, "Sujet modifié")}
              disabled={busy || isLocked}
            />
            <EditableField
              label="Type de réunion"
              display={
                <span className="text-sm flex items-center gap-1.5 justify-end">
                  <MeetIcon className="h-3.5 w-3.5" />
                  {MEETING_LABELS[appt.meetingType] ?? appt.meetingType}
                </span>
              }
              renderEdit={(v, setV) => (
                <Select value={v} onValueChange={setV}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Réunion vidéo</SelectItem>
                    <SelectItem value="phone">Appel téléphonique</SelectItem>
                    <SelectItem value="onsite">Présentiel</SelectItem>
                  </SelectContent>
                </Select>
              )}
              initialValue={appt.meetingType}
              onSave={(v) => patch({ meetingType: v }, "Type modifié")}
              disabled={busy || isLocked}
            />
            <EditableField
              label="Lien (vidéo/présentiel)"
              display={
                appt.meetingLink ? (
                  <a href={appt.meetingLink} target="_blank" rel="noopener noreferrer" className="text-sm text-[#0F2D52] hover:underline flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />Ouvrir
                  </a>
                ) : <span className="text-sm">—</span>
              }
              renderEdit={(v, setV) => <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="https://meet.google.com/…" />}
              initialValue={appt.meetingLink ?? ""}
              onSave={(v) => patch({ meetingLink: v.trim() || null }, "Lien modifié")}
              disabled={busy || isLocked}
            />
          </PanelSection>

          {/* Section Notes admin */}
          <PanelSection icon={ClipboardList} title="Notes (privées)">
            <EditableTextarea
              display={appt.notesAdmin}
              initialValue={appt.notesAdmin ?? ""}
              onSave={(v) => patch({ notesAdmin: v.trim() || null }, "Notes modifiées")}
              disabled={busy}
              rows={3}
            />
          </PanelSection>

          {/* Section Contact */}
          {appt.client && (
            <PanelSection icon={User} title="Contact client">
              <InfoRow label="Nom" value={appt.client.fullName} />
              {appt.client.companyName && <InfoRow label="Entreprise" value={appt.client.companyName} />}
              <InfoRow label="Courriel" value={appt.client.email} />
              {appt.client.phone && <InfoRow label="Téléphone" value={appt.client.phone} />}
            </PanelSection>
          )}

          {/* Zone danger */}
          <PanelSection icon={Trash2} title="Actions avancées">
            <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              disabled={busy} onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1.5" />Supprimer le rendez-vous
            </Button>
          </PanelSection>
        </div>
      )}

      {ConfirmModal}
    </DetailPanelBase>
  );
}

// ─── Sous-composants ───────────────────────────────────────

function PanelSection({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b">
        <span className="h-7 w-7 rounded-lg bg-[#0F2D52]/10 text-[#0F2D52] flex items-center justify-center">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F2D52]">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

function EditableField<T extends string>({
  label, display, renderEdit, initialValue, onSave, disabled,
}: {
  label: string;
  display: React.ReactNode;
  renderEdit: (value: T, setValue: (v: T) => void) => React.ReactNode;
  initialValue: T;
  onSave: (value: T) => Promise<boolean | void> | boolean | void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<T>(initialValue);
  useEffect(() => { if (!editing) setValue(initialValue); }, [initialValue, editing]);

  const handleSave = async () => {
    const ok = await onSave(value);
    if (ok !== false) setEditing(false);
  };
  const handleCancel = () => { setValue(initialValue); setEditing(false); };

  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-sm text-muted-foreground pt-1.5 shrink-0">{label}</span>
      <div className="flex-1 flex items-center gap-1.5 justify-end min-w-0">
        {editing ? (
          <>
            <div className="flex-1 min-w-0">{renderEdit(value, setValue)}</div>
            <button type="button" onClick={handleSave} disabled={disabled}
              className="h-7 w-7 flex items-center justify-center rounded-md bg-[#0F2D52] hover:bg-[#1a3a66] text-white shrink-0 disabled:opacity-50">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={handleCancel} disabled={disabled}
              className="h-7 w-7 flex items-center justify-center rounded-md border hover:bg-muted shrink-0 disabled:opacity-50">
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <div className="text-right">{display}</div>
            <button type="button" onClick={() => setEditing(true)} disabled={disabled}
              className={cn(
                "h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0",
                disabled && "opacity-30 cursor-not-allowed"
              )}>
              <Pencil className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function EditableTextarea({
  display, initialValue, onSave, disabled, rows = 3,
}: {
  display: string | null;
  initialValue: string;
  onSave: (v: string) => Promise<boolean | void> | boolean | void;
  disabled?: boolean;
  rows?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  useEffect(() => { if (!editing) setValue(initialValue); }, [initialValue, editing]);

  const handleSave = async () => {
    const ok = await onSave(value);
    if (ok !== false) setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-2">
        <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={rows} autoFocus className="bg-amber-50/30" />
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={disabled}>Annuler</Button>
          <Button size="sm" onClick={handleSave} disabled={disabled} className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white">Enregistrer</Button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      disabled={disabled}
      className={cn(
        "w-full text-left p-3 rounded-md border transition-colors group",
        display ? "bg-amber-50 border-amber-200 hover:border-amber-400" : "border-dashed text-muted-foreground hover:border-[#0F2D52]/50 hover:text-foreground"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm whitespace-pre-wrap leading-relaxed flex-1 min-w-0">
          {display || "Aucune note — clique pour ajouter"}
        </p>
        <Pencil className="h-3 w-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}
