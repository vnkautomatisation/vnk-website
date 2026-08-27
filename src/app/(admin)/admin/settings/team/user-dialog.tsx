"use client";
// Dialog création / édition / réinit mot de passe d'un utilisateur admin.
// Style VNK : header navy + sections claires.
import { useState, useEffect, useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
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
  const chars = "abcdefghijklmnpqrstuvwxyzABCDEFGHIJKMNOPQRSTUVWXYZ23456789";
  let pwd = "";
  for (let i = 0; i < 16; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

export function UserDialog({
  open, onOpenChange, user, roles, positions, onSaved, initialTab = "info",
  teams = [], allAdmins = [], knownDepartments = [],
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

  knownDepartments?: string[];
}) {
  const t = useTranslations("admin.team");
  const tc = useTranslations("common");
  const mode: Mode = user ? "edit" : "create";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [pending, startTransition] = useTransition();


  const [createMode, setCreateMode] = useState<"invite" | "manual">("invite");


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

  const [bio, setBio] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [loginAlertsEnabled, setLoginAlertsEnabled] = useState(true);
  const [defaultLanding, setDefaultLanding] = useState("dashboard");

  const [civility, setCivility] = useState<string>("none");
  const [gender, setGender] = useState<string>("none");
  const [preferredPronouns, setPreferredPronouns] = useState("");


  const [avatarPreview, setAvatarPreview] = useState<string | null>(null); // data URL ou null
  const [avatarFile, setAvatarFile] = useState<File | null>(null); // pour upload différé en mode create
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {


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


  const departmentSuggestions = Array.from(
    new Set(
      [...knownDepartments, ...positions.map((p) => p.defaultDepartment ?? "")]
        .map((d) => d.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));


  const handlePositionChange = (v: string) => {
    setPositionId(v);
    if (v === "none") return;
    const pos = positions.find((p) => p.id.toString() === v);
    if (pos) {
      if (pos.defaultDepartment && !department) setDepartment(pos.defaultDepartment);
      if (pos.defaultRoleId && roleId === "none") setRoleId(pos.defaultRoleId.toString());
    }
  };


  const handleAvatarFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("format_invalide_image_uniquement"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("fichier_trop_volumineux_max_2"));
      return;
    }
    setAvatarFile(file);

    const reader = new FileReader();
    reader.onload = (e) => setAvatarPreview(e.target?.result as string);
    reader.readAsDataURL(file);


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
        toast.success(t("avatar_mis_jour"));
        setAvatarFile(null);
      } else {
        const json = await res.json();
        toast.error(json.error || t("erreur_upload"));
      }
    } catch {
      toast.error(t("erreur_reseau"));
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
        toast.success(t("avatar_retire"));
      } catch {
        toast.error(t("erreur"));
      }
    }
  };

  const handleSave = () => {
    startTransition(async () => {
      if (mode === "create") {
        if (createMode === "invite") {

          if (!email.trim() || !fullName.trim()) {
            toast.error(t("email_nom_requis"));
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


        if (password.length < 12) {
          toast.error(t("mot_passe_trop_court_min"));
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
          toast.success(t("utilisateur_cree"));
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

          expectedUpdatedAt: user.updatedAt,
        });
        if (result.success) {
          toast.success(t("utilisateur_mis_jour"));
          onSaved(); onOpenChange(false);
        } else {
          toast.error(result.error);
        }
      }
    });
  };

  const handleResetPassword = () => {
    if (!user || password.length < 12) {
      toast.error(t("mot_passe_trop_court_min"));
      return;
    }
    startTransition(async () => {
      const result = await resetUserPasswordAction({ id: user.id, newPassword: password });
      if (result.success) {
        toast.success(t("mot_passe_reinitialise_toutes_sessions"));
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
        toast.success(t("courriel_envoye"), {
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
      toast.success(t("lien_copie_presse_papiers"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

        {inviteResult ? (
          <>
            <div className={`text-white px-6 py-5 shrink-0 ${inviteResult.emailSent ? "bg-gradient-to-br from-emerald-600 to-emerald-700" : "bg-gradient-to-br from-amber-500 to-amber-600"}`}>
              <div className="flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center shadow-sm">
                  {inviteResult.emailSent ? <Send className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-white text-base font-semibold leading-tight">
                    {inviteResult.emailSent ? t("invitation_envoyee") : t("lien_genere")}
                  </DialogTitle>
                  <p className="text-xs text-white/85 mt-0.5">
                    {inviteResult.emailSent
                      ? `Email envoyé à ${inviteResult.targetName}`
                      : t("email_n_pas_pu_etre")}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              {!inviteResult.emailSent && inviteResult.emailError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-semibold text-red-900 mb-1">{t("erreur_envoi_courriel")}</p>
                  <p className="text-[11px] text-red-700 font-mono">{inviteResult.emailError}</p>
                  <p className="text-[11px] text-red-700 mt-2">{t("user_dialog_verifiez_la_configuration_smtp_sendgrid_dans")}<span className="font-semibold">/admin/settings/integrations</span>.
                  </p>
                </div>
              )}
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {t("lien_apos_activation_valable_7")}
                </Label>
                <div className="flex gap-2 mt-1.5">
                  <code className="flex-1 text-[11px] font-mono bg-muted px-3 py-2 rounded-md border break-all">
                    {inviteResult.inviteUrl}
                  </code>
                  <Button type="button" onClick={copyInviteLink} variant="outline" size="icon" title={tc("copy")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Ce lien ne sera plus affiché. {inviteResult.emailSent ? t("copiez_maintenant_si_vous_souhaitez") : t("transmettez_lien_employe_canal_securise")}
                </p>
              </div>
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                <p className="font-semibold mb-1">{t("se_passe_t_il_ensuite")}</p>
                <ol className="list-decimal list-inside space-y-0.5 text-blue-800">
                  <li>{t("apos_employe_ouvre_lien")}</li>
                  <li>{t("cree_propre_mot_passe_12")}</li>
                  <li>{t("se_connecte_portail_admin")}</li>
                  <li>{t("active_2fa_optionnel_mais_recommande")}</li>
                </ol>
              </div>
            </div>
            <div className="border-t bg-muted/30 px-6 py-3 flex justify-end shrink-0">
              <Button onClick={() => onOpenChange(false)} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
                {t("terminer")}
              </Button>
            </div>
          </>
        ) : (
        <>

        <div className="bg-gradient-to-br from-[#0F2D52] to-[#1A5FB4] text-white px-6 py-5 flex items-center gap-3.5 shrink-0">
          <div className="h-11 w-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center shadow-sm">
            <User className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-white text-base font-semibold leading-tight truncate">
              {mode === "create" ? t("nouvel_utilisateur") : user?.fullName || user?.email}
            </DialogTitle>
            <p className="text-xs text-white/75 mt-0.5">
              {mode === "create" ? t("creer_compte_employe") : t("modifier_informations_compte")}
            </p>
          </div>
        </div>


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
                {t("informations")}
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
                {t("mot_passe")}
              </button>
            </div>
          </div>
        )}


        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {tab === "info" && (
            <>
              <FormSection icon={User} title={t("identite")}>

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
                    <p className="text-sm font-medium">{t("photo_profil")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("jpg_png_webp_gif_2")}
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
                        {avatarPreview ? t("changer") : t("televerser")}
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
                          {t("retirer")}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label={t("nom_complet")} required>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("jean_tremblay")} />
                  </Field>
                  <Field label={t("courriel_2")} required>
                    <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jean@vnkautomatisation.ca" disabled={mode === "edit"} type="email" />
                  </Field>
                  <Field label={t("titre")}>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("comptable_senior")} />
                  </Field>
                  <Field label={t("telephone")}>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 514 555-0100" />
                  </Field>
                </div>
              </FormSection>

              {mode === "edit" && (
                <FormSection icon={User} title={t("genre_civilite")} description={t("utilise_accord_grammatical_contrats")}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label={t("civilite")} hint={t("titre_court_affiche_documents")}>
                      <Select value={civility} onValueChange={setCivility}>
                        <SelectTrigger><SelectValue placeholder={t("aucune_2")} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("aucune")}</SelectItem>
                          <SelectItem value="M.">M.</SelectItem>
                          <SelectItem value="Mme">{t("mme")}</SelectItem>
                          <SelectItem value="Mx">{t("mx_neutre")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t("genre")} hint={t("determine_accord_grammatical_fr")}>
                      <Select value={gender} onValueChange={setGender}>
                        <SelectTrigger><SelectValue placeholder={t("prefere_ne_pas_dire")} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("prefere_ne_pas_dire")}</SelectItem>
                          <SelectItem value="male">{t("homme")}</SelectItem>
                          <SelectItem value="female">{t("femme")}</SelectItem>
                          <SelectItem value="non_binary">{t("non_binaire")}</SelectItem>
                          <SelectItem value="prefer_not_to_say">{t("prefere_ne_pas_dire")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t("pronoms_personnalises")} hint={t("optionnel_ex_iel_iel_they")}>
                      <Input
                        value={preferredPronouns}
                        onChange={(e) => setPreferredPronouns(e.target.value)}
                        placeholder={t("il_lui_elle_elle_iel")}
                        maxLength={40}
                      />
                    </Field>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{t("user_dialog_si_aucun_genre_n_est_selectionne_les")}</p>
                </FormSection>
              )}

              <FormSection icon={Briefcase} title={t("poste_role")}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label={t("poste")}>
                    <Select value={positionId} onValueChange={handlePositionChange}>
                      <SelectTrigger><SelectValue placeholder={t("choisir_poste")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("aucun")}</SelectItem>
                        {positions.map((p) => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t("role_acces")}>
                    <Select value={roleId} onValueChange={setRoleId}>
                      <SelectTrigger><SelectValue placeholder={t("choisir_role")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("aucun")}</SelectItem>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field
                    label={t("departement")}
                    hint={departmentSuggestions.length > 0
                      ? t("choisissez_departement_existant_saisissez_nouveau")
                      : undefined}
                  >
                    <Input
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder={t("comptabilite")}
                      list="vnk-departments"
                      autoComplete="off"
                    />

                    <datalist id="vnk-departments">
                      {departmentSuggestions.map((d) => (
                        <option key={d} value={d} />
                      ))}
                    </datalist>
                  </Field>
                </div>
              </FormSection>

              {mode === "edit" && (teams.length > 0 || allAdmins.length > 0) && (
                <FormSection icon={Briefcase} title={t("organisation")}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {teams.length > 0 && (
                      <Field label={t("equipe")} hint={t("sous_equipe_appartenance")}>
                        <Select value={teamId} onValueChange={setTeamId}>
                          <SelectTrigger><SelectValue placeholder={t("aucune_2")} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t("aucune")}</SelectItem>
                            {teams.map((t) => (
                              <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                    {allAdmins.length > 0 && (
                      <Field label={t("manager")} hint={t("superieur_hierarchique_direct")}>
                        <Select value={managerId} onValueChange={setManagerId}>
                          <SelectTrigger><SelectValue placeholder={tc("none")} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t("aucun")}</SelectItem>
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

              <FormSection icon={Calendar} title={t("dates")}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label={t("date_embauche")}>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </Field>
                  {mode === "edit" && (
                    <Field label={t("date_fin_emploi")}>
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </Field>
                  )}
                </div>
              </FormSection>

              {mode === "edit" && (
                <FormSection icon={Shield} title={tc("status")}>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{t("compte_actif")}</p>
                      <p className="text-xs text-muted-foreground">{t("desactiver_ferme_toutes_sessions")}</p>
                    </div>
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                  </div>
                </FormSection>
              )}

              {mode === "edit" && (
                <FormSection icon={User} title={t("profil_preferences")}>
                  <Field label={t("bio_courte")} hint={t("affichee_profil_public_280_caracteres")}>
                    <Textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={2}
                      maxLength={280}
                      placeholder={t("ex_comptable_senior_specialise_automatisation")}
                      className="text-sm"
                    />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label={t("courriel_recuperation")} hint={t("recuperer_acces_cas_perte")}>
                      <Input
                        type="email"
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        placeholder={t("email_personnel")}
                      />
                    </Field>
                    <Field label={t("page_accueil_defaut")}>
                      <Select value={defaultLanding} onValueChange={setDefaultLanding}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dashboard">{t("tableau_bord")}</SelectItem>
                          <SelectItem value="clients">{t("clients")}</SelectItem>
                          <SelectItem value="quotes">{t("devis")}</SelectItem>
                          <SelectItem value="invoices">{t("factures")}</SelectItem>
                          <SelectItem value="calendar">{t("calendrier")}</SelectItem>
                          <SelectItem value="messages">{t("messages")}</SelectItem>
                          <SelectItem value="mandates">{t("mandats")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{t("alertes_connexion_email")}</p>
                      <p className="text-xs text-muted-foreground">{t("notifier_user_connexions_nouveaux_appareils")}</p>
                    </div>
                    <Switch checked={loginAlertsEnabled} onCheckedChange={setLoginAlertsEnabled} />
                  </div>
                </FormSection>
              )}

              {mode === "create" && (
                <FormSection icon={Send} title={t("activation_compte")}>

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
                          {t("courriel")}
                        </span>
                        <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold ml-auto">
                          {t("recommande")}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {t("apos_employe_cree_propre_mot")}
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
                          {t("mot_passe_manuel")}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {t("vous_definissez_mot_passe_temporaire")}
                      </p>
                    </button>
                  </div>

                  {createMode === "manual" && (
                    <div className="mt-3 space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        {t("mot_passe_temporaire")}
                      </Label>
                      <div className="flex gap-2">
                        <Input value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono text-sm" />
                        <Button type="button" variant="outline" size="icon" onClick={() => setPassword(generatePassword())} title={t("regenerer")}>
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-[10px] text-amber-700">
                        {t("anti_pattern_preferez_apos_invitation")}
                      </p>
                    </div>
                  )}
                </FormSection>
              )}
            </>
          )}

          {tab === "password" && mode === "edit" && (
            <>
              <FormSection icon={Mail} title={t("methode_recommandee_envoi_courriel")}>
                <p className="text-xs text-muted-foreground mb-3">
                  {t("apos_utilisateur_recevra_courriel_code")}
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

              <FormSection icon={Key} title={t("methode_manuelle_cas_exceptionnel")}>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 mb-3">
                  <p className="text-[11px] text-amber-900">
                    {t("eviter_preferez_methode_courriel_ci")}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {t("toutes_sessions_actives_seront_fermees")}
                </p>
                <div className="flex gap-2">
                  <Input value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono text-sm" placeholder={t("nouveau_mot_passe_min_12")} />
                  <Button type="button" variant="outline" size="icon" onClick={() => setPassword(generatePassword())} title={t("generer")}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </FormSection>
            </>
          )}
        </div>


        <div className="border-t bg-muted/30 px-6 py-3 flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {tc("cancel")}
          </Button>
          {tab === "password" ? (
            <Button
              onClick={handleResetPassword}
              disabled={pending || password.length < 12}
              className="bg-[#0F2D52] hover:bg-[#0F2D52]/90 shadow-sm"
            >
              {pending ? "..." : t("reinitialiser_mot_passe")}
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={pending} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90 shadow-sm">
              {pending ? "..." : mode === "create"
                ? (createMode === "invite" ? <><Send className="h-4 w-4 mr-1.5" />{t("envoyer_apos_invitation")}</> : t("creer_utilisateur"))
                : t("enregistrer")}
            </Button>
          )}
        </div>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}

