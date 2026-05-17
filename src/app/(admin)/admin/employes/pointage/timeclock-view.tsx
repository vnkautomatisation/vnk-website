"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { promptDialog } from "@/components/admin/prompt-dialog";
import {
  Clock, Play, Square, Plus, Trash2, CheckCircle2, XCircle, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingsTabs, type TabItem } from "@/components/admin/settings-tabs";
import {
  clockInAction, clockOutAction, manualTimeEntryAction, deleteTimeClockAction,
  approveTimeClockAction, rejectTimeClockAction,
} from "@/app/actions/hr-timeclock";

type Entry = {
  id: number;
  adminId: number;
  clockIn: string;
  clockOut: string | null;
  durationMin: number | null;
  category: string;
  notes: string | null;
  approvedBy: number | null;
  approvedAt: string | null;
  payStubId: number | null;
  admin?: { id: number; fullName: string | null; email: string };
};

const CAT_LABEL: Record<string, { label: string; color: string }> = {
  work: { label: "Travail", color: "bg-emerald-100 text-emerald-700" },
  break: { label: "Pause", color: "bg-blue-100 text-blue-700" },
  meeting: { label: "RÃ©union", color: "bg-violet-100 text-violet-700" },
  training: { label: "Formation", color: "bg-amber-100 text-amber-700" },
  sick: { label: "Maladie", color: "bg-red-100 text-red-700" },
  vacation: { label: "Vacances", color: "bg-cyan-100 text-cyan-700" },
};

function fmtDuration(mins: number | null): string {
  if (!mins) return "â€”";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

export function TimeclockView({
  myEntries, openEntry, allEntries, isPayrollAdmin, currentAdminId,
}: {
  myEntries: Entry[];
  openEntry: Entry | null;
  allEntries: Entry[];
  isPayrollAdmin: boolean;
  currentAdminId: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"mine" | "review">("mine");
  const [manualOpen, setManualOpen] = useState(false);
  const [selectedToApprove, setSelectedToApprove] = useState<Set<number>>(new Set());
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewDateFrom, setReviewDateFrom] = useState("");
  const [reviewDateTo, setReviewDateTo] = useState("");

  const TABS: TabItem<"mine" | "review">[] = [
    { key: "mine", label: "Mon pointage", icon: Clock },
    ...(isPayrollAdmin ? [{ key: "review" as const, label: "Ã€ approuver", icon: CheckCircle2, count: allEntries.filter((e) => !e.approvedAt && e.clockOut).length }] : []),
  ];

  // Stats personnelles 30j
  const myStats = useMemo(() => {
    const total = myEntries.reduce((s, e) => s + (e.durationMin ?? 0), 0);
    const work = myEntries.filter((e) => e.category === "work").reduce((s, e) => s + (e.durationMin ?? 0), 0);
    const approved = myEntries.filter((e) => e.approvedAt).reduce((s, e) => s + (e.durationMin ?? 0), 0);
    const pending = myEntries.filter((e) => !e.approvedAt && e.clockOut).reduce((s, e) => s + (e.durationMin ?? 0), 0);
    return { total, work, approved, pending };
  }, [myEntries]);

  // File de revue : entrées fermées + filtres (recherche employé, plage de dates)
  const reviewEntriesAll = useMemo(() => allEntries.filter((e) => e.clockOut), [allEntries]);
  const reviewEntriesFiltered = useMemo(() => {
    const q = reviewSearch.trim().toLowerCase();
    return reviewEntriesAll.filter((entry) => {
      if (q) {
        const name = (entry.admin?.fullName || entry.admin?.email || "").toLowerCase();
        if (!name.includes(q)) return false;
      }
      if (reviewDateFrom && new Date(entry.clockIn) < new Date(reviewDateFrom)) return false;
      if (reviewDateTo && new Date(entry.clockIn) > new Date(reviewDateTo + "T23:59:59")) return false;
      return true;
    });
  }, [reviewEntriesAll, reviewSearch, reviewDateFrom, reviewDateTo]);

  const handleClockIn = async () => {
    const r = await clockInAction({});
    if (r.success) { toast.success("Pointage dÃ©marrÃ©"); router.refresh(); }
    else toast.error(r.error || "Erreur");
  };
  const handleClockOut = async () => {
    const r = await clockOutAction();
    if (r.success) { toast.success(`Pointage fermÃ© Â· ${fmtDuration(r.data.durationMin)}`); router.refresh(); }
    else toast.error(r.error || "Erreur");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Clock className="h-5 w-5 text-[#0F2D52]" />Pointage
          </h1>
          <p className="text-sm text-muted-foreground">Suivez vos heures de travail Â· approuvÃ©es avant chaque paie.</p>
        </div>

        {/* Action principale : clock in/out */}
        {openEntry ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-50 border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono text-emerald-900">
                DÃ©marrÃ© Ã  {new Date(openEntry.clockIn).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <Button variant="destructive" onClick={handleClockOut}>
              <Square className="h-4 w-4 mr-1.5" />ArrÃªter
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setManualOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />Saisie manuelle
            </Button>
            <Button onClick={handleClockIn}>
              <Play className="h-4 w-4 mr-1.5" />Commencer
            </Button>
          </div>
        )}
      </div>

      <SettingsTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "mine" && (
        <div className="space-y-3">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatBox label="Total 30j" value={fmtDuration(myStats.total)} accent="emerald" />
            <StatBox label="Travail" value={fmtDuration(myStats.work)} accent="blue" />
            <StatBox label="ApprouvÃ©" value={fmtDuration(myStats.approved)} accent="emerald" />
            <StatBox label="En attente" value={fmtDuration(myStats.pending)} accent="amber" />
          </div>

          {/* Liste */}
          <Card>
            <div className="divide-y">
              {myEntries.map((e) => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  showAdmin={false}
                  onDelete={async () => {
                    const r = await deleteTimeClockAction({ id: e.id });
                    if (r.success) { toast.success("SupprimÃ©"); router.refresh(); }
                    else toast.error(r.error || "");
                  }}
                />
              ))}
              {myEntries.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Aucun pointage sur les 30 derniers jours.
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === "review" && isPayrollAdmin && (
        <div className="space-y-3">
          {selectedToApprove.size > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-[#0F2D52] text-white">
              <span className="text-sm font-medium">{selectedToApprove.size} entrÃ©e{selectedToApprove.size > 1 ? "s" : ""} sÃ©lectionnÃ©e{selectedToApprove.size > 1 ? "s" : ""}</span>
              <div className="flex-1" />
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const r = await approveTimeClockAction({ ids: Array.from(selectedToApprove) });
                  if (r.success) { toast.success(`${r.data.approved} approuvÃ©e(s)`); setSelectedToApprove(new Set()); router.refresh(); }
                  else toast.error(r.error || "");
                }}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />Approuver
              </Button>
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/20" onClick={() => setSelectedToApprove(new Set())}>
                DÃ©sÃ©lectionner
              </Button>
            </div>
          )}
          <Card className="p-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={reviewSearch}
                  onChange={(e) => setReviewSearch(e.target.value)}
                  placeholder="Rechercher employé…"
                  className="h-9 text-sm pl-7"
                />
              </div>
              <Input
                type="date"
                value={reviewDateFrom}
                onChange={(e) => setReviewDateFrom(e.target.value)}
                aria-label="Du"
                className="h-9 text-sm"
              />
              <Input
                type="date"
                value={reviewDateTo}
                onChange={(e) => setReviewDateTo(e.target.value)}
                aria-label="Au"
                className="h-9 text-sm"
              />
            </div>
          </Card>
          <Card>
            <div className="divide-y">
              {reviewEntriesAll.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Aucune entrée à réviser.</div>
              ) : reviewEntriesFiltered.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Aucun résultat avec ces filtres.</div>
              ) : reviewEntriesFiltered.map((e) => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  showAdmin
                  isReviewer
                  selected={selectedToApprove.has(e.id)}
                  onSelect={(v) => {
                    setSelectedToApprove((s) => {
                      const n = new Set(s);
                      if (v) n.add(e.id); else n.delete(e.id);
                      return n;
                    });
                  }}
                  onApprove={async () => {
                    const r = await approveTimeClockAction({ ids: [e.id] });
                    if (r.success) { toast.success("ApprouvÃ©e"); router.refresh(); }
                    else toast.error(r.error || "");
                  }}
                  onReject={async () => {
                    const reason = await promptDialog({
                      title: "Rejeter cette saisie de temps",
                      label: "Motif du rejet",
                      placeholder: "L'employÃ© verra ce message",
                      multiline: true,
                      required: true,
                      variant: "destructive",
                      confirmLabel: "Rejeter",
                    });
                    if (!reason) return;
                    const r = await rejectTimeClockAction({ id: e.id, reason });
                    if (r.success) { toast.success("RejetÃ©e"); router.refresh(); }
                    else toast.error(r.error || "");
                  }}
                />
              ))}
            </div>
          </Card>
        </div>
      )}

      <ManualEntryDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent: "emerald" | "blue" | "amber" }) {
  const map = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
  };
  return (
    <div className={`rounded-lg border p-3 ${map[accent]}`}>
      <p className="text-xs uppercase tracking-wider font-semibold opacity-80">{label}</p>
      <p className="text-xl font-bold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function EntryRow({
  entry, showAdmin, isReviewer, selected, onSelect, onDelete, onApprove, onReject,
}: {
  entry: Entry;
  showAdmin: boolean;
  isReviewer?: boolean;
  selected?: boolean;
  onSelect?: (v: boolean) => void;
  onDelete?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const cat = CAT_LABEL[entry.category] ?? { label: entry.category, color: "bg-gray-100 text-gray-700" };
  const date = new Date(entry.clockIn);
  return (
    <div className="flex items-center gap-3 p-3 hover:bg-muted/30">
      {isReviewer && !entry.approvedAt && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={(e) => onSelect?.(e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {showAdmin && entry.admin && (
            <span className="text-sm font-medium">{entry.admin.fullName || entry.admin.email}</span>
          )}
          <Badge className={`text-[10px] ${cat.color}`}>{cat.label}</Badge>
          {entry.approvedAt && (
            <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50">
              <CheckCircle2 className="h-2.5 w-2.5 mr-1" />ApprouvÃ©
            </Badge>
          )}
          {entry.payStubId && (
            <Badge variant="outline" className="text-[10px] text-violet-700 border-violet-300 bg-violet-50">
              Sur bulletin
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {date.toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short" })}
          {" Â· "}
          {date.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
          {entry.clockOut ? ` â†’ ${new Date(entry.clockOut).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}` : " Â· en cours"}
        </p>
        {entry.notes && <p className="text-[11px] text-muted-foreground italic mt-0.5 truncate">{entry.notes}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="font-mono text-sm font-bold tabular-nums">{fmtDuration(entry.durationMin)}</p>
        <div className="flex gap-1 mt-1 justify-end">
          {isReviewer && !entry.approvedAt && entry.clockOut && (
            <>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-emerald-600" onClick={onApprove} title="Approuver" aria-label="Approuver">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600" onClick={onReject} title="Rejeter" aria-label="Rejeter">
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {!isReviewer && !entry.approvedAt && !entry.payStubId && (
            <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-destructive" onClick={onDelete} aria-label="Supprimer">
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ManualEntryDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 16);
  const [clockIn, setClockIn] = useState(today);
  const [clockOut, setClockOut] = useState(today);
  const [category, setCategory] = useState<"work" | "break" | "meeting" | "training" | "sick" | "vacation">("work");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    const r = await manualTimeEntryAction({
      clockIn: new Date(clockIn).toISOString(),
      clockOut: new Date(clockOut).toISOString(),
      category,
      notes: notes || null,
    });
    setPending(false);
    if (r.success) { toast.success("EntrÃ©e ajoutÃ©e"); onSaved(); onClose(); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Plus className="h-4 w-4" />Saisie manuelle
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Pour rattraper une pÃ©riode oubliÃ©e (sera soumise Ã  approbation).
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">DÃ©but</Label>
              <Input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Fin</Label>
              <Input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">CatÃ©gorie</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as "work" | "break" | "meeting" | "training" | "sick" | "vacation")}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CAT_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: RÃ©union client Acme" />
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "..." : "Ajouter"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
