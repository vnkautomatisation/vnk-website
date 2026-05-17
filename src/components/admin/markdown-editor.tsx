"use client";
// Editeur markdown avec toggle preview. Pas de WYSIWYG — saisie raw + onglet prévisualisation.
import { useState } from "react";
import { Eye, Edit3 } from "lucide-react";
import { MarkdownView } from "./markdown-view";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  helpText?: string; // ex: "Markdown supporté : **gras**, *italique*, # titres, - listes, [lien](url)"
};

export function MarkdownEditor({ value, onChange, placeholder, rows = 8, helpText }: Props) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1 text-[11px] font-medium">
        <button
          type="button"
          onClick={() => setMode("edit")}
          className={`px-2 py-1 rounded transition ${mode === "edit" ? "bg-[#0F2D52] text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
        >
          <Edit3 className="h-3 w-3 inline mr-1" />Édition
        </button>
        <button
          type="button"
          onClick={() => setMode("preview")}
          disabled={!value.trim()}
          className={`px-2 py-1 rounded transition ${mode === "preview" ? "bg-[#0F2D52] text-white" : "bg-muted text-muted-foreground hover:bg-muted/70 disabled:opacity-50"}`}
        >
          <Eye className="h-3 w-3 inline mr-1" />Prévisualisation
        </button>
      </div>

      {mode === "edit" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y font-mono"
        />
      ) : (
        <div className="rounded-md border border-input bg-muted/20 px-3 py-2 min-h-[120px]">
          {value.trim() ? (
            <MarkdownView>{value}</MarkdownView>
          ) : (
            <p className="text-xs text-muted-foreground italic">Aucun contenu à prévisualiser.</p>
          )}
        </div>
      )}

      {helpText && <p className="text-[10px] text-muted-foreground">{helpText}</p>}
    </div>
  );
}
