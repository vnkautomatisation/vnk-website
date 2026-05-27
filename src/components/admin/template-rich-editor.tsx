"use client";
// ─────────────────────────────────────────────────────────
// TemplateRichEditor — vrai WYSIWYG (Tiptap) pour l'edition
// de templates de documents (legal | contract | policy).
//
// Particularite : les variables Mustache `{{employee.fullName}}`
// sont rendues comme des PILLS COLORES dans l'editeur lui-meme,
// avec le label FR (ex "Nom complet") et un fond bleu (champ
// connu) ou rouge (champ inconnu). Les utilisateurs RH ne voient
// JAMAIS la syntaxe technique.
//
// API publique :
//   <TemplateRichEditor value={md} onChange={setMd} ... />
//
// Storage format : Markdown + Mustache (compat 100% avec
//   MarkdownEditor + TemplatePreview + endpoint PDF existant).
//
// Theme VNK : header navy, lucide-react icons, FR uniquement.
// ─────────────────────────────────────────────────────────
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { Extension, Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
// BulletList et OrderedList sont fournis par StarterKit ; nous les
// re-configurons via une extension qui ajoute l'attribut `listStyle`.
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Link } from "@tiptap/extension-link";
import { TextAlign } from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Underline } from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Building2,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Code,
  Eraser,
  FileText,
  Hash,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  LayoutTemplate,
  Link2,
  List,
  ListOrdered,
  Minus,
  Palette,
  PenLine,
  Plus,
  Quote,
  RotateCcw,
  RotateCw,
  ScissorsLineDashed,
  Search,
  Sparkles,
  Strikethrough,
  Table as TableIcon,
  Trash2,
  Type,
  Underline as UnderlineIcon,
  User,
  X,
} from "lucide-react";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  VARIABLE_REGISTRY,
  VARIABLE_SOURCES,
  findVariable,
  type VariableDef,
  type VariableSource,
} from "@/lib/document-templates/variable-registry";

// ─────────────────────────────────────────────────────────
//   Extension Tiptap : FontFamily (mark sur TextStyle)
//
// Étend le TextStyle existant pour permettre de définir
// `style="font-family: …"`. Ajoute aussi les commandes
// `setFontFamily(value)` et `unsetFontFamily()`.
// ─────────────────────────────────────────────────────────
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontFamily: {
      setFontFamily: (fontFamily: string) => ReturnType;
      unsetFontFamily: () => ReturnType;
    };
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

const FontFamily = Extension.create({
  name: "fontFamily",
  addOptions() {
    return { types: ["textStyle"] as string[] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: (el: HTMLElement) =>
              el.style.fontFamily?.replace(/['"]/g, "") || null,
            renderHTML: (attrs: { fontFamily?: string | null }) => {
              if (!attrs.fontFamily) return {};
              return { style: `font-family: ${attrs.fontFamily}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontFamily:
        (fontFamily: string) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontFamily }).run(),
      unsetFontFamily:
        () =>
        ({ chain }) =>
          chain()
            .setMark("textStyle", { fontFamily: null })
            .removeEmptyTextStyle()
            .run(),
    };
  },
});

// ─────────────────────────────────────────────────────────
//   Extension Tiptap : FontSize (mark sur TextStyle)
// ─────────────────────────────────────────────────────────
const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return { types: ["textStyle"] as string[] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.fontSize || null,
            renderHTML: (attrs: { fontSize?: string | null }) => {
              if (!attrs.fontSize) return {};
              return { style: `font-size: ${attrs.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain()
            .setMark("textStyle", { fontSize: null })
            .removeEmptyTextStyle()
            .run(),
    };
  },
});

// ─────────────────────────────────────────────────────────
//   Extension Tiptap : ListStyle (attribut sur bulletList/orderedList)
//
// Ajoute un attribut `listStyle` global sur les noeuds liste pour
// permettre a l'utilisateur de choisir le marqueur (disc / circle /
// square / decimal / lower-alpha / upper-alpha / lower-roman /
// upper-roman) comme dans Word. Le marqueur est rendu via l'attribut
// HTML `style="list-style-type: X"` sur le <ul>/<ol>.
// ─────────────────────────────────────────────────────────
const BULLET_STYLES = ["disc", "circle", "square", "dash"] as const;
const ORDERED_STYLES = [
  "decimal",
  "lower-alpha",
  "upper-alpha",
  "lower-roman",
  "upper-roman",
  "multilevel", // 1, 1.1, 1.1.1 — hiérarchie Word-style via CSS counters
] as const;
type BulletStyle = (typeof BULLET_STYLES)[number];
type OrderedStyle = (typeof ORDERED_STYLES)[number];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    listStyle: {
      setListStyle: (style: string) => ReturnType;
    };
  }
}

const ListStyleExtension = Extension.create({
  name: "listStyle",
  addOptions() {
    return { types: ["bulletList", "orderedList"] as string[] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          listStyle: {
            default: null as string | null,
            parseHTML: (el: HTMLElement) => {
              const data = el.getAttribute("data-list-style");
              if (data) return data;
              const css = el.style?.listStyleType;
              return css || null;
            },
            renderHTML: (attrs: { listStyle?: string | null }) => {
              if (!attrs.listStyle) return {};
              // "dash" est traite a part : pas de marqueur natif, on
              // injecte un tiret via CSS (.tpl-list-dash li::marker).
              if (attrs.listStyle === "dash") {
                return {
                  "data-list-style": "dash",
                  class: "tpl-list-dash",
                  style: "list-style-type: none",
                };
              }
              // "multilevel" : hiérarchie Word 1, 1.1, 1.1.1 via CSS counters.
              // Pas de list-style-type natif (on génère les nombres en ::marker).
              if (attrs.listStyle === "multilevel") {
                return {
                  "data-list-style": "multilevel",
                  class: "tpl-list-multilevel",
                  style: "list-style-type: none",
                };
              }
              return {
                "data-list-style": attrs.listStyle,
                style: `list-style-type: ${attrs.listStyle}`,
              };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setListStyle:
        (style: string) =>
        ({ tr, state, dispatch }) => {
          // Cherche le node bulletList/orderedList parent de la selection.
          const { $from } = state.selection;
          let depth = $from.depth;
          let listPos: number | null = null;
          let listNode: ReturnType<typeof $from.node> | null = null;
          while (depth >= 0) {
            const node = $from.node(depth);
            if (
              node.type.name === "bulletList" ||
              node.type.name === "orderedList"
            ) {
              listPos = $from.before(depth);
              listNode = node;
              break;
            }
            depth--;
          }
          if (!listNode || listPos === null) return false;
          if (dispatch) {
            tr.setNodeMarkup(listPos, undefined, {
              ...listNode.attrs,
              listStyle: style,
            });
            dispatch(tr);
          }
          return true;
        },
    };
  },
});

// ─────────────────────────────────────────────────────────
//   Extension Tiptap : noeud "Variable" (atom inline)
// ─────────────────────────────────────────────────────────
const VariableNode = Node.create({
  name: "variable",
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,
  draggable: true,
  // Permet d'appliquer des marques (bold, italic, color, etc.) sur la pill.
  // `'_'` = toutes les marques sont autorisees (texte, couleur, surlignage).
  marks: "_",

  addAttributes() {
    return {
      key: { default: "" },
      label: { default: "" },
      knownVar: { default: true },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-variable]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const known = HTMLAttributes.knownVar !== false;
    const labelText = HTMLAttributes.label || HTMLAttributes.key || "";
    return [
      "span",
      mergeAttributes(
        {
          "data-variable": HTMLAttributes.key,
          "data-label": HTMLAttributes.label,
          "data-known": known ? "1" : "0",
          class: known
            ? "tpl-pill tpl-pill-known"
            : "tpl-pill tpl-pill-unknown",
          contenteditable: "false",
        },
        // strip our internal attrs from rendered html
        {}
      ),
      labelText,
    ];
  },
});

// ─────────────────────────────────────────────────────────
//   Extension Tiptap : noeud "Pagebreak" (atom block)
// ─────────────────────────────────────────────────────────
const PagebreakNode = Node.create({
  name: "pagebreak",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  parseHTML() {
    return [{ tag: "div[data-pagebreak]" }];
  },

  renderHTML() {
    return [
      "div",
      {
        "data-pagebreak": "1",
        class: "tpl-pagebreak",
        contenteditable: "false",
      },
      ["span", { class: "tpl-pagebreak-label" }, "Saut de page"],
    ];
  },
});

// ─────────────────────────────────────────────────────────
//   Extension : raccourcis clavier Word-style
//
// Ajoute les raccourcis manquants en plus de ceux fournis par
// les extensions standard (Bold = Ctrl+B, Italic = Ctrl+I,
// Underline = Ctrl+U, Code = Ctrl+E déjà natifs ; Tab/Shift+Tab
// pour indent/outdent listes via ListItem natif ; Enter pour
// continuer une liste numérotée natif).
//
//   Ctrl+1 / Ctrl+2 / Ctrl+3        → Heading H1/H2/H3
//   Ctrl+Shift+L                    → BulletList toggle
//   Ctrl+Shift+7                    → OrderedList toggle
//   Ctrl+Shift+8                    → BulletList toggle (alias Word)
//   Ctrl+K                          → ouvrir popover lien
//   Ctrl+Shift+K                    → retirer lien
//   Ctrl+L                          → alignement gauche
//   Ctrl+E                          → alignement centré (override Code)
//   Ctrl+R                          → alignement droite
//   Ctrl+J                          → alignement justifié
//   Ctrl+Shift+M                    → retirer indentation (lift)
//   Ctrl+Backspace                  → effacer mot précédent
//   Ctrl+0                          → paragraphe normal
//   Ctrl+Shift+X                    → strikethrough (alias Word)
//   Ctrl+\ (ou Ctrl+Espace)         → effacer formatage
// ─────────────────────────────────────────────────────────
const WordShortcutsExtension = Extension.create<{
  onOpenLinkPopover?: () => void;
}>({
  name: "wordShortcuts",
  addOptions() {
    return { onOpenLinkPopover: undefined };
  },
  addKeyboardShortcuts() {
    const openLink = () => {
      const cb = this.options.onOpenLinkPopover;
      if (cb) {
        cb();
        return true;
      }
      return false;
    };
    return {
      // Titres
      "Mod-1": () =>
        this.editor.chain().focus().toggleHeading({ level: 1 }).run(),
      "Mod-2": () =>
        this.editor.chain().focus().toggleHeading({ level: 2 }).run(),
      "Mod-3": () =>
        this.editor.chain().focus().toggleHeading({ level: 3 }).run(),
      "Mod-0": () => this.editor.chain().focus().setParagraph().run(),
      // Listes
      "Mod-Shift-l": () =>
        this.editor.chain().focus().toggleBulletList().run(),
      "Mod-Shift-8": () =>
        this.editor.chain().focus().toggleBulletList().run(),
      "Mod-Shift-7": () =>
        this.editor.chain().focus().toggleOrderedList().run(),
      // Alignement (override Mod-e qui est Code natif → on choisit Center
      // car c'est plus utile dans un contexte de document RH).
      "Mod-l": () => this.editor.chain().focus().setTextAlign("left").run(),
      "Mod-e": () => this.editor.chain().focus().setTextAlign("center").run(),
      "Mod-r": () => this.editor.chain().focus().setTextAlign("right").run(),
      "Mod-j": () =>
        this.editor.chain().focus().setTextAlign("justify").run(),
      // Lien
      "Mod-k": () => openLink(),
      "Mod-Shift-k": () => this.editor.chain().focus().unsetLink().run(),
      // Formatage
      "Mod-Shift-x": () => this.editor.chain().focus().toggleStrike().run(),
      "Mod-\\": () =>
        this.editor.chain().focus().unsetAllMarks().clearNodes().run(),
    };
  },
});

// ─────────────────────────────────────────────────────────
//   Tokenizer + sérialiseur Markdown <-> ProseMirror doc
// ─────────────────────────────────────────────────────────
type LineToken =
  | { kind: "text"; value: string }
  | { kind: "variable"; key: string };

function tokenizeLine(line: string): LineToken[] {
  const tokens: LineToken[] = [];
  const re = /\{\{\s*([\w.]+)\s*\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) {
      tokens.push({ kind: "text", value: line.slice(last, m.index) });
    }
    tokens.push({ kind: "variable", key: m[1] });
    last = m.index + m[0].length;
  }
  if (last < line.length) {
    tokens.push({ kind: "text", value: line.slice(last) });
  }
  return tokens;
}

type PMNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  text?: string;
  marks?: Array<{ type: string }>;
};

function inlineTokensToPM(tokens: LineToken[]): PMNode[] {
  const out: PMNode[] = [];
  for (const t of tokens) {
    if (t.kind === "variable") {
      const def = findVariable(t.key);
      out.push({
        type: "variable",
        attrs: {
          key: t.key,
          label: def?.label ?? t.key,
          knownVar: !!def,
        },
      });
    } else if (t.value.length > 0) {
      // Inline marks (bold/italic) — parse minimal markdown
      out.push(...inlineMarkdownToPM(t.value));
    }
  }
  return out;
}

/**
 * Parse minimal inline markdown to PM text nodes with marks.
 * Handles **bold**, *italic*, _italic_.
 * (Code/links omitted for simplicity — they're rare in templates.)
 */
function inlineMarkdownToPM(text: string): PMNode[] {
  if (!text) return [];
  const out: PMNode[] = [];

  // Tokenize **bold** first, then *italic* / _italic_ inside the residue.
  // Simple non-nesting parser — sufficient for HR document content.
  const boldRe = /\*\*([^*\n]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = boldRe.exec(text)) !== null) {
    if (m.index > last) {
      out.push(...italicMarkdownToPM(text.slice(last, m.index)));
    }
    out.push({
      type: "text",
      text: m[1],
      marks: [{ type: "bold" }],
    });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    out.push(...italicMarkdownToPM(text.slice(last)));
  }
  return out;
}

function italicMarkdownToPM(text: string): PMNode[] {
  if (!text) return [];
  const out: PMNode[] = [];
  const re = /\*([^*\n]+)\*|_([^_\n]+)_/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      out.push({ type: "text", text: text.slice(last, m.index) });
    }
    out.push({
      type: "text",
      text: m[1] ?? m[2],
      marks: [{ type: "italic" }],
    });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    out.push({ type: "text", text: text.slice(last) });
  }
  return out;
}

/**
 * Convert a markdown string into a ProseMirror doc JSON.
 * Block parsing : headings (#/##/###), unordered list (- / *),
 * ordered list (1.), paragraphs separated by blank lines.
 */
export function parseMarkdownToDoc(md: string): PMNode {
  const lines = (md ?? "").replace(/\r\n/g, "\n").split("\n");
  const content: PMNode[] = [];

  let i = 0;
  let listType: "bullet" | "ordered" | "task" | null = null;
  let listItems: PMNode[] = [];
  // Style applique a la prochaine liste (issu d'un marker
  // `<!-- list-style: X -->` qui precede immediatement la liste).
  let pendingListStyle: string | null = null;
  // Style courant : applique a la liste en cours d'accumulation pour
  // que flushList sache quel attribut poser sur le noeud.
  let currentListStyle: string | null = null;

  const flushList = () => {
    if (!listType) return;
    if (listType === "task") {
      content.push({
        type: "taskList",
        content: listItems.length > 0 ? listItems : [
          {
            type: "taskItem",
            attrs: { checked: false },
            content: [{ type: "paragraph" }],
          },
        ],
      });
    } else {
      const attrs: Record<string, unknown> | undefined = currentListStyle
        ? { listStyle: currentListStyle }
        : undefined;
      content.push({
        type: listType === "bullet" ? "bulletList" : "orderedList",
        ...(attrs ? { attrs } : {}),
        content: listItems.length > 0 ? listItems : [
          { type: "listItem", content: [{ type: "paragraph" }] },
        ],
      });
    }
    listItems = [];
    listType = null;
    currentListStyle = null;
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw ?? "";
    const trimmed = line.trim();

    // Blank line : flush list, paragraph separator. On garde
    // `pendingListStyle` actif car le marker peut etre suivi d'une
    // ligne vide avant la liste.
    if (!trimmed) {
      flushList();
      i++;
      continue;
    }

    // Pagebreak HTML comment marker
    if (/^<!--\s*pagebreak\s*-->$/i.test(trimmed)) {
      flushList();
      content.push({ type: "pagebreak" });
      i++;
      continue;
    }

    // Marqueur de style de liste (Word-like) :
    // <!-- list-style: lower-alpha -->
    // S'applique a la PROCHAINE liste rencontree.
    const styleMatch = /^<!--\s*list-style:\s*([\w-]+)\s*-->$/i.exec(trimmed);
    if (styleMatch) {
      flushList();
      pendingListStyle = styleMatch[1].toLowerCase();
      i++;
      continue;
    }

    // Horizontal rule (--- ou *** ou ___ sur une ligne, min 3 caracteres)
    if (/^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
      flushList();
      content.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    // Blockquote : lignes consécutives commençant par "> "
    if (/^>\s?/.test(trimmed)) {
      flushList();
      const buf: string[] = [trimmed.replace(/^>\s?/, "")];
      let j = i + 1;
      while (j < lines.length) {
        const r = (lines[j] ?? "").trim();
        if (!/^>\s?/.test(r)) break;
        buf.push(r.replace(/^>\s?/, ""));
        j++;
      }
      const joined = buf.join(" ");
      const inline = inlineTokensToPM(tokenizeLine(joined));
      content.push({
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: inline.length > 0 ? inline : undefined,
          },
        ],
      });
      i = j;
      continue;
    }

    // Heading
    const h = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (h) {
      flushList();
      const level = h[1].length;
      const inline = inlineTokensToPM(tokenizeLine(h[2]));
      content.push({
        type: "heading",
        attrs: { level },
        content: inline.length > 0 ? inline : undefined,
      });
      i++;
      continue;
    }

    // Task list (checkbox markdown) : "- [ ] Texte" ou "- [x] Texte"
    const task = /^[-*]\s+\[([ xX])\]\s+(.*)$/.exec(trimmed);
    if (task) {
      if (listType && listType !== "task") flushList();
      listType = "task";
      const checked = task[1].toLowerCase() === "x";
      const inline = inlineTokensToPM(tokenizeLine(task[2]));
      listItems.push({
        type: "taskItem",
        attrs: { checked },
        content: [
          {
            type: "paragraph",
            content: inline.length > 0 ? inline : undefined,
          },
        ],
      });
      i++;
      continue;
    }

    // Unordered list — detecte les listes indentees (nested) via la
    // largeur du whitespace en debut de ligne (line, pas trimmed).
    const ulMatch = /^(\s*)[-*]\s+(.*)$/.exec(line);
    if (ulMatch && !/^[-*]\s+\[/.test(trimmed)) {
      if (listType && listType !== "bullet") flushList();
      if (!listType) {
        listType = "bullet";
        if (pendingListStyle) {
          currentListStyle = pendingListStyle;
          pendingListStyle = null;
        }
      }
      const indent = ulMatch[1].length;
      const inline = inlineTokensToPM(tokenizeLine(ulMatch[2]));
      const itemContent: PMNode[] = [
        {
          type: "paragraph",
          content: inline.length > 0 ? inline : undefined,
        },
      ];
      // Cherche les enfants indentes (>= indent+2) sous cet item
      // et les recursifie en sous-listes.
      let j = i + 1;
      const childLines: string[] = [];
      while (j < lines.length) {
        const cl = lines[j] ?? "";
        const ws = /^(\s*)/.exec(cl)?.[1]?.length ?? 0;
        if (cl.trim() === "") {
          // ligne vide : on garde si l'item se poursuit
          if (j + 1 < lines.length) {
            const nextWs = /^(\s*)/.exec(lines[j + 1] ?? "")?.[1]?.length ?? 0;
            if (nextWs > indent) {
              childLines.push("");
              j++;
              continue;
            }
          }
          break;
        }
        if (ws > indent) {
          // dedent au niveau de l'item enfant
          childLines.push(cl.slice(indent + 2));
          j++;
        } else {
          break;
        }
      }
      if (childLines.length > 0) {
        const childDoc = parseMarkdownToDoc(childLines.join("\n"));
        for (const cb of childDoc.content ?? []) {
          if (cb.type === "bulletList" || cb.type === "orderedList") {
            itemContent.push(cb);
          }
        }
      }
      listItems.push({ type: "listItem", content: itemContent });
      i = j;
      continue;
    }

    // Ordered list — gestion identique avec indentation pour multi-niveau.
    const olMatch = /^(\s*)\d+\.\s+(.*)$/.exec(line);
    if (olMatch) {
      if (listType && listType !== "ordered") flushList();
      if (!listType) {
        listType = "ordered";
        if (pendingListStyle) {
          currentListStyle = pendingListStyle;
          pendingListStyle = null;
        }
      }
      const indent = olMatch[1].length;
      const inline = inlineTokensToPM(tokenizeLine(olMatch[2]));
      const itemContent: PMNode[] = [
        {
          type: "paragraph",
          content: inline.length > 0 ? inline : undefined,
        },
      ];
      let j = i + 1;
      const childLines: string[] = [];
      while (j < lines.length) {
        const cl = lines[j] ?? "";
        const ws = /^(\s*)/.exec(cl)?.[1]?.length ?? 0;
        if (cl.trim() === "") {
          if (j + 1 < lines.length) {
            const nextWs = /^(\s*)/.exec(lines[j + 1] ?? "")?.[1]?.length ?? 0;
            if (nextWs > indent) {
              childLines.push("");
              j++;
              continue;
            }
          }
          break;
        }
        if (ws > indent) {
          childLines.push(cl.slice(indent + 3));
          j++;
        } else {
          break;
        }
      }
      if (childLines.length > 0) {
        const childDoc = parseMarkdownToDoc(childLines.join("\n"));
        for (const cb of childDoc.content ?? []) {
          if (cb.type === "bulletList" || cb.type === "orderedList") {
            itemContent.push(cb);
          }
        }
      }
      listItems.push({ type: "listItem", content: itemContent });
      i = j;
      continue;
    }

    // Table markdown : `| h1 | h2 |\n|---|---|\n| c1 | c2 |`
    // On detecte une ligne de pipe + une ligne separateur, on parse en
    // noeud table Tiptap natif.
    if (/^\|.*\|$/.test(trimmed)) {
      const nextRaw = (lines[i + 1] ?? "").trim();
      const sepRe = /^\|\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|\s*$/;
      if (sepRe.test(nextRaw)) {
        flushList();
        const splitCells = (s: string): string[] => {
          const inner = s.replace(/^\|/, "").replace(/\|\s*$/, "");
          return inner.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
        };
        const headerCells = splitCells(trimmed);
        const bodyRows: string[][] = [];
        let j = i + 2;
        while (j < lines.length) {
          const r = (lines[j] ?? "").trim();
          if (!/^\|.*\|$/.test(r)) break;
          bodyRows.push(splitCells(r));
          j++;
        }
        const buildRow = (cells: string[], isHeader: boolean): PMNode => ({
          type: "tableRow",
          content: cells.map((cellText) => ({
            type: isHeader ? "tableHeader" : "tableCell",
            content: [
              {
                type: "paragraph",
                content: inlineTokensToPM(tokenizeLine(cellText)),
              },
            ],
          })),
        });
        const tableContent: PMNode[] = [buildRow(headerCells, true)];
        for (const row of bodyRows) {
          tableContent.push(buildRow(row, false));
        }
        content.push({ type: "table", content: tableContent });
        i = j;
        continue;
      }
      // Pas de separateur -> traite comme paragraphe normal
      flushList();
      const inline = inlineTokensToPM(tokenizeLine(trimmed));
      content.push({
        type: "paragraph",
        content: inline.length > 0 ? inline : undefined,
      });
      i++;
      continue;
    }

    // Paragraph : accumulate consecutive non-blank, non-special lines
    flushList();
    const buf: string[] = [trimmed];
    let j = i + 1;
    while (j < lines.length) {
      const next = (lines[j] ?? "").trim();
      if (!next) break;
      if (/^(#{1,3})\s+/.test(next)) break;
      if (/^[-*]\s+\[[ xX]\]\s+/.test(next)) break;
      if (/^[-*]\s+/.test(next)) break;
      if (/^\d+\.\s+/.test(next)) break;
      if (/^\|.*\|$/.test(next)) break;
      if (/^>\s?/.test(next)) break;
      if (/^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(next)) break;
      buf.push(next);
      j++;
    }
    const joined = buf.join(" ");
    const inline = inlineTokensToPM(tokenizeLine(joined));
    content.push({
      type: "paragraph",
      content: inline.length > 0 ? inline : undefined,
    });
    i = j;
  }

  flushList();

  if (content.length === 0) {
    content.push({ type: "paragraph" });
  }

  return { type: "doc", content };
}

// ─────────────────────────────────────────────────────────
//   Sérialiseur : ProseMirror doc -> Markdown + {{...}}
// ─────────────────────────────────────────────────────────
function serializeInline(node: PMNode): string {
  if (node.type === "variable") {
    const key = (node.attrs?.key as string) ?? "";
    return `{{${key}}}`;
  }
  if (node.type === "text") {
    let txt = node.text ?? "";
    const marks = node.marks ?? [];
    const hasBold = marks.some((m) => m.type === "bold");
    const hasItalic = marks.some((m) => m.type === "italic");
    const linkMark = marks.find((m) => m.type === "link") as
      | { type: string; attrs?: { href?: string } }
      | undefined;
    if (hasBold) txt = `**${txt}**`;
    if (hasItalic) txt = `*${txt}*`;
    if (linkMark?.attrs?.href) txt = `[${txt}](${linkMark.attrs.href})`;
    return txt;
  }
  // hardBreak
  if (node.type === "hardBreak") return "\n";
  return "";
}

function serializeInlineList(nodes: PMNode[] | undefined): string {
  if (!nodes) return "";
  return nodes.map(serializeInline).join("");
}

// Serialise un <li> avec son paragraphe principal + listes imbriquees
// indentees (2 espaces par niveau) pour permettre la persistance Word-like
// 1, 1.1, 1.1.1 dans le markdown.
function serializeListItem(item: PMNode, marker: string): string {
  const blocks = item.content ?? [];
  if (blocks.length === 0) return `${marker} `;
  const lines: string[] = [];
  const firstPara = blocks[0];
  const firstText =
    firstPara?.type === "paragraph"
      ? serializeInlineList(firstPara.content)
      : "";
  lines.push(`${marker} ${firstText}`);
  // Indente les blocs suivants (listes imbriquees, paragraphes additionnels)
  // de la largeur du marker + 1 espace, pour la convention markdown CommonMark.
  const indent = " ".repeat(marker.length + 1);
  for (let k = 1; k < blocks.length; k++) {
    const child = blocks[k];
    const rendered = serializeBlock(child);
    if (!rendered) continue;
    const indented = rendered
      .split("\n")
      .map((l) => (l.length > 0 ? indent + l : l))
      .join("\n");
    lines.push(indented);
  }
  return lines.join("\n");
}

function serializeBlock(node: PMNode): string {
  switch (node.type) {
    case "paragraph": {
      const inner = serializeInlineList(node.content);
      return inner; // separated by \n\n in caller
    }
    case "heading": {
      const level = Math.max(1, Math.min(3, Number(node.attrs?.level ?? 1)));
      const inner = serializeInlineList(node.content);
      return `${"#".repeat(level)} ${inner}`;
    }
    case "bulletList": {
      const style = (node.attrs?.listStyle as string | undefined) ?? null;
      const items = (node.content ?? [])
        .map((item) => serializeListItem(item, "-"))
        .join("\n");
      return style ? `<!-- list-style: ${style} -->\n${items}` : items;
    }
    case "orderedList": {
      const style = (node.attrs?.listStyle as string | undefined) ?? null;
      const items = (node.content ?? [])
        .map((item, idx) => serializeListItem(item, `${idx + 1}.`))
        .join("\n");
      return style ? `<!-- list-style: ${style} -->\n${items}` : items;
    }
    case "taskList": {
      return (node.content ?? [])
        .map((item) => {
          const para = item.content?.[0];
          const checked = item.attrs?.checked === true;
          const marker = checked ? "[x]" : "[ ]";
          return `- ${marker} ${serializeInlineList(para?.content)}`;
        })
        .join("\n");
    }
    case "pagebreak": {
      return "<!-- pagebreak -->";
    }
    case "horizontalRule": {
      return "---";
    }
    case "blockquote": {
      // Préfixe chaque ligne du contenu avec "> "
      const inner = (node.content ?? [])
        .map((child) => serializeBlock(child))
        .join("\n");
      return inner
        .split("\n")
        .map((l) => (l.length > 0 ? `> ${l}` : ">"))
        .join("\n");
    }
    case "table": {
      // Sérialise en markdown standard : | h1 | h2 |\n|---|---|\n| c1 | c2 |
      const rows = node.content ?? [];
      if (rows.length === 0) return "";
      const allRows: string[][] = [];
      for (const row of rows) {
        const cells = (row.content ?? []).map((cell) => {
          const inner = (cell.content ?? [])
            .map((para) => serializeInlineList(para.content))
            .join(" ")
            .replace(/\|/g, "\\|");
          return inner.trim() || " ";
        });
        allRows.push(cells);
      }
      if (allRows.length === 0) return "";
      const maxCols = Math.max(...allRows.map((r) => r.length));
      const sep = Array.from({ length: maxCols }, () => "---").join(" | ");
      const out: string[] = [];
      out.push(`| ${allRows[0].join(" | ")} |`);
      out.push(`| ${sep} |`);
      for (let i = 1; i < allRows.length; i++) {
        out.push(`| ${allRows[i].join(" | ")} |`);
      }
      return out.join("\n");
    }
    default:
      return "";
  }
}

// Detecte si un texte ressemble a une ligne de tableau markdown (`| ... |`)
function isTableRowText(s: string): boolean {
  const t = (s ?? "").trim();
  return /^\|.*\|$/.test(t);
}

export function serializeDocToMarkdown(doc: PMNode): string {
  if (!doc || !doc.content) return "";
  const parts: string[] = [];
  for (const block of doc.content) {
    parts.push(serializeBlock(block));
  }
  if (parts.length === 0) return "";
  // Reconstruction avec separateur \n entre lignes de tableau adjacentes,
  // \n\n entre blocs standards.
  let out = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const prev = parts[i - 1] ?? "";
    const cur = parts[i] ?? "";
    const sep = isTableRowText(prev) && isTableRowText(cur) ? "\n" : "\n\n";
    out += sep + cur;
  }
  return out.replace(/[ \t]+$/gm, "").trim();
}

// ─────────────────────────────────────────────────────────
//   Composant principal : TemplateRichEditor
// ─────────────────────────────────────────────────────────
export type NumberingMode = "auto" | "none";

type Props = {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  /**
   * Mode de numerotation hierarchique des titres :
   *  - "auto" (defaut) : H2 = "1.", H3 = "1.1" via CSS counters.
   *  - "none" : aucune numerotation automatique.
   * Si fourni avec onNumberingChange, le composant devient controle.
   * Sinon, il maintient un etat local (par defaut "auto").
   */
  numbering?: NumberingMode;
  onNumberingChange?: (mode: NumberingMode) => void;
};

const SOURCE_ICONS: Record<VariableSource, React.ComponentType<{ className?: string }>> = {
  employee: User,
  contract: FileText,
  company: Building2,
  date: Calendar,
  signature: PenLine,
};

export function TemplateRichEditor({
  value,
  onChange,
  placeholder,
  minHeight = "320px",
  className,
  numbering: numberingProp,
  onNumberingChange,
}: Props) {
  // Mode de numerotation : controle externe via numberingProp, ou state local.
  // Defaut = "auto" pour matcher le rendu PDF (qui auto-numerote par defaut).
  // Defaut "none" : laisse le user choisir explicitement la numerotation
  // (evite le double "1. 1. Titre" si seed contient deja des numeros manuels)
  const [numberingState, setNumberingState] = useState<NumberingMode>(
    numberingProp ?? "none",
  );
  const numbering = numberingProp ?? numberingState;
  const setNumbering = useCallback(
    (mode: NumberingMode) => {
      if (onNumberingChange) onNumberingChange(mode);
      if (numberingProp === undefined) setNumberingState(mode);
    },
    [numberingProp, onNumberingChange],
  );

  // Keep last-emitted markdown to short-circuit no-op echo loops
  const lastEmittedRef = useRef<string>(value ?? "");
  // Flag : skip onChange echo when external `value` was just applied
  const skipNextEmitRef = useRef<boolean>(false);
  // Debounce timer pour onUpdate : evite re-serialiser le markdown a chaque
  // keystroke ou clic toolbar (latence sur long template > 5000 chars).
  const debounceTimerRef = useRef<number | null>(null);
  // Compteur de selection : force React a re-rendre la toolbar quand la
  // selection change dans l'editeur, pour que les boutons (bold/italic/etc.)
  // affichent leur etat actif correctement quand on clique sur du texte stylise.
  const [, setSelectionTick] = useState(0);

  // Cleanup debounce timer au demontage du composant
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Pill popover state (action menu on click)
  const [pillMenu, setPillMenu] = useState<{
    x: number;
    y: number;
    key: string;
    label: string;
    pos: number;
  } | null>(null);

  // Lien : état contrôlé pour permettre l'ouverture via Ctrl+K (raccourci Word).
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable codeBlock (geré différemment ailleurs si besoin), mais
        // on active Blockquote et HorizontalRule qui font partie du markdown
        // standard et sont utilisés dans les documents RH (citations légales,
        // séparateurs visuels).
        codeBlock: false,
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Commencez a rediger…",
      }),
      VariableNode,
      PagebreakNode,
      ListStyleExtension,
      WordShortcutsExtension.configure({
        onOpenLinkPopover: () => setLinkPopoverOpen(true),
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
      }),
      Table.configure({ resizable: false, HTMLAttributes: { class: "tpl-table" } }),
      TableRow,
      TableHeader,
      TableCell,
      Underline,
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: parseMarkdownToDoc(value ?? ""),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tpl-richeditor-content focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      if (skipNextEmitRef.current) {
        skipNextEmitRef.current = false;
        return;
      }
      // Debounce 150ms : evite de re-serialiser le markdown a chaque keystroke
      // ou clic toolbar sur un long template (>5000 chars). Reduit le lag.
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = window.setTimeout(() => {
        const json = editor.getJSON() as PMNode;
        const md = serializeDocToMarkdown(json);
        if (md === lastEmittedRef.current) return;
        lastEmittedRef.current = md;
        onChange(md);
      }, 150);
    },
    onSelectionUpdate: ({ editor }) => {
      // Force re-render de la toolbar : isActive('bold') etc. doivent etre
      // re-evalues quand la selection change (clic dans du texte deja stylise).
      setSelectionTick((t) => t + 1);
      // Visual feedback : marque les pills variables incluses dans la selection.
      // Les atoms contenteditable=false sont normalement "sautes" par la selection
      // browser, donc le user ne voit pas que la pill est dans la range. On
      // ajoute une classe `is-selected` sur celles dont la position est dans
      // [from, to] de la selection ProseMirror.
      try {
        const { from, to } = editor.state.selection;
        const wrapper = editorWrapperRef.current;
        if (!wrapper) return;
        const pills = wrapper.querySelectorAll<HTMLElement>("[data-variable]");
        pills.forEach((pill) => {
          try {
            const pos = editor.view.posAtDOM(pill, 0);
            if (pos >= from && pos < to) {
              pill.classList.add("is-selected");
            } else {
              pill.classList.remove("is-selected");
            }
          } catch {
            pill.classList.remove("is-selected");
          }
        });
      } catch {
        // posAtDOM peut échouer en transition de doc - on ignore.
      }
    },
    onTransaction: () => {
      // Idem : tout changement de marks/nodes doit declencher re-render toolbar.
      setSelectionTick((t) => t + 1);
    },
  });

  // Sync external `value` -> editor when it diverges (e.g. import,
  // quick-insert toolbar in parent, starter template selection).
  useEffect(() => {
    if (!editor) return;
    const incoming = value ?? "";
    if (incoming === lastEmittedRef.current) return;
    // Compute serialized current to compare
    const currentMd = serializeDocToMarkdown(editor.getJSON() as PMNode);
    if (incoming === currentMd) return;
    skipNextEmitRef.current = true;
    lastEmittedRef.current = incoming;
    const doc = parseMarkdownToDoc(incoming);
    editor.commands.setContent(doc, { emitUpdate: false });
  }, [value, editor]);

  // Click handler for pills (delegated)
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const wrapper = editorWrapperRef.current;
    if (!wrapper || !editor) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const pill = target.closest<HTMLElement>("[data-variable]");
      if (!pill) {
        setPillMenu(null);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const key = pill.getAttribute("data-variable") ?? "";
      const label =
        pill.getAttribute("data-label") || findVariable(key)?.label || key;
      const rect = pill.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      // Find PM position of the clicked node
      let foundPos: number | null = null;
      try {
        const view = editor.view;
        const posInfo = view.posAtCoords({
          left: rect.left + rect.width / 2,
          top: rect.top + rect.height / 2,
        });
        if (posInfo) foundPos = posInfo.pos;
      } catch {
        foundPos = null;
      }
      setPillMenu({
        x: rect.left - wrapperRect.left + rect.width / 2,
        y: rect.bottom - wrapperRect.top + 4,
        key,
        label,
        pos: foundPos ?? 0,
      });
    };
    wrapper.addEventListener("click", onClick);
    return () => wrapper.removeEventListener("click", onClick);
  }, [editor]);

  // Close pill menu on outside click / Esc
  useEffect(() => {
    if (!pillMenu) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-pill-menu]")) return;
      setPillMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPillMenu(null);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [pillMenu]);

  const insertVariable = useCallback(
    (def: VariableDef) => {
      if (!editor) return;
      editor
        .chain()
        .focus()
        .insertContent({
          type: "variable",
          attrs: {
            key: def.key,
            label: def.label,
            knownVar: true,
          },
        })
        .run();
    },
    [editor]
  );

  const replacePillAt = useCallback(
    (pos: number, def: VariableDef) => {
      if (!editor) return;
      const view = editor.view;
      const node = view.state.doc.nodeAt(pos);
      if (!node) return;
      const tr = view.state.tr.replaceWith(pos, pos + node.nodeSize, [
        view.state.schema.nodes.variable.create({
          key: def.key,
          label: def.label,
          knownVar: true,
        }),
      ]);
      view.dispatch(tr);
      setPillMenu(null);
    },
    [editor]
  );

  const deletePillAt = useCallback(
    (pos: number) => {
      if (!editor) return;
      const view = editor.view;
      const node = view.state.doc.nodeAt(pos);
      if (!node) return;
      const tr = view.state.tr.delete(pos, pos + node.nodeSize);
      view.dispatch(tr);
      setPillMenu(null);
    },
    [editor]
  );

  if (!editor) {
    return (
      <div
        className={cn(
          "rounded-md border border-input bg-muted/20 px-3 py-6 text-xs text-muted-foreground italic",
          className
        )}
      >
        Chargement de l&apos;editeur…
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Toolbar */}
      <RichToolbar
        editor={editor}
        onPickVariable={insertVariable}
        numbering={numbering}
        onSetNumbering={setNumbering}
        linkPopoverOpen={linkPopoverOpen}
        onLinkPopoverOpenChange={setLinkPopoverOpen}
      />

      {/* Editor */}
      <div
        ref={editorWrapperRef}
        className="relative rounded-md border border-input bg-background"
        data-numbering={numbering}
      >
        <EditorContent
          editor={editor}
          className="tpl-richeditor px-4 py-3 text-sm leading-relaxed"
          style={{ minHeight }}
        />

        {/* Pill action menu (popover) */}
        {pillMenu && (
          <PillActionMenu
            x={pillMenu.x}
            y={pillMenu.y}
            currentKey={pillMenu.key}
            currentLabel={pillMenu.label}
            onReplace={(def) => replacePillAt(pillMenu.pos, def)}
            onDelete={() => deletePillAt(pillMenu.pos)}
            onClose={() => setPillMenu(null)}
          />
        )}
      </div>

      {/* Local styles for pills + placeholder */}
      <style jsx global>{`
        .tpl-richeditor .ProseMirror {
          min-height: ${minHeight};
          outline: none;
        }
        .tpl-richeditor .ProseMirror p {
          margin: 0.5em 0;
        }
        .tpl-richeditor .ProseMirror h1 {
          font-size: 1.25rem;
          font-weight: 700;
          margin: 0.8em 0 0.4em;
          color: #0f2d52;
        }
        .tpl-richeditor .ProseMirror h2 {
          font-size: 1.05rem;
          font-weight: 700;
          margin: 0.7em 0 0.35em;
          color: #0f2d52;
        }
        .tpl-richeditor .ProseMirror h3 {
          font-size: 0.95rem;
          font-weight: 600;
          margin: 0.6em 0 0.3em;
        }
        /* Auto-numerotation hierarchique des titres dans l'editeur,
           coherente avec le rendu PDF (data-numbering="auto" sur le wrapper). */
        [data-numbering="auto"] .tpl-richeditor .ProseMirror {
          counter-reset: tpl-h2 tpl-h3;
        }
        [data-numbering="auto"] .tpl-richeditor .ProseMirror h2 {
          counter-reset: tpl-h3;
        }
        [data-numbering="auto"] .tpl-richeditor .ProseMirror h2::before {
          counter-increment: tpl-h2;
          content: counter(tpl-h2) ". ";
          color: #0f2d52;
          font-weight: 700;
          margin-right: 0.35em;
        }
        [data-numbering="auto"] .tpl-richeditor .ProseMirror h3::before {
          counter-increment: tpl-h3;
          content: counter(tpl-h2) "." counter(tpl-h3) " ";
          color: #334155;
          font-weight: 600;
          margin-right: 0.35em;
        }
        .tpl-richeditor .ProseMirror ul {
          list-style: disc;
          padding-left: 1.5rem;
          margin: 0.5em 0;
        }
        .tpl-richeditor .ProseMirror ol {
          list-style: decimal;
          padding-left: 1.5rem;
          margin: 0.5em 0;
        }
        .tpl-richeditor .ProseMirror li {
          margin: 0.15em 0;
        }
        /* Style "dash" : tiret long manuel via ::marker (pas de list-style-type
           natif pour le tiret, on simule). */
        .tpl-richeditor .ProseMirror ul.tpl-list-dash {
          list-style: none;
          padding-left: 1.5rem;
        }
        .tpl-richeditor .ProseMirror ul.tpl-list-dash > li {
          position: relative;
        }
        .tpl-richeditor .ProseMirror ul.tpl-list-dash > li::before {
          content: "\\2014";
          position: absolute;
          left: -1.1rem;
          color: #0F2D52;
          font-weight: 600;
        }
        /* Style "multilevel" : hiérarchie Word 1, 1.1, 1.1.1 — niveaux
           gérés via CSS counters. Niveau 1 = decimal, niveau 2 = a.b,
           niveau 3 = a.b.c. Indentation via Tab/Shift+Tab sur les listes. */
        .tpl-richeditor .ProseMirror ol.tpl-list-multilevel {
          counter-reset: lvl1;
          list-style: none;
          padding-left: 1.5rem;
        }
        .tpl-richeditor .ProseMirror ol.tpl-list-multilevel > li {
          counter-increment: lvl1;
          position: relative;
        }
        .tpl-richeditor .ProseMirror ol.tpl-list-multilevel > li::before {
          content: counter(lvl1) ".";
          position: absolute;
          left: -1.5rem;
          color: #0F2D52;
          font-weight: 600;
          min-width: 1.4rem;
          text-align: right;
          padding-right: 0.25rem;
        }
        .tpl-richeditor .ProseMirror ol.tpl-list-multilevel ol.tpl-list-multilevel,
        .tpl-richeditor .ProseMirror ol.tpl-list-multilevel ol {
          counter-reset: lvl2;
          padding-left: 1.5rem;
        }
        .tpl-richeditor .ProseMirror ol.tpl-list-multilevel ol > li {
          counter-increment: lvl2;
        }
        .tpl-richeditor .ProseMirror ol.tpl-list-multilevel ol > li::before {
          content: counter(lvl1) "." counter(lvl2);
        }
        .tpl-richeditor .ProseMirror ol.tpl-list-multilevel ol ol {
          counter-reset: lvl3;
        }
        .tpl-richeditor .ProseMirror ol.tpl-list-multilevel ol ol > li {
          counter-increment: lvl3;
        }
        .tpl-richeditor .ProseMirror ol.tpl-list-multilevel ol ol > li::before {
          content: counter(lvl1) "." counter(lvl2) "." counter(lvl3);
        }
        .tpl-richeditor .ProseMirror ul[data-type="taskList"] {
          list-style: none;
          padding-left: 0.25rem;
          margin: 0.5em 0;
        }
        .tpl-richeditor .ProseMirror ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin: 0.25em 0;
        }
        .tpl-richeditor .ProseMirror ul[data-type="taskList"] li > label {
          flex: 0 0 auto;
          margin-top: 3px;
          user-select: none;
        }
        .tpl-richeditor .ProseMirror ul[data-type="taskList"] li > div {
          flex: 1 1 auto;
          min-width: 0;
        }
        .tpl-richeditor .ProseMirror ul[data-type="taskList"] li > div > p {
          margin: 0;
        }
        .tpl-richeditor
          .ProseMirror
          ul[data-type="taskList"]
          input[type="checkbox"] {
          appearance: none;
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border: 1.5px solid #0f2d52;
          border-radius: 2px;
          background: #ffffff;
          cursor: pointer;
          display: inline-grid;
          place-content: center;
          margin: 0;
          vertical-align: middle;
        }
        .tpl-richeditor
          .ProseMirror
          ul[data-type="taskList"]
          input[type="checkbox"]:checked {
          background: #0f2d52;
        }
        .tpl-richeditor
          .ProseMirror
          ul[data-type="taskList"]
          input[type="checkbox"]:checked::after {
          content: "";
          width: 8px;
          height: 4px;
          border-left: 1.5px solid #ffffff;
          border-bottom: 1.5px solid #ffffff;
          transform: rotate(-45deg) translate(1px, -1px);
        }
        .tpl-richeditor
          .ProseMirror
          ul[data-type="taskList"]
          li[data-checked="true"] > div > p {
          color: #64748b;
        }
        .tpl-richeditor .ProseMirror strong {
          font-weight: 600;
          color: #0F2D52;
        }
        .tpl-richeditor .ProseMirror em {
          font-style: italic;
        }
        .tpl-richeditor .ProseMirror u {
          text-decoration: underline;
          text-decoration-color: #0F2D52;
          text-underline-offset: 2px;
        }
        .tpl-richeditor .ProseMirror s {
          text-decoration: line-through;
          text-decoration-color: #DC2626;
        }
        .tpl-richeditor .ProseMirror code {
          background: #f1f5f9;
          color: #0F2D52;
          padding: 1px 5px;
          border-radius: 3px;
          font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.88em;
          border: 1px solid #e2e8f0;
        }
        .tpl-richeditor .ProseMirror mark {
          padding: 0 2px;
          border-radius: 2px;
        }
        .tpl-richeditor
          .ProseMirror
          p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
        .tpl-pill {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          padding: 1px 6px;
          margin: 0 2px;
          border-radius: 4px;
          font-size: 0.8em;
          font-weight: 600;
          line-height: 1.4;
          vertical-align: baseline;
          cursor: pointer;
          user-select: none;
          border: 1px solid;
          transition: filter 0.12s ease;
        }
        .tpl-pill:hover {
          filter: brightness(0.95);
        }
        .tpl-pill-known {
          background: #dbeafe;
          color: #1e3a8a;
          border-color: #93c5fd;
        }
        .tpl-pill-unknown {
          background: #fee2e2;
          color: #7f1d1d;
          border-color: #fca5a5;
        }
        .tpl-pill.ProseMirror-selectednode {
          outline: 2px solid #0f2d52;
          outline-offset: 1px;
        }
        /* Pill visuellement incluse dans une range selection (drag-select) :
           applique un fond bleu cohérent avec le ::selection texte navigateur,
           car les atoms contenteditable=false sont normalement sautes. */
        .tpl-pill.is-selected {
          background: #3b82f6 !important;
          color: #ffffff !important;
          border-color: #1d4ed8 !important;
        }
        .tpl-pagebreak {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 1.2em 0;
          padding: 6px 0;
          border: none;
          border-top: 2px dashed #94a3b8;
          border-bottom: 2px dashed #94a3b8;
          color: #475569;
          user-select: none;
          position: relative;
          background: linear-gradient(180deg, transparent, #f1f5f9 50%, transparent);
        }
        .tpl-pagebreak-label {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 9999px;
          padding: 1px 10px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #475569;
        }
        .tpl-pagebreak.ProseMirror-selectednode {
          outline: 2px solid #0f2d52;
          outline-offset: 2px;
        }
        .tpl-richeditor .ProseMirror table {
          border-collapse: collapse;
          margin: 0.6em 0;
          width: 100%;
          table-layout: fixed;
          overflow: hidden;
          border: 1px solid #e2e8f0;
        }
        .tpl-richeditor .ProseMirror table th,
        .tpl-richeditor .ProseMirror table td {
          border: 1px solid #e2e8f0;
          padding: 6px 9px;
          vertical-align: top;
          position: relative;
          min-width: 1em;
        }
        .tpl-richeditor .ProseMirror table th {
          background: #0F2D52;
          color: #ffffff;
          font-weight: 600;
          text-align: left;
        }
        .tpl-richeditor .ProseMirror table th p,
        .tpl-richeditor .ProseMirror table td p {
          margin: 0;
        }
        .tpl-richeditor .ProseMirror table tr:nth-child(even) td {
          background: #F8FAFC;
        }
        .tpl-richeditor .ProseMirror table .selectedCell {
          background: rgba(15, 45, 82, 0.12);
        }
        .tpl-richeditor .ProseMirror a {
          color: #0F2D52;
          text-decoration: underline;
        }
        .tpl-richeditor .ProseMirror blockquote {
          margin: 0.75em 0;
          padding: 0.5em 0.9em;
          border-left: 3px solid #0F2D52;
          background: #f1f5f9;
          color: #334155;
          font-style: italic;
          border-radius: 0 4px 4px 0;
        }
        .tpl-richeditor .ProseMirror blockquote p {
          margin: 0.2em 0;
        }
        .tpl-richeditor .ProseMirror hr {
          border: none;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            #cbd5e1 20%,
            #cbd5e1 80%,
            transparent
          );
          margin: 1.2em 0;
        }
        .tpl-richeditor .ProseMirror hr.ProseMirror-selectednode {
          outline: 2px solid #0f2d52;
          outline-offset: 4px;
          background: #0F2D52;
        }
        .tpl-richeditor .ProseMirror [style*="text-align: center"] {
          text-align: center;
        }
        .tpl-richeditor .ProseMirror [style*="text-align: right"] {
          text-align: right;
        }
        .tpl-richeditor .ProseMirror [style*="text-align: justify"] {
          text-align: justify;
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//   Toolbar pro : 10 groupes
//   1. Undo / Redo
//   2. Famille + taille de police
//   3. Style inline (B/I/U/Strike/Code) + Clear formatting
//   4. Couleurs (texte + surligneur)
//   5. Titres (H1/H2/H3) + Citation (blockquote)
//   6. Alignement (gauche/centre/droite/justifie)
//   7. Listes (puces/numerotee/cases) + Indent/Outdent
//   8. Insertion (lien/tableau/separateur/saut de page)
//   9. Champ dynamique (variables)
//  10. Sections types (preambule/signatures/conformite)
// ─────────────────────────────────────────────────────────

// Palettes VNK
const TEXT_COLORS: Array<{ value: string; label: string }> = [
  { value: "#0F2D52", label: "Navy" },
  { value: "#15406d", label: "Navy clair" },
  { value: "#334155", label: "Gris foncé" },
  { value: "#64748B", label: "Gris" },
  { value: "#DC2626", label: "Rouge" },
  { value: "#16A34A", label: "Vert" },
  { value: "#D97706", label: "Ambre" },
];

const HIGHLIGHT_COLORS: Array<{ value: string; label: string }> = [
  { value: "#fef3c7", label: "Jaune" },
  { value: "#dcfce7", label: "Vert clair" },
  { value: "#dbeafe", label: "Bleu clair" },
  { value: "#fee2e2", label: "Rouge clair" },
  { value: "#f3e8ff", label: "Violet clair" },
];

function RichToolbar({
  editor,
  onPickVariable,
  numbering,
  onSetNumbering,
  linkPopoverOpen,
  onLinkPopoverOpenChange,
}: {
  editor: Editor;
  onPickVariable: (def: VariableDef) => void;
  numbering: NumberingMode;
  onSetNumbering: (mode: NumberingMode) => void;
  linkPopoverOpen: boolean;
  onLinkPopoverOpenChange: (next: boolean) => void;
}) {
  // ─── Indent / Outdent listes ─────────────────────────────────
  const canIndent =
    editor.can().sinkListItem("listItem") || editor.can().sinkListItem("taskItem");
  const canOutdent =
    editor.can().liftListItem("listItem") || editor.can().liftListItem("taskItem");
  const handleIndent = () => {
    if (editor.can().sinkListItem("taskItem")) {
      editor.chain().focus().sinkListItem("taskItem").run();
    } else {
      editor.chain().focus().sinkListItem("listItem").run();
    }
  };
  const handleOutdent = () => {
    if (editor.can().liftListItem("taskItem")) {
      editor.chain().focus().liftListItem("taskItem").run();
    } else {
      editor.chain().focus().liftListItem("listItem").run();
    }
  };

  return (
    <div className="border rounded-lg bg-muted/30 p-1.5 flex flex-wrap items-center gap-0.5">
      {/* Groupe 1 — Undo / Redo */}
      <TbButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Annuler (Ctrl+Z)"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </TbButton>
      <TbButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Rétablir (Ctrl+Y)"
      >
        <RotateCw className="h-3.5 w-3.5" />
      </TbButton>

      <TbDivider />

      {/* Groupe 2 — Famille + taille de police */}
      <FontFamilyDropdown editor={editor} />
      <FontSizeDropdown editor={editor} />

      <TbDivider />

      {/* Groupe 3 — Style inline */}
      <TbButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Gras (Ctrl+B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </TbButton>
      <TbButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italique (Ctrl+I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </TbButton>
      <TbButton
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Souligné (Ctrl+U)"
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </TbButton>
      <TbButton
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Barré"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </TbButton>
      <TbButton
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Code inline"
      >
        <Code className="h-3.5 w-3.5" />
      </TbButton>
      <TbButton
        onClick={() =>
          editor.chain().focus().unsetAllMarks().clearNodes().run()
        }
        title="Effacer toute la mise en forme"
      >
        <Eraser className="h-3.5 w-3.5" />
      </TbButton>

      <TbDivider />

      {/* Groupe 4 — Couleurs */}
      <TextColorPopover editor={editor} />
      <HighlightColorPopover editor={editor} />

      <TbDivider />

      {/* Groupe 5 — Titres + citation */}
      <TbButton
        active={editor.isActive("heading", { level: 1 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }
        title="Titre 1"
      >
        <Heading1 className="h-3.5 w-3.5" />
      </TbButton>
      <TbButton
        active={editor.isActive("heading", { level: 2 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        title="Titre 2"
      >
        <Heading2 className="h-3.5 w-3.5" />
      </TbButton>
      <TbButton
        active={editor.isActive("heading", { level: 3 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
        title="Titre 3"
      >
        <Heading3 className="h-3.5 w-3.5" />
      </TbButton>
      <TbButton
        active={numbering === "auto"}
        onClick={() =>
          onSetNumbering(numbering === "auto" ? "none" : "auto")
        }
        title={
          numbering === "auto"
            ? "Numerotation auto activee (1, 1.1, 1.2) — cliquer pour desactiver"
            : "Activer la numerotation auto des titres (1, 1.1, 1.2)"
        }
      >
        <Hash className="h-3.5 w-3.5" />
      </TbButton>
      <TbButton
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Citation"
      >
        <Quote className="h-3.5 w-3.5" />
      </TbButton>

      <TbDivider />

      {/* Groupe 6 — Alignement */}
      <TbButton
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        title="Aligner à gauche"
      >
        <AlignLeft className="h-3.5 w-3.5" />
      </TbButton>
      <TbButton
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        title="Centrer"
      >
        <AlignCenter className="h-3.5 w-3.5" />
      </TbButton>
      <TbButton
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        title="Aligner à droite"
      >
        <AlignRight className="h-3.5 w-3.5" />
      </TbButton>
      <TbButton
        active={editor.isActive({ textAlign: "justify" })}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        title="Justifier"
      >
        <AlignJustify className="h-3.5 w-3.5" />
      </TbButton>

      <TbDivider />

      {/* Groupe 7 — Listes + indent / outdent */}
      <BulletListDropdown editor={editor} />
      <OrderedListDropdown editor={editor} />
      <TbButton
        active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        title="Cases à cocher"
      >
        <CheckSquare className="h-3.5 w-3.5" />
      </TbButton>
      <TbButton
        onClick={handleOutdent}
        disabled={!canOutdent}
        title="Diminuer l'indentation (Maj+Tab)"
      >
        <IndentDecrease className="h-3.5 w-3.5" />
      </TbButton>
      <TbButton
        onClick={handleIndent}
        disabled={!canIndent}
        title="Augmenter l'indentation (Tab)"
      >
        <IndentIncrease className="h-3.5 w-3.5" />
      </TbButton>

      <TbDivider />

      {/* Groupe 8 — Insertion (lien / tableau / séparateur / saut de page) */}
      <LinkPopover
        editor={editor}
        open={linkPopoverOpen}
        onOpenChange={onLinkPopoverOpenChange}
      />
      <TablePopover editor={editor} />
      <TbButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Insérer un séparateur horizontal"
      >
        <Minus className="h-3.5 w-3.5" />
      </TbButton>
      <TbButton
        onClick={() => {
          editor.chain().focus().insertContent({ type: "pagebreak" }).run();
        }}
        title="Saut de page"
      >
        <ScissorsLineDashed className="h-3.5 w-3.5" />
      </TbButton>

      <TbDivider />

      {/* Groupe 9 — Champ dynamique */}
      <VariableInsertPopover onPick={onPickVariable} />

      <TbDivider />

      {/* Groupe 10 — Sections types */}
      <SectionInsertPopover editor={editor} />
    </div>
  );
}

function TbDivider() {
  return <div className="w-px h-6 bg-border mx-1" />;
}

function TbButton({
  active,
  onClick,
  title,
  children,
  asChild = false,
  disabled = false,
}: {
  active?: boolean;
  onClick?: () => void;
  title: string;
  children: React.ReactNode;
  asChild?: boolean;
  disabled?: boolean;
}) {
  const className = cn(
    "inline-flex items-center justify-center h-8 min-w-8 px-2 rounded text-foreground/80 hover:bg-accent hover:text-foreground transition",
    active && "bg-[#0F2D52] text-white hover:bg-[#15406d] hover:text-white",
    disabled && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-foreground/80",
  );
  if (asChild) {
    return (
      <ActionTooltip label={title}>
        <span className={className}>{children}</span>
      </ActionTooltip>
    );
  }
  return (
    <ActionTooltip label={title}>
      <button
        type="button"
        disabled={disabled}
        onMouseDown={(e) => {
          // Prevent loss of selection
          e.preventDefault();
        }}
        onClick={onClick}
        className={className}
      >
        {children}
      </button>
    </ActionTooltip>
  );
}

// ─────────────────────────────────────────────────────────
//   Dropdown : famille de police
// ─────────────────────────────────────────────────────────
const FONT_FAMILIES: Array<{ value: string; label: string; cssStack: string }> = [
  { value: "default", label: "Par défaut", cssStack: "" },
  {
    value: "Inter",
    label: "Inter",
    cssStack: "Inter, system-ui, sans-serif",
  },
  {
    value: "Playfair Display",
    label: "Playfair Display",
    cssStack: '"Playfair Display", Georgia, serif',
  },
  {
    value: "Georgia",
    label: "Georgia",
    cssStack: "Georgia, 'Times New Roman', serif",
  },
  {
    value: "Courier",
    label: "Courier (monospace)",
    cssStack:
      "'Courier New', Courier, ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  {
    value: "system-ui",
    label: "Système",
    cssStack: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },
];

function FontFamilyDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const currentValue =
    (editor.getAttributes("textStyle")?.fontFamily as string | undefined) ?? null;
  // Trouve le label affiché : compare avec cssStack
  const currentFamily =
    FONT_FAMILIES.find((f) => f.cssStack === currentValue) ?? FONT_FAMILIES[0];

  const apply = (f: (typeof FONT_FAMILIES)[number]) => {
    if (!f.cssStack) {
      editor.chain().focus().unsetFontFamily().run();
    } else {
      editor.chain().focus().setFontFamily(f.cssStack).run();
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          className="inline-flex items-center gap-1 h-8 px-2 rounded text-foreground/80 hover:bg-accent hover:text-foreground transition text-[11px] font-medium min-w-[100px] max-w-[140px]"
          title="Famille de police"
        >
          <Type className="h-3 w-3 shrink-0" />
          <span
            className="truncate"
            style={
              currentFamily.cssStack
                ? { fontFamily: currentFamily.cssStack }
                : undefined
            }
          >
            {currentFamily.label}
          </span>
          <ChevronDown className="h-2.5 w-2.5 opacity-60 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[220px] p-0 overflow-hidden"
      >
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] text-white px-3 py-2">
          <div className="flex items-center gap-2">
            <Type className="h-3.5 w-3.5" />
            <h4 className="text-[11px] font-bold uppercase tracking-wider">
              Famille de police
            </h4>
          </div>
        </div>
        <div className="py-1 max-h-[280px] overflow-y-auto">
          {FONT_FAMILIES.map((f) => (
            <button
              key={f.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => apply(f)}
              className={cn(
                "w-full text-left px-3 py-1.5 text-[12px] hover:bg-blue-50 transition flex items-center justify-between gap-2",
                currentFamily.value === f.value && "bg-[#0F2D52]/10 text-[#0F2D52] font-semibold",
              )}
              style={f.cssStack ? { fontFamily: f.cssStack } : undefined}
            >
              <span className="truncate">{f.label}</span>
              {currentFamily.value === f.value && (
                <Check className="h-3 w-3 shrink-0 text-[#0F2D52]" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────
//   Dropdown : taille de police
// ─────────────────────────────────────────────────────────
const FONT_SIZES: Array<{ value: string; label: string }> = [
  { value: "", label: "Par défaut" },
  { value: "9pt", label: "9 pt" },
  { value: "10pt", label: "10 pt" },
  { value: "10.5pt", label: "10.5 pt" },
  { value: "11pt", label: "11 pt" },
  { value: "12pt", label: "12 pt" },
  { value: "14pt", label: "14 pt" },
  { value: "16pt", label: "16 pt" },
];

function FontSizeDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const currentValue =
    (editor.getAttributes("textStyle")?.fontSize as string | undefined) ?? "";
  const currentSize =
    FONT_SIZES.find((s) => s.value === currentValue) ?? FONT_SIZES[0];

  const apply = (s: (typeof FONT_SIZES)[number]) => {
    if (!s.value) {
      editor.chain().focus().unsetFontSize().run();
    } else {
      editor.chain().focus().setFontSize(s.value).run();
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          className="inline-flex items-center gap-1 h-8 px-2 rounded text-foreground/80 hover:bg-accent hover:text-foreground transition text-[11px] font-medium min-w-[68px]"
          title="Taille de police"
        >
          <span className="truncate">{currentSize.label}</span>
          <ChevronDown className="h-2.5 w-2.5 opacity-60 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[140px] p-0 overflow-hidden"
      >
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] text-white px-3 py-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider">
            Taille
          </h4>
        </div>
        <div className="py-1 max-h-[260px] overflow-y-auto">
          {FONT_SIZES.map((s) => (
            <button
              key={s.value || "default"}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => apply(s)}
              className={cn(
                "w-full text-left px-3 py-1.5 text-[12px] hover:bg-blue-50 transition flex items-center justify-between gap-2",
                currentSize.value === s.value && "bg-[#0F2D52]/10 text-[#0F2D52] font-semibold",
              )}
            >
              <span>{s.label}</span>
              {currentSize.value === s.value && (
                <Check className="h-3 w-3 shrink-0 text-[#0F2D52]" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────
//   Dropdowns : style de liste (puces / numerotation) facon Word
// ─────────────────────────────────────────────────────────
const BULLET_STYLE_OPTIONS: Array<{
  value: BulletStyle;
  label: string;
  preview: string;
}> = [
  { value: "disc", label: "Point plein", preview: "•" },
  { value: "circle", label: "Cercle", preview: "◦" },
  { value: "square", label: "Carré", preview: "▪" },
  { value: "dash", label: "Tiret", preview: "—" },
];

const ORDERED_STYLE_OPTIONS: Array<{
  value: OrderedStyle;
  label: string;
  preview: string;
}> = [
  { value: "decimal", label: "1, 2, 3", preview: "1." },
  { value: "lower-alpha", label: "a, b, c", preview: "a." },
  { value: "upper-alpha", label: "A, B, C", preview: "A." },
  { value: "lower-roman", label: "i, ii, iii", preview: "i." },
  { value: "upper-roman", label: "I, II, III", preview: "I." },
  { value: "multilevel", label: "1, 1.1, 1.1.1 (multi-niveau)", preview: "1.1" },
];

function BulletListDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const isActive = editor.isActive("bulletList");
  const currentStyle = (editor.getAttributes("bulletList")?.listStyle as
    | string
    | null) ?? "disc";

  const applyStyle = (style: BulletStyle) => {
    const chain = editor.chain().focus();
    if (!isActive) {
      chain.toggleBulletList().run();
      // Apres toggle, le node est cree : on applique le style.
      editor.chain().focus().setListStyle(style).run();
    } else {
      chain.setListStyle(style).run();
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "inline-flex items-center gap-0.5 h-8 px-1.5 rounded text-foreground/80 hover:bg-accent hover:text-foreground transition",
            isActive && "bg-[#0F2D52] text-white hover:bg-[#15406d] hover:text-white",
          )}
          title="Liste à puces (choix du style)"
          aria-label="Liste à puces"
        >
          <List className="h-3.5 w-3.5" />
          <ChevronDown className="h-2.5 w-2.5 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[200px] p-0 overflow-hidden"
      >
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] text-white px-3 py-2">
          <div className="flex items-center gap-2">
            <List className="h-3.5 w-3.5" />
            <h4 className="text-[11px] font-bold uppercase tracking-wider">
              Style de puces
            </h4>
          </div>
        </div>
        <div className="py-1">
          {BULLET_STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyStyle(opt.value)}
              className={cn(
                "w-full text-left px-3 py-1.5 text-[12px] hover:bg-blue-50 transition flex items-center gap-3",
                isActive && currentStyle === opt.value &&
                  "bg-[#0F2D52]/10 text-[#0F2D52] font-semibold",
              )}
            >
              <span className="inline-flex items-center justify-center w-5 h-5 text-base text-[#0F2D52] font-semibold">
                {opt.preview}
              </span>
              <span className="flex-1">{opt.label}</span>
              {isActive && currentStyle === opt.value && (
                <Check className="h-3 w-3 shrink-0 text-[#0F2D52]" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function OrderedListDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const isActive = editor.isActive("orderedList");
  const currentStyle = (editor.getAttributes("orderedList")?.listStyle as
    | string
    | null) ?? "decimal";

  const applyStyle = (style: OrderedStyle) => {
    const chain = editor.chain().focus();
    if (!isActive) {
      chain.toggleOrderedList().run();
      editor.chain().focus().setListStyle(style).run();
    } else {
      chain.setListStyle(style).run();
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "inline-flex items-center gap-0.5 h-8 px-1.5 rounded text-foreground/80 hover:bg-accent hover:text-foreground transition",
            isActive && "bg-[#0F2D52] text-white hover:bg-[#15406d] hover:text-white",
          )}
          title="Liste numérotée (choix du style)"
          aria-label="Liste numérotée"
        >
          <ListOrdered className="h-3.5 w-3.5" />
          <ChevronDown className="h-2.5 w-2.5 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[210px] p-0 overflow-hidden"
      >
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] text-white px-3 py-2">
          <div className="flex items-center gap-2">
            <ListOrdered className="h-3.5 w-3.5" />
            <h4 className="text-[11px] font-bold uppercase tracking-wider">
              Style de numérotation
            </h4>
          </div>
        </div>
        <div className="py-1">
          {ORDERED_STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyStyle(opt.value)}
              className={cn(
                "w-full text-left px-3 py-1.5 text-[12px] hover:bg-blue-50 transition flex items-center gap-3",
                isActive && currentStyle === opt.value &&
                  "bg-[#0F2D52]/10 text-[#0F2D52] font-semibold",
              )}
            >
              <span className="inline-flex items-center justify-center w-7 h-5 text-[11px] text-[#0F2D52] font-semibold tabular-nums">
                {opt.preview}
              </span>
              <span className="flex-1">{opt.label}</span>
              {isActive && currentStyle === opt.value && (
                <Check className="h-3 w-3 shrink-0 text-[#0F2D52]" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────
//   Popover : couleur du texte
// ─────────────────────────────────────────────────────────
function TextColorPopover({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const current =
    (editor.getAttributes("textStyle")?.color as string | undefined) ?? null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "inline-flex items-center justify-center h-8 min-w-8 px-2 rounded text-foreground/80 hover:bg-accent hover:text-foreground transition relative",
            current && "bg-[#0F2D52]/10"
          )}
          title="Couleur du texte"
          aria-label="Couleur du texte"
        >
          <Palette className="h-3.5 w-3.5" />
          <span
            className="absolute bottom-1 left-1.5 right-1.5 h-[3px] rounded-sm"
            style={{ background: current ?? "#0F2D52" }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[200px] p-0 overflow-hidden"
      >
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] text-white px-3 py-2">
          <div className="flex items-center gap-2">
            <Palette className="h-3.5 w-3.5" />
            <h4 className="text-[11px] font-bold uppercase tracking-wider">
              Couleur du texte
            </h4>
          </div>
        </div>
        <div className="p-2 grid grid-cols-4 gap-1.5">
          {TEXT_COLORS.map((c) => (
            <ActionTooltip key={c.value} label={c.label}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor.chain().focus().setColor(c.value).run();
                  setOpen(false);
                }}
                className={cn(
                  "h-7 w-7 rounded border border-border/60 hover:scale-110 transition",
                  current === c.value && "ring-2 ring-[#0F2D52] ring-offset-1"
                )}
                style={{ background: c.value }}
                aria-label={c.label}
              />
            </ActionTooltip>
          ))}
        </div>
        <div className="border-t px-2 py-1.5">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().unsetColor().run();
              setOpen(false);
            }}
            className="w-full text-left text-[11px] px-2 py-1 rounded hover:bg-muted/60 text-muted-foreground transition"
          >
            Réinitialiser la couleur
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────
//   Popover : surligneur
// ─────────────────────────────────────────────────────────
function HighlightColorPopover({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const current =
    (editor.getAttributes("highlight")?.color as string | undefined) ?? null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "inline-flex items-center justify-center h-8 min-w-8 px-2 rounded text-foreground/80 hover:bg-accent hover:text-foreground transition relative",
            editor.isActive("highlight") && "bg-[#0F2D52]/10"
          )}
          title="Surligneur"
          aria-label="Surligneur"
        >
          <Highlighter className="h-3.5 w-3.5" />
          <span
            className="absolute bottom-1 left-1.5 right-1.5 h-[3px] rounded-sm"
            style={{ background: current ?? "#fef3c7" }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[200px] p-0 overflow-hidden"
      >
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] text-white px-3 py-2">
          <div className="flex items-center gap-2">
            <Highlighter className="h-3.5 w-3.5" />
            <h4 className="text-[11px] font-bold uppercase tracking-wider">
              Surligneur
            </h4>
          </div>
        </div>
        <div className="p-2 grid grid-cols-5 gap-1.5">
          {HIGHLIGHT_COLORS.map((c) => (
            <ActionTooltip key={c.value} label={c.label}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor.chain().focus().setHighlight({ color: c.value }).run();
                  setOpen(false);
                }}
                className={cn(
                  "h-7 w-7 rounded border border-border/60 hover:scale-110 transition",
                  current === c.value && "ring-2 ring-[#0F2D52] ring-offset-1"
                )}
                style={{ background: c.value }}
                aria-label={c.label}
              />
            </ActionTooltip>
          ))}
        </div>
        <div className="border-t px-2 py-1.5">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().unsetHighlight().run();
              setOpen(false);
            }}
            className="w-full text-left text-[11px] px-2 py-1 rounded hover:bg-muted/60 text-muted-foreground transition"
          >
            Retirer le surligneur
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────
//   Popover : lien (input URL)
// ─────────────────────────────────────────────────────────
function LinkPopover({
  editor,
  open: openExt,
  onOpenChange,
}: {
  editor: Editor;
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
}) {
  const [openInt, setOpenInt] = useState(false);
  const open = openExt !== undefined ? openExt : openInt;
  const setOpen = (next: boolean) => {
    if (onOpenChange) onOpenChange(next);
    else setOpenInt(next);
  };
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (open) {
      const existing =
        (editor.getAttributes("link")?.href as string | undefined) ?? "";
      setUrl(existing || "https://");
    }
  }, [open, editor]);

  const apply = () => {
    const trimmed = url.trim();
    if (!trimmed || trimmed === "https://") {
      editor.chain().focus().unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: trimmed })
        .run();
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "inline-flex items-center justify-center h-8 min-w-8 px-2 rounded text-foreground/80 hover:bg-accent hover:text-foreground transition",
            editor.isActive("link") &&
              "bg-[#0F2D52] text-white hover:bg-[#15406d] hover:text-white"
          )}
          title="Insérer un lien"
          aria-label="Insérer un lien"
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[300px] p-0 overflow-hidden"
      >
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] text-white px-3 py-2">
          <div className="flex items-center gap-2">
            <Link2 className="h-3.5 w-3.5" />
            <h4 className="text-[11px] font-bold uppercase tracking-wider">
              Lien hypertexte
            </h4>
          </div>
        </div>
        <div className="p-3 space-y-2">
          <Input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              }
            }}
            placeholder="https://exemple.com"
            className="h-8 text-xs"
          />
          <div className="flex items-center justify-between gap-2">
            {editor.isActive("link") ? (
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().unsetLink().run();
                  setOpen(false);
                }}
                className="text-[11px] text-red-600 hover:text-red-800 font-medium transition"
              >
                Retirer le lien
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={apply}
              className="h-7 px-3 rounded bg-[#0F2D52] hover:bg-[#15406d] text-white text-[11px] font-semibold transition"
            >
              Appliquer
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────
//   Popover : insertion d'un tableau (dimensions au choix)
// ─────────────────────────────────────────────────────────
function TablePopover({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);

  const insert = (rows: number, cols: number) => {
    editor
      .chain()
      .focus()
      .insertTable({ rows, cols, withHeaderRow: true })
      .run();
    setOpen(false);
  };

  const inTable = editor.isActive("table");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          className="inline-flex items-center justify-center h-8 min-w-8 px-2 rounded text-foreground/80 hover:bg-accent hover:text-foreground transition"
          title="Insérer un tableau"
          aria-label="Insérer un tableau"
        >
          <TableIcon className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[260px] p-0 overflow-hidden"
      >
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] text-white px-3 py-2">
          <div className="flex items-center gap-2">
            <TableIcon className="h-3.5 w-3.5" />
            <h4 className="text-[11px] font-bold uppercase tracking-wider">
              Insérer un tableau
            </h4>
          </div>
        </div>
        <div className="p-2 grid grid-cols-2 gap-1">
          {[
            { r: 2, c: 2, label: "2 × 2" },
            { r: 3, c: 3, label: "3 × 3" },
            { r: 4, c: 4, label: "4 × 4" },
            { r: 3, c: 2, label: "3 × 2" },
            { r: 5, c: 3, label: "5 × 3" },
            { r: 2, c: 4, label: "2 × 4" },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => insert(opt.r, opt.c)}
              className="px-2 py-1.5 rounded hover:bg-blue-50 text-[11px] text-foreground font-medium border border-transparent hover:border-[#0F2D52]/30 transition"
            >
              {opt.label}
            </button>
          ))}
        </div>
        {inTable && (
          <>
            <div className="border-t px-3 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Actions sur le tableau
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1 p-2">
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().addRowAfter().run();
                  setOpen(false);
                }}
                className="px-2 py-1 rounded hover:bg-blue-50 text-[11px] text-foreground transition"
              >
                + Ligne
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().addColumnAfter().run();
                  setOpen(false);
                }}
                className="px-2 py-1 rounded hover:bg-blue-50 text-[11px] text-foreground transition"
              >
                + Colonne
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().deleteRow().run();
                  setOpen(false);
                }}
                className="px-2 py-1 rounded hover:bg-red-50 text-[11px] text-red-700 transition"
              >
                − Ligne
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().deleteColumn().run();
                  setOpen(false);
                }}
                className="px-2 py-1 rounded hover:bg-red-50 text-[11px] text-red-700 transition"
              >
                − Colonne
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().deleteTable().run();
                  setOpen(false);
                }}
                className="col-span-2 px-2 py-1 rounded hover:bg-red-50 text-[11px] text-red-700 font-medium transition"
              >
                Supprimer le tableau
              </button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────
//   Popover : insertion d'une SECTION TYPE (préambule / signatures / conformité)
// ─────────────────────────────────────────────────────────
const SECTION_TEMPLATES: Array<{
  key: string;
  label: string;
  description: string;
  markdown: string;
}> = [
  {
    key: "preamble",
    label: "Préambule contrat",
    description: "Bloc d'introduction standard (entre les parties, ET, conviennent)",
    markdown: `**Entre les parties soussignées :**

{{company.fullName}}, personne morale légalement constituée ayant son siège social au {{company.address}}, ci-après désignée « l'Employeur »,

ET

{{employee.fullName}}, domicilié(e) au {{employee.address}}, ci-après désigné(e) « l'Employé(e) ».

**Les parties conviennent de ce qui suit :**`,
  },
  {
    key: "signatures",
    label: "Bloc signatures",
    description: "Section finale avec boîtes signature employé + employeur",
    markdown: `## Signatures

{{signature.employee}}

{{signature.employer}}`,
  },
  {
    key: "compliance",
    label: "Section Conformité (QC)",
    description: "Références légales Code civil QC, LNT, LSST, Loi 25, Loi 96",
    markdown: `## Conformité légale

Le présent document est rédigé conformément aux lois en vigueur au Québec, notamment :

- **Code civil du Québec** (articles applicables au contrat de travail, art. 2085 et suivants)
- **Loi sur les normes du travail** (LNT, RLRQ c. N-1.1)
- **Loi sur la santé et la sécurité du travail** (LSST, RLRQ c. S-2.1)
- **Loi modernisant des dispositions législatives en matière de protection des renseignements personnels** (Loi 25)
- **Charte de la langue française** (Loi 96, RLRQ c. C-11)`,
  },
  {
    key: "section",
    label: "Section numérotée",
    description: "Squelette « ## X. Titre » avec paragraphe vide à compléter",
    markdown: `## X. Titre de section

Contenu à compléter.`,
  },
  {
    key: "table",
    label: "Tableau (3 colonnes)",
    description: "Tableau markdown 3 colonnes prêt à éditer dans la source",
    markdown: `| Colonne 1 | Colonne 2 | Colonne 3 |
|-----------|-----------|-----------|
| Cellule A | Cellule B | Cellule C |
| Cellule D | Cellule E | Cellule F |`,
  },
];

function SectionInsertPopover({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);

  const insert = (md: string) => {
    // Parse le markdown en blocs ProseMirror puis insere au curseur.
    const doc = parseMarkdownToDoc(md);
    const content = (doc.content ?? []) as unknown as Parameters<
      ReturnType<Editor["chain"]>["insertContent"]
    >[0];
    editor.chain().focus().insertContent(content).run();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          className="inline-flex items-center gap-1 rounded h-7 px-2 text-foreground/80 hover:bg-[#0F2D52]/10 hover:text-[#0F2D52] transition text-[11px] font-medium"
          title="Inserer une section type"
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
          Section
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[300px] p-0 overflow-hidden"
      >
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] text-white px-3 py-2.5">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="h-3.5 w-3.5" />
            <h4 className="text-[11px] font-bold uppercase tracking-wider">
              Inserer une section
            </h4>
          </div>
        </div>
        <div className="py-1 max-h-[60vh] overflow-y-auto">
          {SECTION_TEMPLATES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => insert(s.markdown)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 transition border-b last:border-b-0"
            >
              <p className="text-[12px] font-semibold text-foreground">
                {s.label}
              </p>
              <p className="text-[10px] text-muted-foreground italic mt-0.5">
                {s.description}
              </p>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────
//   Popover : sélection d'une variable à insérer
// ─────────────────────────────────────────────────────────
function VariableInsertPopover({
  onPick,
}: {
  onPick: (def: VariableDef) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Accordion : un SEUL groupe ouvert a la fois (null = tous fermes par defaut).
  const [openSource, setOpenSource] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return VARIABLE_REGISTRY;
    return VARIABLE_REGISTRY.filter(
      (v) =>
        v.key.toLowerCase().includes(q) ||
        v.label.toLowerCase().includes(q) ||
        v.example.toLowerCase().includes(q)
    );
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<VariableSource, VariableDef[]>();
    for (const v of filtered) {
      const arr = map.get(v.source) ?? [];
      arr.push(v);
      map.set(v.source, arr);
    }
    return map;
  }, [filtered]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          className="inline-flex items-center gap-1 rounded h-7 px-2 ml-auto bg-[#0F2D52] hover:bg-[#1a3a66] text-white text-[11px] font-medium transition"
          title="Inserer un champ dynamique"
        >
          <Plus className="h-3 w-3" />
          Inserer un champ
          <Sparkles className="h-3 w-3 opacity-80" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[320px] p-0 overflow-hidden"
      >
        {/* Header navy */}
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] text-white px-3 py-2.5 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            <h4 className="text-[11px] font-bold uppercase tracking-wider">
              Inserer un champ
            </h4>
          </div>
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="pl-8 h-7 text-xs bg-white/10 text-white border-white/20 placeholder:text-white/50 focus-visible:ring-white/40"
            />
          </div>
        </div>

        {/* Sections — scroll robuste meme dans Dialog/Sheet parent :
            - hauteur explicite (max-height inline)
            - overscroll-behavior: contain (empeche le scroll de remonter au Dialog)
            - onWheel stopPropagation (Chrome Windows bug : wheel events propages au parent locke)
            - tabIndex pour focus clavier (PageDown/PageUp scroll) */}
        <div
          className="overflow-y-auto divide-y"
          tabIndex={0}
          style={{
            maxHeight: "min(55vh, 380px)",
            overscrollBehavior: "contain",
          }}
          onWheel={(e) => {
            // Empeche le wheel de propager au Dialog parent qui pourrait avoir
            // scroll-lock (Radix Dialog locke le body scroll quand ouvert).
            e.stopPropagation();
          }}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {VARIABLE_SOURCES.map((section) => {
            const items = grouped.get(section.source) ?? [];
            if (items.length === 0 && query.trim()) return null;
            const Icon = SOURCE_ICONS[section.source];
            // Si recherche active : tous les groupes auto-ouverts pour voir matches.
            // Sinon : accordion (un seul ouvert).
            const isOpen = query.trim()
              ? true
              : openSource === section.source;
            return (
              <div key={section.source} className="bg-card">
                <button
                  type="button"
                  onClick={() =>
                    // Accordion : clic ouvre ce groupe et ferme les autres
                    // (toggle si meme groupe deja ouvert).
                    setOpenSource((cur) =>
                      cur === section.source ? null : section.source,
                    )
                  }
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/40 transition text-left"
                >
                  {isOpen ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  )}
                  <Icon className="h-3.5 w-3.5 text-[#0F2D52]" />
                  <span className="text-[11px] font-semibold text-foreground flex-1">
                    {section.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {items.length}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-1.5 pb-1.5 space-y-0.5">
                    {items.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => {
                          onPick(v);
                          setOpen(false);
                          setQuery("");
                        }}
                        className="w-full text-left rounded px-2 py-1 hover:bg-blue-50 focus:bg-blue-100 focus:outline-none transition"
                      >
                        <span className="text-[12px] font-semibold text-foreground block truncate">
                          {v.label}
                        </span>
                        {v.example && (
                          <span className="text-[10px] text-muted-foreground italic block truncate">
                            ex : {v.example}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {Array.from(grouped.values()).every((arr) => arr.length === 0) && (
            <div className="px-3 py-6 text-center">
              <Search className="h-5 w-5 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-[11px] text-muted-foreground">
                Aucun champ ne correspond a votre recherche.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-1.5 border-t bg-muted/20 shrink-0">
          <p className="text-[10px] text-muted-foreground leading-snug">
            Le champ sera rempli automatiquement avec les vraies donnees.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────
//   Popover : action menu sur clic d'une pill existante
// ─────────────────────────────────────────────────────────
function PillActionMenu({
  x,
  y,
  currentKey,
  currentLabel,
  onReplace,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  currentKey: string;
  currentLabel: string;
  onReplace: (def: VariableDef) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [showReplace, setShowReplace] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return VARIABLE_REGISTRY;
    return VARIABLE_REGISTRY.filter(
      (v) =>
        v.key.toLowerCase().includes(q) ||
        v.label.toLowerCase().includes(q)
    );
  }, [query]);

  const isKnown = !!findVariable(currentKey);

  return (
    <div
      data-pill-menu
      className="absolute z-30 w-[260px] rounded-md border border-input bg-popover shadow-lg overflow-hidden"
      style={{
        left: Math.max(8, x - 130),
        top: y,
      }}
    >
      {/* Header navy */}
      <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] text-white px-3 py-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-white/70 font-semibold">
            {isKnown ? "Champ dynamique" : "Champ inconnu"}
          </p>
          <p className="text-xs font-semibold truncate">{currentLabel}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-white/80 hover:text-white transition"
          aria-label="Fermer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!showReplace ? (
        <div className="py-1">
          <button
            type="button"
            onClick={() => setShowReplace(true)}
            className="w-full text-left px-3 py-2 hover:bg-muted/40 text-xs font-medium text-foreground flex items-center gap-2"
          >
            <Plus className="h-3.5 w-3.5 text-[#0F2D52]" />
            Remplacer par un autre champ…
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="w-full text-left px-3 py-2 hover:bg-red-50 text-xs font-medium text-red-700 flex items-center gap-2"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer ce champ
          </button>
        </div>
      ) : (
        <div className="flex flex-col max-h-[280px]">
          <div className="px-2 py-1.5 border-b">
            <div className="relative">
              <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher…"
                className="pl-7 h-7 text-xs"
              />
            </div>
          </div>
          <div className="overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-[11px] text-muted-foreground italic text-center">
                Aucun resultat.
              </p>
            ) : (
              filtered.slice(0, 30).map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => onReplace(v)}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-50 transition"
                >
                  <span className="text-[12px] font-semibold text-foreground block truncate">
                    {v.label}
                  </span>
                  {v.example && (
                    <span className="text-[10px] text-muted-foreground italic block truncate">
                      ex : {v.example}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
