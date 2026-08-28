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

const URGENCY_KEYS: Record<string, string> = {
  normal: "normal",
  urgent: "urgent",
  critical: "critique",
};

const URGENCY_COLORS: Record<string, string> = {
  normal: "bg-blue-100 text-blue-700 border-blue-200",
  urgent: "bg-amber-100 text-amber-700 border-amber-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

const SERVICE_KEYS: Record<string, string> = {
  "plc-support": "support_plc",
  "plc-programming": "programmation_plc",
  "scada": "scada",
  "hmi": "interface_hmi",
  "web-development": "developpement_web",
  "automation": "automatisation",
  "consulting": "consultation",
  "maintenance": "maintenance",
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
  const t = useTranslations("admin.requests");
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
      toast.error(d.error || t("erreur"));
      return false;
    } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!request) return;
    const ok = await confirm({
      title: t("supprimer_demande"),
      description: t("request_detail_panel_la_demande_p0_sera_supprimee_definitivement", { p0: request.title }),
      confirmLabel: t("supprimer"),
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/project-requests/${request.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("demande_supprimee"));
        onOpenChange(false);
        router.refresh();
      } else { const d = await res.json(); toast.error(d.error || t("erreur")); }
    } finally { setBusy(false); }
  };

  const handleConvert = async () => {
    if (!request) return;
    const body: Record<string, unknown> = { target: convertTarget };
    if (convertTarget === "quote") {
      const amt = Number(convertAmount);
      if (!amt || Number.isNaN(amt) || amt <= 0) {
        toast.error(t("montant_ht_invalide"));
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
        toast.success(convertTarget === "mandate" ? t("demande_convertie_mandat") : t("request_detail_panel_devis_p0_cree", { p0: data.quoteNumber }));
        setConvertOpen(false);
        setConvertAmount("");
        await refresh();

        if (data.mandateId) openEntity("mandate", data.mandateId);
        else if (data.quoteId) openEntity("quote", data.quoteId);
      } else {
        toast.error(data.error || t("erreur_conversion"));
      }
    } finally { setBusy(false); }
  };

  const isConverted = request?.status === "converted";

  return (
    <DetailPanelBase
      open={open}
      onOpenChange={onOpenChange}
      loading={loading || !request}
      title={request?.title ?? t("demande")}
      subtitle={request?.client ? `${request.client.fullName}${request.client.companyName ? ` · ${request.client.companyName}` : ""}` : undefined}
      icon={<Inbox className="h-7 w-7 text-white" />}
      headerStats={
        request ? (
          <div className="grid grid-cols-3 gap-2">
            <PanelStatBox icon={Tag} label={tc("status")} value={
              request.status === "new" ? t("nouvelle")
              : request.status === "in_progress" ? t("traitement")
              : request.status === "converted" ? t("convertie")
              : t("fermee")
            } />
            <PanelStatBox icon={AlertTriangle} label={t("urgence")} value={URGENCY_KEYS[request.urgency] ? t(URGENCY_KEYS[request.urgency]) : request.urgency} />
            <PanelStatBox icon={DollarSign} label={t("budget")} value={request.budgetRange ?? "—"} />
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

          {isConverted && (request.convertedToMandateId || request.convertedToQuoteId) && (
            <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <Check className="h-4 w-4" />
                  <span className="font-medium">
                    {request.convertedToMandateId ? t("convertie_mandat") : t("convertie_devis")}
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


          <PanelSection icon={Tag} title={t("statut_traitement")}>
            <EditableField
              label={tc("status")}
              display={<StatusBadge status={request.status} />}
              renderEdit={(v, setV) => (
                <Select value={v} onValueChange={setV}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">{t("nouvelle")}</SelectItem>
                    <SelectItem value="in_progress">{t("traitement")}</SelectItem>
                    <SelectItem value="converted" disabled={!isConverted}>{t("convertie")}</SelectItem>
                    <SelectItem value="closed">{t("fermee")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
              initialValue={request.status}
              onSave={(v) => patch({ status: v }, t("statut_modifie"))}
              disabled={busy}
            />
            <EditableField
              label={t("urgence")}
              display={
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", URGENCY_COLORS[request.urgency] ?? "bg-gray-100 text-gray-700")}>
                  {URGENCY_KEYS[request.urgency] ? t(URGENCY_KEYS[request.urgency]) : request.urgency}
                </span>
              }
              renderEdit={(v, setV) => (
                <Select value={v} onValueChange={setV}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">{t("normal")}</SelectItem>
                    <SelectItem value="urgent">{t("urgent")}</SelectItem>
                    <SelectItem value="critical">{t("critique")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
              initialValue={request.urgency}
              onSave={(v) => patch({ urgency: v }, t("urgence_modifiee"))}
              disabled={busy}
            />
            <InfoRow label={t("recue")} value={formatDate(new Date(request.createdAt))} />
            <InfoRow label={t("derniere_mise_jour")} value={formatDate(new Date(request.updatedAt))} />
          </PanelSection>


          <PanelSection icon={FileText} title={t("details_projet")}>
            <EditableField
              label={t("service")}
              display={<span className="text-sm">{request.serviceType ? (SERVICE_KEYS[request.serviceType] ? t(SERVICE_KEYS[request.serviceType]) : request.serviceType) : "—"}</span>}
              renderEdit={(v, setV) => (
                <Select value={v} onValueChange={setV}>
                  <SelectTrigger><SelectValue placeholder={t("choisir")} /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SERVICE_KEYS).map(([val, key]) => (
                      <SelectItem key={val} value={val}>{t(key)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              initialValue={request.serviceType ?? ""}
              onSave={(v) => patch({ serviceType: v || null }, t("service_modifie"))}
              disabled={busy}
            />
            <EditableField
              label={t("marque_plc")}
              display={<span className="text-sm">{request.plcBrand ?? "—"}</span>}
              renderEdit={(v, setV) => <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={t("siemens_allen_bradley_etc")} />}
              initialValue={request.plcBrand ?? ""}
              onSave={(v) => patch({ plcBrand: v.trim() || null }, t("marque_plc_modifiee"))}
              disabled={busy}
            />
            <EditableField
              label={t("budget_estime")}
              display={<span className="text-sm">{request.budgetRange ?? "—"}</span>}
              renderEdit={(v, setV) => <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={t("ex_5_000_10_000")} />}
              initialValue={request.budgetRange ?? ""}
              onSave={(v) => patch({ budgetRange: v.trim() || null }, t("budget_modifie"))}
              disabled={busy}
            />
          </PanelSection>


          <PanelSection icon={FileText} title={t("description")}>
            <EditableTextarea
              display={request.description}
              initialValue={request.description}
              onSave={(v) => v.trim() ? patch({ description: v.trim() }, t("description_modifiee")) : false}
              disabled={busy}
              rows={5}
            />
          </PanelSection>


          {request.client && (
            <PanelSection icon={User} title={t("contact_client")}>
              <InfoRow label={t("nom")} value={request.client.fullName} />
              {request.client.companyName && <InfoRow label={t("entreprise")} value={request.client.companyName} />}
              <InfoRow label={t("courriel")} value={request.client.email} />
              {request.client.phone && <InfoRow label={t("telephone")} value={request.client.phone} />}
            </PanelSection>
          )}


          <PanelSection icon={Cpu} title={t("actions_avancees")}>
            <Button
              variant="outline"
              className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              disabled={busy}
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />{t("request_detail_panel_supprimer_la_demande")}</Button>
          </PanelSection>
        </div>
      )}

      {ConfirmModal}


      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-white">{t("convertir_demande")}</DialogTitle>
                <DialogDescription className="text-white/70 mt-0.5">
                  {t("cree_mandat_devis_depuis_demande")}
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
                <p className="font-semibold text-sm">{t("mandat")}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t("travail_recurrent_suivi")}</p>
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
                <p className="font-semibold text-sm">{t("devis")}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t("proposition_tarifee")}</p>
              </button>
            </div>

            {convertTarget === "quote" && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("montant_ht")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={convertAmount}
                  onChange={(e) => setConvertAmount(e.target.value)}
                  placeholder="5000"
                />
                <p className="text-[10px] text-muted-foreground">{t("taxes_tps_tvq_seront_calculees")}</p>
              </div>
            )}

            <div className="rounded-lg bg-muted/30 p-3 text-xs space-y-1">
              <p className="text-muted-foreground">{t("titre_description_service_seront_copies")}</p>
              <p className="text-muted-foreground">{t("demande_passera_statut_convertie")}</p>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-card sm:gap-2">
            <Button variant="outline" onClick={() => setConvertOpen(false)} disabled={busy}>{tc("cancel")}</Button>
            <Button
              onClick={handleConvert}
              disabled={busy || (convertTarget === "quote" && !convertAmount)}
              className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white shadow-md"
            >
              {busy ? t("conversion_cours") : convertTarget === "mandate" ? t("creer_mandat") : t("creer_devis")}
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
