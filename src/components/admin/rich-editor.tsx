"use client";
// Mini éditeur WYSIWYG sans dépendance externe.
// Insère du HTML simple via toolbar + onglet Aperçu pour rendre le contenu.
// Suffisant pour des articles de blog ou réponses FAQ ; pas un Word complet.
import { useState, useRef } from "react";
import { toast } from "sonner";
import {
  Bold, Italic, Underline, Heading1, Heading2, Heading3, List, ListOrdered,
  Link2, Image as ImageIcon, Quote, Code, Eye, FileText, Minus, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tab = "edit" | "preview";

export function RichEditor({
  value,
  onChange,
  rows = 12,
  placeholder = "Rédigez votre contenu...",
}: {
  value: string;
  onChange: (html: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const [tab, setTab] = useState<Tab>("edit");
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wrap = (before: string, after: string = before) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + before + (selected || "texte") + after + value.slice(end);
    onChange(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + (selected || "texte").length);
    }, 0);
  };

  const insertAtCaret = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const next = value.slice(0, start) + text + value.slice(start);
    onChange(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  const insertLink = () => {
    const url = prompt("URL du lien :", "https://");
    if (!url) return;
    wrap(`<a href="${url}" target="_blank" rel="noopener noreferrer">`, "</a>");
  };

  const insertImageByUrl = () => {
    const url = prompt("URL de l'image :", "https://");
    if (!url) return;
    const alt = prompt("Texte alternatif :", "Image") || "Image";
    insertAtCaret(`<img src="${url}" alt="${alt}" />\n`);
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/cms/upload-image", { method: "POST", body: fd });
      const json = await res.json();
      if (res.ok) {
        const alt = file.name.replace(/\.[^.]+$/, "");
        insertAtCaret(`<img src="${json.url}" alt="${alt}" />\n`);
        toast.success("Image insérée");
      } else {
        toast.error(json.error || "Erreur d'upload");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-md border bg-background">
      {/* Onglets edit/preview */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-2">
        <div className="flex">
          <button
            type="button"
            onClick={() => setTab("edit")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 border-b-2 -mb-px",
              tab === "edit" ? "border-[#0F2D52] text-[#0F2D52]" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="h-3.5 w-3.5" />Éditeur
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 border-b-2 -mb-px",
              tab === "preview" ? "border-[#0F2D52] text-[#0F2D52]" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Eye className="h-3.5 w-3.5" />Aperçu
          </button>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {value.length} caractère{value.length > 1 ? "s" : ""}
        </span>
      </div>

      {tab === "edit" && (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/20 p-1">
            <TBtn onClick={() => wrap("<strong>", "</strong>")} title="Gras (Ctrl+B)"><Bold className="h-3.5 w-3.5" /></TBtn>
            <TBtn onClick={() => wrap("<em>", "</em>")} title="Italique"><Italic className="h-3.5 w-3.5" /></TBtn>
            <TBtn onClick={() => wrap("<u>", "</u>")} title="Souligné"><Underline className="h-3.5 w-3.5" /></TBtn>
            <div className="w-px h-5 bg-border mx-1" />
            <TBtn onClick={() => wrap("\n<h1>", "</h1>\n")} title="Titre 1"><Heading1 className="h-3.5 w-3.5" /></TBtn>
            <TBtn onClick={() => wrap("\n<h2>", "</h2>\n")} title="Titre 2"><Heading2 className="h-3.5 w-3.5" /></TBtn>
            <TBtn onClick={() => wrap("\n<h3>", "</h3>\n")} title="Titre 3"><Heading3 className="h-3.5 w-3.5" /></TBtn>
            <div className="w-px h-5 bg-border mx-1" />
            <TBtn onClick={() => insertAtCaret("\n<ul>\n  <li>Élément</li>\n</ul>\n")} title="Liste à puces"><List className="h-3.5 w-3.5" /></TBtn>
            <TBtn onClick={() => insertAtCaret("\n<ol>\n  <li>Élément</li>\n</ol>\n")} title="Liste numérotée"><ListOrdered className="h-3.5 w-3.5" /></TBtn>
            <TBtn onClick={() => wrap("\n<blockquote>", "</blockquote>\n")} title="Citation"><Quote className="h-3.5 w-3.5" /></TBtn>
            <TBtn onClick={() => wrap("<code>", "</code>")} title="Code"><Code className="h-3.5 w-3.5" /></TBtn>
            <div className="w-px h-5 bg-border mx-1" />
            <TBtn onClick={insertLink} title="Lien"><Link2 className="h-3.5 w-3.5" /></TBtn>
            <TBtn onClick={() => fileInputRef.current?.click()} title="Téléverser une image"><Upload className="h-3.5 w-3.5" /></TBtn>
            <TBtn onClick={insertImageByUrl} title="Image depuis une URL"><ImageIcon className="h-3.5 w-3.5" /></TBtn>
            <TBtn onClick={() => insertAtCaret("\n<hr />\n")} title="Séparateur"><Minus className="h-3.5 w-3.5" /></TBtn>
            <div className="w-px h-5 bg-border mx-1" />
            <TBtn onClick={() => insertAtCaret("\n<p></p>\n")} title="Paragraphe">¶</TBtn>
          </div>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            placeholder={placeholder}
            className="w-full font-mono text-xs px-3 py-2 bg-transparent resize-y focus:outline-none"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImageUpload(f);
              e.target.value = "";
            }}
          />
          {uploading && (
            <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t bg-muted/20">
              <Upload className="h-3 w-3 inline mr-1 animate-pulse" />Téléversement en cours...
            </div>
          )}
        </>
      )}

      {tab === "preview" && (
        <div
          className="prose prose-sm max-w-none p-4 min-h-[200px]"
          dangerouslySetInnerHTML={{ __html: value || "<p class='text-muted-foreground italic'>Aucun contenu</p>" }}
        />
      )}
    </div>
  );
}

function TBtn({
  onClick, title, children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      title={title}
      className="h-7 px-2 text-xs"
    >
      {children}
    </Button>
  );
}
