"use client";
import { useState, useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  User, Info, Mail, Briefcase, Phone, FileText, Activity, Camera, Trash2, Upload, ShieldCheck,
} from "lucide-react";
import { updateProfileAction, updatePresenceAction } from "@/app/actions/profile";
import { initials } from "@/lib/utils";
import { EditableSection, ReadField } from "./editable-section";
import type { AdminProfile } from "../profile-view";
import { useRouter } from "next/navigation";

export function TabCompte({ admin }: { admin: AdminProfile }) {
  const t = useTranslations("admin.profile.account");
  const tCommon = useTranslations("admin.profile.common");
  const router = useRouter();

  // ── Identité (form) ────────────────────────────────
  const [fullName, setFullName] = useState(admin.fullName ?? "");
  const [title, setTitle] = useState(admin.title ?? "");
  const [phone, setPhone] = useState(admin.phone ?? "");
  const [bio, setBio] = useState(admin.bio ?? "");
  const [emailSignature, setEmailSignature] = useState(admin.emailSignature ?? "");
  const [recoveryEmail, setRecoveryEmail] = useState(admin.recoveryEmail ?? "");
  const [savingIdentity, startIdentity] = useTransition();

  // ── Avatar upload ──────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(admin.avatarUrl ?? "");

  const handleAvatarChange = async (file: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image > 2 MB");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      toast.error("Format non supporté");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setAvatarUrl(data.avatarUrl);
        toast.success(tCommon("saved"));
        router.refresh();
      } else {
        toast.error(data.error || tCommon("error"));
      }
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setUploading(false);
    }
  };

  const handleAvatarDelete = async () => {
    setUploading(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (res.ok) {
        setAvatarUrl("");
        toast.success(tCommon("saved"));
        router.refresh();
      } else {
        toast.error(tCommon("error"));
      }
    } finally {
      setUploading(false);
    }
  };

  const saveIdentity = () => {
    if (!fullName.trim()) {
      toast.error(tCommon("error"));
      return Promise.resolve();
    }
    if (recoveryEmail && !/^[^@]+@[^@]+\.[^@]+$/.test(recoveryEmail)) {
      toast.error(tCommon("error"));
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      startIdentity(async () => {
        const result = await updateProfileAction({
          fullName: fullName.trim(),
          avatarUrl: avatarUrl,
          title: title.trim() || null,
          phone: phone.trim() || null,
          bio: bio.trim() || null,
          emailSignature: emailSignature.trim() || null,
          recoveryEmail: recoveryEmail.trim() || "",
        });
        if (result.success) toast.success(tCommon("saved"));
        else toast.error(result.error);
        resolve();
      });
    });
  };

  // ── Présence ──────────────────────────────────────
  const [presenceStatus, setPresenceStatus] = useState<string | null>(admin.presenceStatus);
  const [presenceMessage, setPresenceMessage] = useState(admin.presenceMessage ?? "");
  const [savingPresence, startPresence] = useTransition();

  const savePresence = () => {
    return new Promise<void>((resolve) => {
      startPresence(async () => {
        const result = await updatePresenceAction({
          status: (presenceStatus as "active" | "meeting" | "vacation" | "focus" | "offline" | null),
          message: presenceMessage.trim() || null,
          until: null,
        });
        if (result.success) toast.success(tCommon("saved"));
        else toast.error(result.error);
        resolve();
      });
    });
  };

  // ── Affichage info compte (toujours lecture seule) ─
  const createdDate = new Date(admin.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  const lastLoginDate = admin.lastLogin
    ? new Date(admin.lastLogin).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ─── Photo de profil ─── */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="h-4 w-4" />
            {t("photo.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <Avatar className="h-20 w-20 ring-2 ring-muted">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
              <AvatarFallback className="bg-[#0F2D52] text-white text-xl font-bold">
                {initials(fullName || admin.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center sm:text-left">
              <p className="text-sm font-medium">{t("photo.hint")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("photo.format")}</p>
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleAvatarChange(f);
                    e.target.value = "";
                  }}
                />
                <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? t("photo.uploading") : avatarUrl ? t("photo.replace") : t("photo.upload")}
                </Button>
                {avatarUrl && (
                  <Button size="sm" variant="outline" onClick={handleAvatarDelete} disabled={uploading} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("photo.delete")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Identité ─── */}
      <EditableSection
        title={t("identity.title")}
        icon={User}
        description={t("identity.description")}
        saving={savingIdentity}
        onSave={saveIdentity}
        editLabel={tCommon("edit")}
        saveLabel={tCommon("save")}
        cancelLabel={tCommon("cancel")}
        readView={
          <div>
            <ReadField label={t("identity.full_name")} value={fullName} />
            <ReadField label={t("identity.title_label")} value={title} />
            <ReadField label={t("identity.primary_email")} value={admin.email} mono />
            <ReadField label={t("identity.recovery_email")} value={recoveryEmail ? <span className="font-mono">{recoveryEmail}</span> : ""} />
            <ReadField label={t("identity.phone")} value={phone} />
            <ReadField label={t("identity.bio")} value={bio} />
            <ReadField label={t("identity.signature")} value={emailSignature ? "✓" : ""} />
          </div>
        }
        editView={
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="profile-name" className="text-xs">{t("identity.full_name")} *</Label>
                <Input id="profile-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-title" className="text-xs">{t("identity.title_label")}</Label>
                <div className="relative">
                  <Briefcase className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input id="profile-title" value={title} onChange={(e) => setTitle(e.target.value)} className="pl-8 h-9" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="profile-email" className="text-xs">{t("identity.primary_email")}</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input id="profile-email" type="email" value={admin.email} disabled className="bg-muted pl-8 h-9" />
                </div>
                <p className="text-[10px] text-muted-foreground">{t("identity.primary_email_hint")}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recovery-email" className="text-xs">{t("identity.recovery_email")}</Label>
                <Input id="recovery-email" type="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} className="h-9" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-phone" className="text-xs">{t("identity.phone")}</Label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input id="profile-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 514 555-1234" className="pl-8 h-9" />
              </div>
              {admin.phoneVerifiedAt && (
                <p className="text-[10px] text-emerald-600">{t("identity.phone_verified", { date: new Date(admin.phoneVerifiedAt).toLocaleDateString() })}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-bio" className="text-xs">{t("identity.bio", { count: bio.length })}</Label>
              <textarea
                id="profile-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 280))}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder={t("identity.bio_placeholder")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-signature" className="text-xs flex items-center gap-1">
                <FileText className="h-3 w-3" /> {t("identity.signature")}
              </Label>
              <textarea
                id="profile-signature"
                value={emailSignature}
                onChange={(e) => setEmailSignature(e.target.value.slice(0, 2000))}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono text-[12px]"
              />
              <p className="text-[10px] text-muted-foreground">{t("identity.signature_hint")}</p>
            </div>
          </div>
        }
      />

      {/* ─── Statut de présence ─── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                {t("presence.title")}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">{t("presence.description")}</p>
            </div>
            <Button size="sm" onClick={savePresence} disabled={savingPresence}>
              {savingPresence ? tCommon("saving") : tCommon("save")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("presence.status_label")}</Label>
              <Select value={presenceStatus ?? "active"} onValueChange={(v) => setPresenceStatus(v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("presence.active")}</SelectItem>
                  <SelectItem value="meeting">{t("presence.meeting")}</SelectItem>
                  <SelectItem value="vacation">{t("presence.vacation")}</SelectItem>
                  <SelectItem value="focus">{t("presence.focus")}</SelectItem>
                  <SelectItem value="offline">{t("presence.offline")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("presence.message_label")}</Label>
              <Input value={presenceMessage} onChange={(e) => setPresenceMessage(e.target.value)} placeholder={t("presence.message_placeholder")} className="h-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Informations du compte ─── */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            {t("info.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">{t("info.role")}</span>
              <Badge variant="secondary">{admin.role === "super_admin" ? "Super admin" : t("info.role")}</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">{t("info.status")}</span>
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{t("info.status_active")}</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">{t("info.created_at")}</span>
              <span className="text-sm font-medium">{createdDate}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">{t("info.last_login")}</span>
              <span className="text-sm font-medium">{lastLoginDate}</span>
            </div>
            <div className="flex items-center justify-between py-2 sm:border-b">
              <span className="text-sm text-muted-foreground">{t("info.two_factor")}</span>
              <span className="text-sm font-medium flex items-center gap-1">
                {admin.twoFactorEnabled ? (
                  <><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> {t("info.two_factor_on")}</>
                ) : (
                  <span className="text-amber-600">{t("info.two_factor_off")}</span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">{t("info.id")}</span>
              <span className="text-sm font-mono text-muted-foreground">#{admin.id}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
