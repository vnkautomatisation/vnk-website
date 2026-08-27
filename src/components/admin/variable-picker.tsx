"use client";
// ─────────────────────────────────────────────────────────
// VariablePicker — panneau lateral pour inserer un champ
// dynamique dans un editeur de template.
//
// L'utilisateur RH voit des LABELS FR clairs ("Nom complet de
// l'employe"). La syntaxe technique {{employee.fullName}} est
// reservee aux developpeurs et n'est PAS affichee par defaut.
// Un bouton "Mode technique" la revele si besoin (debug).
//
// Sections collapsibles par source (Employe / Contrat / Entreprise /
// Date / Signatures).
//
// Usage :
//   <VariablePicker onInsert={(v) => insertAtCursor(v)} />
// ─────────────────────────────────────────────────────────
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronDown,
  ChevronRight,
  Search,
  User,
  Building2,
  Calendar,
  FileText,
  PenLine,
  Sparkles,
  Code2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  VARIABLE_REGISTRY,
  VARIABLE_SOURCES,
  type VariableDef,
  type VariableSource,
} from "@/lib/document-templates/variable-registry";

const SOURCE_ICONS: Record<VariableSource, React.ComponentType<{ className?: string }>> = {
  employee: User,
  contract: FileText,
  company: Building2,
  date: Calendar,
  signature: PenLine,
};

type Props = {
  /** Appele avec la chaine `{{key}}` a inserer a la position cursor. */
  onInsert: (variable: string) => void;
  /** Optionnel : limite les sections affichees. */
  filterSource?: VariableSource[];
  /** Optionnel : classes additionnelles sur le wrapper. */
  className?: string;
};

export function VariablePicker({ onInsert, filterSource, className }: Props) {
  const t = useTranslations("admin.ui");
  const tv = useTranslations("admin.library");
  const [query, setQuery] = useState("");
  const [showTechnical, setShowTechnical] = useState(false);
  const [openSources, setOpenSources] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(VARIABLE_SOURCES.map((s) => [s.source, true]))
  );

  const visibleSources = useMemo(() => {
    return VARIABLE_SOURCES.filter(
      (s) => !filterSource || filterSource.includes(s.source)
    );
  }, [filterSource]);

  const filteredVars = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return VARIABLE_REGISTRY;
    return VARIABLE_REGISTRY.filter(
      (v) =>
        v.key.toLowerCase().includes(q) ||
        tv(v.labelKey).toLowerCase().includes(q) ||
        v.example.toLowerCase().includes(q)
    );
  }, [query, tv]);

  const grouped = useMemo(() => {
    const map = new Map<VariableSource, VariableDef[]>();
    for (const v of filteredVars) {
      if (filterSource && !filterSource.includes(v.source)) continue;
      const arr = map.get(v.source) ?? [];
      arr.push(v);
      map.set(v.source, arr);
    }
    return map;
  }, [filteredVars, filterSource]);

  const toggleSource = (source: VariableSource) =>
    setOpenSources((prev) => ({ ...prev, [source]: !prev[source] }));

  const handleInsert = (key: string) => {
    onInsert(`{{${key}}}`);
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-card border border-input rounded-md overflow-hidden",
        className
      )}
    >

      <div className="px-3 py-2.5 border-b bg-muted/30 shrink-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-3.5 w-3.5 text-[#0F2D52] shrink-0" />
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52] truncate">
              {t("champs_inserer")}
            </h4>
          </div>
          <button
            type="button"
            onClick={() => setShowTechnical((s) => !s)}
            className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider transition shrink-0",
              showTechnical
                ? "bg-[#0F2D52] text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
            title={
              showTechnical
                ? t("masquer_syntaxe_technique")
                : t("afficher_syntaxe_technique_developpeurs")
            }
            aria-pressed={showTechnical}
          >
            <Code2 className="h-2.5 w-2.5" />
            {t("tech")}
          </button>
        </div>
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("rechercher_champ")}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>


      <div className="flex-1 overflow-y-auto divide-y">
        {visibleSources.map((section) => {
          const items = grouped.get(section.source) ?? [];
          if (items.length === 0 && query.trim()) return null;
          const Icon = SOURCE_ICONS[section.source];
          const isOpen = openSources[section.source] ?? true;
          return (
            <div key={section.source} className="bg-card">
              <button
                type="button"
                onClick={() => toggleSource(section.source)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/40 transition text-left"
              >
                {isOpen ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
                <Icon className="h-3.5 w-3.5 text-[#0F2D52]" />
                <span className="text-xs font-semibold text-foreground flex-1">
                  {tv(section.labelKey)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {items.length}
                </span>
              </button>
              {isOpen && (
                <div className="px-1.5 pb-1.5 space-y-0.5">
                  {items.length === 0 ? (
                    <p className="px-2 py-1.5 text-[11px] text-muted-foreground italic">
                      {t("aucun_champ")}
                    </p>
                  ) : (
                    items.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => handleInsert(v.key)}
                        className="w-full text-left rounded px-2 py-1.5 hover:bg-blue-50 hover:border-blue-200 focus:bg-blue-100 focus:outline-none transition border border-transparent group"
                        title={tv("inserer_le_champ", { label: tv(v.labelKey) })}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-semibold text-foreground truncate group-hover:text-blue-900">
                            {tv(v.labelKey)}
                          </span>
                        </div>
                        {v.example && (
                          <span className="text-[10px] text-muted-foreground italic block truncate">
                            ex : {v.example}
                          </span>
                        )}
                        {showTechnical && (
                          <code className="text-[10px] font-mono text-[#0F2D52]/70 block truncate mt-0.5">
                            {"{{"}
                            {v.key}
                            {"}}"}
                          </code>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {visibleSources.every((s) => (grouped.get(s.source) ?? []).length === 0) && (
          <div className="px-3 py-8 text-center">
            <Search className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">
              {t("aucun_champ_ne_correspond_recherche")}
            </p>
          </div>
        )}
      </div>


      <div className="px-3 py-2 border-t bg-muted/20 shrink-0">
        <p className="text-[10px] text-muted-foreground leading-snug">{tv("variable_picker_cliquez_sur_un_champ_pour_l_inserer")}</p>
      </div>
    </div>
  );
}
