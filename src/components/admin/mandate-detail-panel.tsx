"use client";
import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Briefcase, Calendar, Clock, User, CheckCircle2, Pencil, X, Check,
  ListChecks, ClipboardList, DollarSign, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/admin/status-badge";
import { DetailPanelBase, PanelStatBox, PanelEmptyState } from "@/components/admin/detail-panel-base";
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { useConfirm } from "@/hooks/use-confirm";
import { formatCurrency, formatDate } from "@/lib/utils";

type MandateFull = {
  id: number;
  title: string;
  description: string | null;
  serviceType: string | null;
  status: string;
  progress: number;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  hourlyRate: number | null;
  createdAt: string;
  client: { id: number; fullName: string; companyName: string | null; email: string };
  logs: Array<{ id: number; action: string; description: string | null; createdBy: string; createdAt: string }>;
};

const SERVICE_LABELS: Record<string, string> = {
  "plc-support": "Support PLC",
  "audit": "Audit technique",
  "documentation": "Documentation",
  "refactoring": "Refactorisation",
  "modernization": "Modernisation",
  "training": "Formation",
};

const SERVICE_OPTIONS = [
  { value: "plc-support", label: "Support PLC" },
  { value: "audit", label: "Audit technique" },
  { value: "documentation", label: "Documentation" },
  { value: "refactoring", label: "Refactorisation" },
  { value: "modernization", label: "Modernisation" },
  { value: "training", label: "Formation" },
];

export function MandateDetailPanel({
  mandateId,
  open,
  onOpenChange,
}: {
  mandateId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const tc = useTranslations("common");
  const router = useRouter();
  const { open: openEntity } = useEntityPanels();
  const { confirm, ConfirmModal } = useConfirm();
  const [mandate, setMandate] = useState<MandateFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // State local du slider (instant feedback) — commit a l'API seulement onPointerUp
  const [localProgress, setLocalProgress] = useState(0);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!mandateId || !open) return;
    setLoading(true);
    setMandate(null);
    fetch(`/api/mandates/${mandateId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setMandate(data.mandate);
        setLocalProgress(data.mandate?.progress ?? 0);
      })
      .finally(() => setLoading(false));
  }, [mandateId, open]);

  // Synchronise localProgress avec mandate.progress quand on n'est pas en train de drag
  useEffect(() => {
    if (!isDraggingRef.current && mandate) setLocalProgress(mandate.progress);
  }, [mandate]);

  const refresh = async () => {
    if (!mandateId) return;
    const res = await fetch(`/api/mandates/${mandateId}`, { cache: "no-store" });
    const data = await res.json();
    setMandate(data.mandate);
    router.refresh();
  };

  // ── Patch generique pour toute mise a jour ────────────
  const patch = async (data: Record<string, unknown>, successMessage?: string) => {
    if (!mandate) return false;
    setBusy(true);
    try {
      const res = await fetch(`/api/mandates/${mandate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        if (successMessage) toast.success(successMessage);
        await refresh();
        return true;
      } else {
        const d = await res.json();
        toast.error(d.error || "Erreur");
        return false;
      }
    } finally { setBusy(false); }
  };

  // Slider: commit du progress sur release du drag
  const commitProgress = async () => {
    isDraggingRef.current = false;
    if (!mandate || localProgress === mandate.progress) return;
    await patch({ progress: localProgress }, "Progression mise à jour");
  };

  const markCompleted = async () => {
    if (!mandate) return;
    const ok = await confirm({
      title: "Marquer comme terminé ?",
      description: `Le mandat "${mandate.title}" sera marqué comme complété (100%).`,
      confirmLabel: "Marquer terminé",
    });
    if (!ok) return;
    await patch({ status: "completed", progress: 100 }, "Mandat terminé");
  };

  // Calculs derives
  const estimatedRevenue = mandate && mandate.estimatedHours && mandate.hourlyRate
    ? Number(mandate.estimatedHours) * Number(mandate.hourlyRate)
    : null;
  const actualRevenue = mandate && mandate.actualHours && mandate.hourlyRate
    ? Number(mandate.actualHours) * Number(mandate.hourlyRate)
    : null;

  const isLocked = mandate?.status === "completed" || mandate?.status === "cancelled";

  return (
    <DetailPanelBase
      open={open}
      onOpenChange={onOpenChange}
      loading={loading || !mandate}
      title={mandate?.title ?? "Mandat"}
      subtitle={mandate ? `${mandate.client.fullName}${mandate.client.companyName ? ` · ${mandate.client.companyName}` : ""}` : undefined}
      icon={<Briefcase className="h-7 w-7 text-white" />}
      headerStats={
        mandate ? (
          <div className="grid grid-cols-3 gap-2">
            <PanelStatBox icon={CheckCircle2} label="Progression" value={`${mandate.progress}%`} />
            <PanelStatBox icon={Clock} label="Heures" value={`${mandate.actualHours ?? 0} / ${mandate.estimatedHours ?? "—"}`} />
            <PanelStatBox icon={DollarSign} label="Revenu" value={estimatedRevenue ? formatCurrency(estimatedRevenue) : "—"} />
          </div>
        ) : undefined
      }
      headerActions={
        mandate ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="secondary" disabled={busy}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
              onClick={() => openEntity("client", mandate.client.id)}>
              <User className="h-3 w-3" />Voir client
            </Button>
            {!isLocked && (
              <Button size="sm" variant="secondary" disabled={busy}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
                onClick={markCompleted}>
                <CheckCircle2 className="h-3 w-3" />Terminer
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      {mandate && (
        <div className="space-y-4">
          {/* Section Statut & progression */}
          <PanelSection icon={CheckCircle2} title="Statut & progression">
            <EditableField
              label={tc("status")}
              display={<StatusBadge status={mandate.status} />}
              renderEdit={(value, setValue) => (
                <Select value={value} onValueChange={setValue}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="active">{tc("active")}</SelectItem>
                    <SelectItem value="in_progress">En cours</SelectItem>
                    <SelectItem value="completed">Complété</SelectItem>
                    <SelectItem value="paused">En pause</SelectItem>
                    <SelectItem value="cancelled">Annulé</SelectItem>
                  </SelectContent>
                </Select>
              )}
              initialValue={mandate.status}
              onSave={(v) => patch({ status: v }, "Statut modifié")}
              disabled={busy}
            />
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Progression</span>
                <span className="text-sm font-bold text-[#0F2D52] tabular-nums">{localProgress}%</span>
              </div>
              <input
                type="range"
                min={0} max={100} step={5}
                value={localProgress}
                onChange={(e) => { isDraggingRef.current = true; setLocalProgress(Number(e.target.value)); }}
                onPointerUp={commitProgress}
                onTouchEnd={commitProgress}
                onMouseUp={commitProgress}
                disabled={busy || isLocked}
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#0F2D52] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: `linear-gradient(to right, #0F2D52 0%, #0F2D52 ${localProgress}%, hsl(var(--muted)) ${localProgress}%, hsl(var(--muted)) 100%)` }}
              />
              <p className="text-[10px] text-muted-foreground">
                {isLocked ? "Mandat verrouillé — la progression ne peut plus être modifiée"
                  : "Glisse pour mettre à jour (sauvegarde au relâchement)"}
              </p>
            </div>
          </PanelSection>

          {/* Section Identité */}
          <PanelSection icon={FileText} title="Identité">
            <EditableField
              label="Titre"
              display={<span className="text-sm font-medium">{mandate.title}</span>}
              renderEdit={(v, setV) => <Input value={v} onChange={(e) => setV(e.target.value)} />}
              initialValue={mandate.title}
              onSave={(v) => v.trim() ? patch({ title: v.trim() }, "Titre modifié") : false}
              disabled={busy}
            />
            <EditableField
              label="Type de service"
              display={<span className="text-sm">{mandate.serviceType ? (SERVICE_LABELS[mandate.serviceType] ?? mandate.serviceType) : "—"}</span>}
              renderEdit={(v, setV) => (
                <Select value={v} onValueChange={setV}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {SERVICE_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              initialValue={mandate.serviceType ?? ""}
              onSave={(v) => patch({ serviceType: v || null }, "Service modifié")}
              disabled={busy}
            />
            <InfoRow label="Créé le" value={formatDate(new Date(mandate.createdAt))} />
            <EditableTextarea
              label="Description"
              display={mandate.description}
              initialValue={mandate.description ?? ""}
              onSave={(v) => patch({ description: v || null }, "Description modifiée")}
              disabled={busy}
              placeholder="Aucune description — clique pour ajouter"
              rows={3}
            />
          </PanelSection>

          {/* Section Planification */}
          <PanelSection icon={Calendar} title="Planification">
            <div className="grid grid-cols-2 gap-3">
              <EditableDateBox
                label="Date début"
                value={mandate.startDate}
                onSave={(v) => patch({ startDate: v || null }, "Date début modifiée")}
                disabled={busy}
              />
              <EditableDateBox
                label="Date fin estimée"
                value={mandate.endDate}
                onSave={(v) => patch({ endDate: v || null }, "Date fin modifiée")}
                disabled={busy}
              />
            </div>
          </PanelSection>

          {/* Section Estimations */}
          <PanelSection icon={DollarSign} title="Estimations">
            <div className="grid grid-cols-2 gap-3">
              <EditableNumberBox
                label="Heures estimées"
                value={mandate.estimatedHours}
                suffix="h"
                onSave={(v) => patch({ estimatedHours: v }, "Heures modifiées")}
                disabled={busy}
              />
              <div className="rounded-lg border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Heures réelles</p>
                <p className="text-base font-bold mt-1 tabular-nums">{mandate.actualHours ?? 0}h</p>
              </div>
              <EditableNumberBox
                label="Taux horaire"
                value={mandate.hourlyRate}
                prefix="$"
                onSave={(v) => patch({ hourlyRate: v }, "Taux modifié")}
                disabled={busy}
              />
              <div className="rounded-lg border-2 border-[#0F2D52]/20 bg-[#0F2D52]/5 p-3">
                <p className="text-[10px] uppercase tracking-wider text-[#0F2D52]/70 font-semibold">Revenu estimé</p>
                <p className="text-base font-bold mt-1 tabular-nums text-[#0F2D52]">{estimatedRevenue ? formatCurrency(estimatedRevenue) : "—"}</p>
              </div>
            </div>
            {actualRevenue && estimatedRevenue && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 flex items-center justify-between text-sm">
                <span className="text-emerald-700">Revenu réel à ce jour</span>
                <span className="font-bold text-emerald-700 tabular-nums">{formatCurrency(actualRevenue)}</span>
              </div>
            )}
          </PanelSection>

          {/* Section Notes internes */}
          <PanelSection icon={ClipboardList} title="Notes internes (privées)">
            <EditableTextarea
              label=""
              display={mandate.notes}
              initialValue={mandate.notes ?? ""}
              onSave={(v) => patch({ notes: v || null }, "Notes modifiées")}
              disabled={busy}
              placeholder="Aucune note interne — clique pour ajouter"
              rows={4}
              ambered
            />
          </PanelSection>

          {/* Section Activité */}
          <PanelSection icon={ListChecks} title={`Activité (${mandate.logs.length})`}>
            {mandate.logs.length === 0 ? (
              <PanelEmptyState text="Aucune activité enregistrée" icon={ListChecks} />
            ) : (
              <div className="space-y-2">
                {mandate.logs.map((l) => (
                  <div key={l.id} className="p-3 rounded-lg border-l-4 border-l-[#0F2D52] bg-card">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#0F2D52]">{l.action}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(new Date(l.createdAt))}</p>
                    </div>
                    {l.description && <p className="text-sm mt-1">{l.description}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">par {l.createdBy}</p>
                  </div>
                ))}
              </div>
            )}
          </PanelSection>
        </div>
      )}

      {ConfirmModal}
    </DetailPanelBase>
  );
}

// ─── Sous-composants ────────────────────────────────────────────

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

// Champ editable inline avec icone pencil — render display ou render edit selon mode
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
  const tc = useTranslations("common");
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
              className="h-7 w-7 flex items-center justify-center rounded-md bg-[#0F2D52] hover:bg-[#1a3a66] text-white shrink-0 disabled:opacity-50"
              aria-label={tc("save")}>
              <Check className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={handleCancel} disabled={disabled}
              className="h-7 w-7 flex items-center justify-center rounded-md border hover:bg-muted shrink-0 disabled:opacity-50"
              aria-label={tc("cancel")}>
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <div className="text-right">{display}</div>
            <button type="button" onClick={() => setEditing(true)} disabled={disabled}
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 disabled:opacity-50"
              aria-label={tc("edit")}>
              <Pencil className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function EditableTextarea({
  label, display, initialValue, onSave, disabled, placeholder, rows = 3, ambered = false,
}: {
  label: string;
  display: string | null;
  initialValue: string;
  onSave: (value: string) => Promise<boolean | void> | boolean | void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  ambered?: boolean;
}) {
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
        {label && <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>}
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={rows}
          autoFocus
          className={ambered ? "bg-amber-50/30" : ""}
        />
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
      className={`w-full text-left p-3 rounded-md border transition-colors group ${
        display
          ? (ambered ? "bg-amber-50 border-amber-200 hover:border-amber-400" : "bg-card hover:border-[#0F2D52]/30")
          : "border-dashed text-muted-foreground hover:border-[#0F2D52]/50 hover:text-foreground"
      }`}
    >
      {label && <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">{label}</p>}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm whitespace-pre-wrap leading-relaxed flex-1 min-w-0">
          {display || placeholder || "Cliquer pour ajouter"}
        </p>
        <Pencil className="h-3 w-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}

function EditableDateBox({
  label, value, onSave, disabled,
}: {
  label: string;
  value: string | null;
  onSave: (v: string) => Promise<boolean | void>;
  disabled?: boolean;
}) {
  const tc = useTranslations("common");
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value ? value.slice(0, 10) : "");
  useEffect(() => { if (!editing) setV(value ? value.slice(0, 10) : ""); }, [value, editing]);

  const handleSave = async () => {
    const ok = await onSave(v);
    if (ok !== false) setEditing(false);
  };

  if (editing) {
    return (
      <div className="rounded-lg border-2 border-[#0F2D52]/30 bg-card p-2 space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
        <Input type="date" value={v} onChange={(e) => setV(e.target.value)} className="h-8 text-xs" />
        <div className="flex gap-1">
          <Button size="sm" onClick={handleSave} disabled={disabled} className="h-7 flex-1 bg-[#0F2D52] hover:bg-[#1a3a66] text-white text-xs">{tc("save")}</Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={disabled} className="h-7 px-2 text-xs">{tc("cancel")}</Button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      disabled={disabled}
      className="rounded-lg border bg-card p-3 text-left w-full hover:border-[#0F2D52]/30 transition-colors group"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          <Calendar className="h-3 w-3" />
          {label}
        </div>
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className="text-sm font-medium mt-1">{value ? formatDate(new Date(value)) : "—"}</p>
    </button>
  );
}

function EditableNumberBox({
  label, value, onSave, disabled, prefix, suffix,
}: {
  label: string;
  value: number | null;
  onSave: (v: number | null) => Promise<boolean | void>;
  disabled?: boolean;
  prefix?: string;
  suffix?: string;
}) {
  const tc = useTranslations("common");
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value != null ? String(value) : "");
  useEffect(() => { if (!editing) setV(value != null ? String(value) : ""); }, [value, editing]);

  const handleSave = async () => {
    const num = v.trim() === "" ? null : Number(v);
    if (num !== null && Number.isNaN(num)) { toast.error("Valeur invalide"); return; }
    const ok = await onSave(num);
    if (ok !== false) setEditing(false);
  };

  if (editing) {
    return (
      <div className="rounded-lg border-2 border-[#0F2D52]/30 bg-card p-2 space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
        <Input type="number" min="0" step="0.5" value={v} onChange={(e) => setV(e.target.value)} className="h-8 text-xs" autoFocus />
        <div className="flex gap-1">
          <Button size="sm" onClick={handleSave} disabled={disabled} className="h-7 flex-1 bg-[#0F2D52] hover:bg-[#1a3a66] text-white text-xs">{tc("save")}</Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={disabled} className="h-7 px-2 text-xs">{tc("cancel")}</Button>
        </div>
      </div>
    );
  }

  const displayValue = value != null
    ? `${prefix ?? ""}${value}${suffix ?? ""}`
    : "—";

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      disabled={disabled}
      className="rounded-lg border bg-card p-3 text-left w-full hover:border-[#0F2D52]/30 transition-colors group"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className="text-base font-bold mt-1 tabular-nums">{displayValue}</p>
    </button>
  );
}
