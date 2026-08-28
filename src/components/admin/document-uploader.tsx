"use client";
// ─────────────────────────────────────────────────────────
// DocumentUploader — Dialog d'upload pour EmployeePersonalDocument
//
// - Drop zone (drag-and-drop + click)
// - Validation : max 10 Mo, types acceptés PDF + images
// - Preview thumbnail si image
// - Champs : catégorie, titre, description, issuer, ref #, dates, privé
// - POST FormData vers /api/admin/employees/[id]/personal-docs/upload
//
// TODO(backend) : l'endpoint POST /api/admin/employees/[id]/personal-docs/upload
// est créé par un autre agent. Contrat de réponse attendu :
//   { success: true, document: { id, fileUrl, ... } } | { error: string }
// ─────────────────────────────────────────────────────────
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  X,
  Loader2,
  Lock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePopover } from "@/components/admin/date-popover";
import { FormSection, Field } from "@/components/admin/form-section";

export const PERSONAL_DOC_CATEGORIES = [
  { value: "licence", labelKey: "licence_permis" },
  { value: "diploma", labelKey: "diplome" },
  { value: "certification", labelKey: "certification" },
  { value: "id_card", labelKey: "carte_identite" },
  { value: "passport", labelKey: "passeport" },
  { value: "medical", labelKey: "document_medical" },
  { value: "other", labelKey: "autre" },
] as const;

export type PersonalDocCategory = (typeof PERSONAL_DOC_CATEGORIES)[number]["value"];

const MAX_SIZE_MB = 10;
const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];
const ACCEPT_ATTR = ACCEPTED_TYPES.join(",");

export function DocumentUploader({
  employeeId,
  open,
  onClose,
  onUploaded,
}: {
  employeeId: number;
  open: boolean;
  onClose: () => void;

  onUploaded: () => void;
}) {
  const t = useTranslations("admin.documents");
  const tc = useTranslations("common");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [category, setCategory] = useState<PersonalDocCategory>("certification");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [issuer, setIssuer] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const reset = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCategory("certification");
    setTitle("");
    setDescription("");
    setIssuer("");
    setRefNumber("");
    setIssuedAt("");
    setExpiresAt("");
    setIsPrivate(false);
    setProgress(0);
    setUploading(false);
  };

  const handleClose = () => {
    if (uploading) return;
    reset();
    onClose();
  };

  const validateAndSet = (f: File) => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      toast.error(t("type_fichier_non_supporte_utilisez"));
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Fichier trop volumineux (max ${MAX_SIZE_MB} Mo).`);
      return;
    }
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (f.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setPreviewUrl(null);
    }

    if (!title.trim()) {
      const base = f.name.replace(/\.[^.]+$/, "");
      setTitle(base.slice(0, 120));
    }
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

  const submit = async () => {
    if (!file) {
      toast.error(t("selectionnez_fichier_televerser"));
      return;
    }
    if (!title.trim()) {
      toast.error(t("titre_requis"));
      return;
    }

    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    formData.append("title", title.trim());
    if (description.trim()) formData.append("description", description.trim());
    if (issuer.trim()) formData.append("issuer", issuer.trim());
    if (refNumber.trim()) formData.append("refNumber", refNumber.trim());
    if (issuedAt) formData.append("issuedAt", issuedAt);
    if (expiresAt) formData.append("expiresAt", expiresAt);
    formData.append("isPrivate", isPrivate ? "1" : "0");

    try {



      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(
          "POST",
          `/api/admin/employees/${employeeId}/personal-docs/upload`
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
            let errMsg = t("document_uploader_echec_de_l_upload_p0", { p0: xhr.status });
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

      toast.success(t("document_televerse"));
      onUploaded();
      reset();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("erreur_inconnue");
      toast.error(t("document_uploader_echec_p0", { p0: msg }));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] p-0 overflow-hidden flex flex-col">

        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Upload className="h-4 w-4" />
              {t("televerser_document_personnel")}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              PDF, PNG, JPEG ou WebP — max {MAX_SIZE_MB} Mo. Les documents marqués
              {t("prives_visibles_rh")}
            </DialogDescription>
          </DialogHeader>
        </div>


        <div className="p-5 space-y-5 overflow-y-auto flex-1">

          <FormSection icon={Upload} title={t("fichier")}>
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
                    {(file.size / (1024 * 1024)).toFixed(2)} Mo · {file.type}
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


          <FormSection icon={FileText} title={t("details_document")}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t("categorie")} required>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v as PersonalDocCategory)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERSONAL_DOC_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {t(c.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("emetteur")} hint={t("ex_saaq_mels_employeur")}>
                <Input
                  value={issuer}
                  onChange={(e) => setIssuer(e.target.value)}
                  placeholder="SAAQ"
                />
              </Field>
            </div>
            <Field label={t("titre")} required>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("permis_classe_5")}
                maxLength={140}
              />
            </Field>
            <Field label={t("numero_reference")}>
              <Input
                value={refNumber}
                onChange={(e) => setRefNumber(e.target.value)}
                placeholder="V1234-567890-12"
              />
            </Field>
            <Field label={t("description")}>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("notes_complementaires")}
                rows={3}
                className="text-sm resize-y"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t("date_emission")}>
                <DatePopover value={issuedAt} onChange={setIssuedAt} />
              </Field>
              <Field label={t("date_expiration")} hint={t("laisser_vide_si_pas_expiration")}>
                <DatePopover value={expiresAt} onChange={setExpiresAt} min={issuedAt || undefined} />
              </Field>
            </div>
            <label className="flex items-start gap-2 p-3 rounded-md border bg-muted/10 cursor-pointer hover:bg-muted/20 transition">
              <Checkbox
                checked={isPrivate}
                onCheckedChange={(v) => setIsPrivate(v === true)}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-[#0F2D52]" />
                  {t("document_prive")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("visible_uniquement_vous_responsables_rh")}
                </p>
              </div>
            </label>
          </FormSection>
        </div>


        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0">
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
