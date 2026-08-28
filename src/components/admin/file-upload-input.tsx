"use client";
// Upload PDF/fichier natif vers `/api/admin/upload` (à brancher selon storage R2/S3 en place).
// Affiche progression, prévisualise le nom, gère erreurs.
//
// Fallback : si l'API d'upload n'existe pas, l'utilisateur peut coller une URL manuellement.
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Upload, FileText, X, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  value: string;
  onChange: (url: string) => void;
  accept?: string;
  maxSizeMB?: number;
  /** Endpoint API auquel POST le FormData (clé "file"). Défaut : /api/admin/upload */
  uploadUrl?: string;
  placeholder?: string;
  /** Préfixe folder dans l'objet storage (ex: "tax-docs") */
  folder?: string;
};

export function FileUploadInput({
  value, onChange, accept = "application/pdf",
  maxSizeMB = 10,
  uploadUrl = "/api/admin/upload",
  placeholder,
  folder = "uploads",
}: Props) {
  const t = useTranslations("admin.ui");
  const tc = useTranslations("common");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<"upload" | "url">("upload");

  const handleFile = async (file: File) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Fichier trop volumineux (max ${maxSizeMB} MB).`);
      return;
    }
    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);


      const url = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", uploadUrl);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              if (data.url) resolve(data.url);
              else reject(new Error(t("reponse_invalide_pas_url")));
            } catch {
              reject(new Error(t("reponse_json_invalide")));
            }
          } else {
            reject(new Error(t("file_upload_input_upload_echoue_p0", { p0: xhr.status })));
          }
        };
        xhr.onerror = () => reject(new Error(t("erreur_reseau")));
        xhr.send(formData);
      });

      onChange(url);
      toast.success(t("fichier_televerse"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("erreur_inconnue");
      toast.error(t("file_upload_input_echec_du_televersement_p0", { p0: msg }));

      setMode("url");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-2">

      <div className="flex gap-1 text-[11px] font-medium">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`px-2 py-1 rounded transition ${mode === "upload" ? "bg-[#0F2D52] text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
        >
          <Upload className="h-3 w-3 inline mr-1" />{tc("upload")}
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`px-2 py-1 rounded transition ${mode === "url" ? "bg-[#0F2D52] text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
        >
          <LinkIcon className="h-3 w-3 inline mr-1" />URL
        </button>
      </div>

      {mode === "upload" ? (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {!value ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full rounded-md border-2 border-dashed border-input bg-muted/20 hover:bg-muted/40 hover:border-[#0F2D52]/30 transition p-4 flex flex-col items-center gap-2 disabled:opacity-50"
            >
              <Upload className={`h-5 w-5 text-muted-foreground ${uploading ? "animate-pulse" : ""}`} />
              <span className="text-xs font-medium">
                {uploading ? t("file_upload_input_televersement_p0", { p0: progress }) : t("cliquez_choisir_fichier")}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {accept === "application/pdf" ? "PDF" : accept} · max {maxSizeMB} MB
              </span>
              {uploading && progress > 0 && (
                <div className="w-full bg-muted h-1 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-[#0F2D52] transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/20">
              <FileText className="h-4 w-4 text-[#0F2D52] shrink-0" />
              <a href={value} target="_blank" rel="noopener" className="text-xs text-[#0F2D52] hover:underline truncate flex-1">
                {value.split("/").pop() || "Fichier téléversé"}
              </a>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:text-destructive"
                onClick={() => onChange("")}
                aria-label={t("retirer_fichier")}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? t("url_ou_cliquez_televerser")}
          type="url"
        />
      )}
    </div>
  );
}
