"use client";
// Vue Équipes — création, hiérarchie, lead, assignation membres.
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Network, Plus, Edit, Trash2, Users as UsersIcon, Crown, GitBranch, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createTeamAction, updateTeamAction, deleteTeamAction, assignAdminToTeamAction } from "@/app/actions/teams";

type AdminLite = {
  id: number;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  teamId: number | null;
  managerId: number | null;
  position: { name: string; color: string | null } | null;
};
type TeamRow = {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  leadAdminId: number | null;
  parentTeamId: number | null;
  sortOrder: number;
  lead: { id: number; fullName: string | null; email: string; avatarUrl: string | null } | null;
  parent: { id: number; name: string } | null;
  members: Array<{ id: number; fullName: string | null; email: string; avatarUrl: string | null; isActive: boolean; position: { name: string; color: string | null } | null }>;
  _count: { members: number; children: number };
};

export function TeamsView({ teams, admins }: { teams: TeamRow[]; admins: AdminLite[] }) {
  const t = useTranslations("admin.teams");
  const tc = useTranslations("common");
  const router = useRouter();
  const [dialog, setDialog] = useState<{ open: boolean; team: TeamRow | null }>({ open: false, team: null });
  const [confirmDel, setConfirmDel] = useState<TeamRow | null>(null);
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; team: TeamRow | null }>({ open: false, team: null });

  const onDelete = async () => {
    if (!confirmDel) return;
    const r = await deleteTeamAction({ id: confirmDel.id });
    if (r.success) { toast.success(t("equipe_supprimee")); router.refresh(); }
    else toast.error(r.error || t("erreur"));
    setConfirmDel(null);
  };

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Network className="h-5 w-5 text-[#0F2D52]" />
            {t("equipes")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {teams.length} équipe{teams.length > 1 ? "s" : ""} · structurez la hiérarchie de votre organisation
          </p>
        </div>
        <Button onClick={() => setDialog({ open: true, team: null })}>
          <Plus className="h-4 w-4 mr-1.5" />
          {t("nouvelle_equipe")}
        </Button>
      </div>

      {teams.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          {t("aucune_equipe_creee_commencez_creer")}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {teams.map((team) => (
            <Card key={team.id} className="overflow-hidden">
              <div
                className="h-1.5"
                style={{ backgroundColor: team.color ?? "#0F2D52" }}
              />
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm flex items-center gap-1.5">
                      {team.name}
                      {team.parent && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <GitBranch className="h-2.5 w-2.5" />
                          {team.parent.name}
                        </Badge>
                      )}
                    </h3>
                    {team.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{team.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialog({ open: true, team: team })} aria-label={tc("edit")}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setConfirmDel(team)} aria-label={tc("delete")}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {team.lead && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 border border-amber-200">
                    <Crown className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wider text-amber-700 font-semibold">{t("chef_apos_equipe")}</p>
                      <p className="text-xs font-medium truncate">{team.lead.fullName || team.lead.email}</p>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      Membres ({team._count.members})
                    </p>
                    <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={() => setAssignDialog({ open: true, team: team })}>
                      <UsersIcon className="h-3 w-3 mr-1" />
                      {t("gerer")}
                    </Button>
                  </div>
                  {team.members.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">{t("aucun_membre")}</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {team.members.slice(0, 6).map((m) => (
                        <Link
                          key={m.id}
                          href={`/admin/employes/${m.id}/dossier`}
                          className="h-7 w-7 rounded-full bg-gradient-to-br from-[#0F2D52] to-[#15406d] flex items-center justify-center text-white text-[10px] font-semibold ring-2 ring-white hover:ring-amber-400 transition"
                          title={`Voir le dossier — ${m.fullName || m.email}`}
                          style={m.avatarUrl ? { backgroundImage: `url(${m.avatarUrl})`, backgroundSize: "cover" } : undefined}
                        >
                          {!m.avatarUrl && (m.fullName || m.email).split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                        </Link>
                      ))}
                      {team.members.length > 6 && (
                        <div className="h-7 px-2 rounded-full bg-muted flex items-center text-[10px] font-medium text-muted-foreground">
                          +{team.members.length - 6}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <TeamDialog
        open={dialog.open}
        team={dialog.team}
        teams={teams}
        admins={admins}
        onClose={() => setDialog({ open: false, team: null })}
        onSaved={() => router.refresh()}
      />

      <AssignMembersDialog
        open={assignDialog.open}
        team={assignDialog.team}
        admins={admins}
        onClose={() => setAssignDialog({ open: false, team: null })}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(o) => !o && setConfirmDel(null)}
        title={`Supprimer ${confirmDel?.name} ?`}
        description={t("membres_sous_equipes_seront_detaches")}
        confirmLabel={tc("delete")}
        variant="destructive"
        onConfirm={onDelete}
      />
    </div>
  );
}

function TeamDialog({
  open, team, teams, admins, onClose, onSaved,
}: {
  open: boolean;
  team: TeamRow | null;
  teams: TeamRow[];
  admins: AdminLite[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.teams");
  const tc = useTranslations("common");
  const [name, setName] = useState(team?.name ?? "");
  const [description, setDescription] = useState(team?.description ?? "");
  const [color, setColor] = useState(team?.color ?? "#0F2D52");
  const [leadId, setLeadId] = useState(team?.leadAdminId ? String(team.leadAdminId) : "none");
  const [parentId, setParentId] = useState(team?.parentTeamId ? String(team.parentTeamId) : "none");
  const [pending, setPending] = useState(false);


  useEffect(() => {
    if (open) {
      setName(team?.name ?? "");
      setDescription(team?.description ?? "");
      setColor(team?.color ?? "#0F2D52");
      setLeadId(team?.leadAdminId ? String(team.leadAdminId) : "none");
      setParentId(team?.parentTeamId ? String(team.parentTeamId) : "none");
    }
  }, [open, team]);

  const submit = async () => {
    if (!name.trim()) { toast.error(t("nom_requis")); return; }
    setPending(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      color,
      leadAdminId: leadId === "none" ? null : Number(leadId),
      parentTeamId: parentId === "none" ? null : Number(parentId),
    };
    const r = team
      ? await updateTeamAction({ id: team.id, ...payload })
      : await createTeamAction(payload);
    setPending(false);
    if (r.success) {
      toast.success(team ? t("equipe_modifiee") : t("equipe_creee"));
      onSaved();
      onClose();
    } else toast.error(r.error || t("erreur"));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Network className="h-4 w-4" />
              {team ? t("modifier_equipe") : t("nouvelle_equipe")}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {t("equipe_regroupe_membres_objectif_commun")}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">{t("nom")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("comptabilite_ventes")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">{t("description")}</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
              placeholder={t("role_mission_contexte")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{t("couleur")}</Label>
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 cursor-pointer" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{t("equipe_parent")}</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={t("aucune")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("aucune_top_level")}</SelectItem>
                  {teams.filter((o) => o.id !== team?.id).map((o) => (
                    <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">{t("chef_apos_equipe")}</Label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={tc("none")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("aucun")}</SelectItem>
                {admins.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.fullName || a.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>{tc("cancel")}</Button>
          <Button onClick={submit} disabled={pending || !name.trim()}>
            {pending ? "..." : team ? t("enregistrer") : t("creer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignMembersDialog({
  open, team, admins, onClose, onSaved,
}: {
  open: boolean;
  team: TeamRow | null;
  admins: AdminLite[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.teams");
  const tc = useTranslations("common");
  const [pending, setPending] = useState(false);

  if (!team) return null;
  const memberIds = new Set(team.members.map((m) => m.id));

  const toggleMember = async (adminId: number, isMember: boolean) => {
    setPending(true);
    const r = await assignAdminToTeamAction({
      adminId,
      teamId: isMember ? null : team.id,
    });
    setPending(false);
    if (r.success) {
      toast.success(isMember ? t("membre_retire") : t("membre_ajoute"));
      onSaved();
    } else toast.error(r.error || t("erreur"));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <UsersIcon className="h-4 w-4" />
              Membres de « {team.name} »
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {t("activez_desactivez_membres_employe_ne")}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-1">
          {admins.map((a) => {
            const isMember = memberIds.has(a.id);
            const inOtherTeam = a.teamId != null && a.teamId !== team.id;
            return (
              <label
                key={a.id}
                className={`flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 cursor-pointer ${isMember ? "bg-emerald-50" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={isMember}
                  disabled={pending}
                  onChange={() => toggleMember(a.id, isMember)}
                  className="h-4 w-4 rounded border-input"
                />
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#0F2D52] to-[#15406d] flex items-center justify-center text-white text-[11px] font-semibold ring-2 ring-white shrink-0">
                  {(a.fullName || a.email).split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.fullName || a.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.position?.name || a.email}</p>
                </div>
                {inOtherTeam && (
                  <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">
                    {t("autre_equipe")}
                  </Badge>
                )}
                <Link
                  href={`/admin/employes/${a.id}/dossier`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[11px] inline-flex items-center gap-1 text-[#0F2D52] hover:underline shrink-0"
                  title={t("voir_dossier")}
                >
                  <FolderOpen className="h-3 w-3" />
                  {t("dossier")}
                </Link>
              </label>
            );
          })}
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose}>{tc("close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
