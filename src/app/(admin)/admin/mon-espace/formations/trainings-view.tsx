"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GraduationCap, BadgeCheck, AlertTriangle, Plus, Edit, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingsTabs, type TabItem } from "@/components/admin/settings-tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { upsertLicenseAction, deleteLicenseAction, upsertTrainingAction, deleteTrainingAction } from "@/app/actions/hr-employee-file";

type License = { id: number; type: string; number: string | null; issuer: string | null; issuedAt: string | null; expiresAt: string | null; fileUrl: string | null; isMandatory: boolean; notes: string | null };
type Training = { id: number; title: string; category: string; provider: string | null; completedAt: string | null; expiresAt: string | null; certificateUrl: string | null; isMandatory: boolean; hoursCount: number | null; notes: string | null };

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  return Math.floor((new Date(date).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}
function ExpiryBadge({ date }: { date: string | null }) {
  const t = useTranslations("admin.trainings");
  const days = daysUntil(date);
  if (days === null) return null;
  if (days < 0) return <Badge variant="outline" className="text-[10px] text-red-700 border-red-300 bg-red-50">{t("expire")}</Badge>;
  if (days < 30) return <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">Expire dans {days}j</Badge>;
  if (days < 90) return <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-300 bg-blue-50">Expire dans {Math.floor(days / 30)} mois</Badge>;
  return null;
}

export function TrainingsView({ adminId, licenses, trainings }: { adminId: number; licenses: License[]; trainings: Training[] }) {
  const t = useTranslations("admin.trainings");
  const tc = useTranslations("common");
  const router = useRouter();
  const [tab, setTab] = useState<"licenses" | "trainings">("licenses");
  const [licenseDialog, setLicenseDialog] = useState<{ open: boolean; existing: License | null }>({ open: false, existing: null });
  const [trainingDialog, setTrainingDialog] = useState<{ open: boolean; existing: Training | null }>({ open: false, existing: null });
  const [confirmDelLic, setConfirmDelLic] = useState<License | null>(null);
  const [confirmDelTr, setConfirmDelTr] = useState<Training | null>(null);

  const TABS: TabItem<"licenses" | "trainings">[] = [
    { key: "licenses", label: t("permis_certifications"), icon: BadgeCheck, count: licenses.length },
    { key: "trainings", label: t("formations"), icon: GraduationCap, count: trainings.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-[#0F2D52]" />Formations & permis
          </h1>
          <p className="text-sm text-muted-foreground">{t("qualifications_certifications_formations_suivies")}</p>
        </div>
        {tab === "licenses" ? (
          <Button onClick={() => setLicenseDialog({ open: true, existing: null })}>
            <Plus className="h-4 w-4 mr-1.5" />Permis
          </Button>
        ) : (
          <Button onClick={() => setTrainingDialog({ open: true, existing: null })}>
            <Plus className="h-4 w-4 mr-1.5" />Formation
          </Button>
        )}
      </div>

      <SettingsTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "licenses" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {licenses.length === 0 ? (
            <Card className="col-span-full p-10 text-center text-sm text-muted-foreground">{t("aucun_permis_enregistre")}</Card>
          ) : licenses.map((l) => (
            <Card key={l.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-sm">{l.type}</h3>
                    {l.isMandatory && <Badge variant="outline" className="text-[9px] text-red-700 border-red-300 bg-red-50">{tc("required")}</Badge>}
                    <ExpiryBadge date={l.expiresAt} />
                  </div>
                  <p className="text-xs text-muted-foreground">{l.issuer ?? "—"}{l.number && ` · n° ${l.number}`}</p>
                  {l.expiresAt && (
                    <p className="text-[11px] text-muted-foreground mt-1">Expire le {new Date(l.expiresAt).toLocaleDateString("fr-CA")}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLicenseDialog({ open: true, existing: l })} aria-label={tc("edit")}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setConfirmDelLic(l)} aria-label={tc("delete")}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "trainings" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {trainings.length === 0 ? (
            <Card className="col-span-full p-10 text-center text-sm text-muted-foreground">{t("aucune_formation_enregistree")}</Card>
          ) : trainings.map((training) => (
            <Card key={training.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-sm">{training.title}</h3>
                    <Badge variant="outline" className="text-[9px]">{training.category}</Badge>
                    {training.isMandatory && <Badge variant="outline" className="text-[9px] text-red-700 border-red-300 bg-red-50">{tc("required")}</Badge>}
                    <ExpiryBadge date={training.expiresAt} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {training.provider ?? "—"}
                    {training.completedAt && ` · Complétée le ${new Date(training.completedAt).toLocaleDateString("fr-CA")}`}
                    {training.hoursCount && ` · ${Number(training.hoursCount)}h`}
                  </p>
                  {training.completedAt && (
                    <p className="text-[11px] text-emerald-700 flex items-center gap-1 mt-1">
                      <CheckCircle2 className="h-3 w-3" />{t("trainings_view_completee")}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTrainingDialog({ open: true, existing: training })} aria-label={tc("edit")}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setConfirmDelTr(training)} aria-label={tc("delete")}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <LicenseDialog open={licenseDialog.open} existing={licenseDialog.existing} adminId={adminId} onClose={() => setLicenseDialog({ open: false, existing: null })} onSaved={() => router.refresh()} />
      <TrainingDialog open={trainingDialog.open} existing={trainingDialog.existing} adminId={adminId} onClose={() => setTrainingDialog({ open: false, existing: null })} onSaved={() => router.refresh()} />

      <ConfirmDialog
        open={!!confirmDelLic}
        onOpenChange={(o) => !o && setConfirmDelLic(null)}
        title={`Supprimer ${confirmDelLic?.type} ?`}
        description={t("permis_sera_retire_dossier")}
        confirmLabel={tc("delete")}
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDelLic) return;
          const r = await deleteLicenseAction({ id: confirmDelLic.id, adminId });
          if (r.success) { toast.success(t("supprime")); router.refresh(); } else toast.error(r.error || "");
          setConfirmDelLic(null);
        }}
      />
      <ConfirmDialog
        open={!!confirmDelTr}
        onOpenChange={(o) => !o && setConfirmDelTr(null)}
        title={`Supprimer ${confirmDelTr?.title} ?`}
        description={t("formation_sera_retiree_dossier")}
        confirmLabel={tc("delete")}
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDelTr) return;
          const r = await deleteTrainingAction({ id: confirmDelTr.id, adminId });
          if (r.success) { toast.success(t("supprime")); router.refresh(); } else toast.error(r.error || "");
          setConfirmDelTr(null);
        }}
      />
    </div>
  );
}

function LicenseDialog({ open, existing, adminId, onClose, onSaved }: { open: boolean; existing: License | null; adminId: number; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("admin.trainings");
  const tc = useTranslations("common");
  const [type, setType] = useState(existing?.type ?? "");
  const [number, setNumber] = useState(existing?.number ?? "");
  const [issuer, setIssuer] = useState(existing?.issuer ?? "");
  const [issuedAt, setIssuedAt] = useState(existing?.issuedAt?.split("T")[0] ?? "");
  const [expiresAt, setExpiresAt] = useState(existing?.expiresAt?.split("T")[0] ?? "");
  const [fileUrl, setFileUrl] = useState(existing?.fileUrl ?? "");
  const [isMandatory, setIsMandatory] = useState(existing?.isMandatory ?? false);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (!type.trim()) { toast.error(t("type_requis")); return; }
    setPending(true);
    const r = await upsertLicenseAction({
      id: existing?.id, adminId,
      type: type.trim(),
      number: number || null, issuer: issuer || null,
      issuedAt: issuedAt || null, expiresAt: expiresAt || null,
      fileUrl: fileUrl || null, isMandatory, notes: notes || null,
    });
    setPending(false);
    if (r.success) { toast.success(t("enregistre")); onSaved(); onClose(); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <BadgeCheck className="h-4 w-4" />{existing ? t("modifier_permis") : t("nouveau_permis")}
            </DialogTitle>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">{t("type")}</Label>
            <Input value={type} onChange={(e) => setType(e.target.value)} placeholder={t("licence_electricien_permis_classe_5")} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">N°</Label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{t("emetteur")}</Label>
              <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder={t("rbq_ccq_croix_rouge")} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{t("emis")}</Label>
              <Input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{t("expire_2")}</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">{t("url_certificat_pdf")}</Label>
            <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://..." />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isMandatory} onChange={(e) => setIsMandatory(e.target.checked)} className="h-4 w-4 rounded border-input" />
            {t("permis_obligatoire_mon_poste")}
          </label>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">{t("notes")}</Label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y" />
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

function TrainingDialog({ open, existing, adminId, onClose, onSaved }: { open: boolean; existing: Training | null; adminId: number; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("admin.trainings");
  const tc = useTranslations("common");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [category, setCategory] = useState(existing?.category ?? "safety");
  const [provider, setProvider] = useState(existing?.provider ?? "");
  const [completedAt, setCompletedAt] = useState(existing?.completedAt?.split("T")[0] ?? "");
  const [expiresAt, setExpiresAt] = useState(existing?.expiresAt?.split("T")[0] ?? "");
  const [certUrl, setCertUrl] = useState(existing?.certificateUrl ?? "");
  const [isMandatory, setIsMandatory] = useState(existing?.isMandatory ?? false);
  const [hours, setHours] = useState(existing?.hoursCount?.toString() ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (!title.trim()) { toast.error(t("titre_requis")); return; }
    setPending(true);
    const r = await upsertTrainingAction({
      id: existing?.id, adminId,
      title: title.trim(),
      category: category as "safety" | "technical" | "leadership" | "compliance" | "other",
      provider: provider || null,
      completedAt: completedAt || null, expiresAt: expiresAt || null,
      certificateUrl: certUrl || null,
      isMandatory, hoursCount: hours ? Number(hours) : null,
      notes: notes || null,
    });
    setPending(false);
    if (r.success) { toast.success(t("enregistre")); onSaved(); onClose(); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />{existing ? t("modifier_formation") : t("nouvelle_formation")}
            </DialogTitle>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">{t("titre")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("simdut_2015_cadenassage")} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{t("categorie")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="safety">{t("securite_sst")}</SelectItem>
                  <SelectItem value="technical">{t("technique")}</SelectItem>
                  <SelectItem value="leadership">{t("leadership")}</SelectItem>
                  <SelectItem value="compliance">{t("conformite")}</SelectItem>
                  <SelectItem value="other">{t("autre")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{t("heures")}</Label>
              <Input type="number" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="8" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">{t("fournisseur")}</Label>
            <Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder={t("cnesst_schneider")} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{t("completee")}</Label>
              <Input type="date" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{t("expire_2")}</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">{t("url_certificat")}</Label>
            <Input value={certUrl} onChange={(e) => setCertUrl(e.target.value)} placeholder="https://..." />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isMandatory} onChange={(e) => setIsMandatory(e.target.checked)} className="h-4 w-4 rounded border-input" />
            {t("formation_obligatoire_mon_poste")}
          </label>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>{tc("cancel")}</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "..." : t("enregistrer")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
