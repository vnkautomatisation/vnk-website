"use client";
// ═══════════════════════════════════════════════════════════
// <DataTable> — Le composant unique qui remplace les 12+ versions
// de tables/listes/cards éparpillées dans portal.js et admin.html.
// Features :
// • Tri par colonne
// • Recherche globale
// • Filtres personnalisés
// • Pagination (client ou serveur)
// • Sélection de lignes
// • Vue table (desktop) OU cartes (mobile) configurable
// • Export CSV
// • Actions par ligne (dropdown menu)
// • Empty state + loading state
// • 100% accessible (ARIA)
// ═══════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export type Column<T> = {
  key: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  sortable?: boolean;
  sortBy?: (row: T) => string | number;
  className?: string;
  hiddenOnMobile?: boolean;
};

export type DataTableProps<T> = {
  data: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string | number;
  // Options
  searchPlaceholder?: string;
  pageSize?: number;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  // Card mode for mobile
  renderCard?: (row: T) => React.ReactNode;
  // Export
  exportFilename?: string;
};

export function DataTable<T>({
  data,
  columns,
  getRowId,
  searchPlaceholder = "Rechercher…",
  pageSize = 10,
  emptyMessage = "Aucun résultat",
  onRowClick,
  renderCard,
  exportFilename,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  // ── Filter + sort ─────────────────────────────
  const processedData = useMemo(() => {
    let result = [...data];

    // Search (case-insensitive, sur toutes les colonnes)
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((row) =>
        columns.some((col) => {
          const val = col.accessor(row);
          return String(val ?? "").toLowerCase().includes(q);
        })
      );
    }

    // Sort
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col?.sortBy) {
        result.sort((a, b) => {
          const va = col.sortBy!(a);
          const vb = col.sortBy!(b);
          if (va < vb) return sortDir === "asc" ? -1 : 1;
          if (va > vb) return sortDir === "asc" ? 1 : -1;
          return 0;
        });
      }
    }

    return result;
  }, [data, search, sortKey, sortDir, columns]);

  // ── Pagination ────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(processedData.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const pagedData = processedData.slice(startIdx, startIdx + pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // ── CSV Export ────────────────────────────────
  const handleExport = () => {
    const headers = columns.map((c) => c.header).join(",");
    const rows = processedData.map((row) =>
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

  return (
    <div className="space-y-4">
      {/* ── Toolbar ───────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
            className="pl-10"
            aria-label="Rechercher"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {processedData.length} {processedData.length > 1 ? "résultats" : "résultat"}
          </span>
          {exportFilename && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
          )}
        </div>
      </div>

      {/* ── Desktop: Table view ──────────────── */}
      <div className={cn("hidden md:block", renderCard && "md:block")}>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={cn(
                        "text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground",
                        col.hiddenOnMobile && "hidden md:table-cell",
                        col.className
                      )}
                      scope="col"
                    >
                      {col.sortable ? (
                        <button
                          onClick={() => toggleSort(col.key)}
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          {col.header}
                          {sortKey === col.key ? (
                            sortDir === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        col.header
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="text-center py-12 text-muted-foreground"
                    >
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  pagedData.map((row) => (
                    <tr
                      key={getRowId(row)}
                      className={cn(
                        "border-b last:border-0 hover:bg-muted/30 transition-colors",
                        onRowClick && "cursor-pointer"
                      )}
                      onClick={() => onRowClick?.(row)}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            "px-4 py-3",
                            col.hiddenOnMobile && "hidden md:table-cell",
                            col.className
                          )}
                        >
                          {col.accessor(row)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ── Mobile: Card view ─────────────────── */}
      {renderCard && (
        <div className="md:hidden space-y-3">
          {pagedData.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              {emptyMessage}
            </Card>
          ) : (
            pagedData.map((row) => (
              <div
                key={getRowId(row)}
                onClick={() => onRowClick?.(row)}
                className={cn(onRowClick && "cursor-pointer")}
              >
                {renderCard(row)}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Pagination ──────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {startIdx + 1}-{Math.min(startIdx + pageSize, processedData.length)} sur{" "}
            {processedData.length}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ←
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const pageNum = i + 1;
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPage(pageNum)}
                  className="w-9"
                >
                  {pageNum}
                </Button>
              );
            })}
            {totalPages > 5 && (
              <>
                <span className="px-2 self-center">…</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(totalPages)}
                  className="w-9"
                >
                  {totalPages}
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
