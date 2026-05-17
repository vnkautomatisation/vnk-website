"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { promptDialog } from "@/components/admin/prompt-dialog";
import { FileUploadInput } from "@/components/admin/file-upload-input";
import { Mail, CheckCircle2, XCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { issueEmploymentLetterAction, rejectEmploymentLetterAction } from "@/app/actions/hr-tax-docs";

type Req = {
  id: number; purpose: string; recipient: string | null; includeSalary: boolean;
  status: string; notes: string | null; letterUrl: string | null;
  createdAt: string; issuedAt: string | null;
  admin: { id: number; fullName: string | null; email: string };
};

const PURPOSE: Record<string, string> = {
  bank: "Banque", rental: "Location", embassy: "Ambassade", hypothec: "Hypothèque", other: "Autre",
};

export function LettersView({ requests }: { requests: Req[] }) {
  const router = useRouter();
  const [issueDialog, setIssueDialog] = useState<Req | null>(null);

  const pending = requests.filter((r) => r.status === "pending");
  const others = requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Mail className="h-5 w-5 text-[#0F2D52]" />Lettres d&apos;emploi</h1>
        <p className="text-sm text-muted-foreground">Demandes des employés à traiter.</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-2 uppercase tracking-wider">En attente ({pending.length})</h2>
        {pending.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Aucune demande en attente.</Card>
        ) : (
          <div className="space-y-2">
            {pending.map((r) => (
              <Card key={r.id} className="p-4 flex items-center gap-3">
                <Mail className="h-5 w-5 text-[#0F2D52]" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{r.admin.fullName || r.admin.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {PURPOSE[r.purpose] ?? r.purpose}
                    {r.recipient && ` · ${r.recipient}`}
                    {r.includeSalary ? " · avec salaire" : " · sans salaire"}
                    {" · "}{new Date(r.createdAt).toLocaleDateString("fr-CA")}
                  </p>
                  {r.notes && <p className="text-[11px] italic mt-1">« {r.notes} »</p>}
                </div>
                <Button size="sm" onClick={() => setIssueDialog(r)}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Émettre
                </Button>
                <Button size="sm" variant="outline" className="hover:text-destructive" onClick={async () => {
                  const reason = await promptDialog({
                    title: "Refuser la demande de lettre",
                    label: "Motif du refus",
                    placeholder: "Sera communiqué à l'employé",
                    multiline: true,
                    required: true,
                    variant: "destructive",
                    confirmLabel: "Refuser",
                  });
                  if (!reason) return;
                  const res = await rejectEmploymentLetterAction({ id: r.id, reason });
                  if (res.success) { toast.success("Refusée"); router.refresh(); }
                  else toast.error(res.error || "");
                }}>
                  <XCircle className="h-3.5 w-3.5 mr-1" />Refuser
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      {others.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2 uppercase tracking-wider">Traitées</h2>
          <Card>
            <div className="divide-y">
              {others.map((r) => (
                <div key={r.id} className="p-3 flex items-center gap-3 text-sm">
                  <Badge variant="outline" className="text-[10px]">
                    {r.status === "issued" ? "Émise" : "Refusée"}
                  </Badge>
                  <div className="flex-1">
                    <p className="font-medium">{r.admin.fullName || r.admin.email}</p>
                    <p className="text-xs text-muted-foreground">{PURPOSE[r.purpose]} · {new Date(r.createdAt).toLocaleDateString("fr-CA")}</p>
                  </div>
                  {r.status === "issued" && (
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={r.letterUrl || `/api/admin/employment-letters/${r.id}/pdf`}
                        target="_blank"
                        rel="noopener"
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />Télécharger PDF
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      <IssueLetterDialog req={issueDialog} onClose={() => setIssueDialog(null)} onSaved={() => router.refresh()} />
    </div>
  );
}

function IssueLetterDialog({ req, onClose, onSaved }: { req: Req | null; onClose: () => void; onSaved: () => void }) {
  const [letterUrl, setLetterUrl] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (!req || !letterUrl) return;
    setPending(true);
    const r = await issueEmploymentLetterAction({ id: req.id, letterUrl });
    setPending(false);
    if (r.success) { toast.success("Lettre émise"); setLetterUrl(""); onSaved(); onClose(); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader><DialogTitle className="text-base text-white">Émettre lettre d&apos;emploi</DialogTitle></DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <div className="text-xs text-muted-foreground">
            Pour <strong>{req?.admin.fullName || req?.admin.email}</strong>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Lettre PDF *</Label>
            <FileUploadInput
              value={letterUrl}
              onChange={setLetterUrl}
              accept="application/pdf"
              folder="employment-letters"
              maxSizeMB={5}
            />
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button onClick={submit} disabled={pending || !letterUrl}>{pending ? "..." : "Émettre"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
