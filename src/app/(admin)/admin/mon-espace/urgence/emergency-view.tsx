"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Heart, Plus, Edit, Trash2, Phone, Mail, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { upsertEmergencyContactAction, deleteEmergencyContactAction } from "@/app/actions/hr-employee-file";

type Contact = {
  id: number; name: string; relationship: string;
  phone: string; phoneAlt: string | null; email: string | null;
  isPrimary: boolean; notes: string | null;
};

export function EmergencyContactsView({ adminId, contacts }: { adminId: number; contacts: Contact[] }) {
  const tc = useTranslations("common");
  const router = useRouter();
  const [dialog, setDialog] = useState<{ open: boolean; existing: Contact | null }>({ open: false, existing: null });
  const [confirmDel, setConfirmDel] = useState<Contact | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />Contacts d&apos;urgence
          </h1>
          <p className="text-sm text-muted-foreground">
            Personnes à contacter en cas d&apos;accident. Au moins un contact principal recommandé.
          </p>
        </div>
        <Button onClick={() => setDialog({ open: true, existing: null })}>
          <Plus className="h-4 w-4 mr-1.5" />{tc("add")}
        </Button>
      </div>

      {contacts.length === 0 ? (
        <Card className="p-10 text-center">
          <Heart className="h-10 w-10 text-red-300 mx-auto mb-3" />
          <p className="text-sm font-medium">Aucun contact d&apos;urgence</p>
          <p className="text-xs text-muted-foreground mt-1">
            Indispensable pour la sécurité — surtout en chantier client.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {contacts.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm">{c.name}</h3>
                    {c.isPrimary && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-full">
                        <Star className="h-2.5 w-2.5 fill-current" />Principal
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{c.relationship}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialog({ open: true, existing: c })} aria-label={tc("edit")}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setConfirmDel(c)} aria-label={tc("delete")}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1 mt-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <a href={`tel:${c.phone}`} className="font-mono">{c.phone}</a>
                </div>
                {c.phoneAlt && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <a href={`tel:${c.phoneAlt}`} className="font-mono text-muted-foreground">{c.phoneAlt}</a>
                  </div>
                )}
                {c.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <a href={`mailto:${c.email}`} className="text-[#0F2D52] hover:underline">{c.email}</a>
                  </div>
                )}
                {c.notes && <p className="text-[11px] italic text-muted-foreground mt-1">{c.notes}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <ContactDialog
        open={dialog.open}
        existing={dialog.existing}
        adminId={adminId}
        onClose={() => setDialog({ open: false, existing: null })}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(o) => !o && setConfirmDel(null)}
        title={`Supprimer ${confirmDel?.name} ?`}
        description="Ce contact d'urgence sera retiré."
        confirmLabel={tc("delete")}
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDel) return;
          const r = await deleteEmergencyContactAction({ id: confirmDel.id, adminId });
          if (r.success) { toast.success("Contact supprimé"); router.refresh(); }
          else toast.error(r.error || "");
          setConfirmDel(null);
        }}
      />
    </div>
  );
}

function ContactDialog({ open, existing, adminId, onClose, onSaved }: {
  open: boolean; existing: Contact | null; adminId: number; onClose: () => void; onSaved: () => void;
}) {
  const tc = useTranslations("common");
  const [name, setName] = useState(existing?.name ?? "");
  const [relationship, setRelationship] = useState(existing?.relationship ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [phoneAlt, setPhoneAlt] = useState(existing?.phoneAlt ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [isPrimary, setIsPrimary] = useState(existing?.isPrimary ?? false);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (!name.trim() || !relationship.trim() || !phone.trim()) {
      toast.error("Nom, relation et téléphone requis"); return;
    }
    setPending(true);
    const r = await upsertEmergencyContactAction({
      id: existing?.id,
      adminId,
      name: name.trim(),
      relationship: relationship.trim(),
      phone: phone.trim(),
      phoneAlt: phoneAlt.trim() || null,
      email: email.trim() || null,
      isPrimary,
      notes: notes.trim() || null,
    });
    setPending(false);
    if (r.success) { toast.success("Enregistré"); onSaved(); onClose(); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Heart className="h-4 w-4" />{existing ? "Modifier" : "Nouveau"} contact d&apos;urgence
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Visible uniquement par les RH/super-admins en cas d&apos;urgence.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Nom complet *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Marie Tremblay" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Relation *</Label>
              <Input value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="Conjointe, Parent…" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Téléphone *</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="514-555-1234" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Téléphone alt</Label>
              <Input value={phoneAlt} onChange={(e) => setPhoneAlt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Courriel</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="h-4 w-4 rounded border-input" />
            <Star className={`h-3.5 w-3.5 ${isPrimary ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`} />
            Contact principal
          </label>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Notes</Label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y" placeholder="Ex : parle seulement français" />
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>{tc("cancel")}</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "..." : existing ? "Enregistrer" : "Ajouter"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
