// ─────────────────────────────────────────────────────────
// Types partages entre HandbookSignatureDialog (desktop)
// et HandbookSignatureMobile (mobile/tablet < 1280px).
//
// Fichier separe des composants React pour permettre a Next.js
// Fast Refresh de hot-reload les composants sans full page reload.
// ─────────────────────────────────────────────────────────
import type { SignatureScope } from "@/components/admin/interactive-document-view-types";

export interface HandbookSignatureDialogChapter {
  templateId: number;
  title: string;
  bodyMarkdown: string;
}

export interface HandbookSignatureDialogHandbook {
  id: number;
  title: string;
  subtitle?: string;
  coverIntro?: string;
  version: string;
  signatureScope?: SignatureScope;
  chapters: HandbookSignatureDialogChapter[];
}
