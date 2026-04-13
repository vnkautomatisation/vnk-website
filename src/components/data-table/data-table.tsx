"use client";
// ═══════════════════════════════════════════════════════════
// <DataTable> — Composant réutilisable : recherche, filtres,
// tri, pagination, toggle liste/carte, CSV export
// ═══════════════════════════════════════════════════════════

import { useMemo, useState, useCallback, useEffect, type ReactNode } from "react";
import {
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  LayoutGrid,
  Download,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

// ═══ TYPES ═══════════════════════════════════════════════

export type Column<T> = {
  key: string;
  header: string;
  accessor: (row: T) => ReactNode;
  sortable?: boolean;
  sortBy?: (row: T) => string | number | Date | null;
  className?: string;
  hiddenOnMobile?: boolean;
};

export type FilterOption = {
  value: string;
  label: string;
};

export type DataTableProps<T> = {
  data: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string | number;
  /** Card renderer for grid view + mobile */
  renderCard?: (row: T) => ReactNode;
  /** Click handler for row/card */
  onRowClick?: (row: T) => void;
  /** localStorage key for view preference */
  storageKey?: string;
  /** Search config */
  searchPlaceholder?: string;
  searchFn?: (row: T) => string;
  /** Filter config */
  filterOptions?: FilterOption[];
  filterFn?: (row: T) => string;
  filterLabel?: string;
  /** Page size */
  pageSize?: number;
  /** Toolbar actions (right side) */
  headerActions?: ReactNode;
  /** Empty state */
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
  /** CSV export */
  exportFilename?: string;
  /** Sticky header content (page title + KPIs) rendered above toolbar */
  stickyHeader?: ReactNode;
};

// ═══ COMPONENT ═══════════════════════════════════════════

export function DataTable<T>({
  data,
  columns,
  getRowId,
  renderCard,
  onRowClick,
  storageKey,
  searchPlaceholder = "Rechercher...",
  searchFn,
  filterOptions,
  filterFn,
  filterLabel = "Tous les statuts",
  pageSize = 10,
  headerActions,
  emptyMessage = "Aucun resultat",
  emptyIcon,
  emptyAction,
  exportFilename,
  stickyHeader,
}: DataTableProps<T>) {
  // ── View toggle ────────────────────────────────────────
  const lsKey = storageKey ? `vnk-view-${storageKey}` : null;
  const [view, setView] = useState<"list" | "grid">(() => {
    if (typeof window === "undefined") return "list";
    if (lsKey) {
      const saved = localStorage.getItem(lsKey);
      if (saved === "grid" || saved === "list") return saved;
    }
    return "list";
  });

  useEffect(() => {
    if (lsKey) localStorage.setItem(lsKey, view);
  }, [view, lsKey]);

  // ── Search ─────────────────────────────────────────────
  const [search, setSearch] = useState("");

  // ── Filter ─────────────────────────────────────────────
  const [filter, setFilter] = useState("all");

  // ── Sort ───────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = useCallback(
    (col: Column<T>) => {
      if (!col.sortable) return;
      if (sortKey === col.key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(col.key);
        setSortDir("asc");
      }
    },
    [sortKey]
  );

  // ── Pagination ─────────────────────────────────────────
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search, filter]);

  // ── Processed data ─────────────────────────────────────
  const processed = useMemo(() => {
    let list = [...data];

    // Search
    if (search && searchFn) {
      const q = search.toLowerCase();
      list = list.filter((r) => searchFn(r).toLowerCase().includes(q));
    } else if (search.trim()) {
      // Fallback: search all column accessors as strings
      const q = search.toLowerCase();
      list = list.filter((row) =>
        columns.some((col) => {
          const val = col.accessor(row);
          return String(val ?? "").toLowerCase().includes(q);
        })
      );
    }

    // Filter
    if (filter !== "all" && filterFn) {
      list = list.filter((r) => filterFn(r) === filter);
    }

    // Sort
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col?.sortBy) {
        const fn = col.sortBy;
        list.sort((a, b) => {
          const va = fn(a);
          const vb = fn(b);
          if (va == null && vb == null) return 0;
          if (va == null) return 1;
          if (vb == null) return -1;
          if (typeof va === "string" && typeof vb === "string")
            return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
          const na = va instanceof Date ? va.getTime() : Number(va);
          const nb = vb instanceof Date ? vb.getTime() : Number(vb);
          return sortDir === "asc" ? na - nb : nb - na;
        });
      }
    }

    return list;
  }, [data, search, searchFn, filter, filterFn, sortKey, sortDir, columns]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(processed.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pageData = processed.slice(startIdx, startIdx + pageSize);
  const showingText =
    processed.length === 0
      ? "0 resultat"
      : `${startIdx + 1}–${Math.min(startIdx + pageSize, processed.length)} sur ${processed.length}`;

  // ── CSV Export ─────────────────────────────────────────
  const handleExport = () => {
    const headers = columns.map((c) => c.header).join(",");
    const rows = processed.map((row) =>
      columns
        .map((col) => {
          const val = col.accessor(row);
          const str = String(val ?? "").replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(",")
    );
    const csv = "\uFEFF" + [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFilename ?? "export"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════

  return (
    <div className="space-y-4">
      {/* ── Header + KPIs + toolbar (sticky dans le main scrollable) ── */}
      <div className="lg:sticky lg:top-0 z-10 bg-background pb-3 -mx-3 sm:-mx-4 lg:-mx-8 px-3 sm:px-4 lg:px-8 pt-4 overflow-hidden">
        {stickyHeader}
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start sm:items-center justify-between mt-2 sm:mt-3">
        <div className="flex flex-1 gap-1.5 sm:gap-2 items-center w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-8 sm:pl-9 h-8 sm:h-9 text-xs sm:text-sm"
              aria-label="Rechercher"
            />
          </div>

          {/* Filter dropdown */}
          {filterOptions && (
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-8 sm:h-9 rounded-md border border-input bg-background px-2 sm:px-3 text-xs sm:text-sm min-w-0 max-w-[130px] sm:min-w-[140px]"
              aria-label="Filtrer par statut"
            >
              <option value="all">{filterLabel}</option>
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex gap-1.5 sm:gap-2 items-center">
          <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">
            {processed.length} {processed.length > 1 ? "resultats" : "resultat"}
          </span>

          {/* View toggle */}
          {renderCard && (
            <div className="flex border rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn(
                  "h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center transition-colors",
                  view === "list" ? "bg-[#0F2D52] text-white" : "hover:bg-muted text-muted-foreground"
                )}
                aria-label="Vue liste"
              >
                <LayoutList className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView("grid")}
                className={cn(
                  "h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center transition-colors",
                  view === "grid" ? "bg-[#0F2D52] text-white" : "hover:bg-muted text-muted-foreground"
                )}
                aria-label="Vue cartes"
              >
                <LayoutGrid className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>
          )}

          {/* Export */}
          {exportFilename && (
            <Button variant="outline" size="sm" onClick={handleExport} className="h-8 sm:h-9">
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline ml-1">CSV</span>
            </Button>
          )}

          {headerActions}
        </div>
        </div>
      </div>

      {/* ── Empty state ────────────────────────────── */}
      {processed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-card">
          {emptyIcon ?? <Inbox className="h-12 w-12 text-muted-foreground/40 mb-4" />}
          <h3 className="font-semibold text-lg mb-1">{emptyMessage}</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            Il n'y a rien a afficher pour le moment.
          </p>
          {emptyAction}
        </div>
      ) : view === "grid" && renderCard ? (
        /* ── Grid view ───────────────────────────────── */
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pageData.map((row) => (
              <div
                key={getRowId(row)}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "transition-all duration-200",
                  onRowClick && "cursor-pointer hover:shadow-lg hover:-translate-y-0.5"
                )}
              >
                {renderCard(row)}
              </div>
            ))}
          </div>
          <PaginationBar page={safePage} totalPages={totalPages} showing={showingText} onPageChange={setPage} />
        </>
      ) : (
        /* ── Table view ──────────────────────────────── */
        <>
          <div>
            <Card className="overflow-clip rounded-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-muted/50 border-b sticky top-0 z-[5]">
                    <tr>
                      {columns.map((col) => (
                        <th
                          key={col.key}
                          className={cn(
                            "text-left px-2 sm:px-4 py-2 sm:py-3 font-semibold text-[0.6rem] sm:text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap",
                            col.hiddenOnMobile && "hidden sm:table-cell",
                            col.sortable && "cursor-pointer select-none hover:text-foreground",
                            col.className
                          )}
                          scope="col"
                          onClick={() => col.sortable && toggleSort(col)}
                        >
                          <span className="flex items-center gap-1">
                            {col.header}
                            {col.sortable && (
                              sortKey === col.key ? (
                                sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                              ) : (
                                <ArrowUpDown className="h-3 w-3 opacity-40" />
                              )
                            )}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pageData.map((row) => (
                      <tr
                        key={getRowId(row)}
                        onClick={() => onRowClick?.(row)}
                        className={cn(
                          "hover:bg-muted/30 transition-colors",
                          onRowClick && "cursor-pointer"
                        )}
                      >
                        {columns.map((col) => (
                          <td
                            key={col.key}
                            className={cn(
                              "px-2 sm:px-4 py-1.5 sm:py-3",
                              col.hiddenOnMobile && "hidden sm:table-cell",
                              col.className
                            )}
                          >
                            {col.accessor(row)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <PaginationBar page={safePage} totalPages={totalPages} showing={showingText} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

// ═══ PAGINATION ══════════════════════════════════════════

function PaginationBar({
  page,
  totalPages,
  showing,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  showing: string;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) {
    return <div className="text-xs text-muted-foreground text-center py-2">{showing}</div>;
  }

  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between gap-2 pt-2">
      <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{showing}</span>
      <div className="flex items-center gap-0.5 sm:gap-1">
        <Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`d${i}`} className="px-0.5 text-muted-foreground text-[10px]">...</span>
          ) : (
            <Button key={p} variant={p === page ? "default" : "outline"} size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-[10px] sm:text-xs" onClick={() => onPageChange(p as number)}>
              {p}
            </Button>
          )
        )}
        <Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
      </div>
    </div>
  );
}
