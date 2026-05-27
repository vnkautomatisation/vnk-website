// ─────────────────────────────────────────────────────────────────
// preview-helpers.ts — Utilitaires de formatage des apercus de
// templates pour les cartes / listings administrateurs.
//
// Objectif : ne jamais afficher de variables Mustache `{{...}}` en
// clair dans l'UI. On les remplace par leur libelle FR depuis le
// registry de variables, ou par une etiquette generique si inconnue.
//
// On supprime aussi les marqueurs markdown bruts (titres `##`, gras
// `**`, italique `*`, listes `-`, citations `>`, etc.) qui ne sont
// pas humainement lisibles dans un apercu d'une ou deux lignes.
// ─────────────────────────────────────────────────────────────────
import { findVariable } from "./variable-registry";

/**
 * Convertit un markdown brut (qui contient potentiellement des
 * variables `{{employee.fullName}}`) en un texte d'apercu propre,
 * compact et lisible, tronque a `maxChars` caracteres.
 *
 * Etapes :
 *   1. Resout les variables `{{key}}` -> `[Label FR]` (ou `[Champ : key]`
 *      si la variable n'est pas connue du registry).
 *   2. Strip des helpers Mustache (`{{#if}}`, `{{/if}}`, etc.).
 *   3. Strip des marqueurs markdown : `#`, `*`, `_`, `>`, ``` ` ```, `~`, `-`
 *      en debut de ligne ; supprime aussi `[text](url)` -> `text`.
 *   4. Strip des ancres de signatures `[Signature ...]`.
 *   5. Strip des commentaires HTML / sauts de page.
 *   6. Normalise les espaces et tronque proprement (sans couper un mot).
 */
export function formatPreviewMarkdown(
  md: string | null | undefined,
  maxChars: number = 220,
): string {
  if (!md) return "";

  let s = String(md);

  // 1. Supprime les helpers Mustache (blocs conditionnels) : on ne
  //    veut pas voir `{{#if contract.startDate}}` dans un apercu.
  s = s.replace(/\{\{\s*[#/](?:if|unless|each|with)[^}]*\}\}/gi, "");
  s = s.replace(/\{\{\s*else\s*\}\}/gi, "");

  // 2. Remplace les variables connues par leur label FR, les inconnues
  //    par un libelle generique. JAMAIS de `{{...}}` en clair.
  s = s.replace(
    /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.\-]*)\s*\}\}/g,
    (_match, rawKey: string) => {
      const key = rawKey.trim();
      const def = findVariable(key);
      if (def) return `[${def.label}]`;
      // Variable inconnue : tente d'extraire un libelle lisible du
      // dernier segment (ex: `company.foobar` -> `foobar`).
      const tail = key.split(".").pop() ?? key;
      const pretty = tail
        .replace(/([A-Z])/g, " $1")
        .replace(/^\s+/, "")
        .toLowerCase();
      return `[${pretty.charAt(0).toUpperCase() + pretty.slice(1)}]`;
    },
  );

  // 3. Strip ancres de signatures (cas `[Signature employe]` / employeur).
  s = s.replace(/\[Signature\s+[^\]]*\]/gi, "");

  // 4. Strip commentaires HTML et sauts de page markdown.
  s = s.replace(/<!--[\s\S]*?-->/g, "");

  // 5. Strip marqueurs markdown :
  //    - liens : `[text](url)` -> `text`
  //    - titres : `## Titre` -> `Titre`
  //    - gras / italique / code : `**x**` / `*x*` / `_x_` / `` `x` ``
  //    - blockquote / liste / hr : preserver le texte uniquement
  //    - tables : pipe `|` -> espace
  s = s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // liens
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // titres ATX
    .replace(/\*\*([^*]+)\*\*/g, "$1") // gras
    .replace(/__([^_]+)__/g, "$1") // gras alt
    .replace(/\*([^*\n]+)\*/g, "$1") // italique
    .replace(/_([^_\n]+)_/g, "$1") // italique alt
    .replace(/`([^`]+)`/g, "$1") // code inline
    .replace(/^\s{0,3}>\s?/gm, "") // blockquote
    .replace(/^\s{0,3}[-*+]\s+/gm, "") // listes
    .replace(/^\s{0,3}\d+\.\s+/gm, "") // listes numerotees
    .replace(/^\s{0,3}-{3,}\s*$/gm, "") // separateurs
    .replace(/\|/g, " "); // pipes de tableaux

  // 6. Normalise les espaces et retours a la ligne.
  s = s.replace(/\s+/g, " ").trim();

  // 7. Troncature propre : on coupe au dernier mot complet avant la
  //    limite, et on ajoute une ellipse si on a coupe.
  if (s.length <= maxChars) return s;
  const truncated = s.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(" ");
  const cut = lastSpace > maxChars * 0.6 ? truncated.slice(0, lastSpace) : truncated;
  return cut.replace(/[\s.,;:!?-]+$/, "") + "…";
}
