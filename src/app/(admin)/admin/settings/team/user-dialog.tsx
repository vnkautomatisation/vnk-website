"use client";
// Dialog création / édition / réinit mot de passe d'un utilisateur admin.
// Style VNK : header navy + sections claires.
import { useState, useEffect, useTransition, useRef } from "react";
import { toast } from "sonner";
import { User, Key, Calendar, Briefcase, Shield, RefreshCw, Upload, X, Camera, Mail, Send, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FormSection, Field } from "@/components/admin/form-section";
import {
  createUserAction, updateUserAction, resetUserPasswordAction, inviteUserAction,
  sendPasswordResetEmailAction,
} from "@/app/actions/users";
import { cn } from "@/lib/utils";
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
  open, onOpenChange, user, roles, positions, onSaved, initialTab = "info",
  teams = [], allAdmins = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserRow | null;
  roles: RoleRow[];
  positions: PositionRow[];
  onSaved: () => void;
  initialTab?: Tab;
  teams?: Array<{ id: number; name: string }>;
  allAdmins?: Array<{ id: number; fullName: string | null; email: string }>;
}) {
  const mode: Mode = user ? "edit" : "create";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [pending, startTransition] = useTransition();

  // Mode de création : invitation par email (recommandé) ou MDP manuel
  const [createMode, setCreateMode] = useState<"invite" | "manual">("invite");

  // Résultat après envoi d'invitation (pour affichage du lien copiable)
  const [inviteResult, setInviteResult] = useState<{
    inviteUrl: string;
    emailSent: boolean;
    emailError?: string;
    targetName: string;
  } | null>(null);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [roleId, setRoleId] = useState<string>("none");
  const [positionId, setPositionId] = useState<string>("none");
  const [teamId, setTeamId] = useState<string>("none");
  const [managerId, setManagerId] = useState<string>("none");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(true);
  // Préférences avancées
  const [bio, setBio] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [loginAlertsEnabled, setLoginAlertsEnabled] = useState(true);
  const [defaultLanding, setDefaultLanding] = useState("dashboard");
  // Genre + civilité (utilisés par les templates PDF pour accord grammatical FR-CA)
  const [civility, setCivility] = useState<string>("none");
  const [gender, setGender] = useState<string>("none");
  const [preferredPronouns, setPreferredPronouns] = useState("");

  // Avatar
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null); // data URL ou null
  const [avatarFile, setAvatarFile] = useState<File | null>(null); // pour upload différé en mode create
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // En mode "edit" on respecte initialTab fourni par le parent (ex : "password"
      // depuis le menu kebab "Réinitialiser le mot de passe"). En "create" on reste sur "info".
      setTab(user ? initialTab : "info");
      setAvatarFile(null);
      setInviteResult(null);
      if (user) {
        setEmail(user.email);
        setFullName(user.fullName ?? "");
        setPhone(user.phone ?? "");
        setTitle(user.title ?? "");
        setDepartment(user.department ?? "");
        setRoleId(user.roleId?.toString() ?? "none");
        setPositionId(user.positionId?.toString() ?? "none");
        setTeamId(user.teamId?.toString() ?? "none");
        setManagerId(user.managerId?.toString() ?? "none");
        setStartDate(user.startDate ? user.startDate.split("T")[0] : "");
        setEndDate(user.endDate ? user.endDate.split("T")[0] : "");
        setIsActive(user.isActive);
        setPassword("");
        setAvatarPreview(user.avatarUrl);
        setBio(user.bio ?? "");
        setRecoveryEmail(user.recoveryEmail ?? "");
        setLoginAlertsEnabled(user.loginAlertsEnabled ?? true);
        setDefaultLanding(user.defaultLanding ?? "dashboard");
        setCivility(user.civility ?? "none");
        setGender(user.gender ?? "none");
        setPreferredPronouns(user.preferredPronouns ?? "");
      } else {
        setEmail(""); setFullName(""); setPhone(""); setTitle("");
        setDepartment(""); setRoleId("none"); setPositionId("none");
        setTeamId("none"); setManagerId("none");
        setStartDate(""); setEndDate("");
        setIsActive(true); setPassword(generatePassword());
        setAvatarPreview(null);
        setCivility("none"); setGender("none"); setPreferredPronouns("");
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

  // ── Avatar handlers ─────────────────────────────────────
  const handleAvatarFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Format invalide (image uniquement)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 2 Mo)");
      return;
    }
    setAvatarFile(file);
    // Preview local
    const reader = new FileReader();
    reader.onload = (e) => setAvatarPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    // Upload immédiat en mode edit
    if (mode === "edit" && user) {
      uploadAvatarNow(user.id, file);
    }
  };

  const uploadAvatarNow = async (targetId: number, file: File) => {
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/team/${targetId}/avatar`, { method: "POST", body: fd });
      if (res.ok) {
        toast.success("Avatar mis à jour");
        setAvatarFile(null);
      } else {
        const json = await res.json();
        toast.error(json.error || "Erreur d'upload");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarPreview(null);
    setAvatarFile(null);
    if (mode === "edit" && user) {
      try {
        await fetch(`/api/admin/team/${user.id}/avatar`, { method: "DELETE" });
        toast.success("Avatar retiré");
      } catch {
        toast.error("Erreur");
      }
    }
  };

  const handleSave = () => {
    startTransition(async () => {
      if (mode === "create") {
        if (createMode === "invite") {
          // Invitation par email
          if (!email.trim() || !fullName.trim()) {
            toast.error("Email et nom requis");
            return;
          }
          const result = await inviteUserAction({
            email, fullName,
            roleId: roleId === "none" ? null : Number(roleId),
            positionId: positionId === "none" ? null : Number(positionId),
            department: department || null,
            title: title || null,
            phone: phone || null,
          });
          if (result.success) {
            // Au lieu de fermer, on affiche le résultat avec le lien à copier
            setInviteResult({
              inviteUrl: result.data.inviteUrl,
              emailSent: result.data.emailSent,
              emailError: result.data.emailError,
              targetName: fullName,
            });
            onSaved();
          } else {
            toast.error(result.error);
          }
          return;
        }

        // Mode manuel (MDP généré par l'admin — pour cas exceptionnels)
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
          if (avatarFile && "data" in result && result.data?.id) {
            await uploadAvatarNow(result.data.id, avatarFile);
          }
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
          teamId: teamId === "none" ? null : Number(teamId),
          managerId: managerId === "none" ? null : Number(managerId),
          department: department || null,
          title: title || null,
          phone: phone || null,
          startDate: startDate || null,
          endDate: endDate || null,
          isActive,
          bio: bio || null,
          recoveryEmail: recoveryEmail || null,
          loginAlertsEnabled,
          defaultLanding,
          civility: civility === "none" ? null : (civility as "M." | "Mme" | "Mx"),
          gender: gender === "none" ? null : (gender as "male" | "female" | "non_binary" | "prefer_not_to_say"),
          preferredPronouns: preferredPronouns || null,
          // Optimistic locking : on envoie l'updatedAt connu au moment d'ouvrir le dialogue
          expectedUpdatedAt: user.updatedAt,
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

  const handleSendResetEmail = () => {
    if (!user) return;
    startTransition(async () => {
      const result = await sendPasswordResetEmailAction({ id: user.id });
      if (result.success) {
        toast.success("Courriel envoyé", {
          description: `${user.fullName || user.email} recevra un lien de réinitialisation valide 30 minutes.`,
        });
        onSaved(); onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  const copyInviteLink = () => {
    if (inviteResult) {
      navigator.clipboard.writeText(inviteResult.inviteUrl);
      toast.success("Lien copié dans le presse-papiers");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Écran résultat invitation (post-création) */}
        {inviteResult ? (
          <>
            <div className={`text-white px-6 py-5 shrink-0 ${inviteResult.emailSent ? "bg-gradient-to-br from-emerald-600 to-emerald-700" : "bg-gradient-to-br from-amber-500 to-amber-600"}`}>
              <div className="flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center shadow-sm">
                  {inviteResult.emailSent ? <Send className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-white text-base font-semibold leading-tight">
                    {inviteResult.emailSent ? "Invitation envoyée" : "Lien généré"}
                  </DialogTitle>
                  <p className="text-xs text-white/85 mt-0.5">
                    {inviteResult.emailSent
                      ? `Email envoyé à ${inviteResult.targetName}`
                      : "L'email n'a pas pu être envoyé — copiez et transmettez le lien manuellement"}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              {!inviteResult.emailSent && inviteResult.emailError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-semibold text-red-900 mb-1">Erreur d'envoi du courriel</p>
                  <p className="text-[11px] text-red-700 font-mono">{inviteResult.emailError}</p>
                  <p className="text-[11px] text-red-700 mt-2">
                    Vérifiez la configuration SMTP/SendGrid dans <span className="font-semibold">/admin/settings/integrations</span>.
                  </p>
                </div>
              )}
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Lien d&apos;activation (valable 7 jours)
                </Label>
                <div className="flex gap-2 mt-1.5">
                  <code className="flex-1 text-[11px] font-mono bg-muted px-3 py-2 rounded-md border break-all">
                    {inviteResult.inviteUrl}
                  </code>
                  <Button type="button" onClick={copyInviteLink} variant="outline" size="icon" title="Copier">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Ce lien ne sera plus affiché. {inviteResult.emailSent ? "Copiez-le maintenant si vous souhaitez le partager autrement." : "Transmettez ce lien à l'employé par un canal sécurisé."}
                </p>
              </div>
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                <p className="font-semibold mb-1">Que se passe-t-il ensuite ?</p>
                <ol className="list-decimal list-inside space-y-0.5 text-blue-800">
                  <li>L&apos;employé ouvre le lien</li>
                  <li>Crée son propre mot de passe (12 caractères min)</li>
                  <li>Se connecte au portail admin</li>
                  <li>Active la 2FA (optionnel mais recommandé)</li>
                </ol>
              </div>
            </div>
            <div className="border-t bg-muted/30 px-6 py-3 flex justify-end shrink-0">
              <Button onClick={() => onOpenChange(false)} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
                Terminer
              </Button>
            </div>
          </>
        ) : (
        <>
        {/* Header VNK navy avec gradient subtil */}
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#1A5FB4] text-white px-6 py-5 flex items-center gap-3.5 shrink-0">
          <div className="h-11 w-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center shadow-sm">
            <User className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-white text-base font-semibold leading-tight truncate">
              {mode === "create" ? "Nouvel utilisateur" : user?.fullName || user?.email}
            </DialogTitle>
            <p className="text-xs text-white/75 mt-0.5">
              {mode === "create" ? "Créer un compte employé" : "Modifier les informations du compte"}
            </p>
          </div>
        </div>

        {/* Tabs internes (mode edit seulement) */}
        {mode === "edit" && (
          <div className="border-b bg-muted/30 px-6 shrink-0">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setTab("info")}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === "info"
                    ? "border-[#0F2D52] text-[#0F2D52]"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Informations
              </button>
              <button
                type="button"
                onClick={() => setTab("password")}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === "password"
                    ? "border-[#0F2D52] text-[#0F2D52]"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
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
              <FormSection icon={User} title="Identité">
                {/* Avatar uploader */}
                <div className="flex items-center gap-4 mb-3 pb-3 border-b border-border/50">
                  <div className="relative">
                    <div
                      className="h-20 w-20 rounded-full flex items-center justify-center text-white font-bold text-2xl shrink-0 ring-2 ring-background shadow-sm overflow-hidden"
                      style={{
                        backgroundColor:
                          (positionId !== "none" && positions.find((p) => p.id.toString() === positionId)?.color) ||
                          (roleId !== "none" && roles.find((r) => r.id.toString() === roleId)?.color) ||
                          "#0F2D52",
                      }}
                    >
                      {avatarPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (fullName || email || "?").charAt(0).toUpperCase()
                      )}
                    </div>
                    {avatarUploading && (
                      <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                        <Upload className="h-5 w-5 text-white animate-pulse" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Photo de profil</p>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG, WebP ou GIF · 2 Mo maximum
                    </p>
                    <div className="flex gap-2 mt-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleAvatarFile(f);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={avatarUploading}
                      >
                        <Camera className="h-3.5 w-3.5 mr-1.5" />
                        {avatarPreview ? "Changer" : "Téléverser"}
                      </Button>
                      {avatarPreview && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={handleRemoveAvatar}
                          disabled={avatarUploading}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="h-3.5 w-3.5 mr-1.5" />
                          Retirer
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Nom complet" required>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jean Tremblay" />
                  </Field>
                  <Field label="Courriel" required>
                    <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jean@vnkautomatisation.ca" disabled={mode === "edit"} type="email" />
                  </Field>
                  <Field label="Titre">
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Comptable senior" />
                  </Field>
                  <Field label="Téléphone">
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 514 555-0100" />
                  </Field>
                </div>
              </FormSection>

              {mode === "edit" && (
                <FormSection icon={User} title="Genre et civilité" description="Utilisé pour l'accord grammatical dans les contrats et documents PDF (Employé(e) → Employée si Femme, etc.)">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Civilité" hint="Titre court affiché sur documents">
                      <Select value={civility} onValueChange={setCivility}>
                        <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Aucune —</SelectItem>
                          <SelectItem value="M.">M.</SelectItem>
                          <SelectItem value="Mme">Mme</SelectItem>
                          <SelectItem value="Mx">Mx (neutre)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Genre" hint="Détermine l'accord grammatical FR">
                      <Select value={gender} onValueChange={setGender}>
                        <SelectTrigger><SelectValue placeholder="Préfère ne pas dire" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Préfère ne pas dire</SelectItem>
                          <SelectItem value="male">Homme</SelectItem>
                          <SelectItem value="female">Femme</SelectItem>
                          <SelectItem value="non_binary">Non-binaire</SelectItem>
                          <SelectItem value="prefer_not_to_say">Préfère ne pas dire</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Pronoms personnalisés" hint="Optionnel · ex « iel/iel », « they/them »">
                      <Input
                        value={preferredPronouns}
                        onChange={(e) => setPreferredPronouns(e.target.value)}
                        placeholder="il/lui, elle/elle, iel/iel..."
                        maxLength={40}
                      />
                    </Field>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                    Si aucun genre n&apos;est sélectionné, les documents utilisent la forme épicène « Employé(e) » / « il ou elle » (conforme à la recommandation OQLF).
                  </p>
                </FormSection>
              )}

              <FormSection icon={Briefcase} title="Poste & Rôle">
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
              </FormSection>

              {mode === "edit" && (teams.length > 0 || allAdmins.length > 0) && (
                <FormSection icon={Briefcase} title="Organisation">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {teams.length > 0 && (
                      <Field label="Équipe" hint="Sous-équipe d'appartenance">
                        <Select value={teamId} onValueChange={setTeamId}>
                          <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Aucune —</SelectItem>
                            {teams.map((t) => (
                              <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                    {allAdmins.length > 0 && (
                      <Field label="Manager" hint="Supérieur hiérarchique direct">
                        <Select value={managerId} onValueChange={setManagerId}>
                          <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Aucun —</SelectItem>
                            {allAdmins.filter((a) => a.id !== user?.id).map((a) => (
                              <SelectItem key={a.id} value={a.id.toString()}>{a.fullName || a.email}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  </div>
                </FormSection>
              )}

              <FormSection icon={Calendar} title="Dates">
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
              </FormSection>

              {mode === "edit" && (
                <FormSection icon={Shield} title="Statut">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Compte actif</p>
                      <p className="text-xs text-muted-foreground">Désactiver ferme toutes les sessions</p>
                    </div>
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                  </div>
                </FormSection>
              )}

              {mode === "edit" && (
                <FormSection icon={User} title="Profil & préférences">
                  <Field label="Bio courte" hint="Affichée dans le profil public · 280 caractères max">
                    <Textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={2}
                      maxLength={280}
                      placeholder="Ex : Comptable senior spécialisé en automatisation industrielle..."
                      className="text-sm"
                    />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Courriel de récupération" hint="Pour récupérer l'accès en cas de perte">
                      <Input
                        type="email"
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        placeholder="email-personnel@..."
                      />
                    </Field>
                    <Field label="Page d'accueil par défaut">
                      <Select value={defaultLanding} onValueChange={setDefaultLanding}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dashboard">Tableau de bord</SelectItem>
                          <SelectItem value="clients">Clients</SelectItem>
                          <SelectItem value="quotes">Devis</SelectItem>
                          <SelectItem value="invoices">Factures</SelectItem>
                          <SelectItem value="calendar">Calendrier</SelectItem>
                          <SelectItem value="messages">Messages</SelectItem>
                          <SelectItem value="mandates">Mandats</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Alertes connexion par email</p>
                      <p className="text-xs text-muted-foreground">Notifier ce user des connexions sur de nouveaux appareils</p>
                    </div>
                    <Switch checked={loginAlertsEnabled} onCheckedChange={setLoginAlertsEnabled} />
                  </div>
                </FormSection>
              )}

              {mode === "create" && (
                <FormSection icon={Send} title="Activation du compte">
                  {/* Toggle invitation vs manuel */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCreateMode("invite")}
                      className={cn(
                        "rounded-lg border-2 p-3 text-left transition-all",
                        createMode === "invite"
                          ? "border-[#0F2D52] bg-[#0F2D52]/5"
                          : "border-border hover:border-muted-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Mail className={cn("h-4 w-4", createMode === "invite" ? "text-[#0F2D52]" : "text-muted-foreground")} />
                        <span className={cn("font-semibold text-sm", createMode === "invite" && "text-[#0F2D52]")}>
                          Par courriel
                        </span>
                        <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold ml-auto">
                          RECOMMANDÉ
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        L&apos;employé crée son propre mot de passe via un lien sécurisé (7 jours).
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateMode("manual")}
                      className={cn(
                        "rounded-lg border-2 p-3 text-left transition-all",
                        createMode === "manual"
                          ? "border-[#0F2D52] bg-[#0F2D52]/5"
                          : "border-border hover:border-muted-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Key className={cn("h-4 w-4", createMode === "manual" ? "text-[#0F2D52]" : "text-muted-foreground")} />
                        <span className={cn("font-semibold text-sm", createMode === "manual" && "text-[#0F2D52]")}>
                          Mot de passe manuel
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Vous définissez un mot de passe temporaire à communiquer à l&apos;employé.
                      </p>
                    </button>
                  </div>

                  {createMode === "manual" && (
                    <div className="mt-3 space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Mot de passe temporaire
                      </Label>
                      <div className="flex gap-2">
                        <Input value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono text-sm" />
                        <Button type="button" variant="outline" size="icon" onClick={() => setPassword(generatePassword())} title="Régénérer">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-[10px] text-amber-700">
                        ⚠ Anti-pattern : préférez l&apos;invitation. Communiquez via un canal chiffré (1Password, Bitwarden Send...).
                      </p>
                    </div>
                  )}
                </FormSection>
              )}
            </>
          )}

          {tab === "password" && mode === "edit" && (
            <>
              <FormSection icon={Mail} title="Méthode recommandée : envoi par courriel">
                <p className="text-xs text-muted-foreground mb-3">
                  L&apos;utilisateur recevra un courriel avec un code à 6 chiffres et un lien sécurisé pour créer son nouveau mot de passe lui-même. Toutes ses sessions actives seront fermées.
                </p>
                <Button
                  type="button"
                  onClick={handleSendResetEmail}
                  disabled={pending}
                  className="w-full bg-[#0F2D52] hover:bg-[#0F2D52]/90"
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  Envoyer le lien à {user?.email}
                </Button>
              </FormSection>

              <FormSection icon={Key} title="Méthode manuelle (cas exceptionnel)">
                <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 mb-3">
                  <p className="text-[11px] text-amber-900">
                    ⚠ À éviter — préférez la méthode par courriel ci-dessus.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Toutes les sessions actives seront fermées. Vous devrez transmettre ce mot de passe à l&apos;employé par un canal sécurisé.
                </p>
                <div className="flex gap-2">
                  <Input value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono text-sm" placeholder="Nouveau mot de passe (min 12)" />
                  <Button type="button" variant="outline" size="icon" onClick={() => setPassword(generatePassword())} title="Générer">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </FormSection>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/30 px-6 py-3 flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Annuler
          </Button>
          {tab === "password" ? (
            <Button
              onClick={handleResetPassword}
              disabled={pending || password.length < 12}
              className="bg-[#0F2D52] hover:bg-[#0F2D52]/90 shadow-sm"
            >
              {pending ? "..." : "Réinitialiser le mot de passe"}
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={pending} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90 shadow-sm">
              {pending ? "..." : mode === "create"
                ? (createMode === "invite" ? <><Send className="h-4 w-4 mr-1.5" />Envoyer l&apos;invitation</> : "Créer l'utilisateur")
                : "Enregistrer"}
            </Button>
          )}
        </div>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}

