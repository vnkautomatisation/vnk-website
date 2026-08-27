"use client";
import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Review = {
  id: number;
  status: string;
  periodStart: string;
  periodEnd: string;
  rating: number | null;
  admin: { id: number; fullName: string | null; email: string };
  reviewer: { id: number; fullName: string | null; email: string };
};

const STATUS: Record<string, { labelKey: string; color: string }> = {
  draft: { labelKey: "brouillon", color: "bg-slate-100 text-slate-700" },
  submitted: { labelKey: "soumise", color: "bg-blue-100 text-blue-700" },
  reviewed: { labelKey: "revue", color: "bg-amber-100 text-amber-700" },
  acknowledged: { labelKey: "reconnue", color: "bg-emerald-100 text-emerald-700" },
  closed: { labelKey: "cloturee", color: "bg-gray-100 text-gray-700" },
};

const PAGE_SIZE = 15;

export function EvaluationsList({ reviews }: { reviews: Review[] }) {
  const t = useTranslations("admin.hr_nav");
  const tc = useTranslations("common");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const years = useMemo(() => {
    const s = new Set<string>();
    reviews.forEach((r) => s.add(String(new Date(r.periodEnd).getFullYear())));
    return Array.from(s).sort((a, b) => Number(b) - Number(a));
  }, [reviews]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviews.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (yearFilter !== "all" && String(new Date(r.periodEnd).getFullYear()) !== yearFilter) return false;
      if (q) {
        const name = (r.admin.fullName || r.admin.email).toLowerCase();
        const reviewer = (r.reviewer.fullName || r.reviewer.email).toLowerCase();
        if (!name.includes(q) && !reviewer.includes(q)) return false;
      }
      return true;
    });
  }, [reviews, search, statusFilter, yearFilter]);

  useEffect(() => { setPage(0); }, [search, statusFilter, yearFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (reviews.length === 0) {
    return <Card className="p-10 text-center text-sm text-muted-foreground">{t("aucune_evaluation_creez_premiere")}</Card>;
  }

  return (
    <div className="space-y-3">

      <Card className="p-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("rechercher_employe_evaluateur")}
              className="h-9 text-sm pl-7"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={tc("status")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tous_statuts")}</SelectItem>
              {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{t(v.labelKey)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={t("annee")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("toutes_annees")}</SelectItem>
              {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">{t("aucun_resultat_filtres")}</Card>
      ) : (
        <>
          <div className="space-y-2">
            {pageItems.map((r) => {
              const s = STATUS[r.status] ?? { label: r.status, color: "bg-gray-100 text-gray-700" };
              return (
                <Card key={r.id} className="p-4 hover:bg-muted/30 transition">
                  <Link href={`/admin/employes/evaluations/${r.id}`} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm">{r.admin.fullName || r.admin.email}</h3>
                      <p className="text-xs text-muted-foreground">
                        Évalué par {r.reviewer.fullName || r.reviewer.email} · {new Date(r.periodStart).toLocaleDateString("fr-CA")} → {new Date(r.periodEnd).toLocaleDateString("fr-CA")}
                      </p>
                      {r.rating !== null && <p className="text-xs mt-0.5">{t("note")} <strong>{r.rating}/10</strong></p>}
                    </div>
                    <Badge className={`text-[10px] ${s.color}`}>{t(s.labelKey)}</Badge>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </Card>
              );
            })}
          </div>

          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between text-xs px-2">
              <span className="text-muted-foreground">
                Page {page + 1} / {totalPages} · {filtered.length} évaluation{filtered.length > 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label={t("page_precedente")}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} aria-label={t("page_suivante")}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
