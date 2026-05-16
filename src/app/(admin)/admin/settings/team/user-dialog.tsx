"use client";
// Dialog création / édition / réinit mot de passe d'un utilisateur admin.
// Style VNK : header navy + sections claires.
import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { User, Key, Calendar, Briefcase, Shield, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  createUserAction, updateUserAction, resetUserPasswordAction,
} from "@/app/actions/users";
import type { UserRow, RoleRow, PositionRow } from "./team-view";

type Mode = "create" | "edit";
type Tab = "info" | "password";

function generatePassword(): string {
  const chars = "ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  let pwd = "";
  for (let i = 0; i < 16; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

export function UserDialog({
  open, onOpenChange, user, roles, positions, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserRow | null;
  roles: RoleRow[];
  positions: PositionRow[];
  onSaved: () => void;
}) {
  const mode: Mode = user ? "edit" : "create";
  const [tab, setTab] = useState<Tab>("info");
  const [pending, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [roleId, setRoleId] = useState<string>("none");
  const [positionId, setPositionId] = useState<string>("none");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open) {
      setTab("info");
      if (user) {
        setEmail(user.email);
        setFullName(user.fullName ?? "");
        setPhone(user.phone ?? "");
        setTitle(user.title ?? "");
        setDepartment(user.department ?? "");
        setRoleId(user.roleId?.toString() ?? "none");
        setPositionId(user.positionId?.toString() ?? "none");
        setStartDate(user.startDate ? user.startDate.split("T")[0] : "");
        setEndDate(user.endDate ? user.endDate.split("T")[0] : "");
        setIsActive(user.isActive);
        setPassword("");
      } else {
        setEmail(""); setFullName(""); setPhone(""); setTitle("");
        setDepartment(""); setRoleId("none"); setPositionId("none");
        setStartDate(""); setEndDate("");
        setIsActive(true); setPassword(generatePassword());
      }
    }
  }, [open, user]);

  // Auto-fill department & roleId quand on choisit un poste
  const handlePositionChange = (v: string) => {
    setPositionId(v);
    if (v === "none") return;
    const pos = positions.find((p) => p.id.toString() === v);
    if (pos) {
      if (pos.defaultDepartment && !department) setDepartment(pos.defaultDepartment);
      if (pos.defaultRoleId && roleId === "none") setRoleId(pos.defaultRoleId.toString());
    }
  };

  const handleSave = () => {
    startTransition(async () => {
      if (mode === "create") {
        if (password.length < 12) {
          toast.error("Mot de passe trop court (min 12)");
          return;
        }
        const result = await createUserAction({
          email, fullName, password,
          roleId: roleId === "none" ? null : Number(roleId),
          positionId: positionId === "none" ? null : Number(positionId),
          department: department || null,
          title: title || null,
          phone: phone || null,
          startDate: startDate || null,
        });
        if (result.success) {
          toast.success("Utilisateur créé");
          onSaved(); onOpenChange(false);
        } else {
          toast.error(result.error);
        }
      } else if (user) {
        const result = await updateUserAction({
          id: user.id, fullName,
          roleId: roleId === "none" ? null : Number(roleId),
          positionId: positionId === "none" ? null : Number(positionId),
          department: department || null,
          title: title || null,
          phone: phone || null,
          startDate: startDate || null,
          endDate: endDate || null,
          isActive,
        });
        if (result.success) {
          toast.success("Utilisateur mis à jour");
          onSaved(); onOpenChange(false);
        } else {
          toast.error(result.error);
        }
      }
    });
  };

  const handleResetPassword = () => {
    if (!user || password.length < 12) {
      toast.error("Mot de passe trop court (min 12)");
      return;
    }
    startTransition(async () => {
      const result = await resetUserPasswordAction({ id: user.id, newPassword: password });
      if (result.success) {
        toast.success("Mot de passe réinitialisé. Toutes les sessions de cet utilisateur ont été fermées.");
        onSaved(); onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header VNK navy */}
        <div className="bg-[#0F2D52] text-white px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
            <User className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-white text-base">
              {mode === "create" ? "Nouvel utilisateur" : user?.fullName || user?.email}
            </DialogTitle>
            <p className="text-xs text-white/70">
              {mode === "create" ? "Créer un compte employé" : "Modifier les informations"}
            </p>
          </div>
        </div>

        {/* Tabs (mode edit seulement) */}
        {mode === "edit" && (
          <div className="border-b px-6">
            <div className="flex gap-1">
              <button
                onClick={() => setTab("info")}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "info" ? "border-[#0F2D52] text-[#0F2D52]" : "border-transparent text-muted-foreground"}`}
              >
                Informations
              </button>
              <button
                onClick={() => setTab("password")}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "password" ? "border-[#0F2D52] text-[#0F2D52]" : "border-transparent text-muted-foreground"}`}
              >
                Mot de passe
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {tab === "info" && (
            <>
              <Section icon={User} title="Identité">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Nom complet *">
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jean Tremblay" />
                  </Field>
                  <Field label={mode === "create" ? "Courriel *" : "Courriel"}>
                    <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jean@vnkautomatisation.ca" disabled={mode === "edit"} type="email" />
                  </Field>
                  <Field label="Titre">
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Comptable senior" />
                  </Field>
                  <Field label="Téléphone">
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 514 555-0100" />
                  </Field>
                </div>
              </Section>

              <Section icon={Briefcase} title="Poste & Rôle">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Poste">
                    <Select value={positionId} onValueChange={handlePositionChange}>
                      <SelectTrigger><SelectValue placeholder="Choisir un poste" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Aucun —</SelectItem>
                        {positions.map((p) => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Rôle d'accès">
                    <Select value={roleId} onValueChange={setRoleId}>
                      <SelectTrigger><SelectValue placeholder="Choisir un rôle" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Aucun —</SelectItem>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Département">
                    <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Comptabilité" />
                  </Field>
                </div>
              </Section>

              <Section icon={Calendar} title="Dates">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Date d'embauche">
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </Field>
                  {mode === "edit" && (
                    <Field label="Date de fin d'emploi">
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </Field>
                  )}
                </div>
              </Section>

              {mode === "edit" && (
                <Section icon={Shield} title="Statut">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Compte actif</p>
                      <p className="text-xs text-muted-foreground">Désactiver ferme toutes les sessions</p>
                    </div>
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                  </div>
                </Section>
              )}

              {mode === "create" && (
                <Section icon={Key} title="Mot de passe initial">
                  <div className="flex gap-2">
                    <Input value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono text-sm" />
                    <Button type="button" variant="outline" size="icon" onClick={() => setPassword(generatePassword())} title="Régénérer">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Minimum 12 caractères. Communiquez-le à l&apos;employé par un canal sécurisé.
                  </p>
                </Section>
              )}
            </>
          )}

          {tab === "password" && mode === "edit" && (
            <Section icon={Key} title="Réinitialiser le mot de passe">
              <p className="text-xs text-muted-foreground mb-3">
                Toutes les sessions actives de cet utilisateur seront fermées immédiatement.
              </p>
              <div className="flex gap-2">
                <Input value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono text-sm" placeholder="Nouveau mot de passe (min 12)" />
                <Button type="button" variant="outline" size="icon" onClick={() => setPassword(generatePassword())} title="Générer">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </Section>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/30 px-6 py-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Annuler
          </Button>
          {tab === "password" ? (
            <Button onClick={handleResetPassword} disabled={pending || password.length < 12} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
              {pending ? "..." : "Réinitialiser"}
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={pending} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
              {pending ? "..." : mode === "create" ? "Créer" : "Enregistrer"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="h-4 w-4 text-[#0F2D52]" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52]">{title}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
