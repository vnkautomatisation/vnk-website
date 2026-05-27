// Tests rapides du moteur de rendu.
// Lancement : `npx tsx --test src/lib/document-templates/__tests__/render-engine.test.ts`
// Ne sont pas branches sur `npm test` (qui pointe sur tests/security.test.ts).

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  renderTemplate,
  extractVariables,
  validateTemplate,
  type TemplateContext,
} from "../render-engine";
import {
  gEmployed,
  gPronoun,
  gAccordE,
  normalizeGender,
  hourlyToAnnual,
  annualToHourly,
  formatNasFull,
  tenureLabelFr,
} from "../quebec-helpers";

const baseCtx: TemplateContext = {
  "employee.fullName": "Jean Tremblay",
  "employee.firstName": "Jean",
  "employee.email": "jean@vnk.ca",
  "company.fullName": "VNK Automatisation Inc.",
  "contract.endDate": "",
};

describe("renderTemplate — substitution simple", () => {
  it("remplace une variable connue", () => {
    const out = renderTemplate("Bonjour {{employee.firstName}} !", baseCtx);
    assert.equal(out, "Bonjour Jean !");
  });

  it("supporte les espaces autour de la cle", () => {
    const out = renderTemplate("Salut {{  employee.firstName  }}", baseCtx);
    assert.equal(out, "Salut Jean");
  });

  it("laisse en place les variables inconnues", () => {
    const out = renderTemplate("Hello {{employee.unknownKey}}", baseCtx);
    assert.equal(out, "Hello {{employee.unknownKey}}");
  });
});

describe("renderTemplate — conditions #if/#unless", () => {
  it("affiche le bloc #if quand la variable est non vide", () => {
    const out = renderTemplate(
      "{{#if employee.email}}Courriel : {{employee.email}}{{/if}}",
      baseCtx,
    );
    assert.equal(out, "Courriel : jean@vnk.ca");
  });

  it("masque le bloc #if quand la variable est vide", () => {
    const out = renderTemplate(
      "{{#if contract.endDate}}Fin : {{contract.endDate}}{{/if}}",
      baseCtx,
    );
    assert.equal(out, "");
  });

  it("bascule sur {{else}} si la condition est fausse", () => {
    const out = renderTemplate(
      "{{#if contract.endDate}}CDD{{else}}CDI{{/if}}",
      baseCtx,
    );
    assert.equal(out, "CDI");
  });

  it("#unless affiche le bloc si la variable est vide", () => {
    const out = renderTemplate(
      "{{#unless contract.endDate}}Pas de fin{{/unless}}",
      baseCtx,
    );
    assert.equal(out, "Pas de fin");
  });
});

describe("extractVariables", () => {
  it("retourne les variables uniques utilisees", () => {
    const body =
      "{{employee.firstName}} {{employee.lastName}} — {{#if employee.email}}{{employee.email}}{{/if}}";
    const vars = extractVariables(body);
    assert.deepEqual(vars, [
      "employee.email", // sortie via le bloc #if d'abord (regex if-else avant simple vars)
      "employee.firstName",
      "employee.lastName",
    ].sort());
    // L'ordre exact peut varier entre les passes ; on verifie surtout le contenu
    assert.equal(new Set(vars).size, vars.length);
  });
});

describe("quebec-helpers — accord grammatical FR-CA", () => {
  it("gEmployed accorde correctement selon le genre", () => {
    assert.equal(gEmployed("male", true), "Employé");
    assert.equal(gEmployed("female", true), "Employée");
    assert.equal(gEmployed("non_binary", true), "Employé·e");
    assert.equal(gEmployed("prefer_not_to_say", true), "Employé(e)");
  });

  it("gPronoun retourne le bon pronom sujet", () => {
    assert.equal(gPronoun("male"), "il");
    assert.equal(gPronoun("female"), "elle");
    assert.equal(gPronoun("non_binary"), "iel");
    assert.equal(gPronoun("prefer_not_to_say"), "il ou elle");
  });

  it("gAccordE retourne le suffixe correct", () => {
    assert.equal(gAccordE("male"), "");
    assert.equal(gAccordE("female"), "e");
    assert.equal(gAccordE("non_binary"), "·e");
    assert.equal(gAccordE("prefer_not_to_say"), "(e)");
  });

  it("normalizeGender accepte plusieurs alias", () => {
    assert.equal(normalizeGender("homme"), "male");
    assert.equal(normalizeGender("F"), "female");
    assert.equal(normalizeGender("nb"), "non_binary");
    assert.equal(normalizeGender(null), "prefer_not_to_say");
    assert.equal(normalizeGender(""), "prefer_not_to_say");
  });
});

describe("quebec-helpers — automatisations RH", () => {
  it("hourlyToAnnual calcule taux × heures × 52", () => {
    assert.equal(hourlyToAnnual(32.5, 40), 67600);
    assert.equal(hourlyToAnnual(null, 40), null);
    assert.equal(hourlyToAnnual(0, 40), null);
  });

  it("annualToHourly fait l'inverse", () => {
    assert.equal(annualToHourly(67600, 40), 32.5);
    assert.equal(annualToHourly(null, 40), null);
  });

  it("formatNasFull formate XXX XXX XXX", () => {
    assert.equal(formatNasFull("123456789"), "123 456 789");
    assert.equal(formatNasFull("123-456-789"), "123 456 789");
    assert.equal(formatNasFull(""), "");
  });

  it("tenureLabelFr retourne un libellé lisible", () => {
    // 18 mois en arrière approx — on accepte "1 an et 5 mois" ou "1 an et 6 mois" selon le jour du mois
    const past = new Date();
    past.setMonth(past.getMonth() - 18);
    past.setDate(1);
    const label = tenureLabelFr(past);
    assert.match(label, /1 an et [4-7] mois/);
  });
});

describe("renderTemplate — accord grammatical {{#ifGender}}", () => {
  it("affiche le bloc male quand le genre est male", () => {
    const out = renderTemplate(
      "{{#ifGender male}}Monsieur{{else}}Madame{{/ifGender}}",
      { ...baseCtx, "employee.gender": "male" },
    );
    assert.equal(out, "Monsieur");
  });

  it("affiche le bloc else (female) quand le genre est female", () => {
    const out = renderTemplate(
      "{{#ifGender male}}Monsieur{{else}}Madame{{/ifGender}}",
      { ...baseCtx, "employee.gender": "female" },
    );
    assert.equal(out, "Madame");
  });

  it("retombe sur la branche else quand le genre est absent", () => {
    const out = renderTemplate(
      "{{#ifGender male}}M.{{else}}—{{/ifGender}}",
      baseCtx,
    );
    assert.equal(out, "—");
  });

  it("supporte non_binary", () => {
    const out = renderTemplate(
      "{{#ifGender non_binary}}iel{{/ifGender}}",
      { ...baseCtx, "employee.gender": "non_binary" },
    );
    assert.equal(out, "iel");
  });

  it("masque le bloc si le genre ne matche pas (sans else)", () => {
    const out = renderTemplate(
      "Bonjour {{#ifGender male}}Monsieur{{/ifGender}}",
      { ...baseCtx, "employee.gender": "female" },
    );
    assert.equal(out, "Bonjour ");
  });
});

describe("validateTemplate", () => {
  it("accepte un template avec variables connues du registre", () => {
    const v = validateTemplate(
      "Bonjour {{employee.fullName}}, signe pour {{company.fullName}}.",
    );
    assert.equal(v.valid, true);
    assert.deepEqual(v.unknownVars, []);
  });

  it("rejette une variable inconnue", () => {
    const v = validateTemplate("Hello {{employee.middleName}}");
    assert.equal(v.valid, false);
    assert.ok(v.unknownVars.includes("employee.middleName"));
  });

  it("rejette les balises #if non equilibrees", () => {
    const v = validateTemplate("{{#if employee.email}}oups");
    assert.equal(v.valid, false);
    assert.ok(v.errors.join(" ").includes("#if"));
  });

  it("rejette les balises #ifGender non equilibrees", () => {
    const v = validateTemplate("{{#ifGender male}}M.");
    assert.equal(v.valid, false);
    assert.ok(v.errors.join(" ").includes("#ifGender"));
  });
});
