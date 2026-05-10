"use client";
// Picker de templates inline — affiche au-dessus du composer quand on tape "/"
import { useEffect, useRef, useMemo } from "react";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type Template = {
  id: number;
  shortcut: string;
  title: string;
  body: string;
  category: string | null;
  defaultChannel?: "chat" | "email" | "both" | null;
  emailSubject?: string | null;
  appendSignature?: boolean;
  defaultAttachmentsData?: unknown[] | null;
  usageCount: number;
};

export function TemplatePicker({
  templates,
  query,
  open,
  onSelect,
  onClose,
}: {
  templates: Template[];
  query: string;
  open: boolean;
  onSelect: (tpl: Template) => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query) return templates.slice(0, 8);
    const q = query.toLowerCase();
    return templates
      .filter((t) =>
        t.shortcut.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [templates, query]);

  // Esc pour fermer
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  if (filtered.length === 0) {
    return (
      <div ref={containerRef} className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border bg-popover shadow-lg p-3 text-xs text-muted-foreground">
        Aucun template trouvé pour <span className="font-mono">/{query}</span>. Crée-le dans Paramètres → Templates.
      </div>
    );
  }
  return (
    <div ref={containerRef} className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border bg-popover shadow-lg overflow-hidden">
      <div className="px-3 py-1.5 border-b bg-muted/40 flex items-center gap-1.5">
        <Zap className="h-3 w-3 text-[#0F2D52]" />
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Templates · ↑↓ navigue · Tab/Entrée insère · Esc</span>
      </div>
      <ul className="max-h-[240px] overflow-y-auto">
        {filtered.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onSelect(t)}
              className={cn(
                "w-full text-left px-3 py-2 hover:bg-muted transition-colors flex items-start gap-2 border-b last:border-b-0"
              )}
            >
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#0F2D52] text-white shrink-0 mt-0.5">/{t.shortcut}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{t.title}</p>
                <p className="text-[10px] text-muted-foreground line-clamp-1">{t.body}</p>
              </div>
              {t.usageCount > 0 && (
                <span className="text-[9px] text-muted-foreground shrink-0">{t.usageCount}×</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
