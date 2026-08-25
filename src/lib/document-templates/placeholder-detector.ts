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
 * Metadonnees enrichies pour un placeholder : key + label lisible + hint
 * contextuel (texte qui precede le `[CHAMP]` dans le markdown) + placeholder
 * UI pour l'input.
 */
export interface PlaceholderInfo {
  /** Cle brute du placeholder (`[A COMPLETER]` -> "A COMPLETER"). */
  key: string;
  /** Label lisible deduit de la cle (capitalisation propre). */
  label: string;
  /**
   * Hint contextuel = jusqu'a ~60 chars de texte qui precede le placeholder
   * dans le markdown. Ex. : `"Numero de membre : [A COMPLETER]"` -> hint
   * "Numero de membre :". Aide le RH a comprendre ce qu'il doit saisir.
   */
  hint: string;
  /** Type devine du champ (date / texte / nombre / fait). */
  type: "date" | "text" | "number" | "fact" | "subject";
  /** Suggestion d'input placeholder. */
  inputPlaceholder: string;
  /**
   * Qui doit remplir le champ ?
   *   - "hr" (defaut) : ressources humaines au moment de la demande
   *     (faits, dates, sujets, donnees employeur connues du RH)
   *   - "employee" : l'employe lui-meme au moment de la signature
   *     (numero de membre d'ordre professionnel, permis, infos perso pro
   *     que seul l'employe connait)
   */
  fillBy: "hr" | "employee";
  /**
   * Champ obligatoire ? Par defaut true (le doc final aurait l'ancre visible
   * si non rempli). Patterns qui forcent `false` :
   *   - Label contient "si applicable", "facultatif", "optionnel"
   *   - "Fait N" avec N >= 2 (premier fait obligatoire, suivants optionnels)
   *   - "Detail N" avec N >= 2 (idem)
   *
   * Quand un champ optionnel est laisse vide, la ligne entiere du placeholder
   * (avec son bullet de liste) est SUPPRIMEE du PDF final, pour eviter de
   * polluer le document avec "[Fait 2 — date]" non rempli.
   */
  required: boolean;
}

/**
 * Detecte si un placeholder est optionnel. Pattern:
 *   - "Fait N" avec N>=2  (Fait 1 reste obligatoire comme "au moins un fait")
 *   - "Detail N" avec N>=2
 *   - Label contient "si applicable", "facultatif", "optionnel", "si pertinent"
 */
function detectOptional(raw: string): boolean {
  const normalized = stripAccents(raw).toLowerCase();
  // "Fait 2", "Fait 3", "Detail 2", etc.
  const numberedMatch = normalized.match(/^(?:fait|detail|element|exemple|cas)\s*(\d+)/);
  if (numberedMatch && parseInt(numberedMatch[1], 10) >= 2) return true;
  // Markers explicites d'optionnel
  if (/si\s+applicable|facultatif|optionnel|si\s+pertinent|au\s+besoin/.test(normalized)) {
    return true;
  }
  return false;
}

/**
 * Detecte si un placeholder doit etre rempli par l'employe plutot que le RH.
 * Patterns : numero de membre, numero d'ordre professionnel, permis, licence,
 * carte professionnelle, certifications individuelles.
 *
 * Le RH ne connait pas ces valeurs (info personnelle de l'employe).
 */
function detectFillBy(keyAndHint: string): "hr" | "employee" {
  const normalized = stripAccents(keyAndHint.toLowerCase());
  // Patterns infos personnelles professionnelles -> employe
  const employeePatterns = [
    /num[eo]ro?\s+de\s+membre/,
    /num[eo]ro?\s+d['e]?\s*ordre/,
    /num[eo]ro?\s+de\s+permis/,
    /num[eo]ro?\s+de\s+licence/,
    /num[eo]ro?\s+de\s+certificat/,
    /num[eo]ro?\s+d['e]?\s*identifiant\s+professionnel/,
    /num[eo]ro?\s+de\s+carte\s+professionnelle/,
    /\b(no|n)\.?\s+de\s+membre/,
    /\bmembre\b.*\boiq\b/,
    /\bmembre\b.*\bcpa\b/,
    /\bmembre\b.*\boacIq\b/,
    /\bcarte\s+professionnelle/,
    /\bbreveet\s+oqlf/,
    /id\s+professionnel/,
  ];
  for (const re of employeePatterns) {
    if (re.test(normalized)) return "employee";
  }
  return "hr";
}

/**
 * Cles "generiques" qui ne donnent aucune info utile au RH. Si on detecte
 * ces patterns, on derive le label du contexte environnant a la place.
 *
 * Normalisation Unicode : on strip les accents AVANT de tester (sinon
 * "COMPLÉTER" ne matche pas "completer"). NFD + remove combining marks.
 */
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const GENERIC_KEY_RE = /^(?:a\s*(?:completer|completar|definir|preciser|fournir|remplir|specifier)|champ|valeur|info|xxx+|todo|tbd|to do)\b/i;

function isGenericKey(raw: string): boolean {
  return GENERIC_KEY_RE.test(stripAccents(raw));
}

/** Capitalise la premiere lettre, conserve le reste tel quel (preserve accents). */
function capitalizeFirst(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Detection enrichie : pour chaque placeholder, extrait le contexte
 * environnant pour aider le RH a comprendre ce qu'il doit saisir.
 *
 * Le label est devine intelligemment :
 *   - Si la cle est descriptive (`Date debut`, `Numero de membre`) -> utilisee
 *   - Si la cle est generique (`À COMPLÉTER`, `CHAMP`, `XXX`) -> on derive le
 *     label du texte contextuel qui precede le placeholder.
 */
export function detectPlaceholdersWithInfo(markdown: string): PlaceholderInfo[] {
  if (!markdown) return [];
  const seenKeys = new Set<string>();
  const out: PlaceholderInfo[] = [];

  const text = String(markdown);
  let m: RegExpExecArray | null;
  const re = new RegExp(PLACEHOLDER_RE.source, "g");

  while ((m = re.exec(text)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    if (SIGNATURE_RE.test(raw)) continue;
    if (CHECKBOX_RE.test(raw)) continue;
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 2);
    if (MD_LINK_RE.test(`]${after}`)) continue;
    if (seenKeys.has(raw)) continue;
    seenKeys.add(raw);

    // ── Hint contextuel : extrait court qui precede le placeholder.
    // Seulement affiche si vraiment informatif (>= 4 chars utiles, non
    // limite a un bullet de liste, etc.). Sinon on retourne "" pour cacher
    // le hint dans l'UI (cas Fait 2 / Fait 3 ou il n'y a que `- ` avant).
    const lookbackStart = Math.max(0, m.index - 100);
    const before = text.slice(lookbackStart, m.index);
    const lastBreak = Math.max(
      before.lastIndexOf("\n"),
      before.lastIndexOf(". "),
    );
    let hintRaw = lastBreak >= 0 ? before.slice(lastBreak + 1) : before;
    hintRaw = hintRaw
      .replace(/\*\*/g, "")
      .replace(/[*_`#>]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    // Retire les bullets de liste residuels (`- `, `* `, `1. `, etc.)
    hintRaw = hintRaw.replace(/^[-*+]\s+/, "").replace(/^\d+[.)]\s+/, "").trim();
    // Si le hint est trop court / vide / juste de la ponctuation : pas de hint
    const hintInformative = hintRaw.length >= 4 && /[a-zA-ZÀ-ÿ]/.test(hintRaw);
    const hint = !hintInformative
      ? ""
      : hintRaw.length > 80
        ? "…" + hintRaw.slice(hintRaw.length - 78)
        : hintRaw;

    // ── Devine le type (date / fait / sujet / nombre / texte)
    const keyLower = raw.toLowerCase();
    let type: PlaceholderInfo["type"] = "text";
    if (/^date\b|date du|date de/i.test(raw)) type = "date";
    else if (/^fait\s*\d+|^fait \d/i.test(raw)) type = "fact";
    else if (/sujet|objet/i.test(keyLower)) type = "subject";
    else if (/num[eé]ro|montant|salaire|taux|heures|pourcentage|\$|€/i.test(keyLower)) type = "number";

    // ── Label intelligent
    // 1. Si la cle est generique (À COMPLÉTER, CHAMP, XXX…), derive du contexte
    // 2. Sinon, capitalize proprement la cle
    let label = capitalizeFirst(raw.toLowerCase());

    if (isGenericKey(raw)) {
      // Extrait le "sujet" de la phrase avant le placeholder
      // Ex. "Membre en regle de l'Ordre des CPA, numero de membre :" -> "Numero de membre"
      // Strategie : prend les 4-6 derniers mots significatifs avant le ` :`
      let derived = hintRaw;
      // Retire la ponctuation finale (:, -, etc.)
      derived = derived.replace(/[\s:;,\-—–]+$/g, "").trim();
      // Garde les 6 derniers mots
      const words = derived.split(/\s+/).filter(Boolean);
      const lastWords = words.slice(-6).join(" ");
      if (lastWords.length >= 3) {
        // Detection de subject markers ("Objet :", "Sujet :", "Concernant :")
        const subjectMatch = lastWords.match(/(?:objet|sujet|concernant|au sujet de|relatif a|du)\s*:?\s*(.+)$/i);
        if (subjectMatch && subjectMatch[1]) {
          label = capitalizeFirst(subjectMatch[1].trim());
        } else {
          label = capitalizeFirst(lastWords);
        }
      } else if (type === "date") {
        label = "Date";
      } else if (type === "subject") {
        label = "Sujet";
      } else if (type === "number") {
        label = "Numéro";
      } else {
        label = "Valeur";
      }
    }

    // ── Input placeholder selon type / label devine
    const inputPlaceholder = (() => {
      if (type === "date") return "ex. 27 mai 2026";
      if (type === "fact") return "ex. 15 mars — retard répété aux réunions matinales";
      if (type === "subject") return "ex. Retards répétés et manque de ponctualité";
      if (/num[eé]ro/i.test(label)) return "ex. 12345";
      if (/membre/i.test(label)) return "ex. 12345 (numéro d'ordre professionnel)";
      return `Saisir « ${label} »`;
    })();

    // ── Detection RH ou employe (info personnelle pro -> employe)
    const fillBy = detectFillBy(`${raw} ${hint}`);

    // ── Detection optionnel (Fait 2/3, "si applicable"…)
    const required = !detectOptional(raw);

    out.push({ key: raw, label, hint, type, inputPlaceholder, fillBy, required });
  }

  return out;
}

/**
 * Echappe une valeur NON FIABLE (saisie par l'employe) avant insertion dans
 * le markdown rendu en PDF : neutralise le HTML brut et la syntaxe markdown
 * (images, liens, titres, emphase, tables...) pour que la valeur apparaisse
 * comme texte litteral — impossible d'alterer la mise en page, le theme ou
 * d'injecter du contenu dans le document final.
 * (Les valeurs RH ne passent PAS par ici : le RH est fiable et peut vouloir
 * du markdown dans ses champs.)
 */
export function escapeUntrustedInlineValue(v: string): string {
  return v
    .replace(/[\x00-\x1f\x7f]/g, " ")
    // Backticks : le pipeline PDF les strip de toute facon ; on remplace par
    // apostrophe pour eviter un backslash orphelin apres le strip.
    .replace(/`/g, "'")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Backslash-escape la ponctuation markdown (CommonMark rend le caractere
    // litteral). Inclut `_` : une valeur contenant `___` ne matchera plus la
    // detection fill-line (pas de decalage d'index fill_X).
    .replace(/([\\*_{}[\]()#+\-!|~])/g, "\\$1");
}

/**
 * Substitue chaque `[KEY]` du markdown par sa valeur correspondante.
 * Si une clef n'a pas de valeur fournie, on laisse l'ancre intacte
 * (le RH n'a pas rempli ce champ — il sera mis en evidence dans le PDF).
 *
 * Si la valeur est explicitement une chaine VIDE (`""`), on substitue par
 * vide ET on supprime la ligne entiere du markdown si elle ne contenait que
 * ce placeholder dans un bullet de liste. Ca permet de supprimer un "Fait 2"
 * optionnel non rempli sans laisser de bullet vide dans le PDF.
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

  let result = markdown.replace(PLACEHOLDER_RE, (match, raw: string, offset: number) => {
    const key = raw.trim();
    if (!key) return match;
    if (SIGNATURE_RE.test(key)) return match;
    if (CHECKBOX_RE.test(key)) return match;
    // Lien markdown : on regarde ce qui suit l'ancre
    const after = markdown.slice(offset + match.length, offset + match.length + 2);
    if (MD_LINK_RE.test(`]${after}`)) return match;

    // Cle absente du payload -> on laisse l'ancre (champ non touche par le RH)
    if (!(key in values)) return match;
    const v = values[key];
    if (v === undefined || v === null) return match;
    return String(v); // ""  = substitution vide (sera nettoye plus bas)
  });

  // Nettoyage : supprime les lignes qui ne contiennent plus qu'un bullet
  // de liste vide (resultat d'un placeholder optionnel non rempli).
  // Pattern : `^\s*[-*+]\s*$` (bullet seul, eventuellement avec whitespace)
  result = result.replace(/^[ \t]*[-*+][ \t]*$/gm, "");
  // Compacte les sequences de lignes vides creees par les suppressions
  result = result.replace(/\n{3,}/g, "\n\n");
  return result;
}
