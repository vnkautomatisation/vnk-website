"use client";

import { useState } from "react";
import { FolderOpen, Download } from "lucide-react";
import { DataTable, type Column, type FilterOption } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────
type Doc = {
  id: number;
  title: string;
  category: string | null;
  fileUrl: string | null;
  isRead: boolean;
  createdAt: string;
  mandateTitle: string | null;
};

// ── Category filter options ──────────────────────────────
const categoryFilterOptions: FilterOption[] = [
  { value: "Rapports", label: "Rapports" },
  { value: "Devis", label: "Devis" },
  { value: "Factures", label: "Factures" },
  { value: "Contrats", label: "Contrats" },
  { value: "Manuels", label: "Manuels" },
  { value: "Photos", label: "Photos" },
  { value: "Autre", label: "Autre" },
];

// ── Category badge variant mapping ───────────────────────
const CATEGORY_VARIANT: Record<string, "default" | "secondary" | "info" | "success" | "warning" | "outline"> = {
  Rapports: "info",
  Devis: "warning",
  Factures: "success",
  Contrats: "default",
  Manuels: "secondary",
  Photos: "secondary",
  Autre: "outline",
};

// ── Component ────────────────────────────────────────────
export function PortalDocumentsList({ documents }: { documents: Doc[] }) {
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");

  const handleDownload = (doc: Doc) => {
    if (doc.fileUrl) {
      window.open(doc.fileUrl, "_blank");
    }
  };

  // Apply read filter on top of DataTable's built-in category filter
  const filteredDocs =
    readFilter === "all"
      ? documents
      : readFilter === "unread"
        ? documents.filter((d) => !d.isRead)
        : documents.filter((d) => d.isRead);

  // ── Columns ──────────────────────────────────────────
  const columns: Column<Doc>[] = [
    {
      key: "title",
      header: "Titre",
      accessor: (r) => (
        <div className="flex items-center gap-2">
          {!r.isRead && (
            <span className="h-2 w-2 rounded-full bg-sky-500 shrink-0" />
          )}
          <span className={!r.isRead ? "font-semibold" : ""}>{r.title}</span>
        </div>
      ),
      sortable: true,
      sortBy: (r) => r.title,
    },
    {
      key: "category",
      header: "Categorie",
      accessor: (r) => {
        if (!r.category) return "--";
        const variant = CATEGORY_VARIANT[r.category] ?? "outline";
        return <Badge variant={variant}>{r.category}</Badge>;
      },
    },
    {
      key: "date",
      header: "Date",
      accessor: (r) => formatDate(r.createdAt),
      sortable: true,
      sortBy: (r) => new Date(r.createdAt),
      hiddenOnMobile: true,
    },
    {
      key: "read",
      header: "Lu",
      accessor: (r) => (
        !r.isRead ? (
          <span className="h-2.5 w-2.5 rounded-full bg-sky-500 inline-block" />
        ) : (
          <span className="text-xs text-muted-foreground">Lu</span>
        )
      ),
      hiddenOnMobile: true,
    },
    {
      key: "actions",
      header: "Actions",
      accessor: (r) => (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            handleDownload(r);
          }}
        >
          <Download className="h-3 w-3 mr-1" />
          Telecharger
        </Button>
      ),
    },
  ];

  // ── Card renderer ────────────────────────────────────
  const renderCard = (doc: Doc) => (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {!doc.isRead && (
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500 shrink-0" />
            )}
            <p className={`text-sm truncate ${!doc.isRead ? "font-semibold" : ""}`}>
              {doc.title}
            </p>
          </div>
          {doc.category && (
            <Badge
              variant={CATEGORY_VARIANT[doc.category] ?? "outline"}
              className="shrink-0"
            >
              {doc.category}
            </Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {formatDate(doc.createdAt)}
        </p>

        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => handleDownload(doc)}
        >
          <Download className="h-4 w-4 mr-1" />
          Telecharger
        </Button>
      </CardContent>
    </Card>
  );

  // ── Read status toggle (extra filter) ────────────────
  const readFilterActions = (
    <div className="flex border rounded-md overflow-hidden">
      {(["all", "unread", "read"] as const).map((val) => {
        const labels = { all: "Tous", unread: "Non lus", read: "Lus" };
        return (
          <button
            key={val}
            type="button"
            onClick={() => setReadFilter(val)}
            className={`h-9 px-3 text-xs transition-colors ${
              readFilter === val
                ? "bg-[#0F2D52] text-white"
                : "hover:bg-muted text-muted-foreground"
            }`}
          >
            {labels[val]}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FolderOpen className="h-6 w-6 text-[#0F2D52]" />
        <div>
          <h1 className="text-2xl font-bold">Mes documents</h1>
          <p className="text-sm text-muted-foreground">
            Consultez et telechargez vos documents
          </p>
        </div>
      </div>

      <DataTable
        data={filteredDocs}
        columns={columns}
        getRowId={(r) => r.id}
        renderCard={renderCard}
        storageKey="portal-documents"
        searchPlaceholder="Rechercher un document..."
        searchFn={(r) => `${r.title} ${r.category ?? ""}`}
        filterOptions={categoryFilterOptions}
        filterFn={(r) => r.category ?? "Autre"}
        filterLabel="Toutes les categories"
        headerActions={readFilterActions}
        exportFilename="documents"
        emptyMessage="Aucun document"
        emptyIcon={
          <FolderOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
        }
      />
    </div>
  );
}
