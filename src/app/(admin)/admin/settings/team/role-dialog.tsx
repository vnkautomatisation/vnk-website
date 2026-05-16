"use client";
// Dialog création/édition d'un rôle RBAC custom.
// Affiche une matrice (ressource × action) avec cases à cocher.
// Les rôles système (isSystem=true) sont en lecture seule sauf pour super_admin.
import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Shield, Palette } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { createRoleAction, updateRoleAction } from "@/app/actions/roles";
import type { RoleRow } from "./team-view";

// Liste des ressources (doit rester synchronisée avec src/lib/rbac.ts)
const RESOURCE_GROUPS: { label: string; resources: { key: string; label: string }[] }[] = [
  {
    label: "Données métier",
    resources: [
      { key: "clients", label: "Clients" },
      { key: "invoices", label: "Factures" },
      { key: "quotes", label: "Devis" },
      { key: "contracts", label: "Contrats" },
      { key: "mandates", label: "Mandats" },
      { key: "payments", label: "Paiements" },
      { key: "expenses", label: "Dépenses" },
      { key: "refunds", label: "Remboursements" },
      { key: "disputes", label: "Litiges" },
      { key: "documents", label: "Documents" },
    ],
  },
  {
    label: "Communication",
    resources: [
      { key: "messages", label: "Messages" },
      { key: "calendar", label: "Calendrier" },
      { key: "appointments", label: "Rendez-vous" },
    ],
  },
  {
    label: "Comptabilité",
    resources: [
      { key: "transactions", label: "Transactions" },
      { key: "tax_declarations", label: "Déclarations fiscales" },
      { key: "finance", label: "Tableau financier" },
      { key: "reconciliation", label: "Réconciliation" },
    ],
  },
  {
    label: "Système",
    resources: [
      { key: "workflow", label: "Workflow" },
      { key: "audit_trail", label: "Journal d'audit" },
    ],
  },
  {
    label: "Configuration",
    resources: [
      { key: "settings", label: "Paramètres" },
      { key: "users", label: "Utilisateurs" },
      { key: "roles", label: "Rôles" },
      { key: "positions", label: "Postes" },
      { key: "integrations", label: "Intégrations" },
      { key: "automations", label: "Automatisations" },
      { key: "branding", label: "Charte graphique" },
    ],
  },
  {
    label: "Contenu",
    resources: [
      { key: "blog", label: "Blog" },
      { key: "pages", label: "Pages publiques" },
      { key: "email_templates", label: "Modèles emails" },
      { key: "pdf_templates", label: "Modèles PDF" },
    ],
  },
  {
    label: "Catalogues",
    resources: [
      { key: "industries", label: "Industries" },
      { key: "client_tags", label: "Étiquettes clients" },
      { key: "client_sources", label: "Sources clients" },
      { key: "expense_categories", label: "Catégories dépenses" },
    ],
  },
];

const ACTIONS: { key: "read" | "write" | "delete" | "export"; label: string }[] = [
  { key: "read", label: "Lire" },
  { key: "write", label: "Écrire" },
  { key: "delete", label: "Supprimer" },
  { key: "export", label: "Exporter" },
];

const COLORS = ["#0F2D52", "#1A5FB4", "#26A269", "#E5A50A", "#613583", "#C01C28", "#6b7280"];

export function RoleDialog({
  open, onOpenChange, role, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleRow | null;
  onSaved: () => void;
}) {
  const mode = role ? "edit" : "create";
  const isReadOnly = !!role?.isSystem; // affichage seul pour les rôles système
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (open) {
      if (role) {
        setName(role.name);
        setDescription(role.description ?? "");
        setColor(role.color ?? COLORS[0]);
        setPermissions(role.permissions || {});
      } else {
        setName("");
        setDescription("");
        setColor(COLORS[0]);
        setPermissions({});
      }
    }
  }, [open, role]);

  const togglePermission = (resource: string, action: string) => {
    if (isReadOnly) return;
    setPermissions((prev) => {
      const current = prev[resource] ?? [];
      const next = current.includes(action)
        ? current.filter((a) => a !== action)
        : [...current, action];
      const updated = { ...prev };
      if (next.length === 0) delete updated[resource];
      else updated[resource] = next;
      return updated;
    });
  };

  const toggleAllForResource = (resource: string, checked: boolean) => {
    if (isReadOnly) return;
    setPermissions((prev) => {
      const updated = { ...prev };
      if (checked) updated[resource] = ["read", "write", "delete", "export"];
      else delete updated[resource];
      return updated;
    });
  };

  const handleSave = () => {
    if (isReadOnly && mode === "edit") {
      // Permettre uniquement description/color sur les rôles système
      startTransition(async () => {
        const result = await updateRoleAction({
          id: role!.id,
          description: description || null,
          color,
        });
        if (result.success) {
          toast.success("Rôle mis à jour");
          onSaved(); onOpenChange(false);
        } else {
          toast.error(result.error);
        }
      });
      return;
    }
    startTransition(async () => {
      if (mode === "create") {
        const result = await createRoleAction({
          name: name.toLowerCase().replace(/\s+/g, "_"),
          description: description || null,
          color,
          permissions: permissions as never,
        });
        if (result.success) {
          toast.success("Rôle créé");
          onSaved(); onOpenChange(false);
        } else {
          toast.error(result.error);
        }
      } else if (role) {
        const result = await updateRoleAction({
          id: role.id,
          description: description || null,
          color,
          permissions: permissions as never,
        });
        if (result.success) {
          toast.success("Rôle mis à jour");
          onSaved(); onOpenChange(false);
        } else {
          toast.error(result.error);
        }
      }
    });
  };

  const totalChecked = Object.values(permissions).reduce((sum, arr) => sum + arr.length, 0);
  const allResources = RESOURCE_GROUPS.flatMap((g) => g.resources);
  const maxPossible = allResources.length * ACTIONS.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header VNK navy */}
        <div className="bg-[#0F2D52] text-white px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: color }}>
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <DialogTitle className="text-white text-base">
              {mode === "create" ? "Nouveau rôle" : role?.name}
            </DialogTitle>
            <p className="text-xs text-white/70">
              {isReadOnly ? "Rôle système — permissions verrouillées" : "Définissez les permissions par ressource"}
            </p>
          </div>
          <div className="ml-auto">
            <Badge className="bg-white/20 hover:bg-white/20 text-white text-[10px]">
              {totalChecked} / {maxPossible} permissions
            </Badge>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Métadonnées */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Code (identifiant interne)
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="gestionnaire_ventes"
                disabled={mode === "edit"}
                className="font-mono text-sm mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Minuscules, sans espaces (utilisé par le code)</p>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                <Palette className="h-3 w-3 inline mr-1" />Couleur
              </Label>
              <div className="flex gap-1.5 mt-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-md border-2 ${color === c ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="À quoi sert ce rôle ?"
              className="mt-1 text-sm"
            />
          </div>

          {/* Matrice de permissions */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52] mb-3">
              Matrice de permissions
            </p>
            <div className="space-y-4">
              {RESOURCE_GROUPS.map((group) => (
                <div key={group.label} className="rounded-lg border overflow-hidden">
                  <div className="bg-muted/40 px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-b">
                    {group.label}
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="text-left px-3 py-2 font-semibold">Ressource</th>
                        {ACTIONS.map((a) => (
                          <th key={a.key} className="text-center px-2 py-2 font-semibold w-20">{a.label}</th>
                        ))}
                        <th className="text-center px-2 py-2 font-semibold w-16">Tout</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.resources.map((r) => {
                        const checked = permissions[r.key] ?? [];
                        const allChecked = ACTIONS.every((a) => checked.includes(a.key));
                        return (
                          <tr key={r.key} className="border-b last:border-b-0 hover:bg-muted/20">
                            <td className="px-3 py-2 font-medium">{r.label}</td>
                            {ACTIONS.map((a) => (
                              <td key={a.key} className="text-center px-2 py-2">
                                <Checkbox
                                  checked={checked.includes(a.key)}
                                  onCheckedChange={() => togglePermission(r.key, a.key)}
                                  disabled={isReadOnly}
                                />
                              </td>
                            ))}
                            <td className="text-center px-2 py-2">
                              <Checkbox
                                checked={allChecked}
                                onCheckedChange={(v) => toggleAllForResource(r.key, !!v)}
                                disabled={isReadOnly}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/30 px-6 py-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {isReadOnly && mode === "edit" ? "Fermer" : "Annuler"}
          </Button>
          <Button onClick={handleSave} disabled={pending} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
            {pending ? "..." : mode === "create" ? "Créer le rôle" : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
