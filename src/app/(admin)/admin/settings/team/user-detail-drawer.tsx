"use client";
// Drawer latéral fiche détaillée d'un utilisateur admin.
// Chargement lazy via /api/admin/team/[id] à l'ouverture.
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  User, Mail, Phone, Building2, Calendar, Shield, Globe,
  Activity, History, LogOut, Edit, KeyRound, Briefcase,
  AlertTriangle, CircleDot, MapPin,
  ExternalLink, Loader2, ShieldOff, Unlock, Lock, Save, FileText,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { disable2FAAction, unlockUserAction, lockUserAction, updateUserAction, exportUserDataAction, anonymizeUserAction } from "@/app/actions/users";
import { entityLabelWithId, securityEventLabel, ACTION_LABELS } from "@/lib/audit-labels";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type UserDetail = {
  admin: {
    id: number; email: string; fullName: string | null; isActive: boolean;
    avatarUrl: string | null; title: string | null; phone: string | null;
    department: string | null; bio: string | null;
    presenceStatus: string | null; presenceMessage: string | null;
    twoFactorEnabled: boolean; lastLogin: string | null;
    startDate: string | null; endDate: string | null;
    internalNotes: string | null;
    locale: string | null; timezone: string | null;
    lockedUntil: string | null; failedLoginAttempts: number;
    passwordChangedAt: string | null;
    recoveryEmail: string | null;
    loginAlertsEnabled: boolean;
    defaultLanding: string | null;
    createdAt: string; updatedAt: string;
    customRole: {
      id: number; name: string; color: string | null;
      description: string | null;
      permissions: Record<string, string[]>;
      isSystem: boolean;
    } | null;
    position: { id: number; name: string; color: string | null; defaultDepartment: string | null } | null;
  };
  stats: {
    sessionsCount: number;
    auditCount: number;
    assignedPayments: number;
    kpi30d?: { hoursLogged: number; timeEntries: number; actions: number; logins: number; messages: number };
  };
  activeSessions: Array<{
    id: string; browser: string | null; os: string | null; deviceType: string | null;
    ipAddress: string | null; country: string | null; city: string | null;
    lastActiveAt: string | null; createdAt: string; expiresAt: string;
    label: string | null; isCurrent: boolean;
  }>;
  recentAudits: Array<{
    id: number; action: string; entityType: string; entityId: number | null;
    ipAddress: string | null; createdAt: string;
  }>;
  recentEvents: Array<{
    id: number; type: string; severity: string; message: string;
    ipAddress: string | null; country: string | null; city: string | null; createdAt: string;
  }>;
};

function formatRelative(iso: string, t: (k: string) => string, tag: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return t("instant");
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric" });
}

export function UserDetailDrawer({
  open, onOpenChange, userId, currentAdminId, onEdit, onResetPassword,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: number | null;
  currentAdminId: number;
  onEdit: () => void;
  onResetPassword: () => void;
}) {
  const t = useTranslations("admin.team");
  const ta = useTranslations("admin.audit");
  const tc = useTranslations("common");
  const router = useRouter();
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(false);
  const [confirmDisable2FA, setConfirmDisable2FA] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [confirmAnonymize, setConfirmAnonymize] = useState(false);


  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const dateTag = useDateLocale();

  const reload = () => {
    if (!userId) return;
    setLoading(true);
    fetch(`/api/admin/team/${userId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: UserDetail | { error: string }) => {
        if (!("error" in d)) setData(d);
      })
      .finally(() => setLoading(false));
  };

  const handleDisable2FA = async () => {
    if (!userId) return;
    setPendingAction(true);
    const r = await disable2FAAction({ id: userId });
    setPendingAction(false);
    if (r.success) { toast.success(t("2fa_desactivee")); reload(); router.refresh(); }
    else toast.error(r.error || t("erreur"));
    setConfirmDisable2FA(false);
  };

  const handleUnlock = async () => {
    if (!userId) return;
    setPendingAction(true);
    const r = await unlockUserAction({ id: userId });
    setPendingAction(false);
    if (r.success) { toast.success(t("compte_debloque")); reload(); router.refresh(); }
    else toast.error(r.error || t("erreur"));
  };

  const handleLock = async (hours: number) => {
    if (!userId) return;
    setPendingAction(true);
    const r = await lockUserAction({ id: userId, hours });
    setPendingAction(false);
    if (r.success) { toast.success(ta("user_detail_drawer_compte_bloque_pour_p0_h", { p0: hours })); reload(); router.refresh(); }
    else toast.error(r.error || t("erreur"));
    setConfirmLock(false);
  };

  const handleExportData = async () => {
    if (!userId || !data) return;
    setPendingAction(true);
    const r = await exportUserDataAction({ id: userId });
    setPendingAction(false);
    if (r.success && "data" in r) {
      const blob = new Blob([JSON.stringify(r.data.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `user-${userId}-${data.admin.email}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("export_telecharge_loi_25"));
    } else if (!r.success) {
      toast.error(r.error);
    }
  };

  const handleAnonymize = async () => {
    if (!userId) return;
    setPendingAction(true);
    const r = await anonymizeUserAction({ id: userId });
    setPendingAction(false);
    if (r.success) {
      toast.success(t("compte_anonymise"));
      router.refresh();
      onOpenChange(false);
    } else {
      toast.error(r.error || t("erreur"));
    }
    setConfirmAnonymize(false);
  };

  const handleSaveNotes = async () => {
    if (!userId) return;
    setNotesSaving(true);
    const r = await updateUserAction({ id: userId, internalNotes: notesValue });
    setNotesSaving(false);
    if (r.success) {
      toast.success(t("notes_enregistrees"));
      setEditingNotes(false);
      reload();
    } else {
      toast.error(r.error || t("erreur"));
    }
  };

  useEffect(() => {
    if (!open || !userId) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/admin/team/${userId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: UserDetail | { error: string }) => {
        if ("error" in d) {
          toast.error(d.error);
          onOpenChange(false);
        } else {
          setData(d);
          setNotesValue(d.admin.internalNotes ?? "");
          setEditingNotes(false);
        }
      })
      .catch(() => toast.error(t("erreur_chargement")))
      .finally(() => setLoading(false));
  }, [open, userId, onOpenChange]);

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 gap-0 flex flex-col">
        <SheetTitle className="sr-only">{t("details_utilisateur")}</SheetTitle>

        {loading || !data ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>

            <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-6 py-5 shrink-0">
              <div className="flex items-start gap-4">
                <div
                  className="h-16 w-16 rounded-full flex items-center justify-center text-white font-bold text-xl shrink-0 ring-4 ring-white/15 shadow-lg"
                  style={{ backgroundColor: data.admin.position?.color ?? data.admin.customRole?.color ?? "#1A5FB4" }}
                >
                  {data.admin.avatarUrl ? (

                    <img src={data.admin.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    (data.admin.fullName || data.admin.email).charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold leading-tight truncate">
                    {data.admin.fullName || data.admin.email}
                  </h2>
                  {data.admin.title && (
                    <p className="text-sm text-white/80 mt-0.5 truncate">{data.admin.title}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {data.admin.isActive ? (
                      <Badge className="text-[10px] bg-emerald-500/90 hover:bg-emerald-500/90 text-white border-0">
                        <CircleDot className="h-2.5 w-2.5 mr-0.5" />{tc("active")}
                      </Badge>
                    ) : (
                      <Badge className="text-[10px] bg-gray-500/90 hover:bg-gray-500/90 text-white border-0">
                        {tc("disabled")}
                      </Badge>
                    )}
                    {data.admin.twoFactorEnabled && (
                      <Badge className="text-[10px] bg-white/15 hover:bg-white/15 text-white border-white/20">
                        <Shield className="h-2.5 w-2.5 mr-0.5" />2FA
                      </Badge>
                    )}
                    {data.admin.lockedUntil && new Date(data.admin.lockedUntil) > new Date() && (
                      <Badge className="text-[10px] bg-red-500/90 hover:bg-red-500/90 text-white border-0">
                        <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />{ta("user_detail_drawer_bloque")}</Badge>
                    )}
                    {data.admin.position && (
                      <Badge variant="outline" className="text-[10px] bg-white/10 text-white border-white/20">
                        {data.admin.position.name}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>


              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onEdit}
                  className="bg-white/15 hover:bg-white/25 text-white border-white/20 backdrop-blur"
                >
                  <Edit className="h-3.5 w-3.5 mr-1.5" />{tc("edit")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onResetPassword}
                  className="bg-white/15 hover:bg-white/25 text-white border-white/20 backdrop-blur"
                >
                  <KeyRound className="h-3.5 w-3.5 mr-1.5" />{ta("user_detail_drawer_reinit_mot_de_passe")}</Button>
              </div>
            </div>


            <div className="flex-1 overflow-y-auto">

              <div className="grid grid-cols-3 border-b bg-muted/30">
                <StatCell icon={Activity} label={t("sessions")} value={data.stats.sessionsCount} />
                <StatCell icon={History} label={tc("actions")} value={data.stats.auditCount} />
                <StatCell icon={Briefcase} label={t("paiements_assignes")} value={data.stats.assignedPayments} />
              </div>


              {data.stats.kpi30d && (
                <div className="border-b bg-gradient-to-br from-[#0F2D52]/[0.03] to-transparent">
                  <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      {t("productivite_30_derniers_jours")}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-px bg-border">
                    <KpiCell label={t("heures_saisies")} value={data.stats.kpi30d.hoursLogged} suffix="h" />
                    <KpiCell label={t("saisies_temps")} value={data.stats.kpi30d.timeEntries} />
                    <KpiCell label={tc("actions")} value={data.stats.kpi30d.actions} />
                    <KpiCell label={t("connexions")} value={data.stats.kpi30d.logins} />
                  </div>
                </div>
              )}


              <DrawerSection icon={User} title={t("coordonnees")}>
                <Row icon={Mail} label={t("courriel_2")} value={data.admin.email} />
                {data.admin.phone && <Row icon={Phone} label={t("telephone")} value={data.admin.phone} />}
                {data.admin.department && <Row icon={Building2} label={t("departement_2")} value={data.admin.department} />}
                {data.admin.position && (
                  <Row
                    icon={Briefcase}
                    label={t("poste")}
                    value={data.admin.position.name}
                    valueColor={data.admin.position.color}
                  />
                )}
                {data.admin.customRole && (
                  <Row
                    icon={Shield}
                    label={t("role_acces")}
                    value={data.admin.customRole.name}
                    valueColor={data.admin.customRole.color}
                    mono
                  />
                )}
              </DrawerSection>


              <DrawerSection icon={Calendar} title={t("activite")}>
                <Row
                  icon={Calendar}
                  label={t("derniere_connexion")}
                  value={data.admin.lastLogin ? `${formatRelative(data.admin.lastLogin, t, dateTag)} · ${new Date(data.admin.lastLogin).toLocaleDateString(dateTag)}` : t("jamais_connecte")}
                />
                <Row
                  icon={KeyRound}
                  label={t("mot_passe_modifie")}
                  value={data.admin.passwordChangedAt ? formatRelative(data.admin.passwordChangedAt, t, dateTag) : t("jamais_modifie")}
                />
                <Row
                  icon={Calendar}
                  label={t("compte_cree")}
                  value={new Date(data.admin.createdAt).toLocaleDateString(dateTag, { day: "numeric", month: "long", year: "numeric" })}
                />
                {data.admin.startDate && (
                  <Row
                    icon={Calendar}
                    label={t("date_embauche")}
                    value={new Date(data.admin.startDate).toLocaleDateString(dateTag, { day: "numeric", month: "long", year: "numeric" })}
                  />
                )}
              </DrawerSection>


              {data.admin.customRole && (
                <DrawerSection icon={Shield} title={t("permissions_effectives")} count={Object.keys(data.admin.customRole.permissions ?? {}).length}>
                  <div className="rounded-md border bg-card overflow-hidden">
                    <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5" style={{ color: data.admin.customRole.color ?? "#0F2D52" }} />
                      <span className="text-xs font-semibold" style={{ color: data.admin.customRole.color ?? undefined }}>
                        {data.admin.customRole.name}
                      </span>
                      {data.admin.customRole.isSystem && (
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{t("systeme_2")}</Badge>
                      )}
                    </div>
                    <div className="divide-y">
                      {Object.entries(data.admin.customRole.permissions ?? {}).map(([resource, actions]) => (
                        <div key={resource} className="flex items-center gap-2 px-3 py-1.5">
                          <code className="text-[11px] font-mono text-muted-foreground w-32 truncate">{resource}</code>
                          <div className="flex gap-1 flex-wrap">
                            {(actions as string[]).map((a) => (
                              <Badge
                                key={a}
                                variant="outline"
                                className={cn(
                                  "text-[9px] px-1.5 py-0 font-medium",
                                  a === "read" && "border-blue-300 text-blue-700 bg-blue-50",
                                  a === "write" && "border-emerald-300 text-emerald-700 bg-emerald-50",
                                  a === "delete" && "border-red-300 text-red-700 bg-red-50",
                                  a === "export" && "border-purple-300 text-purple-700 bg-purple-50",
                                )}
                              >
                                {a}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                      {Object.keys(data.admin.customRole.permissions ?? {}).length === 0 && (
                        <p className="px-3 py-2 text-xs text-muted-foreground italic">{t("aucune_permission_accordee")}</p>
                      )}
                    </div>
                  </div>
                  <Link
                    href="/admin/settings/team"
                    className="inline-flex items-center gap-1 text-[10px] text-[#0F2D52] hover:underline mt-1.5"
                  >{ta("user_detail_drawer_modifier_les_permissions_du_role")}<ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                </DrawerSection>
              )}


              {data.activeSessions.length > 0 && (
                <DrawerSection icon={Globe} title={t("sessions_actives")} count={data.activeSessions.length}>
                  <div className="space-y-2">
                    {data.activeSessions.map((s) => (
                      <div key={s.id} className="rounded-md border bg-card p-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium">
                            {s.label ?? s.browser ?? t("navigateur")} {s.os && `· ${s.os}`}
                          </span>
                          {s.isCurrent && (
                            <Badge className="text-[9px] bg-emerald-600 hover:bg-emerald-600">{t("actuelle")}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                          {s.ipAddress && <span className="font-mono">{s.ipAddress}</span>}
                          {s.city && s.country && (
                            <span className="inline-flex items-center gap-0.5">
                              <MapPin className="h-2.5 w-2.5" />{s.city}, {s.country}
                            </span>
                          )}
                          {s.lastActiveAt && <span>Vu {formatRelative(s.lastActiveAt, t, dateTag)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </DrawerSection>
              )}


              {data.recentEvents.length > 0 && (
                <DrawerSection icon={AlertTriangle} title={t("evenements_securite")} count={data.recentEvents.length}>
                  <div className="space-y-1.5">
                    {data.recentEvents.map((e) => {
                      const sevColor =
                        e.severity === "critical" ? "text-red-600" :
                        e.severity === "warning" ? "text-amber-600" :
                        e.severity === "success" ? "text-emerald-600" : "text-muted-foreground";
                      return (
                        <div key={e.id} className="flex items-start gap-2 text-xs">
                          <CircleDot className={cn("h-3 w-3 mt-1 shrink-0", sevColor)} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium line-clamp-1">{securityEventLabel(ta, e.type)}</p>
                            {e.message && e.message !== securityEventLabel(ta, e.type) && (
                              <p className="text-[11px] text-muted-foreground line-clamp-1">{e.message}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {formatRelative(e.createdAt, t, dateTag)}
                              {e.ipAddress && ` · ${e.ipAddress}`}
                              {e.city && ` · ${e.city}, ${e.country}`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </DrawerSection>
              )}


              {data.recentAudits.length > 0 && (
                <DrawerSection
                  icon={History}
                  title={t("actions_recentes")}
                  count={data.recentAudits.length}
                  action={
                    <Link
                      href={`/admin/audit-trail?adminId=${data.admin.id}`}
                      className="text-[11px] text-[#0F2D52] hover:underline inline-flex items-center gap-1"
                    >{ta("user_detail_drawer_voir_tout")}<ExternalLink className="h-3 w-3" />
                    </Link>
                  }
                >
                  <div className="space-y-1">
                    {data.recentAudits.map((a) => (
                      <div key={a.id} className="flex items-start gap-2 text-xs py-1.5 border-b last:border-0">
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">
                          {ACTION_LABELS[a.action] ? ta(ACTION_LABELS[a.action]) : a.action}
                        </Badge>
                        <span className="flex-1 min-w-0 text-xs">
                          {entityLabelWithId(ta, a.entityType, a.entityId)}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{formatRelative(a.createdAt, t, dateTag)}</span>
                      </div>
                    ))}
                  </div>
                </DrawerSection>
              )}


              {data.admin.id !== currentAdminId && (
                <DrawerSection icon={Shield} title={t("actions_securite")}>
                  <div className="space-y-2">
                    {data.admin.twoFactorEnabled && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmDisable2FA(true)}
                        disabled={pendingAction}
                        className="w-full justify-start text-amber-700 border-amber-300 hover:bg-amber-50"
                      >
                        <ShieldOff className="h-3.5 w-3.5 mr-2" />
                        {t("desactiver_2fa")}
                      </Button>
                    )}
                    {data.admin.lockedUntil && new Date(data.admin.lockedUntil) > new Date() ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleUnlock}
                        disabled={pendingAction}
                        className="w-full justify-start text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                      >
                        <Unlock className="h-3.5 w-3.5 mr-2" />
                        {t("debloquer_compte")}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmLock(true)}
                        disabled={pendingAction}
                        className="w-full justify-start text-red-700 border-red-300 hover:bg-red-50"
                      >
                        <Lock className="h-3.5 w-3.5 mr-2" />
                        {t("bloquer_temporairement_1_heure")}
                      </Button>
                    )}
                    {data.admin.failedLoginAttempts > 0 && (
                      <p className="text-[10px] text-amber-700 italic px-1">
                        ⚠ {data.admin.failedLoginAttempts} tentative(s) de connexion échouée(s)
                      </p>
                    )}
                  </div>
                </DrawerSection>
              )}


              <DrawerSection
                icon={FileText}
                title={t("notes_internes")}
                action={
                  !editingNotes && (
                    <button
                      type="button"
                      onClick={() => setEditingNotes(true)}
                      className="text-[10px] text-[#0F2D52] hover:underline inline-flex items-center gap-1"
                    >
                      {data.admin.internalNotes ? t("modifier") : t("ajouter")}
                      <Edit className="h-2.5 w-2.5" />
                    </button>
                  )
                }
              >
                {editingNotes ? (
                  <div className="space-y-2">
                    <Textarea
                      value={notesValue}
                      onChange={(e) => setNotesValue(e.target.value)}
                      rows={4}
                      placeholder={t("notes_confidentielles_visibles_uniquement_admins")}
                      maxLength={2000}
                      className="text-xs"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setEditingNotes(false); setNotesValue(data.admin.internalNotes ?? ""); }}
                        disabled={notesSaving}
                      >
                        {tc("cancel")}
                      </Button>
                      <Button size="sm" onClick={handleSaveNotes} disabled={notesSaving} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
                        <Save className="h-3.5 w-3.5 mr-1.5" />{tc("save")}
                      </Button>
                    </div>
                  </div>
                ) : data.admin.internalNotes ? (
                  <div className="rounded-md border bg-amber-50 border-amber-200 p-3 text-xs text-amber-900 whitespace-pre-wrap">
                    {data.admin.internalNotes}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">{t("aucune_note_interne")}</p>
                )}
              </DrawerSection>
            </div>


            <div className="border-t bg-muted/30 px-5 py-3 space-y-2 shrink-0">
              <div className="grid grid-cols-3 gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/admin/audit-trail?adminId=${data.admin.id}`}>
                    <History className="h-3.5 w-3.5 mr-1" />
                    <span className="text-xs">{t("audit")}</span>
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`mailto:${data.admin.email}`}>
                    <Mail className="h-3.5 w-3.5 mr-1" />
                    <span className="text-xs">{t("email")}</span>
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/admin/settings/security">
                    <LogOut className="h-3.5 w-3.5 mr-1" />
                    <span className="text-xs">{t("securite")}</span>
                  </Link>
                </Button>
              </div>
              {data.admin.id !== currentAdminId && (
                <div className="flex gap-2 pt-2 border-t border-border/50">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleExportData}
                    disabled={pendingAction}
                    className="flex-1 text-[10px] text-muted-foreground hover:text-[#0F2D52]"
                    title={t("telecharger_toutes_donnees_cet_utilisateur")}
                  >
                    <FileText className="h-3 w-3 mr-1" />{ta("user_detail_drawer_export_donnees")}</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmAnonymize(true)}
                    disabled={pendingAction}
                    className="flex-1 text-[10px] text-red-600 hover:bg-red-50 hover:text-red-700"
                    title={t("anonymiser_compte_droit_oubli_loi")}
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />Anonymiser
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>


      <ConfirmDialog
        open={confirmDisable2FA}
        onOpenChange={setConfirmDisable2FA}
        title={t("desactiver_2fa_2")}
        description={t("utilisateur_plus_besoin_code_2fa")}
        confirmLabel={t("desactiver_2fa")}
        variant="destructive"
        onConfirm={handleDisable2FA}
      />
      <ConfirmDialog
        open={confirmLock}
        onOpenChange={setConfirmLock}
        title={t("bloquer_compte_temporairement")}
        description={t("compte_sera_inaccessible_pendant_1")}
        confirmLabel={t("bloquer_1_heure")}
        variant="destructive"
        onConfirm={() => handleLock(1)}
      />
      <ConfirmDialog
        open={confirmAnonymize}
        onOpenChange={setConfirmAnonymize}
        title={t("anonymiser_compte")}
        description={t("conformite_loi_25_droit_oubli")}
        confirmLabel={t("anonymiser_definitivement")}
        variant="destructive"
        onConfirm={handleAnonymize}
      />
    </Sheet>
  );
}

function DrawerSection({
  icon: Icon, title, count, action, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b">
      <div className="px-5 py-3 flex items-center justify-between gap-2 bg-muted/20">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-[#0F2D52]" />
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#0F2D52]">{title}</h3>
          {count !== undefined && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{count}</Badge>
          )}
        </div>
        {action}
      </div>
      <div className="px-5 py-3">{children}</div>
    </div>
  );
}

function Row({
  icon: Icon, label, value, valueColor, mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueColor?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 py-1.5 text-xs">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <span className="text-muted-foreground w-32 shrink-0">{label}</span>
      <span className={cn("flex-1 min-w-0 break-words", mono && "font-mono")} style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </span>
    </div>
  );
}

function StatCell({
  icon: Icon, label, value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="p-4 text-center border-r last:border-0">
      <Icon className="h-4 w-4 text-[#0F2D52] mx-auto mb-1" />
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}

function KpiCell({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="bg-white p-3 text-center">
      <p className="text-lg font-bold tabular-nums text-[#0F2D52]">
        {value}
        {suffix ? <span className="text-xs font-medium ml-0.5">{suffix}</span> : null}
      </p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

