"use client";
// Dialog création/édition d'un rôle RBAC custom.
// Affiche une matrice (ressource × action) avec cases à cocher.
// Les rôles système (isSystem=true) sont en lecture seule sauf pour super_admin.
import { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
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
const RESOURCE_GROUPS: { labelKey: string; resources: { key: string; labelKey: string }[] }[] = [
  {
    labelKey: "grp_donnees_metier_clients",
    resources: [
      { key: "clients", labelKey: "res_clients" },
      { key: "invoices", labelKey: "res_invoices" },
      { key: "quotes", labelKey: "res_quotes" },
      { key: "contracts", labelKey: "res_contracts" },
      { key: "mandates", labelKey: "res_mandates" },
      { key: "payments", labelKey: "res_payments" },
      { key: "expenses", labelKey: "res_expenses" },
      { key: "refunds", labelKey: "res_refunds" },
      { key: "disputes", labelKey: "res_disputes" },
      { key: "documents", labelKey: "res_documents" },
      { key: "requests", labelKey: "res_requests" },
    ],
  },
  {
    labelKey: "grp_communication",
    resources: [
      { key: "messages", labelKey: "res_messages" },
      { key: "calendar", labelKey: "res_calendar" },
      { key: "appointments", labelKey: "res_appointments" },
      { key: "message_templates", labelKey: "res_message_templates" },
    ],
  },
  {
    labelKey: "grp_comptabilite",
    resources: [
      { key: "transactions", labelKey: "res_transactions" },
      { key: "tax_declarations", labelKey: "res_tax_declarations" },
      { key: "finance", labelKey: "res_finance" },
      { key: "reconciliation", labelKey: "res_reconciliation" },
    ],
  },
  {
    // Module RH (/admin/employes). « Écrire » = accès gestion.
    // « Dossiers employés » (hr) est le passe-partout : écrire ici donne
    // aussi tous les domaines RH ci-dessous.
    // L'accès « mon équipe » des managers vient de la hiérarchie
    // (manager direct / chef d'équipe), pas de ces cases.
    labelKey: "grp_ressources_humaines",
    resources: [
      { key: "hr", labelKey: "res_hr" },
      { key: "hr_documents", labelKey: "res_hr_documents" },
      { key: "leaves", labelKey: "res_leaves" },
      { key: "timeclock", labelKey: "res_timeclock" },
      { key: "payroll", labelKey: "res_payroll" },
      { key: "performance", labelKey: "res_performance" },
      { key: "safety", labelKey: "res_safety" },
      { key: "hr_comms", labelKey: "res_hr_comms" },
    ],
  },
  {
    // Config du portail client et du site web PILOTEE DEPUIS L'ADMIN.
    // Pensee pour les informaticiens/developpeurs qui gerent les deux.
    labelKey: "grp_portail_client_site_web",
    resources: [
      { key: "client_portal", labelKey: "res_client_portal" },
      { key: "website", labelKey: "res_website" },
    ],
  },
  {
    labelKey: "grp_systeme",
    resources: [
      { key: "workflow", labelKey: "res_workflow" },
      { key: "audit_trail", labelKey: "res_audit_trail" },
      { key: "statistics", labelKey: "res_statistics" },
    ],
  },
  {
    labelKey: "grp_configuration",
    resources: [
      { key: "settings", labelKey: "res_settings" },
      { key: "users", labelKey: "res_users" },
      { key: "roles", labelKey: "res_roles" },
      { key: "positions", labelKey: "res_positions" },
      { key: "integrations", labelKey: "res_integrations" },
      { key: "automations", labelKey: "res_automations" },
      { key: "branding", labelKey: "res_branding" },
    ],
  },
  {
    labelKey: "grp_contenu",
    resources: [
      { key: "blog", labelKey: "res_blog" },
      { key: "pages", labelKey: "res_pages" },
      { key: "email_templates", labelKey: "res_email_templates" },
      { key: "pdf_templates", labelKey: "res_pdf_templates" },
    ],
  },
  {
    labelKey: "grp_catalogues",
    resources: [
      { key: "industries", labelKey: "res_industries" },
      { key: "client_tags", labelKey: "res_client_tags" },
      { key: "client_sources", labelKey: "res_client_sources" },
      { key: "expense_categories", labelKey: "res_expense_categories" },
    ],
  },
];

const ACTIONS: { key: "read" | "write" | "delete" | "export"; labelKey: string }[] = [
  { key: "read", labelKey: "perm_read" },
  { key: "write", labelKey: "perm_write" },
  { key: "delete", labelKey: "perm_delete" },
  { key: "export", labelKey: "perm_export" },
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
  const t = useTranslations("admin.team");
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

      startTransition(async () => {
        const result = await updateRoleAction({
          id: role!.id,
          description: description || null,
          color,
        });
        if (result.success) {
          toast.success(t("role_mis_jour"));
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
          toast.success(t("role_cree"));
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
          toast.success(t("role_mis_jour"));
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

        <div className="bg-gradient-to-br from-[#0F2D52] to-[#1A5FB4] text-white px-6 py-5 flex items-center gap-3.5 shrink-0">
          <div
            className="h-11 w-11 rounded-lg flex items-center justify-center shadow-sm ring-2 ring-white/20"
            style={{ backgroundColor: color }}
          >
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-white text-base font-semibold leading-tight truncate">
              {mode === "create" ? t("nouveau_role") : role?.name}
            </DialogTitle>
            <p className="text-xs text-white/75 mt-0.5">
              {isReadOnly ? t("role_systeme_permissions_verrouillees") : t("definissez_permissions_ressource")}
            </p>
          </div>
          <Badge className="bg-white/20 hover:bg-white/20 text-white text-[10px] font-medium border-white/10 shrink-0">
            {totalChecked} / {maxPossible}
          </Badge>
        </div>


        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t("code_identifiant_interne")} hint={t("minuscules_sans_espaces_utilise_code")}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="gestionnaire_ventes"
                disabled={mode === "edit"}
                className="font-mono text-sm"
              />
            </Field>
            <Field label={t("couleur")}>
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
          <Field label={t("description")}>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={t("quoi_sert_role")}
              className="text-sm"
            />
          </Field>


          <FormSection icon={Palette} title={t("matrice_permissions")}>
            <div className="space-y-4">
              {RESOURCE_GROUPS.map((group) => (
                <div key={group.labelKey} className="rounded-lg border overflow-hidden">
                  <div className="bg-muted/40 px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-b">
                    {t(group.labelKey)}
                  </div>


                  <div className="hidden md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
                          <th className="text-left px-3 py-2 font-semibold">{t("ressource")}</th>
                          {ACTIONS.map((a) => (
                            <th key={a.key} className="text-center px-2 py-2 font-semibold w-20">{t(a.labelKey)}</th>
                          ))}
                          <th className="text-center px-2 py-2 font-semibold w-16">{t("tout")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.resources.map((r) => {
                          const checked = permissions[r.key] ?? [];
                          const allChecked = ACTIONS.every((a) => checked.includes(a.key));
                          return (
                            <tr key={r.key} className="border-b last:border-b-0 hover:bg-muted/20">
                              <td className="px-3 py-2 font-medium">{t(r.labelKey)}</td>
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


                  <div className="md:hidden divide-y">
                    {group.resources.map((r) => {
                      const checked = permissions[r.key] ?? [];
                      const allChecked = ACTIONS.every((a) => checked.includes(a.key));
                      return (
                        <div key={r.key} className="p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm">{t(r.labelKey)}</span>
                            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                              <Checkbox
                                checked={allChecked}
                                onCheckedChange={(v) => toggleAllForResource(r.key, !!v)}
                                disabled={isReadOnly}
                              />
                              {t("tout")}
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
                                  {t(a.labelKey)}
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


        <div className="border-t bg-muted/30 px-6 py-3 flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {isReadOnly && mode === "edit" ? t("fermer") : t("annuler")}
          </Button>
          <Button onClick={handleSave} disabled={pending} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90 shadow-sm">
            {pending ? "..." : mode === "create" ? t("creer_role") : t("enregistrer")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
