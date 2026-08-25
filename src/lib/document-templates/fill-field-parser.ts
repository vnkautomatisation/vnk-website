// ─────────────────────────────────────────────────────────
// Parser pour les templates "long form" (formulaires longs)
// ─────────────────────────────────────────────────────────
// Detecte automatiquement les champs `_____` dans un markdown
// avec leur contexte (section H2 + sous-section H3 + label deduit).
//
// Ces champs sont remplis par l'admin (ou l'employe) via un
// wizard generique, puis substitues dans le PDF final.
//
// Convention : on detecte les sequences de 3+ underscores
// (`___`, `_____`, `__________`, etc.). Le seed utilise typiquement
// `___________` (10 underscores) pour materialiser une ligne a remplir.
//
// EXEMPLE :
//   ## EVALUATION A 30 JOURS
//   **Date :** ___________            -> { section:"...", label:"Date", multiline:false }
//   ### Forces observees
//   - ___________                     -> { section:"...", subsection:"Forces observees", label:"Element 1", multiline:false }
//   - ___________                     -> { ... label:"Element 2" }
//   **Notes :**
//   ___________                       -> { section:"...", label:"Notes", multiline:true }
// ─────────────────────────────────────────────────────────

export type FillFieldKind = "text" | "longtext" | "list_item";

export type FillField = {
  /** Index sequentiel d'apparition dans le markdown. Cle stable pour la substitution. */
  index: number;
  /** Titre H2 le plus recent (vide si pas encore vu). */
  section: string;
  /** Titre H3 le plus recent dans la section courante (vide si aucun). */
  subsection: string;
  /** Label deduit du contexte (texte avant `___` sur la meme ligne, ou ligne precedente). */
  label: string;
  /** "text" = champ court une ligne. "longtext" = textarea multi-lignes. "list_item" = item de liste. */
  kind: FillFieldKind;
  /** Numero d'ordre dans la sous-section (utile pour les listes "Forces observees" / "Defis a surveiller"). */
  orderInGroup: number;
};

export type FillFieldStructure = {
  fields: FillField[];
  /** Nombre total de champs detectes. */
  count: number;
  /** Sections regroupees pour l'UI wizard. */
  groups: FillFieldGroup[];
};

export type FillFieldGroup = {
  section: string;
  subsections: FillFieldSubgroup[];
};

export type FillFieldSubgroup = {
  /** Vide si les champs sont directement sous la section (pas de H3). */
  subsection: string;
  fields: FillField[];
};

// Regex utilises
const H2_RE = /^##\s+(.+?)\s*$/;
const H3_RE = /^###\s+(.+?)\s*$/;
// Au moins 3 underscores = ligne a remplir.
const FILL_RE = /_{3,}/;
// Capture le texte AVANT le `___` sur la meme ligne (eventuel label "X :").
const INLINE_LABEL_RE = /^(.*?)[:：]\s*_{3,}\s*$/;
// Detecte un item de liste a puces (`- ` ou `* ` ou `+ `, avec ou sans checkbox).
const LIST_ITEM_RE = /^(\s*)([-*+])(?:\s+\[[ xX]\])?\s+(.*)$/;
// Detecte un item de liste numerotee (`1. `, `2. `, etc.).
const NUMBERED_ITEM_RE = /^(\s*)(\d+)\.\s+(.*)$/;

/**
 * Nettoie un label brut (retire markdown bold/italic, underscores leading,
 * caracteres de ponctuation isoles).
 */
function cleanLabel(raw: string): string {
  return raw
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/[*_]+/g, "")
    .replace(/^[\s\-:•·]+|[\s\-:]+$/g, "")
    .trim();
}

/**
 * Detecte tous les champs `_____` dans un markdown avec leur contexte.
 *
 * Strategie :
 *   - Parcourt ligne par ligne.
 *   - Maintient `currentSection` (dernier H2) et `currentSubsection` (dernier H3).
 *   - Pour chaque ligne contenant `_____` :
 *     - Si la ligne match `Label : _____` -> label inline, kind=text.
 *     - Si la ligne est un item de liste `- _____` (sans label) -> kind=list_item,
 *       label = "Element N" dans la sous-section.
 *     - Si la ligne est juste `_____` (sans label) ET que la ligne precedente
 *       finit par `:` (genre "**Notes :**") -> label = ligne precedente nettoyee,
 *       kind=longtext.
 *     - Sinon -> label = "" ou "Champ N", kind=text.
 */
export function parseFillFields(markdown: string): FillFieldStructure {
  if (!markdown) {
    return { fields: [], count: 0, groups: [] };
  }

  const lines = markdown.split("\n");
  const fields: FillField[] = [];
  let currentSection = "";
  let currentSubsection = "";
  // Compteur par (section + subsection) pour numeroter les list_items.
  const groupCounters = new Map<string, number>();
  // Compteur global d'index (sequence d'apparition).
  let globalIndex = 0;

  const incrGroupCounter = (sec: string, sub: string): number => {
    const k = `${sec}|||${sub}`;
    const next = (groupCounters.get(k) ?? 0) + 1;
    groupCounters.set(k, next);
    return next;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // H2 -> nouvelle section, reset subsection.
    const h2 = line.match(H2_RE);
    if (h2) {
      currentSection = cleanLabel(h2[1]);
      currentSubsection = "";
      continue;
    }
    // H3 -> nouvelle sous-section.
    const h3 = line.match(H3_RE);
    if (h3) {
      currentSubsection = cleanLabel(h3[1]);
      continue;
    }

    // Ligne sans `___` -> rien a faire.
    if (!FILL_RE.test(line)) continue;

    // Cas 1 : "Label : _____" inline (avec eventuel **bold**, `- `, etc.).
    const inline = trimmed.match(INLINE_LABEL_RE);
    if (inline && inline[1].trim()) {
      const label = cleanLabel(inline[1]);
      const isListItem = LIST_ITEM_RE.test(line) || NUMBERED_ITEM_RE.test(line);
      fields.push({
        index: globalIndex++,
        section: currentSection,
        subsection: currentSubsection,
        label: label || `Champ ${globalIndex}`,
        kind: isListItem ? "text" : "text",
        orderInGroup: incrGroupCounter(currentSection, currentSubsection),
      });
      continue;
    }

    // Cas 2 : Item de liste sans label "  - _____".
    const listItem = line.match(LIST_ITEM_RE);
    if (listItem) {
      const content = listItem[3] ?? "";
      // Si le content est juste "___" sans contexte, on numerote dans le groupe.
      if (/^_{3,}\s*$/.test(content.trim())) {
        const order = incrGroupCounter(currentSection, currentSubsection);
        const inferredLabel = currentSubsection
          ? `${currentSubsection} — element ${order}`
          : `Element ${order}`;
        fields.push({
          index: globalIndex++,
          section: currentSection,
          subsection: currentSubsection,
          label: inferredLabel,
          kind: "list_item",
          orderInGroup: order,
        });
        continue;
      }
      // Cas mixte "  - texte avec _____ au milieu" -> on traite comme inline.
      const partialLabel = cleanLabel(content.replace(/_{3,}.*$/, ""));
      const order = incrGroupCounter(currentSection, currentSubsection);
      fields.push({
        index: globalIndex++,
        section: currentSection,
        subsection: currentSubsection,
        label: partialLabel || `Element ${order}`,
        kind: "text",
        orderInGroup: order,
      });
      continue;
    }

    // Cas 3 : Item numerote "1. _____".
    const numbered = line.match(NUMBERED_ITEM_RE);
    if (numbered) {
      const content = numbered[3] ?? "";
      if (/^_{3,}\s*$/.test(content.trim())) {
        const order = incrGroupCounter(currentSection, currentSubsection);
        const inferredLabel = currentSubsection
          ? `${currentSubsection} — objectif ${order}`
          : `Objectif ${order}`;
        fields.push({
          index: globalIndex++,
          section: currentSection,
          subsection: currentSubsection,
          label: inferredLabel,
          kind: "list_item",
          orderInGroup: order,
        });
        continue;
      }
      const partialLabel = cleanLabel(content.replace(/_{3,}.*$/, ""));
      const order = incrGroupCounter(currentSection, currentSubsection);
      fields.push({
        index: globalIndex++,
        section: currentSection,
        subsection: currentSubsection,
        label: partialLabel || `Objectif ${order}`,
        kind: "text",
        orderInGroup: order,
      });
      continue;
    }

    // Cas 4 : Ligne purement `_____` (textarea libre). On regarde la ligne
    // precedente non vide pour deduire un label (typiquement "**Notes :**").
    if (/^_{3,}\s*$/.test(trimmed)) {
      let prevLabel = "";
      for (let j = i - 1; j >= 0; j--) {
        const prev = lines[j].trim();
        if (!prev) continue;
        // Si la ligne precedente finit par `:`, c'est probablement un label.
        if (/[:：]\s*$/.test(prev)) {
          prevLabel = cleanLabel(prev.replace(/[:：]\s*$/, ""));
        } else if (/^[*_#-]/.test(prev)) {
          // ligne markup precedente sans `:` -> on garde label vide
          prevLabel = cleanLabel(prev);
        }
        break;
      }
      const order = incrGroupCounter(currentSection, currentSubsection);
      fields.push({
        index: globalIndex++,
        section: currentSection,
        subsection: currentSubsection,
        label: prevLabel || `Bloc libre ${order}`,
        kind: "longtext",
        orderInGroup: order,
      });
      continue;
    }

    // Cas 5 : ligne contenant `___` ailleurs (rare). On traite comme text.
    const order = incrGroupCounter(currentSection, currentSubsection);
    fields.push({
      index: globalIndex++,
      section: currentSection,
      subsection: currentSubsection,
      label: `Champ ${order}`,
      kind: "text",
      orderInGroup: order,
    });
  }

  return {
    fields,
    count: fields.length,
    groups: groupByStructure(fields),
  };
}

function groupByStructure(fields: FillField[]): FillFieldGroup[] {
  const groups = new Map<string, Map<string, FillField[]>>();
  for (const f of fields) {
    if (!groups.has(f.section)) groups.set(f.section, new Map());
    const subs = groups.get(f.section)!;
    if (!subs.has(f.subsection)) subs.set(f.subsection, []);
    subs.get(f.subsection)!.push(f);
  }
  const result: FillFieldGroup[] = [];
  for (const [section, subs] of groups) {
    const subsections: FillFieldSubgroup[] = [];
    for (const [subsection, fs] of subs) {
      subsections.push({ subsection, fields: fs });
    }
    result.push({ section, subsections });
  }
  return result;
}

/**
 * Substitue les `_____` du markdown par les valeurs saisies dans le wizard.
 * Convention : on remplace SEQUENTIELLEMENT chaque sequence `___+` par la
 * valeur `values[i]` (i = index d'apparition, base 0). Si pas de valeur,
 * on laisse le marqueur original (transforme en `<span class="fill-line">`
 * par le pipeline PDF).
 *
 * Cle des valeurs : "fill_0", "fill_1", "fill_2", ... (match avec FillField.index).
 */
export function applyFillFieldValues(
  markdown: string,
  values: Record<string, string> | undefined | null,
): string {
  if (!markdown) return markdown;
  if (!values || Object.keys(values).length === 0) return markdown;

  let counter = 0;
  return markdown.replace(/_{3,}/g, () => {
    const key = `fill_${counter++}`;
    const value = values[key];
    if (typeof value !== "string" || value.trim() === "") {
      // Pas de valeur saisie -> on laisse les underscores tels quels
      // (seront convertis en `<span class="fill-line">` dans le PDF).
      return "___________";
    }
    // Echappe les caracteres markdown qui pourraient casser le rendu.
    // On encadre dans `<span class="filled">` pour styliser la valeur saisie.
    return `<span class="filled-field">${escapeForMarkdown(value)}</span>`;
  });
}

function escapeForMarkdown(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Determine si un template doit utiliser le wizard "long form" plutot que
 * le dialog "Compléter les champs" standard.
 *
 * Seuil : 5+ champs `___` detectes = considere comme "long form".
 */
export function isLongFormTemplate(markdown: string): boolean {
  if (!markdown) return false;
  const matches = markdown.match(/_{3,}/g);
  return (matches?.length ?? 0) >= 5;
}
