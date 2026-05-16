"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/utils";
import { Shield, Clock, ShieldCheck, ShieldAlert, Coffee, Briefcase, Plane, Focus, Circle, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";

export type OnboardingStep = {
  key: string;
  label: string;
  done: boolean;
  cta: string; // tab cible
};

export function ProfileBanner({
  fullName,
  email,
  role,
  lastLogin,
  createdAt,
  avatarUrl,
  title,
  presenceStatus,
  presenceMessage,
  twoFactorEnabled,
  backupCodesCount,
  trustedDevicesCount,
  securityScore,
  onboardingSteps,
  onJumpToTab,
}: {
  fullName: string;
  email: string;
  role: string;
  lastLogin: string | null;
  createdAt: string;
  avatarUrl?: string | null;
  title?: string | null;
  presenceStatus?: string | null;
  presenceMessage?: string | null;
  twoFactorEnabled?: boolean;
  backupCodesCount?: number;
  trustedDevicesCount?: number;
  securityScore?: number;
  onboardingSteps?: OnboardingStep[];
  onJumpToTab?: (tab: string) => void;
}) {
  const t = useTranslations("admin.profile.banner");
  const tAccount = useTranslations("admin.profile.account");

  const ROLE_LABELS: Record<string, string> = {
    super_admin: t("role_super_admin"),
    admin: t("role_admin"),
  };

  const PRESENCE: Record<string, { icon: typeof Briefcase; label: string; color: string }> = {
    active: { icon: Circle, label: tAccount("presence.active"), color: "bg-emerald-500" },
    meeting: { icon: Briefcase, label: tAccount("presence.meeting"), color: "bg-amber-500" },
    vacation: { icon: Plane, label: tAccount("presence.vacation"), color: "bg-blue-500" },
    focus: { icon: Focus, label: tAccount("presence.focus"), color: "bg-purple-500" },
    offline: { icon: Coffee, label: tAccount("presence.offline"), color: "bg-zinc-500" },
  };

  const lastLoginStr = lastLogin
    ? new Date(lastLogin).toLocaleDateString(undefined, {
        day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "—";

  const memberSince = new Date(createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const presence = presenceStatus ? PRESENCE[presenceStatus] : null;
  const PresenceIcon = presence?.icon ?? Circle;

  const onbDone = onboardingSteps?.filter((s) => s.done).length ?? 0;
  const onbTotal = onboardingSteps?.length ?? 0;
  const onbPct = onbTotal > 0 ? Math.round((onbDone / onbTotal) * 100) : 100;
  const onbPending = useMemo(() => onboardingSteps?.filter((s) => !s.done) ?? [], [onboardingSteps]);

  return (
    <div className="relative rounded-2xl vnk-gradient text-white overflow-hidden">
      <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/5 hidden sm:block" />
      <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/5 hidden sm:block" />

      <div className="relative p-5 sm:p-7 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
        <div className="relative">
          <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-2 border-white/20">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
            <AvatarFallback className="bg-white/20 text-white text-xl sm:text-2xl font-bold">
              {initials(fullName || email)}
            </AvatarFallback>
          </Avatar>
          {presence && (
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full ring-2 ring-[#0F2D52] flex items-center justify-center ${presence.color}`}
              title={presence.label}
            >
              <PresenceIcon className="h-2.5 w-2.5 text-white" />
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{fullName}</h1>
          {title && <p className="text-white/85 text-sm font-medium mt-0.5 truncate">{title}</p>}
          <p className="text-white/70 text-sm mt-0.5">{email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge className="bg-white/15 hover:bg-white/20 text-white border-0 text-xs">
              <Shield className="h-3 w-3 mr-1" />
              {ROLE_LABELS[role] ?? role}
            </Badge>
            {twoFactorEnabled ? (
              <Badge className="bg-emerald-500/30 hover:bg-emerald-500/40 text-white border-0 text-xs">
                <ShieldCheck className="h-3 w-3 mr-1" />
                {t("two_factor_enabled")}
              </Badge>
            ) : (
              <Badge className="bg-amber-500/30 hover:bg-amber-500/40 text-white border-0 text-xs">
                <ShieldAlert className="h-3 w-3 mr-1" />
                {t("two_factor_disabled")}
              </Badge>
            )}
            {presence && (
              <Badge className="bg-white/15 hover:bg-white/20 text-white border-0 text-xs">
                {presence.label}
                {presenceMessage ? <span className="ml-1 text-white/70">— {presenceMessage}</span> : null}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 sm:flex-col sm:items-end text-xs text-white/60">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {t("last_login")} {lastLoginStr}
          </span>
          <span>{t("member_since", { date: memberSince })}</span>
          {typeof securityScore === "number" && (
            <span className="flex items-center gap-1.5">
              {t("security_score")} :
              <span className={`font-bold ${securityScore >= 80 ? "text-emerald-300" : securityScore >= 50 ? "text-amber-300" : "text-red-300"}`}>
                {securityScore}/100
              </span>
            </span>
          )}
          {typeof backupCodesCount === "number" && (
            <span className="text-white/60">{t("backup_codes", { count: backupCodesCount })}</span>
          )}
          {typeof trustedDevicesCount === "number" && trustedDevicesCount > 0 && (
            <span className="text-white/60">{t("trusted_devices", { count: trustedDevicesCount })}</span>
          )}
        </div>
      </div>

      {/* Onboarding checklist bar */}
      {onboardingSteps && onbTotal > 0 && onbPct < 100 && (
        <div className="relative border-t border-white/10 bg-black/15 px-5 sm:px-7 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">{t("complete_profile")}</span>
                <span className="text-white/70">{onbDone}/{onbTotal} ({onbPct}%)</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
                <div className="h-full bg-emerald-400 transition-all" style={{ width: `${onbPct}%` }} />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {onbPending.slice(0, 3).map((s) => (
                <Button
                  key={s.key}
                  size="sm"
                  variant="secondary"
                  className="h-7 bg-white/10 hover:bg-white/20 text-white border-0 text-[11px]"
                  onClick={() => onJumpToTab?.(s.cta)}
                >
                  {s.label}
                  <ChevronRight className="h-3 w-3 ml-0.5" />
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
