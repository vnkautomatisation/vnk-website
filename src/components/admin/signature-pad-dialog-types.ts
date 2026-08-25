// ─────────────────────────────────────────────────────────
// signature-pad-dialog-types.ts — Types partages entre les
// variantes desktop (SignaturePadDialog) et mobile/tablet
// (SignaturePadMobile) du dialog de signature.
//
// Extraits dans un fichier dedie pour permettre a Fast Refresh
// de hot-reloader les composants React (Fast Refresh impose
// que les fichiers .tsx n'exportent QUE des composants).
// ─────────────────────────────────────────────────────────
import type { SignatureScope } from "@/components/admin/interactive-document-view-types";

export type SignaturePadDialogDoc = {
  /** Identifiant du template (utilise pour le POST signature-preview-pdf). */
  templateId?: number;
  /**
   * Identifiant de la DocumentSignatureRequest associee (si demande
   * ciblee par RH). Si fourni, le PDF preview applique les
   * customFieldValues de cette demande precise. Sinon le serveur fait
   * un lookup auto sur la derniere demande active ciblant l'employe.
   */
  signatureRequestId?: number;
  /** Titre affiche dans le header navy. */
  title: string;
  /** Version (ex: "1.2") affichee discrètement à côté du titre. */
  version?: string;
  /** Corps markdown brut (utilise UNIQUEMENT pour detecter les cases - [ ]). */
  bodyMarkdown: string;
  /** Si deja resolu cote parent (legacy) — non utilise pour le PDF preview. */
  resolvedMarkdown?: string;
  /** Sous-titre optionnel (categorie, dueDate…). */
  subtitle?: string;
  /**
   * Defaut "employee_only". Determine quel(s) bloc(s) Signature sont rendus
   * dans le PDF preview. Synchronise avec le scope sauvegarde sur le template.
   */
  signatureScope?: SignatureScope;
  /**
   * Mode d'engagement. "reading_only" masque le pad signature (juste accusé
   * de lecture). Defaut "signature" pour compat ascendante.
   */
  acknowledgmentMode?: "reading_only" | "signature";
  /** Optionnel : employeeId pour resoudre le contexte employee.* dans le PDF. */
  employeeId?: number;
};
