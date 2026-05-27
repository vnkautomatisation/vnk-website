"use client";
// =============================================================
// BibliothequeView - hub centralise de TOUS les modeles de
// documents (legaux, contrats, politiques) — starters VNK +
// personnalises. Filtrage, recherche, KPIs, et actions
// contextuelles (apercu, utiliser, dupliquer, modifier, archiver).
//
// Convention VNK : header navy gradient, sticky bar finance,
// DocumentStatsCard, ConfirmDialog, ActionTooltip, FormSection,
// PdfPreviewModal via TemplatePdfPreviewButton.
// =============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpen,
  Library,
  Sparkles,
  User,
  Archive as ArchiveIcon,
  Search,
  ShieldCheck,
  FileText,
  Award,
  Layers,
  X,
  Briefcase,
  Building2,
  Lightbulb,
  Database,
  Check,
  ChevronDown,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { DocumentStatsCard } from "@/components/admin/document-stats-card";
import {
  TemplateLibraryCard,
  type LibraryTemplate,
} from "@/components/admin/template-library-card";
import {
  PickEmployeeForPreviewDialog,
  type PickEmployeeOption,
} from "@/components/admin/pick-employee-for-preview-dialog";
import { PdfPreviewModal } from "@/components/admin/pdf-preview-modal";
import {
  TemplateWizard,
  type TemplateWizardType,
  type TemplateWizardMode,
  type TemplateWizardInitial,
} from "@/components/admin/template-wizard";
import {
  SignatureRequestDialog,
  type SignatureRequestTemplate,
} from "@/components/admin/signature-request-dialog";
import { CONTRACT_TYPES } from "@/lib/document-templates/contract-types";
import {
  upsertLegalDocAction,
  duplicateLegalDocTemplateAction,
  toggleLegalDocActiveAction,
} from "@/app/actions/hr-legal-docs";
import {
  createContractTemplateAction,
  updateContractTemplateAction,
  duplicateContractTemplateAction,
  toggleContractTemplateActiveAction,
} from "@/app/actions/hr-contracts";
import {
  upsertHrPolicyAction,
  duplicateHrPolicyAction,
  toggleHrPolicyActiveAction,
} from "@/app/actions/hr-communications";
import { cn } from "@/lib/utils";

// ---------- Types ------------------------------------------------
type LegalRow = {
  id: number;
  key: string;
  title: string;
  category: string;
  version: string;
  bodyMarkdown: string;
  isActive: boolean;
  isRequired: boolean;
  isStarter: boolean;
  targetPositions: string[];
  targetDepartments: string[];
  createdAt: string;
  updatedAt: string;
  // Mission 5 : exposer acknowledgmentMode pour adapter le label du bouton.
  acknowledgmentMode?: "reading_only" | "signature";
};

type ContractRow = {
  id: number;
  name: string;
  contractType: string;
  bodyMarkdown: string;
  isActive: boolean;
  isStarter: boolean;
  targetPositions: string[];
  targetDepartments: string[];
  defaultSalary: number | string | null;
  defaultHoursPerWeek: number | null;
  defaultVacationPct: number | string | null;
  probationDays: number | null;
  createdAt: string;
  updatedAt: string;
};

type PolicyRow = {
  id: number;
  key: string;
  title: string;
  version: string;
  bodyMarkdown: string;
  isActive: boolean;
  isStarter: boolean;
  effectiveFrom: string;
  createdAt: string;
  updatedAt: string;
};

type EmployeeRow = {
  id: number;
  fullName: string | null;
  email?: string;
  position: string | null;
  avatarUrl: string | null;
  team?: { id: number; name: string } | null;
};

type TeamRow = { id: number; name: string };

interface Props {
  legalTemplates: LegalRow[];
  contractTemplates: ContractRow[];
  hrPolicies: PolicyRow[];
  employees: EmployeeRow[];
  teams?: TeamRow[];
}

// ---------- Helpers ----------------------------------------------
const LEGAL_CATEGORY_LABELS: Record<string, string> = {
  policy: "Politique",
  nda: "Confidentialité (NDA)",
  acknowledgment: "Accusé de réception",
};

function contractTypeLabel(value: string): string {
  return CONTRACT_TYPES.find((t) => t.value === value)?.label ?? value;
}

type StarterFilter = "all" | "starter" | "custom";
type CategoryTab = "all" | "legal" | "contract" | "policy";
type GroupBy = "category" | "department" | "position";

// Departements VNK officiels (toujours proposes dans le filtre)
const VNK_DEPARTMENTS = [
  "Direction",
  "Administration",
  "Comptabilité",
  "Ressources humaines",
  "Ingénierie",
  "Automatisation",
  "Technique",
  "Gestion de projet",
  "Ventes",
  "Support",
  "Service après-vente",
] as const;

const ALL_DEPARTMENTS_KEY = "__all_departments__";
const ALL_POSITIONS_KEY = "__all_positions__";

// Convertit chaque row en LibraryTemplate uniforme
function toLib(
  row: LegalRow | ContractRow | PolicyRow,
  kind: "legal" | "contract" | "policy",
): LibraryTemplate {
  if (kind === "legal") {
    const r = row as LegalRow;
    return {
      id: r.id,
      kind: "legal",
      title: r.title,
      categoryLabel: LEGAL_CATEGORY_LABELS[r.category] ?? r.category,
      version: r.version,
      isRequired: r.isRequired,
      isStarter: r.isStarter,
      isActive: r.isActive,
      targetPositions: r.targetPositions ?? [],
      targetDepartments: r.targetDepartments ?? [],
      bodyMarkdown: r.bodyMarkdown,
      updatedAt: r.updatedAt,
      acknowledgmentMode: r.acknowledgmentMode ?? "signature",
    };
  }
  if (kind === "contract") {
    const r = row as ContractRow;
    return {
      id: r.id,
      kind: "contract",
      title: r.name,
      categoryLabel: contractTypeLabel(r.contractType),
      version: undefined,
      isRequired: false,
      isStarter: r.isStarter,
      isActive: r.isActive,
      targetPositions: r.targetPositions ?? [],
      targetDepartments: r.targetDepartments ?? [],
      bodyMarkdown: r.bodyMarkdown,
      updatedAt: r.updatedAt,
    };
  }
  const r = row as PolicyRow;
  return {
    id: r.id,
    kind: "policy",
    title: r.title,
    categoryLabel: "Politique RH",
    version: r.version,
    isRequired: false,
    isStarter: r.isStarter,
    isActive: r.isActive,
    targetPositions: [],
    targetDepartments: [],
    bodyMarkdown: r.bodyMarkdown,
    updatedAt: r.updatedAt,
  };
}

// =============================================================
// Component
// =============================================================
export function BibliothequeView({
  legalTemplates,
  contractTemplates,
  hrPolicies,
  employees,
  teams = [],
}: Props) {
  const router = useRouter();

  // ---- Filtres ----
  const [tab, setTab] = useState<CategoryTab>("all");
  const [starterFilter, setStarterFilter] = useState<StarterFilter>("all");
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [posFilter, setPosFilter] = useState<string[]>([]);
  const [posPickerOpen, setPosPickerOpen] = useState(false);
  const [posSearch, setPosSearch] = useState("");

  // ---- Filtre departements ----
  const [deptFilter, setDeptFilter] = useState<string[]>([]);
  const [deptPickerOpen, setDeptPickerOpen] = useState(false);
  const [deptSearch, setDeptSearch] = useState("");

  // ---- Mode de groupement ----
  const [groupBy, setGroupBy] = useState<GroupBy>("category");

  // ---- Widget "Documents recommandes pour un poste" ----
  const [recommendPosition, setRecommendPosition] = useState<string>("");
  const [recommendPickerOpen, setRecommendPickerOpen] = useState(false);
  const [recommendSearch, setRecommendSearch] = useState("");

  // ---- Sticky bar (pattern Finance) ----
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const s = sentinelRef.current;
    if (!s) return;
    const obs = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-64px 0px 0px 0px" },
    );
    obs.observe(s);
    return () => obs.disconnect();
  }, []);

  // ---- Normalisation ----
  const allItems = useMemo<LibraryTemplate[]>(() => {
    return [
      ...legalTemplates.map((r) => toLib(r, "legal")),
      ...contractTemplates.map((r) => toLib(r, "contract")),
      ...hrPolicies.map((r) => toLib(r, "policy")),
    ];
  }, [legalTemplates, contractTemplates, hrPolicies]);

  // ---- Postes uniques pour le filtre ----
  const allPositions = useMemo(() => {
    const set = new Set<string>();
    for (const it of allItems) {
      for (const p of it.targetPositions) set.add(p);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [allItems]);

  const filteredPositions = useMemo(() => {
    const q = posSearch.trim().toLowerCase();
    if (!q) return allPositions;
    return allPositions.filter((p) => p.toLowerCase().includes(q));
  }, [allPositions, posSearch]);

  // ---- Departements uniques pour le filtre ----
  const allDepartments = useMemo(() => {
    const set = new Set<string>(VNK_DEPARTMENTS);
    for (const it of allItems) {
      for (const d of it.targetDepartments) {
        if (d && d.trim()) set.add(d);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [allItems]);

  const filteredDepartments = useMemo(() => {
    const q = deptSearch.trim().toLowerCase();
    if (!q) return allDepartments;
    return allDepartments.filter((d) => d.toLowerCase().includes(q));
  }, [allDepartments, deptSearch]);

  const filteredRecommendPositions = useMemo(() => {
    const q = recommendSearch.trim().toLowerCase();
    if (!q) return allPositions;
    return allPositions.filter((p) => p.toLowerCase().includes(q));
  }, [allPositions, recommendSearch]);

  // ---- Recommandations pour le poste selectionne ----
  const recommendedItems = useMemo<LibraryTemplate[]>(() => {
    if (!recommendPosition) return [];
    const target = recommendPosition.toLowerCase();
    return allItems.filter((i) => {
      if (!i.isActive) return false;
      // Politique RH (pas de targeting) -> generique, montre toujours
      if (i.kind === "policy") return true;
      // Pas de positions => generique
      if (!i.targetPositions || i.targetPositions.length === 0) return true;
      return i.targetPositions.some((p) => p.toLowerCase() === target);
    });
  }, [allItems, recommendPosition]);

  // ---- KPIs (calcules sur la totalite, pas filtres) ----
  const kpis = useMemo(() => {
    const total = allItems.length;
    const starters = allItems.filter((i) => i.isStarter).length;
    const custom = allItems.filter((i) => !i.isStarter).length;
    const archived = allItems.filter((i) => !i.isActive).length;
    return { total, starters, custom, archived };
  }, [allItems]);

  // ---- Filtrage ----
  const filteredItems = useMemo(() => {
    let out = allItems;

    if (!includeArchived) {
      out = out.filter((i) => i.isActive);
    }

    if (tab !== "all") {
      out = out.filter((i) => i.kind === tab);
    }

    if (starterFilter === "starter") {
      out = out.filter((i) => i.isStarter);
    } else if (starterFilter === "custom") {
      out = out.filter((i) => !i.isStarter);
    }

    if (posFilter.length > 0) {
      const wanted = new Set(posFilter.map((p) => p.toLowerCase()));
      out = out.filter((i) =>
        i.targetPositions.some((p) => wanted.has(p.toLowerCase())),
      );
    }

    if (deptFilter.length > 0) {
      const wanted = new Set(deptFilter.map((d) => d.toLowerCase()));
      out = out.filter((i) => {
        // Vide = generique (tous departements) -> match toujours
        if (!i.targetDepartments || i.targetDepartments.length === 0) {
          return true;
        }
        return i.targetDepartments.some((d) => wanted.has(d.toLowerCase()));
      });
    }

    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter(
        (i) =>
          i.title.toLowerCase().includes(q)
          || (i.categoryLabel ?? "").toLowerCase().includes(q)
          || i.bodyMarkdown.toLowerCase().includes(q),
      );
    }

    return out;
  }, [allItems, tab, starterFilter, query, includeArchived, posFilter, deptFilter]);

  // ---- Groupement par kind pour affichage ----
  const grouped = useMemo(() => {
    const g: Record<"legal" | "contract" | "policy", LibraryTemplate[]> = {
      legal: [],
      contract: [],
      policy: [],
    };
    for (const i of filteredItems) g[i.kind].push(i);
    return g;
  }, [filteredItems]);

  // ---- Groupement par departement ----
  const groupedByDepartment = useMemo(() => {
    const map = new Map<string, LibraryTemplate[]>();
    map.set(ALL_DEPARTMENTS_KEY, []);
    for (const i of filteredItems) {
      if (!i.targetDepartments || i.targetDepartments.length === 0) {
        map.get(ALL_DEPARTMENTS_KEY)!.push(i);
        continue;
      }
      for (const d of i.targetDepartments) {
        if (!map.has(d)) map.set(d, []);
        map.get(d)!.push(i);
      }
    }
    // Trie alphabetique des cles (sauf "tous" en dernier)
    const sortedKeys = Array.from(map.keys())
      .filter((k) => k !== ALL_DEPARTMENTS_KEY && map.get(k)!.length > 0)
      .sort((a, b) => a.localeCompare(b, "fr"));
    const result: { key: string; label: string; items: LibraryTemplate[] }[] = [];
    for (const k of sortedKeys) {
      result.push({ key: k, label: k, items: map.get(k)! });
    }
    const generic = map.get(ALL_DEPARTMENTS_KEY)!;
    if (generic.length > 0) {
      result.push({
        key: ALL_DEPARTMENTS_KEY,
        label: "Tous départements (génériques)",
        items: generic,
      });
    }
    return result;
  }, [filteredItems]);

  // ---- Groupement par poste ----
  const groupedByPosition = useMemo(() => {
    const map = new Map<string, LibraryTemplate[]>();
    map.set(ALL_POSITIONS_KEY, []);
    for (const i of filteredItems) {
      if (!i.targetPositions || i.targetPositions.length === 0) {
        map.get(ALL_POSITIONS_KEY)!.push(i);
        continue;
      }
      for (const p of i.targetPositions) {
        if (!map.has(p)) map.set(p, []);
        map.get(p)!.push(i);
      }
    }
    const sortedKeys = Array.from(map.keys())
      .filter((k) => k !== ALL_POSITIONS_KEY && map.get(k)!.length > 0)
      .sort((a, b) => a.localeCompare(b, "fr"));
    const result: { key: string; label: string; items: LibraryTemplate[] }[] = [];
    for (const k of sortedKeys) {
      result.push({ key: k, label: k, items: map.get(k)! });
    }
    const generic = map.get(ALL_POSITIONS_KEY)!;
    if (generic.length > 0) {
      result.push({
        key: ALL_POSITIONS_KEY,
        label: "Tous postes (génériques)",
        items: generic,
      });
    }
    return result;
  }, [filteredItems]);

  // ---- Dialog states ----
  const [wizard, setWizard] = useState<{
    open: boolean;
    type: TemplateWizardType;
    mode: TemplateWizardMode;
    initial?: TemplateWizardInitial;
    existingId?: number;
  } | null>(null);

  const [confirmArchive, setConfirmArchive] = useState<LibraryTemplate | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);

  // Demande de signature pre-remplie depuis une card de modele legal
  const [requestDialog, setRequestDialog] = useState<{
    open: boolean;
    template: SignatureRequestTemplate | null;
  }>({ open: false, template: null });

  // PDF preview sans employe pre-selectionne -> pick + open
  const [pickPreview, setPickPreview] = useState<LibraryTemplate | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const pickEmployees: PickEmployeeOption[] = useMemo(
    () => employees.map((e) => ({
      id: e.id,
      fullName: e.fullName,
      position: e.position,
      avatarUrl: e.avatarUrl,
    })),
    [employees],
  );

  // ---- Handlers ----
  const handleEdit = (tpl: LibraryTemplate) => {
    // Edition DIRECTE de tout template (Starter VNK inclus).
    // Le user peut modifier les modeles a sa guise — pas de duplication forcee.
    // Le bouton "Dupliquer" reste disponible separement pour qui veut une copie.
    const initial: TemplateWizardInitial = {
      title: tpl.title,
      bodyMarkdown: tpl.bodyMarkdown,
      version: tpl.version,
      targetPositions: tpl.targetPositions,
      targetDepartments: tpl.targetDepartments,
      isMandatory: tpl.isRequired,
    };
    if (tpl.kind === "legal") {
      const src = legalTemplates.find((r) => r.id === tpl.id);
      initial.key = src?.key;
      initial.category = src?.category;
    } else if (tpl.kind === "policy") {
      const src = hrPolicies.find((r) => r.id === tpl.id);
      initial.key = src?.key;
    } else if (tpl.kind === "contract") {
      const src = contractTemplates.find((r) => r.id === tpl.id);
      initial.category = src?.contractType;
    }
    setWizard({
      open: true,
      type: tpl.kind,
      mode: "edit",
      initial,
      existingId: tpl.id,
    });
  };

  const handleUse = (tpl: LibraryTemplate) => {
    // « Utiliser » = creer un nouveau modele pre-rempli a partir de ce
    // starter / template. Mode create, etape 2 (saute la bibliotheque).
    const initial: TemplateWizardInitial = {
      title: tpl.title,
      bodyMarkdown: tpl.bodyMarkdown,
      version: tpl.version,
      targetPositions: tpl.targetPositions,
      targetDepartments: tpl.targetDepartments,
      isMandatory: tpl.isRequired,
    };
    if (tpl.kind === "legal") {
      const src = legalTemplates.find((r) => r.id === tpl.id);
      initial.category = src?.category;
    } else if (tpl.kind === "contract") {
      const src = contractTemplates.find((r) => r.id === tpl.id);
      initial.category = src?.contractType;
    }
    setWizard({
      open: true,
      type: tpl.kind,
      mode: "create",
      initial,
    });
  };

  const handleDuplicate = async (tpl: LibraryTemplate) => {
    try {
      let res:
        | { success: true; data: { id: number; title?: string; name?: string } }
        | { success: false; error: string };
      if (tpl.kind === "legal") {
        res = await duplicateLegalDocTemplateAction({ id: tpl.id });
      } else if (tpl.kind === "contract") {
        res = await duplicateContractTemplateAction({ id: tpl.id });
      } else {
        res = await duplicateHrPolicyAction({ id: tpl.id });
      }
      if (!res.success) {
        toast.error(res.error || "Erreur de duplication");
        return;
      }
      toast.success("Modele duplique");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur de duplication");
    }
  };

  const handleArchive = (tpl: LibraryTemplate) => {
    setConfirmArchive(tpl);
  };

  const handleRequestSignature = (tpl: LibraryTemplate) => {
    if (tpl.kind !== "legal") return;
    setRequestDialog({
      open: true,
      template: {
        id: tpl.id,
        title: tpl.title,
        version: tpl.version,
      },
    });
  };

  const confirmArchiveAction = async () => {
    if (!confirmArchive) return;
    setArchiveBusy(true);
    try {
      const targetActive = !confirmArchive.isActive;
      let res: { success: boolean; error?: string };
      if (confirmArchive.kind === "legal") {
        res = await toggleLegalDocActiveAction({
          id: confirmArchive.id,
          isActive: targetActive,
        });
      } else if (confirmArchive.kind === "contract") {
        res = await toggleContractTemplateActiveAction({
          id: confirmArchive.id,
          isActive: targetActive,
        });
      } else {
        res = await toggleHrPolicyActiveAction({
          id: confirmArchive.id,
          isActive: targetActive,
        });
      }
      if (!res.success) {
        toast.error(res.error || "Erreur");
        return;
      }
      toast.success(targetActive ? "Modele restaure" : "Modele archive");
      setConfirmArchive(null);
      router.refresh();
    } finally {
      setArchiveBusy(false);
    }
  };

  // ---- Apercu PDF sans employe ----
  const handlePreviewWithoutEmployee = (tpl: LibraryTemplate) => {
    setPickPreview(tpl);
  };

  const generatePreviewPdf = async (employeeId: number) => {
    if (!pickPreview) return;
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/admin/document-templates/preview-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bodyMarkdown: pickPreview.bodyMarkdown,
          title: pickPreview.title,
          documentType: pickPreview.kind,
          employeeId,
          metadata: { version: pickPreview.version || "1.0" },
        }),
      });
      if (!res.ok) {
        let msg = `Erreur ${res.status}`;
        try {
          const data = await res.json();
          if (data?.error) msg = String(data.error);
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(url);
      setPreviewTitle(pickPreview.title);
      setPreviewOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Apercu PDF indisponible");
    } finally {
      setPreviewLoading(false);
      setPickPreview(null);
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
  };

  // ---- Wizard save ----
  const handleWizardSave = async (data: {
    key?: string;
    title: string;
    category?: string;
    version: string;
    bodyMarkdown: string;
    targetPositions: string[];
    targetDepartments: string[];
    isMandatory?: boolean;
  }) => {
    if (!wizard) return;

    if (wizard.type === "legal") {
      const key = (data.key ?? "").trim();
      if (!key) throw new Error("Cle technique requise");
      const r = await upsertLegalDocAction({
        id: wizard.mode === "edit" ? wizard.existingId : undefined,
        key,
        title: data.title,
        category: ((data.category ?? "policy") as "policy" | "nda" | "acknowledgment"),
        version: data.version,
        bodyMarkdown: data.bodyMarkdown,
        isRequired: data.isMandatory ?? false,
        targetPositions: data.targetPositions,
        targetDepartments: data.targetDepartments,
        signatureScope:
          ((data as { signatureScope?: "employee_only" | "employer_only" | "both" | "none" }).signatureScope) ?? "employee_only",
        acknowledgmentMode:
          ((data as { acknowledgmentMode?: "reading_only" | "signature" }).acknowledgmentMode) ?? "reading_only",
      });
      if (!r.success) throw new Error(r.error || "Erreur");
      toast.success(wizard.mode === "edit" ? "Modele mis a jour" : "Modele cree");
    } else if (wizard.type === "policy") {
      const key = (data.key ?? "").trim();
      if (!key) throw new Error("Cle technique requise");
      const today = new Date().toISOString().slice(0, 10);
      const r = await upsertHrPolicyAction({
        id: wizard.mode === "edit" ? wizard.existingId : undefined,
        key,
        title: data.title,
        version: data.version,
        bodyMarkdown: data.bodyMarkdown,
        effectiveFrom: today,
        isActive: true,
      });
      if (!r.success) throw new Error(r.error || "Erreur");
      toast.success(wizard.mode === "edit" ? "Politique mise a jour" : "Politique creee");
    } else {
      // contract
      const contractType = (data.category ?? "permanent_full_time").trim();
      const payload = {
        name: data.title,
        contractType,
        bodyMarkdown: data.bodyMarkdown,
        targetPositions: data.targetPositions,
        targetDepartments: data.targetDepartments,
      };
      if (wizard.mode === "edit" && wizard.existingId) {
        const r = await updateContractTemplateAction({ id: wizard.existingId, ...payload });
        if (!r.success) throw new Error(r.error || "Erreur");
        toast.success("Modele de contrat mis a jour");
      } else {
        const r = await createContractTemplateAction(payload);
        if (!r.success) throw new Error(r.error || "Erreur");
        toast.success("Modele de contrat cree");
      }
    }

    setWizard(null);
    router.refresh();
  };

  // ============================================================
  return (
    <div className="space-y-5">
      {/* Header navy gradient */}
      <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] rounded-xl px-5 py-5 text-white">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />
              Bibliothèque de modèles
            </h1>
            <p className="text-white/70 text-sm mt-1">
              Modèles VNK officiels et personnalisés — contrats, politiques et
              documents légaux centralisés.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setWizard({ open: true, type: "legal", mode: "create" })}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
            >
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
              Nouveau document légal
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setWizard({ open: true, type: "contract", mode: "create" })}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Nouveau contrat
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setWizard({ open: true, type: "policy", mode: "create" })}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
            >
              <Award className="h-3.5 w-3.5 mr-1.5" />
              Nouvelle politique
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div
        className={cn(
          "grid grid-cols-2 gap-3",
          recommendPosition ? "md:grid-cols-5" : "md:grid-cols-4",
        )}
      >
        <DocumentStatsCard
          label="Total des modèles"
          value={kpis.total}
          icon={Library}
          accent="navy"
          hint={`${grouped.legal.length + grouped.contract.length + grouped.policy.length} affichés`}
        />
        <DocumentStatsCard
          label="Starters VNK"
          value={kpis.starters}
          icon={Sparkles}
          accent="success"
          hint="Livrés par défaut"
        />
        <DocumentStatsCard
          label="Personnalisés"
          value={kpis.custom}
          icon={User}
          accent="info"
          hint="Créés en interne"
        />
        <DocumentStatsCard
          label="Archivés"
          value={kpis.archived}
          icon={ArchiveIcon}
          accent="warning"
          hint={includeArchived ? "Visibles" : "Masqués"}
          onClick={() => setIncludeArchived((v) => !v)}
        />
        {recommendPosition && (
          <DocumentStatsCard
            label="Recommandations actives"
            value={recommendedItems.length}
            icon={Lightbulb}
            accent="info"
            hint={recommendPosition}
          />
        )}
      </div>

      {/* Widget : Documents recommandés pour un poste */}
      {allItems.length > 0 && (
        <div className="rounded-xl border bg-gradient-to-br from-amber-50/40 via-card to-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#0F2D52] inline-flex items-center gap-1.5">
                <Lightbulb className="h-4 w-4 text-amber-600" />
                Documents recommandés pour un poste
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Sélectionnez un poste pour voir tous les modèles pertinents (ciblés ou génériques).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Popover
                open={recommendPickerOpen}
                onOpenChange={setRecommendPickerOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs min-w-[180px] justify-between"
                  >
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <Briefcase className="h-3.5 w-3.5 text-[#0F2D52]" />
                      {recommendPosition || "Choisir un poste..."}
                    </span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="end">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={recommendSearch}
                        onChange={(e) => setRecommendSearch(e.target.value)}
                        placeholder="Rechercher un poste..."
                        className="h-8 text-xs pl-7"
                      />
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    {filteredRecommendPositions.length === 0 ? (
                      <p className="px-3 py-4 text-[11px] text-muted-foreground text-center">
                        Aucun poste disponible
                      </p>
                    ) : (
                      filteredRecommendPositions.map((p) => {
                        const selected = recommendPosition === p;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              setRecommendPosition(p);
                              setRecommendPickerOpen(false);
                              setRecommendSearch("");
                            }}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted/60 transition",
                              selected && "bg-muted/40",
                            )}
                          >
                            <span className="flex-1 truncate">{p}</span>
                            {selected && (
                              <Check className="h-3.5 w-3.5 text-[#0F2D52] shrink-0" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              {recommendPosition && (
                <ActionTooltip label="Effacer la sélection">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground"
                    onClick={() => setRecommendPosition("")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </ActionTooltip>
              )}
            </div>
          </div>

          {recommendPosition ? (
            recommendedItems.length === 0 ? (
              <div className="rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center">
                <p className="text-xs text-muted-foreground">
                  Aucun modèle ne cible ce poste pour l&apos;instant.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-semibold text-[#0F2D52]">
                    {recommendedItems.length}
                  </span>{" "}
                  document{recommendedItems.length > 1 ? "s" : ""} recommandé
                  {recommendedItems.length > 1 ? "s" : ""} pour{" "}
                  <span className="font-semibold">{recommendPosition}</span>
                </p>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {recommendedItems.slice(0, 8).map((it) => {
                    const KindIcon =
                      it.kind === "legal"
                        ? ShieldCheck
                        : it.kind === "contract"
                          ? FileText
                          : Award;
                    const generic =
                      it.kind === "policy"
                      || !it.targetPositions
                      || it.targetPositions.length === 0;
                    return (
                      <li
                        key={`${it.kind}-${it.id}`}
                        className="inline-flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs"
                      >
                        <KindIcon className="h-3.5 w-3.5 text-[#0F2D52] shrink-0" />
                        <span className="truncate flex-1">{it.title}</span>
                        {generic ? (
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 px-1 py-0 text-muted-foreground"
                          >
                            générique
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 px-1 py-0 text-emerald-700 border-emerald-300"
                          >
                            ciblé
                          </Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => {
                      setPosFilter([recommendPosition]);
                      setTab("all");
                      setIncludeArchived(false);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Voir tous les {recommendedItems.length} documents dans la grille
                  </Button>
                </div>
              </div>
            )
          ) : (
            <div className="rounded-md border border-dashed bg-muted/20 px-4 py-5 text-center">
              <p className="text-xs text-muted-foreground">
                Sélectionnez un poste pour voir les modèles recommandés (contrats,
                politiques, lettres ciblées ou génériques).
              </p>
            </div>
          )}
        </div>
      )}

      {/* Sentinel pour sticky bar */}
      <div ref={sentinelRef} aria-hidden className="h-px" />

      {/* Sticky bar compact */}
      {scrolled && (
        <div className="sticky top-[64px] z-20 py-2 bg-background/95 backdrop-blur shadow-sm border-b rounded-md px-3 animate-overlay-fade-in">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <BookOpen className="h-4 w-4" />
              Bibliothèque
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-muted-foreground">Total :</span>
              <span className="font-semibold text-[#0F2D52]">{kpis.total}</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-muted-foreground">Starters :</span>
              <span className="font-semibold text-emerald-600">{kpis.starters}</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-muted-foreground">Personnalisés :</span>
              <span className="font-semibold text-sky-600">{kpis.custom}</span>
            </span>
            {filteredItems.length !== allItems.length && (
              <span className="flex items-baseline gap-1.5">
                <span className="text-muted-foreground">Affichés :</span>
                <span className="font-semibold">{filteredItems.length}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Toolbar filtres */}
      <div className="rounded-lg border bg-card p-3 space-y-3">
        {/* Tabs catégorie */}
        <div className="flex flex-wrap items-center gap-1">
          {([
            { id: "all", label: "Tous", count: allItems.length, icon: Layers },
            {
              id: "legal",
              label: "Légaux",
              count: legalTemplates.length,
              icon: ShieldCheck,
            },
            {
              id: "contract",
              label: "Contrats",
              count: contractTemplates.length,
              icon: FileText,
            },
            {
              id: "policy",
              label: "Politiques",
              count: hrPolicies.length,
              icon: Award,
            },
          ] as const).map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id as CategoryTab)}
                className={cn(
                  "inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold transition border",
                  active
                    ? "bg-[#0F2D52] text-white border-[#0F2D52]"
                    : "bg-muted/40 text-foreground border-transparent hover:bg-muted",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                <span
                  className={cn(
                    "ml-1 text-[10px] px-1.5 py-0 rounded-full",
                    active ? "bg-white/20 text-white" : "bg-foreground/10",
                  )}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Ligne filtres secondaires */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Recherche */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un modèle, une politique, un contrat..."
              className="h-8 text-xs pl-7"
            />
          </div>

          {/* Toggle Starter / Custom / All */}
          <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
            {([
              { id: "all", label: "Tous" },
              { id: "starter", label: "Starter VNK" },
              { id: "custom", label: "Personnalisés" },
            ] as const).map((s) => {
              const active = starterFilter === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStarterFilter(s.id as StarterFilter)}
                  className={cn(
                    "h-7 px-2.5 rounded text-[11px] font-semibold transition",
                    active
                      ? "bg-[#0F2D52] text-white"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Filtre par postes cibles */}
          <Popover open={posPickerOpen} onOpenChange={setPosPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
              >
                <Briefcase className="h-3.5 w-3.5 mr-1.5" />
                Postes
                {posFilter.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1.5 h-4 px-1 text-[9px] bg-[#0F2D52] text-white border-transparent"
                  >
                    {posFilter.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={posSearch}
                    onChange={(e) => setPosSearch(e.target.value)}
                    placeholder="Filtrer les postes..."
                    className="h-8 text-xs pl-7"
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {filteredPositions.length === 0 ? (
                  <p className="px-3 py-4 text-[11px] text-muted-foreground text-center">
                    Aucun poste cible
                  </p>
                ) : (
                  filteredPositions.map((p) => {
                    const selected = posFilter.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() =>
                          setPosFilter((prev) =>
                            prev.includes(p)
                              ? prev.filter((x) => x !== p)
                              : [...prev, p],
                          )
                        }
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted/60 transition",
                          selected && "bg-muted/40",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          readOnly
                          className="h-3 w-3 accent-[#0F2D52]"
                        />
                        <span className="flex-1 truncate">{p}</span>
                      </button>
                    );
                  })
                )}
              </div>
              {posFilter.length > 0 && (
                <div className="border-t p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-full text-xs text-muted-foreground"
                    onClick={() => setPosFilter([])}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Effacer ({posFilter.length})
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Filtre par departements cibles */}
          <Popover open={deptPickerOpen} onOpenChange={setDeptPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
              >
                <Building2 className="h-3.5 w-3.5 mr-1.5" />
                Départements
                {deptFilter.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1.5 h-4 px-1 text-[9px] bg-[#0F2D52] text-white border-transparent"
                  >
                    {deptFilter.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={deptSearch}
                    onChange={(e) => setDeptSearch(e.target.value)}
                    placeholder="Filtrer les départements..."
                    className="h-8 text-xs pl-7"
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {filteredDepartments.length === 0 ? (
                  <p className="px-3 py-4 text-[11px] text-muted-foreground text-center">
                    Aucun département
                  </p>
                ) : (
                  filteredDepartments.map((d) => {
                    const selected = deptFilter.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() =>
                          setDeptFilter((prev) =>
                            prev.includes(d)
                              ? prev.filter((x) => x !== d)
                              : [...prev, d],
                          )
                        }
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted/60 transition",
                          selected && "bg-muted/40",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          readOnly
                          className="h-3 w-3 accent-[#0F2D52]"
                        />
                        <span className="flex-1 truncate">{d}</span>
                      </button>
                    );
                  })
                )}
              </div>
              {deptFilter.length > 0 && (
                <div className="border-t p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-full text-xs text-muted-foreground"
                    onClick={() => setDeptFilter([])}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Effacer ({deptFilter.length})
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Toggle groupement */}
          <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
            {([
              { id: "category", label: "Catégorie", icon: Layers },
              { id: "department", label: "Département", icon: Building2 },
              { id: "position", label: "Poste", icon: Briefcase },
            ] as const).map((g) => {
              const active = groupBy === g.id;
              const Icon = g.icon;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGroupBy(g.id)}
                  className={cn(
                    "h-7 px-2.5 rounded text-[11px] font-semibold transition inline-flex items-center gap-1",
                    active
                      ? "bg-[#0F2D52] text-white"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {g.label}
                </button>
              );
            })}
          </div>

          {/* Toggle archives */}
          <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#0F2D52]"
            />
            <span className="text-muted-foreground">Inclure archivés</span>
          </label>

          {/* Reset */}
          {(query
            || tab !== "all"
            || starterFilter !== "all"
            || posFilter.length > 0
            || deptFilter.length > 0
            || includeArchived
            || groupBy !== "category") && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => {
                setQuery("");
                setTab("all");
                setStarterFilter("all");
                setPosFilter([]);
                setDeptFilter([]);
                setIncludeArchived(false);
                setGroupBy("category");
              }}
            >
              <X className="h-3 w-3 mr-1" />
              Réinitialiser
            </Button>
          )}
        </div>
      </div>

      {/* Sections groupées */}
      {allItems.length === 0 ? (
        // Bibliotheque totalement vide -> guide de seed
        <div className="rounded-xl border bg-card p-8 text-center max-w-3xl mx-auto">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#0F2D52]/10 mb-4">
            <Database className="h-7 w-7 text-[#0F2D52]" />
          </div>
          <h2 className="text-base font-bold text-foreground">
            Bibliothèque vide
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Aucun modèle n&apos;a encore été chargé en base.
          </p>

          <div className="mt-5 rounded-lg border bg-muted/30 p-4 text-left">
            <p className="text-xs font-semibold text-[#0F2D52] inline-flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5" />
              Pour charger les 50+ modèles VNK officiels
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              (contrats, politiques CNESST/OIQ, lettres...)
            </p>
            <ol className="mt-3 space-y-1.5 text-xs text-foreground list-decimal list-inside">
              <li>
                Arrête le serveur de développement{" "}
                <code className="text-[10px] bg-background border rounded px-1 py-0.5">
                  Ctrl + C
                </code>
              </li>
              <li>
                Lance{" "}
                <code className="text-[10px] bg-background border rounded px-1 py-0.5">
                  npx prisma generate
                </code>
              </li>
              <li>
                Lance{" "}
                <code className="text-[10px] bg-background border rounded px-1 py-0.5">
                  npm run seed:templates
                </code>
              </li>
              <li>
                Redémarre le serveur{" "}
                <code className="text-[10px] bg-background border rounded px-1 py-0.5">
                  npm run dev
                </code>
              </li>
            </ol>
            <p className="text-[11px] text-muted-foreground mt-3">
              Tu pourras ensuite consulter, dupliquer ou personnaliser tous les
              modèles.
            </p>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
            <Button
              type="button"
              size="sm"
              onClick={() =>
                setWizard({ open: true, type: "legal", mode: "create" })
              }
              className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            >
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
              Créer manuellement un modèle
            </Button>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center">
          <Library className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm font-semibold text-foreground">
            Aucun modèle trouvé
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Ajustez vos filtres ou créez un nouveau modèle.
          </p>
        </div>
      ) : groupBy === "category" ? (
        <div className="space-y-6">
          {(["legal", "contract", "policy"] as const).map((kind) => {
            const items = grouped[kind];
            if (items.length === 0) return null;
            const label =
              kind === "legal"
                ? "Documents légaux"
                : kind === "contract"
                  ? "Contrats"
                  : "Politiques RH";
            const KindIcon =
              kind === "legal" ? ShieldCheck : kind === "contract" ? FileText : Award;
            return (
              <section key={kind} className="space-y-3">
                <div className="flex items-center gap-2 border-b pb-2">
                  <KindIcon className="h-4 w-4 text-[#0F2D52]" />
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52]">
                    {label}
                  </h2>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0">
                    {items.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((tpl) => (
                    <TemplateLibraryCard
                      key={`${tpl.kind}-${tpl.id}`}
                      template={tpl}
                      onUse={handleUse}
                      onEdit={handleEdit}
                      onDuplicate={handleDuplicate}
                      onArchive={handleArchive}
                      onRequestSignature={handleRequestSignature}
                      onPreviewWithoutEmployee={handlePreviewWithoutEmployee}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        // groupBy = "department" ou "position"
        <div className="space-y-6">
          {(groupBy === "department" ? groupedByDepartment : groupedByPosition).map(
            (group) => {
              const isGeneric =
                group.key === ALL_DEPARTMENTS_KEY
                || group.key === ALL_POSITIONS_KEY;
              const GroupIcon =
                groupBy === "department" ? Building2 : Briefcase;
              return (
                <section key={group.key} className="space-y-3">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <GroupIcon
                      className={cn(
                        "h-4 w-4",
                        isGeneric ? "text-muted-foreground" : "text-[#0F2D52]",
                      )}
                    />
                    <h2
                      className={cn(
                        "text-[11px] font-bold uppercase tracking-wider",
                        isGeneric ? "text-muted-foreground" : "text-[#0F2D52]",
                      )}
                    >
                      {group.label}
                    </h2>
                    <Badge
                      variant="outline"
                      className="text-[10px] h-4 px-1.5 py-0"
                    >
                      {group.items.length}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {group.items.map((tpl) => (
                      <TemplateLibraryCard
                        key={`${group.key}-${tpl.kind}-${tpl.id}`}
                        template={tpl}
                        onUse={handleUse}
                        onEdit={handleEdit}
                        onDuplicate={handleDuplicate}
                        onArchive={handleArchive}
                        onPreviewWithoutEmployee={handlePreviewWithoutEmployee}
                      />
                    ))}
                  </div>
                </section>
              );
            },
          )}
        </div>
      )}

      {/* Wizard */}
      {wizard && (
        <TemplateWizard
          open={wizard.open}
          mode={wizard.mode}
          type={wizard.type}
          initial={wizard.initial}
          onClose={() => setWizard(null)}
          onSave={handleWizardSave}
        />
      )}

      {/* Confirm archive / restore */}
      <ConfirmDialog
        open={!!confirmArchive}
        onOpenChange={(o) => !o && setConfirmArchive(null)}
        title={
          confirmArchive?.isActive
            ? `Archiver « ${confirmArchive?.title ?? ""} » ?`
            : `Restaurer « ${confirmArchive?.title ?? ""} » ?`
        }
        description={
          confirmArchive?.isActive
            ? "Le modèle sera masqué des sélections mais reste consultable via le filtre « Inclure archivés »."
            : "Le modèle redevient disponible dans toutes les sélections."
        }
        confirmLabel={confirmArchive?.isActive ? "Archiver" : "Restaurer"}
        variant={confirmArchive?.isActive ? "destructive" : "default"}
        loading={archiveBusy}
        onConfirm={confirmArchiveAction}
      />

      {/* Pick employe pour apercu PDF */}
      {pickPreview && (
        <PickEmployeeForPreviewDialog
          open={!!pickPreview && !previewLoading}
          onClose={() => setPickPreview(null)}
          onPick={(employeeId) => {
            void generatePreviewPdf(employeeId);
          }}
          employees={pickEmployees}
          title={`Aperçu PDF : ${pickPreview.title}`}
          description="Sélectionnez un employé pour résoudre les variables (nom, poste, salaire...)."
          confirmLabel="Générer l'aperçu"
        />
      )}

      {/* Demande de signature pre-remplie depuis une card de modele legal */}
      <SignatureRequestDialog
        open={requestDialog.open}
        onClose={() => setRequestDialog({ open: false, template: null })}
        onCreated={() => router.refresh()}
        template={requestDialog.template}
        availableTemplates={legalTemplates
          .filter((t) => t.isActive)
          .map((t) => ({ id: t.id, title: t.title, version: t.version }))}
        availableTeams={teams}
        availableEmployees={employees.map((e) => ({
          id: e.id,
          fullName: e.fullName,
          email: e.email ?? "",
          team: e.team ?? null,
        }))}
      />

      <PdfPreviewModal
        open={previewOpen}
        url={previewBlobUrl}
        title={`Aperçu : ${previewTitle}`}
        downloadFilename={`${previewTitle
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-zA-Z0-9-_]+/g, "-")
          .toLowerCase()
          .slice(0, 80) || "apercu"}.pdf`}
        onClose={closePreview}
      />
    </div>
  );
}
