"use client";
// ─────────────────────────────────────────────────────────
// UploadDocumentResponseDialog — l'employé répond à une demande
// RH en téléversant son fichier (PDF / image, max 10 Mo).
//
// POST /api/admin/document-upload-requests/[id]/upload (multipart)
// → serveur appelle submitUploadResponseAction → passe à "uploaded".
// ─────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
  whatKey: string;            // explication concrète
  expectedKey: string;     // format/contenu attendu
  preferredMime: string[]; // si on veut restreindre
}> = {
  licence: {
    icon: IdCard,
    whatKey: "what_licence",
    expectedKey: "expected_licence",
    preferredMime: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  },
  diploma: {
    icon: GraduationCap,
    whatKey: "what_diploma",
    expectedKey: "expected_diploma",
    preferredMime: ["application/pdf", "image/jpeg", "image/png"],
  },
  certification: {
    icon: Award,
    whatKey: "what_certification",
    expectedKey: "expected_certification",
    preferredMime: ["application/pdf", "image/jpeg", "image/png"],
  },
  id_card: {
    icon: CreditCard,
    whatKey: "what_id_card",
    expectedKey: "expected_id_card",
    preferredMime: ["application/pdf", "image/jpeg", "image/png"],
  },
  passport: {
    icon: Globe,
    whatKey: "what_passport",
    expectedKey: "expected_passport",
    preferredMime: ["application/pdf", "image/jpeg", "image/png"],
  },
  medical: {
    icon: Stethoscope,
    whatKey: "what_medical",
    expectedKey: "expected_medical",
    preferredMime: ["application/pdf"],
  },
  other: {
    icon: FileQuestion,
    whatKey: "what_other",
    expectedKey: "expected_other",
    preferredMime: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  },
};

function getCategoryKey(value: string): string | null {
  return DOC_REQUEST_CATEGORIES.find((c) => c.value === value)?.labelKey ?? null;
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
  const t = useTranslations("admin.documents");
  const tc = useTranslations("common");
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

  }, [open]);

  const validateAndSet = (f: File) => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      toast.error(t("type_non_supporte_pdf_png"));
      return;
    }


    if (f.size === 0) {
      toast.error(t("fichier_selectionne_vide_0_octet"));
      return;
    }
    if (f.size < 12) {
      toast.error(t("fichier_selectionne_trop_petit_etre"));
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
      toast.error(t("selectionnez_fichier"));
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

            }
            reject(new Error(errMsg));
          }
        };
        xhr.onerror = () => reject(new Error(t("erreur_reseau")));
        xhr.send(formData);
      });

      toast.success(t("document_televerse_attente_validation_rh"));
      onUploaded();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("erreur_inconnue"));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="p-0 overflow-hidden flex flex-col w-screen h-[100dvh] max-w-none max-h-none rounded-none sm:w-[95vw] sm:max-w-xl sm:h-auto sm:max-h-[92vh] sm:rounded-lg">

        {(() => {
          const meta = CATEGORY_META[request.category as DocRequestCategory] ?? CATEGORY_META.other;
          const CatIcon = meta.icon;
          return (
            <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-4 sm:px-5 py-3 sm:py-4 shrink-0">
              <DialogHeader>
                <div className="flex items-start gap-3 pr-8">
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0 ring-1 ring-white/30">
                    <CatIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-sm sm:text-base text-white truncate">
                      {request.title}
                    </DialogTitle>
                    <DialogDescription className="text-white/80 text-[11px] sm:text-xs mt-0.5">{t("upload_document_response_categorie")}<strong>{getCategoryKey(request.category) ? t(getCategoryKey(request.category)!) : request.category}</strong>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                {request.isRequired && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/20 text-red-100 border border-red-300/40 font-semibold">
                    {tc("required")}
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


        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 overflow-y-auto flex-1">

          {(() => {
            const meta = CATEGORY_META[request.category as DocRequestCategory] ?? CATEGORY_META.other;
            return (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 space-y-1 flex-1">
                  <p className="font-semibold">{t("attendu")}</p>
                  <p>{t(meta.whatKey)}</p>
                  {request.description && (
                    <p className="pt-1 mt-1 border-t border-blue-200 italic">
                      <span className="font-medium not-italic">{t("note_rh")}</span> {request.description}
                    </p>
                  )}
                  <p className="text-[10px] text-blue-700/80 pt-1">
                    {t("format_accepte_max", { format: t(meta.expectedKey), max: MAX_SIZE_MB })}
                  </p>
                </div>
              </div>
            );
          })()}

          <FormSection icon={Upload} title={t("fichier_televerser")}>
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
                  {t("glissez_fichier_ici_cliquez_parcourir")}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  PDF, PNG, JPEG, WebP — max {MAX_SIZE_MB} Mo
                </span>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/20 p-3 flex items-start gap-3">
                {previewUrl ? (

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
                  aria-label={t("retirer_fichier")}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </FormSection>

          <p className="text-[11px] text-muted-foreground">{t("upload_document_response_une_fois_televerse_le_document_sera_verifie")}</p>
        </div>


        <DialogFooter className="px-3 sm:px-5 py-2 sm:py-3 border-t bg-muted/30 shrink-0 gap-2 flex-wrap [&>button]:flex-1 sm:[&>button]:flex-initial">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={uploading}
          >
            {tc("cancel")}
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
                {tc("upload")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
