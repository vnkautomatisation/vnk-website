"use client";
// Bouton client pour ouvrir le PDF des rapports RH via PdfPreviewModal.
// Extrait depuis rapports/page.tsx (Server Component) pour permettre l'usage du modal.
import { useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfPreviewModal } from "@/components/admin/pdf-preview-modal";

export function HrReportPdfButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileText className="h-4 w-4 mr-1.5 text-[#0F2D52]" />Aperçu PDF
      </Button>
      <PdfPreviewModal
        open={open}
        url={open ? "/api/admin/reports/hr/pdf" : null}
        title="Rapport RH"
        description="Vue d'ensemble des effectifs et indicateurs clés (12 derniers mois)"
        downloadFilename="rapport-rh.pdf"
        onClose={() => setOpen(false)}
      />
    </>
  );
}
