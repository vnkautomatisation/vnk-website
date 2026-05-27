// Catégories pour DocumentUploadRequest — module pur (importable client et serveur).
// Ne PAS placer dans un fichier "use server" sinon Next.js retourne une server reference.

export type DocRequestCategory =
  | "licence"
  | "diploma"
  | "certification"
  | "id_card"
  | "passport"
  | "medical"
  | "other";

export const DOC_REQUEST_CATEGORIES: ReadonlyArray<{ value: DocRequestCategory; label: string }> = [
  { value: "licence", label: "Licence / Permis" },
  { value: "diploma", label: "Diplôme" },
  { value: "certification", label: "Certification" },
  { value: "id_card", label: "Carte d'identité" },
  { value: "passport", label: "Passeport" },
  { value: "medical", label: "Document médical" },
  { value: "other", label: "Autre" },
];
