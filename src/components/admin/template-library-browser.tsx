"use client";
// ─────────────────────────────────────────────────────────
// TemplateLibraryBrowser — grille de cards "starter templates" livres
// par defaut (LegalDocumentTemplate / ContractTemplate / HrPolicy avec
// isStarter = true).
//
// Fetch via GET /api/admin/document-templates/starters?type=...
//
// Permet :
//   - de choisir un modele -> onSelect(template)
//   - ou de partir de zero -> onSkip()
// ─────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Search,
  Library,
  FilePlus,
  FileText,
  Loader2,
  CheckCircle2,
  Tag,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPreviewMarkdown } from "@/lib/document-templates/preview-helpers";
import { cn } from "@/lib/utils";

export type StarterTemplate = {
  id: number;
  key?: string;
  name: string; // mappe vers title (legal/policy) ou name (contract)
  category?: string | null;
  bodyMarkdown: string;
  targetPositions?: string[];
  targetDepartments?: string[];
  version?: string;
};

type Props = {
  type: "legal" | "contract" | "policy";
  onSelect: (template: {
    key?: string;
    name: string;
    bodyMarkdown: string;
    category?: string;
    targetPositions?: string[];
  }) => void;
  onSkip: () => void;
};

export function TemplateLibraryBrowser({ type, onSelect, onSkip }: Props) {
  const t = useTranslations("admin.ui");
  const tv = useTranslations("admin.library");
  const [starters, setStarters] = useState<StarterTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/document-templates/starters?type=${type}`, {
      credentials: "same-origin",
    })
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data?.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((data: { items: StarterTemplate[] }) => {
        if (cancelled) return;
        setStarters(data.items ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : t("erreur_chargement"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [type]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return starters;
    return starters.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q) ||
        s.key?.toLowerCase().includes(q)
    );
  }, [starters, query]);

  const handleConfirm = () => {
    const t = starters.find((s) => s.id === selectedId);
    if (!t) return;
    onSelect({
      key: t.key,
      name: t.name,
      bodyMarkdown: t.bodyMarkdown,
      category: t.category ?? undefined,
      targetPositions: t.targetPositions ?? [],
    });
  };

  return (
    <div className="space-y-4">

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Library className="h-4 w-4 text-[#0F2D52] mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t("bibliotheque_vnk")}
            </h3>
            <p className="text-[11px] text-muted-foreground">{tv("template_library_browser_choisissez_un_modele_pre_rempli_ou_partez")}</p>
          </div>
        </div>
      </div>


      <div className="relative">
        <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("rechercher_modele")}
          className="pl-8 h-9 text-sm"
        />
      </div>


      {loading ? (
        <div className="py-12 flex flex-col items-center gap-2">
          <Loader2 className="h-5 w-5 text-[#0F2D52] animate-spin" />
          <p className="text-xs text-muted-foreground">{t("chargement_modeles")}</p>
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-xs text-red-700 font-medium">
            {t("impossible_charger_bibliotheque")}
          </p>
          <p className="text-[11px] text-red-600 mt-0.5">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-input px-4 py-10 text-center">
          <FileText className="h-7 w-7 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground">
            {starters.length === 0
              ? t("aucun_modele_pre_livre_type")
              : t("aucun_modele_ne_correspond_recherche")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[55vh] overflow-y-auto pr-1">
          {filtered.map((s) => {
            const isSelected = selectedId === s.id;
            const previewLines = formatPreviewMarkdown(s.bodyMarkdown, 180, tv);
            return (
              <button
                type="button"
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                onDoubleClick={() => {
                  setSelectedId(s.id);

                  setTimeout(handleConfirm, 0);
                }}
                className={cn(
                  "text-left rounded-md border p-3 transition focus:outline-none focus:ring-2 focus:ring-[#0F2D52]/30 relative",
                  isSelected
                    ? "border-[#0F2D52] bg-[#0F2D52]/5 ring-1 ring-[#0F2D52]/20"
                    : "border-input bg-card hover:border-[#0F2D52]/30 hover:bg-muted/30"
                )}
              >
                {isSelected && (
                  <CheckCircle2 className="h-4 w-4 text-[#0F2D52] absolute top-2 right-2" />
                )}
                <div className="flex items-start gap-2 mb-2">
                  <FileText
                    className={cn(
                      "h-4 w-4 mt-0.5 shrink-0",
                      isSelected ? "text-[#0F2D52]" : "text-muted-foreground"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                      {s.name}
                    </p>
                    {s.version && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        v{s.version}
                      </p>
                    )}
                  </div>
                </div>


                <div className="flex flex-wrap gap-1 mb-2">
                  {s.category && (
                    <Badge variant="info" className="text-[10px] py-0 px-1.5">
                      <Tag className="h-2.5 w-2.5 mr-0.5" />
                      {s.category}
                    </Badge>
                  )}
                  {s.targetPositions && s.targetPositions.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] py-0 px-1.5"
                    >
                      <Users className="h-2.5 w-2.5 mr-0.5" />
                      {s.targetPositions.length} poste
                      {s.targetPositions.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>


                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">
                  {previewLines || t("aucun_contenu_pre_rempli")}
                </p>
              </button>
            );
          })}
        </div>
      )}


      <div className="flex items-center justify-between gap-3 pt-2 border-t">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSkip}
          className="gap-1.5"
        >
          <FilePlus className="h-3.5 w-3.5" />
          {t("partir_zero")}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleConfirm}
          disabled={selectedId === null}
          className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white gap-1.5"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {t("utiliser_modele")}
        </Button>
      </div>
    </div>
  );
}
