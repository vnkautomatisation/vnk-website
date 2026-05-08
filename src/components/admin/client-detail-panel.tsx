"use client";
// Client Detail Panel — slide-out right
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/admin/status-badge";
import { useConfirm } from "@/hooks/use-confirm";
import { initials, formatCurrency, formatDate } from "@/lib/utils";
import {
  Mail,
  Phone,
  MapPin,
  Building2,
  Plus,
  MessageSquare,
  Briefcase,
  FileText,
  Receipt,
  FileSignature,
  MoreHorizontal,
  CreditCard,
  CheckCircle2,
  PenTool,
  Send,
  ExternalLink,
} from "lucide-react";

type ClientFull = {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  city: string | null;
  province: string | null;
  sector: string | null;
  technologies: string | null;
  createdAt: Date;
  lastLogin: Date | null;
  mandates: Array<{ id: number; title: string; status: string; progress: number }>;
  quotes: Array<{ id: number; quoteNumber: string; title: string; status: string; amountTtc: any; expiryDate: Date | null }>;
  invoices: Array<{ id: number; invoiceNumber: string; status: string; amountTtc: any; dueDate: Date | null }>;
  contracts: Array<{ id: number; contractNumber: string; status: string }>;
};

export function ClientDetailPanel({
  clientId,
  open,
  onOpenChange,
}: {
  clientId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { confirm, ConfirmModal } = useConfirm();
  const [client, setClient] = useState<ClientFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!clientId || !open) return;
    setLoading(true);
    fetch(`/api/clients/${clientId}`)
      .then((r) => r.json())
      .then((data) => setClient(data.client))
      .finally(() => setLoading(false));
  }, [clientId, open]);

  const refresh = async () => {
    if (!clientId) return;
    const res = await fetch(`/api/clients/${clientId}`);
    const data = await res.json();
    setClient(data.client);
    router.refresh();
  };

  const acceptQuote = async (id: number, num: string) => {
    const ok = await confirm({
      title: "Accepter ce devis ?",
      description: `Le devis ${num} sera marque comme accepte et un contrat sera genere automatiquement.`,
      confirmLabel: "Accepter",
      variant: "default",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/quotes/${id}/accept`, { method: "POST" });
      if (res.ok) { toast.success("Devis accepte"); await refresh(); }
      else { const d = await res.json(); toast.error(d.error || "Erreur"); }
    } finally { setBusy(false); }
  };

  const markPaid = async (id: number, num: string) => {
    const ok = await confirm({
      title: "Marquer comme payee ?",
      description: `La facture ${num} sera marquee comme payee.`,
      confirmLabel: "Marquer payee",
      variant: "default",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/invoices/${id}/mark-paid`, { method: "POST" });
      if (res.ok) { toast.success("Facture marquee payee"); await refresh(); }
      else { const d = await res.json(); toast.error(d.error || "Erreur"); }
    } finally { setBusy(false); }
  };

  const signContract = async (id: number) => {
    const ok = await confirm({
      title: "Signer ce contrat ?",
      description: "Vous allez apposer votre signature en tant qu'administrateur. Cette action sera enregistree.",
      confirmLabel: "Signer",
      variant: "default",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/contracts/${id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureData: "admin-signed-via-panel" }),
      });
      if (res.ok) { toast.success("Contrat signe"); await refresh(); }
      else { const d = await res.json(); toast.error(d.error || "Erreur"); }
    } finally { setBusy(false); }
  };

  if (!client && !loading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl" />
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 overflow-hidden flex flex-col">
        {loading || !client ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Chargement…
          </div>
        ) : (
          <>
            {/* Header gradient navy */}
            <SheetHeader className="bg-gradient-to-br from-[#0F2D52] to-[#1e4a7e] text-white p-6 space-y-4 shrink-0">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 ring-2 ring-white/20">
                  <AvatarFallback className="bg-white/10 text-white text-lg font-bold backdrop-blur">
                    {initials(client.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-xl text-white truncate">{client.fullName}</SheetTitle>
                  <SheetDescription className="text-white/70">
                    {client.companyName}
                    {client.city && ` · ${client.city}`}
                  </SheetDescription>
                </div>
              </div>

              {/* Quick stats colorees */}
              <div className="grid grid-cols-4 gap-2">
                <StatBox icon={Briefcase} label="Mandats" value={client.mandates.length} />
                <StatBox icon={FileText} label="Devis" value={client.quotes.length} />
                <StatBox icon={Receipt} label="Factures" value={client.invoices.length} />
                <StatBox icon={FileSignature} label="Contrats" value={client.contracts.length} />
              </div>

              {/* Sticky actions — toujours visibles */}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="secondary" asChild className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
                  <Link href={`/admin/mandates?newFor=${client.id}`}>
                    <Plus className="h-3 w-3" />Mandat
                  </Link>
                </Button>
                <Button size="sm" variant="secondary" asChild className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
                  <Link href={`/admin/quotes?newFor=${client.id}`}>
                    <Plus className="h-3 w-3" />Devis
                  </Link>
                </Button>
                <Button size="sm" variant="secondary" asChild className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
                  <Link href={`/admin/invoices?newFor=${client.id}`}>
                    <Plus className="h-3 w-3" />Facture
                  </Link>
                </Button>
                <Button size="sm" variant="secondary" asChild className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
                  <Link href={`/admin/messages?clientId=${client.id}`}>
                    <MessageSquare className="h-3 w-3" />Message
                  </Link>
                </Button>
              </div>
            </SheetHeader>

            {/* Tabs scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              <Tabs defaultValue="info">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="info">Infos</TabsTrigger>
                  <TabsTrigger value="mandates">Mandats</TabsTrigger>
                  <TabsTrigger value="quotes">Devis</TabsTrigger>
                  <TabsTrigger value="invoices">Factures</TabsTrigger>
                  <TabsTrigger value="contracts">Contrats</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-3 mt-4">
                  <InfoRow icon={Mail} label="Courriel" value={client.email} />
                  <InfoRow icon={Phone} label="Telephone" value={client.phone ?? "—"} />
                  <InfoRow icon={Building2} label="Entreprise" value={client.companyName ?? "—"} />
                  <InfoRow icon={MapPin} label="Localisation" value={`${client.city ?? ""} ${client.province ?? ""}`.trim() || "—"} />
                  {client.technologies && (
                    <div className="pt-2">
                      <p className="text-xs text-muted-foreground mb-2">Technologies</p>
                      <div className="flex flex-wrap gap-1">
                        {client.technologies.split(",").map((t, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{t.trim()}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="mandates" className="space-y-2 mt-4">
                  {client.mandates.length === 0 ? (
                    <EmptyState text="Aucun mandat" actionLabel="Creer un mandat" actionHref={`/admin/mandates?newFor=${client.id}`} />
                  ) : (
                    client.mandates.map((m) => (
                      <div key={m.id} className="p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{m.title}</p>
                            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-primary transition-all" style={{ width: `${m.progress}%` }} />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">{m.progress}% complete</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <StatusBadge status={m.status} />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="quotes" className="space-y-2 mt-4">
                  {client.quotes.length === 0 ? (
                    <EmptyState text="Aucun devis" actionLabel="Creer un devis" actionHref={`/admin/quotes?newFor=${client.id}`} />
                  ) : (
                    client.quotes.map((q) => (
                      <EntityRow
                        key={q.id}
                        ref1={q.quoteNumber}
                        title={q.title}
                        secondary={q.expiryDate ? `Expire le ${formatDate(q.expiryDate)}` : undefined}
                        amount={Number(q.amountTtc)}
                        status={q.status}
                        actions={[
                          ...(q.status === "pending" ? [{
                            label: "Marquer accepte",
                            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
                            onClick: () => acceptQuote(q.id, q.quoteNumber),
                          }] : []),
                          {
                            label: "Voir PDF",
                            icon: <ExternalLink className="h-3.5 w-3.5" />,
                            onClick: () => window.open(`/api/quotes/${q.id}/pdf`, "_blank"),
                          },
                        ]}
                        busy={busy}
                      />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="invoices" className="space-y-2 mt-4">
                  {client.invoices.length === 0 ? (
                    <EmptyState text="Aucune facture" actionLabel="Creer une facture" actionHref={`/admin/invoices?newFor=${client.id}`} />
                  ) : (
                    client.invoices.map((i) => (
                      <EntityRow
                        key={i.id}
                        ref1={i.invoiceNumber}
                        secondary={i.dueDate ? `Echeance ${formatDate(i.dueDate)}` : undefined}
                        amount={Number(i.amountTtc)}
                        status={i.status}
                        alert={i.status === "overdue"}
                        actions={[
                          ...(i.status === "unpaid" || i.status === "overdue" ? [{
                            label: "Marquer payee",
                            icon: <CreditCard className="h-3.5 w-3.5" />,
                            onClick: () => markPaid(i.id, i.invoiceNumber),
                          }] : []),
                          {
                            label: "Voir PDF",
                            icon: <ExternalLink className="h-3.5 w-3.5" />,
                            onClick: () => window.open(`/api/invoices/${i.id}/pdf`, "_blank"),
                          },
                          ...(i.status === "unpaid" || i.status === "overdue" ? [{
                            label: "Relancer",
                            icon: <Send className="h-3.5 w-3.5" />,
                            onClick: () => router.push(`/admin/messages?clientId=${client.id}`),
                          }] : []),
                        ]}
                        busy={busy}
                      />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="contracts" className="space-y-2 mt-4">
                  {client.contracts.length === 0 ? (
                    <EmptyState text="Aucun contrat" />
                  ) : (
                    client.contracts.map((c) => (
                      <EntityRow
                        key={c.id}
                        ref1={c.contractNumber}
                        status={c.status}
                        actions={[
                          ...(c.status === "pending" ? [{
                            label: "Signer admin",
                            icon: <PenTool className="h-3.5 w-3.5" />,
                            onClick: () => signContract(c.id),
                          }] : []),
                          {
                            label: "Voir PDF",
                            icon: <ExternalLink className="h-3.5 w-3.5" />,
                            onClick: () => window.open(`/api/contracts/${c.id}/pdf`, "_blank"),
                          },
                        ]}
                        busy={busy}
                      />
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
        {ConfirmModal}
      </SheetContent>
    </Sheet>
  );
}

function StatBox({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/10 backdrop-blur border border-white/10 p-2.5 text-center">
      <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider text-white/60 font-semibold">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="text-xl font-bold mt-0.5 text-white">{value}</p>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ text, actionLabel, actionHref }: { text: string; actionLabel?: string; actionHref?: string }) {
  return (
    <div className="text-center py-10 px-6 rounded-lg border-2 border-dashed">
      <p className="text-sm text-muted-foreground">{text}</p>
      {actionLabel && actionHref && (
        <Button size="sm" variant="outline" className="mt-3" asChild>
          <Link href={actionHref}><Plus className="h-3 w-3" />{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}

function EntityRow({
  ref1,
  title,
  secondary,
  amount,
  status,
  actions,
  alert,
  busy,
}: {
  ref1: string;
  title?: string;
  secondary?: string;
  amount?: number;
  status?: string;
  actions?: Array<{ label: string; icon: React.ReactNode; onClick: () => void }>;
  alert?: boolean;
  busy?: boolean;
}) {
  return (
    <div className={`p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow flex items-start justify-between gap-2 ${alert ? "border-red-300" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground font-mono">{ref1}</p>
        {title && <p className="text-sm font-medium truncate mt-0.5">{title}</p>}
        {secondary && <p className="text-[11px] text-muted-foreground mt-0.5">{secondary}</p>}
      </div>
      <div className="text-right shrink-0 flex flex-col items-end gap-1">
        {status && <StatusBadge status={status} />}
        {amount !== undefined && <p className="text-sm font-bold">{formatCurrency(amount)}</p>}
      </div>
      {actions && actions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button disabled={busy} className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted transition-colors disabled:opacity-50">
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {actions.map((a, i) => (
              <DropdownMenuItem key={i} onClick={a.onClick} disabled={busy}>
                <span className="mr-2">{a.icon}</span>{a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
