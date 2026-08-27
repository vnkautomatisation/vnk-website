"use client";
// Editeur de body de template avec :
// - Toolbar markdown enrichie (B, I, U, strike, code, code-block, quote, H1-H3, listes, lien, hr, condition, variable)
// - Autocompletion {{ -> menu variables
// - Compteur caracteres
// - Paste cleanup (strip HTML)
// - Detection variables invalides
import { useRef, useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Bold, Italic, Underline, Strikethrough, Code, FileCode, Quote,
  List, ListOrdered, Link2, Minus, Heading1, Heading2, Heading3,
  GitBranch, AlertTriangle, Variable as VariableIcon,
} from "lucide-react";
import { TEMPLATE_VARIABLES, findInvalidVariables } from "@/lib/template-variables";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const SOFT_LIMIT = 2000;
const HARD_LIMIT = 20000;

export function TemplateBodyEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const t = useTranslations("admin.message_templates");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [acOpen, setAcOpen] = useState(false);
  const [acQuery, setAcQuery] = useState("");
  const [acIndex, setAcIndex] = useState(0);
  const invalidVars = findInvalidVariables(value);

  const wrapSelection = useCallback((before: string, after: string = before) => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = value.slice(start, end);
    const next = value.slice(0, start) + before + sel + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      if (sel.length > 0) {
        ta.setSelectionRange(start + before.length, end + before.length);
      } else {
        const pos = start + before.length;
        ta.setSelectionRange(pos, pos);
      }
    });
  }, [value, onChange]);

  const insertAtCursor = useCallback((text: string) => {
    const ta = taRef.current;
    if (!ta) { onChange(value + text); return; }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const newPos = start + text.length;
      ta.setSelectionRange(newPos, newPos);
    });
  }, [value, onChange]);


  const prefixLines = useCallback((prefix: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = value.slice(0, start);
    const sel = value.slice(start, end);
    const after = value.slice(end);
    if (sel.length === 0) {

      const lineStart = before.lastIndexOf("\n") + 1;
      const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
      onChange(next);
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + prefix.length;
        ta.setSelectionRange(pos, pos);
      });
    } else {
      const prefixed = sel.split("\n").map((l) => prefix + l).join("\n");
      const next = before + prefixed + after;
      onChange(next);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start, start + prefixed.length);
      });
    }
  }, [value, onChange]);


  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    const handle = () => {
      const pos = ta.selectionStart ?? 0;
      const before = value.slice(0, pos);
      const m = before.match(/\{\{(\w*)$/);
      if (m) {
        setAcOpen(true);
        setAcQuery(m[1]);
        setAcIndex(0);
      } else {
        setAcOpen(false);
      }
    };
    ta.addEventListener("input", handle);
    ta.addEventListener("click", handle);
    ta.addEventListener("keyup", handle);
    return () => {
      ta.removeEventListener("input", handle);
      ta.removeEventListener("click", handle);
      ta.removeEventListener("keyup", handle);
    };
  }, [value]);

  const filteredVars = TEMPLATE_VARIABLES
    .filter((v) => !acQuery || v.key.toLowerCase().includes(acQuery.toLowerCase()) || t(v.labelKey).toLowerCase().includes(acQuery.toLowerCase()))
    .slice(0, 8);

  const acceptAutocomplete = useCallback((key: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const pos = ta.selectionStart ?? 0;
    const before = value.slice(0, pos);
    const m = before.match(/\{\{(\w*)$/);
    if (!m) return;
    const startReplace = pos - m[0].length;
    const insert = `{{${key}}}`;
    const next = value.slice(0, startReplace) + insert + value.slice(pos);
    onChange(next);
    setAcOpen(false);
    requestAnimationFrame(() => {
      ta.focus();
      const newPos = startReplace + insert.length;
      ta.setSelectionRange(newPos, newPos);
    });
  }, [value, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (acOpen && filteredVars.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setAcIndex((i) => (i + 1) % filteredVars.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setAcIndex((i) => (i - 1 + filteredVars.length) % filteredVars.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); acceptAutocomplete(filteredVars[acIndex].key); return; }
      if (e.key === "Escape") { setAcOpen(false); return; }
    }
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "b") { e.preventDefault(); wrapSelection("**"); }
      else if (e.key === "i") { e.preventDefault(); wrapSelection("*"); }
      else if (e.key === "u") { e.preventDefault(); wrapSelection("__"); }
      else if (e.key === "k") { e.preventDefault(); promptLink(); }
    }
  };

  const promptLink = useCallback(() => {
    const url = prompt(t("url_du_lien"));
    if (url) wrapSelection("[", `](${url})`);
  }, [wrapSelection]);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData("text/html");
    const plain = e.clipboardData.getData("text/plain");
    if (html && !plain) {
      e.preventDefault();
      const cleaned = html
        .replace(/<\/(p|div|li|h\d|br)>/gi, "\n")
        .replace(/<li[^>]*>/gi, "- ")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\n{3,}/g, "\n\n");
      insertAtCursor(cleaned.trim());
    }
  };

  const charCount = value.length;
  const overSoft = charCount > SOFT_LIMIT;
  const overHard = charCount > HARD_LIMIT;

  return (
    <div className="space-y-2">

      <div className="flex items-center gap-0.5 p-1 rounded-md border bg-muted/40 flex-wrap">

        <ToolBtn icon={<Bold className="h-3.5 w-3.5" />} label={t("gras")} shortcut="Ctrl+B" onClick={() => wrapSelection("**")} />
        <ToolBtn icon={<Italic className="h-3.5 w-3.5" />} label={t("italique")} shortcut="Ctrl+I" onClick={() => wrapSelection("*")} />
        <ToolBtn icon={<Underline className="h-3.5 w-3.5" />} label={t("souligne")} shortcut="Ctrl+U" onClick={() => wrapSelection("__")} />
        <ToolBtn icon={<Strikethrough className="h-3.5 w-3.5" />} label={t("barre")} onClick={() => wrapSelection("~~")} />
        <ToolBtn icon={<Code className="h-3.5 w-3.5" />} label={t("code_inline")} onClick={() => wrapSelection("`")} />
        <Sep />


        <ToolBtn icon={<Heading1 className="h-3.5 w-3.5" />} label={t("titre_1")} onClick={() => prefixLines("# ")} />
        <ToolBtn icon={<Heading2 className="h-3.5 w-3.5" />} label={t("titre_2")} onClick={() => prefixLines("## ")} />
        <ToolBtn icon={<Heading3 className="h-3.5 w-3.5" />} label={t("titre_3")} onClick={() => prefixLines("### ")} />
        <Sep />


        <ToolBtn icon={<List className="h-3.5 w-3.5" />} label={t("liste_puces")} onClick={() => prefixLines("- ")} />
        <ToolBtn icon={<ListOrdered className="h-3.5 w-3.5" />} label={t("liste_numerotee")} onClick={() => prefixLines("1. ")} />
        <ToolBtn icon={<Quote className="h-3.5 w-3.5" />} label={t("citation")} onClick={() => prefixLines("> ")} />
        <ToolBtn icon={<FileCode className="h-3.5 w-3.5" />} label={t("bloc_code")} onClick={() => insertAtCursor("\n```\ncode\n```\n")} />
        <Sep />


        <ToolBtn icon={<Link2 className="h-3.5 w-3.5" />} label={t("lien")} shortcut="Ctrl+K" onClick={promptLink} />
        <ToolBtn icon={<Minus className="h-3.5 w-3.5" />} label={t("ligne_horizontale")} onClick={() => insertAtCursor("\n\n---\n\n")} />
        <Sep />


        <Popover>
          <PopoverTrigger asChild>
            <button type="button" title={t("inserer_variable")}
              className="h-7 px-2 flex items-center gap-1 rounded text-muted-foreground hover:bg-background hover:text-foreground transition-colors text-[10px] font-mono">
              <VariableIcon className="h-3 w-3" />
              {`{{}}`}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-2 max-h-[320px] overflow-y-auto" align="start">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground px-1 pb-1">{t("variables_disponibles")}</p>
            {TEMPLATE_VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertAtCursor(`{{${v.key}}}`)}
                className="w-full text-left px-2 py-1 rounded hover:bg-muted transition-colors flex items-start gap-2"
              >
                <code className="font-mono text-[10px] px-1.5 py-0.5 bg-[#0F2D52] text-white rounded shrink-0">{`{{${v.key}}}`}</code>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{t(v.labelKey)}</p>
                </div>
                <span className="text-[9px] text-muted-foreground shrink-0">{v.group}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <button type="button" title={t("bloc_conditionnel")}
              className="h-7 px-2 flex items-center gap-1 rounded text-muted-foreground hover:bg-background hover:text-foreground transition-colors text-[10px]">
              <GitBranch className="h-3 w-3" />Si/Sinon
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-2" align="start">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground px-1 pb-1">{t("inserer_bloc_conditionnel")}</p>
            <button
              type="button"
              onClick={() => insertAtCursor("\n{{#if client_company}}\nVotre entreprise : {{client_company}}\n{{/if}}\n")}
              className="w-full text-left px-2 py-2 rounded hover:bg-muted transition-colors"
            >
              <p className="text-xs font-medium">{t("si_sinon_rien")}</p>
              <code className="text-[10px] text-muted-foreground">{`{{#if x}}…{{/if}}`}</code>
            </button>
            <button
              type="button"
              onClick={() => insertAtCursor("\n{{#if client_company}}\nBonjour {{client_company}}\n{{else}}\nBonjour {{client_first_name}}\n{{/if}}\n")}
              className="w-full text-left px-2 py-2 rounded hover:bg-muted transition-colors"
            >
              <p className="text-xs font-medium">{t("si_sinon")}</p>
              <code className="text-[10px] text-muted-foreground">{`{{#if x}}A{{else}}B{{/if}}`}</code>
            </button>
          </PopoverContent>
        </Popover>


        <div className="ml-auto flex items-center gap-2 pr-1">
          {invalidVars.length > 0 && (
            <span className="text-[10px] text-destructive flex items-center gap-1" title={`Variables inconnues : ${invalidVars.join(", ")}`}>
              <AlertTriangle className="h-3 w-3" />{invalidVars.length} typo{invalidVars.length > 1 ? "s" : ""}
            </span>
          )}
          <span className={cn("text-[10px] tabular-nums", overHard ? "text-destructive font-bold" : overSoft ? "text-amber-600" : "text-muted-foreground")}>
            {charCount} / {SOFT_LIMIT}
          </span>
        </div>
      </div>


      <div className="relative">
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          rows={12}
          maxLength={HARD_LIMIT}
          placeholder={placeholder ?? "Bonjour {{client_first_name}}, ..."}
          className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
        />

        {acOpen && filteredVars.length > 0 && (
          <div className="absolute left-2 right-2 -top-2 z-10 -translate-y-full rounded-lg border bg-popover shadow-xl overflow-hidden max-w-md">
            <div className="px-2 py-1 border-b bg-muted/50 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              Variables {acQuery && <span className="font-mono normal-case text-foreground">/{acQuery}</span>} · ↑↓ Tab/Entrée Esc
            </div>
            <ul>
              {filteredVars.map((v, i) => (
                <li key={v.key}>
                  <button
                    type="button"
                    onClick={() => acceptAutocomplete(v.key)}
                    className={cn(
                      "w-full text-left px-2 py-1.5 flex items-center gap-2 transition-colors",
                      i === acIndex ? "bg-[#0F2D52] text-white" : "hover:bg-muted"
                    )}
                  >
                    <code className={cn("font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0", i === acIndex ? "bg-white/15" : "bg-[#0F2D52] text-white")}>{`{{${v.key}}}`}</code>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{t(v.labelKey)}</p>
                      <p className={cn("text-[10px] truncate", i === acIndex ? "text-white/70" : "text-muted-foreground")}>{v.example}</p>
                    </div>
                    <span className={cn("text-[9px] shrink-0", i === acIndex ? "text-white/60" : "text-muted-foreground")}>{v.group}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolBtn({ icon, label, shortcut, onClick }: { icon: React.ReactNode; label: string; shortcut?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={shortcut ? `${label} (${shortcut})` : label}
      onClick={onClick}
      className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
    >
      {icon}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-4 bg-border mx-0.5" />;
}
