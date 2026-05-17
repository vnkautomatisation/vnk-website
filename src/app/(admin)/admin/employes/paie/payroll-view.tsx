"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Calculator, Plus, Lock, CheckCircle2, Calendar, DollarSign, ChevronLeft, ChevronRight, Search, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingsTabs, type TabItem } from "@/components/admin/settings-tabs";
import { createPayPeriodAction, generatePayStubsAction, lockPayPeriodAction, markPayPeriodPaidAction } from "@/app/actions/hr-payroll";
import { confirmDialog } from "@/components/admin/prompt-dialog";

const STUBS_PAGE_SIZE = 25;

type Period = { id: number; startDate: string; endDate: string; payDate: string; status: string; _count: { stubs: number } };
type Stub = {
  id: number;
  hoursRegular: number;
  hoursOvertime: number;
  hoursVacation: number;
  hoursSick: number;
  rate: number;
  grossPay: number;
  deductionFederal: number;
  deductionProvincial: number;
  deductionRrq: number;
  deductionAe: number;
  deductionRqap: number;
  deductionOther: number;
  netPay: number;
  releasedAt: string | null;
  period: { id?: number; startDate: string; endDate: string; payDate?: string; status?: string };
  admin?: { id: number; fullName: string | null; email: string };
};

const STATUS: Record<string, { label: string; color: string }> = {
  open: { label: "Ouverte", color: "bg-blue-100 text-blue-700" },
  locked: { label: "Verrouillée", color: "bg-amber-100 text-amber-700" },
  paid: { label: "Payée", color: "bg-emerald-100 text-emerald-700" },
};

export function PayrollView({
  periods, myStubs, allStubs, isPayrollAdmin,
}: {
  periods: Period[];
  myStubs: Stub[];
  allStubs: Stub[];
  isPayrollAdmin: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"my" | "periods" | "stubs">(isPayrollAdmin ? "periods" : "my");
  const [createOpen, setCreateOpen] = useState(false);

  const TABS: TabItem<"my" | "periods" | "stubs">[] = [
    { key: "my", label: "Mes bulletins", icon: DollarSign, count: myStubs.length },
    ...(isPayrollAdmin
      ? [
          { key: "periods" as const, label: "Périodes", icon: Calendar, count: periods.length },
          { key: "stubs" as const, label: "Tous bulletins", icon: Calculator, count: allStubs.length },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Calculator className="h-5 w-5 text-[#0F2D52]" />{isPayrollAdmin ? "Paie" : "Mes bulletins de paie"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isPayrollAdmin
              ? "Gérez les cycles de paie et les bulletins des employés."
              : "Consultez et téléchargez vos bulletins de paie."}
          </p>
        </div>
        {isPayrollAdmin && tab === "periods" && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />Nouvelle période
          </Button>
        )}
      </div>

      <SettingsTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "my" && (
        <div className="space-y-2">
          {myStubs.length === 0 && (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              Aucun bulletin de paie disponible.
            </Card>
          )}
          {myStubs.map((s) => (
            <MyStubCard key={s.id} stub={s} />
          ))}
        </div>
      )}

      {tab === "periods" && isPayrollAdmin && (
        <div className="space-y-2">
          {periods.length === 0 && (
            <Card className="p-10 text-center text-sm text-muted-foreground">Aucune période de paie créée.</Card>
          )}
          {periods.map((p) => (
            <PeriodCard key={p.id} period={p} onChanged={() => router.refresh()} />
          ))}
        </div>
      )}

      {tab === "stubs" && isPayrollAdmin && (
        <StubsList stubs={allStubs} periods={periods} />
      )}

      <CreatePeriodDialog open={createOpen} onClose={() => setCreateOpen(false)} onSaved={() => router.refresh()} />
    </div>
  );
}

function StubsList({ stubs, periods }: { stubs: Stub[]; periods: Period[] }) {
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all"); // all | released | draft
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stubs.filter((s) => {
      if (periodFilter !== "all" && String(s.period.id ?? "") !== periodFilter) return false;
      if (statusFilter === "released" && !s.releasedAt) return false;
      if (statusFilter === "draft" && s.releasedAt) return false;
      if (q) {
        const name = (s.admin?.fullName || s.admin?.email || "").toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [stubs, search, periodFilter, statusFilter]);

  useEffect(() => { setPage(0); }, [search, periodFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / STUBS_PAGE_SIZE));
  const pageItems = filtered.slice(page * STUBS_PAGE_SIZE, (page + 1) * STUBS_PAGE_SIZE);

  if (stubs.length === 0) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Aucun bulletin.</Card>;
  }

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher employé…"
              className="h-9 text-sm pl-7"
            />
          </div>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Période" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les périodes</SelectItem>
              {periods.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {new Date(p.startDate).toLocaleDateString("fr-CA")} → {new Date(p.endDate).toLocaleDateString("fr-CA")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="released">Publié</SelectItem>
              <SelectItem value="draft">Brouillon</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <div className="divide-y">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Aucun résultat avec ces filtres.</div>
          ) : pageItems.map((s) => (
            <div key={s.id} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{s.admin?.fullName || s.admin?.email}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(s.period.startDate).toLocaleDateString("fr-CA")} → {new Date(s.period.endDate).toLocaleDateString("fr-CA")}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-sm font-bold">{Number(s.netPay).toFixed(2)} $</p>
                <p className="text-[10px] text-muted-foreground">net</p>
              </div>
              {s.releasedAt ? (
                <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-[10px]">
                  Publié
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px]">
                  Brouillon
                </Badge>
              )}
              <Button asChild size="icon" variant="ghost" className="h-7 w-7" aria-label="Télécharger PDF">
                <a href={`/api/admin/pay-stubs/${s.id}/pdf`} target="_blank" rel="noopener">
                  <Download className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          ))}
        </div>
        {filtered.length > STUBS_PAGE_SIZE && (
          <div className="px-3 py-2 border-t bg-muted/30 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Page {page + 1} / {totalPages} · {filtered.length} bulletin{filtered.length > 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="Page précédente">
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} aria-label="Page suivante">
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function PeriodCard({ period, onChanged }: { period: Period; onChanged: () => void }) {
  const s = STATUS[period.status] ?? { label: period.status, color: "bg-gray-100 text-gray-700" };
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold text-sm">
            {new Date(period.startDate).toLocaleDateString("fr-CA")} → {new Date(period.endDate).toLocaleDateString("fr-CA")}
          </h3>
          <p className="text-xs text-muted-foreground">
            Date de paie : {new Date(period.payDate).toLocaleDateString("fr-CA")} · {period._count.stubs} bulletin{period._count.stubs > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`text-[10px] ${s.color}`}>{s.label}</Badge>
          {period.status === "open" && (
            <>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => {
                const r = await generatePayStubsAction({ periodId: period.id });
                if (r.success) { toast.success(`${r.data.stubsCreated} bulletin(s) généré(s)`); onChanged(); }
                else toast.error(r.error || "");
              }}>
                <Calculator className="h-3 w-3 mr-1" />Générer
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => {
                const r = await lockPayPeriodAction({ id: period.id });
                if (r.success) { toast.success("Verrouillée"); onChanged(); }
                else toast.error(r.error || "");
              }}>
                <Lock className="h-3 w-3 mr-1" />Verrouiller
              </Button>
            </>
          )}
          {period.status === "locked" && (
            <Button size="sm" className="h-7 text-xs" onClick={async () => {
              const ok = await confirmDialog({
                title: "Marquer la période comme payée ?",
                description: "Les bulletins deviendront visibles aux employés. Cette action est irréversible.",
                confirmLabel: "Marquer payée",
              });
              if (!ok) return;
              const r = await markPayPeriodPaidAction({ id: period.id });
              if (r.success) { toast.success("Marquée payée"); onChanged(); }
              else toast.error(r.error || "");
            }}>
              <CheckCircle2 className="h-3 w-3 mr-1" />Marquer payée
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function MyStubCard({ stub }: { stub: Stub }) {
  const totalDeductions = Number(stub.deductionFederal) + Number(stub.deductionProvincial) + Number(stub.deductionRrq) + Number(stub.deductionAe) + Number(stub.deductionRqap) + Number(stub.deductionOther);
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white p-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider opacity-80">Période</p>
          <h3 className="font-bold">
            {new Date(stub.period.startDate).toLocaleDateString("fr-CA")} → {new Date(stub.period.endDate).toLocaleDateString("fr-CA")}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider opacity-80">Net à payer</p>
            <p className="text-2xl font-bold tabular-nums">{Number(stub.netPay).toFixed(2)} $</p>
          </div>
          <Button asChild size="sm" variant="secondary" className="bg-white/15 text-white hover:bg-white/25 border-0 h-8">
            <a href={`/api/admin/pay-stubs/${stub.id}/pdf`} target="_blank" rel="noopener">
              <Download className="h-3.5 w-3.5 mr-1" />PDF
            </a>
          </Button>
        </div>
      </div>
      <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Heures régulières</p>
          <p className="font-mono">{Number(stub.hoursRegular).toFixed(2)} h × {Number(stub.rate).toFixed(2)} $</p>
        </div>
        {Number(stub.hoursOvertime) > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Heures sup</p>
            <p className="font-mono">{Number(stub.hoursOvertime).toFixed(2)} h × 1.5</p>
          </div>
        )}
        {Number(stub.hoursVacation) > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Vacances</p>
            <p className="font-mono">{Number(stub.hoursVacation).toFixed(2)} h</p>
          </div>
        )}
        <div className="col-span-full border-t pt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div><span className="text-muted-foreground">Brut :</span> <strong>{Number(stub.grossPay).toFixed(2)} $</strong></div>
          <div><span className="text-muted-foreground">Fédéral :</span> <strong>−{Number(stub.deductionFederal).toFixed(2)} $</strong></div>
          <div><span className="text-muted-foreground">Provincial :</span> <strong>−{Number(stub.deductionProvincial).toFixed(2)} $</strong></div>
          <div><span className="text-muted-foreground">RRQ :</span> <strong>−{Number(stub.deductionRrq).toFixed(2)} $</strong></div>
          <div><span className="text-muted-foreground">AE :</span> <strong>−{Number(stub.deductionAe).toFixed(2)} $</strong></div>
          <div><span className="text-muted-foreground">RQAP :</span> <strong>−{Number(stub.deductionRqap).toFixed(2)} $</strong></div>
          <div className="md:col-span-2"><span className="text-muted-foreground">Total déductions :</span> <strong>−{totalDeductions.toFixed(2)} $</strong></div>
        </div>
      </div>
    </Card>
  );
}

function CreatePeriodDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const today = new Date();
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
  const [start, setStart] = useState(twoWeeksAgo.toISOString().slice(0, 10));
  const [end, setEnd] = useState(today.toISOString().slice(0, 10));
  const [pay, setPay] = useState(new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    const r = await createPayPeriodAction({ startDate: start, endDate: end, payDate: pay });
    setPending(false);
    if (r.success) { toast.success("Période créée"); onSaved(); onClose(); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Calendar className="h-4 w-4" />Nouvelle période de paie
            </DialogTitle>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Début</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Fin</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Date de paie</Label>
            <Input type="date" value={pay} onChange={(e) => setPay(e.target.value)} className="h-9" />
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "..." : "Créer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
