"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPerformanceReviewAction } from "@/app/actions/hr-performance";

export default function NewEvaluationPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Array<{ id: number; fullName: string | null; email: string }>>([]);
  const [adminId, setAdminId] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const today = new Date();
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const [periodStart, setPeriodStart] = useState(yearStart.toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(today.toISOString().slice(0, 10));
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetch("/api/admin/list").then((r) => r.json()).then((d) => setEmployees(d.admins ?? [])).catch(() => null);
  }, []);

  const submit = async () => {
    if (!adminId || !reviewerId) { toast.error("Choisir employé + évaluateur"); return; }
    setPending(true);
    const r = await createPerformanceReviewAction({
      adminId: Number(adminId),
      reviewerId: Number(reviewerId),
      periodStart, periodEnd,
    });
    setPending(false);
    if (r.success && "data" in r) { toast.success("Évaluation créée"); router.push(`/admin/employes/evaluations/${r.data.id}`); }
    else if (!r.success) toast.error(r.error || "");
  };

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <Award className="h-5 w-5 text-[#0F2D52]" />Nouvelle évaluation
      </h1>
      <Card className="p-5 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider font-semibold">Employé à évaluer *</Label>
          <Select value={adminId} onValueChange={setAdminId}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choisir…" /></SelectTrigger>
            <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.fullName || e.email}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider font-semibold">Évaluateur (manager) *</Label>
          <Select value={reviewerId} onValueChange={setReviewerId}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choisir…" /></SelectTrigger>
            <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.fullName || e.email}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Période début *</Label>
            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Période fin *</Label>
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => router.back()} disabled={pending}>Annuler</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "..." : "Créer"}</Button>
        </div>
      </Card>
    </div>
  );
}
