// Moteur de rendu de templates type Mustache simplifie.
// Syntaxes supportees :
//   {{ key }}                                   -> substitution
//   {{key.sub}}                                 -> dot path dans le contexte
//   {{#if key}}...{{/if}}                       -> bloc conditionnel (truthy + non vide)
//   {{#if key}}...{{else}}...{{/if}}            -> bloc avec alternative
//   {{#unless key}}...{{/unless}}               -> bloc inverse
//   {{#ifGender male}}...{{/ifGender}}          -> bloc si genre employé == male
//   {{#ifGender female}}...{{/ifGender}}        -> idem pour female
//   {{#ifGender non_binary}}...{{/ifGender}}    -> idem pour non_binary
//   {{#ifGender male}}M.{{else}}Mme{{/ifGender}}-> avec alternative
//
// Le contexte est un objet plat { "employee.fullName": "Jean", ... } construit
// par employee-context.ts (toutes valeurs deja formattees en string).
//
// La variable spéciale "employee.gender" doit être présente dans le contexte
// pour que {{#ifGender}} fonctionne. Si absente ou "prefer_not_to_say",
// le bloc principal est masqué (utilise toujours le {{else}} si fourni).

import { isKnownVariable } from "./variable-registry";

export type TemplateContext = Record<string, string>;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  unknownVars: string[];
}

// ── Regexes des blocs ───────────────────────────────────────
// On accepte les cles avec points (.), tirets (-), underscores (_) et alphanum.
const KEY_PATTERN = "[a-zA-Z_][a-zA-Z0-9_.\\-]*";

const IF_ELSE_REGEX = new RegExp(
  `\\{\\{\\s*#if\\s+(${KEY_PATTERN})\\s*\\}\\}([\\s\\S]*?)\\{\\{\\s*else\\s*\\}\\}([\\s\\S]*?)\\{\\{\\s*\\/if\\s*\\}\\}`,
  "g",
);

const IF_REGEX = new RegExp(
  `\\{\\{\\s*#if\\s+(${KEY_PATTERN})\\s*\\}\\}([\\s\\S]*?)\\{\\{\\s*\\/if\\s*\\}\\}`,
  "g",
);

const UNLESS_REGEX = new RegExp(
  `\\{\\{\\s*#unless\\s+(${KEY_PATTERN})\\s*\\}\\}([\\s\\S]*?)\\{\\{\\s*\\/unless\\s*\\}\\}`,
  "g",
);

// {{#ifGender male|female|non_binary}}...{{else}}...{{/ifGender}}
const IF_GENDER_ELSE_REGEX = new RegExp(
  `\\{\\{\\s*#ifGender\\s+(male|female|non_binary|prefer_not_to_say)\\s*\\}\\}([\\s\\S]*?)\\{\\{\\s*else\\s*\\}\\}([\\s\\S]*?)\\{\\{\\s*\\/ifGender\\s*\\}\\}`,
  "g",
);
const IF_GENDER_REGEX = new RegExp(
  `\\{\\{\\s*#ifGender\\s+(male|female|non_binary|prefer_not_to_say)\\s*\\}\\}([\\s\\S]*?)\\{\\{\\s*\\/ifGender\\s*\\}\\}`,
  "g",
);

const VAR_REGEX = new RegExp(`\\{\\{\\s*(${KEY_PATTERN})\\s*\\}\\}`, "g");

// Mots-cles reserves (ne sont pas des variables)
const RESERVED_KEYWORDS = new Set([
  "else",
  "#if",
  "/if",
  "#unless",
  "/unless",
  "#ifGender",
  "/ifGender",
  "male",
  "female",
  "non_binary",
  "prefer_not_to_say",
]);

// Normalise la valeur de "employee.gender" du contexte vers les 4 codes connus.
function normalizeCtxGender(raw: string | undefined): string {
  if (!raw) return "prefer_not_to_say";
  const v = raw.toLowerCase().trim();
  if (v === "male" || v === "homme" || v === "m" || v === "h") return "male";
  if (v === "female" || v === "femme" || v === "f") return "female";
  if (v === "non_binary" || v === "nonbinary" || v === "non-binaire" || v === "nb") {
    return "non_binary";
  }
  return "prefer_not_to_say";
}

function isTruthy(value: string | undefined | null): boolean {
  if (value === undefined || value === null) return false;
  const s = String(value).trim();
  if (s.length === 0) return false;
  if (s === "0" || s.toLowerCase() === "false") return false;
  return true;
}

function lookup(context: TemplateContext, key: string): string {
  if (Object.prototype.hasOwnProperty.call(context, key)) {
    return context[key] ?? "";
  }
  return "";
}

// ── Rendu ────────────────────────────────────────────────────

export function renderTemplate(body: string, context: TemplateContext): string {
  if (!body) return "";
  let out = body;

  // Resoudre les helpers gender en premier (avant {{#if}} pour éviter conflits)
  const ctxGender = normalizeCtxGender(context["employee.gender"]);

  // 0a. {{#ifGender X}}...{{else}}...{{/ifGender}}
  let prev: string;
  let safety = 0;
  do {
    prev = out;
    out = out.replace(
      IF_GENDER_ELSE_REGEX,
      (_m, target: string, ifBlock: string, elseBlock: string) => {
        return ctxGender === target ? ifBlock : elseBlock;
      },
    );
    safety += 1;
  } while (prev !== out && safety < 10);

  // 0b. {{#ifGender X}}...{{/ifGender}} simple
  safety = 0;
  do {
    prev = out;
    out = out.replace(IF_GENDER_REGEX, (_m, target: string, block: string) => {
      return ctxGender === target ? block : "";
    });
    safety += 1;
  } while (prev !== out && safety < 10);

  // 1. Resoudre {{#if}}...{{else}}...{{/if}} (avant {{#if}} simple)
  // Boucle car blocs peuvent etre imbriques apres premiere passe.
  safety = 0;
  do {
    prev = out;
    out = out.replace(IF_ELSE_REGEX, (_m, key: string, ifBlock: string, elseBlock: string) => {
      return isTruthy(lookup(context, key)) ? ifBlock : elseBlock;
    });
    safety += 1;
  } while (prev !== out && safety < 10);

  // 2. {{#if}}...{{/if}} simple
  safety = 0;
  do {
    prev = out;
    out = out.replace(IF_REGEX, (_m, key: string, ifBlock: string) => {
      return isTruthy(lookup(context, key)) ? ifBlock : "";
    });
    safety += 1;
  } while (prev !== out && safety < 10);

  // 3. {{#unless}}...{{/unless}}
  safety = 0;
  do {
    prev = out;
    out = out.replace(UNLESS_REGEX, (_m, key: string, block: string) => {
      return !isTruthy(lookup(context, key)) ? block : "";
    });
    safety += 1;
  } while (prev !== out && safety < 10);

  // 4. Substitution des variables. Variable inconnue => laisse le placeholder
  //    en place pour signaler le probleme a l'utilisateur (au lieu de le supprimer).
  out = out.replace(VAR_REGEX, (match, key: string) => {
    if (RESERVED_KEYWORDS.has(key)) return match;
    if (Object.prototype.hasOwnProperty.call(context, key)) {
      return context[key] ?? "";
    }
    return match;
  });

  return out;
}

// Extrait toutes les variables {{...}} utilisees dans un body (uniques, ordre d'apparition)
export function extractVariables(body: string): string[] {
  if (!body) return [];
  const found = new Set<string>();
  const result: string[] = [];

  const collect = (regex: RegExp) => {
    const re = new RegExp(regex.source, regex.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      const key = m[1];
      if (!RESERVED_KEYWORDS.has(key) && !found.has(key)) {
        found.add(key);
        result.push(key);
      }
    }
  };

  collect(IF_ELSE_REGEX);
  collect(IF_REGEX);
  collect(UNLESS_REGEX);
  collect(VAR_REGEX);

  // Variables inconnues dans IF_GENDER blocks : on capture les contenus,
  // mais la cible "male"/"female"/etc. n'est PAS une variable du registre.
  // Donc on ignore le groupe 1 (target) et on extrait juste le body via VAR_REGEX
  // ci-dessus (déjà fait). On marque tout de même les corps internes.
  return result;
}

// Verifie la coherence d'un template :
// - balises ouvrantes/fermantes equilibrees
// - variables connues du registre
export function validateTemplate(body: string): ValidationResult {
  const errors: string[] = [];
  const unknownVars: string[] = [];

  if (!body) {
    return { valid: true, errors: [], unknownVars: [] };
  }

  // Balises ouvrantes/fermantes
  const openIf = (body.match(/\{\{\s*#if\b/g) || []).length;
  const closeIf = (body.match(/\{\{\s*\/if\s*\}\}/g) || []).length;
  if (openIf !== closeIf) {
    errors.push(
      `Balises {{#if}} non équilibrées : ${openIf} ouverture(s) pour ${closeIf} fermeture(s).`,
    );
  }

  const openUnless = (body.match(/\{\{\s*#unless\b/g) || []).length;
  const closeUnless = (body.match(/\{\{\s*\/unless\s*\}\}/g) || []).length;
  if (openUnless !== closeUnless) {
    errors.push(
      `Balises {{#unless}} non équilibrées : ${openUnless} ouverture(s) pour ${closeUnless} fermeture(s).`,
    );
  }

  const openIfGender = (body.match(/\{\{\s*#ifGender\b/g) || []).length;
  const closeIfGender = (body.match(/\{\{\s*\/ifGender\s*\}\}/g) || []).length;
  if (openIfGender !== closeIfGender) {
    errors.push(
      `Balises {{#ifGender}} non équilibrées : ${openIfGender} ouverture(s) pour ${closeIfGender} fermeture(s).`,
    );
  }

  // Variables inconnues
  const used = extractVariables(body);
  for (const key of used) {
    if (!isKnownVariable(key)) {
      unknownVars.push(key);
    }
  }
  if (unknownVars.length > 0) {
    errors.push(
      `Variable(s) inconnue(s) : ${unknownVars.map((v) => `{{${v}}}`).join(", ")}.`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    unknownVars,
  };
}

// Construit un contexte d'exemple a partir du registre (pour previews)
export function buildExampleContext(): TemplateContext {
  // Import lazy pour eviter cycle de modules
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { VARIABLE_REGISTRY } = require("./variable-registry") as typeof import("./variable-registry");
  const ctx: TemplateContext = {};
  for (const def of VARIABLE_REGISTRY) {
    ctx[def.key] = def.example;
  }
  return ctx;
}
