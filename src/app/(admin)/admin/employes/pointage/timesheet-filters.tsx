"use client";

import { useCallback, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type StatusFilter = "all" | "submitted" | "pending" | "approved" | "rejected";

// "pending" is the DRAFT state; "En attente" would clash with the rows' badge.
const STATUS_KEY: Record<StatusFilter, string> = {
  all: "tous_statuts",
  submitted: "soumis_approuver",
  pending: "brouillon_non_soumis_tiret",
  approved: "approuve",
  rejected: "rejete",
};

// Team / department / status filters + search, kept in sync with searchParams.
// Any filter change resets pagination.
export function TimesheetFilters({
  teams,
  departments,
  showStatus = true,
  showSearch = true,
  q,
  teamFilter,
  departmentFilter,
  statusFilter,
}: {
  teams: Array<{ id: number; name: string; color: string | null }>;
  departments: string[];
  showStatus?: boolean;
  showSearch?: boolean;
  q: string;
  teamFilter: number | null;
  departmentFilter: string | null;
  statusFilter: StatusFilter;
}) {
  const t = useTranslations("admin.timeclock");
  const tc = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [searchValue, setSearchValue] = useState(q);


  useEffect(() => { setSearchValue(q); }, [q]);

  const buildUrl = useCallback(
    (overrides: Record<string, string | null>): string => {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(overrides)) {
        if (v == null || v === "") params.delete(k);
        else params.set(k, v);
      }

      params.delete("page");
      return `${pathname}?${params.toString()}`;
    },
    [pathname, sp],
  );


  useEffect(() => {
    if (searchValue === q) return;
    const t = setTimeout(() => {
      router.push(buildUrl({ q: searchValue || null }));
    }, 350);
    return () => clearTimeout(t);
  }, [searchValue, q, router, buildUrl]);

  const onTeamChange = (v: string) => {
    router.push(buildUrl({ team: v === "all" ? null : v }));
  };
  const onDepartmentChange = (v: string) => {
    router.push(buildUrl({ department: v === "all" ? null : v }));
  };
  const onStatusChange = (v: string) => {
    router.push(buildUrl({ status: v === "all" ? null : v }));
  };

  const hasActiveFilter =
    !!q || teamFilter != null || !!departmentFilter || statusFilter !== "all";

  const reset = () => {
    router.push(buildUrl({ q: null, team: null, department: null, status: null }));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showSearch && (
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder={t("rechercher_nom_courriel_poste")}
            className="h-9 text-sm pl-7"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => setSearchValue("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t("effacer_recherche")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {teams.length > 0 && (
        <Select value={teamFilter == null ? "all" : String(teamFilter)} onValueChange={onTeamChange}>
          <SelectTrigger className="h-9 w-[160px] text-sm">
            <SelectValue placeholder={t("equipe")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("toutes_equipes")}</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {departments.length > 0 && (
        <Select
          value={departmentFilter ?? "all"}
          onValueChange={onDepartmentChange}
        >
          <SelectTrigger className="h-9 w-[160px] text-sm">
            <SelectValue placeholder={t("departement")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("tous_departements")}</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showStatus && (
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="h-9 w-[140px] text-sm">
            <SelectValue placeholder={tc("status")} />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_KEY) as StatusFilter[]).map((k) => (
              <SelectItem key={k} value={k}>
                {t(STATUS_KEY[k])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasActiveFilter && (
        <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={reset}>
          <X className="h-3.5 w-3.5 mr-1" />{t("timesheet_filters_reinitialiser")}</Button>
      )}
    </div>
  );
}
