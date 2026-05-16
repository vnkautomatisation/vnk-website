"use client";
// Vue Équipe — 3 sous-onglets : Utilisateurs · Rôles · Postes
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Users, Shield, Briefcase, ChevronLeft, Plus, MoreHorizontal,
  Edit, Trash2, Key, UserX, UserCheck, Mail, Phone, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UserDialog } from "./user-dialog";
import { RoleDialog } from "./role-dialog";
import { PositionDialog } from "./position-dialog";
import { deleteUserAction, updateUserAction } from "@/app/actions/users";
import { deleteRoleAction } from "@/app/actions/roles";
import { deletePositionAction } from "@/app/actions/positions";

export type UserRow = {
  id: number;
  email: string;
  fullName: string | null;
  isActive: boolean;
  avatarUrl: string | null;
  title: string | null;
  department: string | null;
  phone: string | null;
  startDate: string | null;
  endDate: string | null;
  lastLogin: string | null;
  twoFactorEnabled: boolean;
  createdAt: string;
  roleId: number | null;
  positionId: number | null;
  customRole: { id: number; name: string; color: string | null } | null;
  position: { id: number; name: string; color: string | null } | null;
};

export type RoleRow = {
  id: number;
  name: string;
  description: string | null;
  permissions: Record<string, string[]>;
  isSystem: boolean;
  color: string | null;
  sortOrder: number;
  _count: { admins: number; positions: number };
};

export type PositionRow = {
  id: number;
  name: string;
  description: string | null;
  defaultRoleId: number | null;
  defaultDepartment: string | null;
  color: string | null;
  isSystem: boolean;
  sortOrder: number;
  defaultRole: { id: number; name: string; color: string | null } | null;
  _count: { admins: number };
};

type Tab = "users" | "roles" | "positions";

export function TeamView({
  users, roles, positions, currentAdminId,
}: {
  users: UserRow[];
  roles: RoleRow[];
  positions: PositionRow[];
  currentAdminId: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("users");

  // Dialogs
  const [userDialog, setUserDialog] = useState<{ open: boolean; user: UserRow | null }>({ open: false, user: null });
  const [roleDialog, setRoleDialog] = useState<{ open: boolean; role: RoleRow | null }>({ open: false, role: null });
  const [positionDialog, setPositionDialog] = useState<{ open: boolean; position: PositionRow | null }>({ open: false, position: null });
  const [confirmDelete, setConfirmDelete] = useState<
    | { type: "user"; id: number; label: string }
    | { type: "role"; id: number; label: string }
    | { type: "position"; id: number; label: string }
    | null
  >(null);

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const { type, id, label } = confirmDelete;
    let result: { success: boolean; error?: string };
    if (type === "user") result = await deleteUserAction({ id });
    else if (type === "role") result = await deleteRoleAction({ id });
    else result = await deletePositionAction({ id });

    if (result.success) {
      toast.success(`${label} supprimé`);
      router.refresh();
    } else {
      toast.error(result.error || "Erreur lors de la suppression");
    }
    setConfirmDelete(null);
  };

  const handleToggleActive = async (user: UserRow) => {
    const result = await updateUserAction({ id: user.id, isActive: !user.isActive });
    if (result.success) {
      toast.success(user.isActive ? "Utilisateur désactivé" : "Utilisateur réactivé");
      router.refresh();
    } else {
      toast.error(result.error || "Erreur");
    }
  };

  const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }>; count: number }[] = [
    { key: "users", label: "Utilisateurs", icon: Users, count: users.length },
    { key: "roles", label: "Rôles", icon: Shield, count: roles.length },
    { key: "positions", label: "Postes", icon: Briefcase, count: positions.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          href="/admin/settings"
          className="mt-1 text-muted-foreground hover:text-foreground"
          aria-label="Retour"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-rose-500 shrink-0">
          <Users className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Équipe</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Comptes employés, rôles d&apos;accès et postes templates
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 transition-colors",
                  active
                    ? "border-[#0F2D52] text-[#0F2D52]"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
                <Badge variant="secondary" className="text-[10px] ml-1">{t.count}</Badge>
              </button>
            );
          })}
        </div>
      </div>

      {/* USERS */}
      {tab === "users" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {users.filter((u) => u.isActive).length} actif{users.filter((u) => u.isActive).length > 1 ? "s" : ""} sur {users.length}
            </p>
            <Button onClick={() => setUserDialog({ open: true, user: null })} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
              <Plus className="h-4 w-4 mr-1.5" />
              Nouvel utilisateur
            </Button>
          </div>

          <Card>
            <div className="divide-y">
              {users.map((u) => {
                const isMe = u.id === currentAdminId;
                return (
                  <div key={u.id} className={cn("flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors", !u.isActive && "opacity-60")}>
                    {/* Avatar */}
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0"
                      style={{ backgroundColor: u.position?.color ?? u.customRole?.color ?? "#0F2D52" }}
                    >
                      {u.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                      ) : (
                        (u.fullName || u.email).charAt(0).toUpperCase()
                      )}
                    </div>

                    {/* Identité */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{u.fullName || u.email}</p>
                        {isMe && <Badge variant="secondary" className="text-[10px]">Vous</Badge>}
                        {!u.isActive && <Badge className="text-[10px] bg-gray-500 hover:bg-gray-500">Désactivé</Badge>}
                        {u.twoFactorEnabled && <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">2FA</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{u.email}</span>
                        {u.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{u.phone}</span>}
                        {u.department && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{u.department}</span>}
                      </div>
                    </div>

                    {/* Poste/Rôle */}
                    <div className="hidden md:flex flex-col items-end gap-1 shrink-0">
                      {u.position && (
                        <Badge variant="outline" className="text-[10px]" style={{ borderColor: u.position.color ?? undefined, color: u.position.color ?? undefined }}>
                          {u.position.name}
                        </Badge>
                      )}
                      {u.customRole && (
                        <span className="text-[10px] text-muted-foreground font-mono">{u.customRole.name}</span>
                      )}
                    </div>

                    {/* Last login */}
                    <div className="hidden lg:block text-xs text-muted-foreground shrink-0 w-32 text-right">
                      {u.lastLogin
                        ? `Vu ${new Date(u.lastLogin).toLocaleDateString("fr-CA", { day: "numeric", month: "short" })}`
                        : "Jamais connecté"}
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setUserDialog({ open: true, user: u })}>
                          <Edit className="h-4 w-4 mr-2" />Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setUserDialog({ open: true, user: { ...u, isActive: u.isActive } satisfies UserRow })}>
                          <Key className="h-4 w-4 mr-2" />Réinitialiser le mot de passe
                        </DropdownMenuItem>
                        {!isMe && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleToggleActive(u)}>
                              {u.isActive ? (
                                <><UserX className="h-4 w-4 mr-2" />Désactiver</>
                              ) : (
                                <><UserCheck className="h-4 w-4 mr-2" />Réactiver</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setConfirmDelete({ type: "user", id: u.id, label: u.fullName || u.email })}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />Supprimer
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ROLES */}
      {tab === "roles" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {roles.filter((r) => r.isSystem).length} rôle{roles.filter((r) => r.isSystem).length > 1 ? "s" : ""} système · {roles.filter((r) => !r.isSystem).length} personnalisé{roles.filter((r) => !r.isSystem).length > 1 ? "s" : ""}
            </p>
            <Button onClick={() => setRoleDialog({ open: true, role: null })} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
              <Plus className="h-4 w-4 mr-1.5" />
              Nouveau rôle
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {roles.map((r) => {
              const permCount = Object.values(r.permissions).reduce((sum, arr) => sum + arr.length, 0);
              const resourceCount = Object.keys(r.permissions).length;
              return (
                <Card key={r.id} className="vnk-card-hover">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-9 w-9 rounded-lg flex items-center justify-center text-white shrink-0" style={{ backgroundColor: r.color ?? "#0F2D52" }}>
                          <Shield className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{r.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {resourceCount} ressources · {permCount} permissions
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setRoleDialog({ open: true, role: r })}>
                            <Edit className="h-4 w-4 mr-2" />{r.isSystem ? "Voir / Éditer" : "Modifier"}
                          </DropdownMenuItem>
                          {!r.isSystem && (
                            <DropdownMenuItem
                              onClick={() => setConfirmDelete({ type: "role", id: r.id, label: r.name })}
                              className="text-red-600 focus:text-red-600"
                              disabled={r._count.admins > 0 || r._count.positions > 0}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />Supprimer
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {r.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{r.description}</p>}

                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {r.isSystem && <Badge variant="secondary" className="text-[9px]">Système</Badge>}
                      <Badge variant="outline" className="text-[9px]">{r._count.admins} utilisateur{r._count.admins > 1 ? "s" : ""}</Badge>
                      {r._count.positions > 0 && <Badge variant="outline" className="text-[9px]">{r._count.positions} poste{r._count.positions > 1 ? "s" : ""}</Badge>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* POSITIONS */}
      {tab === "positions" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {positions.filter((p) => p.isSystem).length} poste{positions.filter((p) => p.isSystem).length > 1 ? "s" : ""} système · {positions.filter((p) => !p.isSystem).length} personnalisé{positions.filter((p) => !p.isSystem).length > 1 ? "s" : ""}
            </p>
            <Button onClick={() => setPositionDialog({ open: true, position: null })} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
              <Plus className="h-4 w-4 mr-1.5" />
              Nouveau poste
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {positions.map((p) => (
              <Card key={p.id} className="vnk-card-hover">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-9 w-9 rounded-lg flex items-center justify-center text-white shrink-0" style={{ backgroundColor: p.color ?? "#0F2D52" }}>
                        <Briefcase className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {p.defaultDepartment ?? "Sans département"}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setPositionDialog({ open: true, position: p })}>
                          <Edit className="h-4 w-4 mr-2" />Modifier
                        </DropdownMenuItem>
                        {!p.isSystem && (
                          <DropdownMenuItem
                            onClick={() => setConfirmDelete({ type: "position", id: p.id, label: p.name })}
                            className="text-red-600 focus:text-red-600"
                            disabled={p._count.admins > 0}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />Supprimer
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {p.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{p.description}</p>}

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {p.isSystem && <Badge variant="secondary" className="text-[9px]">Système</Badge>}
                    {p.defaultRole && (
                      <Badge variant="outline" className="text-[9px]" style={{ borderColor: p.defaultRole.color ?? undefined, color: p.defaultRole.color ?? undefined }}>
                        {p.defaultRole.name}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[9px]">{p._count.admins} utilisateur{p._count.admins > 1 ? "s" : ""}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <UserDialog
        open={userDialog.open}
        onOpenChange={(open) => setUserDialog({ open, user: open ? userDialog.user : null })}
        user={userDialog.user}
        roles={roles}
        positions={positions}
        onSaved={() => router.refresh()}
      />
      <RoleDialog
        open={roleDialog.open}
        onOpenChange={(open) => setRoleDialog({ open, role: open ? roleDialog.role : null })}
        role={roleDialog.role}
        onSaved={() => router.refresh()}
      />
      <PositionDialog
        open={positionDialog.open}
        onOpenChange={(open) => setPositionDialog({ open, position: open ? positionDialog.position : null })}
        position={positionDialog.position}
        roles={roles}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Supprimer ${confirmDelete?.label} ?`}
        description={
          confirmDelete?.type === "user"
            ? "L'utilisateur sera désactivé et toutes ses sessions seront fermées. Cette action peut être annulée en réactivant le compte."
            : "Cette action est irréversible."
        }
        confirmLabel="Supprimer"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
