"use client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProfileBanner } from "./components/profile-banner";
import { TabCompte } from "./components/tab-compte";
import { TabSecurite } from "./components/tab-securite";
import { TabSessions } from "./components/tab-sessions";
import { TabActivite } from "./components/tab-activite";
import { TabDisponibilites } from "./components/tab-disponibilites";
import { TabIntegrations } from "./components/tab-integrations";
import { TabAutomatisations } from "./components/tab-automatisations";
import { User, Lock, Monitor, History, Calendar, Plug, Zap } from "lucide-react";

const TAB_CLASS = "rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 sm:px-4 py-2.5 gap-1.5 text-xs sm:text-sm";

type AdminProfile = {
  id: number;
  email: string;
  fullName: string | null;
  role: string;
  twoFactorEnabled: boolean;
  lastLogin: string | null;
  createdAt: string;
};

type SessionRow = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
};

type AuditEvent = {
  id: number;
  action: string;
  entityType: string;
  entityId: number | null;
  changes: unknown;
  ipAddress: string | null;
  createdAt: string;
};

export function ProfileView({
  admin,
  sessions,
  auditLogs,
}: {
  admin: AdminProfile;
  sessions: SessionRow[];
  auditLogs: AuditEvent[];
}) {
  return (
    <div className="space-y-6">
      <ProfileBanner
        fullName={admin.fullName ?? admin.email}
        email={admin.email}
        role={admin.role}
        lastLogin={admin.lastLogin}
        createdAt={admin.createdAt}
      />

      <Tabs defaultValue="compte">
        <TabsList className="w-full justify-start bg-transparent border-b rounded-none p-0 h-auto gap-0 overflow-x-auto">
          <TabsTrigger value="compte" className={TAB_CLASS}>
            <User className="h-3.5 w-3.5" /> Compte
          </TabsTrigger>
          <TabsTrigger value="securite" className={TAB_CLASS}>
            <Lock className="h-3.5 w-3.5" /> Securite
          </TabsTrigger>
          <TabsTrigger value="disponibilites" className={TAB_CLASS}>
            <Calendar className="h-3.5 w-3.5" /> Disponibilites
          </TabsTrigger>
          <TabsTrigger value="integrations" className={TAB_CLASS}>
            <Plug className="h-3.5 w-3.5" /> Integrations
          </TabsTrigger>
          <TabsTrigger value="automatisations" className={TAB_CLASS}>
            <Zap className="h-3.5 w-3.5" /> Automatisations
          </TabsTrigger>
          <TabsTrigger value="sessions" className={TAB_CLASS}>
            <Monitor className="h-3.5 w-3.5" /> Sessions
          </TabsTrigger>
          <TabsTrigger value="activite" className={TAB_CLASS}>
            <History className="h-3.5 w-3.5" /> Activite
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compte">
          <TabCompte admin={{
            id: admin.id,
            email: admin.email,
            fullName: admin.fullName,
            role: admin.role,
            lastLogin: admin.lastLogin,
            createdAt: admin.createdAt,
          }} />
        </TabsContent>
        <TabsContent value="securite">
          <TabSecurite twoFactorEnabled={admin.twoFactorEnabled} />
        </TabsContent>
        <TabsContent value="disponibilites">
          <TabDisponibilites />
        </TabsContent>
        <TabsContent value="integrations">
          <TabIntegrations />
        </TabsContent>
        <TabsContent value="automatisations">
          <TabAutomatisations />
        </TabsContent>
        <TabsContent value="sessions">
          <TabSessions sessions={sessions} />
        </TabsContent>
        <TabsContent value="activite">
          <TabActivite auditLogs={auditLogs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
