"use client";
// Vue Équipe — 3 sous-onglets : Utilisateurs · Rôles · Postes
import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Users, Shield, Briefcase, Plus, MoreHorizontal,
  Edit, Trash2, Key, UserX, UserCheck, Mail, Phone, Building2,
  Search, X, ArrowUpDown, ArrowUp, ArrowDown, Clock,
  Send, RotateCcw, Ban, Copy, Hourglass, AlertTriangle, FileDown,
  FolderOpen, FileText,
} from "lucide-react";
import { PdfPreviewModal } from "@/components/admin/pdf-preview-modal";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SettingsPageShell } from "@/components/admin/settings-page-shell";
import { SettingsTabs, type TabItem } from "@/components/admin/settings-tabs";
import { UserDialog } from "./user-dialog";
import { RoleDialog } from "./role-dialog";
import { PositionDialog } from "./position-dialog";
import { UserDetailDrawer } from "./user-detail-drawer";
import { Checkbox } from "@/components/ui/checkbox";
import { deleteUserAction, updateUserAction, bulkUpdateUsersAction, resendInvitationAction, revokeInvitationAction, bulkInviteUsersAction } from "@/app/actions/users";
import { deleteRoleAction, reorderRolesAction, duplicateRoleAction } from "@/app/actions/roles";
import { deletePositionAction, reorderPositionsAction } from "@/app/actions/positions";

// ── Tri utilisateurs ──────────────────────────────────────
type UserSortKey = "name" | "department" | "role" | "lastLogin" | "createdAt";
type SortDir = "asc" | "desc";
const USER_SORT_OPTIONS: { key: UserSortKey; label: string }[] = [
  { key: "name", label: "Nom" },
  { key: "department", label: "Département" },
  { key: "role", label: "Rôle" },
  { key: "lastLogin", label: "Dernière connexion" },
  { key: "createdAt", label: "Date de création" },
];

// ── Compte dormant : actif mais pas connecté depuis >30j ──
function isDormant(u: { isActive: boolean; lastLogin: string | null; createdAt: string }): boolean {
  if (!u.isActive) return false;
  const last = u.lastLogin ? new Date(u.lastLogin).getTime() : new Date(u.createdAt).getTime();
  return Date.now() - last > 30 * 24 * 60 * 60 * 1000;
}

// ── Présence dérivée du lastLogin + presenceStatus ───────
function getPresence(u: { lastLogin: string | null; presenceStatus: string | null }): {
  color: string;
  label: string;
} {
  if (u.presenceStatus === "vacation") return { color: "bg-amber-500", label: "En vacances" };
  if (u.presenceStatus === "offline") return { color: "bg-gray-400", label: "Hors ligne" };
  if (u.presenceStatus === "meeting") return { color: "bg-purple-500", label: "En réunion" };
  if (u.presenceStatus === "focus") return { color: "bg-blue-500", label: "Concentré" };
  if (!u.lastLogin) return { color: "bg-gray-300", label: "Jamais connecté" };
  const min = Math.floor((Date.now() - new Date(u.lastLogin).getTime()) / 60_000);
  if (min < 15) return { color: "bg-emerald-500", label: "En ligne" };
  if (min < 60) return { color: "bg-amber-400", label: "Récemment actif" };
  if (min < 60 * 24) return { color: "bg-gray-400", label: "Inactif aujourd'hui" };
  return { color: "bg-gray-300", label: "Hors ligne" };
}

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
  presenceStatus: string | null;
  presenceUntil: string | null;
  recoveryEmail: string | null;
  loginAlertsEnabled: boolean;
  defaultLanding: string | null;
  bio: string | null;
  internalNotes: string | null;
  // Genre + civilité pour accord grammatical FR-CA dans documents PDF
  civility: string | null;          // "M." | "Mme" | "Mx" | null
  gender: string | null;            // "male" | "female" | "non_binary" | "prefer_not_to_say" | null
  preferredPronouns: string | null; // ex "il/lui", "elle/elle", "iel/iel" (override custom)
  createdAt: string;
  updatedAt: string;
  roleId: number | null;
  positionId: number | null;
  teamId?: number | null;
  managerId?: number | null;
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

export type InvitationRow = {
  id: number;
  email: string;
  fullName: string | null;
  title: string | null;
  department: string | null;
  roleId: number | null;
  positionId: number | null;
  expiresAt: string;
  createdAt: string;
  invitedById: number;
};

type Tab = "users" | "roles" | "positions";

export function TeamView({
  users, roles, positions, invitations = [], currentAdminId,
  defaultTab = "users", hideTabs = false,
}: {
  users: UserRow[];
  roles: RoleRow[];
  positions: PositionRow[];
  invitations?: InvitationRow[];
  currentAdminId: number;
  defaultTab?: Tab;
  hideTabs?: boolean;
}) {
  const tc = useTranslations("common");
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string; description?: string; filename?: string } | null>(null);

  // Recherche / filtres / tri
  const [search, setSearch] = useState("");
  const [filterRoleId, setFilterRoleId] = useState<string>("all");
  const [filterPositionId, setFilterPositionId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [quickFilter, setQuickFilter] = useState<"none" | "no2fa" | "dormant" | "never" | "norole">("none");
  const [sortKey, setSortKey] = useState<UserSortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  // Tri multi-colonnes : critères secondaires (Shift+clic pour ajouter)
  const [secondarySorts, setSecondarySorts] = useState<Array<{ key: UserSortKey; dir: SortDir }>>([]);

  // Liste des départements connus (déduits des utilisateurs existants)
  const knownDepartments = useMemo(() => {
    const s = new Set<string>();
    for (const u of users) if (u.department) s.add(u.department);
    return Array.from(s).sort();
  }, [users]);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Dialogs
  const [userDialog, setUserDialog] = useState<{ open: boolean; user: UserRow | null; initialTab?: "info" | "password" }>({ open: false, user: null });
  const [roleDialog, setRoleDialog] = useState<{ open: boolean; role: RoleRow | null }>({ open: false, role: null });
  const [positionDialog, setPositionDialog] = useState<{ open: boolean; position: PositionRow | null }>({ open: false, position: null });

  // Drawer fiche détaillée user
  const [detailDrawer, setDetailDrawer] = useState<{ open: boolean; userId: number | null }>({ open: false, userId: null });

  // Sélection bulk
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const handleBulkAction = (action: "activate" | "deactivate" | "delete", reassignToAdminId?: number | null) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    // Construit la map id → updatedAt depuis le state local (snapshot au moment de la sélection)
    const expectedUpdatedAts: Record<string, string> = {};
    for (const u of users) {
      if (ids.includes(u.id) && u.updatedAt) {
        expectedUpdatedAts[String(u.id)] = u.updatedAt;
      }
    }
    bulkUpdateUsersAction({ userIds: ids, action, reassignToAdminId: reassignToAdminId ?? null, expectedUpdatedAts }).then((r) => {
      if (r.success && "data" in r) {
        const parts: string[] = [`${r.data.updated} utilisateur(s) ${action === "activate" ? "activé(s)" : action === "deactivate" ? "désactivé(s)" : "supprimé(s)"}`];
        if (r.data.reassigned) {
          if (r.data.reassigned.timeEntries > 0) parts.push(`${r.data.reassigned.timeEntries} saisie(s) de temps transférée(s)`);
          if (r.data.reassigned.notifications > 0) parts.push(`${r.data.reassigned.notifications} notification(s) transférée(s)`);
        }
        toast.success(parts.join(" · "));
        setSelectedIds(new Set());
        setBulkReassignToId("none");
        router.refresh();
      } else if (!r.success) {
        toast.error(r.error);
      }
    });
  };

  const handleBulkAssignRole = (newRoleId: number | null) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const expectedUpdatedAts: Record<string, string> = {};
    for (const u of users) {
      if (ids.includes(u.id) && u.updatedAt) expectedUpdatedAts[String(u.id)] = u.updatedAt;
    }
    bulkUpdateUsersAction({
      userIds: ids,
      action: "assign_role",
      roleId: newRoleId,
      expectedUpdatedAts,
    }).then((r) => {
      if (r.success && "data" in r) {
        const roleName = newRoleId ? roles.find((x) => x.id === newRoleId)?.name : "aucun";
        toast.success(`${r.data.updated} utilisateur(s) → rôle « ${roleName} »`);
        setSelectedIds(new Set());
        router.refresh();
      } else if (!r.success) {
        toast.error(r.error);
      }
    });
  };

  const handleBulkExportCSV = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const selected = users.filter((u) => ids.includes(u.id));
    const headers = ["ID", "Email", "Nom complet", "Téléphone", "Département", "Titre", "Poste", "Rôle", "Statut", "2FA", "Dernière connexion", "Créé le"];
    const rows = selected.map((u) => [
      u.id,
      u.email,
      u.fullName ?? "",
      u.phone ?? "",
      u.department ?? "",
      u.title ?? "",
      u.position?.name ?? "",
      u.customRole?.name ?? "",
      u.isActive ? "Actif" : "Désactivé",
      u.twoFactorEnabled ? "Oui" : "Non",
      u.lastLogin ? new Date(u.lastLogin).toISOString() : "",
      new Date(u.createdAt).toISOString(),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }); // BOM pour Excel
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vnk-equipe-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${selected.length} utilisateur(s) exporté(s)`);
  };

  const [bulkConfirmDelete, setBulkConfirmDelete] = useState(false);
  const [bulkReassignToId, setBulkReassignToId] = useState<string>("none");

  // Invitations actions
  const handleResendInvite = async (id: number, email: string) => {
    const r = await resendInvitationAction({ id });
    if (r.success && "data" in r) {
      if (r.data.emailSent) {
        toast.success(`Email renvoyé à ${email}`, {
          action: {
            label: "Copier lien",
            onClick: () => {
              navigator.clipboard.writeText(r.data.inviteUrl);
              toast.success("Lien copié");
            },
          },
        });
      } else {
        // Email échoué — proposer copie immédiate
        navigator.clipboard.writeText(r.data.inviteUrl);
        toast.warning("Email non envoyé — lien copié dans le presse-papiers", {
          description: r.data.emailError ?? "Transmettez-le manuellement.",
          duration: 10000,
        });
      }
      router.refresh();
    } else if (!r.success) {
      toast.error(r.error || "Erreur");
    }
  };
  const handleCopyInviteLink = async (id: number) => {
    // Régénère le token (le précédent est invalidé) pour copier un lien frais
    const r = await resendInvitationAction({ id });
    if (r.success && "data" in r) {
      navigator.clipboard.writeText(r.data.inviteUrl);
      toast.success("Nouveau lien copié", {
        description: "L'ancien lien est invalidé. Validité : 7 jours.",
      });
      router.refresh();
    } else if (!r.success) {
      toast.error(r.error || "Erreur");
    }
  };
  const handleRevokeInvite = async (id: number) => {
    const r = await revokeInvitationAction({ id });
    if (r.success) { toast.success("Invitation révoquée"); router.refresh(); }
    else toast.error(r.error || "Erreur");
  };

  // Dupliquer un rôle
  const handleDuplicateRole = async (sourceRole: RoleRow) => {
    const newName = window.prompt(
      `Code du nouveau rôle (lettres minuscules + _ uniquement) :`,
      `${sourceRole.name}_copie`
    );
    if (!newName) return;
    const r = await duplicateRoleAction({ sourceId: sourceRole.id, newName });
    if (r.success) {
      toast.success(`Rôle dupliqué : ${newName}`);
      router.refresh();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  // Réordonnement rôles/postes (move up/down)
  const moveRole = async (id: number, direction: "up" | "down") => {
    const sorted = [...roles].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((r) => r.id === id);
    if (idx === -1) return;
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= sorted.length) return;
    const newOrder = [...sorted];
    [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
    const r = await reorderRolesAction({ orderedIds: newOrder.map((x) => x.id) });
    if (r.success) router.refresh();
    else toast.error(r.error || "Erreur");
  };
  const movePosition = async (id: number, direction: "up" | "down") => {
    const sorted = [...positions].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= sorted.length) return;
    const newOrder = [...sorted];
    [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
    const r = await reorderPositionsAction({ orderedIds: newOrder.map((x) => x.id) });
    if (r.success) router.refresh();
    else toast.error(r.error || "Erreur");
  };
  const [confirmDelete, setConfirmDelete] = useState<
    | { type: "user"; id: number; label: string }
    | { type: "role"; id: number; label: string }
    | { type: "position"; id: number; label: string }
    | null
  >(null);

  // Offboarding wizard — sélection successeur + checklist
  const [offboardingReassign, setOffboardingReassign] = useState<string>("none");
  const [offboardingChecklist, setOffboardingChecklist] = useState<Record<string, boolean>>({});

  // Bulk invite dialog
  const [bulkInviteOpen, setBulkInviteOpen] = useState(false);
  const [bulkInviteEmails, setBulkInviteEmails] = useState("");
  const [bulkInviteMode, setBulkInviteMode] = useState<"paste" | "edit">("paste");
  // Mode édition : entrées individuelles avec email + fullName
  const [bulkInviteEntries, setBulkInviteEntries] = useState<Array<{ email: string; fullName: string }>>([]);
  const [bulkInviteRoleId, setBulkInviteRoleId] = useState<string>("none");
  const [bulkInvitePositionId, setBulkInvitePositionId] = useState<string>("none");
  const [bulkInvitePending, setBulkInvitePending] = useState(false);
  const [bulkInviteResult, setBulkInviteResult] = useState<{ invited: number; skipped: Array<{ email: string; reason: string }> } | null>(null);

  // Pass from paste → edit en parsant le textarea
  const goToEditMode = () => {
    const emails = bulkInviteEmails
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && e.includes("@"));
    if (emails.length === 0) { toast.error("Aucune adresse email détectée"); return; }
    if (emails.length > 50) { toast.error("Maximum 50 emails"); return; }
    const guess = (email: string) =>
      email.split("@")[0].split(/[.\-_]/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join(" ");
    const dedup = Array.from(new Set(emails.map((e) => e.toLowerCase())));
    setBulkInviteEntries(dedup.map((email) => ({ email, fullName: guess(email) })));
    setBulkInviteMode("edit");
  };

  const handleBulkInvite = async () => {
    setBulkInvitePending(true);
    setBulkInviteResult(null);
    try {
      let payload: { emails?: string[]; entries?: Array<{ email: string; fullName: string }>; roleId?: number | null; positionId?: number | null };

      if (bulkInviteMode === "edit") {
        const valid = bulkInviteEntries.filter((e) => e.email.includes("@"));
        if (valid.length === 0) { toast.error("Aucune ligne valide"); setBulkInvitePending(false); return; }
        payload = {
          entries: valid,
          roleId: bulkInviteRoleId !== "none" ? Number(bulkInviteRoleId) : null,
          positionId: bulkInvitePositionId !== "none" ? Number(bulkInvitePositionId) : null,
        };
      } else {
        const emails = bulkInviteEmails
          .split(/[\s,;]+/)
          .map((e) => e.trim())
          .filter((e) => e.length > 0 && e.includes("@"));
        if (emails.length === 0) { toast.error("Aucune adresse"); setBulkInvitePending(false); return; }
        if (emails.length > 50) { toast.error("Max 50"); setBulkInvitePending(false); return; }
        payload = {
          emails,
          roleId: bulkInviteRoleId !== "none" ? Number(bulkInviteRoleId) : null,
          positionId: bulkInvitePositionId !== "none" ? Number(bulkInvitePositionId) : null,
        };
      }

      const r = await bulkInviteUsersAction(payload);
      if (r.success) {
        setBulkInviteResult(r.data);
        if (r.data.invited > 0) {
          toast.success(`${r.data.invited} invitation${r.data.invited > 1 ? "s" : ""} envoyée${r.data.invited > 1 ? "s" : ""}`);
          router.refresh();
        }
        if (r.data.skipped.length > 0 && r.data.invited === 0) {
          toast.error(`Aucune invitation envoyée — voir détails`);
        }
      } else {
        toast.error(r.error || "Erreur");
      }
    } finally {
      setBulkInvitePending(false);
    }
  };

  // ── Listes filtrées + triées ──
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = users.filter((u) => {
      if (filterStatus === "active" && !u.isActive) return false;
      if (filterStatus === "inactive" && u.isActive) return false;
      if (filterRoleId !== "all" && u.roleId?.toString() !== filterRoleId) return false;
      if (filterPositionId !== "all" && u.positionId?.toString() !== filterPositionId) return false;
      // Quick filters
      if (quickFilter === "no2fa" && (u.twoFactorEnabled || !u.isActive)) return false;
      if (quickFilter === "dormant" && !isDormant(u)) return false;
      if (quickFilter === "never" && (u.lastLogin || !u.isActive)) return false;
      if (quickFilter === "norole" && (u.roleId !== null || !u.isActive)) return false;
      if (!q) return true;
      return (
        (u.fullName ?? "").toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone ?? "").toLowerCase().includes(q) ||
        (u.department ?? "").toLowerCase().includes(q) ||
        (u.title ?? "").toLowerCase().includes(q) ||
        (u.position?.name ?? "").toLowerCase().includes(q) ||
        (u.customRole?.name ?? "").toLowerCase().includes(q)
      );
    });
    // ── Tri multi-colonnes : critère principal + critères secondaires ──
    const getValue = (u: UserRow, key: UserSortKey): string | number => {
      switch (key) {
        case "name": return (u.fullName ?? u.email).toLowerCase();
        case "department": return (u.department ?? "zzz").toLowerCase();
        case "role": return (u.customRole?.name ?? "zzz").toLowerCase();
        case "lastLogin": return u.lastLogin ? new Date(u.lastLogin).getTime() : 0;
        case "createdAt": return new Date(u.createdAt).getTime();
      }
    };
    const sortChain: Array<{ key: UserSortKey; dir: SortDir }> = [
      { key: sortKey, dir: sortDir },
      ...secondarySorts.filter((s) => s.key !== sortKey),
    ];
    result = [...result].sort((a, b) => {
      for (const { key, dir } of sortChain) {
        const av = getValue(a, key);
        const bv = getValue(b, key);
        const mult = dir === "asc" ? 1 : -1;
        if (av < bv) return -1 * mult;
        if (av > bv) return 1 * mult;
      }
      return 0;
    });
    return result;
  }, [users, search, filterStatus, filterRoleId, filterPositionId, quickFilter, sortKey, sortDir, secondarySorts]);

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q)
    );
  }, [roles, search]);

  const filteredPositions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return positions;
    return positions.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        (p.defaultDepartment ?? "").toLowerCase().includes(q) ||
        (p.defaultRole?.name ?? "").toLowerCase().includes(q)
    );
  }, [positions, search]);

  const hasActiveFilter =
    !!search ||
    filterStatus !== "all" ||
    filterRoleId !== "all" ||
    filterPositionId !== "all" ||
    quickFilter !== "none";

  // Reset page si les filtres changent (sinon on peut se retrouver sur une page vide)
  useEffect(() => {
    setPage(1);
  }, [search, filterStatus, filterRoleId, filterPositionId, quickFilter, sortKey, sortDir]);

  // ── Raccourcis clavier globaux ──
  //   N    → ouvrir le dialogue "Nouvel utilisateur"
  //   /    → focus la recherche
  //   R    → reset filtres + recherche
  //   Esc  → fermer drawer/dialogue actif ou vider la recherche
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignorer si focus dans un champ saisissable
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable;

      // Esc fonctionne partout — vide la recherche en priorité
      if (e.key === "Escape") {
        if (detailDrawer.open) {
          setDetailDrawer({ open: false, userId: null });
          e.preventDefault();
          return;
        }
        if (search) {
          setSearch("");
          searchInputRef.current?.blur();
          e.preventDefault();
        }
        return;
      }

      if (isEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "/" && tab === "users") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if ((e.key === "n" || e.key === "N") && tab === "users") {
        e.preventDefault();
        setUserDialog({ open: true, user: null });
      } else if ((e.key === "r" || e.key === "R") && hasActiveFilter) {
        e.preventDefault();
        resetFilters();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search, hasActiveFilter, detailDrawer.open]);

  // Pagination client (suffisant <500 users, sinon migrer en serveur)
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showPagination = filteredUsers.length > pageSize;

  const resetFilters = () => {
    setSearch("");
    setFilterStatus("all");
    setFilterRoleId("all");
    setFilterPositionId("all");
    setQuickFilter("none");
    setSecondarySorts([]);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const { type, id, label } = confirmDelete;
    let result: { success: boolean; error?: string; data?: { reassigned?: { timeEntries: number; notifications: number } } };
    if (type === "user") {
      const reassignToAdminId = offboardingReassign !== "none" ? Number(offboardingReassign) : null;
      result = await deleteUserAction({ id, reassignToAdminId });
    }
    else if (type === "role") result = await deleteRoleAction({ id });
    else result = await deletePositionAction({ id });

    if (result.success) {
      if (type === "user" && result.data?.reassigned) {
        const r = result.data.reassigned;
        const parts: string[] = [];
        if (r.timeEntries > 0) parts.push(`${r.timeEntries} saisie${r.timeEntries > 1 ? "s" : ""} de temps`);
        if (r.notifications > 0) parts.push(`${r.notifications} notification${r.notifications > 1 ? "s" : ""}`);
        toast.success(
          parts.length > 0
            ? `${label} désactivé · transféré : ${parts.join(", ")}`
            : `${label} désactivé`
        );
      } else {
        toast.success(`${label} ${type === "user" ? "désactivé" : "supprimé"}`);
      }
      router.refresh();
    } else {
      toast.error(result.error || "Erreur lors de la suppression");
    }
    setConfirmDelete(null);
    setOffboardingReassign("none");
    setOffboardingChecklist({});
  };

  // Liste des admins éligibles comme successeurs (actifs, autres que l'utilisateur ciblé)
  const eligibleSuccessors = useMemo(
    () => users.filter((u) => u.isActive && (!confirmDelete || u.id !== confirmDelete.id)),
    [users, confirmDelete]
  );

  const handleToggleActive = async (user: UserRow) => {
    const result = await updateUserAction({ id: user.id, isActive: !user.isActive });
    if (result.success) {
      toast.success(user.isActive ? "Utilisateur désactivé" : "Utilisateur réactivé");
      router.refresh();
    } else {
      toast.error(result.error || "Erreur");
    }
  };

  const TABS: TabItem<Tab>[] = [
    { key: "users", label: "Utilisateurs", icon: Users, count: users.length },
    { key: "roles", label: "Rôles", icon: Shield, count: roles.length },
    { key: "positions", label: "Postes", icon: Briefcase, count: positions.length },
  ];

  const activeCount = users.filter((u) => u.isActive).length;
  const systemRoles = roles.filter((r) => r.isSystem).length;
  const customRoles = roles.length - systemRoles;

  const dormantCount = users.filter(isDormant).length;

  // ── Stats globales équipe ──
  const stats = {
    total: users.length,
    active: activeCount,
    twoFactorPct: users.length > 0
      ? Math.round((users.filter((u) => u.twoFactorEnabled && u.isActive).length / activeCount) * 100) || 0
      : 0,
    noRole: users.filter((u) => u.isActive && !u.roleId).length,
    expiringSoon: users.filter((u) => {
      if (!u.isActive || !u.endDate) return false;
      const days = (new Date(u.endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      return days > 0 && days <= 30;
    }).length,
    dormant: dormantCount,
    locked: 0, // calculé via API si besoin (lockedUntil pas dans UserRow)
    neverLogin: users.filter((u) => u.isActive && !u.lastLogin).length,
    invitationsPending: invitations.length,
  };
  const stickyBadges = tab === "users"
    ? [
        { label: `${activeCount} actif${activeCount > 1 ? "s" : ""}`, color: "text-emerald-600" },
        { label: `${users.length - activeCount} désactivé${users.length - activeCount > 1 ? "s" : ""}`, color: "text-muted-foreground" },
        ...(dormantCount > 0 ? [{ label: `${dormantCount} dormant${dormantCount > 1 ? "s" : ""}`, color: "text-amber-600" }] : []),
      ]
    : tab === "roles"
    ? [
        { label: `${systemRoles} système`, color: "text-muted-foreground" },
        { label: `${customRoles} personnalisé${customRoles > 1 ? "s" : ""}`, color: "text-[#0F2D52]" },
      ]
    : [
        { label: `${positions.length} poste${positions.length > 1 ? "s" : ""}`, color: "text-[#0F2D52]" },
      ];

  const headerAction =
    tab === "users" ? (
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="hidden md:inline-flex" title="Télécharger l'annuaire interne au format PDF">
              <FileDown className="h-3.5 w-3.5 mr-1.5" />
              Annuaire PDF
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setPdfPreview({
              url: "/api/admin/team/directory-pdf",
              title: "Annuaire interne · Actifs",
              description: "Tous les employés actifs",
              filename: "annuaire-actifs.pdf",
            })}>
              <FileText className="h-3.5 w-3.5 mr-2" />
              Tous les actifs
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPdfPreview({
              url: "/api/admin/team/directory-pdf?includeInactive=1",
              title: "Annuaire interne · Actifs + Inactifs",
              description: "Inclut les employés inactifs",
              filename: "annuaire-complet.pdf",
            })}>
              <FileText className="h-3.5 w-3.5 mr-2" />
              Inclure les inactifs
            </DropdownMenuItem>
            {filterRoleId !== "all" && (
              <DropdownMenuItem onClick={() => {
                const roleName = roles.find((r) => String(r.id) === filterRoleId)?.name || "Rôle";
                setPdfPreview({
                  url: `/api/admin/team/directory-pdf?roleId=${filterRoleId}`,
                  title: `Annuaire interne · ${roleName}`,
                  description: `Filtré par rôle : ${roleName}`,
                  filename: `annuaire-role-${filterRoleId}.pdf`,
                });
              }}>
                <Shield className="h-3.5 w-3.5 mr-2" />
                Rôle actuel : {roles.find((r) => String(r.id) === filterRoleId)?.name}
              </DropdownMenuItem>
            )}
            {filterPositionId !== "all" && (
              <DropdownMenuItem onClick={() => {
                const posName = positions.find((p) => String(p.id) === filterPositionId)?.name || "Poste";
                setPdfPreview({
                  url: `/api/admin/team/directory-pdf?positionId=${filterPositionId}`,
                  title: `Annuaire interne · ${posName}`,
                  description: `Filtré par poste : ${posName}`,
                  filename: `annuaire-poste-${filterPositionId}.pdf`,
                });
              }}>
                <Briefcase className="h-3.5 w-3.5 mr-2" />
                Poste actuel : {positions.find((p) => String(p.id) === filterPositionId)?.name}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                const dep = prompt("Filtrer par département (laisser vide pour annuler) :");
                const trimmed = dep?.trim();
                if (trimmed) {
                  setPdfPreview({
                    url: `/api/admin/team/directory-pdf?department=${encodeURIComponent(trimmed)}`,
                    title: `Annuaire interne · ${trimmed}`,
                    description: `Filtré par département : ${trimmed}`,
                    filename: `annuaire-${trimmed.toLowerCase().replace(/\s+/g, "-")}.pdf`,
                  });
                }
              }}
            >
              <Building2 className="h-3.5 w-3.5 mr-2" />
              Par département…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBulkInviteOpen(true)}
          title="Inviter plusieurs personnes à la fois"
          className="hidden sm:inline-flex"
        >
          <Send className="h-3.5 w-3.5 mr-1.5" />
          Invitation en masse
        </Button>
        <Button onClick={() => setUserDialog({ open: true, user: null })} title="Raccourci : N">
          <Plus className="h-4 w-4 mr-1.5" />
          Nouvel utilisateur
          <kbd className="ml-2 hidden md:inline-flex items-center justify-center h-4 px-1 text-[10px] font-mono rounded bg-white/15 border border-white/20">N</kbd>
        </Button>
      </div>
    ) : tab === "roles" ? (
      <Button onClick={() => setRoleDialog({ open: true, role: null })}>
        <Plus className="h-4 w-4 mr-1.5" />
        Nouveau rôle
      </Button>
    ) : (
      <Button onClick={() => setPositionDialog({ open: true, position: null })}>
        <Plus className="h-4 w-4 mr-1.5" />
        Nouveau poste
      </Button>
    );

  return (
    <SettingsPageShell
      icon={Users}
      iconColor="bg-rose-500"
      title="Équipe"
      subtitle="Comptes employés, rôles d'accès et postes templates"
      stickyBadges={stickyBadges}
      actions={headerAction}
    >
      {!hideTabs && <SettingsTabs tabs={TABS} active={tab} onChange={setTab} />}

      {/* USERS */}
      {tab === "users" && (
        <div className="space-y-4">
          {/* Stats équipe — overview en haut */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <StatCard label="Actifs" value={stats.active} hint={`sur ${stats.total}`} accent="emerald" />
            <StatCard
              label="2FA activée"
              value={`${stats.twoFactorPct}%`}
              hint={stats.twoFactorPct < 80 ? "Sécurité à renforcer" : "Bon niveau"}
              accent={stats.twoFactorPct >= 80 ? "emerald" : stats.twoFactorPct >= 50 ? "amber" : "red"}
            />
            <StatCard
              label="Sans rôle"
              value={stats.noRole}
              hint={stats.noRole > 0 ? "À assigner" : "Tous assignés"}
              accent={stats.noRole > 0 ? "amber" : "muted"}
            />
            <StatCard
              label="Dormants"
              value={stats.dormant}
              hint="> 30 jours"
              accent={stats.dormant > 0 ? "amber" : "muted"}
            />
            <StatCard
              label="Jamais connecté"
              value={stats.neverLogin}
              hint={stats.neverLogin > 0 ? "Vérifier" : "—"}
              accent={stats.neverLogin > 0 ? "amber" : "muted"}
            />
            <StatCard
              label="Invitations"
              value={stats.invitationsPending}
              hint={stats.invitationsPending > 0 ? "En attente" : "Aucune"}
              accent={stats.invitationsPending > 0 ? "blue" : "muted"}
            />
          </div>

          {/* Quick filter chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mr-1">
              Filtres rapides :
            </span>
            <QuickChip
              label={tc("all")}
              active={quickFilter === "none"}
              onClick={() => setQuickFilter("none")}
            />
            <QuickChip
              label="Sans 2FA"
              count={users.filter((u) => u.isActive && !u.twoFactorEnabled).length}
              active={quickFilter === "no2fa"}
              accent="amber"
              onClick={() => setQuickFilter(quickFilter === "no2fa" ? "none" : "no2fa")}
            />
            <QuickChip
              label="Dormants"
              count={stats.dormant}
              active={quickFilter === "dormant"}
              accent="amber"
              onClick={() => setQuickFilter(quickFilter === "dormant" ? "none" : "dormant")}
            />
            <QuickChip
              label="Jamais connecté"
              count={stats.neverLogin}
              active={quickFilter === "never"}
              accent="amber"
              onClick={() => setQuickFilter(quickFilter === "never" ? "none" : "never")}
            />
            <QuickChip
              label="Sans rôle"
              count={stats.noRole}
              active={quickFilter === "norole"}
              accent="red"
              onClick={() => setQuickFilter(quickFilter === "norole" ? "none" : "norole")}
            />
          </div>

          {/* Toolbar recherche + filtres + tri */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher nom, email, téléphone, département... (/)"
                className="pl-9 h-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full hover:bg-muted flex items-center justify-center"
                  aria-label="Effacer la recherche"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>

            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
              <SelectTrigger className="h-9 w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="inactive">Désactivés</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterRoleId} onValueChange={setFilterRoleId}>
              <SelectTrigger className="h-9 w-auto min-w-[140px]"><SelectValue placeholder="Rôle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id.toString()}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color ?? "#0F2D52" }} />
                      {r.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterPositionId} onValueChange={setFilterPositionId}>
              <SelectTrigger className="h-9 w-auto min-w-[140px]"><SelectValue placeholder="Poste" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les postes</SelectItem>
                {positions.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortKey} onValueChange={(v) => setSortKey(v as UserSortKey)}>
              <SelectTrigger className="h-9 w-auto min-w-[160px]" title="Cliquez sur une option en maintenant Shift pour ajouter un critère secondaire">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USER_SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.key} value={o.key}>Trier par : {o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
              title={sortDir === "asc" ? "Tri croissant" : "Tri décroissant"}
            >
              {sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
            </Button>

            {/* Tri multi-colonnes : critères secondaires sous forme de chips */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1"
                  title="Ajouter un critère de tri secondaire"
                >
                  <Plus className="h-3 w-3" />
                  Tri{secondarySorts.length > 0 && ` (+${secondarySorts.length})`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {USER_SORT_OPTIONS.filter((o) => o.key !== sortKey && !secondarySorts.some((s) => s.key === o.key)).map((o) => (
                  <DropdownMenuItem
                    key={o.key}
                    onClick={() => setSecondarySorts((s) => [...s, { key: o.key, dir: "asc" }])}
                    className="text-xs"
                  >
                    Ajouter : {o.label}
                  </DropdownMenuItem>
                ))}
                {secondarySorts.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setSecondarySorts([])} className="text-xs text-muted-foreground">
                      <X className="h-3 w-3 mr-1" />
                      Effacer les critères secondaires
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {secondarySorts.map((s, idx) => {
              const opt = USER_SORT_OPTIONS.find((o) => o.key === s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    setSecondarySorts((prev) => prev.map((p, i) => i === idx ? { ...p, dir: p.dir === "asc" ? "desc" : "asc" } : p));
                  }}
                  className="inline-flex items-center gap-1 h-9 px-2 text-[11px] rounded-md border bg-muted/40 hover:bg-muted/60 transition"
                  title="Cliquer pour inverser · Bouton × pour retirer"
                >
                  <span className="text-muted-foreground font-mono">{idx + 2}.</span>
                  {opt?.label}
                  {s.dir === "asc" ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSecondarySorts((prev) => prev.filter((_, i) => i !== idx));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        setSecondarySorts((prev) => prev.filter((_, i) => i !== idx));
                      }
                    }}
                    className="ml-0.5 hover:bg-destructive/10 rounded-full p-0.5 cursor-pointer"
                  >
                    <X className="h-2.5 w-2.5" />
                  </span>
                </button>
              );
            })}

            {hasActiveFilter && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 text-muted-foreground">
                <X className="h-3.5 w-3.5 mr-1" />Réinitialiser
              </Button>
            )}
          </div>

          {/* Compteur résultats + filtres actifs */}
          <div className="flex items-center flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {filteredUsers.filter((u) => u.isActive).length} actif{filteredUsers.filter((u) => u.isActive).length > 1 ? "s" : ""}
            </span>
            <span className="text-muted-foreground">
              sur {filteredUsers.length}{filteredUsers.length !== users.length && ` (${users.length} au total)`}
            </span>
            {filterRoleId !== "all" && (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 cursor-pointer hover:bg-muted"
                onClick={() => setFilterRoleId("all")}
              >
                Rôle : {roles.find((r) => r.id.toString() === filterRoleId)?.name}
                <X className="h-2.5 w-2.5" />
              </Badge>
            )}
            {filterPositionId !== "all" && (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 cursor-pointer hover:bg-muted"
                onClick={() => setFilterPositionId("all")}
              >
                Poste : {positions.find((p) => p.id.toString() === filterPositionId)?.name}
                <X className="h-2.5 w-2.5" />
              </Badge>
            )}
          </div>

          {/* Section invitations en attente */}
          {invitations.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/40">
              <div className="px-4 py-2.5 border-b border-amber-200 bg-amber-50 flex items-center gap-2">
                <Hourglass className="h-4 w-4 text-amber-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  Invitations en attente
                </h3>
                <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500">{invitations.length}</Badge>
              </div>
              <div className="divide-y divide-amber-100">
                {invitations.map((inv) => {
                  const daysLeft = Math.max(0, Math.ceil((new Date(inv.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
                  const expiringSoon = daysLeft <= 1;
                  return (
                    <div key={inv.id} className="flex items-center gap-4 px-4 py-3 hover:bg-amber-50/60">
                      <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{inv.fullName || inv.email}</p>
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-300 text-amber-700">
                            En attente
                          </Badge>
                          {expiringSoon && (
                            <Badge className="text-[9px] px-1.5 py-0 bg-red-500 hover:bg-red-500">
                              Expire bientôt
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                          <span>{inv.email}</span>
                          {inv.department && <span>· {inv.department}</span>}
                          <span>· Envoyée {new Date(inv.createdAt).toLocaleDateString("fr-CA", { day: "numeric", month: "short" })}</span>
                          <span className={expiringSoon ? "text-red-600 font-medium" : "text-amber-700"}>
                            · Expire dans {daysLeft} j
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyInviteLink(inv.id)}
                          className="h-8 text-xs"
                          title="Générer un nouveau lien et le copier"
                        >
                          <Copy className="h-3.5 w-3.5 mr-1" />Copier lien
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResendInvite(inv.id, inv.email)}
                          className="h-8 text-xs"
                          title="Renvoyer un nouveau lien par email"
                        >
                          <Send className="h-3.5 w-3.5 mr-1" />Renvoyer
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRevokeInvite(inv.id)}
                          className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Annuler cette invitation"
                        >
                          <Ban className="h-3.5 w-3.5 mr-1" />Révoquer
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="divide-y">
              {filteredUsers.length === 0 ? (
                users.length === 0 ? (
                  // Vraiment 0 user dans le système
                  <div className="p-16 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-rose-50 mx-auto flex items-center justify-center mb-4">
                      <Users className="h-8 w-8 text-rose-500" />
                    </div>
                    <p className="text-base font-semibold">Aucun utilisateur</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                      Créez votre premier compte employé pour commencer à déléguer la gestion du portail.
                    </p>
                    <Button
                      onClick={() => setUserDialog({ open: true, user: null })}
                      className="mt-4 bg-[#0F2D52] hover:bg-[#0F2D52]/90"
                    >
                      <Plus className="h-4 w-4 mr-1.5" />Créer le premier utilisateur
                    </Button>
                  </div>
                ) : (
                  // Filtres appliqués mais aucun résultat
                  <div className="p-12 text-center">
                    <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-medium">{tc("no_results")}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ajustez vos filtres ou la recherche.
                    </p>
                    {hasActiveFilter && (
                      <Button variant="outline" size="sm" onClick={resetFilters} className="mt-3">
                        <X className="h-3.5 w-3.5 mr-1.5" />Réinitialiser les filtres
                      </Button>
                    )}
                  </div>
                )
              ) : paginatedUsers.map((u) => {
                const isMe = u.id === currentAdminId;
                return (
                  <div
                    key={u.id}
                    onClick={() => setDetailDrawer({ open: true, userId: u.id })}
                    className={cn(
                      "flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors group cursor-pointer",
                      !u.isActive && "opacity-60",
                      selectedIds.has(u.id) && "bg-[#0F2D52]/5 hover:bg-[#0F2D52]/10"
                    )}
                  >
                    {/* Checkbox bulk */}
                    <div
                      onClick={(e) => { e.stopPropagation(); toggleSelect(u.id); }}
                      className={cn(
                        "transition-opacity",
                        selectedIds.size > 0 || "opacity-0 group-hover:opacity-100"
                      )}
                    >
                      <Checkbox
                        checked={selectedIds.has(u.id)}
                        onCheckedChange={() => toggleSelect(u.id)}
                        aria-label={`Sélectionner ${u.fullName || u.email}`}
                      />
                    </div>
                    {/* Avatar + dot présence */}
                    {(() => {
                      const presence = getPresence(u);
                      return (
                        <div className="relative shrink-0">
                          <div
                            className="h-11 w-11 rounded-full flex items-center justify-center text-white font-semibold text-sm ring-2 ring-background shadow-sm"
                            style={{ backgroundColor: u.position?.color ?? u.customRole?.color ?? "#0F2D52" }}
                          >
                            {u.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={u.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                            ) : (
                              (u.fullName || u.email).charAt(0).toUpperCase()
                            )}
                          </div>
                          <span
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-background",
                              presence.color
                            )}
                            title={presence.label}
                          />
                        </div>
                      );
                    })()}

                    {/* Identité */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm leading-tight">{u.fullName || u.email}</p>
                        {isMe && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Vous</Badge>}
                        {!u.isActive && <Badge className="text-[9px] px-1.5 py-0 bg-gray-500 hover:bg-gray-500">{tc("disabled")}</Badge>}
                        {u.twoFactorEnabled && (
                          <Badge className="text-[9px] px-1.5 py-0 bg-emerald-600 hover:bg-emerald-600">2FA</Badge>
                        )}
                        {isDormant(u) && (
                          <Badge
                            className="text-[9px] px-1.5 py-0 bg-amber-100 hover:bg-amber-100 text-amber-800 border border-amber-300"
                            title="Compte actif sans connexion depuis plus de 30 jours"
                          >
                            <Clock className="h-2.5 w-2.5 mr-0.5" />Dormant
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {u.email}
                        </span>
                        {u.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {u.phone}
                          </span>
                        )}
                        <InlineDepartment
                          current={u.department}
                          knownDepartments={knownDepartments}
                          onChange={async (newDep) => {
                            const r = await updateUserAction({ id: u.id, department: newDep });
                            if (r.success) {
                              toast.success(newDep ? "Département mis à jour" : "Département retiré");
                              router.refresh();
                            } else {
                              toast.error(r.error || "Erreur");
                            }
                          }}
                        />
                      </div>
                      {/* Rôle + Poste — édition inline via popover */}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <InlinePicker
                          icon={Briefcase}
                          label="Poste"
                          current={u.position ? { id: u.position.id, name: u.position.name, color: u.position.color } : null}
                          options={positions.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
                          emptyLabel="Sans poste"
                          onChange={async (newId) => {
                            const r = await updateUserAction({ id: u.id, positionId: newId });
                            if (r.success) {
                              toast.success("Poste mis à jour");
                              router.refresh();
                            } else {
                              toast.error(r.error || "Erreur");
                            }
                          }}
                        />
                        <InlinePicker
                          icon={Shield}
                          label="Rôle"
                          current={u.customRole ? { id: u.customRole.id, name: u.customRole.name, color: u.customRole.color } : null}
                          options={roles.map((r) => ({ id: r.id, name: r.name, color: r.color }))}
                          emptyLabel="Sans rôle"
                          emptyTone="warning"
                          onChange={async (newId) => {
                            const r = await updateUserAction({ id: u.id, roleId: newId });
                            if (r.success) {
                              toast.success("Rôle mis à jour");
                              router.refresh();
                            } else {
                              toast.error(r.error || "Erreur");
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Last login */}
                    <div className="hidden md:block text-xs text-muted-foreground shrink-0 w-28 text-right">
                      {u.lastLogin
                        ? `Vu ${new Date(u.lastLogin).toLocaleDateString("fr-CA", { day: "numeric", month: "short" })}`
                        : <span className="italic">Jamais connecté</span>}
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => router.push(`/admin/employes/${u.id}/dossier`)}>
                          <FolderOpen className="h-4 w-4 mr-2" />Voir le dossier
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setUserDialog({ open: true, user: u })}>
                          <Edit className="h-4 w-4 mr-2" />{tc("edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setUserDialog({ open: true, user: u, initialTab: "password" })}>
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
                              <Trash2 className="h-4 w-4 mr-2" />{tc("delete")}
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

          {/* Pagination */}
          {showPagination && (
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
              <p className="text-muted-foreground">
                Affichage <span className="font-semibold text-foreground">{(currentPage - 1) * pageSize + 1}</span> à{" "}
                <span className="font-semibold text-foreground">{Math.min(currentPage * pageSize, filteredUsers.length)}</span> sur{" "}
                <span className="font-semibold text-foreground">{filteredUsers.length}</span>
              </p>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(1)}
                  disabled={currentPage === 1}
                  className="h-8 text-xs"
                >
                  «
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="h-8 text-xs"
                >
                  ‹ Précédent
                </Button>
                <span className="px-3 text-xs font-medium tabular-nums">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 text-xs"
                >
                  Suivant ›
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="h-8 text-xs"
                >
                  »
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ROLES */}
      {tab === "roles" && (
        <div className="space-y-4">
          {/* Toolbar recherche */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un rôle..."
                className="pl-9 h-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full hover:bg-muted flex items-center justify-center"
                  aria-label="Effacer la recherche"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{systemRoles}</span> système · <span className="font-medium text-[#0F2D52]">{customRoles}</span> personnalisé{customRoles > 1 ? "s" : ""}
            {search && filteredRoles.length !== roles.length && (
              <span className="ml-2">· <span className="font-medium">{filteredRoles.length}</span> trouvé{filteredRoles.length > 1 ? "s" : ""}</span>
            )}
          </p>

          {filteredRoles.length === 0 ? (
            roles.length === 0 ? (
              <div className="rounded-xl border bg-card p-16 text-center">
                <div className="h-16 w-16 rounded-2xl bg-[#0F2D52]/8 mx-auto flex items-center justify-center mb-4">
                  <Shield className="h-8 w-8 text-[#0F2D52]" />
                </div>
                <p className="text-base font-semibold">Aucun rôle système</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                  Les 7 rôles par défaut ne sont pas seedés. Lancez le script : <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">npx tsx prisma/seed-rbac.ts</code>
                </p>
              </div>
            ) : (
              <div className="rounded-xl border bg-card p-12 text-center">
                <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium">{tc("no_results")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Essayez un autre terme de recherche.
                </p>
                {search && (
                  <Button variant="outline" size="sm" onClick={() => setSearch("")} className="mt-3">
                    <X className="h-3.5 w-3.5 mr-1.5" />Effacer la recherche
                  </Button>
                )}
              </div>
            )
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredRoles.map((r) => {
              const permCount = Object.values(r.permissions).reduce((sum, arr) => sum + arr.length, 0);
              const resourceCount = Object.keys(r.permissions).length;
              const usagePct = users.length > 0 ? Math.round((r._count.admins / users.length) * 100) : 0;
              return (
                <Card
                  key={r.id}
                  className="group transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-[#0F2D52]/30 cursor-pointer"
                  onClick={() => setRoleDialog({ open: true, role: r })}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="h-10 w-10 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm"
                          style={{ backgroundColor: r.color ?? "#0F2D52" }}
                        >
                          <Shield className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate group-hover:text-[#0F2D52] transition-colors">
                            {r.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {resourceCount} ressources · {permCount} permissions
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => setRoleDialog({ open: true, role: r })}>
                            <Edit className="h-4 w-4" />{r.isSystem ? "Voir / Éditer" : "Modifier"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicateRole(r)}>
                            <Copy className="h-4 w-4" />Dupliquer
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => moveRole(r.id, "up")}>
                            <ArrowUp className="h-4 w-4" />Monter
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => moveRole(r.id, "down")}>
                            <ArrowDown className="h-4 w-4" />Descendre
                          </DropdownMenuItem>
                          {!r.isSystem && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setConfirmDelete({ type: "role", id: r.id, label: r.name })}
                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                disabled={r._count.admins > 0 || r._count.positions > 0}
                              >
                                <Trash2 className="h-4 w-4" />{tc("delete")}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {r.description && (
                      <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{r.description}</p>
                    )}

                    {/* Barre d'usage visuelle */}
                    {users.length > 0 && r._count.admins > 0 && (
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground">Utilisation</span>
                          <span className="font-semibold tabular-nums" style={{ color: r.color ?? "#0F2D52" }}>
                            {usagePct}% de l&apos;équipe
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${usagePct}%`,
                              backgroundColor: r.color ?? "#0F2D52",
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                      {r.isSystem && (
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Système</Badge>
                      )}
                      {r._count.admins > 0 ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTab("users");
                            setFilterRoleId(r.id.toString());
                            setFilterStatus("all");
                            setFilterPositionId("all");
                            setSearch("");
                          }}
                          className="inline-flex items-center rounded-md border border-[#0F2D52]/30 bg-[#0F2D52]/5 hover:bg-[#0F2D52]/10 hover:border-[#0F2D52]/50 text-[9px] px-1.5 py-0.5 font-medium text-[#0F2D52] transition-colors"
                          title={`Filtrer les utilisateurs avec le rôle ${r.name}`}
                        >
                          {r._count.admins} utilisateur{r._count.admins > 1 ? "s" : ""}
                        </button>
                      ) : (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground">
                          0 utilisateur
                        </Badge>
                      )}
                      {r._count.positions > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTab("positions");
                            setSearch(r.name);
                          }}
                          className="inline-flex items-center rounded-md border border-[#0F2D52]/30 bg-[#0F2D52]/5 hover:bg-[#0F2D52]/10 hover:border-[#0F2D52]/50 text-[9px] px-1.5 py-0.5 font-medium text-[#0F2D52] transition-colors"
                          title={`Voir les postes qui utilisent ce rôle par défaut`}
                        >
                          {r._count.positions} poste{r._count.positions > 1 ? "s" : ""}
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* POSITIONS */}
      {tab === "positions" && (
        <div className="space-y-4">
          {/* Toolbar recherche */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un poste..."
                className="pl-9 h-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full hover:bg-muted flex items-center justify-center"
                  aria-label="Effacer la recherche"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{positions.filter((p) => p.isSystem).length}</span> système · <span className="font-medium text-[#0F2D52]">{positions.filter((p) => !p.isSystem).length}</span> personnalisé{positions.filter((p) => !p.isSystem).length > 1 ? "s" : ""}
            {search && filteredPositions.length !== positions.length && (
              <span className="ml-2">· <span className="font-medium">{filteredPositions.length}</span> trouvé{filteredPositions.length > 1 ? "s" : ""}</span>
            )}
          </p>

          {filteredPositions.length === 0 ? (
            positions.length === 0 ? (
              <div className="rounded-xl border bg-card p-16 text-center">
                <div className="h-16 w-16 rounded-2xl bg-[#0F2D52]/8 mx-auto flex items-center justify-center mb-4">
                  <Briefcase className="h-8 w-8 text-[#0F2D52]" />
                </div>
                <p className="text-base font-semibold">Aucun poste système</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                  Lancez le seed : <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">npx tsx prisma/seed-rbac.ts</code>
                </p>
              </div>
            ) : (
              <div className="rounded-xl border bg-card p-12 text-center">
                <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium">{tc("no_results")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Essayez un autre terme de recherche.
                </p>
                {search && (
                  <Button variant="outline" size="sm" onClick={() => setSearch("")} className="mt-3">
                    <X className="h-3.5 w-3.5 mr-1.5" />Effacer la recherche
                  </Button>
                )}
              </div>
            )
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredPositions.map((p) => (
              <Card
                key={p.id}
                className="group transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-[#0F2D52]/30 cursor-pointer"
                onClick={() => setPositionDialog({ open: true, position: p })}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm"
                        style={{ backgroundColor: p.color ?? "#0F2D52" }}
                      >
                        <Briefcase className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate group-hover:text-[#0F2D52] transition-colors">
                          {p.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {p.defaultDepartment ?? "Sans département"}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => setPositionDialog({ open: true, position: p })}>
                          <Edit className="h-4 w-4" />{tc("edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => movePosition(p.id, "up")}>
                          <ArrowUp className="h-4 w-4" />Monter
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => movePosition(p.id, "down")}>
                          <ArrowDown className="h-4 w-4" />Descendre
                        </DropdownMenuItem>
                        {!p.isSystem && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setConfirmDelete({ type: "position", id: p.id, label: p.name })}
                              className="text-red-600 focus:text-red-600 focus:bg-red-50"
                              disabled={p._count.admins > 0}
                            >
                              <Trash2 className="h-4 w-4" />{tc("delete")}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {p.description && (
                    <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{p.description}</p>
                  )}

                  {/* Barre d'usage */}
                  {users.length > 0 && p._count.admins > 0 && (() => {
                    const pct = Math.round((p._count.admins / users.length) * 100);
                    return (
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground">Utilisation</span>
                          <span className="font-semibold tabular-nums" style={{ color: p.color ?? "#0F2D52" }}>
                            {pct}% de l&apos;équipe
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: p.color ?? "#0F2D52" }} />
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    {p.isSystem && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Système</Badge>
                    )}
                    {p.defaultRole && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTab("roles");
                          setSearch(p.defaultRole!.name);
                        }}
                        className="inline-flex items-center rounded-md border text-[9px] px-1.5 py-0.5 font-medium transition-colors hover:opacity-80"
                        style={{
                          borderColor: p.defaultRole.color ? `${p.defaultRole.color}66` : undefined,
                          color: p.defaultRole.color ?? undefined,
                          backgroundColor: p.defaultRole.color ? `${p.defaultRole.color}10` : undefined,
                        }}
                        title={`Voir le rôle ${p.defaultRole.name}`}
                      >
                        {p.defaultRole.name}
                      </button>
                    )}
                    {p._count.admins > 0 ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTab("users");
                          setFilterPositionId(p.id.toString());
                          setFilterStatus("all");
                          setFilterRoleId("all");
                          setSearch("");
                        }}
                        className="inline-flex items-center rounded-md border border-[#0F2D52]/30 bg-[#0F2D52]/5 hover:bg-[#0F2D52]/10 hover:border-[#0F2D52]/50 text-[9px] px-1.5 py-0.5 font-medium text-[#0F2D52] transition-colors"
                        title={`Filtrer les utilisateurs avec le poste ${p.name}`}
                      >
                        {p._count.admins} utilisateur{p._count.admins > 1 ? "s" : ""}
                      </button>
                    ) : (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground">
                        0 utilisateur
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <UserDialog
        open={userDialog.open}
        onOpenChange={(open) => setUserDialog({ open, user: open ? userDialog.user : null, initialTab: open ? userDialog.initialTab : undefined })}
        user={userDialog.user}
        initialTab={userDialog.initialTab}
        roles={roles}
        positions={positions}
        knownDepartments={users.map((u) => u.department ?? "").filter(Boolean)}
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

      <UserDetailDrawer
        open={detailDrawer.open}
        onOpenChange={(open) => setDetailDrawer({ open, userId: open ? detailDrawer.userId : null })}
        userId={detailDrawer.userId}
        currentAdminId={currentAdminId}
        onEdit={() => {
          const u = users.find((x) => x.id === detailDrawer.userId);
          if (u) {
            setDetailDrawer({ open: false, userId: null });
            setUserDialog({ open: true, user: u });
          }
        }}
        onResetPassword={() => {
          const u = users.find((x) => x.id === detailDrawer.userId);
          if (u) {
            setDetailDrawer({ open: false, userId: null });
            setUserDialog({ open: true, user: u, initialTab: "password" });
          }
        }}
      />

      {/* ─── Dialog d'offboarding utilisateur (rich) ─── */}
      <Dialog
        open={!!confirmDelete && confirmDelete.type === "user"}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDelete(null);
            setOffboardingReassign("none");
            setOffboardingChecklist({});
          }
        }}
      >
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          {/* Header VNK */}
          <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base text-white flex items-center gap-2">
                <UserX className="h-4 w-4" />
                Désactiver {confirmDelete?.label}
              </DialogTitle>
              <DialogDescription className="text-white/80 text-xs">
                Toutes les sessions seront fermées immédiatement. Le compte peut être réactivé plus tard.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Successeur */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                Transférer le portefeuille vers
              </Label>
              <Select value={offboardingReassign} onValueChange={setOffboardingReassign}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Choisir un successeur (optionnel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Aucun transfert —</SelectItem>
                  {eligibleSuccessors.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.fullName} {u.customRole ? `· ${u.customRole.name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Si un successeur est choisi : les saisies de temps non clôturées et les notifications non lues seront réassignées.
              </p>
            </div>

            {/* Checklist offboarding */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                Checklist offboarding
              </Label>
              <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                {[
                  { key: "credentials", label: "Récupérer cartes, badges et matériel (laptop, téléphone, clés)" },
                  { key: "sso", label: "Révoquer accès SSO externes (Google, Microsoft, GitHub…)" },
                  { key: "shared", label: "Reprendre comptes partagés (Stripe, Dropbox, Sentry…)" },
                  { key: "handover", label: "Documenter dossiers en cours et passer relais au successeur" },
                  { key: "hr", label: "Notifier RH/comptable de la fin de contrat" },
                ].map((item) => (
                  <label key={item.key} className="flex items-start gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!offboardingChecklist[item.key]}
                      onChange={(e) =>
                        setOffboardingChecklist((s) => ({ ...s, [item.key]: e.target.checked }))
                      }
                      className="h-3.5 w-3.5 mt-0.5 rounded border-input flex-shrink-0"
                    />
                    <span className={offboardingChecklist[item.key] ? "line-through text-muted-foreground" : ""}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                Cette checklist est un aide-mémoire — non bloquante.
              </p>
            </div>

            {/* Impact résumé */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2 text-xs">
              <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 flex-shrink-0" />
              <div className="text-amber-900 space-y-0.5">
                <p className="font-semibold">Ce qui va se passer :</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Le compte sera marqué inactif (réversible)</li>
                  <li>Toutes les sessions actives seront fermées</li>
                  <li>L&apos;utilisateur ne pourra plus se connecter</li>
                  {offboardingReassign !== "none" && (
                    <li className="font-medium">Saisies de temps + notifications transférées au successeur</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter className="px-5 py-3 border-t bg-muted/30 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDelete(null);
                setOffboardingReassign("none");
                setOffboardingChecklist({});
              }}
            >
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              <UserX className="h-4 w-4 mr-1.5" />
              Désactiver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── ConfirmDialog classique pour rôle/poste ─── */}
      <ConfirmDialog
        open={!!confirmDelete && confirmDelete.type !== "user"}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Supprimer ${confirmDelete?.label} ?`}
        description="Cette action est irréversible."
        confirmLabel={tc("delete")}
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />

      {/* ─── Bulk invite dialog ─── */}
      <Dialog
        open={bulkInviteOpen}
        onOpenChange={(open) => {
          if (!open) {
            setBulkInviteOpen(false);
            setBulkInviteEmails("");
            setBulkInviteEntries([]);
            setBulkInviteMode("paste");
            setBulkInviteRoleId("none");
            setBulkInvitePositionId("none");
            setBulkInviteResult(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base text-white flex items-center gap-2">
                <Send className="h-4 w-4" />
                Inviter plusieurs personnes
              </DialogTitle>
              <DialogDescription className="text-white/80 text-xs">
                {bulkInviteMode === "paste"
                  ? "Étape 1/2 : collez les emails, puis ajustez les noms."
                  : "Étape 2/2 : vérifiez ou modifiez chaque ligne avant l'envoi."}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
            {bulkInviteMode === "paste" ? (
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Adresses email (séparées par virgule, espace ou retour à la ligne · max 50)
                </Label>
                <textarea
                  value={bulkInviteEmails}
                  onChange={(e) => setBulkInviteEmails(e.target.value)}
                  placeholder={"jean@vnk.ca, marie@vnk.ca\npaul.dubois@vnk.ca"}
                  rows={6}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[#0F2D52]/30"
                  disabled={bulkInvitePending}
                />
                {(() => {
                  const detected = bulkInviteEmails
                    .split(/[\s,;]+/)
                    .map((e) => e.trim())
                    .filter((e) => e.length > 0 && e.includes("@"));
                  return (
                    <p className="text-[11px] text-muted-foreground">
                      {detected.length === 0 ? "Aucune adresse détectée" : `${detected.length} adresse${detected.length > 1 ? "s" : ""} détectée${detected.length > 1 ? "s" : ""}`}
                    </p>
                  );
                })()}
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Ajustez le nom complet pour chaque invité ({bulkInviteEntries.length})
                </Label>
                <div className="rounded-lg border divide-y max-h-72 overflow-y-auto">
                  {bulkInviteEntries.map((e, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2">
                      <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
                        <Input
                          value={e.fullName}
                          onChange={(ev) => setBulkInviteEntries((arr) => arr.map((x, i) => i === idx ? { ...x, fullName: ev.target.value } : x))}
                          placeholder="Nom complet"
                          className="h-8 text-xs"
                          disabled={bulkInvitePending}
                        />
                        <Input
                          value={e.email}
                          onChange={(ev) => setBulkInviteEntries((arr) => arr.map((x, i) => i === idx ? { ...x, email: ev.target.value.toLowerCase() } : x))}
                          className="h-8 text-xs font-mono"
                          disabled={bulkInvitePending}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:text-destructive shrink-0"
                        onClick={() => setBulkInviteEntries((arr) => arr.filter((_, i) => i !== idx))}
                        disabled={bulkInvitePending}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <div className="p-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs w-full"
                      onClick={() => setBulkInviteEntries((arr) => [...arr, { email: "", fullName: "" }])}
                      disabled={bulkInvitePending || bulkInviteEntries.length >= 50}
                    >
                      <Plus className="h-3 w-3 mr-1" />Ajouter une ligne
                    </Button>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-[11px] text-[#0F2D52] hover:underline"
                  onClick={() => { setBulkInviteMode("paste"); setBulkInviteEntries([]); }}
                  disabled={bulkInvitePending}
                >
                  ← Repartir d&apos;un copier-coller
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Rôle (optionnel)
                </Label>
                <Select value={bulkInviteRoleId} onValueChange={setBulkInviteRoleId} disabled={bulkInvitePending}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Aucun rôle" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Aucun rôle —</SelectItem>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Poste (optionnel)
                </Label>
                <Select value={bulkInvitePositionId} onValueChange={setBulkInvitePositionId} disabled={bulkInvitePending}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Aucun poste" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Aucun poste —</SelectItem>
                    {positions.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {bulkInviteResult && (
              <div className="space-y-2">
                {bulkInviteResult.invited > 0 && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                    <p className="font-semibold flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5" />
                      {bulkInviteResult.invited} invitation{bulkInviteResult.invited > 1 ? "s" : ""} envoyée{bulkInviteResult.invited > 1 ? "s" : ""}
                    </p>
                  </div>
                )}
                {bulkInviteResult.skipped.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    <p className="font-semibold mb-1 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {bulkInviteResult.skipped.length} email{bulkInviteResult.skipped.length > 1 ? "s" : ""} ignoré{bulkInviteResult.skipped.length > 1 ? "s" : ""}
                    </p>
                    <ul className="space-y-0.5 ml-1 max-h-32 overflow-y-auto">
                      {bulkInviteResult.skipped.map((s) => (
                        <li key={s.email} className="font-mono text-[11px]">
                          <span className="font-semibold">{s.email}</span> — {s.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="px-5 py-3 border-t bg-muted/30 gap-2">
            <Button variant="outline" onClick={() => setBulkInviteOpen(false)} disabled={bulkInvitePending}>
              {bulkInviteResult ? "Fermer" : "Annuler"}
            </Button>
            {bulkInviteMode === "paste" && !bulkInviteResult ? (
              <Button onClick={goToEditMode} disabled={bulkInvitePending || !bulkInviteEmails.trim()}>
                Suivant : ajuster les noms
              </Button>
            ) : (
              <Button onClick={handleBulkInvite} disabled={bulkInvitePending || (bulkInviteMode === "edit" && bulkInviteEntries.length === 0)}>
                <Send className="h-4 w-4 mr-1.5" />
                {bulkInvitePending ? "Envoi en cours…" : `Envoyer (${bulkInviteEntries.length || bulkInviteEmails.split(/[\s,;]+/).filter((e) => e.includes("@")).length})`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk action bar — apparaît quand des users sont sélectionnés */}
      {tab === "users" && selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-2 right-2 sm:bottom-6 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-40 bg-[#0F2D52] text-white rounded-xl shadow-2xl px-3 py-2.5 sm:px-4 sm:py-3 flex items-center gap-1.5 sm:gap-2 animate-in slide-in-from-bottom-4 duration-200 sm:max-w-[calc(100vw-2rem)] overflow-x-auto">
          <span className="text-sm font-semibold inline-flex items-center gap-2 shrink-0">
            <Checkbox
              checked
              onCheckedChange={() => setSelectedIds(new Set())}
              className="border-white/40 data-[state=checked]:bg-white data-[state=checked]:text-[#0F2D52]"
              aria-label="Désélectionner tout"
            />
            {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}
          </span>
          <div className="h-5 w-px bg-white/20 shrink-0" />
          <Button size="sm" variant="ghost" onClick={() => handleBulkAction("activate")} className="text-white hover:bg-white/10 h-8 shrink-0">
            <UserCheck className="h-3.5 w-3.5 mr-1.5" />Activer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleBulkAction("deactivate")} className="text-white hover:bg-white/10 h-8 shrink-0">
            <UserX className="h-3.5 w-3.5 mr-1.5" />Désactiver
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 h-8 shrink-0">
                <Shield className="h-3.5 w-3.5 mr-1.5" />Assigner rôle
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[300px] overflow-y-auto">
              <DropdownMenuItem onClick={() => handleBulkAssignRole(null)}>
                <X className="h-4 w-4" />Aucun rôle
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {roles.map((r) => (
                <DropdownMenuItem key={r.id} onClick={() => handleBulkAssignRole(r.id)}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.color ?? "#0F2D52" }} />
                  {r.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="ghost" onClick={handleBulkExportCSV} className="text-white hover:bg-white/10 h-8 shrink-0">
            <Mail className="h-3.5 w-3.5 mr-1.5" />Export CSV
          </Button>
          <div className="h-5 w-px bg-white/20 shrink-0" />
          <Button size="sm" variant="ghost" onClick={() => setBulkConfirmDelete(true)} className="text-red-300 hover:bg-red-500/20 hover:text-red-200 h-8 shrink-0">
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />{tc("delete")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="text-white/70 hover:bg-white/10 hover:text-white h-8 shrink-0">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Bulk deactivate avec option transfert portefeuille */}
      <Dialog open={bulkConfirmDelete} onOpenChange={(o) => { if (!o) { setBulkConfirmDelete(false); setBulkReassignToId("none"); } }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base text-white flex items-center gap-2">
                <UserX className="h-4 w-4" />
                Désactiver {selectedIds.size} utilisateur{selectedIds.size > 1 ? "s" : ""}
              </DialogTitle>
              <DialogDescription className="text-white/80 text-xs">
                Les comptes seront désactivés et toutes leurs sessions fermées. Réversible en réactivant.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                Transférer le portefeuille de tous vers
              </Label>
              <Select value={bulkReassignToId} onValueChange={setBulkReassignToId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Choisir un successeur (optionnel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Aucun transfert —</SelectItem>
                  {users.filter((u) => u.isActive && !selectedIds.has(u.id)).map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.fullName || u.email} {u.customRole ? `· ${u.customRole.name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Si choisi, toutes les saisies de temps non clôturées et notifications non lues des comptes désactivés sont réassignées en bloc.
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2 text-xs">
              <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 flex-shrink-0" />
              <div className="text-amber-900 space-y-0.5">
                <p className="font-semibold">Impact</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>{selectedIds.size} compte{selectedIds.size > 1 ? "s" : ""} mis en inactif</li>
                  <li>Toutes les sessions actives fermées</li>
                  <li>Les utilisateurs ne pourront plus se connecter</li>
                </ul>
              </div>
            </div>
          </div>
          <DialogFooter className="px-5 py-3 border-t bg-muted/30">
            <Button variant="outline" onClick={() => { setBulkConfirmDelete(false); setBulkReassignToId("none"); }}>{tc("cancel")}</Button>
            <Button variant="destructive" onClick={() => {
              handleBulkAction("delete", bulkReassignToId !== "none" ? Number(bulkReassignToId) : null);
              setBulkConfirmDelete(false);
            }}>
              <UserX className="h-4 w-4 mr-1.5" />
              Désactiver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PdfPreviewModal
        open={!!pdfPreview}
        url={pdfPreview?.url ?? null}
        title={pdfPreview?.title ?? ""}
        description={pdfPreview?.description}
        downloadFilename={pdfPreview?.filename}
        onClose={() => setPdfPreview(null)}
      />
    </SettingsPageShell>
  );
}


// ── Quick filter chip ──
function QuickChip({
  label, count, active, accent, onClick,
}: {
  label: string;
  count?: number;
  active?: boolean;
  accent?: "amber" | "red" | "blue";
  onClick: () => void;
}) {
  const accentMap = {
    amber: "border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100",
    red: "border-red-300 text-red-700 bg-red-50 hover:bg-red-100",
    blue: "border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100",
  };
  const activeClass = "border-[#0F2D52] bg-[#0F2D52] text-white hover:bg-[#0F2D52]/90";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active ? activeClass : accent ? accentMap[accent] : "border-border text-muted-foreground hover:bg-muted"
      )}
    >
      {label}
      {count !== undefined && (
        <span className={cn("ml-0.5 rounded-full px-1 text-[9px] font-semibold tabular-nums", active ? "bg-white/20" : "bg-current/10")}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── InlineDepartment : popover édition département avec suggestions ──
function InlineDepartment({
  current, knownDepartments, onChange,
}: {
  current: string | null;
  knownDepartments: string[];
  onChange: (newDep: string | null) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  const filtered = knownDepartments.filter((d) =>
    !input || d.toLowerCase().includes(input.toLowerCase())
  );

  const submit = async (val: string | null) => {
    setOpen(false);
    setInput("");
    await onChange(val);
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setInput(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="group/dep inline-flex items-center gap-1 text-xs hover:bg-muted/40 rounded px-1.5 py-0.5 transition"
          title="Cliquer pour changer le département"
        >
          <Building2 className="h-3 w-3 text-muted-foreground" />
          {current ? (
            <span className="text-foreground">{current}</span>
          ) : (
            <span className="italic text-muted-foreground/60">Sans département</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-1 pb-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          Département
        </div>
        <Input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tapez ou choisissez…"
          className="h-8 text-sm mb-2"
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              submit(input.trim());
            }
          }}
        />
        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {current && (
            <button
              type="button"
              onClick={() => submit(null)}
              className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-destructive/10 text-destructive/80 transition"
            >
              Retirer le département
            </button>
          )}
          {filtered.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => submit(d)}
              className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/60 transition flex items-center gap-2 ${current === d ? "bg-muted/40 font-medium" : ""}`}
            >
              <Building2 className="h-3 w-3 text-muted-foreground" />
              {d}
            </button>
          ))}
          {input.trim() && !filtered.some((d) => d.toLowerCase() === input.trim().toLowerCase()) && (
            <button
              type="button"
              onClick={() => submit(input.trim())}
              className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/60 transition flex items-center gap-2 text-[#0F2D52]"
            >
              <Plus className="h-3 w-3" />
              Créer « {input.trim()} »
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── InlinePicker : permet de changer rôle/poste depuis la liste ──
function InlinePicker({
  icon: Icon,
  label,
  current,
  options,
  emptyLabel,
  emptyTone,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  current: { id: number; name: string; color: string | null } | null;
  options: Array<{ id: number; name: string; color: string | null }>;
  emptyLabel: string;
  emptyTone?: "warning";
  onChange: (newId: number | null) => void | Promise<void>;
}) {
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = options.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );
  const badgeStyle = current?.color
    ? {
        borderColor: `${current.color}66`,
        color: current.color,
        backgroundColor: `${current.color}10`,
      }
    : undefined;
  const emptyClass =
    emptyTone === "warning"
      ? "text-amber-700 border-amber-300 bg-amber-50"
      : "text-muted-foreground/70";

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="group/picker inline-flex items-center"
          aria-label={`Changer ${label.toLowerCase()}`}
          title={`Cliquer pour changer le ${label.toLowerCase()}`}
        >
          {current ? (
            <Badge
              variant="outline"
              className="text-[10px] font-medium gap-1 cursor-pointer transition group-hover/picker:ring-2 group-hover/picker:ring-offset-1 group-hover/picker:ring-[#0F2D52]/30"
              style={badgeStyle}
            >
              <Icon className="h-2.5 w-2.5" />
              {current.name}
            </Badge>
          ) : (
            <Badge variant="outline" className={`text-[10px] cursor-pointer transition group-hover/picker:ring-2 group-hover/picker:ring-offset-1 group-hover/picker:ring-[#0F2D52]/30 ${emptyClass}`}>
              <Icon className="h-2.5 w-2.5 mr-1" />
              {emptyLabel}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-1 pb-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          Changer le {label.toLowerCase()}
        </div>
        <Input
          autoFocus
          placeholder={`Rechercher un ${label.toLowerCase()}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm mb-2"
        />
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          <button
            type="button"
            onClick={async () => { setOpen(false); await onChange(null); }}
            className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/60 transition ${
              !current ? "bg-muted/40 font-medium" : ""
            }`}
          >
            <span className="text-muted-foreground italic">{emptyLabel}</span>
          </button>
          {filtered.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground italic">{tc("no_results")}</p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={async () => { setOpen(false); await onChange(o.id); }}
                className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/60 flex items-center gap-2 transition ${
                  current?.id === o.id ? "bg-muted/40 font-medium" : ""
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: o.color ?? "#94a3b8" }}
                />
                <span>{o.name}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── StatCard helper pour overview stats équipe ──
function StatCard({
  label, value, hint, accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent: "emerald" | "amber" | "red" | "blue" | "muted";
}) {
  const accentMap = {
    emerald: { text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
    amber: { text: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
    red: { text: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
    blue: { text: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
    muted: { text: "text-muted-foreground", bg: "bg-card", border: "border-border" },
  };
  const a = accentMap[accent];
  return (
    <div className={cn("rounded-lg border p-3 transition-all hover:shadow-sm", a.bg, a.border)}>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground truncate">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums mt-0.5", a.text)}>{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
    </div>
  );
}
