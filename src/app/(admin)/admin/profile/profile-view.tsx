"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProfileBanner, type OnboardingStep } from "./components/profile-banner";
import { TabCompte } from "./components/tab-compte";
import { TabPreferences } from "./components/tab-preferences";
import { TabSecurite } from "./components/tab-securite";
import { TabSessions } from "./components/tab-sessions";
import { TabActivite } from "./components/tab-activite";
import { TabConfidentialite } from "./components/tab-confidentialite";
import { TabApiTokens } from "./components/tab-api-tokens";
import { TabStats } from "./components/tab-stats";
import { TabDisponibilites } from "./components/tab-disponibilites";
import {
  User, Lock, Monitor, History, Calendar,
  SlidersHorizontal, ShieldCheck, BarChart3, Key,
} from "lucide-react";

const TAB_CLASS = "rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 sm:px-4 py-2.5 gap-1.5 text-xs sm:text-sm whitespace-nowrap";

export type AdminProfile = {
  id: number;
  email: string;
  fullName: string | null;
  role: string;
  twoFactorEnabled: boolean;
  avatarUrl: string | null;
  lastLogin: string | null;
  createdAt: string;
  title: string | null;
  phone: string | null;
  phoneVerifiedAt: string | null;
  bio: string | null;
  emailSignature: string | null;
  presenceStatus: string | null;
  presenceMessage: string | null;
  presenceUntil: string | null;
  timezone: string | null;
  locale: string | null;
  theme: string | null;
  accentColor: string | null;
  defaultLanding: string | null;
  notificationPrefs: unknown;
  shortcuts: unknown;
  passwordChangedAt: string | null;
  loginAlertsEnabled: boolean;
  recoveryEmail: string | null;
  dataExportRequestedAt: string | null;
  marketingOptIn: boolean;
  analyticsOptIn: boolean;
  onboardingDone: boolean;
  onboardingSteps: unknown;
};

export type SessionRow = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  lastActiveAt: string | null;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  country: string | null;
  city: string | null;
  label: string | null;
  isCurrent: boolean;
  isTrusted?: boolean;
  trustedUntil?: string | null;
};

export type AuditEvent = {
  id: number;
  action: string;
  entityType: string;
  entityId: number | null;
  changes: unknown;
  ipAddress: string | null;
  createdAt: string;
};

export type SecurityEventRow = {
  id: number;
  type: string;
  severity: string;
  message: string;
  metadata: unknown;
  ipAddress: string | null;
  country: string | null;
  city: string | null;
  createdAt: string;
};

export type LoginEventRow = {
  id: number;
  type: string;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  country: string | null;
  city: string | null;
  deviceType: string | null;
  createdAt: string;
};

export type TrustedDeviceRow = {
  id: number;
  fingerprint: string;
  label: string;
  lastUsedAt: string;
  expiresAt: string;
  createdAt: string;
};

export type ApiTokenRow = {
  id: number;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type PersonalKpis = {
  requestsHandled: number;
  invoicesIssued: number;
  revenue30: number;
  paymentsAssigned: number;
};

export function ProfileView({
  admin, sessions, auditLogs, securityEvents, loginEvents,
  backupCodesCount, trustedDevices, apiTokens, personalKpis,
}: {
  admin: AdminProfile;
  sessions: SessionRow[];
  auditLogs: AuditEvent[];
  securityEvents: SecurityEventRow[];
  loginEvents: LoginEventRow[];
  backupCodesCount: number;
  trustedDevices: TrustedDeviceRow[];
  apiTokens: ApiTokenRow[];
  personalKpis: PersonalKpis;
}) {
  const t = useTranslations("admin.profile.tabs");
  const tBanner = useTranslations("admin.profile.banner");
  const tRoot = useTranslations("admin.profile");
  const [activeTab, setActiveTab] = useState<string>("compte");

  // Sticky scroll detection
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Security score ──────────────────────────────────
  const securityScore = useMemo(() => {
    let score = 0;
    if (admin.twoFactorEnabled) score += 30;
    if (backupCodesCount > 0) score += 15;
    if (admin.passwordChangedAt) {
      const daysSince = (Date.now() - new Date(admin.passwordChangedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 90) score += 20;
      else if (daysSince < 180) score += 10;
    }
    if (admin.recoveryEmail) score += 10;
    if (admin.loginAlertsEnabled) score += 10;
    if (admin.avatarUrl) score += 5;
    if (admin.fullName && admin.fullName.length > 2) score += 5;
    if (admin.phone) score += 5;
    return Math.min(100, score);
  }, [admin, backupCodesCount]);

  // ── Onboarding steps ─────────────────────────────────
  const onboardingSteps: OnboardingStep[] = useMemo(() => [
    { key: "fullName", label: tBanner("onboarding.fullName"), done: !!admin.fullName, cta: "compte" },
    { key: "avatar", label: tBanner("onboarding.avatar"), done: !!admin.avatarUrl, cta: "compte" },
    { key: "title", label: tBanner("onboarding.title"), done: !!admin.title, cta: "compte" },
    { key: "twoFactor", label: tBanner("onboarding.twoFactor"), done: admin.twoFactorEnabled, cta: "securite" },
    { key: "backupCodes", label: tBanner("onboarding.backupCodes"), done: backupCodesCount > 0, cta: "securite" },
    { key: "recoveryEmail", label: tBanner("onboarding.recoveryEmail"), done: !!admin.recoveryEmail, cta: "compte" },
    { key: "timezone", label: tBanner("onboarding.timezone"), done: !!admin.timezone, cta: "preferences" },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [admin, backupCodesCount]);

  const activeSessionsCount = sessions.filter((s) => new Date(s.expiresAt) > new Date()).length;

  return (
    <div className="space-y-6">
      <ProfileBanner
        fullName={admin.fullName ?? admin.email}
        email={admin.email}
        role={admin.role}
        lastLogin={admin.lastLogin}
        createdAt={admin.createdAt}
        avatarUrl={admin.avatarUrl}
        title={admin.title}
        presenceStatus={admin.presenceStatus}
        presenceMessage={admin.presenceMessage}
        twoFactorEnabled={admin.twoFactorEnabled}
        backupCodesCount={backupCodesCount}
        trustedDevicesCount={trustedDevices.length}
        securityScore={securityScore}
        onboardingSteps={onboardingSteps}
        onJumpToTab={(t) => setActiveTab(t)}
      />

      {/* Sticky compact bar au scroll */}
      <div ref={sentinelRef} aria-hidden className="h-px -mt-3" />
      {scrolled && (
        <div className="sticky top-[64px] z-20 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 bg-background/95 backdrop-blur shadow-sm border-b">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <User className="h-4 w-4" />
              {tRoot("page_title")}
            </span>
            <span className="text-muted-foreground">{admin.email}</span>
            <span className="text-muted-foreground">{tBanner("role_admin")}</span>
            {admin.twoFactorEnabled && <span className="text-emerald-600 font-semibold inline-flex items-center gap-1"><Lock className="h-3 w-3" />{tBanner("two_factor_enabled")}</span>}
            <span className={`font-semibold ${securityScore >= 80 ? "text-emerald-600" : securityScore >= 50 ? "text-amber-600" : "text-red-600"}`}>
              {tBanner("security_score")} {securityScore}/100
            </span>
            <span className="ml-auto text-muted-foreground">
              {activeSessionsCount} session{activeSessionsCount > 1 ? "s" : ""} active{activeSessionsCount > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start bg-transparent border-b rounded-none p-0 h-auto gap-0 overflow-x-auto">
          <TabsTrigger value="compte" className={TAB_CLASS}><User className="h-3.5 w-3.5" /> {t("account")}</TabsTrigger>
          <TabsTrigger value="preferences" className={TAB_CLASS}><SlidersHorizontal className="h-3.5 w-3.5" /> {t("preferences")}</TabsTrigger>
          <TabsTrigger value="securite" className={TAB_CLASS}><Lock className="h-3.5 w-3.5" /> {t("security")}</TabsTrigger>
          <TabsTrigger value="sessions" className={TAB_CLASS}><Monitor className="h-3.5 w-3.5" /> {t("sessions")}</TabsTrigger>
          <TabsTrigger value="activite" className={TAB_CLASS}><History className="h-3.5 w-3.5" /> {t("activity")}</TabsTrigger>
          <TabsTrigger value="confidentialite" className={TAB_CLASS}><ShieldCheck className="h-3.5 w-3.5" /> {t("privacy")}</TabsTrigger>
          <TabsTrigger value="api" className={TAB_CLASS}><Key className="h-3.5 w-3.5" /> {t("api")}</TabsTrigger>
          <TabsTrigger value="stats" className={TAB_CLASS}><BarChart3 className="h-3.5 w-3.5" /> {t("stats")}</TabsTrigger>
          <TabsTrigger value="disponibilites" className={TAB_CLASS}><Calendar className="h-3.5 w-3.5" /> {t("availability")}</TabsTrigger>
        </TabsList>

        <TabsContent value="compte" className="mt-4">
          <TabCompte admin={admin} />
        </TabsContent>
        <TabsContent value="preferences" className="mt-4">
          <TabPreferences admin={admin} />
        </TabsContent>
        <TabsContent value="securite" className="mt-4">
          <TabSecurite
            twoFactorEnabled={admin.twoFactorEnabled}
            passwordChangedAt={admin.passwordChangedAt}
            backupCodesCount={backupCodesCount}
            trustedDevices={trustedDevices}
            securityScore={securityScore}
            loginAlertsEnabled={admin.loginAlertsEnabled}
          />
        </TabsContent>
        <TabsContent value="sessions" className="mt-4">
          <TabSessions sessions={sessions} />
        </TabsContent>
        <TabsContent value="activite" className="mt-4">
          <TabActivite securityEvents={securityEvents} loginEvents={loginEvents} auditLogs={auditLogs} />
        </TabsContent>
        <TabsContent value="confidentialite" className="mt-4">
          <TabConfidentialite admin={admin} />
        </TabsContent>
        <TabsContent value="api" className="mt-4">
          <TabApiTokens tokens={apiTokens} />
        </TabsContent>
        <TabsContent value="stats" className="mt-4">
          <TabStats kpis={personalKpis} loginEvents={loginEvents} />
        </TabsContent>
        <TabsContent value="disponibilites" className="mt-4">
          <TabDisponibilites />
        </TabsContent>
      </Tabs>
    </div>
  );
}
