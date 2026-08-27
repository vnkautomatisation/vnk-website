"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { upsertOneOnOneAction } from "@/app/actions/hr-performance";

export default function NewOneOnOnePage() {
  const t = useTranslations("admin.hr_nav");
  const tc = useTranslations("common");
  const router = useRouter();
  const [employees, setEmployees] = useState<Array<{ id: number; fullName: string | null; email: string }>>([]);
  const [adminId, setAdminId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [scheduledAt, setScheduledAt] = useState(() => {

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    return tomorrow.toISOString().slice(0, 16);
  });
  const [durationMin, setDurationMin] = useState("30");
  const [agenda, setAgenda] = useState("");
  const [pending, setPending] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  useEffect(() => {
    fetch("/api/admin/list")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => setEmployees(d.admins ?? []))
      .catch(() => toast.error(t("impossible_charger_liste_employes")))
      .finally(() => setLoadingEmployees(false));
  }, []);

  const submit = async () => {
    if (!adminId || !managerId) { toast.error(t("employe_manager_requis")); return; }
    if (adminId === managerId) { toast.error(t("employe_manager_doivent_etre_differents")); return; }
    setPending(true);
    const r = await upsertOneOnOneAction({
      adminId: Number(adminId),
      managerId: Number(managerId),
      scheduledAt: new Date(scheduledAt).toISOString(),
      durationMin: Number(durationMin),
      agenda: agenda || null,
      status: "scheduled",
    });
    setPending(false);
    if (r.success && "data" in r) {
      toast.success(t("reunion_planifiee"));
      router.push(`/admin/employes/one-on-ones/${r.data.id}`);
    } else if (!r.success) toast.error(r.error || t("erreur"));
  };

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-[#0F2D52]" />{t("page_planifier_une_reunion_1_on_1")}</h1>
      <Card className="p-5 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{t("employe")}</Label>
          <Select value={adminId} onValueChange={setAdminId} disabled={loadingEmployees}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder={loadingEmployees ? t("chargement") : t("choisir_employe")} />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.fullName || e.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{t("manager_mene")}</Label>
          <Select value={managerId} onValueChange={setManagerId} disabled={loadingEmployees}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder={loadingEmployees ? t("chargement") : t("choisir_manager")} />
            </SelectTrigger>
            <SelectContent>
              {employees.filter((e) => String(e.id) !== adminId).map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>{e.fullName || e.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{t("date_heure")}</Label>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{t("duree_min")}</Label>
            <Select value={durationMin} onValueChange={setDurationMin}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="15">{t("15_minutes")}</SelectItem>
                <SelectItem value="30">{t("30_minutes")}</SelectItem>
                <SelectItem value="45">{t("45_minutes")}</SelectItem>
                <SelectItem value="60">{t("1_heure")}</SelectItem>
                <SelectItem value="90">1h30</SelectItem>
                <SelectItem value="120">{t("2_heures")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{t("ordre_jour_optionnel")}</Label>
          <textarea
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
            placeholder={t("sujets_aborder_objectifs_blocages_projets")}
          />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={() => router.back()} disabled={pending}>{tc("cancel")}</Button>
          <Button onClick={submit} disabled={pending || loadingEmployees || !adminId || !managerId}>
            {pending ? "..." : t("planifier")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
