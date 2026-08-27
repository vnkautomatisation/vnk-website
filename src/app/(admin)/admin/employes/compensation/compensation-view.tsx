"use client";
import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BarChart, Plus, Gift, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingsTabs, type TabItem } from "@/components/admin/settings-tabs";
import { addSalaryHistoryAction, addBonusAction } from "@/app/actions/hr-performance";

const PAGE_SIZE = 20;

type Emp = { id: number; fullName: string | null; email: string; position: { name: string } | null };
type Salary = { id: number; effectiveDate: string; type: string; salaryAnnual: number | null; hourlyRate: number | null; reason: string | null; admin: { id: number; fullName: string | null; email: string } };
type Bonus = { id: number; type: string; amount: number; reason: string | null; awardedAt: string; admin: { id: number; fullName: string | null; email: string } };

const SAL_TYPE_KEY: Record<string, string> = {
  initial: "initial", raise: "augmentation", promotion: "promotion", adjustment: "ajustement",
  bonus_base: "bonus_base", demotion: "retrogradation",
};
const BONUS_TYPE_KEY: Record<string, string> = {
  annual_bonus: "bonus_annuel", spot_bonus: "spot_bonus", commission: "commission",
  sign_on: "sign_on", referral: "reference", retention: "retention",
};

export function CompensationView({ employees, salaryHistory, bonuses }: { employees: Emp[]; salaryHistory: Salary[]; bonuses: Bonus[] }) {
  const t = useTranslations("admin.compensation");
  const router = useRouter();
  const [tab, setTab] = useState<"salaries" | "bonuses">("salaries");
  const [salDialog, setSalDialog] = useState(false);
  const [bonusDialog, setBonusDialog] = useState(false);


  const [salEmp, setSalEmp] = useState<string>("all");
  const [salType, setSalType] = useState<string>("all");
  const [salYear, setSalYear] = useState<string>("all");
  const [salPage, setSalPage] = useState(0);

  const [bonusEmp, setBonusEmp] = useState<string>("all");
  const [bonusType, setBonusType] = useState<string>("all");
  const [bonusYear, setBonusYear] = useState<string>("all");
  const [bonusPage, setBonusPage] = useState(0);

  const salYears = useMemo(() => {
    const s = new Set<string>();
    salaryHistory.forEach((x) => s.add(String(new Date(x.effectiveDate).getFullYear())));
    return Array.from(s).sort((a, b) => Number(b) - Number(a));
  }, [salaryHistory]);

  const bonusYears = useMemo(() => {
    const s = new Set<string>();
    bonuses.forEach((x) => s.add(String(new Date(x.awardedAt).getFullYear())));
    return Array.from(s).sort((a, b) => Number(b) - Number(a));
  }, [bonuses]);

  const filteredSalaries = useMemo(() => {
    return salaryHistory.filter((s) => {
      if (salEmp !== "all" && String(s.admin.id) !== salEmp) return false;
      if (salType !== "all" && s.type !== salType) return false;
      if (salYear !== "all" && String(new Date(s.effectiveDate).getFullYear()) !== salYear) return false;
      return true;
    });
  }, [salaryHistory, salEmp, salType, salYear]);

  const filteredBonuses = useMemo(() => {
    return bonuses.filter((b) => {
      if (bonusEmp !== "all" && String(b.admin.id) !== bonusEmp) return false;
      if (bonusType !== "all" && b.type !== bonusType) return false;
      if (bonusYear !== "all" && String(new Date(b.awardedAt).getFullYear()) !== bonusYear) return false;
      return true;
    });
  }, [bonuses, bonusEmp, bonusType, bonusYear]);


  useEffect(() => { setSalPage(0); }, [salEmp, salType, salYear]);
  useEffect(() => { setBonusPage(0); }, [bonusEmp, bonusType, bonusYear]);

  const salTotalPages = Math.max(1, Math.ceil(filteredSalaries.length / PAGE_SIZE));
  const bonusTotalPages = Math.max(1, Math.ceil(filteredBonuses.length / PAGE_SIZE));
  const salPageItems = filteredSalaries.slice(salPage * PAGE_SIZE, (salPage + 1) * PAGE_SIZE);
  const bonusPageItems = filteredBonuses.slice(bonusPage * PAGE_SIZE, (bonusPage + 1) * PAGE_SIZE);

  const TABS: TabItem<"salaries" | "bonuses">[] = [
    { key: "salaries", label: t("historique_salaires"), icon: TrendingUp, count: salaryHistory.length },
    { key: "bonuses", label: t("bonus_primes"), icon: Gift, count: bonuses.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><BarChart className="h-5 w-5 text-[#0F2D52]" />{t("compensation")}</h1>
          <p className="text-sm text-muted-foreground">{t("historique_salaires_augmentations_bonus_primes")}</p>
        </div>
        {tab === "salaries" ? (
          <Button onClick={() => setSalDialog(true)}><Plus className="h-4 w-4 mr-1.5" />{t("ajustement_salarial")}</Button>
        ) : (
          <Button onClick={() => setBonusDialog(true)}><Plus className="h-4 w-4 mr-1.5" />{t("bonus")}</Button>
        )}
      </div>

      <SettingsTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "salaries" && (
        <>

          <Card className="p-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select value={salEmp} onValueChange={setSalEmp}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={t("employe_2")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("tous_employes")}</SelectItem>
                  {employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.fullName || e.email}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={salType} onValueChange={setSalType}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={t("type")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("tous_types")}</SelectItem>
                  {Object.entries(SAL_TYPE_KEY).map(([k, v]) => <SelectItem key={k} value={k}>{t(v)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={salYear} onValueChange={setSalYear}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={t("annee")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("toutes_annees")}</SelectItem>
                  {salYears.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </Card>

          <Card>
            <div className="divide-y">
              {filteredSalaries.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  {salaryHistory.length === 0 ? t("aucun_historique_salarial") : t("aucun_resultat_filtres")}
                </div>
              ) : salPageItems.map((s) => (
                <div key={s.id} className="p-3 flex items-center gap-3 text-sm">
                  <Badge variant="outline" className="text-[10px]">{SAL_TYPE_KEY[s.type] ? t(SAL_TYPE_KEY[s.type]) : s.type}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{s.admin.fullName || s.admin.email}</p>
                    {s.reason && <p className="text-xs text-muted-foreground italic">« {s.reason} »</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm">
                      {s.salaryAnnual && `${Number(s.salaryAnnual).toLocaleString("fr-CA")} $/an`}
                      {s.hourlyRate && ` · ${Number(s.hourlyRate).toFixed(2)} $/h`}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{new Date(s.effectiveDate).toLocaleDateString("fr-CA")}</p>
                  </div>
                </div>
              ))}
            </div>
            {filteredSalaries.length > PAGE_SIZE && (
              <PaginationBar page={salPage} totalPages={salTotalPages} total={filteredSalaries.length} onPrev={() => setSalPage((p) => Math.max(0, p - 1))} onNext={() => setSalPage((p) => Math.min(salTotalPages - 1, p + 1))} />
            )}
          </Card>
        </>
      )}

      {tab === "bonuses" && (
        <>

          <Card className="p-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select value={bonusEmp} onValueChange={setBonusEmp}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={t("employe_2")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("tous_employes")}</SelectItem>
                  {employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.fullName || e.email}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={bonusType} onValueChange={setBonusType}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={t("type")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("tous_types")}</SelectItem>
                  {Object.entries(BONUS_TYPE_KEY).map(([k, v]) => <SelectItem key={k} value={k}>{t(v)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={bonusYear} onValueChange={setBonusYear}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={t("annee")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("toutes_annees")}</SelectItem>
                  {bonusYears.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </Card>

          <Card>
            <div className="divide-y">
              {filteredBonuses.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  {bonuses.length === 0 ? t("aucun_bonus_enregistre") : t("aucun_resultat_filtres")}
                </div>
              ) : bonusPageItems.map((b) => (
                <div key={b.id} className="p-3 flex items-center gap-3 text-sm">
                  <Gift className="h-4 w-4 text-amber-500" />
                  <Badge variant="outline" className="text-[10px]">{BONUS_TYPE_KEY[b.type] ? t(BONUS_TYPE_KEY[b.type]) : b.type}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{b.admin.fullName || b.admin.email}</p>
                    {b.reason && <p className="text-xs text-muted-foreground italic">« {b.reason} »</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-sm">{Number(b.amount).toFixed(2)} $</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(b.awardedAt).toLocaleDateString("fr-CA")}</p>
                  </div>
                </div>
              ))}
            </div>
            {filteredBonuses.length > PAGE_SIZE && (
              <PaginationBar page={bonusPage} totalPages={bonusTotalPages} total={filteredBonuses.length} onPrev={() => setBonusPage((p) => Math.max(0, p - 1))} onNext={() => setBonusPage((p) => Math.min(bonusTotalPages - 1, p + 1))} />
            )}
          </Card>
        </>
      )}

      <SalaryDialog open={salDialog} employees={employees} onClose={() => setSalDialog(false)} onSaved={() => router.refresh()} />
      <BonusDialog open={bonusDialog} employees={employees} onClose={() => setBonusDialog(false)} onSaved={() => router.refresh()} />
    </div>
  );
}

function PaginationBar({ page, totalPages, total, onPrev, onNext }: { page: number; totalPages: number; total: number; onPrev: () => void; onNext: () => void }) {
  const t = useTranslations("admin.compensation");
  return (
    <div className="px-3 py-2 border-t bg-muted/30 flex items-center justify-between text-xs">
      <span className="text-muted-foreground">
        Page {page + 1} / {totalPages} · {total} entrée{total > 1 ? "s" : ""}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={onPrev} disabled={page === 0} aria-label={t("page_precedente")}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={onNext} disabled={page >= totalPages - 1} aria-label={t("page_suivante")}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function SalaryDialog({ open, employees, onClose, onSaved }: { open: boolean; employees: Emp[]; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("admin.compensation");
  const tc = useTranslations("common");
  const [adminId, setAdminId] = useState("");
  const [type, setType] = useState<"initial" | "raise" | "promotion" | "adjustment" | "bonus_base" | "demotion">("raise");
  const [salaryAnnual, setSalaryAnnual] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setAdminId("");
      setType("raise");
      setSalaryAnnual("");
      setHourlyRate("");
      setEffectiveDate(new Date().toISOString().slice(0, 10));
      setReason("");
    }
  }, [open]);

  const submit = async () => {
    if (!adminId) { toast.error(t("employe_requis")); return; }
    if (!salaryAnnual && !hourlyRate) { toast.error(t("salaire_annuel_taux_h_requis")); return; }
    setPending(true);
    const r = await addSalaryHistoryAction({
      adminId: Number(adminId),
      type, effectiveDate,
      salaryAnnual: salaryAnnual ? Number(salaryAnnual) : null,
      hourlyRate: hourlyRate ? Number(hourlyRate) : null,
      reason: reason || null,
    });
    setPending(false);
    if (r.success) { toast.success(t("ajoute")); onSaved(); onClose(); setAdminId(""); setSalaryAnnual(""); setHourlyRate(""); setReason(""); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader><DialogTitle className="text-base text-white">{t("ajustement_salarial")}</DialogTitle></DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{t("employe")}</Label>
              <Select value={adminId} onValueChange={setAdminId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.fullName || e.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{t("type")}</Label>
              <Select value={type} onValueChange={(v) => setType(v as "initial" | "raise" | "promotion" | "adjustment" | "bonus_base" | "demotion")}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(SAL_TYPE_KEY).map(([k, v]) => <SelectItem key={k} value={k}>{t(v)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{t("salaire_annuel")}</Label>
              <Input type="number" value={salaryAnnual} onChange={(e) => setSalaryAnnual(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{t("taux_h")}</Label>
              <Input type="number" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{t("effectif")}</Label>
              <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">{t("motif")}</Label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y" />
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>{tc("cancel")}</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "..." : t("enregistrer")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BonusDialog({ open, employees, onClose, onSaved }: { open: boolean; employees: Emp[]; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("admin.compensation");
  const tc = useTranslations("common");
  const [adminId, setAdminId] = useState("");
  const [type, setType] = useState<"annual_bonus" | "spot_bonus" | "commission" | "sign_on" | "referral" | "retention">("spot_bonus");
  const [amount, setAmount] = useState("");
  const [awardedAt, setAwardedAt] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setAdminId("");
      setType("spot_bonus");
      setAmount("");
      setAwardedAt(new Date().toISOString().slice(0, 10));
      setReason("");
    }
  }, [open]);

  const submit = async () => {
    if (!adminId || !amount) { toast.error(t("champs_obligatoires")); return; }
    setPending(true);
    const r = await addBonusAction({
      adminId: Number(adminId), type,
      amount: Number(amount), awardedAt,
      reason: reason || null,
    });
    setPending(false);
    if (r.success) { toast.success(t("bonus_accorde")); onSaved(); onClose(); setAdminId(""); setAmount(""); setReason(""); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader><DialogTitle className="text-base text-white flex items-center gap-2"><Gift className="h-4 w-4 text-amber-300" />{t("nouveau_bonus")}</DialogTitle></DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{t("employe")}</Label>
              <Select value={adminId} onValueChange={setAdminId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.fullName || e.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{t("type")}</Label>
              <Select value={type} onValueChange={(v) => setType(v as "annual_bonus" | "spot_bonus" | "commission" | "sign_on" | "referral" | "retention")}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(BONUS_TYPE_KEY).map(([k, v]) => <SelectItem key={k} value={k}>{t(v)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{t("montant")}</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{tc("date")}</Label>
              <Input type="date" value={awardedAt} onChange={(e) => setAwardedAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">{t("motif")}</Label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y" />
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>{tc("cancel")}</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "..." : t("accorder")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
