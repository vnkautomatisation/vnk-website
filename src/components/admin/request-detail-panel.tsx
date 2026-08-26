"use client";
// RequestDetailPanel — slide-out VNK avec edition inline + conversion en mandat/devis
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Inbox, User, Pencil, Check, X, AlertTriangle, Tag, Cpu, DollarSign,
  FileText, Briefcase, ExternalLink, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/admin/status-badge";
import { DetailPanelBase, PanelStatBox } from "@/components/admin/detail-panel-base";
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { useConfirm } from "@/hooks/use-confirm";
import { formatDate, cn } from "@/lib/utils";

type RequestFull = {
  id: number;
  clientId: number;
  title: string;
  description: string;
  serviceType: string | null;
  plcBrand: string | null;
  urgency: string;
  status: string;
  budgetRange: string | null;
  convertedToMandateId: number | null;
  convertedToQuoteId: number | null;
  createdAt: string;
  updatedAt: string;
  client: { id: number; fullName: string; companyName: string | null; email: string; phone: string | null } | null;
};

const URGENCY_LABELS: Record<string, string> = {
  normal: "Normal",
  urgent: "Urgent",
  critical: "Critique",
};

const URGENCY_COLORS: Record<string, string> = {
  normal: "bg-blue-100 text-blue-700 border-blue-200",
  urgent: "bg-amber-100 text-amber-700 border-amber-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

const SERVICE_LABELS: Record<string, string> = {
  "plc-support": "Support PLC",
  "plc-programming": "Programmation PLC",
  "scada": "SCADA",
  "hmi": "Interface HMI",
  "web-development": "Développement web",
  "automation": "Automatisation",
  "consulting": "Consultation",
  "maintenance": "Maintenance",
};

export function RequestDetailPanel({
  requestId,
  open,
  onOpenChange,
}: {
  requestId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const tc = useTranslations("common");
  const router = useRouter();
  const { open: openEntity } = useEntityPanels();
  const { confirm, ConfirmModal } = useConfirm();
  const [request, setRequest] = useState<RequestFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertTarget, setConvertTarget] = useState<"mandate" | "quote">("mandate");
  const [convertAmount, setConvertAmount] = useState("");

  useEffect(() => {
    if (!requestId || !open) return;
    setLoading(true);
    setRequest(null);
    fetch(`/api/project-requests/${requestId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setRequest(data.request))
      .finally(() => setLoading(false));
  }, [requestId, open]);

  const refresh = async () => {
    if (!requestId) return;
    const res = await fetch(`/api/project-requests/${requestId}`, { cache: "no-store" });
    const data = await res.json();
    setRequest(data.request);
    router.refresh();
  };

  const patch = async (data: Record<string, unknown>, msg?: string) => {
    if (!request) return false;
    setBusy(true);
    try {
      const res = await fetch(`/api/project-requests/${request.id}`, {
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

  const handleDelete = async () => {
    if (!request) return;
    const ok = await confirm({
      title: "Supprimer cette demande ?",
      description: `La demande "${request.title}" sera supprimée définitivement.`,
      confirmLabel: "Supprimer",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/project-requests/${request.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Demande supprimée");
        onOpenChange(false);
        router.refresh();
      } else { const d = await res.json(); toast.error(d.error || "Erreur"); }
    } finally { setBusy(false); }
  };

  const handleConvert = async () => {
    if (!request) return;
    const body: Record<string, unknown> = { target: convertTarget };
    if (convertTarget === "quote") {
      const amt = Number(convertAmount);
      if (!amt || Number.isNaN(amt) || amt <= 0) {
        toast.error("Montant HT invalide");
        return;
      }
      body.amountHt = amt;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/project-requests/${request.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(convertTarget === "mandate" ? "Demande convertie en mandat" : `Devis ${data.quoteNumber} créé`);
        setConvertOpen(false);
        setConvertAmount("");
        await refresh();
        // Ouvre l'entite creee
        if (data.mandateId) openEntity("mandate", data.mandateId);
        else if (data.quoteId) openEntity("quote", data.quoteId);
      } else {
        toast.error(data.error || "Erreur de conversion");
      }
    } finally { setBusy(false); }
  };

  const isConverted = request?.status === "converted";

  return (
    <DetailPanelBase
      open={open}
      onOpenChange={onOpenChange}
      loading={loading || !request}
      title={request?.title ?? "Demande"}
      subtitle={request?.client ? `${request.client.fullName}${request.client.companyName ? ` · ${request.client.companyName}` : ""}` : undefined}
      icon={<Inbox className="h-7 w-7 text-white" />}
      headerStats={
        request ? (
          <div className="grid grid-cols-3 gap-2">
            <PanelStatBox icon={Tag} label={tc("status")} value={
              request.status === "new" ? "Nouvelle"
              : request.status === "in_progress" ? "Traitement"
              : request.status === "converted" ? "Convertie"
              : "Fermée"
            } />
            <PanelStatBox icon={AlertTriangle} label="Urgence" value={URGENCY_LABELS[request.urgency] ?? request.urgency} />
            <PanelStatBox icon={DollarSign} label="Budget" value={request.budgetRange ?? "—"} />
          </div>
        ) : undefined
      }
      headerActions={
        request ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {request.client && (
              <Button size="sm" variant="secondary" disabled={busy}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
                onClick={() => openEntity("client", request.clientId)}>
                <User className="h-3 w-3" />Voir client
              </Button>
            )}
            {!isConverted && (
              <Button size="sm" variant="secondary" disabled={busy}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
                onClick={() => { setConvertTarget("mandate"); setConvertOpen(true); }}>
                <Briefcase className="h-3 w-3" />Convertir
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      {request && (
        <div className="space-y-4">
          {/* Bandeau converti — si applicable */}
          {isConverted && (request.convertedToMandateId || request.convertedToQuoteId) && (
            <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <Check className="h-4 w-4" />
                  <span className="font-medium">
                    {request.convertedToMandateId ? "Convertie en mandat" : "Convertie en devis"}
                  </span>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() => {
                    if (request.convertedToMandateId) openEntity("mandate", request.convertedToMandateId);
                    else if (request.convertedToQuoteId) openEntity("quote", request.convertedToQuoteId);
                  }}>
                  <ExternalLink className="h-3 w-3 mr-1" />{tc("view")}
                </Button>
              </div>
            </div>
          )}

          {/* Section Statut & traitement */}
          <PanelSection icon={Tag} title="Statut & traitement">
            <EditableField
              label={tc("status")}
              display={<StatusBadge status={request.status} />}
              renderEdit={(v, setV) => (
                <Select value={v} onValueChange={setV}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Nouvelle</SelectItem>
                    <SelectItem value="in_progress">En traitement</SelectItem>
                    <SelectItem value="converted" disabled={!isConverted}>Convertie</SelectItem>
                    <SelectItem value="closed">Fermée</SelectItem>
                  </SelectContent>
                </Select>
              )}
              initialValue={request.status}
              onSave={(v) => patch({ status: v }, "Statut modifié")}
              disabled={busy}
            />
            <EditableField
              label="Urgence"
              display={
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", URGENCY_COLORS[request.urgency] ?? "bg-gray-100 text-gray-700")}>
                  {URGENCY_LABELS[request.urgency] ?? request.urgency}
                </span>
              }
              renderEdit={(v, setV) => (
                <Select value={v} onValueChange={setV}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="critical">Critique</SelectItem>
                  </SelectContent>
                </Select>
              )}
              initialValue={request.urgency}
              onSave={(v) => patch({ urgency: v }, "Urgence modifiée")}
              disabled={busy}
            />
            <InfoRow label="Reçue le" value={formatDate(new Date(request.createdAt))} />
            <InfoRow label="Dernière mise à jour" value={formatDate(new Date(request.updatedAt))} />
          </PanelSection>

          {/* Section Détails projet */}
          <PanelSection icon={FileText} title="Détails du projet">
            <EditableField
              label="Service"
              display={<span className="text-sm">{request.serviceType ? (SERVICE_LABELS[request.serviceType] ?? request.serviceType) : "—"}</span>}
              renderEdit={(v, setV) => (
                <Select value={v} onValueChange={setV}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SERVICE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              initialValue={request.serviceType ?? ""}
              onSave={(v) => patch({ serviceType: v || null }, "Service modifié")}
              disabled={busy}
            />
            <EditableField
              label="Marque PLC"
              display={<span className="text-sm">{request.plcBrand ?? "—"}</span>}
              renderEdit={(v, setV) => <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="Siemens, Allen-Bradley, etc." />}
              initialValue={request.plcBrand ?? ""}
              onSave={(v) => patch({ plcBrand: v.trim() || null }, "Marque PLC modifiée")}
              disabled={busy}
            />
            <EditableField
              label="Budget estimé"
              display={<span className="text-sm">{request.budgetRange ?? "—"}</span>}
              renderEdit={(v, setV) => <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="Ex : 5 000 - 10 000 $" />}
              initialValue={request.budgetRange ?? ""}
              onSave={(v) => patch({ budgetRange: v.trim() || null }, "Budget modifié")}
              disabled={busy}
            />
          </PanelSection>

          {/* Description complète */}
          <PanelSection icon={FileText} title="Description">
            <EditableTextarea
              display={request.description}
              initialValue={request.description}
              onSave={(v) => v.trim() ? patch({ description: v.trim() }, "Description modifiée") : false}
              disabled={busy}
              rows={5}
            />
          </PanelSection>

          {/* Coordonnées client */}
          {request.client && (
            <PanelSection icon={User} title="Contact client">
              <InfoRow label="Nom" value={request.client.fullName} />
              {request.client.companyName && <InfoRow label="Entreprise" value={request.client.companyName} />}
              <InfoRow label="Courriel" value={request.client.email} />
              {request.client.phone && <InfoRow label="Téléphone" value={request.client.phone} />}
            </PanelSection>
          )}

          {/* Zone danger : delete */}
          <PanelSection icon={Cpu} title="Actions avancées">
            <Button
              variant="outline"
              className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              disabled={busy}
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />Supprimer la demande
            </Button>
          </PanelSection>
        </div>
      )}

      {ConfirmModal}

      {/* Dialog conversion en mandat / devis */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-white">Convertir la demande</DialogTitle>
                <DialogDescription className="text-white/70 mt-0.5">
                  Crée un mandat ou un devis depuis cette demande
                </DialogDescription>
              </div>
            </div>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConvertTarget("mandate")}
                className={cn(
                  "p-3 rounded-lg border-2 text-left transition-all",
                  convertTarget === "mandate"
                    ? "border-[#0F2D52] bg-[#0F2D52]/5"
                    : "border-input hover:border-muted-foreground/30"
                )}
              >
                <Briefcase className="h-5 w-5 text-[#0F2D52] mb-2" />
                <p className="font-semibold text-sm">Mandat</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Travail récurrent / suivi</p>
              </button>
              <button
                type="button"
                onClick={() => setConvertTarget("quote")}
                className={cn(
                  "p-3 rounded-lg border-2 text-left transition-all",
                  convertTarget === "quote"
                    ? "border-[#0F2D52] bg-[#0F2D52]/5"
                    : "border-input hover:border-muted-foreground/30"
                )}
              >
                <FileText className="h-5 w-5 text-[#0F2D52] mb-2" />
                <p className="font-semibold text-sm">Devis</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Proposition tarifée</p>
              </button>
            </div>

            {convertTarget === "quote" && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Montant HT *</Label>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={convertAmount}
                  onChange={(e) => setConvertAmount(e.target.value)}
                  placeholder="5000"
                />
                <p className="text-[10px] text-muted-foreground">Les taxes (TPS+TVQ) seront calculées automatiquement</p>
              </div>
            )}

            <div className="rounded-lg bg-muted/30 p-3 text-xs space-y-1">
              <p className="text-muted-foreground">Le titre, la description et le service seront copiés depuis la demande.</p>
              <p className="text-muted-foreground">La demande passera au statut « Convertie ».</p>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-card sm:gap-2">
            <Button variant="outline" onClick={() => setConvertOpen(false)} disabled={busy}>{tc("cancel")}</Button>
            <Button
              onClick={handleConvert}
              disabled={busy || (convertTarget === "quote" && !convertAmount)}
              className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white shadow-md"
            >
              {busy ? "Conversion…" : convertTarget === "mandate" ? "Créer le mandat" : "Créer le devis"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DetailPanelBase>
  );
}

// ─── Sous-composants partagés (mêmes patterns que MandateDetailPanel) ──

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
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 disabled:opacity-50">
              <Pencil className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function EditableTextarea({
  display, initialValue, onSave, disabled, rows = 4,
}: {
  display: string | null;
  initialValue: string;
  onSave: (v: string) => Promise<boolean | void> | boolean | void;
  disabled?: boolean;
  rows?: number;
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
        <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={rows} autoFocus />
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
      className="w-full text-left p-3 rounded-md border bg-card hover:border-[#0F2D52]/30 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm whitespace-pre-wrap leading-relaxed flex-1">{display}</p>
        <Pencil className="h-3 w-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}
