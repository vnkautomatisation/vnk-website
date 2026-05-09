"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Briefcase, FileText, Receipt, FileSignature, FolderOpen, ListChecks,
  Calendar, Clock, User, ExternalLink, CheckCircle2, Pencil, Plus,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  quotes: Array<{ id: number; quoteNumber: string; title: string; status: string; amountTtc: number | string; expiryDate: string | null }>;
  contracts: Array<{ id: number; contractNumber: string; title: string; status: string; amountTtc: number | string | null; signedAt: string | null }>;
  invoices: Array<{ id: number; invoiceNumber: string; status: string; amountTtc: number | string; dueDate: string | null }>;
  documents: Array<{ id: number; title: string; fileType: string | null; category: string | null; createdAt: string }>;
  logs: Array<{ id: number; action: string; description: string | null; createdBy: string; createdAt: string }>;
};

const SERVICE_LABELS: Record<string, string> = {
  "plc-support": "Support PLC",
  "audit": "Audit technique",
  "documentation": "Documentation",
  "refactoring": "Refactorisation",
};

export function MandateDetailPanel({
  mandateId,
  open,
  onOpenChange,
}: {
  mandateId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { open: openEntity } = useEntityPanels();
  const { confirm, ConfirmModal } = useConfirm();
  const [mandate, setMandate] = useState<MandateFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!mandateId || !open) return;
    setLoading(true);
    fetch(`/api/mandates/${mandateId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setMandate(data.mandate))
      .finally(() => setLoading(false));
  }, [mandateId, open]);

  const refresh = async () => {
    if (!mandateId) return;
    const res = await fetch(`/api/mandates/${mandateId}`, { cache: "no-store" });
    const data = await res.json();
    setMandate(data.mandate);
    router.refresh();
  };

  const updateProgress = async (newProgress: number) => {
    if (!mandate) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/mandates/${mandate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress: newProgress }),
      });
      if (res.ok) { toast.success("Progression mise a jour"); await refresh(); }
      else { const d = await res.json(); toast.error(d.error || "Erreur"); }
    } finally { setBusy(false); }
  };

  const markCompleted = async () => {
    if (!mandate) return;
    const ok = await confirm({
      title: "Marquer comme terminé ?",
      description: `Le mandat "${mandate.title}" sera marqué comme complété (100%, statut completed).`,
      confirmLabel: "Marquer terminé",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/mandates/${mandate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", progress: 100 }),
      });
      if (res.ok) { toast.success("Mandat terminé"); await refresh(); }
      else { const d = await res.json(); toast.error(d.error || "Erreur"); }
    } finally { setBusy(false); }
  };

  const total = mandate
    ? mandate.quotes.length + mandate.contracts.length + mandate.invoices.length + mandate.documents.length
    : 0;

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
          <div className="grid grid-cols-4 gap-2">
            <PanelStatBox icon={FileText} label="Devis" value={mandate.quotes.length} />
            <PanelStatBox icon={FileSignature} label="Contrats" value={mandate.contracts.length} />
            <PanelStatBox icon={Receipt} label="Factures" value={mandate.invoices.length} />
            <PanelStatBox icon={FolderOpen} label="Docs" value={mandate.documents.length} />
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
            <Button size="sm" variant="secondary" disabled={busy}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
              onClick={() => router.push(`/admin/quotes?newFor=${mandate.client.id}`)}>
              <Plus className="h-3 w-3" />Devis
            </Button>
            {mandate.status !== "completed" && (
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
        <Tabs defaultValue="info">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="info">Infos</TabsTrigger>
            <TabsTrigger value="related">Lies ({total})</TabsTrigger>
            <TabsTrigger value="docs">Docs ({mandate.documents.length})</TabsTrigger>
            <TabsTrigger value="logs">Activite</TabsTrigger>
          </TabsList>

          {/* Infos */}
          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Statut</span>
                <StatusBadge status={mandate.status} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Progression</span>
                  <span className="text-sm font-bold">{mandate.progress}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={mandate.progress}
                  onChange={(e) => updateProgress(Number(e.target.value))}
                  disabled={busy || mandate.status === "completed"}
                  className="w-full"
                />
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${mandate.progress}%` }} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoCell icon={Calendar} label="Debut" value={mandate.startDate ? formatDate(new Date(mandate.startDate)) : "—"} />
              <InfoCell icon={Calendar} label="Fin estimee" value={mandate.endDate ? formatDate(new Date(mandate.endDate)) : "—"} />
              <InfoCell icon={Briefcase} label="Service" value={mandate.serviceType ? (SERVICE_LABELS[mandate.serviceType] ?? mandate.serviceType) : "—"} />
              <InfoCell icon={Clock} label="Heures" value={`${mandate.actualHours ?? 0}h / ${mandate.estimatedHours ?? "—"}h`} />
            </div>

            {mandate.description && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Description</p>
                <p className="text-sm whitespace-pre-wrap">{mandate.description}</p>
              </div>
            )}
            {mandate.notes && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Notes</p>
                <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-xs whitespace-pre-wrap">{mandate.notes}</div>
              </div>
            )}
          </TabsContent>

          {/* Lies */}
          <TabsContent value="related" className="space-y-3 mt-4">
            {mandate.quotes.length > 0 && (
              <Section title={`Devis (${mandate.quotes.length})`} icon={FileText}>
                {mandate.quotes.map((q) => (
                  <RowLink key={q.id} onClick={() => openEntity("quote", q.id)}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-muted-foreground font-mono">{q.quoteNumber}</p>
                      <p className="text-sm font-medium truncate">{q.title}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusBadge status={q.status} />
                      <p className="text-sm font-bold mt-0.5">{formatCurrency(Number(q.amountTtc))}</p>
                    </div>
                  </RowLink>
                ))}
              </Section>
            )}
            {mandate.contracts.length > 0 && (
              <Section title={`Contrats (${mandate.contracts.length})`} icon={FileSignature}>
                {mandate.contracts.map((c) => (
                  <RowLink key={c.id} onClick={() => openEntity("contract", c.id)}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-muted-foreground font-mono">{c.contractNumber}</p>
                      <p className="text-sm font-medium truncate">{c.title}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusBadge status={c.status} />
                      {c.amountTtc != null && <p className="text-sm font-bold mt-0.5">{formatCurrency(Number(c.amountTtc))}</p>}
                    </div>
                  </RowLink>
                ))}
              </Section>
            )}
            {mandate.invoices.length > 0 && (
              <Section title={`Factures (${mandate.invoices.length})`} icon={Receipt}>
                {mandate.invoices.map((i) => (
                  <RowLink key={i.id} onClick={() => openEntity("invoice", i.id)}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-muted-foreground font-mono">{i.invoiceNumber}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {i.dueDate ? `Échéance ${formatDate(new Date(i.dueDate))}` : "—"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusBadge status={i.status} />
                      <p className="text-sm font-bold mt-0.5">{formatCurrency(Number(i.amountTtc))}</p>
                    </div>
                  </RowLink>
                ))}
              </Section>
            )}
            {total === 0 && <PanelEmptyState text="Aucun devis/contrat/facture lie a ce mandat" icon={ListChecks} />}
          </TabsContent>

          {/* Docs */}
          <TabsContent value="docs" className="space-y-2 mt-4">
            {mandate.documents.length === 0 ? (
              <PanelEmptyState text="Aucun document" icon={FolderOpen} />
            ) : (
              mandate.documents.map((d) => (
                <div key={d.id} className="p-3 rounded-lg border bg-card flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{d.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {d.category ?? "Document"} · {d.fileType ?? "fichier"} · {formatDate(new Date(d.createdAt))}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{d.fileType ?? "PDF"}</Badge>
                </div>
              ))
            )}
          </TabsContent>

          {/* Activite */}
          <TabsContent value="logs" className="space-y-2 mt-4">
            {mandate.logs.length === 0 ? (
              <PanelEmptyState text="Aucune activité enregistrée" icon={ListChecks} />
            ) : (
              mandate.logs.map((l) => (
                <div key={l.id} className="p-3 rounded-lg border-l-4 border-l-primary bg-card">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">{l.action}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(new Date(l.createdAt))}</p>
                  </div>
                  {l.description && <p className="text-sm mt-1">{l.description}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">par {l.createdBy}</p>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}

      {ConfirmModal}
    </DetailPanelBase>
  );
}

function InfoCell({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="text-sm font-medium truncate">{value}</p>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function RowLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full p-3 rounded-lg border bg-card hover:shadow-sm hover:border-primary transition-all flex items-start justify-between gap-2 text-left"
    >
      {children}
      <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />
    </button>
  );
}
