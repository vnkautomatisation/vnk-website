// ─────────────────────────────────────────────────────────
// Types partages du InteractiveDocumentView.
// Fichier separe du composant React pour permettre a Next.js
// Fast Refresh de hot-reload (export uniquement de types).
// ─────────────────────────────────────────────────────────

export type CheckboxStates = Record<number, boolean>;

export type SignatureScope =
  | "employee_only"
  | "employer_only"
  | "both"
  | "none";

export type SignatureAnchor = { label: string; role: string };
