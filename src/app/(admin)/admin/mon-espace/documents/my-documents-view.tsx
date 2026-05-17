"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Download, FileSignature, Mail, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingsTabs, type TabItem } from "@/components/admin/settings-tabs";
import { SignaturePad } from "../../employes/contrats/signature-pad";
import { MarkdownView } from "@/components/admin/markdown-view";
import { signLegalDocAction } from "@/app/actions/hr-legal-docs";
import { requestEmploymentLetterAction } from "@/app/actions/hr-tax-docs";

type LegalDoc = {
  id: number; title: string; version: string; category: string; isRequired: boolean;
  bodyMarkdown: string;
  signatures: Array<{ id: number; version: string; signedAt: string }>;
};
type TaxDoc = {
  id: number; type: string; taxYear: number | null; title: string;
  fileUrl: string; issuedAt: string;
  issuer: { fullName: string | null; email: string } | null;
};
type LetterReq = {
  id: number; purpose: string; recipient: string | null; status: string;
  letterUrl: string | null; createdAt: string; issuedAt: string | null; notes: string | null;
};

const PURPOSE_LABEL: Record<string, string> = {
  bank: "Banque",
  rental: "Location",
  embassy: "Ambassade / immigration",
  hypothec: "Hypothèque",
  other: "Autre",
};

export function MyDocumentsView({ legalDocs, taxDocs, letterRequests }: {
  legalDocs: LegalDoc[];
  taxDocs: TaxDoc[];
  letterRequests: LetterReq[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"all" | "tax" | "legal" | "letters">("all");
  const [signDialog, setSignDialog] = useState<LegalDoc | null>(null);
  const [letterDialog, setLetterDialog] = useState(false);

  const TABS: TabItem<"all" | "tax" | "legal" | "letters">[] = [
    { key: "all", label: "Tous", icon: FileText },
    { key: "tax", label: "Fiscaux", icon: FileText, count: taxDocs.length },
    { key: "legal", label: "Légaux", icon: FileSignature, count: legalDocs.length },
    { key: "letters", label: "Lettres d'emploi", icon: Mail, count: letterRequests.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#0F2D52]" />Mes documents
          </h1>
          <p className="text-sm text-muted-foreground">
            Documents fiscaux, politiques signées, lettres d&apos;emploi.
          </p>
        </div>
        <Button onClick={() => setLetterDialog(true)}>
          <Plus className="h-4 w-4 mr-1.5" />Demander une lettre d&apos;emploi
        </Button>
      </div>

      <SettingsTabs tabs={TABS} active={tab} onChange={setTab} />

      {/* DOCS FISCAUX */}
      {(tab === "all" || tab === "tax") && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Documents fiscaux</h2>
          {taxDocs.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Aucun document fiscal émis pour l&apos;instant.
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {taxDocs.map((d) => (
                <Card key={d.id} className="p-3 flex items-center gap-3">
                  <FileText className="h-5 w-5 text-[#0F2D52] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{d.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.type === "t4" ? "T4 (Canada)" : d.type === "releve1" ? "Relevé 1 (Québec)" : d.type}
                      {d.taxYear && ` · ${d.taxYear}`}
                      {" · "}Émis le {new Date(d.issuedAt).toLocaleDateString("fr-CA")}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <a href={d.fileUrl} target="_blank" rel="noopener">
                      <Download className="h-3.5 w-3.5 mr-1" />PDF
                    </a>
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {/* DOCS LÉGAUX À SIGNER */}
      {(tab === "all" || tab === "legal") && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Politiques & documents légaux</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {legalDocs.map((d) => {
              const sig = d.signatures.find((s) => s.version === d.version);
              const isSigned = !!sig;
              return (
                <Card key={d.id} className="p-3">
                  <div className="flex items-start gap-3">
                    <FileSignature className="h-5 w-5 text-[#0F2D52] shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium text-sm">{d.title}</p>
                        {d.isRequired && <Badge variant="outline" className="text-[9px] text-red-700 border-red-300 bg-red-50">Obligatoire</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">v{d.version}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        {isSigned ? (
                          <Badge className="text-[10px] bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                            Signé le {new Date(sig.signedAt).toLocaleDateString("fr-CA")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">
                            <AlertCircle className="h-2.5 w-2.5 mr-1" />Non signé
                          </Badge>
                        )}
                        {!isSigned && (
                          <Button size="sm" className="h-7 text-xs" onClick={() => setSignDialog(d)}>
                            Lire & signer
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* LETTRES D'EMPLOI */}
      {(tab === "all" || tab === "letters") && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Demandes de lettre d&apos;emploi</h2>
          {letterRequests.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Aucune demande. Cliquez sur « Demander une lettre d&apos;emploi » en haut pour faire une demande.
            </Card>
          ) : (
            <div className="space-y-2">
              {letterRequests.map((r) => (
                <Card key={r.id} className="p-3 flex items-center gap-3">
                  <Mail className="h-5 w-5 text-[#0F2D52] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{PURPOSE_LABEL[r.purpose] ?? r.purpose}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.recipient && `Destinataire : ${r.recipient} · `}
                      Demandée le {new Date(r.createdAt).toLocaleDateString("fr-CA")}
                    </p>
                    {r.notes && <p className="text-[11px] italic text-muted-foreground mt-0.5">« {r.notes} »</p>}
                  </div>
                  {r.status === "pending" && (
                    <Badge className="bg-amber-100 text-amber-700 text-[10px]">En attente</Badge>
                  )}
                  {r.status === "issued" && r.letterUrl && (
                    <Button asChild size="sm" variant="outline">
                      <a href={r.letterUrl} target="_blank" rel="noopener">
                        <Download className="h-3.5 w-3.5 mr-1" />PDF
                      </a>
                    </Button>
                  )}
                  {r.status === "rejected" && (
                    <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50 text-[10px]">Refusée</Badge>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      <SignLegalDialog
        doc={signDialog}
        onClose={() => setSignDialog(null)}
        onSigned={() => router.refresh()}
      />

      <RequestLetterDialog
        open={letterDialog}
        onClose={() => setLetterDialog(false)}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

function SignLegalDialog({ doc, onClose, onSigned }: { doc: LegalDoc | null; onClose: () => void; onSigned: () => void }) {
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const [pending, setPending] = useState(false);

  if (!doc) return null;

  const submit = async () => {
    if (!ack || !signatureData) return;
    setPending(true);
    const r = await signLegalDocAction({ templateId: doc.id, signatureData });
    setPending(false);
    if (r.success) { toast.success("Document signé"); onSigned(); onClose(); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <FileSignature className="h-4 w-4" />{doc.title} <span className="text-white/70 text-xs">v{doc.version}</span>
            </DialogTitle>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <div className="rounded-lg border bg-muted/20 p-4 max-h-72 overflow-y-auto">
            <MarkdownView>{doc.bodyMarkdown}</MarkdownView>
          </div>
          <label className="flex items-start gap-2 text-xs cursor-pointer p-3 rounded-md border bg-muted/10">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="h-4 w-4 mt-0.5 rounded border-input flex-shrink-0" />
            <span>J&apos;ai lu intégralement le document et j&apos;accepte ses termes.</span>
          </label>
          <SignaturePad onChange={setSignatureData} />
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button onClick={submit} disabled={pending || !ack || !signatureData}>
            {pending ? "..." : "Signer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestLetterDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [purpose, setPurpose] = useState<"bank" | "rental" | "embassy" | "hypothec" | "other">("bank");
  const [recipient, setRecipient] = useState("");
  const [includeSalary, setIncludeSalary] = useState(true);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    const r = await requestEmploymentLetterAction({
      purpose, recipient: recipient || null, includeSalary, notes: notes || null,
    });
    setPending(false);
    if (r.success) {
      toast.success("Demande envoyée aux RH");
      setRecipient(""); setNotes(""); setPurpose("bank");
      onSaved(); onClose();
    } else toast.error(r.error || "");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Mail className="h-4 w-4" />Demander une lettre d&apos;emploi
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Les RH la rédigeront et vous la rendront disponible ici.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Pour quel usage ?</Label>
            <Select value={purpose} onValueChange={(v) => setPurpose(v as typeof purpose)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Banque</SelectItem>
                <SelectItem value="rental">Location de logement</SelectItem>
                <SelectItem value="embassy">Ambassade / immigration</SelectItem>
                <SelectItem value="hypothec">Hypothèque</SelectItem>
                <SelectItem value="other">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Destinataire (optionnel)</Label>
            <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Ex : Banque Royale, propriétaire X" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={includeSalary} onChange={(e) => setIncludeSalary(e.target.checked)} className="h-4 w-4 rounded border-input" />
            Inclure le salaire annuel dans la lettre
          </label>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Notes pour les RH</Label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y" placeholder="Précisions, urgence, format particulier…" />
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "..." : "Envoyer la demande"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
