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

export const DOC_REQUEST_CATEGORIES: ReadonlyArray<{ value: DocRequestCategory; labelKey: string }> = [
  { value: "licence", labelKey: "req_cat_licence" },
  { value: "diploma", labelKey: "req_cat_diploma" },
  { value: "certification", labelKey: "req_cat_certification" },
  { value: "id_card", labelKey: "req_cat_id_card" },
  { value: "passport", labelKey: "req_cat_passport" },
  { value: "medical", labelKey: "req_cat_medical" },
  { value: "other", labelKey: "req_cat_other" },
];
