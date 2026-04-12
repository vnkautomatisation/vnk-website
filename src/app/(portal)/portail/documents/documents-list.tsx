"use client";

import { useState } from "react";
import { FolderOpen, Download, Eye, FileText, EyeOff, FileBarChart, FileSignature } from "lucide-react";
import { DataTable, type Column, type FilterOption } from "@/components/data-table/data-table";
import { PdfViewerModal } from "@/components/ui/pdf-viewer-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

type Doc = {
  id: number;
  title: string;
  category: string | null;
  fileUrl: string | null;
  isRead: boolean;
  createdAt: string;
  mandateTitle: string | null;
};

const categoryFilterOptions: FilterOption[] = [
  { value: "Rapports", label: "Rapports" },
  { value: "Devis", label: "Devis" },
  { value: "Factures", label: "Factures" },
  { value: "Contrats", label: "Contrats" },
  { value: "Manuels", label: "Manuels" },
  { value: "Photos", label: "Photos" },
  { value: "Autre", label: "Autre" },
];

const CATEGORY_COLORS: Record<string, string> = {
  Rapports: "bg-blue-100 text-blue-700 border-blue-200",
  Devis: "bg-amber-100 text-amber-700 border-amber-200",
  Factures: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Contrats: "bg-purple-100 text-purple-700 border-purple-200",
  Manuels: "bg-gray-100 text-gray-700 border-gray-200",
  Photos: "bg-pink-100 text-pink-700 border-pink-200",
  Autre: "bg-gray-100 text-gray-600 border-gray-200",
};

export function PortalDocumentsList({ documents }: { documents: Doc[] }) {
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);

  const handlePreview = (doc: Doc, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPreviewDoc(doc);
    // Mark as read
    if (!doc.isRead) {
      fetch(`/api/documents/${doc.id}/read`, { method: "PATCH" }).catch(() => {});
    }
  };

  const handleDownload = (doc: Doc, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (doc.fileUrl) {
      const a = document.createElement("a");
      a.href = doc.fileUrl;
      a.download = doc.title;
      a.target = "_blank";
      a.click();
    }
  };

  const filteredDocs =
    readFilter === "all"
      ? documents
      : readFilter === "unread"
        ? documents.filter((d) => !d.isRead)
        : documents.filter((d) => d.isRead);

  const columns: Column<Doc>[] = [
    {
      key: "icon",
      header: "",
      className: "w-10",
      accessor: (r) => (
        <button
          onClick={(e) => handlePreview(r, e)}
          className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center hover:bg-[#0F2D52]/20 transition-colors"
          title="Previsualiser"
        >
          <FileText className="h-4 w-4 text-[#0F2D52]" />
        </button>
      ),
    },
    {
      key: "title",
      header: "Document",
      accessor: (r) => (
        <div>
          <div className="flex items-center gap-2">
            {!r.isRead && (
              <span className="h-2 w-2 rounded-full bg-sky-500 shrink-0 animate-pulse" />
            )}
            <span className={!r.isRead ? "font-semibold" : "font-medium"}>{r.title}</span>
          </div>
          {r.mandateTitle && (
            <p className="text-xs text-muted-foreground mt-0.5">Mandat : {r.mandateTitle}</p>
          )}
        </div>
      ),
      sortable: true,
      sortBy: (r) => r.title,
    },
    {
      key: "category",
      header: "Categorie",
      accessor: (r) => {
        if (!r.category) return <span className="text-muted-foreground">—</span>;
        const cls = CATEGORY_COLORS[r.category] ?? CATEGORY_COLORS.Autre;
        return (
          <span className={`inline-flex text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${cls}`}>
            {r.category}
          </span>
        );
      },
    },
    {
      key: "date",
      header: "Date",
      accessor: (r) => (
        <span className="text-muted-foreground text-sm">
          {formatDate(new Date(r.createdAt))}
        </span>
      ),
      sortable: true,
      sortBy: (r) => new Date(r.createdAt).getTime(),
      hiddenOnMobile: true,
    },
    {
      key: "actions",
      header: "",
      className: "w-[160px]",
      accessor: (r) => (
        <div className="flex gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" onClick={(e) => handlePreview(r, e)}>
            <Eye className="h-3.5 w-3.5 mr-1" />
            Voir
          </Button>
          <Button size="sm" variant="ghost" onClick={(e) => handleDownload(r, e)} title="Telecharger">
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const renderCard = (doc: Doc) => (
    <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
      <div className="h-1.5 bg-[#0F2D52]/20" />
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center shrink-0 group-hover:bg-[#0F2D52]/20 transition-colors">
              <FileText className="h-5 w-5 text-[#0F2D52]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {!doc.isRead && (
                  <span className="h-2 w-2 rounded-full bg-sky-500 shrink-0 animate-pulse" />
                )}
                <p className={`text-sm truncate ${!doc.isRead ? "font-semibold" : "font-medium"}`}>
                  {doc.title}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDate(new Date(doc.createdAt))}
              </p>
            </div>
          </div>
          {doc.category && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${CATEGORY_COLORS[doc.category] ?? CATEGORY_COLORS.Autre}`}>
              {doc.category}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={(e) => handlePreview(doc, e)}>
            <Eye className="h-3.5 w-3.5 mr-1" />
            Voir
          </Button>
          <Button size="sm" variant="ghost" onClick={(e) => handleDownload(doc, e)}>
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const readFilterActions = (
    <div className="flex border rounded-md overflow-hidden">
      {(["all", "unread", "read"] as const).map((val) => {
        const labels = { all: "Tous", unread: "Non lus", read: "Lus" };
        return (
          <button
            key={val}
            type="button"
            onClick={() => setReadFilter(val)}
            className={`h-9 px-3 text-xs font-medium transition-colors ${
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
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg">
          <FolderOpen className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Mes documents</h1>
          <p className="text-sm text-muted-foreground">
            Consultez et telechargez vos documents
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="vnk-kpi-card vnk-stat-blue bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
              <FolderOpen className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total documents</p>
              <p className="text-xl font-bold tracking-tight">{documents.length}</p>
            </div>
          </div>
        </div>
        <div className="vnk-kpi-card vnk-stat-sky bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center shadow-sm">
              <EyeOff className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Non lus</p>
              <p className="text-xl font-bold tracking-tight">{documents.filter((d) => !d.isRead).length}</p>
            </div>
          </div>
        </div>
        <div className="vnk-kpi-card vnk-stat-purple bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-sm">
              <FileBarChart className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Rapports</p>
              <p className="text-xl font-bold tracking-tight">{documents.filter((d) => d.category === "Rapports").length}</p>
            </div>
          </div>
        </div>
        <div className="vnk-kpi-card vnk-stat-emerald bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
              <FileSignature className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Contrats</p>
              <p className="text-xl font-bold tracking-tight">{documents.filter((d) => d.category === "Contrats").length}</p>
            </div>
          </div>
        </div>
      </div>

      <DataTable
        data={filteredDocs}
        columns={columns}
        getRowId={(r) => r.id}
        renderCard={renderCard}
        onRowClick={(doc) => handlePreview(doc)}
        storageKey="portal-documents"
        searchPlaceholder="Rechercher un document..."
        searchFn={(r) => `${r.title} ${r.category ?? ""}`}
        filterOptions={categoryFilterOptions}
        filterFn={(r) => r.category ?? "Autre"}
        filterLabel="Toutes les categories"
        headerActions={readFilterActions}
        emptyMessage="Aucun document"
      />

      {/* PDF preview modal */}
      {previewDoc && (
        <PdfViewerModal
          open={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          pdfUrl={previewDoc.fileUrl ?? `/api/documents/${previewDoc.id}`}
          title={previewDoc.title}
          date={formatDate(new Date(previewDoc.createdAt))}
          downloadName={previewDoc.title}
        />
      )}
    </div>
  );
}
