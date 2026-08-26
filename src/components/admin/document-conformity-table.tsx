"use client";
// ─────────────────────────────────────────────────────────
// DocumentConformityTable — tableau admin "Conformité"
//
// Layout Excel-style :
//   - lignes : employés
//   - colonnes : templates de documents légaux
//   - cellule : pastille colorée (vert = à jour, ambre = ancienne
//     version, rouge = jamais signé) + bouton Relancer / Demander
//
// Filtres : par template, par équipe, par statut (à jour / en retard / jamais).
// KPI global de conformité affiché en haut.
//
// TODO(backend) : actions onRemind / onRequest sont des callbacks
// fournis par la page. Côté serveur : POST /api/admin/signature-requests
// pour création bulk et POST /api/admin/signature-requests/[id]/remind.
// ─────────────────────────────────────────────────────────
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Check,
  X,
  AlertTriangle,
  Search,
  Send,
  BellRing,
  ShieldCheck,
  Users,
  FileText,
  CheckSquare,
  Square,
  Filter,
  BookOpen,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { DocumentStatsCard } from "@/components/admin/document-stats-card";
import { cn } from "@/lib/utils";

type Template = {
  id: number;
  title: string;
  key: string;
  version: string;
  isRequired: boolean;
};

// Mission 1 : un cahier (handbook) = 1 colonne unique dans la conformite.
// La signature collective est trackee via DocumentHandbookSignature.
type HandbookLite = {
  id: number;
  key: string;
  title: string;
  version: string;
  isRequired: boolean;
  isActive: boolean;
  items: Array<{ templateId: number; orderIndex: number }>;
};

type HandbookSignatureLite = {
  id: number;
  adminId: number;
  handbookId: number;
  version: string;
  signedAt: string;
};

type Employee = {
  id: number;
  fullName: string | null;
  email: string;
  team?: { id?: number; name: string } | null;
};

type SignatureRow = {
  adminId: number;
  templateId: number;
  version: string;
  signedAt: string;
};

type CellStatus = "signed_current" | "signed_outdated" | "missing";

// Type union "colonne" : soit un template standalone, soit un cahier.
type ColumnItem =
  | { kind: "template"; template: Template }
  | { kind: "handbook"; handbook: HandbookLite };

function cellStatus(
  template: Template,
  employeeId: number,
  signatures: SignatureRow[]
): { status: CellStatus; signedAt?: string; version?: string } {
  // On prend la signature la plus récente de cet employé pour ce template
  const sigs = signatures.filter(
    (s) => s.adminId === employeeId && s.templateId === template.id
  );
  if (sigs.length === 0) return { status: "missing" };
  const latest = sigs.reduce((a, b) =>
    new Date(a.signedAt) > new Date(b.signedAt) ? a : b
  );
  return {
    status:
      latest.version === template.version
        ? "signed_current"
        : "signed_outdated",
    signedAt: latest.signedAt,
    version: latest.version,
  };
}

function handbookCellStatus(
  handbook: HandbookLite,
  employeeId: number,
  signatures: HandbookSignatureLite[],
): { status: CellStatus; signedAt?: string; version?: string } {
  const sigs = signatures.filter(
    (s) => s.adminId === employeeId && s.handbookId === handbook.id,
  );
  if (sigs.length === 0) return { status: "missing" };
  const latest = sigs.reduce((a, b) =>
    new Date(a.signedAt) > new Date(b.signedAt) ? a : b,
  );
  return {
    status:
      latest.version === handbook.version ? "signed_current" : "signed_outdated",
    signedAt: latest.signedAt,
    version: latest.version,
  };
}

export function DocumentConformityTable({
  templates,
  handbooks = [],
  handbookSignatures = [],
  employees,
  signatures,
  onRemind,
  onRequest,
  className,
}: {
  templates: Template[];
  handbooks?: HandbookLite[];
  handbookSignatures?: HandbookSignatureLite[];
  employees: Employee[];
  signatures: SignatureRow[];
  /** Envoie une relance individuelle (templateId, employeeId). */
  onRemind: (templateId: number, employeeId: number) => void | Promise<void>;
  /** Crée une demande de signature pour 1+ employés. */
  onRequest: (templateId: number, employeeIds: number[]) => void | Promise<void>;
  className?: string;
}) {
  const tc = useTranslations("common");
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "missing" | "outdated" | "current"
  >("all");

  const teams = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees) {
      if (e.team?.name) map.set(e.team.name, e.team.name);
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  // Mission 1 : colonnes = handbooks actifs (en premier) + templates standalone.
  // Filtrage : "all" / "h:<handbookId>" / "t:<templateId>".
  const allColumns: ColumnItem[] = useMemo(() => {
    const cols: ColumnItem[] = [];
    for (const h of handbooks.filter((h) => h.isActive)) {
      cols.push({ kind: "handbook", handbook: h });
    }
    for (const t of templates) {
      cols.push({ kind: "template", template: t });
    }
    return cols;
  }, [handbooks, templates]);

  const filteredColumns = useMemo(() => {
    if (templateFilter === "all") return allColumns;
    if (templateFilter.startsWith("h:")) {
      const id = Number(templateFilter.slice(2));
      return allColumns.filter((c) => c.kind === "handbook" && c.handbook.id === id);
    }
    if (templateFilter.startsWith("t:")) {
      const id = Number(templateFilter.slice(2));
      return allColumns.filter((c) => c.kind === "template" && c.template.id === id);
    }
    // backward compat : valeur numerique pure = templateId.
    return allColumns.filter((c) => c.kind === "template" && String(c.template.id) === templateFilter);
  }, [allColumns, templateFilter]);

  function statusForColumn(col: ColumnItem, employeeId: number): CellStatus {
    if (col.kind === "template") {
      return cellStatus(col.template, employeeId, signatures).status;
    }
    return handbookCellStatus(col.handbook, employeeId, handbookSignatures).status;
  }

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (teamFilter !== "all" && e.team?.name !== teamFilter) return false;
      if (q) {
        const hay = `${e.fullName ?? ""} ${e.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== "all") {
        const hasStatus = filteredColumns.some((c) => {
          const s = statusForColumn(c, e.id);
          if (statusFilter === "missing") return s === "missing";
          if (statusFilter === "outdated") return s === "signed_outdated";
          if (statusFilter === "current") return s === "signed_current";
          return false;
        });
        if (!hasStatus) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    employees,
    search,
    teamFilter,
    statusFilter,
    filteredColumns,
    signatures,
    handbookSignatures,
  ]);

  // Statistiques globales (sur colonnes filtrees obligatoires + tous les employés)
  const stats = useMemo(() => {
    let total = 0;
    let signedCurrent = 0;
    let outdated = 0;
    let missing = 0;
    for (const col of filteredColumns) {
      const isRequired =
        col.kind === "template" ? col.template.isRequired : col.handbook.isRequired;
      if (!isRequired) continue;
      for (const e of employees) {
        total += 1;
        const s = statusForColumn(col, e.id);
        if (s === "signed_current") signedCurrent += 1;
        else if (s === "signed_outdated") outdated += 1;
        else missing += 1;
      }
    }
    const pct = total > 0 ? Math.round((signedCurrent / total) * 100) : 100;
    return { total, signedCurrent, outdated, missing, pct };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredColumns, employees, signatures, handbookSignatures]);

  // Sélection multi-employés pour bulk request
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const toggleEmp = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => {
    if (selectedIds.size === filteredEmployees.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEmployees.map((e) => e.id)));
    }
  };

  // Bulk demande de signature : uniquement quand on filtre sur UN template standalone
  // (les cahiers ont leur propre workflow d'assignation collective).
  const bulkTemplateId = (() => {
    if (templateFilter === "all") return null;
    if (templateFilter.startsWith("t:")) {
      const id = Number(templateFilter.slice(2));
      return Number.isFinite(id) ? id : null;
    }
    // backward-compat : valeur numerique pure = templateId
    if (!templateFilter.startsWith("h:")) {
      const id = Number(templateFilter);
      return Number.isFinite(id) ? id : null;
    }
    return null;
  })();
  const canBulk =
    bulkTemplateId !== null && selectedIds.size > 0 && !Number.isNaN(bulkTemplateId);

  return (
    <div className={cn("space-y-4", className)}>
      {/* KPI globaux */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DocumentStatsCard
          label="Conformité"
          value={`${stats.pct}%`}
          icon={ShieldCheck}
          accent={stats.pct >= 90 ? "success" : stats.pct >= 60 ? "warning" : "danger"}
          hint={`${stats.signedCurrent} / ${stats.total} signatures à jour`}
        />
        <DocumentStatsCard
          label="À jour"
          value={stats.signedCurrent}
          icon={Check}
          accent="success"
        />
        <DocumentStatsCard
          label="Version périmée"
          value={stats.outdated}
          icon={AlertTriangle}
          accent="warning"
        />
        <DocumentStatsCard
          label="Jamais signé"
          value={stats.missing}
          icon={X}
          accent="danger"
        />
      </div>

      {/* Filtres */}
      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <div className="relative flex-1">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un employé…"
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="h-9 text-sm md:w-40">
            <Users className="h-3.5 w-3.5 mr-1.5 text-[#0F2D52]" />
            <SelectValue placeholder="Équipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les équipes</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={templateFilter} onValueChange={setTemplateFilter}>
          <SelectTrigger className="h-9 text-sm md:w-56">
            <FileText className="h-3.5 w-3.5 mr-1.5 text-[#0F2D52]" />
            <SelectValue placeholder="Document" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les documents</SelectItem>
            {handbooks.filter((h) => h.isActive).length > 0 && (
              <SelectItem value="__sep_handbooks" disabled>
                — Cahiers —
              </SelectItem>
            )}
            {handbooks
              .filter((h) => h.isActive)
              .map((h) => (
                <SelectItem key={`h-${h.id}`} value={`h:${h.id}`}>
                  Cahier : {h.title}
                </SelectItem>
              ))}
            {templates.length > 0 && (
              <SelectItem value="__sep_templates" disabled>
                — Documents individuels —
              </SelectItem>
            )}
            {templates.map((t) => (
              <SelectItem key={`t-${t.id}`} value={`t:${t.id}`}>
                {t.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="h-9 text-sm md:w-44">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-[#0F2D52]" />
            <SelectValue placeholder={tc("status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="missing">Jamais signé</SelectItem>
            <SelectItem value="outdated">Version périmée</SelectItem>
            <SelectItem value="current">À jour</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Barre d'actions bulk */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-[#0F2D52]/5 border-[#0F2D52]/20 px-3 py-2">
          <span className="text-xs font-semibold text-[#0F2D52]">
            {selectedIds.size} employé{selectedIds.size > 1 ? "s" : ""} sélectionné{selectedIds.size > 1 ? "s" : ""}
          </span>
          <Button
            type="button"
            size="sm"
            className="h-7 text-[11px] bg-[#0F2D52] hover:bg-[#1a3a66] text-white ml-auto"
            disabled={!canBulk}
            onClick={() => {
              if (canBulk && bulkTemplateId !== null) {
                onRequest(bulkTemplateId, Array.from(selectedIds));
                setSelectedIds(new Set());
              }
            }}
          >
            <Send className="h-3 w-3 mr-1" />
            Demander la signature
          </Button>
          {!canBulk && (
            <span className="text-[10px] text-muted-foreground">
              Sélectionnez un document précis pour activer
            </span>
          )}
        </div>
      )}

      {/* Tableau */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#0F2D52] text-white sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-semibold w-8">
                  <button
                    type="button"
                    onClick={toggleAll}
                    aria-label="Tout sélectionner"
                    className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-white/15"
                  >
                    {selectedIds.size === filteredEmployees.length && filteredEmployees.length > 0 ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wider">
                  Employé
                </th>
                {filteredColumns.map((col) => {
                  const key = col.kind === "handbook" ? `h-${col.handbook.id}` : `t-${col.template.id}`;
                  const title = col.kind === "handbook" ? col.handbook.title : col.template.title;
                  const version = col.kind === "handbook" ? col.handbook.version : col.template.version;
                  const isRequired = col.kind === "handbook" ? col.handbook.isRequired : col.template.isRequired;
                  return (
                    <th
                      key={key}
                      className="px-2 py-2 text-center font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap"
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="inline-flex items-center gap-1 truncate max-w-[140px]" title={title}>
                          {col.kind === "handbook" && <BookOpen className="h-3 w-3 shrink-0" />}
                          <span className="truncate">{col.kind === "handbook" ? `Cahier : ${title}` : title}</span>
                        </span>
                        <span className="text-white/60 text-[9px] font-normal">
                          v{version}
                          {isRequired ? " · obligatoire" : ""}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((e, rowIdx) => (
                <tr
                  key={e.id}
                  className={cn(
                    "border-t",
                    rowIdx % 2 === 0 ? "bg-card" : "bg-muted/20",
                    "hover:bg-[#0F2D52]/5 transition"
                  )}
                >
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleEmp(e.id)}
                      aria-label={`Sélectionner ${e.fullName ?? e.email}`}
                      className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-muted"
                    >
                      {selectedIds.has(e.id) ? (
                        <CheckSquare className="h-4 w-4 text-[#0F2D52]" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-2 min-w-[200px]">
                    <p className="font-medium text-sm truncate">
                      {e.fullName ?? e.email}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {e.team?.name ?? "—"} · {e.email}
                    </p>
                  </td>
                  {filteredColumns.map((col) => {
                    if (col.kind === "template") {
                      const { status, signedAt, version } = cellStatus(
                        col.template,
                        e.id,
                        signatures,
                      );
                      return (
                        <td key={`t-${col.template.id}`} className="px-2 py-2 text-center">
                          <ConformityCell
                            status={status}
                            signedAt={signedAt}
                            version={version}
                            templateVersion={col.template.version}
                            onAction={() => {
                              if (status === "missing") {
                                onRequest(col.template.id, [e.id]);
                              } else {
                                onRemind(col.template.id, e.id);
                              }
                            }}
                          />
                        </td>
                      );
                    }
                    // handbook cell : pas d'action onRequest individuelle (signature collective)
                    const { status, signedAt, version } = handbookCellStatus(
                      col.handbook,
                      e.id,
                      handbookSignatures,
                    );
                    return (
                      <td key={`h-${col.handbook.id}`} className="px-2 py-2 text-center">
                        <ConformityCell
                          status={status}
                          signedAt={signedAt}
                          version={version}
                          templateVersion={col.handbook.version}
                          onAction={undefined}
                          isHandbook
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td
                    colSpan={2 + filteredColumns.length}
                    className="px-3 py-10 text-center text-sm text-muted-foreground"
                  >
                    Aucun employé ne correspond aux filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ConformityCell({
  status,
  signedAt,
  version,
  templateVersion,
  onAction,
  isHandbook = false,
}: {
  status: CellStatus;
  signedAt?: string;
  version?: string;
  templateVersion: string;
  /** Pour les cahiers : pas d'action individuelle (signature collective). */
  onAction?: () => void;
  isHandbook?: boolean;
}) {
  if (status === "signed_current") {
    const dateLabel = signedAt
      ? new Date(signedAt).toLocaleDateString("fr-CA")
      : "";
    return (
      <ActionTooltip label={`Signé le ${dateLabel} (v${version})`}>
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
          <Check className="h-3.5 w-3.5" />
        </span>
      </ActionTooltip>
    );
  }
  if (status === "signed_outdated") {
    return (
      <div className="inline-flex items-center gap-1">
        <ActionTooltip
          label={`Version périmée (signé v${version}, à jour v${templateVersion})`}
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" />
          </span>
        </ActionTooltip>
        {!isHandbook && onAction && (
          <ActionTooltip label="Envoyer un rappel">
            <button
              type="button"
              onClick={onAction}
              className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-amber-100 text-amber-700"
              aria-label="Rappel"
            >
              <BellRing className="h-3.5 w-3.5" />
            </button>
          </ActionTooltip>
        )}
      </div>
    );
  }
  // missing
  return (
    <div className="inline-flex items-center gap-1">
      <ActionTooltip label={isHandbook ? "Cahier non signe" : "Jamais signé"}>
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-700 ring-1 ring-red-200">
          <X className="h-3.5 w-3.5" />
        </span>
      </ActionTooltip>
      {!isHandbook && onAction && (
        <ActionTooltip label="Demander à signer">
          <button
            type="button"
            onClick={onAction}
            className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-red-100 text-red-700"
            aria-label="Demander à signer"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </ActionTooltip>
      )}
    </div>
  );
}
