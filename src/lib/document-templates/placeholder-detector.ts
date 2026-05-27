// ─────────────────────────────────────────────────────────
// placeholder-detector.ts — Detection des champs `[CHAMP]` du
// markdown qui ne sont PAS des variables `{{var}}` auto-resolvables.
//
// Cible le pattern d'ecriture humaine ("manuel a remplir") qu'on
// trouve dans les seed templates VNK :
//
//   [DATE]                             → champ libre
//   [SUJET INITIAL]                    → champ libre
//   [Fait 1 — date, description...]    → champ libre
//   [À COMPLÉTER]                      → champ libre
//   [Numéro de membre]                 → champ libre
//
// On EXCLUT :
//   - `[Signature ...]`                 (ancres signature gerees ailleurs)
//   - `[ ]` / `[x]` / `[X]`             (checkboxes markdown)
//   - `[lien](url)`                     (liens markdown)
//   - `{{var}}`                         (variables auto-resolues)
//
// Le code est neutre serveur/client (zero side-effect) — utilisable
// dans le RSC du wizard, l'action createSignatureRequestAction, et
// la fonction de resolution au moment de la signature.
// ─────────────────────────────────────────────────────────

/** Pattern strict capture : `[A-Z ou accent] + 2-80 chars sans crochet`. */
const PLACEHOLDER_RE = /\[([A-ZÀ-Ÿ][^\]]{2,80})\]/g;

/** Detecte un `[texte](url)` markdown — on ne veut PAS matcher ces liens. */
const MD_LINK_RE = /\]\s*\(/;

/** Une checkbox `[ ]` / `[x]` / `[X]` (longueur 1, espace ou x). */
const CHECKBOX_RE = /^[ xX]$/;

/** Une ancre signature `[Signature ...]`. */
const SIGNATURE_RE = /^Signature\s+/i;

/**
 * Detecte tous les placeholders `[CHAMP]` uniques dans le markdown.
 * Retourne la liste des keys dans l'ordre d'apparition, dedoublonnees.
 *
 * Ex.: `"Bonjour, [DATE]. Sujet : [SUJET INITIAL]. Aussi [DATE]."`
 *   → ["DATE", "SUJET INITIAL"]
 */
export function detectPlaceholders(markdown: string): string[] {
  if (!markdown) return [];
  const seen = new Set<string>();
  const out: string[] = [];

  const text = String(markdown);
  let m: RegExpExecArray | null;
  const re = new RegExp(PLACEHOLDER_RE.source, "g");

  while ((m = re.exec(text)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    // Exclut les ancres signature
    if (SIGNATURE_RE.test(raw)) continue;
    // Exclut les checkboxes
    if (CHECKBOX_RE.test(raw)) continue;
    // Exclut les liens markdown `[text](url)` : on regarde ce qui suit le `]`
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 2);
    if (MD_LINK_RE.test(`]${after}`)) continue;

    if (seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }

  return out;
}

/**
 * Substitue chaque `[KEY]` du markdown par sa valeur correspondante.
 * Si une clef n'a pas de valeur fournie, on laisse l'ancre intacte
 * (le RH n'a pas rempli ce champ — il sera mis en evidence dans le PDF).
 *
 * Les exclusions sont les memes que `detectPlaceholders` (signatures,
 * checkboxes, liens markdown ne sont JAMAIS substitues).
 */
export function applyPlaceholderValues(
  markdown: string,
  values: Record<string, string> | null | undefined,
): string {
  if (!markdown) return markdown ?? "";
  if (!values || Object.keys(values).length === 0) return markdown;

  return markdown.replace(PLACEHOLDER_RE, (match, raw: string, offset: number) => {
    const key = raw.trim();
    if (!key) return match;
    if (SIGNATURE_RE.test(key)) return match;
    if (CHECKBOX_RE.test(key)) return match;
    // Lien markdown : on regarde ce qui suit l'ancre
    const after = markdown.slice(offset + match.length, offset + match.length + 2);
    if (MD_LINK_RE.test(`]${after}`)) return match;

    const v = values[key];
    if (v === undefined || v === null) return match;
    const s = String(v);
    if (!s) return match;
    return s;
  });
}
