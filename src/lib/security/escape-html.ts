// ─────────────────────────────────────────────────────────
// Helper pour échapper les caractères HTML dans le contenu
// utilisateur injecté dans les templates emails.
// Empêche XSS via nom, email, etc. dans le HTML.
// Pure utilité — utilisable en tests + côté serveur.
// ─────────────────────────────────────────────────────────

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
};

export function escapeHtml(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value).replace(/[&<>"'/]/g, (ch) => HTML_ESCAPES[ch]);
}

// Pour URLs : on autorise certains caractères mais on bloque les protocoles dangereux
export function escapeUrlForEmail(url: string | null | undefined): string {
  if (!url) return "";
  const clean = String(url).trim();
  // Bloque javascript:, data:, file:, vbscript:
  if (/^(javascript|data|file|vbscript):/i.test(clean)) return "";
  return escapeHtml(clean);
}
