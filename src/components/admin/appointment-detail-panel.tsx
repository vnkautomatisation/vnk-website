"use client";
// AppointmentDetailPanel — slide-out VNK avec edition inline
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
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

const MEETING_KEYS: Record<string, string> = {
  video: "reunion_video",
  phone: "appel_telephonique",
  onsite: "presentiel",
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
  const t = useTranslations("admin.calendar");
  const tc = useTranslations("common");
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
      toast.error(d.error || t("erreur"));
      return false;
    } finally { setBusy(false); }
  };

  const handleCancel = async () => {
    if (!appt) return;
    const ok = await confirm({
      title: t("annuler_rendez_vous"),
      description: `${appt.clientName} sera prévenu et le créneau sera libéré.`,
      confirmLabel: t("annuler_rdv"),
      variant: "destructive",
    });
    if (!ok) return;
    await patch({ status: "cancelled" }, t("rendez_vous_annule"));
  };

  const handleComplete = async () => {
    if (!appt) return;
    const ok = await confirm({
      title: t("marquer_comme_complete"),
      description: `Le rendez-vous avec ${appt.clientName} sera marqué comme complété.`,
      confirmLabel: t("marquer_complete"),
    });
    if (!ok) return;
    await patch({ status: "completed" }, t("rendez_vous_complete"));
  };

  const handleDelete = async () => {
    if (!appt) return;
    const ok = await confirm({
      title: t("supprimer_rendez_vous"),
      description: t("rendez_vous_sera_supprime_definitivement"),
      confirmLabel: t("supprimer"),
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/appointments/${appt.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("rendez_vous_supprime"));
        onOpenChange(false);
        router.refresh();
      } else { const d = await res.json(); toast.error(d.error || t("erreur")); }
    } finally { setBusy(false); }
  };

  const isLocked = appt?.status === "cancelled" || appt?.status === "completed";
  const MeetIcon = appt ? (MEETING_ICONS[appt.meetingType] ?? Video) : Video;


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
      title={appt?.subject || (appt ? `RDV ${appt.startTime}` : t("rendez_vous"))}
      subtitle={appt?.clientName ? `${appt.clientName}${appt.client?.companyName ? ` · ${appt.client.companyName}` : ""}` : undefined}
      icon={<Calendar className="h-7 w-7 text-white" />}
      headerStats={
        appt ? (
          <div className="grid grid-cols-3 gap-2">
            <PanelStatBox icon={Calendar} label={tc("date")} value={formatDate(new Date(appt.appointmentDate))} />
            <PanelStatBox icon={Clock} label={t("heure")} value={`${appt.startTime} - ${displayEndTime}`} />
            <PanelStatBox icon={MeetIcon} label={t("type")} value={MEETING_KEYS[appt.meetingType] ? t(MEETING_KEYS[appt.meetingType]) : appt.meetingType} />
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
                  <Check className="h-3 w-3" />{t("appointment_detail_panel_completer")}</Button>
                <Button size="sm" variant="secondary" disabled={busy}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
                  onClick={handleCancel}>
                  <X className="h-3 w-3" />{tc("cancel")}
                </Button>
              </>
            )}
          </div>
        ) : undefined
      }
    >
      {appt && (
        <div className="space-y-4">

          {appt.status === "cancelled" && (
            <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3 flex items-center gap-2">
              <Lock className="h-4 w-4 text-red-600" />
              <div className="text-sm text-red-700">
                {appt.cancelledBy
                  ? t("annule_par", { who: appt.cancelledBy === "admin" ? t("administrateur") : t("client") })
                  : t("annule")}
                {appt.cancelledAt ? t("le_date", { date: formatDate(new Date(appt.cancelledAt)) }) : ""}
              </div>
            </div>
          )}
          {appt.status === "completed" && (
            <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" />
              <span className="text-sm text-emerald-700 font-medium">{t("rendez_vous_complete")}</span>
            </div>
          )}


          <PanelSection icon={Calendar} title={t("statut_timing")}>
            <EditableField
              label={tc("status")}
              display={<StatusBadge status={appt.status} />}
              renderEdit={(v, setV) => (
                <Select value={v} onValueChange={setV}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">{t("confirme")}</SelectItem>
                    <SelectItem value="completed">{t("complete")}</SelectItem>
                    <SelectItem value="cancelled">{t("annule")}</SelectItem>
                    <SelectItem value="no_show">{t("absent")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
              initialValue={appt.status}
              onSave={(v) => patch({ status: v }, t("statut_modifie"))}
              disabled={busy}
            />
            <EditableField
              label={tc("date")}
              display={<span className="text-sm">{formatDate(new Date(appt.appointmentDate))}</span>}
              renderEdit={(v, setV) => <Input type="date" value={v} onChange={(e) => setV(e.target.value)} />}
              initialValue={appt.appointmentDate.slice(0, 10)}
              onSave={(v) => v ? patch({ appointmentDate: v }, t("date_modifiee")) : false}
              disabled={busy || isLocked}
            />
            <div className="grid grid-cols-2 gap-2">
              <EditableField
                label={t("debut")}
                display={<span className="text-sm font-mono">{appt.startTime}</span>}
                renderEdit={(v, setV) => <Input type="time" value={v} onChange={(e) => setV(e.target.value)} />}
                initialValue={appt.startTime}
                onSave={(v) => v ? patch({ startTime: v }, t("heure_debut_modifiee")) : false}
                disabled={busy || isLocked}
              />
              <EditableField
                label={t("fin")}
                display={<span className="text-sm font-mono">{displayEndTime}</span>}
                renderEdit={(v, setV) => <Input type="time" value={v} onChange={(e) => setV(e.target.value)} />}
                initialValue={displayEndTime}
                onSave={(v) => {
                  if (!v) return false;
                  if (v <= appt.startTime) {
                    toast.error(t("heure_fin_doit_etre_apres"));
                    return false;
                  }
                  return patch({ endTime: v }, t("heure_fin_modifiee"));
                }}
                disabled={busy || isLocked}
              />
            </div>
          </PanelSection>


          <PanelSection icon={FileText} title={t("details")}>
            <EditableField
              label={t("sujet")}
              display={<span className="text-sm">{appt.subject || "—"}</span>}
              renderEdit={(v, setV) => <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={t("objet_rdv")} />}
              initialValue={appt.subject ?? ""}
              onSave={(v) => patch({ subject: v.trim() || null }, t("sujet_modifie"))}
              disabled={busy || isLocked}
            />
            <EditableField
              label={t("type_reunion")}
              display={
                <span className="text-sm flex items-center gap-1.5 justify-end">
                  <MeetIcon className="h-3.5 w-3.5" />
                  {MEETING_KEYS[appt.meetingType] ? t(MEETING_KEYS[appt.meetingType]) : appt.meetingType}
                </span>
              }
              renderEdit={(v, setV) => (
                <Select value={v} onValueChange={setV}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">{t("reunion_video")}</SelectItem>
                    <SelectItem value="phone">{t("appel_telephonique")}</SelectItem>
                    <SelectItem value="onsite">{t("presentiel")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
              initialValue={appt.meetingType}
              onSave={(v) => patch({ meetingType: v }, t("type_modifie"))}
              disabled={busy || isLocked}
            />
            <EditableField
              label={t("lien_video_presentiel")}
              display={
                appt.meetingLink ? (
                  <a href={appt.meetingLink} target="_blank" rel="noopener noreferrer" className="text-sm text-[#0F2D52] hover:underline flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />Ouvrir
                  </a>
                ) : <span className="text-sm">—</span>
              }
              renderEdit={(v, setV) => <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="https://meet.google.com/…" />}
              initialValue={appt.meetingLink ?? ""}
              onSave={(v) => patch({ meetingLink: v.trim() || null }, t("lien_modifie"))}
              disabled={busy || isLocked}
            />
          </PanelSection>


          <PanelSection icon={ClipboardList} title={t("notes_privees")}>
            <EditableTextarea
              display={appt.notesAdmin}
              initialValue={appt.notesAdmin ?? ""}
              onSave={(v) => patch({ notesAdmin: v.trim() || null }, t("notes_modifiees"))}
              disabled={busy}
              rows={3}
            />
          </PanelSection>


          {appt.client && (
            <PanelSection icon={User} title={t("contact_client")}>
              <InfoRow label={t("nom")} value={appt.client.fullName} />
              {appt.client.companyName && <InfoRow label={t("entreprise")} value={appt.client.companyName} />}
              <InfoRow label={t("courriel")} value={appt.client.email} />
              {appt.client.phone && <InfoRow label={t("telephone")} value={appt.client.phone} />}
            </PanelSection>
          )}


          <PanelSection icon={Trash2} title={t("actions_avancees")}>
            <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              disabled={busy} onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1.5" />{t("appointment_detail_panel_supprimer_le_rendez_vous")}</Button>
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
  const t = useTranslations("admin.calendar");
  const tc = useTranslations("common");
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
          <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={disabled}>{tc("cancel")}</Button>
          <Button size="sm" onClick={handleSave} disabled={disabled} className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white">{tc("save")}</Button>
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
          {display || t("aucune_note_clique_ajouter")}
        </p>
        <Pencil className="h-3 w-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}
