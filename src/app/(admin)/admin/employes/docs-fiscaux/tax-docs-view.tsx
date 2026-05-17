"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { issueTaxDocumentAction } from "@/app/actions/hr-tax-docs";
import { FileUploadInput } from "@/components/admin/file-upload-input";

type Doc = { id: number; type: string; taxYear: number | null; title: string; fileUrl: string; issuedAt: string; admin: { id: number; fullName: string | null; email: string } };
type Emp = { id: number; fullName: string | null; email: string };

export function TaxDocsView({ employees, docs }: { employees: Emp[]; docs: Doc[] }) {
  const router = useRouter();
  const [dialog, setDialog] = useState(false);

  // Grouper par année
  const byYear = new Map<number | string, Doc[]>();
  for (const d of docs) {
    const y = d.taxYear ?? "Sans année";
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(d);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><FileText className="h-5 w-5 text-[#0F2D52]" />Documents fiscaux</h1>
          <p className="text-sm text-muted-foreground">Émission T4, Relevé 1, NR4, T2200 par employé.</p>
        </div>
        <Button onClick={() => setDialog(true)}><Upload className="h-4 w-4 mr-1.5" />Émettre un document</Button>
      </div>

      {byYear.size === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Aucun document émis.</Card>
      ) : (
        Array.from(byYear.entries()).map(([year, list]) => (
          <section key={String(year)}>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-2">Année {year}</h2>
            <Card>
              <div className="divide-y">
                {list.map((d) => (
                  <div key={d.id} className="p-3 flex items-center gap-3 text-sm">
                    <Badge variant="outline" className="text-[10px] uppercase">{d.type.replace("_", " ")}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{d.admin.fullName || d.admin.email}</p>
                      <p className="text-xs text-muted-foreground">{d.title} · émis le {new Date(d.issuedAt).toLocaleDateString("fr-CA")}</p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <a href={d.fileUrl} target="_blank" rel="noopener"><Download className="h-3.5 w-3.5 mr-1" />PDF</a>
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        ))
      )}

      <IssueDialog open={dialog} employees={employees} onClose={() => setDialog(false)} onSaved={() => router.refresh()} />
    </div>
  );
}

function IssueDialog({ open, employees, onClose, onSaved }: { open: boolean; employees: Emp[]; onClose: () => void; onSaved: () => void }) {
  const [adminId, setAdminId] = useState("");
  const [type, setType] = useState<"t4" | "releve1" | "employment_letter" | "nr4" | "t2200" | "other">("t4");
  const [taxYear, setTaxYear] = useState(new Date().getFullYear().toString());
  const [title, setTitle] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (!adminId || !title || !fileUrl) { toast.error("Champs requis"); return; }
    setPending(true);
    const r = await issueTaxDocumentAction({
      adminId: Number(adminId),
      type, taxYear: Number(taxYear), title, fileUrl,
    });
    setPending(false);
    if (r.success) { toast.success("Document émis et notifié à l'employé"); onSaved(); onClose(); setTitle(""); setFileUrl(""); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader><DialogTitle className="text-base text-white flex items-center gap-2"><FileText className="h-4 w-4" />Émettre document fiscal</DialogTitle></DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Employé *</Label>
              <Select value={adminId} onValueChange={setAdminId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.fullName || e.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "t4" | "releve1" | "employment_letter" | "nr4" | "t2200" | "other")}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="t4">T4 (Canada)</SelectItem>
                  <SelectItem value="releve1">Relevé 1 (Québec)</SelectItem>
                  <SelectItem value="nr4">NR4</SelectItem>
                  <SelectItem value="t2200">T2200 (frais télétravail)</SelectItem>
                  <SelectItem value="employment_letter">Lettre d&apos;emploi</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Année fiscale</Label>
              <Input type="number" value={taxYear} onChange={(e) => setTaxYear(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Titre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="T4 - 2024" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Document PDF *</Label>
            <FileUploadInput
              value={fileUrl}
              onChange={setFileUrl}
              accept="application/pdf"
              folder="tax-docs"
              maxSizeMB={10}
            />
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "..." : "Émettre"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
