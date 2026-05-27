// ─────────────────────────────────────────────────────────
// pdf-html-renderer.ts — Pipeline HTML -> PDF pour les templates VNK
// (contrat, politique, document legal, lettre, onboarding).
//
// Pipeline strict (ordre critique) :
//   1. Markdown brut + context
//   2. renderTemplate()           -> resout {{#if}}, {{#unless}}, {{var}}
//   3. Strip backticks            -> nettoyage seed legacy
//   4. preprocessSignatures()     -> detecte [Signature ...] avant variables
//   5. preprocessPlaceholders()   -> {{...}} restants -> spans surlignes
//   6. wrapResolvedVariables()    -> chaque valeur du contexte en gras navy
//   7. marked.parse()             -> markdown -> HTML (preserve HTML inline)
//   8. buildHtmlDocument()        -> layout complet (Inter, header navy, CSS)
//   9. Puppeteer page.pdf()       -> HTML -> PDF buffer
//
// Robustesse :
//   - Si Chromium est indisponible (dev Windows sans Chrome, prod sans
//     @sparticuz/chromium fonctionnel), fallback automatique vers PDFKit.
//   - Browser singleton : Chromium chaud entre les requetes.
//   - Detection auto local vs prod : @sparticuz/chromium pour Railway,
//     Chrome local pour dev (Windows / macOS / Linux).
// ─────────────────────────────────────────────────────────
import "server-only";
import { marked, type Tokens, type Token } from "marked";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  renderTemplate,
  findVariable,
  type TemplateContext,
} from "@/lib/document-templates";
import { applyPlaceholderValues } from "@/lib/document-templates/placeholder-detector";
import {
  renderTemplateToPdf as renderViaPdfKit,
  type TemplateDocumentType,
} from "@/lib/services/pdf-template-renderer";

// Re-export type pour compat
export type { TemplateDocumentType } from "@/lib/services/pdf-template-renderer";

// ─────────────────────────────────────────────────────────
// Types publics
// ─────────────────────────────────────────────────────────
export type NumberingMode = "auto" | "none";

/**
 * Determine quels blocs Signature sont rendus dans le PDF / la preview.
 *  - "employee_only" : seul `[Signature employe]` est rendu.
 *  - "employer_only" : seul `[Signature employeur]` est rendu.
 *  - "both"          : les deux ancres sont rendues (defaut historique).
 *  - "none"          : aucune signature, toutes les ancres sont supprimees.
 */
export type SignatureScope = "employee_only" | "employer_only" | "both" | "none";

/**
 * Signature embarquee dans le PDF final (post-signature employe).
 * `dataUrl` = data URI base64 PNG de la signature manuscrite.
 */
export interface EmbeddedSignature {
  dataUrl: string;
  name?: string;
  date?: Date | string;
}

export interface HtmlPdfOptions {
  /** Markdown brut (peut contenir {{variables}} et blocs Mustache). */
  bodyMarkdown: string;
  /** Contexte resolvant les variables. */
  context: TemplateContext;
  /** Titre du document (header + filename). */
  title: string;
  /** Type de document (badge + note de pied + couleurs). */
  documentType: TemplateDocumentType;
  /** Metadonnees optionnelles. */
  metadata?: {
    version?: string;
    employeeName?: string;
    companyName?: string;
    documentNumber?: string;
  };
  /**
   * Mode de numerotation hierarchique des titres :
   *  - "auto" (defaut) : H2 = "1.", H3 = "1.1" via CSS counters.
   *  - "none" : aucune numerotation automatique (le user peut taper
   *    ses propres numeros dans les titres si souhaite).
   */
  numbering?: NumberingMode;
  /**
   * Signatures a embarquer dans le PDF final (post-signature employe).
   * Si fourni, les ancres `[Signature employe]` / `[Signature employeur]`
   * sont remplacees par le bloc image + nom + date au lieu de la ligne vide.
   */
  signatures?: {
    employee?: EmbeddedSignature;
    employer?: EmbeddedSignature;
  };
  /**
   * Etats des cases obligatoires au moment de la signature.
   * Cle = index de la checkbox (ordre d'apparition dans le markdown).
   * Les checkboxes a `true` seront pre-cochees dans le PDF final.
   */
  checkboxStates?: Record<string, boolean>;
  /**
   * Filtre les ancres `[Signature ...]` rendues dans le PDF.
   * - "employee_only" : ne rend QUE les ancres employe (supprime employeur).
   * - "employer_only" : ne rend QUE les ancres employeur (supprime employe).
   * - "both"          : laisse les deux (defaut historique).
   * - "none"          : supprime tous les blocs signature.
   */
  signatureScope?: SignatureScope;
}

// ─────────────────────────────────────────────────────────
// Constantes de marque
// ─────────────────────────────────────────────────────────
const COMPANY = {
  shortName: "Automatisation Inc.",
  fullName: "VNK Automatisation Inc.",
  tagline: "VALUE · NETWORK · KNOWLEDGE",
  email: "vnkautomatisation@gmail.com",
  phone: "(819) 290-8686",
  address: "Mauricie, Quebec, Canada",
};

const DOC_TYPE_BADGE: Record<TemplateDocumentType, string> = {
  legal: "Document legal",
  contract: "Contrat",
  policy: "Politique",
  letter: "Lettre",
  onboarding: "Accueil",
};

const DOC_TYPE_NOTE: Record<TemplateDocumentType, string> = {
  legal:
    "Document confidentiel. Lecture et signature reservees aux parties concernees.",
  contract:
    "Document confidentiel - reserve aux parties signataires. Regi par les lois du Quebec et du Canada.",
  policy:
    "Politique interne. Consultez votre representant RH pour toute clarification.",
  letter:
    "Pour toute verification, contactez-nous a vnkautomatisation@gmail.com.",
  onboarding: "Document d'accueil. Conservez une copie pour vos dossiers.",
};

// ─────────────────────────────────────────────────────────
// Utilitaires
// ─────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const UNRESOLVED_VAR_REGEX = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.\-]*)\s*\}\}/g;
const RESERVED_VAR_KEYWORDS = new Set<string>([
  "else",
  "#if",
  "/if",
  "#unless",
  "/unless",
]);

// ─────────────────────────────────────────────────────────
// ETAPE 4 — Signatures (detectee AVANT le wrap des variables)
// ─────────────────────────────────────────────────────────

/**
 * Detecte le preambule "Entre les parties soussignees" (et variantes) et
 * encapsule le paragraphe d'introduction dans un bloc HTML `<div class="preamble">`
 * pour beneficier du style encadre VNK (fond gris pale, barre navy a gauche).
 *
 * Detecte le pattern :
 *   **Entre les parties soussignées :**
 *
 *   [paragraphe avec {{company}} ... {{employee}}...]
 *
 *   **Les parties conviennent de ce qui suit :**   <- optionnel
 *
 * Et le remplace par un bloc `<div class="preamble">...</div>` HTML qui
 * sera respecte par `marked` (qui ne touche pas au HTML block-level).
 *
 * Si le pattern n'est pas trouve, le markdown reste inchange.
 */
function preprocessPreamble(md: string): string {
  if (!md) return md;
  // Pattern : "**Entre les parties...**" suivi (apres blank line) d'un ou
  // plusieurs paragraphes, optionnellement termine par "**Les parties
  // conviennent...**" ou par la prochaine section markdown (## titre).
  //
  // Le lookahead s'arrete a :
  //   - une ligne blanche puis un heading markdown (## ou #)
  //   - un separateur horizontal (---)
  //   - la fin du string (?![\s\S])
  const re =
    /\*\*Entre les parties soussign[ée]es?\s*:?\*\*\s*\n+([\s\S]+?)(?=\n\s*\n\s*(?:##?\s+|---)|\n*$)/i;

  return md.replace(re, (match, body: string) => {
    // body est l'ensemble du contenu entre "Entre les parties..." et la
    // prochaine section/heading. On le decoupe en paragraphes.
    const paragraphs = body
      .trim()
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (paragraphs.length === 0) return match;

    // Renvoie un bloc HTML qui sera laisse intact par marked.
    // On utilise une div container : marked parse les paragraphes a
    // l'interieur grace au support inline (HTML pass-through marked v14).
    const headerLine = `<p><strong>Entre les parties soussignées :</strong></p>`;
    const bodyHtml = paragraphs
      .map((p) => `<p>${p.replace(/\n/g, " ")}</p>`)
      .join("\n");
    return `\n\n<div class="preamble">\n${headerLine}\n${bodyHtml}\n</div>\n\n`;
  });
}

/**
 * Detecte les ancres `[Signature employe]` / `[Signature employeur]`
 * (avec ou sans accent) et regroupe les consecutives en un bloc HTML
 * `<div class="signatures">` cote a cote.
 *
 * Si le markdown contient un titre `## Signatures` immediatement avant
 * les ancres, il est supprime pour eviter le doublon (le bloc HTML
 * genere injecte son propre titre via `<h2 class="signatures-title">`).
 */
function preprocessSignatures(
  md: string,
  signatures?: HtmlPdfOptions["signatures"],
  scope: SignatureScope = "both",
): string {
  if (!md) return md;

  // Pattern : capture 1-2 ancres consecutives (employe et/ou employeur),
  // separees uniquement par du whitespace (espaces, newlines).
  const anchorPattern =
    /(?:\[Signature\s+(?:employ[ée]e?|employer?|employeur)\][^\n]*\n?\s*){1,3}/gi;

  // Si scope = "none", on supprime simplement TOUTES les ancres (et les titres
  // `## Signatures` orphelins seront strippes en aval).
  if (scope === "none") {
    return md.replace(anchorPattern, "");
  }

  return md.replace(anchorPattern, (block: string) => {
    const blockHasEmployee = /\[Signature\s+employ[ée]e?\]/i.test(block);
    const blockHasEmployer = /\[Signature\s+(?:employer|employeur)\]/i.test(block);

    // Filtre selon le scope : on "force" la presence ou l'absence des roles.
    const includeEmployee =
      (scope === "employee_only" || scope === "both") && blockHasEmployee;
    const includeEmployer =
      (scope === "employer_only" || scope === "both") && blockHasEmployer;

    if (!includeEmployee && !includeEmployer) return "";

    type RoleKey = "employee" | "employer";
    const roles: Array<{ key: RoleKey; label: string }> = [];
    if (includeEmployee) roles.push({ key: "employee", label: "Employe" });
    if (includeEmployer) roles.push({ key: "employer", label: "Employeur" });

    const cols = roles
      .map(({ key, label }) => {
        const sig = signatures?.[key];
        // Bloc enrichi : signature manuscrite + nom + date pre-remplis
        if (sig?.dataUrl) {
          const name = (sig.name ?? "").trim();
          const dateObj = sig.date instanceof Date
            ? sig.date
            : (sig.date ? new Date(sig.date) : new Date());
          const iso = Number.isFinite(dateObj.getTime())
            ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`
            : "";
          return `<div class="signature-block signed">
  <div class="role-badge">${escapeHtml(label).toUpperCase()}</div>
  <div class="signature-area">
    <div class="sig-image-wrap">
      <img class="sig-image" src="${escapeHtml(sig.dataUrl)}" alt="Signature ${escapeHtml(label)}" />
    </div>
    <div class="label">Signature manuscrite</div>
    <div class="sig-row">
      <div class="sig-cell">
        <div class="sig-value">${escapeHtml(name)}</div>
        <div class="label">Nom en lettres moulees</div>
      </div>
      <div class="sig-cell">
        <div class="sig-value">${escapeHtml(iso)}</div>
        <div class="label">Date (AAAA-MM-JJ)</div>
      </div>
    </div>
  </div>
</div>`;
        }

        // Bloc vide (placeholder a remplir a la main / a signer plus tard)
        return `<div class="signature-block">
  <div class="role-badge">${escapeHtml(label).toUpperCase()}</div>
  <div class="signature-area">
    <div class="sig-line"></div>
    <div class="label">Signature</div>
    <div class="sig-row">
      <div class="sig-cell">
        <div class="sig-line-short"></div>
        <div class="label">Nom en lettres moulees</div>
      </div>
      <div class="sig-cell">
        <div class="sig-line-short"></div>
        <div class="label">Date (AAAA-MM-JJ)</div>
      </div>
    </div>
  </div>
</div>`;
      })
      .join("");

    return `\n\n<h2 class="signatures-title">Signatures</h2>\n<div class="signatures">${cols}</div>\n\n`;
  });
}

/**
 * Pre-coche les `- [ ]` du markdown en fonction de `checkboxStates`.
 * Cle = index 0-based dans l'ordre d'apparition. Toute checkbox dont
 * l'index est marquee `true` devient `- [x]` avant le rendu marked.
 */
function applyCheckboxStates(
  md: string,
  states?: Record<string, boolean>,
): string {
  if (!md || !states) return md;
  let idx = 0;
  return md.replace(/^([ \t]*[-*+]\s+)\[ \]/gm, (match, prefix: string) => {
    const checked = states[String(idx)] === true;
    idx++;
    return checked ? `${prefix}[x]` : match;
  });
}

/**
 * Supprime un titre `## Signatures` (ou `# Signatures`) qui precede
 * immediatement le bloc HTML genere, pour eviter le doublon visuel.
 */
function stripDuplicateSignatureHeading(md: string): string {
  return md.replace(
    /^#{1,3}\s+Signatures?\s*$\n+(?=<h2 class="signatures-title">)/gim,
    "",
  );
}

// ─────────────────────────────────────────────────────────
// ETAPE 5 — Placeholders non resolus
// ─────────────────────────────────────────────────────────

/**
 * Remplace les `{{key}}` RESTANTS (non resolus par renderTemplate) par
 * un span stylise : jaune si la variable est connue du registry,
 * rouge si totalement inconnue.
 */
function preprocessPlaceholders(md: string): string {
  if (!md) return md;
  return md.replace(UNRESOLVED_VAR_REGEX, (match, rawKey: string) => {
    const key = rawKey.trim();
    if (RESERVED_VAR_KEYWORDS.has(key)) return match;
    const def = findVariable(key);
    if (def) {
      return `<span class="ph-known">[A completer : ${escapeHtml(def.label)}]</span>`;
    }
    return `<span class="ph-unknown">[VARIABLE INCONNUE : ${escapeHtml(key)}]</span>`;
  });
}

// ─────────────────────────────────────────────────────────
// ETAPE 6 — Wrap des variables resolues
// ─────────────────────────────────────────────────────────

/**
 * Entoure chaque valeur du contexte d'un `<span class="var-resolved">`
 * pour la mettre en gras navy dans le PDF final.
 *
 * Regles :
 *  - Exclut les keys `signature.*` (deja transformees en HTML a l'etape 4).
 *  - Exclut les valeurs vides ou trop courtes (< 3 chars) pour eviter les
 *    faux positifs (ex: chiffres seuls qui matcheraient partout).
 *  - Trie par longueur DESC : matche d'abord les valeurs longues pour eviter
 *    qu'une valeur courte n'altere une plus longue (ex: "Yan" dans "Yan Verone").
 *  - Lookbehind/lookahead alphanumeriques : evite de matcher au milieu d'un mot.
 *  - Negation `(?<!class="var-resolved">)` : evite de re-wrapper un span deja wrappe.
 */
function wrapResolvedVariables(md: string, context: TemplateContext): string {
  const values = Object.entries(context)
    .filter(([k, v]) => {
      if (k.startsWith("signature.")) return false;
      if (v === undefined || v === null) return false;
      const sv = String(v).trim();
      return sv.length >= 3;
    })
    .map(([, v]) => String(v))
    .sort((a, b) => b.length - a.length);

  let result = md;
  for (const value of values) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // (?<!class="var-resolved">[^<]*) : ne re-wrap pas un contenu deja wrap
    // (?<![a-zA-Z0-9]) / (?![a-zA-Z0-9]) : eviter le matching partiel de mot
    const re = new RegExp(
      `(?<!class="var-resolved">[^<]*)(?<![a-zA-Z0-9])(${escaped})(?![a-zA-Z0-9])`,
      "g",
    );
    result = result.replace(re, `<span class="var-resolved">$1</span>`);
  }
  return result;
}

// ─────────────────────────────────────────────────────────
// ETAPE 7 — Configuration de marked (extensions custom)
// ─────────────────────────────────────────────────────────

// Styles autorises pour les listes (whitelist contre injection CSS).
const ALLOWED_LIST_STYLES = new Set<string>([
  "disc",
  "circle",
  "square",
  "dash",
  "decimal",
  "lower-alpha",
  "upper-alpha",
  "lower-roman",
  "upper-roman",
  "multilevel",
]);

/**
 * Stocke les styles de listes detectes via les marqueurs
 * `<!-- list-style: X -->` du markdown. La fonction preprocess
 * remplace le marqueur par un `<!--LIST_STYLE_N-->` interne, et le
 * renderer marked consomme cette information au moment de rendre
 * la prochaine liste.
 *
 * Reset a chaque appel de processMarkdownToHtml.
 */
let listStyleQueue: string[] = [];

function preprocessListStyles(md: string): string {
  if (!md) return md;
  listStyleQueue = [];
  // Capture chaque marqueur, le retire du markdown et empile son style.
  // L'index dans la queue est encode dans un marker special qui survit
  // a marked (commentaire HTML) et qui est remplace ensuite par un
  // attribut `data-list-style` sur l'ouverture du <ul>/<ol> via regex.
  return md.replace(
    /^[ \t]*<!--\s*list-style:\s*([\w-]+)\s*-->[ \t]*\n/gim,
    (_match, raw: string) => {
      const style = String(raw).toLowerCase();
      if (!ALLOWED_LIST_STYLES.has(style)) return "";
      const idx = listStyleQueue.length;
      listStyleQueue.push(style);
      return `\n<!--LSTYLE:${idx}-->\n`;
    },
  );
}

/**
 * Apres marked.parse, cherche les marqueurs `<!--LSTYLE:N-->` qui
 * precedent un `<ul>` ou `<ol>` et injecte les attributs `style="..."`
 * + `class="..."` correspondants.
 */
function applyListStylesToHtml(html: string): string {
  if (!html || listStyleQueue.length === 0) return html;
  // 1) Tolerance : marked peut wrapper le commentaire dans un <p>.
  // On retire ces wrappers vides autour des marqueurs LSTYLE.
  let out = html.replace(/<p>(\s*<!--LSTYLE:\d+-->\s*)<\/p>/g, "$1");
  // 2) Pour chaque marqueur suivi de <ul>/<ol>, applique l'attribut style.
  out = out.replace(
    /<!--LSTYLE:(\d+)-->\s*<(ul|ol)\b([^>]*)>/g,
    (_match, idxStr: string, tag: string, attrs: string) => {
      const idx = Number(idxStr);
      const style = listStyleQueue[idx];
      if (!style || !ALLOWED_LIST_STYLES.has(style)) {
        return `<${tag}${attrs}>`;
      }
      if (style === "dash") {
        // Pas de marqueur natif : on injecte une classe specifique
        // (CSS .tpl-list-dash dessine un tiret long via ::before).
        const merged = attrs.includes("class=")
          ? attrs.replace(/class="([^"]*)"/, 'class="$1 tpl-list-dash"')
          : `${attrs} class="tpl-list-dash"`;
        return `<${tag}${merged} style="list-style-type: none">`;
      }
      if (style === "multilevel") {
        // Hierarchie 1, 1.1, 1.1.1 via CSS counters (cf. cssBlock).
        const merged = attrs.includes("class=")
          ? attrs.replace(/class="([^"]*)"/, 'class="$1 tpl-list-multilevel"')
          : `${attrs} class="tpl-list-multilevel"`;
        return `<${tag}${merged} style="list-style-type: none">`;
      }
      return `<${tag}${attrs} style="list-style-type: ${style}">`;
    },
  );
  return out;
}

let markedConfigured = false;
function configureMarked() {
  if (markedConfigured) return;
  markedConfigured = true;
  marked.setOptions({
    gfm: true,
    breaks: false,
  });
  marked.use({
    renderer: {
      // Checkbox markdown : on emet un span CSS au lieu d'un <input> natif
      // (Chromium n'imprime pas correctement les inputs en mode print).
      checkbox(this: unknown, { checked }: Tokens.Checkbox): string {
        return `<span class="md-checkbox${checked ? " checked" : ""}" aria-hidden="true"></span> `;
      },
      // Listitem : applique la classe md-task pour les items checkbox.
      listitem(item: Tokens.ListItem): string {
        const parser = (
          this as unknown as {
            parser: { parseInline: (tokens: Token[]) => string };
          }
        ).parser;
        const inner = parser.parseInline(item.tokens);
        if (item.task) {
          return `<li class="md-task${item.checked ? " checked" : ""}">${inner}</li>\n`;
        }
        return `<li>${inner}</li>\n`;
      },
    },
  });
}

// ─────────────────────────────────────────────────────────
// Pipeline complet markdown -> HTML
// ─────────────────────────────────────────────────────────

/**
 * Applique le pipeline complet (etapes 2 a 7) sur le markdown brut.
 * Retourne le HTML pret a etre injecte dans le layout.
 */
function processMarkdownToHtml(
  bodyMarkdown: string,
  context: TemplateContext,
  signatures?: HtmlPdfOptions["signatures"],
  checkboxStates?: Record<string, boolean>,
  signatureScope: SignatureScope = "both",
): { html: string; renderError: string | null; unresolvedCount: number } {
  let renderError: string | null = null;
  let s: string;

  try {
    // ETAPE 2 : substitue les variables {{...}} et les blocs conditionnels.
    s = renderTemplate(bodyMarkdown ?? "", context ?? {});
  } catch (e) {
    renderError = (e as Error)?.message ?? "Erreur de rendu inconnue";
    s = bodyMarkdown ?? "";
  }

  // ETAPE 3 : strip backticks (seeds legacy wrappent les variables en `code`).
  s = s.replace(/`/g, "");

  // ETAPE 3-bis : pre-coche les checkboxes (a partir des etats sauvegardes
  // lors de la signature). Doit se faire AVANT marked.parse mais APRES la
  // substitution des variables (au cas ou des `- [ ]` viendraient d'un
  // bloc conditionnel).
  s = applyCheckboxStates(s, checkboxStates);

  // ETAPE 3a : extrait les marqueurs `<!-- list-style: X -->` AVANT
  // que marked ne les transforme. Les styles sont stockes dans une
  // queue puis re-injectes apres rendu HTML.
  s = preprocessListStyles(s);

  // ETAPE 3b : preambule "Entre les parties soussignees" -> bloc encadre.
  // Le bloc HTML resultant est immunise contre les transformations
  // ulterieures (marked v14 preserve les balises HTML inline + block).
  s = preprocessPreamble(s);

  // ETAPE 4 : signatures detectees avant le wrap des variables.
  // Si `signatures` fourni, les ancres `[Signature ...]` sont remplacees
  // par un bloc avec image base64 + nom + date (PDF final post-signature).
  // Le scope filtre quels roles (employe / employeur) sont effectivement rendus.
  s = preprocessSignatures(s, signatures, signatureScope);
  s = stripDuplicateSignatureHeading(s);
  // Si le scope est "none" ou si toutes les ancres ont ete filtrees, on
  // supprime egalement le titre `## Signatures` orphelin.
  s = s.replace(/^#{1,3}\s+Signatures?\s*$\n+(?=\n|$)/gim, "");

  // Compte les variables non resolues avant transformation (pour le bandeau).
  const unresolvedCount = countUnresolvedVars(s);

  // ETAPE 5 : placeholders {{...}} restants -> spans surlignes.
  s = preprocessPlaceholders(s);

  // ETAPE 6 : wrap des valeurs du contexte en gras navy.
  s = wrapResolvedVariables(s, context ?? {});

  // ETAPE 7 : markdown -> HTML (marked v14 preserve les balises HTML inline).
  configureMarked();
  if (!s.trim()) {
    return {
      html: '<p class="empty">Aucun contenu a afficher.</p>',
      renderError,
      unresolvedCount: 0,
    };
  }
  // Marked v14 strict : certaines listes mal formees (ex. item avec ligne
  // blanche au milieu, indentation incoherente) declenchent
  // "Token with list type was not found" et le PDF entier crash.
  // On wrap dans try/catch avec un fallback tolerant pour ne JAMAIS bloquer
  // la generation du PDF cahier.
  let html: string;
  try {
    html = marked.parse(s) as string;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      "[processMarkdownToHtml] marked.parse a echoue, fallback tolerant :",
      msg,
    );
    renderError = renderError ?? msg;
    try {
      // Tentative 2 : nettoie les patterns connus pour casser marked v14.
      // Pattern A : ligne blanche au milieu d'une liste ("- item\n\n  detail")
      //   -> on retire la ligne blanche entre les items indentes.
      // Pattern B : indentation tabulaire detectee -> conversion en 2 espaces.
      const cleaned = s
        .replace(/\t/g, "  ")
        .replace(/^(\s*[-*+]\s+[^\n]+)\n\n(\s+\S)/gm, "$1\n$2");
      html = marked.parse(cleaned) as string;
    } catch (err2) {
      const msg2 = err2 instanceof Error ? err2.message : String(err2);
      console.warn(
        "[processMarkdownToHtml] fallback tolerant a aussi echoue :",
        msg2,
      );
      // Dernier recours : preserve le contenu brut dans un <pre> pour
      // que l'utilisateur voit au moins le markdown original.
      html = `<div class="md-fallback"><pre>${escapeHtml(s)}</pre></div>`;
    }
  }
  // Applique les list-style detectes a l'etape 3a sur les <ul>/<ol> rendus.
  html = applyListStylesToHtml(html);
  return { html, renderError, unresolvedCount };
}

function countUnresolvedVars(text: string): number {
  if (!text) return 0;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(UNRESOLVED_VAR_REGEX.source, "g");
  while ((m = re.exec(text)) !== null) {
    const key = m[1].trim();
    if (RESERVED_VAR_KEYWORDS.has(key)) continue;
    seen.add(key);
  }
  return seen.size;
}

// ─────────────────────────────────────────────────────────
// ETAPE 8 — Construction du document HTML complet
// ─────────────────────────────────────────────────────────

function buildHtmlDocument(htmlBody: string, opts: HtmlPdfOptions): string {
  const title = escapeHtml(opts.title || "Document");
  const badge = DOC_TYPE_BADGE[opts.documentType] ?? "Document";
  const docNumber =
    opts.metadata?.documentNumber ||
    (opts.metadata?.version ? `v${opts.metadata.version}` : "");
  const note = DOC_TYPE_NOTE[opts.documentType];
  const todayFr = new Date().toLocaleDateString("fr-CA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const metaLine: string[] = [];
  if (opts.metadata?.employeeName)
    metaLine.push(`Destinataire : ${escapeHtml(opts.metadata.employeeName)}`);
  if (opts.metadata?.companyName)
    metaLine.push(escapeHtml(opts.metadata.companyName));
  if (opts.metadata?.version)
    metaLine.push(`Version : ${escapeHtml(opts.metadata.version)}`);

  return `<!DOCTYPE html>
<html lang="fr-CA">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  /* Import Google Fonts retire : causait navigation timeouts Puppeteer.
     Fallback system-ui/Segoe UI partout, aspect identique en pratique. */

  @page {
    size: A4;
    /* Pages 2+ : top margin 22mm pour eviter texte colle en haut */
    margin: 22mm 0 70px 0;
    @bottom-left {
      content: "${escapeHtml(COMPANY.fullName)}";
      font-family: 'Inter', sans-serif;
      font-size: 7.5pt;
      color: #94A3B8;
      margin-left: 14mm;
    }
    @bottom-center {
      content: "Page " counter(page) " / " counter(pages);
      font-family: 'Inter', sans-serif;
      font-size: 7.5pt;
      color: #94A3B8;
    }
  }
  /* Page 1 SEULEMENT : margin top = 0 pour que le header navy soit EDGE-TO-EDGE */
  /* en haut du papier sans aucune marge blanche au-dessus. */
  @page :first {
    margin-top: 0;
  }

  /* Le contenu (apres le header navy) a un padding lateral standard. */
  /* Le header navy lui occupe la PLEINE LARGEUR car son parent body est sans padding. */
  body > .doc-meta, body > main, body > .doc-footer-note {
    padding-left: 14mm;
    padding-right: 14mm;
  }
  body > main { padding-top: 10mm; }

  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #1E293B;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 10.5pt;
    /* line-height aere (1.65) pour une lecture plus confortable des
       longs paragraphes legaux, conforme aux conventions de mise en page
       contractuelles professionnelles (Stripe legal, DocuSign templates). */
    line-height: 1.65;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    /* Activation des ligatures + kerning pour rendu plus propre. */
    font-feature-settings: "kern" 1, "liga" 1, "calt" 1;
    text-rendering: optimizeLegibility;
  }

  /* ── Header VNK sur page 1 ── */
  .doc-header {
    background: linear-gradient(135deg, #0F2D52 0%, #15406d 100%);
    color: white;
    /* EDGE-TO-EDGE : pas de border-radius, padding interne pour le contenu */
    padding: 18px 14mm;
    margin: 0 0 28px 0;
    display: table;
    width: 100%;
    box-sizing: border-box;
    page-break-after: avoid;
    break-after: avoid;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .doc-header .left { display: table-cell; vertical-align: middle; }
  .doc-header .right { display: table-cell; vertical-align: middle; text-align: right; }
  .doc-header .logo {
    display: inline-block;
    width: 48px;
    height: 48px;
    background: rgba(255,255,255,0.12);
    border: 1.5px solid rgba(255,255,255,0.3);
    border-radius: 8px;
    text-align: center;
    line-height: 48px;
    font-weight: 700;
    font-size: 14pt;
    letter-spacing: 0.5px;
    vertical-align: middle;
    margin-right: 12px;
    color: white;
  }
  .doc-header .brand-text { display: inline-block; vertical-align: middle; }
  .doc-header .brand-name { font-size: 14pt; font-weight: 600; margin: 0; }
  .doc-header .brand-tag {
    font-size: 7.5pt;
    letter-spacing: 1.5px;
    opacity: 0.7;
    text-transform: uppercase;
    margin-top: 2px;
  }
  .doc-header .doc-title { font-size: 11pt; font-weight: 600; margin: 0; }
  .doc-header .doc-meta-line {
    font-size: 8.5pt;
    opacity: 0.75;
    margin-top: 4px;
  }
  .doc-header .doc-date {
    font-size: 7.5pt;
    opacity: 0.6;
    margin-top: 2px;
  }

  /* Meta secondaire (employe, version) */
  .doc-meta {
    font-size: 8.5pt;
    color: #64748B;
    border-bottom: 0.5px solid #E2E8F0;
    padding-bottom: 6px;
    margin-bottom: 16px;
  }

  /* ── Titres ── */
  h1 {
    font-size: 22pt;
    font-weight: 700;
    color: #0F2D52;
    letter-spacing: -0.5px;
    margin: 24px 0 14px;
    padding-bottom: 10px;
    border-bottom: 2px solid #0F2D52;
    page-break-after: avoid;
    break-after: avoid;
    line-height: 1.2;
    text-align: left;
  }
  /* H2 : marge top genereuse pour une vraie "respiration" entre sections,
     un peu de letter-spacing pour le rendu serif des contrats legaux. */
  h2 {
    font-size: 13pt;
    font-weight: 600;
    color: #0F2D52;
    margin: 28px 0 10px;
    page-break-after: avoid;
    break-after: avoid;
    line-height: 1.3;
    letter-spacing: 0.1px;
  }
  /* Premiere section qui suit directement le H1 : pas de marge top
     excessive (sinon trop d'espace vide). */
  h1 + h2 { margin-top: 18px; }
  h3 {
    font-size: 11pt;
    font-weight: 600;
    color: #334155;
    margin: 18px 0 6px;
    page-break-after: avoid;
    break-after: avoid;
    line-height: 1.3;
  }

  /* ── Auto-numerotation hierarchique des titres (Word-style) ──
     Activee via <main class="doc-body" data-numbering="auto">.
     Produit "1. Titre" sur les H2 et "1.1 Sous-titre" sur les H3
     (compteur H3 reset a chaque nouveau H2). Exclut les titres
     speciaux (signatures, etc.) via :not(.signatures-title). */
  .doc-body[data-numbering="auto"] {
    counter-reset: vnk-h2 vnk-h3;
  }
  .doc-body[data-numbering="auto"] h2:not(.signatures-title) {
    counter-reset: vnk-h3;
  }
  .doc-body[data-numbering="auto"] h2:not(.signatures-title)::before {
    counter-increment: vnk-h2;
    content: counter(vnk-h2) ". ";
    color: #0F2D52;
    font-weight: 700;
    margin-right: 0.35em;
  }
  .doc-body[data-numbering="auto"] h3:not(.signatures-title)::before {
    counter-increment: vnk-h3;
    content: counter(vnk-h2) "." counter(vnk-h3) " ";
    color: #334155;
    font-weight: 600;
    margin-right: 0.35em;
  }

  /* ── Paragraphes ── */
  /* text-align: justify + hyphens: auto donne une marge droite propre
     et homogene, conforme aux normes typographiques des contrats QC.
     widows/orphans: 3 evite qu'une ligne isolee se retrouve seule en
     haut ou en bas d'une page (regle FR de mise en page editoriale). */
  p {
    margin: 0 0 11px;
    text-align: justify;
    text-justify: inter-word;
    hyphens: auto;
    -webkit-hyphens: auto;
    font-size: 10.5pt;
    line-height: 1.65;
    color: #1E293B;
    orphans: 3;
    widows: 3;
  }
  /* Le tout premier paragraphe (apres H1) ou un paragraphe qui suit une
     H2 garde une marge top reduite pour cohesion visuelle avec le titre. */
  h1 + p, h2 + p, h3 + p { margin-top: 2px; }
  strong, b { font-weight: 600; color: #0F2D52; }
  em, i { font-style: italic; }
  a { color: #0F2D52; text-decoration: underline; }

  /* Preambule : paragraphe d'introduction "Entre les parties soussignees"
     centre, sur fond gris clair, italique, encadre subtil. Active
     automatiquement sur un paragraphe ENCADRE par une ligne en gras
     suivie d'un paragraphe explicatif (cf. contrats VNK seedes). */
  .preamble {
    margin: 14px 0 22px;
    padding: 14px 18px;
    background: #F8FAFC;
    border-left: 3px solid #0F2D52;
    border-radius: 0 4px 4px 0;
    font-size: 10pt;
    line-height: 1.6;
    color: #334155;
    text-align: left;
    hyphens: none;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .preamble p { margin: 4px 0; text-align: left; }
  .preamble strong { color: #0F2D52; }

  /* Notes legales / mentions de loi (small print italique). */
  .legal-notice {
    font-size: 9pt;
    color: #475569;
    font-style: italic;
    line-height: 1.5;
    margin: 8px 0 14px;
    padding-left: 10px;
    border-left: 2px solid #CBD5E1;
  }

  /* Blockquote (citations de loi, mises en exergue) */
  blockquote {
    margin: 12px 0 14px;
    padding: 8px 14px 8px 16px;
    border-left: 3px solid #0F2D52;
    background: #F1F5F9;
    color: #334155;
    font-style: italic;
    border-radius: 0 4px 4px 0;
    font-size: 10pt;
    line-height: 1.55;
    page-break-inside: avoid;
  }
  blockquote p { margin: 4px 0; text-align: left; hyphens: none; }

  /* ── Variables RESOLUES (en gras navy) ── */
  .var-resolved {
    font-weight: 600;
    color: #0F2D52;
  }

  /* ── Placeholders (variables non resolues) ── */
  .ph-known {
    background: #fef3c7;
    color: #92400e;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid #fbbf24;
    font-weight: 600;
    font-size: 0.92em;
    white-space: nowrap;
  }
  .ph-unknown {
    background: #fee2e2;
    color: #991b1b;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid #f87171;
    font-weight: 600;
    font-size: 0.92em;
    white-space: nowrap;
  }

  /* ── Listes ── */
  /* Indentation 1.8em ample pour ne pas que les puces collent au bord
     gauche, et un margin-bottom de 7px pour separer clairement chaque
     item. Marker navy pour rester dans le theme VNK. */
  ul, ol {
    margin: 10px 0 14px 0;
    padding-left: 1.8em;
  }
  li {
    margin-bottom: 7px;
    line-height: 1.55;
    color: #1E293B;
    text-align: left;
    /* Hyphens off dans les listes : les items courts hyphenes paraissent
       maladroits, on prefere des coupures naturelles aux espaces. */
    hyphens: none;
  }
  /* Listes imbriquees : moins de marge top, indentation supplementaire. */
  li > ul, li > ol {
    margin: 4px 0 4px 0;
    padding-left: 1.4em;
  }
  ul li::marker { color: #0F2D52; }
  ol li::marker { font-weight: 600; color: #0F2D52; }

  /* Liste "tiret" (dash) : pas de marqueur natif, on dessine un em-dash
     navy via ::before puisque list-style-type ne propose pas de tiret. */
  ul.tpl-list-dash { list-style-type: none; padding-left: 1.6em; }
  ul.tpl-list-dash > li { position: relative; }
  ul.tpl-list-dash > li::before {
    content: "\\2014";
    position: absolute;
    left: -1.15em;
    color: #0F2D52;
    font-weight: 600;
  }

  /* Liste "multilevel" (hierarchie Word 1, 1.1, 1.1.1) via CSS counters.
     Niveau 1 = decimal, niveau 2 = 1.1, niveau 3 = 1.1.1. */
  ol.tpl-list-multilevel {
    counter-reset: lvl1;
    list-style-type: none;
    padding-left: 1.8em;
  }
  ol.tpl-list-multilevel > li {
    counter-increment: lvl1;
    position: relative;
  }
  ol.tpl-list-multilevel > li::before {
    content: counter(lvl1) ".";
    position: absolute;
    left: -1.8em;
    color: #0F2D52;
    font-weight: 600;
    min-width: 1.5em;
    text-align: right;
    padding-right: 0.3em;
  }
  ol.tpl-list-multilevel ol {
    counter-reset: lvl2;
    list-style-type: none;
    padding-left: 1.8em;
  }
  ol.tpl-list-multilevel ol > li {
    counter-increment: lvl2;
  }
  ol.tpl-list-multilevel ol > li::before {
    content: counter(lvl1) "." counter(lvl2);
  }
  ol.tpl-list-multilevel ol ol {
    counter-reset: lvl3;
  }
  ol.tpl-list-multilevel ol ol > li {
    counter-increment: lvl3;
  }
  ol.tpl-list-multilevel ol ol > li::before {
    content: counter(lvl1) "." counter(lvl2) "." counter(lvl3);
  }

  /* ── Task lists (checkboxes markdown) ── */
  /* Le li.md-task force list-style:none + flex pour aligner la case et
     le texte cote a cote. Annule le marker hereditaire ::marker. */
  li.md-task {
    list-style: none !important;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 6px 0;
    padding-left: 0;
  }
  li.md-task::marker { content: none; }
  /* Carre case-a-cocher : box solide visible meme en impression PDF.
     - 14x14px (~10.5pt) avec border 2px navy : reste lisible imprime.
     - print-color-adjust: exact force Chromium a preserver border + fond.
     - background explicite (blanc opaque) garantit le rendu meme sur
       fonds non-blancs. */
  .md-checkbox {
    display: inline-block;
    box-sizing: border-box;
    width: 14px;
    height: 14px;
    border: 2px solid #0F2D52;
    border-radius: 3px;
    flex: 0 0 14px;
    margin-top: 3px;
    position: relative;
    background: #ffffff;
    vertical-align: middle;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-adjust: exact;
  }
  /* Etat "coche" : fond navy plein avec V blanc dessine en CSS. */
  .md-checkbox.checked {
    background: #0F2D52 !important;
    border-color: #0F2D52 !important;
  }
  .md-checkbox.checked::after {
    content: "";
    position: absolute;
    left: 2.5px;
    top: 0px;
    width: 4px;
    height: 8px;
    border-right: 2px solid #ffffff;
    border-bottom: 2px solid #ffffff;
    transform: rotate(45deg);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Tables — vrai look de tableau avec grille complete ── */
  /* Bordures visibles sur TOUS les cotes de chaque cellule (grille complete).
     Header navy avec lignes separatrices blanches subtiles entre colonnes.
     Lignes alternees gris pale pour lisibilite ligne par ligne. */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 9.5pt;
    border: 1.5px solid #CBD5E1;
    page-break-inside: auto;
    box-shadow: 0 1px 3px rgba(15, 45, 82, 0.06);
  }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  table th {
    background: #0F2D52;
    color: white;
    padding: 10px 14px;
    text-align: left;
    font-weight: 600;
    font-size: 9pt;
    letter-spacing: 0.3px;
    line-height: 1.4;
    /* Trait blanc semi-transparent entre colonnes pour separer visuellement */
    border-right: 1px solid rgba(255, 255, 255, 0.18);
    border-bottom: 1.5px solid #15406d;
  }
  table th:last-child { border-right: none; }
  table td {
    padding: 9px 14px;
    /* Grille complete : bord droit + bord bas sur chaque cellule */
    border-right: 1px solid #CBD5E1;
    border-bottom: 1px solid #CBD5E1;
    vertical-align: top;
    line-height: 1.5;
  }
  table td:last-child { border-right: none; }
  table tr:last-child td { border-bottom: none; }
  table tr:nth-child(even) td { background: #F8FAFC; }
  table td p { margin: 0; text-align: left; hyphens: none; }
  /* Cellules numeriques : alignement droit + chiffres tabulaires. */
  table td.num, table td[align="right"] {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  /* ── Signatures (display:table pour respect page-break Chromium) ── */
  .signatures-title {
    font-size: 13pt;
    font-weight: 600;
    color: #0F2D52;
    margin: 28px 0 12px;
    page-break-after: avoid;
    break-after: avoid;
  }
  .signatures {
    display: table;
    width: 100%;
    border-collapse: separate;
    border-spacing: 16px 0;
    margin: 0 0 12px 0;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    table-layout: fixed;
  }
  .signature-block {
    display: table-cell;
    width: 50%;
    vertical-align: top;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    overflow: hidden;
    background: #F8FAFC;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .signature-block .role-badge {
    background: linear-gradient(135deg, #0F2D52 0%, #15406d 100%);
    color: white;
    padding: 8px 14px;
    font-size: 8.5pt;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }
  .signature-block .signature-area {
    padding: 24px 14px 14px;
    min-height: 110px;
  }
  .signature-block .sig-line {
    border-bottom: 1.3px solid #334155;
    height: 28px;
    margin-bottom: 4px;
  }
  .signature-block .sig-row {
    display: table;
    width: 100%;
    margin-top: 14px;
    border-spacing: 10px 0;
  }
  .signature-block .sig-cell {
    display: table-cell;
    width: 50%;
  }
  .signature-block .sig-cell .sig-line-short {
    border-bottom: 1.3px solid #334155;
    height: 22px;
  }
  .signature-block .label {
    font-size: 7pt;
    color: #64748B;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 2px;
  }
  /* ── Bloc signature SIGNE (image + nom + date pre-remplis) ── */
  .signature-block.signed { background: #FFFFFF; border-color: #0F2D52; }
  .signature-block.signed .sig-image-wrap {
    height: 90px;
    margin-bottom: 4px;
    border-bottom: 1.3px solid #334155;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 4px 0;
    overflow: hidden;
  }
  .signature-block.signed .sig-image {
    max-height: 84px;
    max-width: 100%;
    height: auto;
    width: auto;
    object-fit: contain;
  }
  .signature-block.signed .sig-value {
    font-size: 10pt;
    font-weight: 600;
    color: #0F2D52;
    border-bottom: 1.3px solid #334155;
    padding-bottom: 2px;
    min-height: 18px;
  }

  /* ── Sauts de page utilisateur ── */
  .page-break,
  .pagebreak,
  div[data-pagebreak] {
    page-break-after: always;
    break-after: page;
    height: 0;
    visibility: hidden;
  }

  /* ── Bandeau d'avertissement ── */
  .warning-banner {
    background: #fef3c7;
    border: 1px solid #fbbf24;
    color: #92400e;
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 9.5pt;
    font-weight: 500;
    margin: 0 0 16px;
    page-break-after: avoid;
  }
  .warning-banner.error {
    background: #fee2e2;
    border-color: #f87171;
    color: #991b1b;
  }

  /* ── Note de pied ── */
  .doc-footer-note {
    margin-top: 30px;
    padding-top: 12px;
    border-top: 1px solid #E2E8F0;
    font-size: 8pt;
    color: #64748B;
    text-align: center;
    font-style: italic;
  }

  /* ── Empty state ── */
  p.empty {
    text-align: center;
    color: #94a3b8;
    font-style: italic;
    padding: 30px 0;
  }

  /* Evite saut de page apres titres / dans figures */
  img, figure { page-break-inside: avoid; }
</style>
</head>
<body>
  <div class="doc-header">
    <div class="left">
      <div class="logo">VNK</div>
      <div class="brand-text">
        <div class="brand-name">${escapeHtml(COMPANY.shortName)}</div>
        <div class="brand-tag">${escapeHtml(COMPANY.tagline)}</div>
      </div>
    </div>
    <div class="right">
      <div class="doc-title">${title}</div>
      <div class="doc-meta-line">${escapeHtml(badge)}${docNumber ? " &middot; " + escapeHtml(docNumber) : ""}</div>
      <div class="doc-date">${escapeHtml(todayFr)}</div>
    </div>
  </div>

  ${metaLine.length > 0 ? `<div class="doc-meta">${metaLine.join(" &middot; ")}</div>` : ""}

  <main class="doc-body" data-numbering="${opts.numbering ?? "none"}">
    ${htmlBody}
  </main>

  <div class="doc-footer-note">${escapeHtml(note)}</div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────
// ETAPE 9 — Browser singleton (puppeteer-core + Chromium auto-detect)
// ─────────────────────────────────────────────────────────

type BrowserLike = {
  newPage: () => Promise<PageLike>;
  close: () => Promise<void>;
};
type PageLike = {
  setContent: (
    html: string,
    opts?: { waitUntil?: string | string[]; timeout?: number },
  ) => Promise<void>;
  emulateMediaType: (type: string) => Promise<void>;
  pdf: (opts: PuppeteerPdfOptions) => Promise<Buffer | Uint8Array>;
  close: () => Promise<void>;
};
interface PuppeteerPdfOptions {
  format?: string;
  printBackground?: boolean;
  preferCSSPageSize?: boolean;
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  outline?: boolean;
  tagged?: boolean;
}

let browserPromise: Promise<BrowserLike | null> | null = null;
// Memoise les echecs : evite de retry chaque requete (dev Windows sans Chrome).
let browserUnavailable = false;

async function launchBrowser(): Promise<BrowserLike | null> {
  if (browserUnavailable) return null;
  try {
    const puppeteer = (await import("puppeteer-core")).default;

    let executablePath: string | undefined;
    let args: string[] = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
    ];
    let headless: boolean | "shell" = true;

    // 1) Override par variable d'env (Docker custom, Windows dev)
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    // 2) Production ou flag explicite : @sparticuz/chromium
    if (
      !executablePath &&
      (process.env.NODE_ENV === "production" ||
        process.env.USE_SPARTICUZ_CHROMIUM === "1")
    ) {
      try {
        const chromiumMod = (await import("@sparticuz/chromium")) as unknown as {
          default?: {
            executablePath: () => Promise<string>;
            args: string[];
            headless: boolean | "shell";
          };
          executablePath?: () => Promise<string>;
          args?: string[];
          headless?: boolean | "shell";
        };
        const chromium = chromiumMod.default ?? chromiumMod;
        if (chromium.executablePath) {
          executablePath = await chromium.executablePath();
        }
        if (chromium.args) args = [...chromium.args, ...args];
        if (chromium.headless !== undefined) headless = chromium.headless;
      } catch (e) {
        console.warn(
          "[pdf-html-renderer] @sparticuz/chromium indisponible :",
          (e as Error)?.message ?? e,
        );
      }
    }

    // 3) Dev local : chercher Chrome installe sur la machine
    if (!executablePath) {
      executablePath = detectLocalChrome();
    }

    if (!executablePath) {
      console.warn(
        "[pdf-html-renderer] Aucun executable Chromium trouve. Defini PUPPETEER_EXECUTABLE_PATH ou installe Chrome. Fallback PDFKit active.",
      );
      browserUnavailable = true;
      return null;
    }

    const browser = await puppeteer.launch({
      executablePath,
      headless,
      args,
    });
    return browser as unknown as BrowserLike;
  } catch (e) {
    console.warn(
      "[pdf-html-renderer] puppeteer-core launch failed, fallback PDFKit :",
      (e as Error)?.message ?? e,
    );
    browserUnavailable = true;
    return null;
  }
}

function detectLocalChrome(): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs") as typeof import("fs");
  const candidates: string[] = [];
  if (process.platform === "win32") {
    candidates.push(
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    );
    if (process.env.LOCALAPPDATA) {
      candidates.push(
        `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      );
    }
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    );
  } else {
    candidates.push(
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/snap/bin/chromium",
    );
  }
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* continue */
    }
  }
  return undefined;
}

async function getBrowser(): Promise<BrowserLike | null> {
  if (!browserPromise) {
    browserPromise = launchBrowser();
  }
  const b = await browserPromise;
  if (!b) return null;
  return b;
}

// ─────────────────────────────────────────────────────────
// Entry points
// ─────────────────────────────────────────────────────────

/**
 * Rend un template VNK en PDF via Chromium headless.
 * Fallback automatique vers PDFKit si Chromium est indisponible.
 */
export async function renderTemplateHtmlToPdf(
  opts: HtmlPdfOptions,
): Promise<Buffer> {
  const html = renderTemplateAsHtml(opts);

  const browser = await getBrowser();
  if (!browser) {
    console.info(
      "[pdf-html-renderer] Fallback PDFKit (Chromium indisponible).",
    );
    return renderViaPdfKit({
      bodyMarkdown: opts.bodyMarkdown,
      context: opts.context,
      title: opts.title,
      documentType: opts.documentType,
      metadata: opts.metadata,
    });
  }

  let page: PageLike | null = null;
  try {
    page = await browser.newPage();
    await page.emulateMediaType("print");
    await page.setContent(html, {
      // domcontentloaded (au lieu de networkidle0) : evite d'attendre
      // les ressources externes. Google Fonts retire = pas de network call.
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    // Le grand bandeau navy gradient devient le RUNNING HEADER de chaque page.
    // Les templates Puppeteer ne supportent que les styles INLINE (pas de CSS
    // externe, pas de @import Google Fonts) — on utilise une police système
    // sans-serif robuste qui ressemble a Inter.
    const docTitle = escapeHtml(opts.title || "Document");
    const docBadge = escapeHtml(DOC_TYPE_BADGE[opts.documentType] ?? "Document");
    const docNumber = opts.metadata?.documentNumber
      ?? (opts.metadata?.version ? `v${opts.metadata.version}` : "");
    const docDate = new Date().toLocaleDateString("fr-CA", {
      day: "2-digit", month: "long", year: "numeric",
    });
    // Header navy gradient dans le BODY (pas headerTemplate Puppeteer qui a des
    // contraintes Chromium pour edge-to-edge). Approche identique aux PDFs clients
    // (pdf-templates.js) qui dessinent le header en rect(0,0,w,h) direct.
    //
    // Header sur PAGE 1 uniquement comme les devis/factures/contrats clients.
    // Pour avoir un mini-header sur chaque page suivante, on pourrait utiliser
    // CSS `position: running()` mais le support est limite.
    const buf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });
    return Buffer.from(buf);
  } catch (e) {
    console.error(
      "[pdf-html-renderer] Echec rendu PDF Puppeteer, fallback PDFKit :",
      (e as Error)?.message ?? e,
    );
    return renderViaPdfKit({
      bodyMarkdown: opts.bodyMarkdown,
      context: opts.context,
      title: opts.title,
      documentType: opts.documentType,
      metadata: opts.metadata,
    });
  } finally {
    try {
      await page?.close();
    } catch {
      /* noop */
    }
  }
}

/**
 * Rend uniquement le HTML (utilise par l'endpoint preview-html qui
 * alimente la zone Apercu de l'editeur de templates).
 *
 * Inclut la substitution des variables, les placeholders, le wrap des
 * valeurs resolues et les signatures cote a cote.
 */
export function renderTemplateAsHtml(opts: HtmlPdfOptions): string {
  const safeContext = opts.context ?? {};
  const rawBody = opts.bodyMarkdown ?? "";

  const { html: htmlBody, renderError, unresolvedCount } =
    processMarkdownToHtml(
      rawBody,
      safeContext,
      opts.signatures,
      opts.checkboxStates,
      opts.signatureScope ?? "both",
    );

  // Bandeau d'avertissement
  let warning = "";
  if (renderError) {
    warning = `<div class="warning-banner error">Erreur lors du rendu : ${escapeHtml(renderError)}. Le contenu brut est affiche ci-dessous.</div>`;
  } else if (unresolvedCount > 0) {
    warning = `<div class="warning-banner">Apercu avec valeurs par defaut - ${unresolvedCount} variable(s) non resolue(s) surlignee(s).</div>`;
  }

  return buildHtmlDocument(warning + htmlBody, opts);
}

// ─────────────────────────────────────────────────────────
// HANDBOOK RENDERER — Cahier multi-chapitres (page de garde + chapitres)
// ─────────────────────────────────────────────────────────

export interface HandbookHtmlPdfOptions {
  handbook: {
    title: string;
    subtitle?: string;
    coverIntro?: string;
    version: string;
    signatureScope?: SignatureScope;
    /**
     * Demande 7 : valeurs des placeholders `[CHAMP]` saisies par le RH
     * dans l'editeur de cahier. Applique au markdown de chaque chapitre
     * AVANT le rendu pour resoudre les champs manuels.
     */
    customFieldValues?: Record<string, string> | null;
  };
  chapters: Array<{
    title: string;
    bodyMarkdown: string;
    /** Identifiant unique du template (utilise pour matcher chapterStates). */
    templateId?: number;
    /** Cle technique du template (utilisee pour le tri auto par categorie). */
    templateKey?: string;
  }>;
  context: TemplateContext;
  employeeName?: string;
  /** Signature manuscrite a inserer en derniere page (employe). */
  signature?: EmbeddedSignature;
  /** Pre-coche des cases obligatoires (numerotation globale, conserve pour compat). */
  checkboxStates?: Record<string, boolean>;
  /**
   * Mission 2 : etats par chapitre (case "J'ai lu" + initiales) collectes
   * cote employe lors de la signature.
   * @deprecated Demande 4 : remplace par finalRead + finalInitials sur la
   * page d'acceptation globale. Conserve pour retro-compat (signatures deja
   * generees) mais ne produit plus de bloc visuel dans le PDF.
   */
  chapterStates?: Record<number, { read: boolean; initials: string }>;
  /** Acceptation globale du cahier (case finale page signature). */
  globalAccepted?: boolean;
  /** Demande 4 : case "J'ai lu et compris l'ensemble du manuel" finale. */
  finalRead?: boolean;
  /** Demande 4 : initiales finales (au lieu de par chapitre). */
  finalInitials?: string;
}

// ─────────────────────────────────────────────────────────
// Helpers Demande 2 : tri intelligent + Demande 3 : romain
// ─────────────────────────────────────────────────────────

/** Convertit un entier 1..3999 en chiffres romains majuscules. */
function toRoman(num: number): string {
  if (!Number.isFinite(num) || num <= 0) return String(num);
  const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const symbols = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"];
  let n = Math.floor(num);
  let result = "";
  for (let i = 0; i < values.length; i++) {
    while (n >= values[i]) {
      result += symbols[i];
      n -= values[i];
    }
  }
  return result;
}

/**
 * Demande 2 : ordre logique des chapitres dans le cahier.
 * Plus le rang est BAS, plus le chapitre apparait tot.
 */
function categoryRank(key: string | undefined | null): number {
  const k = (key ?? "").toLowerCase();
  if (!k) return 90;
  // 1. Manuel/Charte generale
  if (k.startsWith("manual_") || k.startsWith("charter_") || k.includes("_manual") || k.includes("_charter")) return 10;
  // 2. Codes de conduite
  if (k.startsWith("code_") || k.includes("_code_")) return 20;
  // 3. Politiques
  if (k.endsWith("_policy") || k.startsWith("policy_") || k.includes("_policy_")) return 30;
  // 4. Programmes / Securite / SIMDUT / EPI
  if (
    k.startsWith("safety_") ||
    k.startsWith("program_") ||
    k.includes("simdut") ||
    k.includes("ppe") ||
    k.includes("loto") ||
    k.includes("confined") ||
    k.includes("heights") ||
    k.includes("incident") ||
    k.includes("first_aid")
  ) return 40;
  // 5. Accuses / acceptations
  if (k.includes("acknowledg") || k.includes("acceptance") || k.includes("manual_acknowledgment")) return 50;
  // 6. Onboarding / Checklists
  if (k.startsWith("onboarding_") || k.startsWith("checklist_") || k.includes("_checklist")) return 60;
  // 7. Lettres
  if (k.startsWith("letter_")) return 70;
  // 8. Autres
  return 80;
}

/**
 * Demande 2 : retourne une copie triee des chapitres selon le rank de
 * categorie puis alphabetique sur le titre. La stabilite est garantie par
 * un index secondaire (ordre d'origine prefere si meme rank).
 */
function sortHandbookChapters<T extends { title: string; templateKey?: string }>(
  chapters: T[],
): T[] {
  return chapters
    .map((ch, idx) => ({ ch, idx }))
    .sort((a, b) => {
      const ra = categoryRank(a.ch.templateKey);
      const rb = categoryRank(b.ch.templateKey);
      if (ra !== rb) return ra - rb;
      // Meme categorie : alphabetique
      const cmp = a.ch.title.localeCompare(b.ch.title, "fr-CA", { sensitivity: "base" });
      if (cmp !== 0) return cmp;
      return a.idx - b.idx;
    })
    .map((x) => x.ch);
}

/**
 * D2 : etiquette de chapitre — romain si <= 8 chapitres, sinon decimal.
 * idx est 1-based.
 */
function chapterLabel(idx: number, total: number): string {
  if (total <= 8) return toRoman(idx);
  return String(idx);
}

/**
 * FIX CRITIQUE #1 : strip toute numerotation existante en debut de titre.
 * Les templates seed contiennent souvent des titres deja prefixes
 * (`## 1. Valeurs fondamentales`) et la post-numerotation produit alors
 * un doublon `2. 1. Valeurs fondamentales`. On retire le prefixe avant
 * d'injecter le notre.
 *
 * Patterns strippes (uniquement en TOUT DEBUT) :
 *   - "1.", "1)", "1.1", "1.1.1", "1.1 "       (decimaux et hierarchiques)
 *   - "I.", "II)", "III. ", "IV.", ...         (chiffres romains)
 *   - "a)", "a.", "B)", "AB)", ...             (lettres tres courtes 1-3 chars)
 *
 * Garanties :
 *   - Le regex commence par `^` : impossible de matcher au milieu d'un titre.
 *   - Un titre comme "Preambule" reste intact (commence par un mot).
 *   - Un titre comme "1.1 Champ d'application" devient "Champ d'application".
 */
function stripExistingNumber(title: string): string {
  return title
    // "1.", "1.1", "1.1.1" suivi optionnellement de ")" ou "." puis espace
    .replace(/^\s*\d+(\.\d+)*[.)]?\s+/, "")
    // Chiffres romains "I.", "II)", "III. " (insensible a la casse)
    .replace(/^\s*[IVXLCDM]+[.)]\s+/i, "")
    // Lettres tres courtes "a)", "a.", "B)" — uniquement 1-3 chars suivis de . ou )
    .replace(/^\s*[a-zA-Z]{1,3}[.)]\s+/, "");
}

/**
 * D2 : prefixe les `<h2>` et `<h3>` rendus avec une numerotation
 * hierarchique propre :
 *   - H2 : "1.", "2.", "3." (reset a chaque chapitre, decimal pur)
 *   - H3 : "a)", "b)", "c)" (reset a chaque H2)
 *
 * On evite les ::before CSS counters car ils ne peuvent pas inserer
 * dynamiquement le contexte chapitre ; on prefixe directement le HTML.
 * On enregistre aussi un id="chapter-{chapterIndex}-section-{idx}" sur
 * chaque H2 pour permettre la navigation TOC -> H2 (D6).
 *
 * FIX CRITIQUE #1 : strip toute numerotation existante (1., I., a)) AVANT
 * d'injecter notre prefixe pour eviter "2. 1. Valeurs fondamentales".
 */
function applyHierarchicalNumbering(
  html: string,
  chapterIndex: number,
  sectionAnchors?: Array<{ index: number; title: string; label: string }>,
): string {
  if (!html) return html;
  let h2Counter = 0;
  let h3Counter = 0;
  const anchors = sectionAnchors;
  return html.replace(
    /<(h2|h3)(\s[^>]*)?>([\s\S]*?)<\/\1>/g,
    (_match, tag: string, attrs: string | undefined, inner: string) => {
      const tagLower = tag.toLowerCase();
      const attrStr = attrs ?? "";
      // Skip signatures-title pour ne pas numeroter "Signatures"
      if (/class="[^"]*signatures-title/i.test(attrStr)) {
        return _match;
      }
      // Strip uniquement les noeuds de texte en debut. On separe la partie
      // textuelle eventuellement precedee de balises inline (em, strong, etc).
      // Approche : on cherche la premiere portion de TEXTE BRUT en debut de
      // inner (avant toute balise) et on lui applique stripExistingNumber.
      const stripped = inner.replace(
        /^(\s*)((?:[^<]+))/,
        (_m, ws: string, text: string) => `${ws}${stripExistingNumber(text)}`,
      );
      if (tagLower === "h2") {
        h2Counter += 1;
        h3Counter = 0;
        const label = `${h2Counter}.`;
        if (anchors) {
          const titleText = stripped.replace(/<[^>]+>/g, "").trim();
          anchors.push({ index: h2Counter, title: titleText, label });
        }
        const prefix = `<span class="hb-num">${label}</span> `;
        const anchorId = `chapter-${chapterIndex}-section-${h2Counter}`;
        return `<h2 id="${anchorId}"${attrStr}>${prefix}${stripped}</h2>`;
      }
      // h3
      h3Counter += 1;
      const letter = h3Counter <= 26
        ? String.fromCharCode(96 + h3Counter) // 1->'a'
        : String(h3Counter);
      const prefix = `<span class="hb-num">${letter})</span> `;
      return `<h3${attrStr}>${prefix}${stripped}</h3>`;
    },
  );
}

// Helpers Mission 2 : page de garde "reliure" et TOC.

function escapeHtmlSafe(s: string): string {
  return escapeHtml(String(s ?? ""));
}

/**
 * REFONTE : header navy inline rendu en TETE de chaque section logique
 * (TOC, Introduction, chaque chapitre, Acceptation finale). N'est PAS
 * repete sur les pages de continuation d'un chapitre long — comportement
 * Word standard. La cover page n'utilise PAS ce header (elle a son propre
 * layout dedie via buildHandbookCoverHtml).
 *
 * Le bloc occupe la pleine largeur du papier grace a une marge negative
 * laterale qui compense le padding 56px de .hb-section. Hauteur fixe 22mm
 * pour matcher visuellement le bandeau de page de garde.
 */
function buildVnkSectionHeader(args: {
  title: string;
  subtitle?: string;
  date?: string;
}): string {
  const subtitle = args.subtitle ?? `Manuel de l'employe VNK`;
  const date = args.date ?? "";
  return `<div class="vnk-section-header">
    <div class="vnk-sh-left">
      <div class="vnk-sh-logo">VNK</div>
      <div class="vnk-sh-brand">
        <div class="vnk-sh-name">${escapeHtmlSafe(COMPANY.shortName)}</div>
        <div class="vnk-sh-tagline">${escapeHtmlSafe(COMPANY.tagline)}</div>
      </div>
    </div>
    <div class="vnk-sh-right">
      <div class="vnk-sh-title">${escapeHtmlSafe(args.title)}</div>
      <div class="vnk-sh-sub">${escapeHtmlSafe(subtitle)}</div>
      ${date ? `<div class="vnk-sh-date">${escapeHtmlSafe(date)}</div>` : ""}
    </div>
  </div>`;
}

export function buildHandbookCoverHtml(args: {
  title: string;
  subtitle?: string;
  version: string;
  date: string;
  employeeName?: string;
}): string {
  // Cover pro : bande navy gradient en haut avec logo + brand,
  // titre enorme au centre, sous-titre et version, recipient encadre
  // en bas avec coordonnees entreprise. Design corporate moderne.
  return `<section class="hb-cover">
  <div class="hb-cover-header">
    <div class="hb-cover-logo-box">VNK</div>
    <div class="hb-cover-header-text">
      <div class="hb-cover-header-name">${escapeHtmlSafe(COMPANY.shortName)}</div>
      <div class="hb-cover-header-tagline">${escapeHtmlSafe(COMPANY.tagline)}</div>
    </div>
  </div>
  <div class="hb-cover-body">
    <div class="hb-cover-eyebrow">Document officiel</div>
    <h1 class="hb-cover-title">${escapeHtmlSafe(args.title)}</h1>
    ${args.subtitle ? `<p class="hb-cover-subtitle">${escapeHtmlSafe(args.subtitle)}</p>` : ""}
    <div class="hb-cover-meta">
      <div class="hb-cover-meta-item">
        <div class="hb-cover-meta-label">Version</div>
        <div class="hb-cover-meta-value">${escapeHtmlSafe(args.version)}</div>
      </div>
      <div class="hb-cover-meta-sep"></div>
      <div class="hb-cover-meta-item">
        <div class="hb-cover-meta-label">Date d'emission</div>
        <div class="hb-cover-meta-value">${escapeHtmlSafe(args.date)}</div>
      </div>
    </div>
  </div>
  <div class="hb-cover-footer">
    ${args.employeeName ? `
    <div class="hb-cover-recipient-card">
      <div class="hb-cover-recipient-label">Prepare pour</div>
      <div class="hb-cover-recipient-name">${escapeHtmlSafe(args.employeeName)}</div>
    </div>
    ` : ""}
    <div class="hb-cover-company">
      <div class="hb-cover-company-name">${escapeHtmlSafe(COMPANY.fullName)}</div>
      <div class="hb-cover-company-contact">${escapeHtmlSafe(COMPANY.email)}</div>
    </div>
  </div>
</section>`;
}

export function buildHandbookTocHtml(
  items: Array<{
    title: string;
    sections?: Array<{ index: number; title: string; label: string }>;
  }>,
  _handbookTitle: string,
): string {
  // REFONTE 4 : TOC editoriale "magazine / annual report".
  // - Numero chapitre en encadre 28x28 bg navy 7%, navy bold 9pt (format 01, 02)
  // - Titre 12pt slate-800 weight 500
  // - Dots radial-gradient slate-300 entre titre et bord
  // - Pas de numero de page (on ne peut pas le calculer en HTML statique)
  // - Hover navy 4% subtle
  const rows = items
    .map((it, idx) => {
      // Format magazine : 01, 02, ..., 09, 10, 11
      const label = String(idx + 1).padStart(2, "0");
      return `<li>
        <a href="#chapter-${idx}">
          <span class="hb-toc-num">${escapeHtmlSafe(label)}</span>
          <span class="hb-toc-title-text">${escapeHtmlSafe(it.title)}</span>
          <span class="hb-toc-dots" aria-hidden="true"></span>
        </a>
      </li>`;
    })
    .join("\n");
  return `<section class="hb-toc" lang="fr">
  <h2 class="hb-toc-heading">Table des matieres</h2>
  <div class="hb-toc-rule" aria-hidden="true"></div>
  <p class="hb-toc-hint">
    Astuce : utilisez le panneau « Signets » de votre lecteur PDF pour naviguer
    en detail a travers les sections de chaque chapitre. Une seule case
    « J'ai lu et compris » se trouve a la fin du manuel pour confirmer
    l'acceptation globale.
  </p>
  <ol class="hb-toc-list">${rows}</ol>
</section>`;
}

/**
 * Compose le HTML d'un cahier PRO : page de garde reliee navy + table des
 * matieres + N chapitres (avec case "J'ai lu et compris" + initiales en
 * pied de chapitre) + page Acceptation globale + signature finale.
 *
 * Mission 2 : refonte complete pour un rendu type "livre relie".
 */
/**
 * REFONTE multi-PDF :
 *  - `coverHtml`  : page de garde (PDF dedie sans header navy).
 *  - `sections`   : N PDFs distincts mergeable via pdf-lib.
 *
 * Chaque entree de `sections` contient un document HTML complet (avec son
 * propre `<style>` partage) qui sera rendu COMME UN PDF separe. Cette
 * approche est la seule fiable pour que la regle CSS "@page :first" cible
 * vraiment la PREMIERE PAGE de chaque section (TOC, Introduction, chacun
 * des chapitres, Acceptation finale), permettant ainsi un header navy
 * edge-to-edge (margin-top: 0) sur la 1ere page de CHAQUE section, et une
 * marge superieure de continuation (16mm) sur les pages suivantes.
 *
 * En CSS Print Level 3, Chromium n'applique `@page name:first` de maniere
 * coherente qu'a la 1ere page d'un meme page-set ; impossible d'avoir N
 * "premieres pages" dans un meme PDF. Le split en N PDFs contourne cette
 * limitation : chaque PDF a sa propre "1ere page" naturelle.
 */
function buildHandbookHtml(
  opts: HandbookHtmlPdfOptions,
): {
  coverHtml: string;
  bodyHtml: string;
  sections: Array<{ name: string; html: string }>;
} {
  const safeContext = opts.context ?? {};
  const scope = opts.handbook.signatureScope ?? "employee_only";

  const today = new Date().toLocaleDateString("fr-CA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Demande 2 : tri intelligent des chapitres par categorie.
  const sortedChapters = sortHandbookChapters(opts.chapters);

  // Demande 7 : valeurs custom RH (placeholder [CHAMP]) appliquees en amont.
  const customValues = opts.handbook.customFieldValues ?? null;

  const handbookSubtitle = `Manuel de l'employe VNK · v${opts.handbook.version}`;

  // D3 : initiales eventuellement deja saisies (live preview) — affichees
  // dans les cartouches "Lu et accepte :" en bas de chaque chapitre.
  const liveInitials = (opts.finalInitials ?? "").trim().toUpperCase();
  const renderInitialsCartouche = () => {
    const value = liveInitials || "________";
    const cls = liveInitials ? "hb-page-initials-value filled" : "hb-page-initials-value empty";
    return `<div class="hb-page-initials">
      <span class="hb-page-initials-label">Lu et accepte :</span>
      <span class="${cls}">${escapeHtmlSafe(value)}</span>
    </div>`;
  };

  // ── Page 1 : Page de garde (reliure navy) ─────────────
  const coverHtml = buildHandbookCoverHtml({
    title: opts.handbook.title,
    subtitle: opts.handbook.subtitle,
    version: opts.handbook.version,
    date: today,
    employeeName: opts.employeeName,
  });

  // ── Chapitres : on rend D'ABORD chaque chapitre pour collecter ses
  // sections H2 (utilisees ensuite dans la TOC interactive — D6).
  const chapterRenders = sortedChapters.map((ch, idx) => {
    const resolvedMd = applyPlaceholderValues(ch.bodyMarkdown, customValues);
    const { html: rawHtml } = processMarkdownToHtml(
      resolvedMd,
      safeContext,
      undefined,
      opts.checkboxStates,
      "none",
    );
    // D2 : numerotation H2 = "1." (decimal pur) + ancres pour TOC.
    const sectionAnchors: Array<{ index: number; title: string; label: string }> = [];
    const html = applyHierarchicalNumbering(rawHtml, idx, sectionAnchors);
    const label = chapterLabel(idx + 1, sortedChapters.length);
    return {
      idx,
      title: ch.title,
      label,
      html,
      sections: sectionAnchors,
    };
  });

  // ── Page 2 : Table des matieres (D6 : interactive avec sections) ──
  // REFONTE : header navy inline rendu UNE FOIS au debut de la section TOC.
  // N'apparait pas sur les pages de continuation.
  const tocBodyHtml = buildHandbookTocHtml(
    chapterRenders.map((c) => ({ title: c.title, sections: c.sections })),
    opts.handbook.title,
  );
  const tocHtml = `<section class="hb-section hb-toc-section" lang="fr">
  ${buildVnkSectionHeader({
    title: "Table des matieres",
    subtitle: handbookSubtitle,
    date: today,
  })}
  ${tocBodyHtml}
</section>`;

  // ── Page d'introduction (coverIntro) si fourni ─────────
  const coverIntroHtml = (() => {
    if (!opts.handbook.coverIntro?.trim()) return "";
    const introMd = applyPlaceholderValues(opts.handbook.coverIntro, customValues);
    const { html } = processMarkdownToHtml(
      introMd,
      safeContext,
      undefined,
      undefined,
      "none",
    );
    // Le markdown du coverIntro commence souvent par "# Introduction", ce qui
    // duplique le titre affiche par le wrapper hb-chapter-title. On retire ce
    // premier H1 pour eviter la duplication visuelle.
    const cleanedHtml = html.replace(/^\s*<h1\b[^>]*>[\s\S]*?<\/h1>\s*/i, "");
    // REFONTE : header navy inline au debut de la section Introduction.
    // Apparait UNE SEULE FOIS (pas sur les continuations).
    return `<section class="hb-section hb-preambule" lang="fr">
  ${buildVnkSectionHeader({
    title: "Introduction",
    subtitle: handbookSubtitle,
    date: today,
  })}
  <h1 class="hb-chapter-title">Introduction</h1>
  <div class="hb-chapter-body">${cleanedHtml}</div>
  ${renderInitialsCartouche()}
</section>`;
  })();

  // ── Chapitres : REFONTE multi-PDF — chaque chapitre est rendu dans son
  // PROPRE document HTML, donc dans son propre PDF. La regle "@page :first"
  // globale dans cssBlock s'applique alors a la 1ere page du chapitre,
  // collant le header navy au bord superieur du papier (margin-top: 0).
  // Les pages de continuation utilisent la regle "@page" par defaut (16mm).
  //
  // PLUS BESOIN de `page: chap-N` ni de `page-break-before: always` :
  // chaque chapitre est un PDF distinct, ils seront concatenes via pdf-lib
  // en aval (cf. renderHandbookHtmlToPdf).
  const chapterSectionsHtml = chapterRenders.map((cr) => {
    // Le markdown du template commence souvent par "# Titre du document",
    // ce qui duplique le titre du chapitre (le wrapper hb-chapter-title
    // affiche deja le titre prefixe du numero). On retire ce premier H1
    // pour eviter la duplication visuelle.
    const cleanedHtml = cr.html.replace(/^\s*<h1\b[^>]*>[\s\S]*?<\/h1>\s*/i, "");
    return {
      idx: cr.idx,
      title: cr.title,
      html: `<section class="hb-section hb-chapter" id="chapter-${cr.idx}" data-chapter="${cr.idx + 1}" lang="fr">
  ${buildVnkSectionHeader({
    title: cr.title,
    subtitle: handbookSubtitle,
    date: today,
  })}
  <h1 class="hb-chapter-title">${escapeHtmlSafe(cr.label)}. ${escapeHtmlSafe(cr.title)}</h1>
  <div class="hb-chapter-body">${cleanedHtml}</div>
  ${renderInitialsCartouche()}
</section>`,
    };
  });

  // ── Page finale : Acceptation globale + signature (Demande 4) ─────
  const signaturePageHtml = (() => {
    // Demande 4 : une seule case "J'ai lu" finale. On accepte les deux noms
    // (finalRead = priorite, globalAccepted = retro-compat).
    const finalRead = opts.finalRead ?? opts.globalAccepted ?? false;
    const finalInitials = (opts.finalInitials ?? "").trim();
    const globalAccepted = opts.globalAccepted ?? finalRead;
    const finalReadBox = finalRead
      ? `<span class="hb-checkbox checked" aria-hidden="true"></span>`
      : `<span class="hb-checkbox" aria-hidden="true"></span>`;
    const globalBox = globalAccepted
      ? `<span class="hb-checkbox checked" aria-hidden="true"></span>`
      : `<span class="hb-checkbox" aria-hidden="true"></span>`;
    let signatureBlock = "";
    if (scope !== "none") {
      const dummyAnchors: string[] = [];
      if (scope === "employee_only" || scope === "both") {
        dummyAnchors.push("[Signature employe]");
      }
      if (scope === "employer_only" || scope === "both") {
        dummyAnchors.push("[Signature employeur]");
      }
      const dummy = dummyAnchors.join("\n");
      signatureBlock = preprocessSignatures(
        dummy,
        opts.signature ? { employee: opts.signature } : undefined,
        scope,
      );
    }
    const signedDateFr = opts.signature?.date
      ? (() => {
          const d = opts.signature!.date instanceof Date
            ? opts.signature!.date
            : new Date(opts.signature!.date as string);
          return Number.isFinite(d.getTime())
            ? d.toLocaleDateString("fr-CA", { day: "2-digit", month: "long", year: "numeric" })
            : "__________";
        })()
      : "__________";
    return `<section class="hb-section hb-signature-page" lang="fr">
  ${buildVnkSectionHeader({
    title: "Acceptation finale",
    subtitle: handbookSubtitle,
    date: today,
  })}
  <div class="hb-signature-banner">
    <h1 class="hb-signature-title">Acceptation finale du Manuel</h1>
    <p class="hb-signature-subtitle">Signature et engagement de l'employe</p>
  </div>
  <p class="hb-signature-legal-text">
    Par sa signature ci-dessous, l'employe atteste avoir lu et compris l'ensemble
    du present Manuel de l'employe de ${escapeHtmlSafe(COMPANY.fullName)},
    en accepter integralement les termes, et s'engager a les respecter dans
    le cadre de ses fonctions. Le present document constitue un complement
    aux engagements contractuels existants.
  </p>
  <div class="hb-final-ack">
    <div class="hb-final-ack-stamp">Lu et accepte</div>
    <div class="hb-final-ack-row hb-final-ack-checkbox-row">
      ${finalReadBox}
      <span class="hb-final-ack-checkbox-text">
        J'ai lu et compris l'ensemble du present Manuel de l'employe.
      </span>
    </div>
    <div class="hb-final-ack-meta">
      <div class="hb-final-ack-meta-cell">
        <div class="hb-final-ack-meta-value">${escapeHtmlSafe(signedDateFr)}</div>
        <div class="hb-final-ack-meta-label">Date</div>
      </div>
      <div class="hb-final-ack-meta-cell">
        <div class="hb-final-ack-meta-value hb-final-ack-initials-value">${escapeHtmlSafe(finalInitials || "______")}</div>
        <div class="hb-final-ack-meta-label">Initiales</div>
      </div>
    </div>
  </div>
  ${signatureBlock ? `<div class="hb-signature-area">${signatureBlock}</div>` : ""}
</section>`;
  })();

  const cssBlock = `
  /* Import Google Fonts retire : causait des navigation timeouts sur
     Puppeteer (waitUntil networkidle0 pouvait attendre 30s pour finir
     la requete). Fallback system-ui partout = aspect identique sur
     Windows/Mac. */

  /* CSS Print Level 3 — multi-PDF par section.
     Chaque section (TOC, Introduction, chaque chapitre, Acceptation finale)
     est rendue dans son PROPRE document HTML => PROPRE PDF. La regle
     "@page :first" cible donc bien la 1ere page de la section courante
     (header navy edge-to-edge sans marge superieure), tandis que
     "@page" par defaut gere les pages de continuation (margin-top 16mm
     Word-style). Les PDFs seront ensuite concatenes via pdf-lib. */
  @page {
    size: letter;
    margin: 16mm 0 20mm 0;
  }
  @page :first {
    margin-top: 0;
    margin-bottom: 20mm;
    margin-left: 0;
    margin-right: 0;
  }

  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; background: #fff;
    /* REFONTE 5 : color slate-800 plus doux que noir pur. */
    color: #1e293b;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 11pt; line-height: 1.65;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    font-feature-settings: "kern" 1, "liga" 1, "calt" 1;
    text-rendering: optimizeLegibility;
  }

  /* REFONTE 7 (Mission 4) : sauts de page propres.
     widows/orphans 6 = jamais moins de 6 lignes seules en haut/bas de page
     (force le moteur a repousser PLUS de contenu sur la nouvelle page pour
     eviter "LU ET ACCEPTE" seul). */
  p, li {
    orphans: 6;
    widows: 6;
  }
  /* Blocs solides : ne jamais couper au milieu */
  table, blockquote, .md-quote,
  .hb-final-ack, .hb-signatures-frame, .signatures {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  /* Listes courtes (<= 5 items) : reste ensemble. */
  ul, ol {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  /* Listes longues (>= 6 items) : autoriser la coupure pour eviter les
     longues zones blanches en bas de page. */
  ul:has(> li:nth-child(6)),
  ol:has(> li:nth-child(6)) {
    page-break-inside: auto;
    break-inside: auto;
  }
  /* Titres : jamais separes de leur 1er paragraphe (page-break-after avoid). */
  h2, h3, h4,
  .hb-chapter-title,
  .hb-chapter-body h1,
  .hb-chapter-body h2,
  .hb-chapter-body h3,
  .hb-chapter-body h4 {
    page-break-after: avoid;
    break-after: avoid;
  }
  /* Le premier element apres un titre ne commence jamais une nouvelle page seul. */
  h2 + p, h3 + p, h4 + p,
  h2 + ul, h3 + ul, h2 + ol, h3 + ol,
  .hb-chapter-body h2 + p,
  .hb-chapter-body h2 + ul,
  .hb-chapter-body h2 + ol,
  .hb-chapter-body h3 + p,
  .hb-chapter-body h3 + ul,
  .hb-chapter-body h3 + ol {
    page-break-before: avoid;
    break-before: avoid;
  }
  /* Le bloc final LU ET ACCEPTE ne se coupe et ne commence pas seul. */
  .hb-final-ack {
    page-break-inside: avoid;
    break-inside: avoid;
    page-break-before: avoid;
  }
  /* Cartouche initiales en fin de chapitre : reste TOUJOURS attache au
     dernier element du body (sinon il se retrouve seul en haut d'une page). */
  .hb-page-initials {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    page-break-before: avoid !important;
    break-before: avoid !important;
  }
  /* Le dernier element du body de chapitre (ex: blockquote "Engagement formel")
     reste solidaire du cartouche initiales qui le suit. */
  .hb-chapter-body > *:last-child {
    page-break-after: avoid !important;
    break-after: avoid !important;
  }
  /* Les 2 derniers paragraphes/listes du chapitre restent ensemble pour
     eviter une fin de chapitre type "phrase + LU ET ACCEPTE seuls". */
  .hb-chapter-body > *:nth-last-child(-n+2) {
    page-break-after: avoid;
    break-after: avoid;
  }
  /* Multi-PDF (N PDFs separes mergeés via pdf-lib) : chaque section est
     son propre PDF. Pas besoin de page-break-before — le merge enchaine
     directement les PDFs. Forcer un break ici introduirait une page
     blanche en debut de section. */

  /* ────────── PAGE DE GARDE (reliure navy) ────────── */
  /* La cover est rendue dans un PDF separe avec margin 0 (cf. coverPage.pdf
     ci-dessous) — elle n'a donc aucune contrainte de marge top/bottom du
     pipeline body. La hauteur est libre (le contenu interne se centre via
     flexbox dans .hb-cover-inner). */
  /* Cover pro : bande navy gradient en haut (24mm), titre central
     enorme, encart recipient + coordonnees entreprise en bas.
     Letter = 279mm de haut. Hauteur fixe sans overflow.
     Background light slate pour effet "papier officiel". */
  .hb-cover {
    background: #f8fafc;
    width: 100%;
    /* 100vh = exactement la hauteur de la page letter sans deborder.
       Plus fiable que mm fixe car Chromium ajoute parfois 0.5-1mm de
       tolerance qui pousse sur une 2e page. */
    height: 100vh;
    max-height: 100vh;
    padding: 0;
    margin: 0;
    box-sizing: border-box;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    page-break-after: avoid;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    position: relative;
  }

  /* Header navy gradient edge-to-edge en haut (24mm) */
  .hb-cover-header {
    background: linear-gradient(135deg, #0F2D52 0%, #15406d 50%, #1c4d7e 100%);
    height: 24mm;
    padding: 0 18mm;
    display: flex;
    align-items: center;
    gap: 14px;
    flex-shrink: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .hb-cover-logo-box {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    background: rgba(255, 255, 255, 0.15);
    border: 1.5px solid rgba(255, 255, 255, 0.4);
    color: white;
    font-size: 14pt;
    font-weight: 800;
    letter-spacing: 0.5px;
    border-radius: 8px;
    flex-shrink: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .hb-cover-header-text {
    color: white;
    line-height: 1.2;
  }
  .hb-cover-header-name {
    font-size: 15pt;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: white;
  }
  .hb-cover-header-tagline {
    font-size: 7.5pt;
    letter-spacing: 0.3em;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    margin-top: 4px;
  }

  /* Body : titre + sous-titre + meta centres verticalement */
  .hb-cover-body {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20mm 20mm;
    text-align: center;
    background: #ffffff;
    margin: 10mm 14mm;
    border: 1px solid #e2e8f0;
    overflow: hidden;
  }
  .hb-cover-eyebrow {
    font-size: 9pt;
    color: #0F2D52;
    letter-spacing: 0.35em;
    text-transform: uppercase;
    font-weight: 700;
    margin-bottom: 8mm;
    position: relative;
  }
  .hb-cover-eyebrow::after {
    content: "";
    display: block;
    width: 40px;
    height: 2px;
    background: #0F2D52;
    margin: 8px auto 0;
  }
  .hb-cover-title {
    font-size: 24pt;
    font-weight: 700;
    color: #0F2D52;
    margin: 0 0 12px 0;
    line-height: 1.15;
    letter-spacing: -0.3px;
    max-width: 90%;
  }
  .hb-cover-subtitle {
    font-size: 11pt;
    font-weight: 400;
    color: #475569;
    margin: 0 0 8mm 0;
    line-height: 1.4;
    max-width: 80%;
    font-style: italic;
  }
  .hb-cover-meta {
    display: flex;
    align-items: stretch;
    justify-content: center;
    gap: 24px;
    margin-top: auto;
  }
  .hb-cover-meta-item {
    text-align: center;
  }
  .hb-cover-meta-label {
    font-size: 7.5pt;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    margin-bottom: 4px;
    font-weight: 600;
  }
  .hb-cover-meta-value {
    font-size: 12pt;
    color: #0F2D52;
    font-weight: 600;
  }
  .hb-cover-meta-sep {
    width: 1px;
    background: #e2e8f0;
  }

  /* Footer : encart recipient + coordonnees entreprise sur fond slate */
  .hb-cover-footer {
    flex-shrink: 0;
    padding: 6mm 18mm 10mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5mm;
    background: #f8fafc;
  }
  .hb-cover-recipient-card {
    background: white;
    border: 2px solid #0F2D52;
    border-radius: 6px;
    padding: 10px 32px;
    text-align: center;
    min-width: 280px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .hb-cover-recipient-label {
    font-size: 7.5pt;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .hb-cover-recipient-name {
    font-size: 14pt;
    color: #0F2D52;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .hb-cover-company {
    text-align: center;
    border-top: 1px solid #e2e8f0;
    padding-top: 8mm;
    width: 100%;
    max-width: 380px;
  }
  .hb-cover-company-name {
    font-size: 9.5pt;
    color: #0F2D52;
    font-weight: 600;
    letter-spacing: 0.04em;
  }
  .hb-cover-company-contact {
    font-size: 8pt;
    color: #94a3b8;
    margin-top: 3px;
    letter-spacing: 0.02em;
  }
  .hb-cover-logo-brand {
    font-size: 14pt;
    font-weight: 600;
    color: #0F2D52;
    letter-spacing: -0.01em;
    margin: 0;
  }
  .hb-cover-logo-tagline {
    font-size: 7.5pt;
    letter-spacing: 0.25em;
    color: #64748b;
    margin-top: 4px;
    text-transform: uppercase;
  }
  .hb-cover-brand {
    font-size: 9pt; font-weight: 700; color: #0F2D52;
    letter-spacing: 0.28em; margin-bottom: 12px;
  }
  .hb-cover-rule {
    width: 48px; height: 2px; background: #0F2D52; margin: 0 auto;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .hb-cover-rule.narrow { width: 60px; margin: 16px auto; }
  .hb-cover-middle {
    flex: 1 1 auto;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 24px 0;
  }
  .hb-cover-title {
    font-size: 26pt; font-weight: 700; color: #0F2D52;
    margin: 12px 0 10px; line-height: 1.15; letter-spacing: -0.3px;
    max-width: 90%;
  }
  .hb-cover-subtitle {
    font-size: 12pt; font-weight: 400; color: #64748B;
    margin: 0 0 4px; line-height: 1.35;
    max-width: 80%;
  }
  .hb-cover-version {
    font-size: 11pt; font-weight: 600; color: #0F2D52; margin: 6px 0 2px;
  }
  .hb-cover-date {
    font-size: 9.5pt; color: #64748B; font-style: italic; margin: 0;
  }
  .hb-cover-bottom {
    flex: 0 0 auto;
    display: flex; flex-direction: column; align-items: center; gap: 14px;
  }
  .hb-cover-recipient {
    border-top: 1px solid #E2E8F0; padding-top: 12px;
    display: inline-block;
  }
  .hb-cover-recipient-label {
    font-size: 8pt; color: #94A3B8; text-transform: uppercase;
    letter-spacing: 0.16em; margin-bottom: 3px;
  }
  .hb-cover-recipient-name {
    font-size: 13pt; color: #0F2D52; font-weight: 600;
  }
  .hb-cover-tagline {
    font-size: 7pt; color: #94A3B8; letter-spacing: 0.32em;
    text-transform: uppercase; margin-top: 6px;
  }

  /* ────────── HEADER NAVY INLINE PAR SECTION ──────────
     Bandeau navy gradient rendu UNE FOIS au debut de chaque section
     (TOC, Introduction, chaque chapitre, Acceptation finale). N'apparait
     PAS sur les pages de continuation d'un chapitre long. Compense le
     padding 56px de .hb-section via une marge negative laterale pour
     occuper la pleine largeur du papier (edge-to-edge). */
  .vnk-section-header {
    background: linear-gradient(135deg, #0F2D52 0%, #15406d 100%);
    color: white;
    width: calc(100% + 112px);
    margin: 0 -56px 20px -56px;
    padding: 16px 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-sizing: border-box;
    /* Hauteur AUTO : la bande s'agrandit si le titre prend 2 lignes. */
    min-height: 22mm;
    height: auto;
    page-break-after: avoid;
    break-after: avoid;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .vnk-sh-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .vnk-sh-logo {
    width: 42px;
    height: 42px;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 800;
    font-size: 12pt;
    letter-spacing: 0.5px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .vnk-sh-brand { line-height: 1.2; }
  .vnk-sh-name {
    font-size: 13pt;
    font-weight: 600;
    line-height: 1.2;
    color: white;
  }
  .vnk-sh-tagline {
    font-size: 7pt;
    letter-spacing: 0.2em;
    color: rgba(255, 255, 255, 0.7);
    margin-top: 2px;
    text-transform: uppercase;
  }
  .vnk-sh-right {
    text-align: right;
    max-width: 380px;
    /* Padding-left pour eviter que le titre touche le bloc brand a gauche
       quand il est long. */
    padding-left: 16px;
  }
  /* Titre header : taille reduite + line-height aere pour 2 lignes max
     lisibles sans serrer (cas "Acceptation de la politique de vacances
     annuelles"). */
  .vnk-sh-title {
    font-size: 12pt;
    font-weight: 600;
    color: white;
    line-height: 1.35;
  }
  .vnk-sh-sub {
    font-size: 8.5pt;
    color: rgba(255, 255, 255, 0.75);
    margin-top: 4px;
    line-height: 1.3;
  }
  .vnk-sh-date {
    font-size: 7.5pt;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 2px;
    line-height: 1.3;
  }

  /* ────────── REFONTE 4 : TABLE DES MATIERES EDITORIALE (magazine) ────────── */
  /* Look annual report : padding 80px haut, 64px lateral, titre semibold sans
     border-bottom, petite barre signature 60px navy sous le titre, items avec
     numero encadre 28x28 bg navy 7%, dots radial-gradient slate-300. */
  /* REFONTE : la section TOC est desormais wrappee dans .hb-section qui
     gere son padding lateral 56px et pad-top 0 (le header navy inline est
     edge-to-edge). On garde un padding-bottom genereux pour aerer la liste. */
  .hb-toc {
    padding: 0 0 40px 0;
    background: white;
    /* Pas de page-break-after : la TOC est un PDF distinct, le merge
       enchaine directement avec l'Introduction ou le premier chapitre. */
  }
  .hb-toc-section {
    /* idem : pas de break force, evite page blanche en fin de PDF. */
  }
  .hb-toc-heading {
    font-size: 28pt;
    color: #0F2D52;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin: 0 0 16px 0;
    line-height: 1.15;
    border-bottom: none;
    padding-bottom: 0;
  }
  .hb-toc-rule {
    width: 60px;
    height: 2px;
    background: #0F2D52;
    margin: 0 0 48px 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .hb-toc-hint {
    background: transparent;
    border-left: 3px solid #0F2D52;
    padding: 6px 18px;
    font-size: 10pt;
    color: #64748b;
    margin: 0 0 40px 0;
    font-style: italic;
    line-height: 1.5;
    border-radius: 0;
  }
  .hb-toc-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .hb-toc-list li {
    margin-bottom: 18px;
    /* Un item de TOC ne doit jamais etre coupe au milieu (badge + titre
       solidaires) ni se retrouver seul en haut d'une nouvelle page. */
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .hb-toc-list a {
    display: flex;
    align-items: center;
    gap: 16px;
    text-decoration: none;
    color: #1e293b;
    padding: 6px 4px;
    border-radius: 4px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .hb-toc-list a:hover {
    background: rgba(15, 45, 82, 0.04);
  }
  .hb-toc-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 3px;
    background: rgba(15, 45, 82, 0.07);
    color: #0F2D52;
    font-weight: 700;
    font-size: 9pt;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .hb-toc-title-text {
    flex: 1;
    font-size: 12pt;
    font-weight: 500;
    color: #1e293b;
    line-height: 1.4;
  }
  .hb-toc-dots {
    flex: 0 1 auto;
    min-width: 32px;
    height: 1px;
    background-image: radial-gradient(circle, #cbd5e1 1px, transparent 1px);
    background-size: 4px 1px;
    background-repeat: repeat-x;
    background-position: bottom;
    align-self: flex-end;
    margin-bottom: 6px;
    border-bottom: none;
  }

  /* ────────── SECTIONS CAHIER (header inline en haut) ──────────
     REFONTE : padding-top = 0 car le header navy inline (.vnk-section-header)
     occupe deja la zone superieure et est colle au bord du papier
     (@page margin-top: 0). Padding lateral 56px = "marge Word" cote contenu.
     Padding bas 32px = respiration avant le pied de page. */
  .hb-section {
    padding: 0 56px 32px 56px;
  }
  /* H1 chapitre 26pt navy bold : margin-top 0 car le header Puppeteer
     fournit deja l'espace au-dessus. */
  .hb-chapter-title {
    font-size: 26pt;
    font-weight: 700;
    color: #0F2D52;
    letter-spacing: -0.02em;
    line-height: 1.15;
    margin: 0 0 28px 0;
    padding-bottom: 0;
    border-bottom: none;
    page-break-after: avoid !important;
    break-after: avoid !important;
  }
  /* Solidarite titre+premier paragraphe. */
  .hb-chapter-body {
    page-break-before: avoid !important;
    break-before: avoid !important;
  }
  /* D3 : cartouche initiales en bas de chaque chapitre, sobre et solidaire
     du contenu precedent (ne se retrouve JAMAIS seul en haut d'une page). */
  .hb-page-initials {
    margin-top: 18px;
    padding: 10px 14px;
    border-top: 1px solid #E2E8F0;
    text-align: right;
    font-size: 9.5pt;
    color: #475569;
    page-break-inside: avoid;
    break-inside: avoid;
    page-break-before: avoid !important;
    break-before: avoid !important;
  }
  /* Le bloc qui precede le cartouche initiales doit rester collé */
  .hb-chapter-body > *:last-child {
    page-break-after: avoid;
    break-after: avoid;
  }
  .hb-page-initials-label {
    color: #64748B;
    font-weight: 500;
    margin-right: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 8.5pt;
  }
  .hb-page-initials-value {
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    padding: 2px 14px 4px;
    border-bottom: 1.5px solid #334155;
    min-width: 80px;
    display: inline-block;
  }
  .hb-page-initials-value.filled {
    color: #0F2D52;
    font-size: 12pt;
  }
  .hb-page-initials-value.empty {
    color: #94A3B8;
    font-size: 11pt;
    font-weight: 400;
    border-bottom-style: dashed;
  }
  .hb-chapter-body {
    font-size: 11pt; line-height: 1.75;
  }
  /* Paragraphes : line-height 1.65 + margin 14px pour qu'un chapitre court
     remplisse mieux sa page et evite que "LU ET ACCEPTE" se retrouve seul
     sur la page suivante. */
  .hb-chapter-body p {
    margin: 0 0 14px 0;
    text-align: justify;
    text-justify: inter-word;
    hyphens: auto;
    -webkit-hyphens: auto;
    color: #1e293b;
    line-height: 1.65;
    font-size: 10.5pt;
  }
  /* Premier paragraphe apres un titre : pas de margin-top */
  .hb-chapter-body h1 + p, .hb-chapter-body h2 + p,
  .hb-chapter-body h3 + p, .hb-chapter-body h4 + p {
    margin-top: 0;
  }
  .hb-chapter-body h1 {
    color: #0F2D52;
    font-size: 32pt;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.15;
    margin: 48px 0 32px 0;
    border-bottom: none;
    padding-bottom: 0;
    page-break-after: avoid;
    break-after: avoid;
  }
  /* H2 sections : margins augmentees (22 top / 10 bottom) pour aerer
     suffisamment et eviter les orphelins type "LU ET ACCEPTE seul". */
  .hb-chapter-body h2 {
    font-size: 15pt;
    font-weight: 600;
    color: #0F2D52;
    margin: 22px 0 10px 0;
    line-height: 1.3;
    letter-spacing: -0.01em;
    border-bottom: none;
    padding-bottom: 0;
    page-break-after: avoid;
    break-after: avoid;
  }
  /* H3 : margins augmentees aussi. */
  .hb-chapter-body h3 {
    font-size: 12pt;
    font-weight: 600;
    color: #1e3a5f;
    margin: 16px 0 8px 0;
    line-height: 1.35;
    page-break-after: avoid;
    break-after: avoid;
  }
  .hb-chapter-body h4 {
    font-size: 10.5pt;
    font-weight: 600;
    color: #334155;
    margin: 8px 0 3px 0;
    line-height: 1.35;
    page-break-after: avoid;
    break-after: avoid;
  }
  /* Listes : margins compactes pour eviter qu'une puce reste seule en haut
     de page. line-height aligné sur les paragraphes. */
  .hb-chapter-body ul, .hb-chapter-body ol {
    margin: 8px 0 12px 0;
    padding-left: 24px;
  }
  .hb-chapter-body li {
    margin-bottom: 4px;
    color: #1e293b;
    line-height: 1.7;
  }
  .hb-chapter-body ul li::marker { color: #0F2D52; }
  .hb-chapter-body ol li::marker { color: #0F2D52; font-weight: 600; }
  /* REFONTE 5 : strong semibold 600, couleur heritee (pas de surcharge navy) */
  .hb-chapter-body strong, .hb-chapter-body b {
    font-weight: 600;
    color: inherit;
  }
  .hb-chapter-body em, .hb-chapter-body i {
    font-style: italic;
    color: inherit;
  }
  /* Variables resolues = en gras navy (signature visuelle VNK) */
  .hb-chapter-body .var-resolved {
    font-weight: 600;
    color: #0F2D52;
  }
  /* REFONTE 5 : blockquote citations legales — fond tres subtil, padding genereux */
  .hb-chapter-body blockquote {
    border-left: 3px solid #0F2D52;
    padding: 16px 24px;
    background: rgba(15, 45, 82, 0.03);
    margin: 24px 0;
    color: #334155;
    font-style: normal;
    border-radius: 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .hb-chapter-body blockquote p {
    margin: 4px 0;
    text-align: left;
    hyphens: none;
    line-height: 1.7;
  }
  /* REFONTE 5 : tables grille complete, navy header, padding 12x16 genereux */
  .hb-chapter-body table {
    width: 100%;
    border-collapse: collapse;
    margin: 24px 0;
    font-size: 10.5pt;
    border: 1px solid #CBD5E1;
  }
  .hb-chapter-body table th {
    background: #0F2D52;
    color: #fff;
    padding: 12px 16px;
    text-align: left;
    font-weight: 600;
    font-size: 10.5pt;
    line-height: 1.4;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .hb-chapter-body table td {
    padding: 12px 16px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
    font-size: 10.5pt;
    line-height: 1.6;
  }
  .hb-chapter-body table tr:last-child td { border-bottom: none; }
  /* REFONTE 5 : code inline */
  .hb-chapter-body code {
    background: #f1f5f9;
    padding: 2px 5px;
    border-radius: 2px;
    font-family: 'Menlo', 'Consolas', monospace;
    font-size: 0.92em;
  }
  /* Numerotation hierarchique : span hb-num devant titres */
  .hb-chapter-body .hb-num {
    color: #0F2D52;
    font-weight: 700;
    margin-right: 0.4em;
    letter-spacing: 0.02em;
  }
  .hb-chapter-body h3 .hb-num {
    color: rgba(15, 45, 82, 0.85);
    font-weight: 600;
  }
  /* Listes ordonnees : a, b, c puis decimal puis roman */
  .hb-chapter-body ol { list-style-type: lower-alpha; }
  .hb-chapter-body ol ol { list-style-type: decimal; }
  .hb-chapter-body ol ol ol { list-style-type: lower-roman; }

  /* Demande 5 : checkboxes markdown (- [ ] / - [x]) visibles meme imprime.
     Le renderer marked produit <span class="md-checkbox"> + texte ; on force
     leur visibilite dans le contexte cahier (PDF print-color-adjust). */
  .hb-chapter-body .md-checkbox {
    display: inline-block;
    box-sizing: border-box;
    width: 14px;
    height: 14px;
    border: 2px solid #0F2D52;
    border-radius: 3px;
    background: #ffffff;
    vertical-align: middle;
    margin-right: 6px;
    margin-top: 3px;
    flex: 0 0 14px;
    position: relative;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .hb-chapter-body .md-checkbox.checked {
    background: #0F2D52 !important;
    border-color: #0F2D52 !important;
  }
  .hb-chapter-body .md-checkbox.checked::after {
    content: "";
    position: absolute;
    left: 2.5px;
    top: 0px;
    width: 4px;
    height: 8px;
    border-right: 2px solid #ffffff;
    border-bottom: 2px solid #ffffff;
    transform: rotate(45deg);
  }
  .hb-chapter-body li.md-task {
    list-style: none !important;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 6px 0;
    padding-left: 0;
  }
  .hb-chapter-body li.md-task::marker { content: none; }
  .hb-chapter-body .md-fallback {
    background: #fef3c7;
    border: 1px solid #fbbf24;
    border-radius: 4px;
    padding: 10px 12px;
    font-size: 9pt;
    color: #92400e;
  }
  .hb-chapter-body .md-fallback pre {
    white-space: pre-wrap;
    margin: 0;
    font-family: 'Inter', sans-serif;
  }

  /* ── Bloc J'ai lu en fin de chapitre (DEPRECATED Demande 4 : non utilise) ── */
  .hb-chapter-ack {
    margin-top: 24px;
    padding: 14px 18px;
    border: 1.5px solid #0F2D52;
    border-radius: 6px;
    background: #F8FAFC;
    page-break-inside: avoid;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .hb-ack-line {
    display: flex; align-items: center; gap: 10px;
  }
  .hb-ack-label {
    font-size: 11pt; color: #1E293B;
  }
  .hb-ack-label-strong { font-weight: 600; color: #0F2D52; }
  .hb-ack-initials {
    margin-top: 10px;
    display: flex; align-items: baseline; gap: 12px;
  }
  .hb-ack-initials-label {
    font-size: 10pt; color: #64748B; font-weight: 500;
  }
  .hb-ack-initials-value {
    font-size: 13pt; font-weight: 700; color: #0F2D52;
    border-bottom: 1.5px solid #334155;
    padding: 0 16px 2px;
    min-width: 80px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  /* Checkbox PDF visible meme imprime */
  .hb-checkbox {
    display: inline-block; width: 16px; height: 16px;
    border: 2px solid #0F2D52; border-radius: 3px;
    background: #fff; position: relative;
    flex-shrink: 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .hb-checkbox.checked {
    background: #0F2D52 !important;
  }
  .hb-checkbox.checked::after {
    content: ""; position: absolute;
    left: 3px; top: 0px; width: 5px; height: 9px;
    border-right: 2.5px solid #fff;
    border-bottom: 2.5px solid #fff;
    transform: rotate(45deg);
  }

  /* ────────── Page Acceptation finale (theme navy VNK) ──────────
     REFONTE : padding-top = 0 car le header navy inline est en haut.
     Le banner navy "Acceptation finale du Manuel" reste edge-to-edge
     via sa propre marge negative. */
  .hb-signature-page {
    padding: 0 56px 24px 56px;
  }
  /* Tout le contenu de la page acceptation reste solidaire pour eviter
     les debordements sur 2 pages (banner + texte + encart + signature). */
  .hb-signature-page > .hb-signature-banner,
  .hb-signature-page > .hb-signature-legal-text,
  .hb-signature-page > .hb-final-ack,
  .hb-signature-page > .hb-signature-area {
    page-break-inside: avoid;
    break-inside: avoid;
    page-break-after: avoid;
    break-after: avoid;
  }
  /* Banniere navy gradient edge-to-edge sous le header VNK — compacte */
  .hb-signature-banner {
    background: linear-gradient(135deg, #0F2D52 0%, #15406d 100%);
    color: white;
    padding: 20px 56px;
    margin: 0 -56px 24px -56px;
    text-align: center;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .hb-signature-title {
    font-size: 20pt;
    font-weight: 700;
    margin: 0;
    letter-spacing: -0.01em;
    color: white;
    line-height: 1.2;
  }
  .hb-signature-subtitle {
    font-size: 10pt;
    opacity: 0.85;
    margin: 4px 0 0 0;
    color: white;
    font-weight: 400;
    letter-spacing: 0.01em;
  }
  /* Texte legal : 10.5pt compact pour tenir avec signature sur 1 page */
  .hb-signature-legal-text {
    max-width: 600px;
    margin: 0 auto 24px auto;
    text-align: center;
    line-height: 1.55;
    font-size: 10.5pt;
    color: #334155;
  }
  /* Encart "LU ET ACCEPTE" : compact pour cohabiter avec signature pad */
  .hb-final-ack {
    margin: 24px auto;
    max-width: 580px;
    padding: 24px 32px;
    border: 2px solid #0F2D52;
    border-radius: 8px;
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    page-break-inside: avoid;
    break-inside: avoid;
    page-break-before: avoid;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  /* Stamp "LU ET ACCEPTÉ" centre, uppercase, navy bold */
  .hb-final-ack-stamp {
    font-size: 11.5pt;
    font-weight: 700;
    color: #0F2D52;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    text-align: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e2e8f0;
  }
  /* Ligne case "J'ai lu et compris..." */
  .hb-final-ack-checkbox-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 16px;
    padding: 4px 0;
  }
  .hb-final-ack-checkbox-text {
    font-size: 10.5pt;
    color: #1e293b;
    line-height: 1.5;
    flex: 1;
  }
  /* Date + Initiales sur une ligne avec gap compact */
  .hb-final-ack-meta {
    display: flex;
    justify-content: space-between;
    gap: 48px;
    margin: 12px 0 0 0;
    padding-top: 12px;
  }
  .hb-final-ack-meta-cell {
    flex: 1;
    text-align: center;
  }
  .hb-final-ack-meta-value {
    font-size: 11pt;
    color: #0F2D52;
    font-weight: 600;
    border-bottom: 1px solid #0F2D52;
    padding-bottom: 6px;
    min-height: 28px;
  }
  .hb-final-ack-initials-value {
    font-size: 13pt;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    font-weight: 700;
  }
  .hb-final-ack-meta-label {
    font-size: 9pt;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 8px;
    text-align: center;
  }
  /* Acceptation secondaire (engagement enregistre) - subtile sous l'encart */
  .hb-global-ack-secondary {
    margin: 20px auto 0;
    max-width: 580px;
    padding: 10px 16px;
    border-left: 3px solid #0F2D52;
    background: rgba(15, 45, 82, 0.04);
    font-size: 10pt;
    color: #475569;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .hb-signature-area { margin-top: 16px; }
  /* Signatures dans la page Acceptation finale : compactes pour tenir 1 page */
  .hb-signature-page .signatures,
  .hb-signature-area .signatures {
    margin-top: 8px !important;
    padding: 0 !important;
  }
  .hb-signature-page .signatures h2,
  .hb-signature-area .signatures h2,
  .hb-signature-page .signatures > h3,
  .hb-signature-area .signatures > h3 {
    display: none; /* le banner navy au-dessus tient lieu de titre */
  }
  .hb-signature-page .signatures-frame,
  .hb-signature-area .signatures-frame {
    padding: 14px 18px !important;
    margin: 0 !important;
  }
  /* Legacy classes conservees pour compat (au cas ou) */
  .hb-signature-legal {
    font-size: 11pt; color: #1E293B; line-height: 1.7;
    margin: 18px 0;
    padding: 14px 18px;
    background: #F1F5F9;
    border-left: 4px solid #0F2D52;
    border-radius: 0 4px 4px 0;
    text-align: justify;
  }

  /* ── Signatures (re-use du theme) ── */
  .signatures-title {
    font-size: 13pt; font-weight: 600; color: #0F2D52;
    margin: 16px 0 10px;
  }
  .signatures {
    display: table; width: 100%; border-collapse: separate;
    border-spacing: 16px 0; table-layout: fixed;
    page-break-inside: avoid; break-inside: avoid;
  }
  .signature-block {
    display: table-cell; width: 50%; vertical-align: top;
    border: 1px solid #E2E8F0; border-radius: 8px;
    background: #F8FAFC; overflow: hidden;
    page-break-inside: avoid;
  }
  .signature-block .role-badge {
    background: linear-gradient(135deg, #0F2D52 0%, #15406d 100%);
    color: white; padding: 8px 14px; font-size: 8.5pt; font-weight: 700;
    letter-spacing: 1.2px; text-transform: uppercase;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .signature-block .signature-area { padding: 24px 14px 14px; min-height: 110px; }
  .signature-block .sig-line { border-bottom: 1.3px solid #334155; height: 28px; margin-bottom: 4px; }
  .signature-block .sig-row { display: table; width: 100%; margin-top: 14px; border-spacing: 10px 0; }
  .signature-block .sig-cell { display: table-cell; width: 50%; }
  .signature-block .sig-cell .sig-line-short { border-bottom: 1.3px solid #334155; height: 22px; }
  .signature-block .label { font-size: 7pt; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
  .signature-block.signed { background: #fff; border-color: #0F2D52; }
  .signature-block.signed .sig-image-wrap { height: 90px; margin-bottom: 4px; border-bottom: 1.3px solid #334155; display: flex; align-items: flex-end; justify-content: center; padding: 4px 0; }
  .signature-block.signed .sig-image { max-height: 84px; max-width: 100%; height: auto; width: auto; object-fit: contain; }
  .signature-block.signed .sig-value { font-size: 10pt; font-weight: 600; color: #0F2D52; border-bottom: 1.3px solid #334155; padding-bottom: 2px; min-height: 18px; }

  .page-break { page-break-after: always; break-after: page; height: 0; visibility: hidden; }
`;

  // Wrapper HTML/head/body factorise : meme CSS partage entre toutes les
  // sections. Chaque section sera rendue dans son propre PDF via Puppeteer,
  // puis l'ensemble sera concatene avec pdf-lib (cf. renderHandbookHtmlToPdf).
  const htmlWrap = (innerHtml: string) => `<!DOCTYPE html>
<html lang="fr-CA">
<head>
<meta charset="UTF-8">
<title>${escapeHtmlSafe(opts.handbook.title)}</title>
<style>${cssBlock}</style>
</head>
<body>${innerHtml}</body>
</html>`;

  // Compose la liste ordonnee des sections : TOC, Introduction (optionnelle),
  // chacun des N chapitres, puis Acceptation finale.
  const sections: Array<{ name: string; html: string }> = [];
  sections.push({ name: "toc", html: htmlWrap(tocHtml) });
  if (coverIntroHtml) {
    sections.push({ name: "introduction", html: htmlWrap(coverIntroHtml) });
  }
  for (const cs of chapterSectionsHtml) {
    sections.push({
      name: `chapter-${cs.idx + 1}`,
      html: htmlWrap(cs.html),
    });
  }
  sections.push({ name: "acceptance", html: htmlWrap(signaturePageHtml) });

  // OPTIMISATION : bodyHtml = toutes les sections (TOC + intro + chapitres
  // + acceptation) concatenees DANS UN SEUL document HTML wrappe. Permet
  // au renderer de generer 2 PDFs total (cover + body) au lieu de N+1.
  // ~10x plus rapide pour un cahier complet de 40+ chapitres.
  const bodyInner = [
    tocHtml,
    coverIntroHtml ?? "",
    ...chapterSectionsHtml.map((cs) => cs.html),
    signaturePageHtml,
  ].filter(Boolean).join("\n");

  return {
    coverHtml: htmlWrap(coverHtml),
    bodyHtml: htmlWrap(bodyInner),
    sections,
  };
}

/**
 * FIX pagination globale : Puppeteer ne sait pas paginer correctement sur un
 * document MERGE (chaque sous-PDF a son propre compteur `pageNumber`/`totalPages`
 * local). On ajoute donc le footer "Page X / Y" manuellement via pdf-lib APRES
 * la concatenation, en utilisant `merged.getPageCount()` comme total reel.
 *
 * Layout du footer (aligne sur le footerTemplate Puppeteer historique) :
 *   [VNK Automatisation Inc.]   [Manuel de l'employe · vX]   [Page N / Total]
 *   gauche                       centre                       droite
 *
 * La police Helvetica (StandardFonts) est embarquee — pas besoin de fetch
 * Google Fonts. Couleur slate-400 (#94A3B8) pour rester discret.
 *
 * La cover page (page 1) est SKIP : le footer dessine n'apparait qu'a partir
 * de la TOC pour preserver le design du recto.
 */
async function addGlobalFooterToPdf(
  pdfBuffer: Buffer,
  handbookVersion: string,
): Promise<Buffer> {
  const doc = await PDFDocument.load(pdfBuffer);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  // Total des pages numérotées = TOTAL - 1 (la cover page n'est pas comptée).
  // La TOC (vraie page 1 visible) affiche "Page 1 / N" ou N = total - 1.
  const numberablePages = pages.length - 1;

  const fontSize = 8;
  const textColor = rgb(0.58, 0.64, 0.72); // slate-400 (#94A3B8)
  const padX = 40;
  const padY = 28;

  const leftText = "VNK Automatisation Inc.";
  const centerText = `Manuel de l'employe · v${handbookVersion}`;

  pages.forEach((page, i) => {
    const pageNum = i + 1;
    // Skip cover page (page 1) : design dedie sans footer ni pagination.
    if (pageNum === 1) return;

    // Numerotation relative : page 2 du PDF = "Page 1" affichee, page 3 = "Page 2", etc.
    const displayPageNum = pageNum - 1;

    const { width } = page.getSize();
    const rightText = `Page ${displayPageNum} / ${numberablePages}`;

    // Footer gauche
    page.drawText(leftText, {
      x: padX,
      y: padY,
      size: fontSize,
      font,
      color: textColor,
    });

    // Footer centre (centre horizontalement sur la largeur de page)
    const centerWidth = font.widthOfTextAtSize(centerText, fontSize);
    page.drawText(centerText, {
      x: (width - centerWidth) / 2,
      y: padY,
      size: fontSize,
      font,
      color: textColor,
    });

    // Footer droite (aligne sur la marge droite)
    const rightWidth = font.widthOfTextAtSize(rightText, fontSize);
    page.drawText(rightText, {
      x: width - padX - rightWidth,
      y: padY,
      size: fontSize,
      font,
      color: textColor,
    });
  });

  const out = await doc.save();
  return Buffer.from(out);
}

export async function renderHandbookHtmlToPdf(
  opts: HandbookHtmlPdfOptions,
): Promise<Buffer> {
  // REFONTE multi-PDF (Mission 1) :
  //  - 1 PDF pour la cover (sans header navy, marges 0)
  //  - 1 PDF par section logique (TOC, Introduction, chaque chapitre,
  //    Acceptation finale), chacun avec son propre "@page :first" qui
  //    colle le header navy au bord superieur du papier.
  //  - Tous les PDFs sont ensuite concatenes via pdf-lib.
  //
  // Cette approche garantit que la regle `@page :first { margin-top: 0 }`
  // s'applique a la 1ere page de CHAQUE section — ce qui est impossible
  // dans un PDF monolithique car Chromium ne supporte pas correctement
  // les `@page name:first` repetes sur des named pages distincts.
  const { coverHtml, sections } = buildHandbookHtml(opts);

  const browser = await getBrowser();
  if (!browser) {
    // Fallback : on rend chaque chapitre individuellement et on les
    // concatene mentalement. Pour la v1, on renvoie un PDF "page de garde
    // seule" via le pipeline standard si Puppeteer est indispo.
    console.info(
      "[renderHandbookHtmlToPdf] Chromium indispo — fallback PDFKit basique.",
    );
    return renderViaPdfKit({
      bodyMarkdown: opts.chapters
        .map((c) => `# ${c.title}\n\n${c.bodyMarkdown}`)
        .join("\n\n---\n\n"),
      context: opts.context,
      title: opts.handbook.title,
      documentType: "policy",
      metadata: { version: opts.handbook.version },
    });
  }

  // ─────────────────────────────────────────────────────────
  // Le header navy est INLINE dans le body de chaque section
  // (.vnk-section-header) — Puppeteer headerTemplate est donc neutralise
  // par un div vide pour eviter le header par defaut "document title".
  //
  // FIX pagination : le footerTemplate Puppeteer est egalement vide. Chaque
  // section etant rendue dans son propre PDF, les compteurs `pageNumber` /
  // `totalPages` de Chromium sont LOCAUX a chaque PDF (1/3 sur la section
  // Acceptation, 1/5 sur l'Introduction, etc.) — incorrect pour un manuel
  // mergeable. On dessine donc le footer GLOBAL via pdf-lib apres le merge
  // (cf. addGlobalFooterToPdf en aval), ce qui garantit "Page X / Y" sur
  // l'integralite du document final.
  //
  // `displayHeaderFooter: true` est conserve pour que Chromium reserve la
  // marge bottom de 20mm sur chaque page (sinon le contenu se collerait au
  // bord du papier et notre footer pdf-lib chevaucherait le texte).
  // ─────────────────────────────────────────────────────────
  const HEADER_TEMPLATE = `<div></div>`;
  const FOOTER_TEMPLATE = `<div></div>`;

  // Helper : rend UNE section HTML en PDF (Buffer). Encapsule la creation
  // / fermeture de la page Puppeteer et la difference de marges entre la
  // cover (zero marge, pas de header/footer) et les sections (marge bottom
  // pour le footer pagination, marge top a 0 car le header est inline).
  async function renderSectionPdf(
    html: string,
    opts2: { isCover: boolean },
  ): Promise<Buffer> {
    const page = await browser!.newPage();
    try {
      await page.emulateMediaType("print");
      // waitUntil: "domcontentloaded" (au lieu de "networkidle0") : evite
      // d'attendre Google Fonts ou autres ressources externes qui peuvent
      // timeout sur le serveur. La police Inter a un fallback system-ui.
      // Timeout 60s pour les gros chapitres avec beaucoup de contenu.
      await page.setContent(html, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      const buf = await page.pdf({
        format: "letter",
        printBackground: true,
        displayHeaderFooter: !opts2.isCover,
        headerTemplate: opts2.isCover ? undefined : HEADER_TEMPLATE,
        footerTemplate: opts2.isCover ? undefined : FOOTER_TEMPLATE,
        margin: {
          // top: 0 sur TOUTES les sections — le @page :first du CSS pousse
          // le header navy edge-to-edge sur la 1ere page, et @page (defaut)
          // applique 16mm de marge top sur les pages de continuation.
          top: "0",
          bottom: opts2.isCover ? "0" : "20mm",
          left: "0",
          right: "0",
        },
        // Outline + tagged : panneau Signets repliable + accessibilite.
        outline: true,
        tagged: true,
      } as Parameters<typeof page.pdf>[0]);
      return Buffer.from(buf);
    } finally {
      try {
        await page.close();
      } catch {
        /* noop */
      }
    }
  }

  try {
    // Multi-PDF : un PDF par section. Chaque section beneficie de son
    // propre `@page :first` qui place le header navy edge-to-edge. Le
    // merge pdf-lib enchaine les PDFs sans page intermediaire.
    const coverPdf = await renderSectionPdf(coverHtml, { isCover: true });
    const sectionPdfs: Buffer[] = [];
    for (const sec of sections) {
      sectionPdfs.push(
        await renderSectionPdf(sec.html, { isCover: false }),
      );
    }

    // ─── Merge cover + toutes les sections via pdf-lib ──────
    const merged = await PDFDocument.create();
    const allPdfs = [coverPdf, ...sectionPdfs];
    for (const buf of allPdfs) {
      const doc = await PDFDocument.load(buf);
      const copied = await merged.copyPages(doc, doc.getPageIndices());
      copied.forEach((p) => merged.addPage(p));
    }

    const mergedBytes = await merged.save();
    // FIX pagination globale : on dessine le footer "Page X / Y" sur CHAQUE
    // page (sauf cover) en utilisant le total reel post-merge (pdf-lib).
    // Sans ce passage, chaque sous-PDF afficherait sa propre pagination locale
    // (ex: "1/3" sur Acceptation alors que le cahier complet fait 82 pages).
    const withFooter = await addGlobalFooterToPdf(
      Buffer.from(mergedBytes),
      opts.handbook.version,
    );
    return withFooter;
  } catch (e) {
    console.error(
      "[renderHandbookHtmlToPdf] echec Puppeteer, fallback PDFKit :",
      (e as Error)?.message ?? e,
    );
    return renderViaPdfKit({
      bodyMarkdown: opts.chapters
        .map((c) => `# ${c.title}\n\n${c.bodyMarkdown}`)
        .join("\n\n---\n\n"),
      context: opts.context,
      title: opts.handbook.title,
      documentType: "policy",
      metadata: { version: opts.handbook.version },
    });
  }
}

// ─────────────────────────────────────────────────────────
// Cleanup au shutdown (Next.js dev hot-reload + Railway)
// ─────────────────────────────────────────────────────────
if (typeof process !== "undefined" && !browserUnavailable) {
  const cleanup = async () => {
    try {
      const b = browserPromise ? await browserPromise : null;
      await b?.close();
    } catch {
      /* noop */
    }
  };
  const g = globalThis as Record<string, unknown>;
  if (!g["__vnkPdfRendererCleanupRegistered"]) {
    g["__vnkPdfRendererCleanupRegistered"] = true;
    process.on("SIGTERM", () => void cleanup());
    process.on("beforeExit", () => void cleanup());
  }
}
