"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FolderOpen, Eye, FileText, EyeOff, FileBarChart, FileSignature } from "lucide-react";
import { DataTable, type Column, type FilterOption } from "@/components/data-table/data-table";
import { PdfViewerModal } from "@/components/ui/pdf-viewer-modal";
import { Button } from "@/components/ui/button";
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

const CATEGORY_COLORS: Record<string, string> = {
  Rapports: "bg-blue-100 text-blue-700 border-blue-200",
  Devis: "bg-amber-100 text-amber-700 border-amber-200",
  Factures: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Contrats: "bg-purple-100 text-purple-700 border-purple-200",
  Manuels: "bg-gray-100 text-gray-700 border-gray-200",
  Photos: "bg-pink-100 text-pink-700 border-pink-200",
  Autre: "bg-gray-100 text-gray-600 border-gray-200",
};

function getFileTypeBadge(title: string, url: string | null) {
  const ext = (url || title).split('.').pop()?.toLowerCase() ?? '';
  if (['pdf'].includes(ext)) return { label: 'PDF', bg: 'bg-red-100 text-red-700' };
  if (['doc', 'docx'].includes(ext)) return { label: 'DOC', bg: 'bg-blue-100 text-blue-700' };
  if (['xls', 'xlsx'].includes(ext)) return { label: 'XLS', bg: 'bg-emerald-100 text-emerald-700' };
  if (['png', 'jpg', 'jpeg'].includes(ext)) return { label: 'IMG', bg: 'bg-purple-100 text-purple-700' };
  return { label: 'DOC', bg: 'bg-gray-100 text-gray-600' };
}

const DOC_CATEGORIES = ["Rapports", "Devis", "Factures", "Contrats", "Manuels", "Photos", "Autre"] as const;

// La casse des categories varie selon l'origine de la ligne ("contrats" et
// "Contrats" coexistent) : on ramene a la forme canonique avant tout usage,
// sinon le filtre ne retrouve pas ces lignes.
function canonicalCategory(c: string | null): string {
  if (!c) return "Autre";
  return DOC_CATEGORIES.find((v) => v.toLowerCase() === c.toLowerCase()) ?? c;
}

export function PortalDocumentsList({ documents: initialDocuments }: { documents: Doc[] }) {
  const t = useTranslations("portal");
  const [docs, setDocs] = useState(initialDocuments);
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);

  // Categorie stockee en francais : on affiche sa traduction, en gardant la
  // valeur brute si elle ne correspond a aucune categorie connue.
  const categoryLabel = (c: string) => {
    const canon = canonicalCategory(c);
    return DOC_CATEGORIES.includes(canon as (typeof DOC_CATEGORIES)[number])
      ? t(`doc_category.${canon.toLowerCase()}` as "doc_category.autre")
      : c;
  };

  // La valeur reste celle stockee en base ; seul le libelle suit le lecteur.
  const categoryFilterOptions: FilterOption[] = [
    { value: "Rapports", label: t("doc_category.rapports") },
    { value: "Devis", label: t("doc_category.devis") },
    { value: "Factures", label: t("doc_category.factures") },
    { value: "Contrats", label: t("doc_category.contrats") },
    { value: "Manuels", label: t("doc_category.manuels") },
    { value: "Photos", label: t("doc_category.photos") },
    { value: "Autre", label: t("doc_category.autre") },
  ];

  const handlePreview = (doc: Doc, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!doc.fileUrl) {
      toast.error(t("aucun_fichier_attache_document"));
      return;
    }
    setPreviewDoc(doc);

    if (!doc.isRead) {
      setDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, isRead: true } : d));
      fetch(`/api/documents/${doc.id}/read`, { method: "PATCH" }).catch(() => {});
    }
  };

  const filteredDocs =
    readFilter === "all"
      ? docs
      : readFilter === "unread"
        ? docs.filter((d) => !d.isRead)
        : docs.filter((d) => d.isRead);

  const columns: Column<Doc>[] = [
    {
      key: "icon",
      header: "",
      className: "w-10",
      accessor: (r) => (
        <button
          onClick={(e) => handlePreview(r, e)}
          className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center hover:bg-[#0F2D52]/20 transition-colors"
          title={t("previsualiser")}
        >
          <FileText className="h-4 w-4 text-[#0F2D52]" />
        </button>
      ),
    },
    {
      key: "title",
      header: t("document"),
      accessor: (r) => (
        <div>
          <div className="flex items-center gap-2">
            <span className={!r.isRead ? "font-semibold" : "font-medium"}>{r.title}</span>
            {!r.isRead && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                {t("non_lu")}
              </span>
            )}
          </div>
          {r.mandateTitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{t("mandat_prefix", { title: r.mandateTitle })}</p>
          )}
        </div>
      ),
      sortable: true,
      sortBy: (r) => r.title,
    },
    {
      key: "category",
      header: t("categorie"),
      accessor: (r) => {
        if (!r.category) return <span className="text-muted-foreground">—</span>;
        const cls = CATEGORY_COLORS[canonicalCategory(r.category)] ?? CATEGORY_COLORS.Autre;
        return (
          <span className={`inline-flex text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${cls}`}>
            {categoryLabel(r.category)}
          </span>
        );
      },
    },
    {
      key: "date",
      header: t("date"),
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
      className: "w-[100px]",
      accessor: (r) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" onClick={(e) => handlePreview(r, e)}>
            <Eye className="h-3.5 w-3.5 mr-1" />
            {t("voir")}
          </Button>
        </div>
      ),
    },
  ];

  const renderCard = (doc: Doc) => {
    const badge = getFileTypeBadge(doc.title, doc.fileUrl);
    return (
      <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
        <div className="h-1.5 bg-[#0F2D52]/20" />
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3 min-w-0">
              <div className="relative shrink-0">
                <div className="h-10 w-10 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center group-hover:bg-[#0F2D52]/20 transition-colors">
                  <FileText className="h-5 w-5 text-[#0F2D52]" />
                </div>
                <span className={`absolute -bottom-1 -right-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${badge.bg} leading-none`}>
                  {badge.label}
                </span>
              </div>
              <div className="min-w-0">
                <p className={`text-sm truncate ${!doc.isRead ? "font-semibold" : "font-medium"}`}>
                  {doc.title}
                </p>
                {!doc.isRead && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200 mt-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                    {t("non_lu")}
                  </span>
                )}
                {doc.mandateTitle && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    Mandat : {doc.mandateTitle}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(new Date(doc.createdAt))}
                  </span>
                  {doc.category && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[canonicalCategory(doc.category)] ?? CATEGORY_COLORS.Autre}`}>
                      {categoryLabel(doc.category)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <Button size="sm" variant="outline" className="w-full" onClick={(e) => handlePreview(doc, e)}>
            <Eye className="h-3.5 w-3.5 mr-1" />
            {t("voir")}
          </Button>
        </CardContent>
      </Card>
    );
  };

  const readFilterActions = (
    <div className="flex border rounded-md overflow-hidden">
      {(["all", "unread", "read"] as const).map((val) => {
        const labels = { all: t("tous"), unread: t("non_lus"), read: t("lus") };
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
      <DataTable
        stickyHeader={
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="portal-icon-lg rounded-xl vnk-gradient flex items-center justify-center shadow-lg">
                <FolderOpen className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="portal-title">{t("titre_documents")}</h1>
                <p className="text-sm text-muted-foreground">
                  {t("consultez_telechargez_documents")}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 portal-kpi-grid mb-3">
              <div className="rounded-xl border bg-[#0F2D52]/5 portal-kpi-card">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
                    <FolderOpen className="h-4 w-4 text-[#0F2D52]" />
                  </div>
                  <div>
                    <p className="portal-kpi-label text-muted-foreground">{t("total_documents")}</p>
                    <p className="portal-kpi-number">{docs.length}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-sky-50/60 portal-kpi-card">
                <div className="flex items-center gap-3">
                  <div className="portal-icon-sm rounded-lg bg-sky-100 flex items-center justify-center">
                    <EyeOff className="h-4 w-4 text-[#0F2D52]" />
                  </div>
                  <div>
                    <p className="portal-kpi-label text-[#0F2D52]">{t("non_lus")}</p>
                    <p className="portal-kpi-number">{docs.filter((d) => !d.isRead).length}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-[#0F2D52]/5 portal-kpi-card">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
                    <FileBarChart className="h-4 w-4 text-[#0F2D52]" />
                  </div>
                  <div>
                    <p className="portal-kpi-label text-muted-foreground">{t("rapports")}</p>
                    <p className="portal-kpi-number">{docs.filter((d) => d.category === "Rapports").length}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-[#0F2D52]/5 portal-kpi-card">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
                    <FileSignature className="h-4 w-4 text-[#0F2D52]" />
                  </div>
                  <div>
                    <p className="portal-kpi-label text-muted-foreground">{t("contrats")}</p>
                    <p className="portal-kpi-number">{docs.filter((d) => d.category === "Contrats").length}</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        }
        data={filteredDocs}
        columns={columns}
        getRowId={(r) => r.id}
        renderCard={renderCard}
        onRowClick={(doc) => handlePreview(doc)}
        storageKey="portal-documents"
        searchPlaceholder={t("rechercher_document")}
        searchFn={(r) => `${r.title} ${r.category ?? ""}`}
        filterOptions={categoryFilterOptions}
        filterFn={(r) => canonicalCategory(r.category)}
        filterLabel={t("toutes_categories")}
        headerActions={readFilterActions}
        emptyMessage={t("aucun_document")}
      />


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
