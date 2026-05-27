"use client";
// ─────────────────────────────────────────────────────────
// TemplatePreview — aperçu PDF live d'un template Markdown.
//
// Refonte (v2) : on a abandonné le rendu Markdown HTML "rapide" qui
// dupliquait simplement l'éditeur Tiptap. À la place, on affiche
// directement le PDF qui sera généré côté serveur, dans un iframe.
//
// Pipeline :
//   1. Debounce 800 ms sur le markdown courant
//   2. POST /api/admin/document-templates/preview-pdf
//      avec bodyMarkdown + employeeId test + contractId + metadata
//   3. Lecture du blob -> data URL (FileReader)
//   4. Affichage en iframe (immutable, survit aux re-renders)
//   5. Indicateur de loading pendant le rendu
//   6. Actions : Télécharger PDF / Ouvrir plein écran / Toggle mode debug
//
// Garde :
//   - Le select employé test (en haut)
//   - Le bandeau "X champs inconnus" pour signaler les erreurs
//   - Si pas d'employé : PDF rendu avec placeholders (company.* + date.*)
//
// Mode "Markdown brut" (toggle pour développeurs) : affiche la source
// markdown dans un <pre> pour debug. Désactivé par défaut.
// ─────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Code as CodeIcon,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Maximize2,
  Tag,
  User as UserIcon,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/admin/form-section";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { PdfPreviewModal } from "@/components/admin/pdf-preview-modal";
import { cn } from "@/lib/utils";
import { findVariable } from "@/lib/document-templates/variable-registry";

export type PreviewEmployee = {
  id: number;
  fullName: string | null;
  position: string | null;
  department: string | null;
  avatarUrl: string | null;
};

type Props = {
  bodyMarkdown: string;
  selectedEmployeeId?: number;
  onChangeEmployee: (id: number) => void;
  employees: PreviewEmployee[];
  /** Optionnel : ID de contrat pour enrichir le contexte. */
  contractId?: number;
  /** Titre du document (utilisé dans le PDF et le filename). */
  title?: string;
  /** Type de document (legal | contract | policy | letter | onboarding). */
  documentType?: "legal" | "contract" | "policy" | "letter" | "onboarding";
  /** Métadonnées additionnelles à injecter dans le PDF (version, etc.). */
  metadata?: {
    version?: string;
    employeeName?: string;
    companyName?: string;
    documentNumber?: string;
  };
  className?: string;
};

// FileReader -> data URL (immutable, ne se révoque pas)
async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.readAsDataURL(blob);
  });
}

type ViewMode = "pdf" | "raw";

export function TemplatePreview({
  bodyMarkdown,
  selectedEmployeeId,
  onChangeEmployee,
  employees,
  contractId,
  title,
  documentType,
  metadata,
  className,
}: Props) {
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [missingVars, setMissingVars] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("pdf");
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const employeeMap = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees],
  );

  // Stabilise la clé metadata pour éviter de refetcher à chaque render du parent
  // (qui passerait un nouvel objet `{ version }` à chaque render).
  const metadataKey = useMemo(
    () =>
      JSON.stringify({
        version: metadata?.version ?? null,
        employeeName: metadata?.employeeName ?? null,
        companyName: metadata?.companyName ?? null,
        documentNumber: metadata?.documentNumber ?? null,
      }),
    [
      metadata?.version,
      metadata?.employeeName,
      metadata?.companyName,
      metadata?.documentNumber,
    ],
  );

  // ────────────────────────────────────────────────────────
  // Détection des variables inconnues (registre client)
  // ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!bodyMarkdown.trim()) {
      setMissingVars([]);
      return;
    }
    const matches = bodyMarkdown.match(/\{\{\s*([\w.]+)\s*\}\}/g) ?? [];
    const keys = Array.from(new Set(matches.map((m) => m.replace(/[{}\s]/g, ""))));
    const unknown = keys.filter((k) => !findVariable(k));
    setMissingVars(unknown);
  }, [bodyMarkdown]);

  // ────────────────────────────────────────────────────────
  // Fetch PDF live (debounce 800 ms)
  // ────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "pdf") return;
    if (!bodyMarkdown.trim()) {
      setPdfDataUrl(null);
      setError(null);
      setLoading(false);
      return;
    }

    // Annule fetch en cours
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      fetch("/api/admin/document-templates/preview-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        signal: controller.signal,
        body: JSON.stringify({
          bodyMarkdown,
          title: title ?? "Apercu document",
          documentType: documentType ?? "legal",
          employeeId: selectedEmployeeId,
          contractId: contractId ?? undefined,
          metadata,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            let msg = `HTTP ${res.status}`;
            try {
              const data = await res.json();
              if (data?.error) msg = String(data.error);
            } catch {
              /* ignore */
            }
            throw new Error(msg);
          }
          const blob = await res.blob();
          if (controller.signal.aborted) return null;
          if (blob.size === 0) throw new Error("PDF vide retourne par le serveur");
          // Vérifie la signature %PDF-
          const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
          const isPdf =
            head[0] === 0x25 &&
            head[1] === 0x50 &&
            head[2] === 0x44 &&
            head[3] === 0x46 &&
            head[4] === 0x2d;
          if (!isPdf) throw new Error("Reponse serveur invalide (pas un PDF)");
          return blobToDataUrl(blob);
        })
        .then((url) => {
          if (controller.signal.aborted || !url) return;
          setPdfDataUrl(url);
        })
        .catch((e) => {
          if ((e as Error).name === "AbortError") return;
          const msg = e instanceof Error ? e.message : "Erreur de rendu PDF";
          setError(msg);
          setPdfDataUrl(null);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 800);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    bodyMarkdown,
    selectedEmployeeId,
    contractId,
    title,
    documentType,
    metadataKey,
  ]);

  const selected = selectedEmployeeId ? employeeMap.get(selectedEmployeeId) : null;

  // ────────────────────────────────────────────────────────
  // Actions
  // ────────────────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    if (!pdfDataUrl) return;
    const a = document.createElement("a");
    a.href = pdfDataUrl;
    const cleanTitle = (title ?? "apercu")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .toLowerCase()
      .slice(0, 80) || "apercu";
    a.download = `${cleanTitle}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [pdfDataUrl, title]);

  return (
    <div className={cn("flex flex-col h-full min-h-0", className)}>
      {/* Header : select employé + indicateurs */}
      <div className="shrink-0 space-y-2 pb-3 border-b">
        <Field
          label="Employe test"
          hint="Selectionnez un employe pour voir le rendu avec ses vraies donnees."
        >
          <Select
            value={selectedEmployeeId ? String(selectedEmployeeId) : ""}
            onValueChange={(v) => onChangeEmployee(Number(v))}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Selectionner un employe…" />
            </SelectTrigger>
            <SelectContent>
              {employees.length === 0 ? (
                <div className="px-2 py-2 text-xs text-muted-foreground">
                  Aucun employe disponible
                </div>
              ) : (
                employees.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.fullName ?? `Employe #${e.id}`}
                    {e.position ? ` · ${e.position}` : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </Field>

        {selected && (
          <div className="flex items-center gap-2 rounded-md bg-[#0F2D52]/5 border border-[#0F2D52]/15 px-2.5 py-1.5">
            <UserIcon className="h-3.5 w-3.5 text-[#0F2D52] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate">
                {selected.fullName ?? `Employe #${selected.id}`}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {[selected.position, selected.department]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
            </div>
          </div>
        )}

        {!selectedEmployeeId && bodyMarkdown.trim().length > 0 && (
          <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-200 px-2.5 py-1.5">
            <Tag className="h-3.5 w-3.5 text-blue-700 shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-800 leading-snug">
              Les champs employe/contrat affichent un placeholder.
              Selectionnez un employe pour les remplacer par les vraies donnees.
            </p>
          </div>
        )}

        {missingVars.length > 0 && (
          <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-amber-800">
                {missingVars.length} champ{missingVars.length > 1 ? "s" : ""} inconnu
                {missingVars.length > 1 ? "s" : ""}
              </p>
              <p className="text-[10px] text-amber-700 font-mono break-all">
                {missingVars.slice(0, 6).join(", ")}
                {missingVars.length > 6 && "…"}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-2.5 py-1.5">
            <p className="text-[11px] text-red-700 leading-snug">
              <span className="font-semibold">Erreur de rendu :</span> {error}
            </p>
          </div>
        )}

        {/* Toolbar actions : mode + download + fullscreen */}
        <div className="flex items-center justify-between gap-2">
          {/* Toggle PDF / Markdown brut */}
          <div className="inline-flex items-center gap-0.5 rounded-md bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setMode("pdf")}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition",
                mode === "pdf"
                  ? "bg-background text-[#0F2D52] shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Apercu PDF live"
            >
              <FileText className="h-3 w-3" />
              PDF
            </button>
            <button
              type="button"
              onClick={() => setMode("raw")}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition",
                mode === "raw"
                  ? "bg-background text-[#0F2D52] shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Source Markdown (debug)"
            >
              <CodeIcon className="h-3 w-3" />
              Source
            </button>
          </div>

          <div className="flex items-center gap-1">
            <ActionTooltip label="Telecharger le PDF">
              <button
                type="button"
                onClick={handleDownload}
                disabled={!pdfDataUrl || loading}
                className="inline-flex items-center justify-center h-7 w-7 rounded text-foreground/70 hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition"
                aria-label="Telecharger le PDF"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </ActionTooltip>
            <ActionTooltip label="Ouvrir en plein ecran">
              <button
                type="button"
                onClick={() => setFullscreenOpen(true)}
                disabled={!pdfDataUrl || loading}
                className="inline-flex items-center justify-center h-7 w-7 rounded text-foreground/70 hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition"
                aria-label="Ouvrir le PDF en plein ecran"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </ActionTooltip>
          </div>
        </div>
      </div>

      {/* Rendu */}
      <div className="flex-1 overflow-hidden py-3 min-h-0">
        {!bodyMarkdown.trim() ? (
          <div className="flex flex-col items-center justify-center py-10 text-center h-full">
            <Eye className="h-7 w-7 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">
              Le contenu apparaitra ici une fois le template redige.
            </p>
          </div>
        ) : mode === "raw" ? (
          // Mode source markdown (debug)
          <div className="h-full overflow-auto rounded-md border bg-muted/20">
            <pre className="text-[11px] font-mono p-3 whitespace-pre-wrap break-words text-foreground/80">
              {bodyMarkdown}
            </pre>
          </div>
        ) : (
          // Mode PDF live (par defaut)
          <div className="relative h-full w-full rounded-md border bg-white overflow-hidden">
            {loading && (
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded bg-white/95 border border-input px-2 py-1 shadow-sm">
                <Loader2 className="h-3 w-3 animate-spin text-[#0F2D52]" />
                <span className="text-[10px] text-muted-foreground">
                  Rendu PDF…
                </span>
              </div>
            )}
            {pdfDataUrl ? (
              <iframe
                title="Apercu PDF du document"
                src={pdfDataUrl}
                className="h-full w-full border-0"
              />
            ) : !error ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-[#0F2D52]" />
                <span className="text-xs">Generation du PDF…</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
                <AlertTriangle className="h-7 w-7 text-amber-500" />
                <p className="text-xs text-foreground font-medium">
                  Apercu PDF indisponible
                </p>
                <p className="text-[11px] text-muted-foreground leading-snug max-w-xs">
                  {error}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal plein écran */}
      <PdfPreviewModal
        open={fullscreenOpen}
        url={pdfDataUrl}
        title={`Apercu : ${title ?? "Document"}`}
        description={
          selected?.fullName
            ? `Destinataire : ${selected.fullName}`
            : !selectedEmployeeId
              ? "Aucun employe selectionne (placeholders affiches)"
              : undefined
        }
        downloadFilename={`${(title ?? "apercu")
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-zA-Z0-9-_]+/g, "-")
          .toLowerCase()
          .slice(0, 80) || "apercu"}.pdf`}
        onClose={() => setFullscreenOpen(false)}
      />

      {/* Hint : badge "Ouvrir en nouvel onglet" lien direct */}
      {pdfDataUrl && mode === "pdf" && !loading && (
        <div className="shrink-0 pt-1.5 text-[10px] text-muted-foreground flex items-center gap-1">
          <ExternalLink className="h-2.5 w-2.5" />
          <span>
            L&apos;apercu est rafraichi automatiquement (~800ms apres chaque modification).
          </span>
        </div>
      )}
    </div>
  );
}
