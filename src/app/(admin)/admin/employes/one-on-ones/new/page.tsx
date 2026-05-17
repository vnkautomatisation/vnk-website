"use client";
import { useEffect, useState } from "react";
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
  const router = useRouter();
  const [employees, setEmployees] = useState<Array<{ id: number; fullName: string | null; email: string }>>([]);
  const [adminId, setAdminId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [scheduledAt, setScheduledAt] = useState(() => {
    // Par défaut : demain à 10h
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
      .catch(() => toast.error("Impossible de charger la liste des employés"))
      .finally(() => setLoadingEmployees(false));
  }, []);

  const submit = async () => {
    if (!adminId || !managerId) { toast.error("Employé + manager requis"); return; }
    if (adminId === managerId) { toast.error("L'employé et le manager doivent être différents"); return; }
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
      toast.success("Réunion planifiée");
      router.push(`/admin/employes/one-on-ones/${r.data.id}`);
    } else if (!r.success) toast.error(r.error || "Erreur");
  };

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-[#0F2D52]" />Planifier une réunion 1-on-1
      </h1>
      <Card className="p-5 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Employé *</Label>
          <Select value={adminId} onValueChange={setAdminId} disabled={loadingEmployees}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder={loadingEmployees ? "Chargement…" : "Choisir un employé"} />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.fullName || e.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Manager (qui mène) *</Label>
          <Select value={managerId} onValueChange={setManagerId} disabled={loadingEmployees}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder={loadingEmployees ? "Chargement…" : "Choisir le manager"} />
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
            <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Date & heure *</Label>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Durée (min)</Label>
            <Select value={durationMin} onValueChange={setDurationMin}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">1 heure</SelectItem>
                <SelectItem value="90">1h30</SelectItem>
                <SelectItem value="120">2 heures</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Ordre du jour (optionnel)</Label>
          <textarea
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
            placeholder="Sujets à aborder : objectifs, blocages, projets en cours…"
          />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={() => router.back()} disabled={pending}>Annuler</Button>
          <Button onClick={submit} disabled={pending || loadingEmployees || !adminId || !managerId}>
            {pending ? "..." : "Planifier"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
