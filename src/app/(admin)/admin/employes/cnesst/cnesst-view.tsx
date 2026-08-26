"use client";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Plus, Edit, FileText, Calendar, MapPin, Trash2, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { upsertCnesstIncidentAction, deleteCnesstIncidentAction, markCnesstReportedAction, markCnesstReturnedAction } from "@/app/actions/hr-cnesst";
import { confirmDialog, promptDialog } from "@/components/admin/prompt-dialog";

type Incident = {
  id: number; adminId: number; incidentDate: string; location: string;
  description: string; injuryType: string | null; bodyPart: string | null;
  witnessName: string | null; cnesstFileNumber: string | null;
  reportedToCnesstAt: string | null;
  daysAbsent: number | null; returnedToWorkAt: string | null;
  status: string; notes: string | null;
  admin: { id: number; fullName: string | null; email: string };
  reporter: { fullName: string | null; email: string } | null;
};
type Emp = { id: number; fullName: string | null; email: string };

const STATUS: Record<string, { label: string; color: string }> = {
  declared: { label: "Déclaré", color: "bg-amber-100 text-amber-700" },
  accepted: { label: "Accepté CNESST", color: "bg-emerald-100 text-emerald-700" },
  refused: { label: "Refusé CNESST", color: "bg-red-100 text-red-700" },
  closed: { label: "Fermé", color: "bg-gray-100 text-gray-700" },
};

export function CnesstView({ incidents, employees }: { incidents: Incident[]; employees: Emp[] }) {
  const tc = useTranslations("common");
  const router = useRouter();
  const [dialog, setDialog] = useState<{ open: boolean; existing: Incident | null }>({ open: false, existing: null });

  const totalDaysAbsent = incidents.reduce((s, i) => s + (i.daysAbsent ?? 0), 0);
  const active = incidents.filter((i) => i.status === "declared" || i.status === "accepted").length;

  const handleDelete = async (incident: Incident) => {
    const ok = await confirmDialog({
      title: "Supprimer cet incident ?",
      description: "Cette action est irréversible. L'historique sera perdu.",
      confirmLabel: "Supprimer",
      variant: "destructive",
    });
    if (!ok) return;
    const r = await deleteCnesstIncidentAction({ id: incident.id });
    if (r.success) { toast.success("Incident supprimé"); router.refresh(); }
    else toast.error(r.error || "");
  };

  const handleMarkReported = async (incident: Incident) => {
    const today = new Date().toISOString().slice(0, 10);
    const date = await promptDialog({
      title: "Marquer envoyé à la CNESST",
      label: "Date d'envoi à la CNESST (AAAA-MM-JJ)",
      defaultValue: today,
      placeholder: "AAAA-MM-JJ",
      confirmLabel: "Confirmer",
    });
    if (date === null) return;
    const r = await markCnesstReportedAction({ id: incident.id, date: date.trim() || today });
    if (r.success) { toast.success("Envoi CNESST enregistré"); router.refresh(); }
    else toast.error(r.error || "");
  };

  const handleMarkReturned = async (incident: Incident) => {
    const today = new Date().toISOString().slice(0, 10);
    const date = await promptDialog({
      title: "Retour au travail",
      label: "Date du retour au travail (AAAA-MM-JJ)",
      defaultValue: today,
      placeholder: "AAAA-MM-JJ",
      confirmLabel: "Confirmer",
      required: true,
    });
    if (date === null) return;
    const r = await markCnesstReturnedAction({ id: incident.id, date: date.trim() || today });
    if (r.success) { toast.success("Retour enregistré"); router.refresh(); }
    else toast.error(r.error || "");
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-CA", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />CNESST · Accidents du travail
          </h1>
          <p className="text-sm text-muted-foreground">
            Registre des déclarations CNESST (obligation Québec — déclaration &lt; 24h).
          </p>
        </div>
        <Button variant="destructive" onClick={() => setDialog({ open: true, existing: null })}>
          <Plus className="h-4 w-4 mr-1.5" />Nouvelle déclaration
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-3"><p className="text-xs uppercase tracking-wider text-muted-foreground">Total</p><p className="text-2xl font-bold">{incidents.length}</p></Card>
        <Card className="p-3 bg-amber-50/30 border-amber-200"><p className="text-xs uppercase tracking-wider text-amber-700">En cours</p><p className="text-2xl font-bold text-amber-900">{active}</p></Card>
        <Card className="p-3"><p className="text-xs uppercase tracking-wider text-muted-foreground">Jours d&apos;absence cumul.</p><p className="text-2xl font-bold">{totalDaysAbsent}</p></Card>
      </div>

      {incidents.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Aucune déclaration enregistrée. Espérons que ça reste !
        </Card>
      ) : (
        <div className="space-y-2">
          {incidents.map((i) => {
            const s = STATUS[i.status] ?? { label: i.status, color: "bg-gray-100 text-gray-700" };
            return (
              <Card key={i.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm">{i.admin.fullName || i.admin.email}</h3>
                      <Badge className={`text-[10px] ${s.color}`}>{s.label}</Badge>
                      {i.cnesstFileNumber && <Badge variant="outline" className="text-[10px]">N° dossier : {i.cnesstFileNumber}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(i.incidentDate).toLocaleString("fr-CA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{i.location}</span>
                    </p>
                    <p className="text-sm mt-2">{i.description}</p>
                    {(i.injuryType || i.bodyPart) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {i.injuryType && <strong>Blessure : </strong>}{i.injuryType}
                        {i.bodyPart && <span> · {i.bodyPart}</span>}
                      </p>
                    )}
                    {i.daysAbsent !== null && i.daysAbsent > 0 && (
                      <p className="text-xs text-amber-700 mt-1">Absent : {i.daysAbsent} jour{i.daysAbsent > 1 ? "s" : ""}</p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      {i.reportedToCnesstAt ? (
                        <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50">
                          <Send className="h-3 w-3 mr-1" />Envoyé le {fmtDate(i.reportedToCnesstAt)}
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs border-[#0F2D52] text-[#0F2D52] hover:bg-[#0F2D52]/5"
                          onClick={() => handleMarkReported(i)}
                        >
                          <Send className="h-3 w-3 mr-1" />Marquer envoyé CNESST
                        </Button>
                      )}
                      {i.returnedToWorkAt ? (
                        <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50">
                          <CheckCircle2 className="h-3 w-3 mr-1" />Retour le {fmtDate(i.returnedToWorkAt)}
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs border-[#0F2D52] text-[#0F2D52] hover:bg-[#0F2D52]/5"
                          onClick={() => handleMarkReturned(i)}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />Retour au travail
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialog({ open: true, existing: i })} aria-label={tc("edit")}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(i)} aria-label={tc("delete")}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <IncidentDialog
        open={dialog.open}
        existing={dialog.existing}
        employees={employees}
        onClose={() => setDialog({ open: false, existing: null })}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

function IncidentDialog({ open, existing, employees, onClose, onSaved }: { open: boolean; existing: Incident | null; employees: Emp[]; onClose: () => void; onSaved: () => void }) {
  const tc = useTranslations("common");
  const [adminId, setAdminId] = useState(existing?.adminId?.toString() ?? "");
  const [incidentDate, setIncidentDate] = useState(existing?.incidentDate?.slice(0, 16) ?? new Date().toISOString().slice(0, 16));
  const [location, setLocation] = useState(existing?.location ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [injuryType, setInjuryType] = useState(existing?.injuryType ?? "");
  const [bodyPart, setBodyPart] = useState(existing?.bodyPart ?? "");
  const [witnessName, setWitnessName] = useState(existing?.witnessName ?? "");
  const [cnesstFileNumber, setCnesstFileNumber] = useState(existing?.cnesstFileNumber ?? "");
  const [daysAbsent, setDaysAbsent] = useState(existing?.daysAbsent?.toString() ?? "");
  const [status, setStatus] = useState(existing?.status ?? "declared");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setAdminId(existing?.adminId?.toString() ?? "");
      setIncidentDate(existing?.incidentDate?.slice(0, 16) ?? new Date().toISOString().slice(0, 16));
      setLocation(existing?.location ?? "");
      setDescription(existing?.description ?? "");
      setInjuryType(existing?.injuryType ?? "");
      setBodyPart(existing?.bodyPart ?? "");
      setWitnessName(existing?.witnessName ?? "");
      setCnesstFileNumber(existing?.cnesstFileNumber ?? "");
      setDaysAbsent(existing?.daysAbsent?.toString() ?? "");
      setStatus(existing?.status ?? "declared");
    }
  }, [open, existing]);

  const submit = async () => {
    if (!adminId || !location || !description) { toast.error("Champs obligatoires manquants"); return; }
    setPending(true);
    const r = await upsertCnesstIncidentAction({
      id: existing?.id,
      adminId: Number(adminId),
      incidentDate: new Date(incidentDate).toISOString(),
      location, description,
      injuryType: injuryType || null,
      bodyPart: bodyPart || null,
      witnessName: witnessName || null,
      cnesstFileNumber: cnesstFileNumber || null,
      daysAbsent: daysAbsent ? Number(daysAbsent) : null,
      status: status as "declared" | "accepted" | "refused" | "closed",
    });
    setPending(false);
    if (r.success) { toast.success("Enregistré"); onSaved(); onClose(); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-br from-red-700 to-red-900 text-white px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />Déclaration CNESST
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Toute déclaration ici alerte automatiquement les super-admins.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Employé blessé *</Label>
              <Select value={adminId} onValueChange={setAdminId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.fullName || e.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Date & heure *</Label>
              <Input type="datetime-local" value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Lieu *</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Atelier, chantier client X…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Description *</Label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y" placeholder="Décrivez l'accident, les circonstances, l'enchaînement…" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Type blessure</Label>
              <Input value={injuryType} onChange={(e) => setInjuryType(e.target.value)} placeholder="Brûlure, fracture, choc électrique…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Partie du corps</Label>
              <Input value={bodyPart} onChange={(e) => setBodyPart(e.target.value)} placeholder="Main droite, dos…" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Témoin</Label>
              <Input value={witnessName} onChange={(e) => setWitnessName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">N° dossier CNESST</Label>
              <Input value={cnesstFileNumber} onChange={(e) => setCnesstFileNumber(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Jours d&apos;absence</Label>
              <Input type="number" value={daysAbsent} onChange={(e) => setDaysAbsent(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{tc("status")}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="declared">Déclaré</SelectItem>
                  <SelectItem value="accepted">Accepté CNESST</SelectItem>
                  <SelectItem value="refused">Refusé CNESST</SelectItem>
                  <SelectItem value="closed">Fermé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>{tc("cancel")}</Button>
          <Button variant="destructive" onClick={submit} disabled={pending}>{pending ? "..." : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
