"use client";
// Renderer markdown minimaliste sans dépendance externe.
// Couvre les besoins du portail : titres, paragraphes, listes, gras/italique, liens, code inline.
// Pour des besoins plus avancés, remplacer par react-markdown ou marked.
import { useMemo } from "react";

export function MarkdownView({ children, className = "" }: { children: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(children), [children]);
  return (
    <div
      className={`prose prose-sm max-w-none text-sm leading-relaxed [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-0.5 [&_p]:my-2 [&_strong]:font-semibold [&_a]:text-[#0F2D52] [&_a]:underline [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.85em] ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderMarkdown(md: string): string {
  if (!md) return "";
  // 1. Échapper d'abord
  let s = escapeHtml(md);

  // 2. Headings (avant inline pour ne pas matcher ## dans des paragraphes)
  s = s.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  s = s.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  s = s.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // 3. Code inline
  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  // 4. Bold / Italic
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  s = s.replace(/_([^_\n]+)_/g, "<em>$1</em>");

  // 5. Links [texte](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, url: string) => {
    // Sanitize URL : interdire javascript:, data:
    if (/^(javascript|data|vbscript):/i.test(url.trim())) return label;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  // 6. Listes : on regroupe les lignes consécutives commençant par "- " ou "* " ou "1. "
  const lines = s.split("\n");
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  let buffer: string[] = [];

  const flushParagraph = () => {
    if (buffer.length > 0) {
      const para = buffer.join(" ").trim();
      if (para) out.push(`<p>${para}</p>`);
      buffer = [];
    }
  };
  const closeLists = () => {
    if (inUl) { out.push("</ul>"); inUl = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    // Ligne vide → flush
    if (!trimmed) { flushParagraph(); closeLists(); continue; }
    // Déjà transformé en heading
    if (/^<h[1-3]>/.test(trimmed)) { flushParagraph(); closeLists(); out.push(trimmed); continue; }
    // Liste non ordonnée
    if (/^[-*] /.test(trimmed)) {
      flushParagraph();
      if (inOl) { out.push("</ol>"); inOl = false; }
      if (!inUl) { out.push("<ul>"); inUl = true; }
      out.push(`<li>${trimmed.replace(/^[-*] /, "")}</li>`);
      continue;
    }
    // Liste ordonnée
    if (/^\d+\. /.test(trimmed)) {
      flushParagraph();
      if (inUl) { out.push("</ul>"); inUl = false; }
      if (!inOl) { out.push("<ol>"); inOl = true; }
      out.push(`<li>${trimmed.replace(/^\d+\. /, "")}</li>`);
      continue;
    }
    // Paragraphe ordinaire
    closeLists();
    buffer.push(trimmed);
  }
  flushParagraph();
  closeLists();

  return out.join("\n");
}
