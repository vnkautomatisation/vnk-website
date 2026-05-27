// ─────────────────────────────────────────────────────────
// variable-detector.ts
//
// Detection heuristique de valeurs litterales dans un texte
// "humain" (contrat, lettre, politique...) qui devraient
// idealement etre remplacees par des variables {{...}} du
// registre VNK (voir variable-registry.ts).
//
// Approche : passes regex multiples, par categorie, avec
// score de confiance et alternatives. Les detections se
// chevauchant sont resolues en faveur de la plus haute
// confiance (puis du match le plus long).
//
// Aucune dependance externe : fonctionne cote client ou
// serveur.
// ─────────────────────────────────────────────────────────

export type DetectedCategory =
  | "name"
  | "email"
  | "phone"
  | "address"
  | "salary"
  | "rate"
  | "date"
  | "duration"
  | "percent"
  | "company"
  | "neq"
  | "position"
  | "hours"
  | "other";

export type DetectedVariable = {
  start: number;
  end: number;
  match: string;
  suggestedVariable: string;
  variableLabel: string;
  confidence: number; // 0..1
  category: DetectedCategory;
  alternatives?: string[];
};

// ─── Constantes utilitaires ───────────────────────────────

const QC_AREA_CODES = new Set([
  "514",
  "438",
  "450",
  "579",
  "581",
  "418",
  "873",
  "354",
  "367",
  "819",
]);

const MONTHS_FR =
  "(?:janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)";

const NAME_INTRO_WORDS = [
  "monsieur",
  "madame",
  "m\\.",
  "mme",
  "mlle",
  "ci-apr[èe]s d[ée]sign[ée]",
  "ci-apr[èe]s nomm[ée]",
  "l'employ[ée]",
  "l'employeur",
  "le salari[ée]",
  "soussign[ée]",
  "soussign[ée]e",
  "nom et pr[ée]nom",
  "nom de l'employ[ée]",
];

// Mots clefs pour orienter "company vs employee" sur courriels, telephones, adresses
const COMPANY_KEYWORDS = [
  "entreprise",
  "employeur",
  "soci[ée]t[ée]",
  "compagnie",
  "siege social",
  "si[èe]ge social",
  "vnk",
];
const EMPLOYEE_KEYWORDS = [
  "employ",
  "salari",
  "candidat",
  "membre du personnel",
  "travailleur",
  "domicile",
];

// Mots clefs pour distinguer salaire vs taux horaire
const HOURLY_KEYWORDS = [
  "heure",
  "horaire",
  "/h",
  "par heure",
  "taux horaire",
];
const ANNUAL_KEYWORDS = [
  "annuel",
  "annuelle",
  "an",
  "/an",
  "par an",
  "par ann[ée]e",
  "r[ée]mun[ée]ration",
  "salaire",
];

// Mots clefs pour distinguer date de contrat vs date du jour
const TODAY_KEYWORDS = [
  "aujourd'hui",
  "le pr[ée]sent",
  "ce jour",
  "sign[ée] le",
  "fait [àa]",
  "fait le",
  "en date du",
  "date de signature",
];
const CONTRACT_START_KEYWORDS = [
  "d[ée]but",
  "embauche",
  "entr[ée]e en fonction",
  "prise de poste",
  "[àa] compter du",
  "premier jour",
];

const POSITION_INTRO_REGEX =
  /(?:[àa] titre de|en qualit[ée] de|occupe le poste de|poste de|engag[ée] comme|engag[ée]e comme|fonction de)\s+([A-ZÀ-Ÿa-zà-ÿ][\w\s\-/]{2,60}?)(?=[\.,;\n]|\s+(?:au sein|chez|pour|aupr[èe]s|depuis|dans))/g;

// Mots usuels qu'on NE veut pas confondre avec un nom propre
const NAME_BLACKLIST = new Set([
  "Le Présent",
  "Le Salarie",
  "Le Salarié",
  "L Employeur",
  "L Employee",
  "La Présente",
  "Les Parties",
  "Article Premier",
  "Article Un",
]);

// ─── Helpers context ──────────────────────────────────────

function contextWindow(text: string, start: number, end: number, radius = 80): string {
  const a = Math.max(0, start - radius);
  const b = Math.min(text.length, end + radius);
  return text.slice(a, b).toLowerCase();
}

function anyKeyword(haystack: string, keywords: string[]): boolean {
  return keywords.some((kw) => new RegExp(kw, "i").test(haystack));
}

// ─── Detection : courriels ────────────────────────────────

function detectEmails(text: string): DetectedVariable[] {
  const out: DetectedVariable[] = [];
  const re = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const ctx = contextWindow(text, m.index, m.index + m[0].length);
    const domain = m[0].split("@")[1]?.toLowerCase() ?? "";
    const looksCompany =
      domain.includes("vnk") ||
      anyKeyword(ctx, COMPANY_KEYWORDS) ||
      /info@|contact@|admin@|rh@|hr@/i.test(m[0]);
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      match: m[0],
      suggestedVariable: looksCompany ? "{{company.email}}" : "{{employee.email}}",
      variableLabel: looksCompany ? "Courriel entreprise" : "Courriel de l'employé",
      confidence: 0.95,
      category: "email",
      alternatives: looksCompany
        ? ["{{employee.email}}", "{{employee.manager.email}}"]
        : ["{{company.email}}", "{{employee.manager.email}}"],
    });
  }
  return out;
}

// ─── Detection : telephones ───────────────────────────────

function detectPhones(text: string): DetectedVariable[] {
  const out: DetectedVariable[] = [];
  // Couvre : (514) 555-1234, 514-555-1234, 514.555.1234, 1 514 555 1234, +1 514-555-1234
  const re =
    /(?:\+?1[\s.-]?)?(?:\(?(\d{3})\)?[\s.-]?)(\d{3})[\s.-]?(\d{4})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const area = m[1];
    const ctx = contextWindow(text, m.index, m.index + m[0].length);
    const isQC = QC_AREA_CODES.has(area);
    const looksCompany = anyKeyword(ctx, COMPANY_KEYWORDS);
    const baseConfidence = isQC ? 0.9 : 0.75;
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      match: m[0],
      suggestedVariable: looksCompany ? "{{company.phone}}" : "{{employee.phone}}",
      variableLabel: looksCompany
        ? "Téléphone entreprise"
        : "Téléphone de l'employé",
      confidence: baseConfidence,
      category: "phone",
      alternatives: looksCompany
        ? ["{{employee.phone}}"]
        : ["{{company.phone}}"],
    });
  }
  return out;
}

// ─── Detection : montants CAD ─────────────────────────────

function detectAmounts(text: string): DetectedVariable[] {
  const out: DetectedVariable[] = [];
  // Pattern 1 : "65 000 $", "65 000,00 $", "65 000$"
  // Pattern 2 : "$65,000", "$65,000.00"
  // Pattern 3 : "65 000 dollars"
  const patterns: RegExp[] = [
    /\b(\d{1,3}(?:[\s ]\d{3})+(?:,\d{2})?|\d{2,6}(?:,\d{2})?)\s?\$(?:\s?(?:CAD|CA|cad))?/g,
    /\$\s?(\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d{2,6}(?:\.\d{2})?)/g,
    /\b(\d{1,3}(?:[\s ]\d{3})+|\d{2,6})\s?dollars\b/gi,
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const ctx = contextWindow(text, m.index, m.index + m[0].length, 100);
      const isHourly = anyKeyword(ctx, HOURLY_KEYWORDS);
      const isAnnual = anyKeyword(ctx, ANNUAL_KEYWORDS);

      // Distinguer salaire employee vs contract : si "contrat" / "pr[ée]sent" -> contract
      const isContractCtx = /contrat|pr[ée]sent(e)?\s+(contrat|entente)|entente/i.test(ctx);

      let suggested: string;
      let label: string;
      let category: DetectedCategory;
      let alternatives: string[];

      if (isHourly && !isAnnual) {
        suggested = isContractCtx
          ? "{{contract.hourlyRate}}"
          : "{{employee.hourlyRate}}";
        label = "Taux horaire";
        category = "rate";
        alternatives = ["{{employee.hourlyRate}}", "{{contract.hourlyRate}}"];
      } else {
        suggested = isContractCtx
          ? "{{contract.salaryFormatted}}"
          : "{{employee.salaryFormatted}}";
        label = "Salaire annuel";
        category = "salary";
        alternatives = [
          "{{employee.salaryFormatted}}",
          "{{contract.salaryFormatted}}",
        ];
      }

      out.push({
        start: m.index,
        end: m.index + m[0].length,
        match: m[0],
        suggestedVariable: suggested,
        variableLabel: label,
        confidence: 0.85,
        category,
        alternatives,
      });
    }
  }
  return out;
}

// ─── Detection : heures par semaine ───────────────────────

function detectHoursPerWeek(text: string): DetectedVariable[] {
  const out: DetectedVariable[] = [];
  const re =
    /\b(\d{1,3})\s?(?:heures?|h(?:eures?)?)\s?(?:par|\/)\s?sem(?:aine)?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const ctx = contextWindow(text, m.index, m.index + m[0].length);
    const isContractCtx = /contrat|pr[ée]sent(e)?\s+(contrat|entente)|entente/i.test(ctx);
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      match: m[0],
      suggestedVariable: isContractCtx
        ? "{{contract.hoursPerWeek}}"
        : "{{employee.hoursPerWeek}}",
      variableLabel: "Heures par semaine",
      confidence: 0.9,
      category: "hours",
      alternatives: ["{{employee.hoursPerWeek}}", "{{contract.hoursPerWeek}}"],
    });
  }
  return out;
}

// ─── Detection : pourcentages vacances ────────────────────

function detectVacationPercent(text: string): DetectedVariable[] {
  const out: DetectedVariable[] = [];
  // % proches d'un mot "vacances" / "indemnite" / "conges"
  const re = /(\d{1,2}(?:[,.]\d{1,2})?)\s?%/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const ctx = contextWindow(text, m.index, m.index + m[0].length, 60);
    const isVacation = /vacances|cong[ée]s\s+pay[ée]s|indemnit[ée]\s+de\s+vacances|cong[ée]s\s+annuels/i.test(
      ctx
    );
    if (!isVacation) continue;
    const isContractCtx = /contrat|pr[ée]sent(e)?\s+(contrat|entente)|entente/i.test(ctx);
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      match: m[0],
      suggestedVariable: isContractCtx
        ? "{{contract.vacationPct}}"
        : "{{employee.vacationPct}}",
      variableLabel: "Pourcentage de vacances",
      confidence: 0.85,
      category: "percent",
      alternatives: ["{{employee.vacationPct}}", "{{contract.vacationPct}}"],
    });
  }
  return out;
}

// ─── Detection : dates FR (« 1er juin 2026 ») ─────────────

function detectDatesFr(text: string): DetectedVariable[] {
  const out: DetectedVariable[] = [];
  const re = new RegExp(
    `\\b(\\d{1,2})(?:er)?\\s+${MONTHS_FR}\\s+(\\d{4})\\b`,
    "gi"
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const ctx = contextWindow(text, m.index, m.index + m[0].length, 90);
    const isToday = anyKeyword(ctx, TODAY_KEYWORDS);
    const isStart = anyKeyword(ctx, CONTRACT_START_KEYWORDS);
    const isEnd = /(?:fin|terme|expir|jusqu'au|jusqu'[àa])/i.test(ctx);
    const isProbation = /probation|probatoire|essai/i.test(ctx);

    let suggested = "{{contract.startDateFr}}";
    let label = "Date de début de contrat";
    if (isToday) {
      suggested = "{{date.todayFr}}";
      label = "Date du jour";
    } else if (isProbation) {
      suggested = "{{contract.probationEndDateFr}}";
      label = "Fin de la période probatoire";
    } else if (isEnd) {
      suggested = "{{contract.endDateFr}}";
      label = "Date de fin de contrat";
    } else if (isStart) {
      suggested = "{{employee.startDateFr}}";
      label = "Date d'embauche de l'employé";
    }

    out.push({
      start: m.index,
      end: m.index + m[0].length,
      match: m[0],
      suggestedVariable: suggested,
      variableLabel: label,
      confidence: 0.85,
      category: "date",
      alternatives: [
        "{{date.todayFr}}",
        "{{employee.startDateFr}}",
        "{{contract.startDateFr}}",
        "{{contract.endDateFr}}",
        "{{contract.probationEndDateFr}}",
      ],
    });
  }
  return out;
}

// ─── Detection : dates ISO ────────────────────────────────

function detectDatesIso(text: string): DetectedVariable[] {
  const out: DetectedVariable[] = [];
  const re = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      match: m[0],
      suggestedVariable: "{{date.today}}",
      variableLabel: "Date (ISO)",
      confidence: 0.7,
      category: "date",
      alternatives: [
        "{{date.today}}",
        "{{employee.startDate}}",
        "{{contract.startDate}}",
        "{{contract.endDate}}",
        "{{contract.probationEndDate}}",
      ],
    });
  }
  return out;
}

// ─── Detection : duree probation (« 90 jours », « 3 mois ») ─

function detectProbationDuration(text: string): DetectedVariable[] {
  const out: DetectedVariable[] = [];
  const re = /\b(\d{1,3})\s?(jours?|semaines?|mois)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const ctx = contextWindow(text, m.index, m.index + m[0].length, 80);
    if (!/probation|probatoire|p[ée]riode d'essai|essai/i.test(ctx)) continue;
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      match: m[0],
      suggestedVariable: "{{contract.probationEndDateFr}}",
      variableLabel: "Fin de la période probatoire (à convertir en date)",
      confidence: 0.7,
      category: "duration",
      alternatives: ["{{contract.probationEndDateFr}}", "{{contract.probationEndDate}}"],
    });
  }
  return out;
}

// ─── Detection : adresses QC ──────────────────────────────

function detectAddresses(text: string): DetectedVariable[] {
  const out: DetectedVariable[] = [];
  // num, rue Nom, Ville (QC) H1H 1H1  — assez tolerant
  const re =
    /\b\d+[A-Za-z]?(?:[\s,]+(?:rue|boulevard|boul\.?|avenue|av\.?|chemin|ch\.?|route|rte\.?|all[ée]e|place|pl\.?))\s+[A-ZÀ-Ÿ][\w'\-]+(?:\s+[A-ZÀ-Ÿ][\w'\-]+){0,4}(?:,\s*[A-ZÀ-Ÿ][\w'\-]+(?:[\s-][A-ZÀ-Ÿ][\w'\-]+)*)?(?:,?\s*(?:QC|Qu[ée]bec))?(?:[\s,]+[A-Z]\d[A-Z]\s?\d[A-Z]\d)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const ctx = contextWindow(text, m.index, m.index + m[0].length, 100);
    const looksCompany = anyKeyword(ctx, COMPANY_KEYWORDS);
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      match: m[0].trim(),
      suggestedVariable: looksCompany ? "{{company.address}}" : "{{employee.address}}",
      variableLabel: looksCompany ? "Adresse entreprise" : "Adresse de l'employé",
      confidence: 0.8,
      category: "address",
      alternatives: ["{{employee.address}}", "{{company.address}}"],
    });
  }
  return out;
}

// ─── Detection : noms d'entreprise (Inc., Ltée…) ──────────

function detectCompanyNames(text: string): DetectedVariable[] {
  const out: DetectedVariable[] = [];
  const re =
    /\b([A-ZÀ-Ÿ][\w&'\-\.]+(?:\s+[A-ZÀ-Ÿ][\w&'\-\.]+){0,4})\s+(Inc\.?|Ltée|Lt[ée]e|Ltd\.?|ULC|S\.E\.N\.C\.R\.L\.?|S\.E\.N\.C\.?|enr\.?)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      match: m[0],
      suggestedVariable: "{{company.fullName}}",
      variableLabel: "Nom légal de l'entreprise",
      confidence: 0.95,
      category: "company",
      alternatives: ["{{company.fullName}}", "{{company.name}}"],
    });
  }
  return out;
}

// ─── Detection : NEQ (Quebec) ─────────────────────────────

function detectNeq(text: string): DetectedVariable[] {
  const out: DetectedVariable[] = [];
  const re = /(?:NEQ|Num[ée]ro d'entreprise(?:\s+du\s+Qu[ée]bec)?)\s*:?\s*(\d{10})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index + m[0].indexOf(m[1]);
    out.push({
      start,
      end: start + m[1].length,
      match: m[1],
      suggestedVariable: "{{company.neq}}",
      variableLabel: "Numéro NEQ (Québec)",
      confidence: 0.9,
      category: "neq",
      alternatives: ["{{company.neq}}"],
    });
  }
  return out;
}

// ─── Detection : noms propres (employe) ───────────────────

function detectNames(text: string): DetectedVariable[] {
  const out: DetectedVariable[] = [];

  // Pattern 1 : après "M./Mme/Monsieur/Madame "
  const intro =
    /\b(?:M\.|Mme|Mlle|Monsieur|Madame)\s+([A-ZÀ-Ÿ][a-zà-ÿ\-']+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ\-']+){1,2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = intro.exec(text))) {
    const name = m[1];
    if (NAME_BLACKLIST.has(name)) continue;
    const start = m.index + m[0].indexOf(name);
    out.push({
      start,
      end: start + name.length,
      match: name,
      suggestedVariable: "{{employee.fullName}}",
      variableLabel: "Nom complet de l'employé",
      confidence: 0.9,
      category: "name",
      alternatives: [
        "{{employee.fullName}}",
        "{{employee.firstName}}",
        "{{employee.lastName}}",
        "{{employee.manager.fullName}}",
      ],
    });
  }

  // Pattern 2 : après "ci-après désigné(e)", "soussigné(e)", "Nom et prénom :"
  const designated =
    /(?:ci-apr[èe]s\s+(?:d[ée]sign[ée]e?|nomm[ée]e?)|soussign[ée]e?|nom\s+et\s+pr[ée]nom\s*:|nom\s+complet\s*:|nom\s+de\s+l'employ[ée]\s*:)\s*[«"]?\s*([A-ZÀ-Ÿ][a-zà-ÿ\-']+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ\-']+){1,2})/gi;
  while ((m = designated.exec(text))) {
    const name = m[1];
    if (NAME_BLACKLIST.has(name)) continue;
    const start = m.index + m[0].indexOf(name);
    out.push({
      start,
      end: start + name.length,
      match: name,
      suggestedVariable: "{{employee.fullName}}",
      variableLabel: "Nom complet de l'employé",
      confidence: 0.95,
      category: "name",
      alternatives: [
        "{{employee.fullName}}",
        "{{employee.firstName}}",
        "{{employee.lastName}}",
      ],
    });
  }

  return out;
}

// ─── Detection : poste / fonction ─────────────────────────

function detectPositions(text: string): DetectedVariable[] {
  const out: DetectedVariable[] = [];
  let m: RegExpExecArray | null;
  POSITION_INTRO_REGEX.lastIndex = 0;
  while ((m = POSITION_INTRO_REGEX.exec(text))) {
    const value = m[1].trim();
    if (value.length < 3 || value.length > 60) continue;
    const start = m.index + m[0].indexOf(value);
    out.push({
      start,
      end: start + value.length,
      match: value,
      suggestedVariable: "{{employee.position}}",
      variableLabel: "Poste / fonction de l'employé",
      confidence: 0.7,
      category: "position",
      alternatives: ["{{employee.position}}", "{{employee.department}}"],
    });
  }
  return out;
}

// ─── Resolution des chevauchements ────────────────────────

function dedupeOverlapping(items: DetectedVariable[]): DetectedVariable[] {
  // Trie par confiance desc, puis par longueur desc
  const sorted = [...items].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.end - b.start - (a.end - a.start);
  });
  const accepted: DetectedVariable[] = [];
  for (const it of sorted) {
    const overlaps = accepted.some(
      (a) => !(it.end <= a.start || it.start >= a.end)
    );
    if (!overlaps) accepted.push(it);
  }
  // Renvoie trie par position dans le texte
  return accepted.sort((a, b) => a.start - b.start);
}

// ─── Entree principale ────────────────────────────────────

export function detectVariables(text: string): DetectedVariable[] {
  if (!text || text.length < 3) return [];
  const all: DetectedVariable[] = [
    ...detectCompanyNames(text),
    ...detectNeq(text),
    ...detectEmails(text),
    ...detectPhones(text),
    ...detectAmounts(text),
    ...detectHoursPerWeek(text),
    ...detectVacationPercent(text),
    ...detectDatesFr(text),
    ...detectDatesIso(text),
    ...detectProbationDuration(text),
    ...detectAddresses(text),
    ...detectNames(text),
    ...detectPositions(text),
  ];
  return dedupeOverlapping(all);
}

// ─── Application des substitutions ────────────────────────

/**
 * Applique un sous-ensemble de detections au texte, en remplacant les
 * portions [start, end[ par la variable choisie. Les detections doivent
 * etre disjointes (resultat de detectVariables). Si certaines sont
 * absentes du tableau `accepted`, les autres restent inchangees.
 */
export function applySubstitutions(
  text: string,
  accepted: DetectedVariable[],
): string {
  if (!accepted.length) return text;
  const sorted = [...accepted].sort((a, b) => a.start - b.start);
  const parts: string[] = [];
  let cursor = 0;
  for (const it of sorted) {
    if (it.start < cursor) continue; // chevauchement -> on saute
    parts.push(text.slice(cursor, it.start));
    parts.push(it.suggestedVariable);
    cursor = it.end;
  }
  parts.push(text.slice(cursor));
  return parts.join("");
}
