"use client";
// ─────────────────────────────────────────────────────────
// UploadDocumentResponseDialog — l'employé répond à une demande
// RH en téléversant son fichier (PDF / image, max 10 Mo).
//
// POST /api/admin/document-upload-requests/[id]/upload (multipart)
// → serveur appelle submitUploadResponseAction → passe à "uploaded".
// ─────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  X,
  Loader2,
  CalendarClock,
  IdCard,
  GraduationCap,
  Award,
  CreditCard,
  Globe,
  Stethoscope,
  FileQuestion,
  Info,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { DOC_REQUEST_CATEGORIES, type DocRequestCategory } from "@/lib/document-requests/categories";

// Méta par catégorie : icône + description de ce qui est attendu + types acceptés
const CATEGORY_META: Record<DocRequestCategory, {
  icon: React.ComponentType<{ className?: string }>;
  what: string;            // explication concrète
  expected: string;        // format/contenu attendu
  preferredMime: string[]; // si on veut restreindre
}> = {
  licence: {
    icon: IdCard,
    what: "Téléversez la photo recto-verso de votre permis (conduire, professionnel, etc.) en cours de validité.",
    expected: "PDF ou photo nette des deux côtés",
    preferredMime: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  },
  diploma: {
    icon: GraduationCap,
    what: "Téléversez la copie scannée de votre diplôme officiel délivré par l'établissement.",
    expected: "PDF recommandé, scan lisible",
    preferredMime: ["application/pdf", "image/jpeg", "image/png"],
  },
  certification: {
    icon: Award,
    what: "Téléversez votre certification professionnelle valide (CNESST, sécurité, SIMDUT, OIQ, etc.).",
    expected: "PDF ou photo du certificat",
    preferredMime: ["application/pdf", "image/jpeg", "image/png"],
  },
  id_card: {
    icon: CreditCard,
    what: "Téléversez votre carte d'identité (recto-verso) en cours de validité.",
    expected: "PDF ou photos claires des deux côtés",
    preferredMime: ["application/pdf", "image/jpeg", "image/png"],
  },
  passport: {
    icon: Globe,
    what: "Téléversez la page principale de votre passeport (photo + informations).",
    expected: "PDF ou photo de la page identité",
    preferredMime: ["application/pdf", "image/jpeg", "image/png"],
  },
  medical: {
    icon: Stethoscope,
    what: "Téléversez le document médical demandé (attestation, certificat d'aptitude, etc.).",
    expected: "PDF de préférence (confidentialité)",
    preferredMime: ["application/pdf"],
  },
  other: {
    icon: FileQuestion,
    what: "Téléversez le document tel que demandé par les RH.",
    expected: "PDF, PNG, JPEG ou WebP",
    preferredMime: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  },
};

function getCategoryLabel(value: string): string {
  return DOC_REQUEST_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/admin/form-section";

const MAX_SIZE_MB = 10;
const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];
const ACCEPT_ATTR = ACCEPTED_TYPES.join(",");

export type UploadResponseRequest = {
  id: number;
  title: string;
  description: string | null;
  category: string;
  isRequired: boolean;
  dueDate: string | null;
  requestedBy?: { id: number; fullName: string | null; email: string } | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" });
}

export function UploadDocumentResponseDialog({
  open,
  onClose,
  onUploaded,
  request,
}: {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
  request: UploadResponseRequest | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!open) {
      setFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setUploading(false);
      setProgress(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const validateAndSet = (f: File) => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      toast.error("Type non supporté (PDF, PNG, JPEG, WebP uniquement)");
      return;
    }
    // ⚠️ Fichier vide : le serveur le rejette avec 400 "Fichier vide".
    // On block ici pour message plus clair + eviter le round-trip inutile.
    if (f.size === 0) {
      toast.error("Le fichier sélectionné est vide (0 octet). Choisissez un fichier non vide.");
      return;
    }
    if (f.size < 12) {
      toast.error("Le fichier sélectionné est trop petit pour être valide.");
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Fichier trop volumineux (max ${MAX_SIZE_MB} Mo)`);
      return;
    }
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (f.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setPreviewUrl(null);
    }
  };

  // Format pour affichage : Ko si < 0.01 Mo, sinon Mo.
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} octets`;
    if (bytes < 1024 * 100) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) validateAndSet(f);
  };

  const removeFile = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    if (uploading) return;
    onClose();
  };

  const submit = async () => {
    if (!request) return;
    if (!file) {
      toast.error("Sélectionnez un fichier");
      return;
    }
    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(
          "POST",
          `/api/admin/document-upload-requests/${request.id}/upload`,
        );
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText || "{}");
              if (data?.error) reject(new Error(data.error));
              else resolve();
            } catch {
              resolve();
            }
          } else {
            let errMsg = `Échec (${xhr.status})`;
            try {
              const data = JSON.parse(xhr.responseText || "{}");
              if (data?.error) errMsg = data.error;
            } catch {
              /* ignore */
            }
            reject(new Error(errMsg));
          }
        };
        xhr.onerror = () => reject(new Error("Erreur réseau"));
        xhr.send(formData);
      });

      toast.success("Document téléversé — en attente de validation RH");
      onUploaded();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-xl max-h-[92vh] p-0 overflow-hidden flex flex-col">
        {/* Header navy avec icône catégorie + contexte enrichi */}
        {(() => {
          const meta = CATEGORY_META[request.category as DocRequestCategory] ?? CATEGORY_META.other;
          const CatIcon = meta.icon;
          return (
            <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0 ring-1 ring-white/30">
                    <CatIcon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-base text-white">
                      {request.title}
                    </DialogTitle>
                    <DialogDescription className="text-white/80 text-xs mt-0.5">
                      Catégorie : <strong>{getCategoryLabel(request.category)}</strong>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                {request.isRequired && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/20 text-red-100 border border-red-300/40 font-semibold">
                    Obligatoire
                  </span>
                )}
                {request.dueDate && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/15 text-white border border-white/30">
                    <CalendarClock className="h-2.5 w-2.5" />
                    Avant le {formatDate(request.dueDate)}
                  </span>
                )}
                {request.requestedBy && (
                  <span className="text-white/70">
                    Demandé par {request.requestedBy.fullName ?? request.requestedBy.email}
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Bandeau d'explication contextuel */}
          {(() => {
            const meta = CATEGORY_META[request.category as DocRequestCategory] ?? CATEGORY_META.other;
            return (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 space-y-1 flex-1">
                  <p className="font-semibold">Ce qui est attendu :</p>
                  <p>{meta.what}</p>
                  {request.description && (
                    <p className="pt-1 mt-1 border-t border-blue-200 italic">
                      <span className="font-medium not-italic">Note RH :</span> {request.description}
                    </p>
                  )}
                  <p className="text-[10px] text-blue-700/80 pt-1">
                    Format accepté : {meta.expected} · max {MAX_SIZE_MB} Mo
                  </p>
                </div>
              </div>
            );
          })()}

          <FormSection icon={Upload} title="Fichier à téléverser">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTR}
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) validateAndSet(f);
              }}
            />
            {!file ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                className={`cursor-pointer rounded-lg border-2 border-dashed p-6 flex flex-col items-center gap-2 transition ${
                  isDragging
                    ? "border-[#0F2D52] bg-[#0F2D52]/5"
                    : "border-input bg-muted/20 hover:bg-muted/40 hover:border-[#0F2D52]/30"
                }`}
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Glissez un fichier ici ou cliquez pour parcourir
                </span>
                <span className="text-[10px] text-muted-foreground">
                  PDF, PNG, JPEG, WebP — max {MAX_SIZE_MB} Mo
                </span>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/20 p-3 flex items-start gap-3">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="h-16 w-16 object-cover rounded-md border bg-white shrink-0"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-md border bg-white flex items-center justify-center shrink-0">
                    {file.type.startsWith("image/") ? (
                      <ImageIcon className="h-6 w-6 text-[#0F2D52]" />
                    ) : (
                      <FileText className="h-6 w-6 text-[#0F2D52]" />
                    )}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatFileSize(file.size)} · {file.type}
                  </p>
                  {uploading && progress > 0 && (
                    <div className="w-full bg-muted h-1 rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-[#0F2D52] transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:text-destructive shrink-0"
                  onClick={removeFile}
                  disabled={uploading}
                  aria-label="Retirer le fichier"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </FormSection>

          <p className="text-[11px] text-muted-foreground">
            Une fois téléversé, le document sera vérifié par les RH avant d'être
            ajouté à votre dossier officiel.
          </p>
        </div>

        {/* Footer sticky */}
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={uploading}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={uploading || !file}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Téléversement {progress > 0 ? `${progress}%` : "…"}
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Téléverser
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
