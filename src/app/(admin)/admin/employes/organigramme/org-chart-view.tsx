"use client";
// Vue Organigramme — deux modes : Hiérarchie managériale (managerId) ou Arbre des équipes (parentTeamId).
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Network, Crown, Users, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type AdminLite = {
  id: number;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  title: string | null;
  department: string | null;
  teamId: number | null;
  managerId: number | null;
  position: { name: string; color: string | null } | null;
  customRole: { name: string; color: string | null } | null;
};
type TeamLite = {
  id: number;
  name: string;
  color: string | null;
  parentTeamId: number | null;
  leadAdminId: number | null;
  lead: { id: number; fullName: string | null; email: string } | null;
};

type Mode = "managers" | "teams";

export function OrgChartView({ teams, admins }: { teams: TeamLite[]; admins: AdminLite[] }) {
  const t = useTranslations("admin.hr_nav");
  const [mode, setMode] = useState<Mode>("managers");


  const adminById = useMemo(() => {
    const m = new Map<number, AdminLite>();
    for (const a of admins) m.set(a.id, a);
    return m;
  }, [admins]);
  const teamById = useMemo(() => {
    const m = new Map<number, TeamLite>();
    for (const t of teams) m.set(t.id, t);
    return m;
  }, [teams]);


  const managerRoots = useMemo(() => admins.filter((a) => !a.managerId || !adminById.has(a.managerId)), [admins, adminById]);
  const reportsByManager = useMemo(() => {
    const m = new Map<number, AdminLite[]>();
    for (const a of admins) {
      if (a.managerId != null) {
        if (!m.has(a.managerId)) m.set(a.managerId, []);
        m.get(a.managerId)!.push(a);
      }
    }
    return m;
  }, [admins]);


  const teamRoots = useMemo(() => teams.filter((t) => !t.parentTeamId || !teamById.has(t.parentTeamId)), [teams, teamById]);
  const childTeamsByParent = useMemo(() => {
    const m = new Map<number, TeamLite[]>();
    for (const t of teams) {
      if (t.parentTeamId != null) {
        if (!m.has(t.parentTeamId)) m.set(t.parentTeamId, []);
        m.get(t.parentTeamId)!.push(t);
      }
    }
    return m;
  }, [teams]);
  const membersByTeam = useMemo(() => {
    const m = new Map<number, AdminLite[]>();
    for (const a of admins) {
      if (a.teamId != null) {
        if (!m.has(a.teamId)) m.set(a.teamId, []);
        m.get(a.teamId)!.push(a);
      }
    }
    return m;
  }, [admins]);
  const unassignedMembers = useMemo(() => admins.filter((a) => a.teamId == null), [admins]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Network className="h-5 w-5 text-[#0F2D52]" />
            {t("organigramme")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("visualisez_structure_organisation_hierarchie_manageriale")}
          </p>
        </div>
        <div className="flex gap-1 p-1 bg-muted rounded-md">
          <Button
            size="sm"
            variant={mode === "managers" ? "default" : "ghost"}
            className="h-7 text-xs"
            onClick={() => setMode("managers")}
          >
            <Crown className="h-3 w-3 mr-1" />
            {t("hierarchie_manageriale")}
          </Button>
          <Button
            size="sm"
            variant={mode === "teams" ? "default" : "ghost"}
            className="h-7 text-xs"
            onClick={() => setMode("teams")}
          >
            <GitBranch className="h-3 w-3 mr-1" />
            {t("equipes")}
          </Button>
        </div>
      </div>

      <Card className="p-6 overflow-x-auto bg-gradient-to-br from-slate-50 to-white">
        {mode === "managers" ? (
          managerRoots.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              {t("aucun_utilisateur_actif_ajoutez_utilisateurs")}
            </p>
          ) : (
            <div className="space-y-6">
              {managerRoots.map((root) => (
                <ManagerNode key={root.id} admin={root} reportsByManager={reportsByManager} level={0} />
              ))}
            </div>
          )
        ) : teamRoots.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">
            {t("aucune_equipe_creee")}
          </p>
        ) : (
          <div className="space-y-6">
            {teamRoots.map((root) => (
              <TeamNode
                key={root.id}
                team={root}
                childTeamsByParent={childTeamsByParent}
                membersByTeam={membersByTeam}
                level={0}
              />
            ))}
            {unassignedMembers.length > 0 && (
              <div className="mt-8 pt-4 border-t border-dashed">
                <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                  Sans équipe ({unassignedMembers.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {unassignedMembers.map((a) => (
                    <MemberPill key={a.id} admin={a} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <p className="text-[11px] text-muted-foreground italic text-center">
        {t("astuce_modifiez_manager_apos_equipe")}
      </p>
    </div>
  );
}

function ManagerNode({
  admin, reportsByManager, level,
}: {
  admin: AdminLite;
  reportsByManager: Map<number, AdminLite[]>;
  level: number;
}) {
  const reports = reportsByManager.get(admin.id) ?? [];
  return (
    <div className="relative" style={{ marginLeft: level === 0 ? 0 : 24 }}>

      {level > 0 && (
        <div className="absolute -left-3 top-0 bottom-0 w-px bg-border" aria-hidden />
      )}

      <AdminCard admin={admin} highlight={reports.length > 0} />

      {reports.length > 0 && (
        <div className="mt-3 pl-6 border-l-2 border-[#0F2D52]/20 space-y-3">
          {reports.map((r) => (
            <ManagerNode key={r.id} admin={r} reportsByManager={reportsByManager} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamNode({
  team, childTeamsByParent, membersByTeam, level,
}: {
  team: TeamLite;
  childTeamsByParent: Map<number, TeamLite[]>;
  membersByTeam: Map<number, AdminLite[]>;
  level: number;
}) {
  const children = childTeamsByParent.get(team.id) ?? [];
  const members = membersByTeam.get(team.id) ?? [];
  return (
    <div style={{ marginLeft: level === 0 ? 0 : 24 }}>
      <div
        className="rounded-lg border-2 overflow-hidden"
        style={{ borderColor: team.color ?? "#0F2D52" }}
      >
        <div
          className="px-4 py-2 flex items-center justify-between gap-2"
          style={{ backgroundColor: `${team.color ?? "#0F2D52"}15` }}
        >
          <h3 className="font-bold text-sm flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" style={{ color: team.color ?? "#0F2D52" }} />
            {team.name}
            <Badge variant="outline" className="text-[10px] ml-1">
              {members.length} membre{members.length > 1 ? "s" : ""}
            </Badge>
          </h3>
          {team.lead && (
            <span className="inline-flex items-center gap-1 text-[11px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
              <Crown className="h-2.5 w-2.5" />
              {team.lead.fullName || team.lead.email}
            </span>
          )}
        </div>
        {members.length > 0 && (
          <div className="p-3 flex flex-wrap gap-2">
            {members.map((m) => (
              <MemberPill key={m.id} admin={m} />
            ))}
          </div>
        )}
      </div>

      {children.length > 0 && (
        <div className="mt-3 pl-6 border-l-2 border-dashed space-y-3" style={{ borderColor: `${team.color ?? "#0F2D52"}66` }}>
          {children.map((c) => (
            <TeamNode
              key={c.id}
              team={c}
              childTeamsByParent={childTeamsByParent}
              membersByTeam={membersByTeam}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AdminCard({ admin, highlight }: { admin: AdminLite; highlight: boolean }) {
  const initials = (admin.fullName || admin.email).split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={`inline-flex items-center gap-3 rounded-lg border bg-white px-3 py-2 shadow-sm ${highlight ? "ring-2 ring-[#0F2D52]/20" : ""}`}>
      <div
        className="h-10 w-10 rounded-full bg-gradient-to-br from-[#0F2D52] to-[#15406d] flex items-center justify-center text-white text-xs font-bold shrink-0"
        style={admin.avatarUrl ? { backgroundImage: `url(${admin.avatarUrl})`, backgroundSize: "cover" } : undefined}
      >
        {!admin.avatarUrl && initials}
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-sm">{admin.fullName || admin.email}</p>
        <p className="text-xs text-muted-foreground">
          {admin.title || admin.position?.name || "—"}
          {admin.department && <span className="ml-1">· {admin.department}</span>}
        </p>
        {admin.customRole && (
          <Badge variant="outline" className="text-[9px] mt-0.5" style={{ borderColor: `${admin.customRole.color ?? "#0F2D52"}66`, color: admin.customRole.color ?? "#0F2D52" }}>
            {admin.customRole.name}
          </Badge>
        )}
      </div>
    </div>
  );
}

function MemberPill({ admin }: { admin: AdminLite }) {
  const initials = (admin.fullName || admin.email).split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="inline-flex items-center gap-2 rounded-full border bg-white pl-1 pr-3 py-1">
      <div
        className="h-6 w-6 rounded-full bg-gradient-to-br from-[#0F2D52] to-[#15406d] flex items-center justify-center text-white text-[10px] font-bold shrink-0"
        style={admin.avatarUrl ? { backgroundImage: `url(${admin.avatarUrl})`, backgroundSize: "cover" } : undefined}
      >
        {!admin.avatarUrl && initials}
      </div>
      <span className="text-xs font-medium truncate max-w-[120px]">{admin.fullName || admin.email}</span>
    </div>
  );
}
