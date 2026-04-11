"use client";
// Client Detail Panel — slide-out right
import { useState, useEffect } from "react";
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
import { StatusBadge } from "@/components/admin/status-badge";
import { initials, formatCurrency, formatDate } from "@/lib/utils";
import {
  Mail,
  Phone,
  MapPin,
  Building2,
  Plus,
  FileText,
  Receipt,
  Briefcase,
  FolderOpen,
  MessageSquare,
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
  const [client, setClient] = useState<ClientFull | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId || !open) return;
    setLoading(true);
    fetch(`/api/clients/${clientId}`)
      .then((r) => r.json())
      .then((data) => setClient(data.client))
      .finally(() => setLoading(false));
  }, [clientId, open]);

  if (!client && !loading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl" />
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {loading || !client ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Chargement…
          </div>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="vnk-gradient text-white text-lg">
                    {initials(client.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <SheetTitle className="text-xl">{client.fullName}</SheetTitle>
                  <SheetDescription>
                    {client.companyName}
                    {client.city && ` · ${client.city}`}
                  </SheetDescription>
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="text-center p-2 rounded bg-muted">
                  <p className="text-[10px] text-muted-foreground uppercase">Mandats</p>
                  <p className="text-lg font-bold">{client.mandates.length}</p>
                </div>
                <div className="text-center p-2 rounded bg-muted">
                  <p className="text-[10px] text-muted-foreground uppercase">Devis</p>
                  <p className="text-lg font-bold">{client.quotes.length}</p>
                </div>
                <div className="text-center p-2 rounded bg-muted">
                  <p className="text-[10px] text-muted-foreground uppercase">Factures</p>
                  <p className="text-lg font-bold">{client.invoices.length}</p>
                </div>
              </div>
            </SheetHeader>

            <Tabs defaultValue="info" className="mt-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="info">Infos</TabsTrigger>
                <TabsTrigger value="mandates">Mandats</TabsTrigger>
                <TabsTrigger value="quotes">Devis</TabsTrigger>
                <TabsTrigger value="invoices">Factures</TabsTrigger>
                <TabsTrigger value="contracts">Contrats</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4 mt-4">
                <InfoRow icon={Mail} label="Courriel" value={client.email} />
                <InfoRow icon={Phone} label="Téléphone" value={client.phone ?? "—"} />
                <InfoRow icon={Building2} label="Entreprise" value={client.companyName ?? "—"} />
                <InfoRow icon={MapPin} label="Localisation" value={`${client.city ?? ""} ${client.province ?? ""}`} />
                {client.technologies && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Technologies</p>
                    <div className="flex flex-wrap gap-1">
                      {client.technologies.split(",").map((t, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">
                          {t.trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-4">
                  <Button size="sm" variant="outline"><Plus className="h-3 w-3" />Mandat</Button>
                  <Button size="sm" variant="outline"><Plus className="h-3 w-3" />Devis</Button>
                  <Button size="sm" variant="outline"><Plus className="h-3 w-3" />Facture</Button>
                  <Button size="sm" variant="outline"><MessageSquare className="h-3 w-3" />Message</Button>
                </div>
              </TabsContent>

              <TabsContent value="mandates" className="space-y-2 mt-4">
                {client.mandates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Aucun mandat</p>
                ) : (
                  client.mandates.map((m) => (
                    <div key={m.id} className="p-3 rounded border bg-card">
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium">{m.title}</p>
                        <StatusBadge status={m.status} />
                      </div>
                      <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${m.progress}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{m.progress}% complété</p>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="quotes" className="space-y-2 mt-4">
                {client.quotes.map((q) => (
                  <div key={q.id} className="p-3 rounded border bg-card flex justify-between items-start">
                    <div>
                      <p className="text-xs text-muted-foreground">{q.quoteNumber}</p>
                      <p className="text-sm font-medium">{q.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Expire : {formatDate(q.expiryDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={q.status} />
                      <p className="text-sm font-bold mt-1">{formatCurrency(Number(q.amountTtc))}</p>
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="invoices" className="space-y-2 mt-4">
                {client.invoices.map((i) => (
                  <div key={i.id} className="p-3 rounded border bg-card flex justify-between items-start">
                    <div>
                      <p className="text-xs text-muted-foreground">{i.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">Échéance : {formatDate(i.dueDate)}</p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={i.status} />
                      <p className="text-sm font-bold mt-1">{formatCurrency(Number(i.amountTtc))}</p>
                    </div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="contracts" className="space-y-2 mt-4">
                {client.contracts.map((c) => (
                  <div key={c.id} className="p-3 rounded border bg-card flex justify-between items-center">
                    <p className="text-sm font-medium">{c.contractNumber}</p>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
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
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <div>
        <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}
