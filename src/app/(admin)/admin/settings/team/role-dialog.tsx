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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FormSection, Field } from "@/components/admin/form-section";
import { cn } from "@/lib/utils";
import { createRoleAction, updateRoleAction } from "@/app/actions/roles";
import type { RoleRow } from "./team-view";

// Liste des ressources (doit rester synchronisée avec src/lib/rbac.ts)
const RESOURCE_GROUPS: { label: string; resources: { key: string; label: string }[] }[] = [
  {
    label: "Données métier (clients)",
    resources: [
      { key: "clients", label: "Clients" },
      { key: "invoices", label: "Factures" },
      { key: "quotes", label: "Devis" },
      { key: "contracts", label: "Contrats clients" },
      { key: "mandates", label: "Mandats" },
      { key: "payments", label: "Paiements" },
      { key: "expenses", label: "Dépenses" },
      { key: "refunds", label: "Remboursements" },
      { key: "disputes", label: "Litiges" },
      { key: "documents", label: "Documents clients" },
      { key: "requests", label: "Demandes clients" },
    ],
  },
  {
    label: "Communication",
    resources: [
      { key: "messages", label: "Messages" },
      { key: "calendar", label: "Calendrier (RDV clients)" },
      { key: "appointments", label: "Rendez-vous" },
      { key: "message_templates", label: "Modèles de messages" },
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
    // Module RH (/admin/employes). « Écrire » = accès gestion.
    // « Dossiers employés » (hr) est le passe-partout : écrire ici donne
    // aussi tous les domaines RH ci-dessous.
    // L'accès « mon équipe » des managers vient de la hiérarchie
    // (manager direct / chef d'équipe), pas de ces cases.
    label: "Ressources humaines",
    resources: [
      { key: "hr", label: "Dossiers employés (passe-partout RH)" },
      { key: "hr_documents", label: "Documents RH & contrats d'emploi" },
      { key: "leaves", label: "Congés" },
      { key: "timeclock", label: "Pointage & codes de tâche" },
      { key: "payroll", label: "Paie & docs fiscaux" },
      { key: "performance", label: "Évaluations & 1-on-1" },
      { key: "safety", label: "SST, formations & permis" },
      { key: "hr_comms", label: "Annonces internes" },
    ],
  },
  {
    // Config du portail client et du site web PILOTEE DEPUIS L'ADMIN.
    // Pensee pour les informaticiens/developpeurs qui gerent les deux.
    label: "Portail client & site web",
    resources: [
      { key: "client_portal", label: "Portail client (config & visuel)" },
      { key: "website", label: "Site web public" },
    ],
  },
  {
    label: "Système",
    resources: [
      { key: "workflow", label: "Workflow" },
      { key: "audit_trail", label: "Journal d'audit" },
      { key: "statistics", label: "Statistiques" },
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
        {/* Header VNK navy avec gradient */}
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#1A5FB4] text-white px-6 py-5 flex items-center gap-3.5 shrink-0">
          <div
            className="h-11 w-11 rounded-lg flex items-center justify-center shadow-sm ring-2 ring-white/20"
            style={{ backgroundColor: color }}
          >
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-white text-base font-semibold leading-tight truncate">
              {mode === "create" ? "Nouveau rôle" : role?.name}
            </DialogTitle>
            <p className="text-xs text-white/75 mt-0.5">
              {isReadOnly ? "Rôle système — permissions verrouillées" : "Définissez les permissions par ressource"}
            </p>
          </div>
          <Badge className="bg-white/20 hover:bg-white/20 text-white text-[10px] font-medium border-white/10 shrink-0">
            {totalChecked} / {maxPossible}
          </Badge>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Métadonnées */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Code (identifiant interne)" hint="Minuscules, sans espaces (utilisé par le code)">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="gestionnaire_ventes"
                disabled={mode === "edit"}
                className="font-mono text-sm"
              />
            </Field>
            <Field label="Couleur">
              <div className="flex gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "h-9 w-9 rounded-md border-2 transition-all hover:scale-105",
                      color === c ? "border-foreground shadow-md scale-105" : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </Field>
          </div>
          <Field label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="À quoi sert ce rôle ?"
              className="text-sm"
            />
          </Field>

          {/* Matrice de permissions */}
          <FormSection icon={Palette} title="Matrice de permissions">
            <div className="space-y-4">
              {RESOURCE_GROUPS.map((group) => (
                <div key={group.label} className="rounded-lg border overflow-hidden">
                  <div className="bg-muted/40 px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-b">
                    {group.label}
                  </div>

                  {/* ─── Vue desktop : tableau classique ─── */}
                  <div className="hidden md:block">
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

                  {/* ─── Vue mobile : cartes empilées avec chips ─── */}
                  <div className="md:hidden divide-y">
                    {group.resources.map((r) => {
                      const checked = permissions[r.key] ?? [];
                      const allChecked = ACTIONS.every((a) => checked.includes(a.key));
                      return (
                        <div key={r.key} className="p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm">{r.label}</span>
                            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                              <Checkbox
                                checked={allChecked}
                                onCheckedChange={(v) => toggleAllForResource(r.key, !!v)}
                                disabled={isReadOnly}
                              />
                              Tout
                            </label>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {ACTIONS.map((a) => {
                              const isOn = checked.includes(a.key);
                              return (
                                <button
                                  key={a.key}
                                  type="button"
                                  disabled={isReadOnly}
                                  onClick={() => togglePermission(r.key, a.key)}
                                  className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition ${
                                    isOn
                                      ? "bg-[#0F2D52] text-white border-[#0F2D52]"
                                      : "bg-white text-muted-foreground border-input hover:bg-muted/40"
                                  } ${isReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                >
                                  {a.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </FormSection>
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/30 px-6 py-3 flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {isReadOnly && mode === "edit" ? "Fermer" : "Annuler"}
          </Button>
          <Button onClick={handleSave} disabled={pending} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90 shadow-sm">
            {pending ? "..." : mode === "create" ? "Créer le rôle" : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
