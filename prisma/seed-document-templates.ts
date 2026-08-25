// Seed — Bibliotheque de 69 templates de documents FR-QC (Code civil + Loi 96)
// Exécution standalone : tsx prisma/seed-document-templates.ts
// Ou via : npm run seed:templates
//
// Marque tous les templates avec isStarter: true (bibliothèque VNK officielle).
// Les contrats permanents ont des targetPositions/targetDepartments pour suggestion contextuelle.
// Terminologie QC : permanent_full_time, temporary, internship, student, freelance, etc.
// (voir src/lib/document-templates/contract-types.ts)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ════════════════════════════════════════════════════════════════════════════
// LEGAL TEMPLATES — 50 documents (legal + policy + lettre + onboarding)
// Modèle : LegalDocumentTemplate
// ════════════════════════════════════════════════════════════════════════════

type SeedLegalTemplate = {
  key: string;
  title: string;
  category: string; // "legal" | "lettre" | "onboarding"
  version: string;
  bodyMarkdown: string;
  isRequired: boolean;
  targetPositions?: string[];
  targetDepartments?: string[];
};

// Bloc signatures pose explicitement dans chaque template. L'editeur Tiptap
// affiche les ancres `{{signature.employee/employer}}` comme des pills,
// signalant clairement au RH la presence de blocs signature.
//
// REGLE D'OR : l'editeur est la SEULE source de verite pour les signatures.
// Le PDF refletera exactement ce qui est dans le markdown — si le RH retire
// {{signature.employer}} en editant, le PDF n'aura qu'une signature.
//
// preprocessSignatures cote renderer transforme chaque ancre en bloc HTML
// (avec image signature embarquee si fournie via opts.signatures).
const SIGNATURES_BLOCK = `
## Signatures

{{signature.employee}}

{{signature.employer}}
`;

// ════════════════════════════════════════════════════════════════════════════
// CLASSIFICATION — acknowledgmentMode + signatureScope par cle
// ════════════════════════════════════════════════════════════════════════════
// Regles :
//  - acknowledgmentMode = "reading_only" (defaut) : politiques, codes, accuses
//    de lecture, manuels, chartes, communications.
//  - acknowledgmentMode = "signature" : contrats, NDA, ententes, avis
//    disciplinaires, lettres formelles, attestations.
//
//  - signatureScope = "none"          : pas de signature requise (reading_only).
//  - signatureScope = "employee_only" : engagement signe par l'employe seul.
//  - signatureScope = "employer_only" : avis / lettre emis par l'employeur.
//  - signatureScope = "both"          : entente bilaterale (contrat, NDA).
// ════════════════════════════════════════════════════════════════════════════

type AckMode = "reading_only" | "signature";
type SigScope = "employee_only" | "employer_only" | "both" | "none";

const TEMPLATE_CLASSIFICATION: Record<string, { ack: AckMode; scope: SigScope }> = {
  // ── Ententes contractuelles bilaterales ─────────────────────────────────
  nda_employee_standard:             { ack: "signature",    scope: "both" },

  // ── Codes / chartes : lecture seule ─────────────────────────────────────
  code_of_conduct:                   { ack: "reading_only", scope: "none" },

  // ── Politiques internes : lecture seule ────────────────────────────────
  harassment_policy:                 { ack: "reading_only", scope: "none" },
  remote_work_policy:                { ack: "reading_only", scope: "none" },
  alcohol_drugs_policy:              { ack: "reading_only", scope: "none" },
  conflict_of_interest:              { ack: "reading_only", scope: "none" },
  data_privacy_policy_law25:         { ack: "reading_only", scope: "none" },
  ip_policy:                         { ack: "reading_only", scope: "none" },
  cybersecurity_policy:              { ack: "reading_only", scope: "none" },
  password_policy:                   { ack: "reading_only", scope: "none" },
  byod_policy:                       { ack: "reading_only", scope: "none" },
  social_media_policy:               { ack: "reading_only", scope: "none" },
  gifts_hospitality_policy:          { ack: "reading_only", scope: "none" },
  anti_corruption_policy:            { ack: "reading_only", scope: "none" },
  french_language_policy_law96:      { ack: "reading_only", scope: "none" },
  religious_accommodation_policy:    { ack: "reading_only", scope: "none" },
  parental_leave_policy:             { ack: "reading_only", scope: "none" },
  workplace_violence_policy:         { ack: "reading_only", scope: "none" },
  dress_code_policy:                 { ack: "reading_only", scope: "none" },
  attendance_policy:                 { ack: "reading_only", scope: "none" },
  loto_lockout_program:              { ack: "reading_only", scope: "none" },
  ppe_policy:                        { ack: "reading_only", scope: "none" },
  confined_spaces_policy:            { ack: "reading_only", scope: "none" },
  working_at_heights_policy:         { ack: "reading_only", scope: "none" },
  chemical_handling_simdut:          { ack: "reading_only", scope: "none" },
  company_vehicle_policy:            { ack: "reading_only", scope: "none" },
  client_site_visit_policy:          { ack: "reading_only", scope: "none" },
  first_aid_policy:                  { ack: "reading_only", scope: "none" },
  incident_reporting_policy:         { ack: "reading_only", scope: "none" },
  source_code_management_policy:     { ack: "reading_only", scope: "none" },
  software_license_policy:           { ack: "reading_only", scope: "none" },
  ip_assignment_extended_policy:     { ack: "reading_only", scope: "none" },
  backup_disaster_recovery_policy:   { ack: "reading_only", scope: "none" },
  client_systems_access_policy:      { ack: "reading_only", scope: "none" },
  it_ot_cybersecurity_policy:        { ack: "reading_only", scope: "none" },

  // ── Confirmations / attestations recues par l'employe ──────────────────
  // Logique : l'employeur emet le document, mais c'est l'EMPLOYE qui signe
  // pour accuser reception. Une seule signature (employe), pas d'employeur
  // dans le PDF final.
  letter_employment_confirmation:    { ack: "signature",    scope: "employee_only" },
  letter_salary_confirmation:        { ack: "signature",    scope: "employee_only" },
  letter_reference:                  { ack: "signature",    scope: "employer_only" }, // lettre de reference : seul l'employeur signe (donnee a tiers)
  letter_probation_passed:           { ack: "signature",    scope: "employee_only" },
  letter_recall_to_work:             { ack: "signature",    scope: "employee_only" },

  // ── Lettres bilaterales : employeur emet + employe accepte ──────────────
  // Avertissements, promotions, changements, mise a pied : enjeu legal des
  // deux cotes -> les deux parties signent.
  letter_promotion:                  { ack: "signature",    scope: "both" },
  letter_disciplinary_warning:       { ack: "signature",    scope: "both" },
  letter_termination:                { ack: "signature",    scope: "both" },
  letter_position_change:            { ack: "signature",    scope: "both" },
  letter_probation_extended:         { ack: "signature",    scope: "both" },
  letter_disciplinary_warning_2:     { ack: "signature",    scope: "both" },
  letter_disciplinary_warning_final: { ack: "signature",    scope: "both" },
  letter_temporary_layoff:           { ack: "signature",    scope: "both" },

  // ── Onboarding (accuses, checklists, manuel) ───────────────────────────
  onboarding_manual_acknowledgment:        { ack: "reading_only", scope: "none" },
  onboarding_equipment_inventory:          { ack: "signature",    scope: "both" }, // remise / restitution materiel
  onboarding_return_to_work_cnesst:        { ack: "reading_only", scope: "none" },
  onboarding_vacation_policy_acceptance:   { ack: "reading_only", scope: "none" },
  onboarding_checklist_programmer:         { ack: "reading_only", scope: "none" },
  onboarding_checklist_field_tech:         { ack: "reading_only", scope: "none" },
  onboarding_checklist_engineer:           { ack: "reading_only", scope: "none" },
  onboarding_checklist_accountant:         { ack: "reading_only", scope: "none" },

  // ── Engagements professionnels (signature employe) ─────────────────────
  engagement_oiq_engineer:           { ack: "signature",    scope: "employee_only" },
  engagement_cpa_accountant:         { ack: "signature",    scope: "employee_only" },

  // ── Evaluations (signature bilaterale) ──────────────────────────────────
  evaluation_30_60_90:               { ack: "signature",    scope: "both" },
};

// Defaut applique si une cle n'est pas listee : conservateur (reading_only / none).
const DEFAULT_CLASSIFICATION: { ack: AckMode; scope: SigScope } = {
  ack: "reading_only",
  scope: "none",
};

// ════════════════════════════════════════════════════════════════════════════
// HELPER — adapte le preambule selon le contexte d'utilisation reel
// ════════════════════════════════════════════════════════════════════════════
// Probleme : tous les templates ont historiquement un preambule contractuel
// bilateral ("Entre les parties soussignees... Les parties conviennent de ce
// qui suit"). Or, la majorite des templates sont des politiques lues dans le
// Cahier de l'employe (lecture seule, l'employe ne "convient" pas, il prend
// connaissance d'une politique imposee).
//
// Strategie :
//   - reading_only       => on retire entierement le preambule bilateral et
//                           toute mention "Conformite : ..." en tete. La
//                           conformite legale (si presente) est preservee
//                           via les sections existantes du corps.
//   - signature + both   => preambule contractuel propre (vrai contrat
//                           bilateral type NDA).
//   - signature + employee_only => preambule unilateral d'engagement.
//   - signature + employer_only => preambule emetteur (avis, lettre).
//
// La fonction est idempotente : si le preambule est deja absent, elle ne
// touche pas au texte.
// ════════════════════════════════════════════════════════════════════════════
function adaptTemplateBody(
  body: string,
  scope: SigScope,
  ack: AckMode,
): string {
  // Capture le titre H1 (premiere ligne `# ...`) pour le restituer en tete
  // apres nettoyage. Si pas de H1, on conserve le body tel quel.
  const lines = body.split("\n");
  let headingLine = "";
  let rest = body;
  if (lines[0]?.startsWith("# ")) {
    headingLine = lines[0];
    rest = lines.slice(1).join("\n").replace(/^\s*\n/, "");
  }

  // Strip "**Conformite : ...**" line(s) en tete (avec ou sans label "legale").
  rest = rest.replace(
    /^\*\*Conformit[eé][^*\n]*?:\*\*[^\n]*\n+/,
    "",
  );

  // Strip preambule bilateral complet :
  //   "**Entre les parties soussignees :**\n\n {description parties} \n\n
  //    [optional: **Les parties conviennent de ce qui suit :**\n\n]"
  // On capture tout jusqu'au prochain "## " (premiere section H2) ou jusqu'a
  // "**Les parties conviennent..." inclus.
  const preambleWithConvention =
    /^\*\*Entre les parties soussign[eé]es\s*:\*\*[\s\S]*?\*\*Les parties conviennent de ce qui suit\s*:\*\*\s*\n+/;
  const preambleWithoutConvention =
    /^\*\*Entre les parties soussign[eé]es\s*:\*\*[\s\S]*?(?=\n##\s|\n---\s*\n|\n#\s)/;

  let strippedPreamble = false;
  if (preambleWithConvention.test(rest)) {
    rest = rest.replace(preambleWithConvention, "");
    strippedPreamble = true;
  } else if (preambleWithoutConvention.test(rest)) {
    rest = rest.replace(preambleWithoutConvention, "");
    // Nettoie les lignes blanches residuelles avant le premier ## H2.
    rest = rest.replace(/^\s*\n+/, "");
    strippedPreamble = true;
  }

  // Maintenant on prepend le bon preambule selon scope/ack.
  // IMPORTANT : si le template original n'avait pas de preambule bilateral
  // (ex : evaluation 30/60/90 ou inventaire materiel qui commencent direct
  // par leur entete metier), on NE prepend RIEN — sinon on doublonnerait.
  let preamble = "";
  if (!strippedPreamble) {
    // Body deja correct (lettre, eval, inventaire, etc.).
    preamble = "";
  } else if (ack === "reading_only") {
    // Aucun preambule : la page de garde du cahier suffit et chaque chapitre
    // attaque directement par sa premiere section.
    preamble = "";
  } else if (scope === "both") {
    preamble = `**Entre les parties soussignées :**\n\n**{{company.fullName}}**, ci-après désignée « l'Employeur », et **{{employee.fullName}}**, occupant le poste de **{{employee.position}}** au sein du département {{employee.department}}, ci-après désigné{{employee.accordE}} « l'{{employee.employed}} ».\n\n**Les parties conviennent de ce qui suit :**\n\n`;
  } else if (scope === "employee_only") {
    preamble = `**Engagement de l'{{employee.employed}}**\n\nJe soussigné{{employee.accordE}}, **{{employee.fullName}}**, occupant le poste de **{{employee.position}}** au sein de **{{company.fullName}}**, m'engage par la présente à respecter les conditions énoncées dans le présent document.\n\n`;
  } else if (scope === "employer_only") {
    preamble = `**Document émis par {{company.fullName}}**\n\n- **Destinataire :** {{employee.fullName}}\n- **Poste :** {{employee.position}}\n- **Date :** {{date.todayFr}}\n\n---\n\n`;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Ajuste le bloc signatures selon le scope. La SIGNATURES_BLOCK constante
  // contient les deux ancres ({{signature.employee}} + {{signature.employer}})
  // pour les templates "both". On retire ce qui ne s'applique pas :
  //   - scope = "none"          -> supprime tout le bloc Signatures
  //   - scope = "employee_only" -> retire {{signature.employer}}
  //   - scope = "employer_only" -> retire {{signature.employee}}
  //   - scope = "both"          -> conserve les deux ancres
  //
  // L'EDITEUR Tiptap lira ensuite la bodyMarkdown ainsi adaptee : ce qui
  // est dans le markdown = ce qui s'affiche en pills = ce qui sortira dans
  // le PDF. Une SEULE source de verite.
  // ─────────────────────────────────────────────────────────────────────
  if (scope === "none") {
    // Supprime la section Signatures (heading + ancres + lignes vides residuelles)
    rest = rest.replace(
      /\n*##\s+Signatures\s*\n[\s\S]*?(\{\{\s*signature\.(employee|employer)\s*\}\}\s*\n*)+/g,
      "\n",
    );
  } else if (scope === "employee_only") {
    rest = rest.replace(/\{\{\s*signature\.employer\s*\}\}\s*\n*/g, "");
  } else if (scope === "employer_only") {
    rest = rest.replace(/\{\{\s*signature\.employee\s*\}\}\s*\n*/g, "");
  }

  const heading = headingLine ? `${headingLine}\n\n` : "";
  return `${heading}${preamble}${rest}`.replace(/\n{3,}/g, "\n\n");
}

const LEGAL_TEMPLATES: SeedLegalTemplate[] = [
  // ───────────────────────────────────────────────────────────────────────
  // 1. NDA Employé Standard
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "nda_employee_standard",
    title: "Entente de confidentialité — Employé",
    category: "legal",
    version: "1.0",
    isRequired: true,
    bodyMarkdown: `# Entente de confidentialité

**Entre les parties soussignées :**

{{company.fullName}}, ayant son siège social au {{company.address}}, immatriculée sous le NEQ {{company.neq}}, ci-après désignée « l'Employeur »,

ET

{{employee.fullName}}, occupant le poste de {{employee.position}} au sein du département {{employee.department}}, ci-après désigné{{employee.accordE}} « l'{{employee.employed}} ».

**Les parties conviennent de ce qui suit :**

## Objet

La présente entente a pour objet de protéger les **renseignements confidentiels** appartenant à l'Employeur, à ses clients, à ses fournisseurs et à ses partenaires d'affaires, conformément aux dispositions du *Code civil du Québec* et de la *Loi sur la protection des renseignements personnels dans le secteur privé* (Loi 25).

## Définition des renseignements confidentiels

Sont considérés comme confidentiels, sans s'y limiter :

- Les **données techniques** : plans, schémas, programmes d'automates (PLC), codes sources, configurations HMI et SCADA.
- Les **informations commerciales** : listes de clients, prix, marges, stratégies de mise en marché.
- Les **renseignements personnels** concernant les employés, clients et fournisseurs.
- Les **méthodes, procédés, savoir-faire** et secrets industriels.
- Toute information **identifiée comme confidentielle**, verbalement ou par écrit.

## Engagements de l'{{employee.employed}}

L'{{employee.employed}} s'engage formellement à :

1. **Ne divulguer aucun renseignement confidentiel** à un tiers, pendant et après son emploi.
2. **Utiliser les renseignements confidentiels** uniquement dans le cadre de ses fonctions.
3. **Prendre les mesures raisonnables** pour assurer la sécurité des renseignements (verrouillage de session, chiffrement, transport sécuritaire).
4. **Restituer ou détruire** tous les documents et supports contenant des renseignements confidentiels à la fin de l'emploi.
5. **Signaler sans délai** toute violation ou tentative de violation de confidentialité.

## Durée de l'obligation

| Période | Portée de l'obligation |
| --- | --- |
| Durant l'emploi | Confidentialité absolue, en tout temps et en toutes circonstances. |
| Après la cessation | Maintien de l'obligation pendant **cinq (5) ans**, peu importe la cause. |

## Exceptions

Les obligations énoncées ci-dessus **ne s'appliquent pas** aux renseignements qui :

- Sont du **domaine public** sans faute de l'{{employee.employed}}.
- Étaient **connus** de l'{{employee.employed}} avant son embauche et documentés.
- Doivent être **divulgués** en vertu d'une obligation légale ou d'une ordonnance judiciaire.

## Sanctions

Toute violation de la présente entente peut entraîner, individuellement ou cumulativement :

- Des **mesures disciplinaires** pouvant aller jusqu'au congédiement pour motif sérieux.
- Des **recours civils** en dommages-intérêts.
- Des **poursuites pénales** le cas échéant.

## Juridiction

> La présente entente est régie par les lois du Québec. Tout litige sera soumis exclusivement aux tribunaux du district judiciaire de Québec.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 2. Code de conduite professionnelle
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "code_of_conduct",
    title: "Code de conduite professionnelle",
    category: "legal",
    version: "1.0",
    isRequired: true,
    bodyMarkdown: `# Code de conduite professionnelle

**Entre les parties soussignées :**

{{company.fullName}}, ci-après « l'Employeur », et {{employee.fullName}}, occupant le poste de {{employee.position}} au sein du département {{employee.department}}, ci-après « l'{{employee.employed}} ».

**Les parties conviennent de ce qui suit :**

## Préambule

Le présent code énonce les comportements et engagements attendus de toute personne employée par {{company.fullName}}. Il s'inscrit dans la culture d'entreprise et reflète les valeurs fondamentales que l'Employeur entend voir respectées au quotidien, tant à l'interne que dans les relations avec les clients, les fournisseurs et le grand public.

## Valeurs fondamentales

| Valeur | Engagement attendu |
| --- | --- |
| **Intégrité** | Agir avec honnêteté en toutes circonstances, refuser tout compromis éthique. |
| **Respect** | Traiter chaque personne avec dignité, sans discrimination ni jugement. |
| **Excellence** | Viser la qualité dans chaque livrable client et toute communication. |
| **Sécurité** | Prioriser la santé et la sécurité au travail (bureau, atelier, chantier). |
| **Confidentialité** | Protéger les renseignements sensibles de l'entreprise et de ses clients. |

## Comportements attendus

L'{{employee.employed}} s'engage notamment à :

- Respecter les engagements pris envers les clients, collègues et fournisseurs.
- Communiquer dans un langage courtois, en français au Québec (Loi 96).
- Porter une tenue professionnelle adaptée au contexte (bureau, chantier, client).
- Respecter rigoureusement les horaires de travail convenus.
- Collaborer activement avec les membres de l'équipe {{employee.team}}.

## Comportements interdits

Sont expressément prohibés, sans s'y limiter :

- La **discrimination** fondée sur l'origine, la religion, l'orientation sexuelle, le handicap, l'âge ou le sexe.
- Le **harcèlement psychologique ou sexuel** (couvert par une politique distincte).
- L'utilisation des **ressources de l'entreprise** à des fins personnelles non autorisées.
- L'acceptation de **cadeaux ou avantages** susceptibles d'influencer une décision d'affaires.
- Toute **représentation non autorisée** de l'entreprise.

## Conflit d'intérêts

L'{{employee.employed}} doit déclarer sans délai à son supérieur immédiat toute situation susceptible de constituer un conflit d'intérêts réel, potentiel ou apparent, notamment :

- Des intérêts financiers chez un client ou un fournisseur de l'entreprise.
- Un lien familial direct avec un partenaire d'affaires.
- Toute activité externe susceptible d'entrer en concurrence avec l'Employeur.

## Utilisation des médias sociaux

- Ne pas divulguer d'informations confidentielles sur les réseaux sociaux.
- Ne pas représenter publiquement l'entreprise sans autorisation préalable.
- Mentionner clairement que les opinions personnelles n'engagent pas l'Employeur.

## Signalement

Tout manquement au présent code peut être signalé **de bonne foi** au supérieur immédiat ou au responsable RH. Aucune représaille ne sera tolérée envers une personne qui signale de bonne foi un comportement problématique.

## Sanctions

Le non-respect du présent code peut entraîner des mesures disciplinaires graduelles, pouvant aller jusqu'au congédiement :

1. Avertissement verbal documenté ;
2. Avertissement écrit versé au dossier ;
3. Suspension temporaire avec ou sans solde ;
4. Congédiement pour motif sérieux.

> **Engagement formel.** En signant le présent document, l'{{employee.employed}} reconnaît avoir lu, compris et accepté l'ensemble des dispositions du présent code de conduite professionnelle.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 3. Politique anti-harcèlement psychologique
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "harassment_policy",
    title: "Politique de prévention du harcèlement psychologique et sexuel",
    category: "legal",
    version: "1.0",
    isRequired: true,
    bodyMarkdown: `# Politique de prévention du harcèlement psychologique et sexuel

**Conformité légale :** articles 81.18 à 81.20 de la *Loi sur les normes du travail* du Québec.

**Entre les parties soussignées :**

{{company.fullName}} et {{employee.fullName}}, en date du {{date.todayFr}}.

## Engagement de l'employeur
{{company.fullName}} s'engage à offrir à toutes ses employées et à tous ses employés un milieu de travail exempt de toute forme de harcèlement psychologique et sexuel.

## Définition
Le harcèlement psychologique est une conduite vexatoire se manifestant par des comportements, paroles, actes ou gestes répétés qui :
- sont hostiles ou non désirés
- portent atteinte à la dignité ou à l'intégrité psychologique ou physique de la personne
- entraînent, pour celle-ci, un milieu de travail néfaste

Une seule conduite grave peut aussi constituer du harcèlement si elle porte une telle atteinte et produit un effet nocif continu.

## Comportements interdits
- Insultes, menaces, intimidation, isolement, dénigrement
- Avances sexuelles non désirées, attouchements, commentaires sexuels
- Cyberintimidation par courriel, réseaux sociaux ou messagerie
- Sabotage du travail, attribution de tâches dégradantes
- Diffusion de rumeurs malveillantes

## Mécanisme de plainte
Tout employé qui se croit victime de harcèlement doit en aviser son supérieur immédiat ou le responsable RH désigné. Si le harceleur présumé est le supérieur immédiat, la plainte est dirigée vers la direction générale.

**Confidentialité garantie.** Aucune représaille ne sera tolérée envers une personne ayant déposé une plainte de bonne foi ni envers les témoins.

## Enquête
L'employeur s'engage à mener une enquête rapide, impartiale et confidentielle. Les sanctions peuvent aller jusqu'au congédiement pour motif sérieux. Des mesures provisoires (réaffectation, télétravail) peuvent être appliquées pendant l'enquête.

## Recours externe
L'employé peut aussi déposer une plainte directement à la **CNESST** dans les **deux (2) ans** suivant la dernière manifestation de harcèlement.

## Soutien
{{company.fullName}} met à disposition un programme d'aide aux employés (PAE) confidentiel pour soutenir toute personne affectée par une situation de harcèlement.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 4. Politique télétravail
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "remote_work_policy",
    title: "Politique de télétravail",
    category: "legal",
    version: "1.0",
    isRequired: false,
    bodyMarkdown: `# Politique de télétravail

**Entre les parties soussignées :**

{{company.fullName}} et {{employee.fullName}}, occupant le poste de {{employee.position}}.

## Admissibilité
Le télétravail est offert aux employés dont le poste est compatible (administratif, programmation, support technique à distance, comptabilité). L'admissibilité est déterminée conjointement par l'Employé et son supérieur immédiat {{employee.manager.fullName}}.

## Conditions
- Disposer d'un espace de travail sécuritaire et ergonomique à domicile
- Avoir une connexion Internet stable (minimum 50 Mbps en téléchargement)
- Respecter les horaires convenus ({{employee.hoursPerWeek}} heures par semaine)
- Être joignable en tout temps pendant les heures de travail (courriel, téléphone, messagerie interne)
- Participer aux réunions d'équipe par visioconférence

## Équipement
L'Employeur fournit l'équipement informatique de base (ordinateur portable, écran, accessoires). Tout équipement attribué doit être retourné lors d'un retour au bureau permanent ou à la fin de l'emploi, en bon état.

L'Employeur ne couvre pas les frais résidentiels (Internet, électricité, mobilier) sauf entente écrite spécifique.

## Sécurité de l'information
- Connexion VPN obligatoire pour accéder aux systèmes internes
- Interdiction de stocker des fichiers confidentiels sur appareil personnel
- Verrouillage automatique de la session après dix (10) minutes d'inactivité
- Aucun travail en lieu public sans précaution (filtre de confidentialité, casque)

## Santé et sécurité (CNESST)
L'Employé doit signaler à {{company.fullName}} tout incident survenu pendant les heures de télétravail (blessure, accident ergonomique). La CNESST couvre les accidents survenus en télétravail dans les mêmes conditions qu'au bureau.

## Révocation
L'Employeur se réserve le droit de mettre fin à l'entente de télétravail en tout temps, avec un préavis raisonnable, notamment en cas de :
- Baisse de performance
- Non-respect des conditions de la présente politique
- Besoins opérationnels nécessitant la présence au bureau
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 5. Politique alcool et drogues
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "alcohol_drugs_policy",
    title: "Politique sur l'alcool et les drogues en milieu de travail",
    category: "legal",
    version: "1.0",
    isRequired: true,
    bodyMarkdown: `# Politique sur l'alcool et les drogues en milieu de travail

**Conformité :** *Loi sur la santé et la sécurité du travail* (LSST), *Code civil du Québec*, *Loi sur le cannabis*.

**Entre les parties soussignées :**

{{company.fullName}} et {{employee.fullName}}.

## Principe
La consommation d'alcool, de cannabis ou de toute substance psychoactive est incompatible avec l'exercice sécuritaire des fonctions chez {{company.fullName}}, particulièrement dans un contexte d'automatisation industrielle où les risques d'accident sont élevés.

## Interdictions
Il est strictement interdit :
- De se présenter au travail (bureau ou chantier client) sous l'influence d'alcool, de cannabis ou de toute substance illicite
- De consommer ces substances pendant les heures de travail, y compris les pauses et les heures de repas
- De posséder, vendre ou distribuer des substances illicites sur les lieux de travail ou dans les véhicules de l'entreprise
- De conduire un véhicule de l'entreprise sous l'effet d'alcool ou de drogues

## Cas particulier des médicaments
L'Employé qui prend des médicaments prescrits susceptibles d'altérer ses capacités (sédatifs, opiacés, etc.) doit en informer son supérieur immédiat. Des aménagements temporaires (tâches sans risque, télétravail) peuvent être convenus.

## Postes à risque (poste sécuritaire)
Pour les postes impliquant la conduite de véhicules, le travail en hauteur, l'intervention sur des équipements électriques ou mécaniques, l'employeur peut exiger un test de dépistage en cas de motif raisonnable (accident, comportement inhabituel).

## Soutien
Un employé aux prises avec un problème de dépendance est encouragé à se confier à son supérieur ou au responsable RH. Un programme d'aide aux employés (PAE) confidentiel est disponible. La démarche volontaire n'entraîne pas de sanction disciplinaire.

## Sanctions
Toute violation peut entraîner des mesures disciplinaires graduelles allant jusqu'au congédiement pour motif sérieux, sans préjudice des recours pénaux applicables (notamment en cas de conduite avec facultés affaiblies).

## Événements sociaux
Lors d'événements organisés par l'entreprise où l'alcool est servi (party de bureau, fêtes), la consommation doit demeurer modérée. L'Employeur fournit transport collectif ou taxi pour le retour.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 6. Politique conflit d'intérêts
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "conflict_of_interest",
    title: "Politique en matière de conflit d'intérêts",
    category: "legal",
    version: "1.0",
    isRequired: true,
    bodyMarkdown: `# Politique en matière de conflit d'intérêts

**Entre les parties soussignées :**

{{company.fullName}} et {{employee.fullName}}, occupant le poste de {{employee.position}}.

## Objet
La présente politique vise à prévenir, identifier et gérer les situations de conflit d'intérêts pouvant nuire à l'intégrité, à l'impartialité ou à la réputation de {{company.fullName}}.

## Définition
Un **conflit d'intérêts** survient lorsqu'un employé a un intérêt personnel, financier ou familial susceptible d'influencer (ou de paraître influencer) l'exercice objectif de ses fonctions.

Trois catégories :
- **Réel** : l'intérêt influence concrètement une décision
- **Potentiel** : l'intérêt pourrait influencer une décision future
- **Apparent** : une personne raisonnable pourrait percevoir un conflit, même s'il n'y en a pas

## Situations à déclarer
L'Employé doit déclarer par écrit à son supérieur immédiat (ou au responsable RH) toute situation telle que :
- Détention d'intérêts financiers significatifs chez un client, fournisseur ou concurrent
- Lien familial ou personnel étroit avec un partenaire d'affaires de l'entreprise
- Emploi ou activité rémunérée à l'extérieur (autre employeur, contrats à la pige, conseils d'administration)
- Réception de cadeaux, invitations ou avantages dépassant la valeur de 100 $ d'un client/fournisseur
- Participation à des décisions d'embauche, d'attribution de contrats ou d'évaluation impliquant des proches

## Gestion du conflit
Selon la nature et l'ampleur du conflit, des mesures peuvent être prises :
- Récusation de l'Employé d'un dossier ou d'une décision
- Réaffectation temporaire
- Encadrement renforcé (double approbation)
- Renoncement à l'intérêt personnel
- Le cas échéant, fin d'emploi si le conflit ne peut être résolu

## Activités externes
L'Employé qui souhaite exercer une activité professionnelle externe (consultation, enseignement, contrats à la pige dans le même domaine) doit obtenir l'autorisation écrite préalable de {{company.fullName}}. Toute activité concurrente directe est interdite.

## Confidentialité des déclarations
Les déclarations de conflit sont traitées de manière confidentielle. Elles sont conservées au dossier RH selon les délais de la *Loi 25*.

## Sanctions
L'omission de déclarer un conflit, ou la fausse déclaration, peut entraîner des mesures disciplinaires pouvant aller jusqu'au congédiement pour motif sérieux.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 7. Politique confidentialité données / Loi 25
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "data_privacy_policy_law25",
    title: "Politique de protection des renseignements personnels (Loi 25)",
    category: "legal",
    version: "1.0",
    isRequired: true,
    bodyMarkdown: `# Politique de protection des renseignements personnels

**Conformité :** *Loi modernisant des dispositions législatives en matière de protection des renseignements personnels* (Loi 25, Québec), en vigueur depuis le 22 septembre 2023.

**Entre les parties soussignées :**

{{company.fullName}} et {{employee.fullName}}, en date du {{date.todayFr}}.

## Renseignements personnels collectés
{{company.fullName}} collecte les renseignements suivants dans le cadre de la relation d'emploi :
- Identité (nom complet, date de naissance, numéro d'assurance sociale)
- Coordonnées (adresse, téléphone, courriel)
- Informations bancaires pour dépôt direct (chiffrées AES-256)
- Antécédents professionnels, formations, permis professionnels
- Coordonnées des personnes à contacter en cas d'urgence
- Données de santé liées au travail (déclarations CNESST, accommodements)
- Évaluations de rendement et historique disciplinaire

## Finalités
Ces données sont utilisées uniquement pour :
- Gestion du contrat de travail et de la paie
- Conformité fiscale (T4, Relevé 1, ARC, Revenu Québec)
- Avantages sociaux et assurance collective
- Sécurité au travail et conformité CNESST
- Communication d'urgence
- Évaluation et développement professionnel

## Conservation
Les renseignements sont conservés pendant la durée de l'emploi, puis :
- **Sept (7) ans** pour les données fiscales (obligation Revenu Québec et ARC)
- **Cinq (5) ans** pour les autres renseignements RH
- Les données sont ensuite détruites de façon sécuritaire ou anonymisées

## Vos droits (Loi 25)
L'Employé peut en tout temps exercer les droits suivants :
- **Accès** : consulter l'ensemble des renseignements détenus à son sujet
- **Rectification** : faire corriger une donnée inexacte ou incomplète
- **Cessation de communication** : demander qu'on cesse de transmettre certaines données
- **Portabilité** : recevoir ses renseignements dans un format technologique structuré et couramment utilisé
- **Droit à l'oubli** : demander la suppression de renseignements (sous réserve des obligations légales)

Les demandes doivent être adressées par courriel à {{company.email}} et seront traitées dans un délai maximal de **trente (30) jours**.

## Communication à des tiers
{{company.fullName}} ne communique aucun renseignement personnel à des tiers sans le consentement explicite de l'Employé, sauf :
- Obligation légale (CNESST, Revenu Québec, ARC, tribunaux)
- Sous-traitants liés par entente de confidentialité (paie, assurance collective)
- Hébergement infonuagique au Canada conforme à la Loi 25

## Incident de confidentialité
En cas d'incident impliquant des renseignements personnels, {{company.fullName}} s'engage à :
- Notifier la Commission d'accès à l'information du Québec sans délai
- Aviser les personnes concernées en cas de risque sérieux de préjudice
- Documenter l'incident au registre prévu à cet effet (article 3.8 Loi 25)

## Responsable de la protection des renseignements personnels
Le responsable désigné chez {{company.fullName}} est joignable à {{company.email}} ou par téléphone au {{company.phone}}.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 8. Politique propriété intellectuelle
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "ip_policy",
    title: "Politique de propriété intellectuelle",
    category: "legal",
    version: "1.0",
    isRequired: true,
    bodyMarkdown: `# Politique de propriété intellectuelle

**Conformité :** *Loi sur le droit d'auteur* (Canada), *Loi sur les brevets*, *Code civil du Québec*.

**Entre les parties soussignées :**

{{company.fullName}} et {{employee.fullName}}, occupant le poste de {{employee.position}}.

## Objet
La présente politique définit la propriété et l'utilisation des créations intellectuelles produites par l'Employé dans le cadre de ses fonctions chez {{company.fullName}}.

## Cession des droits
Conformément à l'article 13(3) de la *Loi sur le droit d'auteur*, **toutes les œuvres créées par l'Employé dans le cadre de son emploi appartiennent à {{company.fullName}}**, incluant sans s'y limiter :
- Code source, programmes d'automates (PLC, ladder, structured text)
- Configurations HMI et SCADA, recettes, alarmes
- Documentation technique, schémas, plans, manuels
- Procédures, méthodes, savoir-faire documenté
- Bases de données, contenus multimédia, photographies
- Inventions brevetables ou non, modèles industriels

## Renonciation aux droits moraux
L'Employé renonce à ses droits moraux (paternité, intégrité) sur les œuvres créées dans le cadre de son emploi, au bénéfice de {{company.fullName}} et de ses ayants droit, dans la mesure permise par la loi.

## Inventions et brevets
Toute invention conçue par l'Employé pendant son emploi, qu'elle soit réalisée pendant les heures de travail ou non, **si elle est liée aux activités de {{company.fullName}}**, appartient à l'entreprise. L'Employé s'engage à :
- Divulguer rapidement toute invention pertinente
- Signer les documents nécessaires au dépôt de brevet (Canada, États-Unis, international)
- Collaborer activement aux démarches de protection

##Œuvres personnelles préexistantes
Les œuvres créées par l'Employé **avant** son emploi chez {{company.fullName}} demeurent sa propriété. Elles doivent être documentées dans une liste annexée à la présente entente. L'utilisation de ces œuvres dans le cadre de l'emploi confère à {{company.fullName}} une licence d'utilisation perpétuelle, mondiale et libre de redevances.

## Utilisation de code tiers
L'Employé doit respecter les licences applicables au code tiers utilisé (open source, propriétaire). L'incorporation de code sous licence copyleft (GPL, AGPL) dans les livrables clients est soumise à l'approbation préalable de {{company.fullName}}.

## Confidentialité post-emploi
Après la cessation d'emploi, l'Employé :
- Ne peut utiliser, reproduire ou divulguer les œuvres créées chez {{company.fullName}}
- Doit retourner tous les supports physiques et numériques
- Doit supprimer toute copie résiduelle de son matériel personnel

## Sanctions
Toute violation peut entraîner des recours civils (dommages-intérêts, injonction) et, le cas échéant, des poursuites pénales.
${SIGNATURES_BLOCK}`,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // LETTRES (6) — catégorie "lettre"
  // ═══════════════════════════════════════════════════════════════════════

  // ───────────────────────────────────────────────────────────────────────
  // 19. Lettre d'emploi
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "letter_employment_confirmation",
    title: "Lettre d'emploi (banque, location, immigration)",
    category: "lettre",
    version: "1.0",
    isRequired: false,
    bodyMarkdown: `# Lettre d'emploi

{{date.todayFr}}
**À qui de droit,**

Par la présente, {{company.fullName}} confirme que {{employee.fullName}} est à notre emploi depuis le {{employee.startDateFr}} à titre de {{employee.position}} au sein du département {{employee.department}}.

Son salaire annuel actuel est de {{employee.salaryFormatted}}, pour un horaire régulier de {{employee.hoursPerWeek}} heures par semaine.

L'emploi de {{employee.firstName}} est de nature permanente et à temps plein. Aucun préavis de cessation d'emploi n'a été émis à ce jour.

Pour toute vérification supplémentaire, n'hésitez pas à communiquer avec nous au {{company.phone}} ou par courriel à {{company.email}}.

Cordialement,

**{{company.fullName}}**
{{company.address}}

NEQ : {{company.neq}}
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 20. Lettre de promotion
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "letter_promotion",
    title: "Lettre de promotion",
    category: "lettre",
    version: "1.0",
    isRequired: false,
    bodyMarkdown: `# Lettre de promotion

{{date.todayFr}}
**Objet : Confirmation de promotion**

Cher {{employee.firstName}},

Nous sommes heureux de te confirmer ta promotion au poste de **{{employee.position}}** au sein du département {{employee.department}}, avec prise d'effet à compter d'aujourd'hui.

Cette promotion reflète la qualité exceptionnelle de ton travail, ton engagement envers les valeurs de {{company.fullName}} et ta contribution significative au succès de notre équipe {{employee.team}}.

**Nouvelles conditions :**
- Poste : {{employee.position}}
- Salaire annuel : {{employee.salaryFormatted}}
- Heures par semaine : {{employee.hoursPerWeek}} heures
- Supérieur immédiat : {{employee.manager.fullName}}
Les autres conditions de ton contrat de travail demeurent inchangées. Un avenant à ton contrat te sera remis pour signature.

Nous te remercions chaleureusement pour ton dévouement et te souhaitons plein succès dans ces nouvelles responsabilités.

Cordialement,
**{{company.fullName}}**
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 21. Confirmation de salaire
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "letter_salary_confirmation",
    title: "Confirmation de salaire",
    category: "lettre",
    version: "1.0",
    isRequired: false,
    bodyMarkdown: `# Confirmation de salaire

{{date.todayFr}}
**À qui de droit,**

Par la présente, {{company.fullName}} confirme que {{employee.fullName}} occupe le poste de {{employee.position}} depuis le {{employee.startDateFr}}.

**Détails de la rémunération :**
- Salaire annuel brut : {{employee.salaryFormatted}}
- Taux horaire : {{employee.hourlyRate}} $ / heure
- Heures normales par semaine : {{employee.hoursPerWeek}} heures
- Pourcentage de vacances : {{employee.vacationPct}} %
- Mode de versement : dépôt direct, aux deux semaines

L'employé bénéficie également des avantages sociaux offerts par l'entreprise (assurance collective, jours fériés payés, vacances annuelles conformes à la *Loi sur les normes du travail* du Québec).

Pour toute information complémentaire, veuillez communiquer avec notre service des ressources humaines au {{company.phone}} ou par courriel à {{company.email}}.

Cordialement,
**{{company.fullName}}**
NEQ : {{company.neq}}${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 22. Lettre de référence
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "letter_reference",
    title: "Lettre de référence professionnelle",
    category: "lettre",
    version: "1.0",
    isRequired: false,
    bodyMarkdown: `# Lettre de référence professionnelle

{{date.todayFr}}
**À qui de droit,**

C'est avec grand plaisir que je rédige cette lettre de référence pour {{employee.fullName}}, qui a occupé le poste de {{employee.position}} au sein du département {{employee.department}} de {{company.fullName}} depuis le {{employee.startDateFr}}.

Pendant cette période, {{employee.firstName}} a démontré :
- Un grand sens des responsabilités et une rigueur professionnelle exemplaire
- D'excellentes habiletés techniques dans son domaine
- Une capacité avérée à travailler en équipe et à collaborer efficacement
- Un engagement constant envers la qualité et la satisfaction client
- Un professionnalisme exemplaire en toutes circonstances

{{employee.firstName}} a contribué significativement au succès de plusieurs projets et a su s'adapter rapidement aux changements technologiques et organisationnels.

Je recommande sans réserve {{employee.firstName}} et je suis convaincu qu'{{employee.pronoun}} saura apporter une contribution précieuse à toute organisation qui l'accueillera.

Pour toute information supplémentaire, n'hésitez pas à communiquer avec moi au {{company.phone}} ou par courriel à {{company.email}}.

Cordialement,

**{{employee.manager.fullName}}**
{{company.fullName}}${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 23. Avertissement disciplinaire
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "letter_disciplinary_warning",
    title: "Avertissement disciplinaire écrit",
    category: "lettre",
    version: "1.0",
    isRequired: false,
    bodyMarkdown: `# Avertissement disciplinaire

{{date.todayFr}}
- **À l'attention de :** {{employee.fullName}}
- **Poste :** {{employee.position}}
- **Département :** {{employee.department}}
**Objet : Avertissement disciplinaire écrit**

{{employee.firstName}},

Par la présente lettre, {{company.fullName}} te transmet un avertissement écrit formel concernant les manquements professionnels suivants, observés récemment :

**[Description des faits reprochés — à compléter par l'employeur]**

Ces manquements constituent une violation des obligations prévues à ton contrat de travail ainsi que des politiques internes de {{company.fullName}} (code de conduite professionnelle, politiques RH).

**Mesures correctives attendues :**
- [À compléter selon la situation]
- Respect strict des politiques de l'entreprise
- Amélioration mesurable dans les prochains [délai] semaines

**Conséquences en cas de récidive :**
Toute récurrence de manquements similaires pourra entraîner des mesures disciplinaires plus sévères, pouvant aller jusqu'à la suspension sans solde ou le congédiement pour motif sérieux, conformément à la *Loi sur les normes du travail* du Québec.

Le présent avertissement sera versé à ton dossier RH pour une durée de douze (12) mois.

Nous demeurons disponibles pour discuter de la situation et t'accompagner dans la mise en place des mesures correctives.

Cordialement,

**{{employee.manager.fullName}}**
{{company.fullName}}
---

**Accusé de réception**

J'ai pris connaissance du présent avertissement disciplinaire. Ma signature ne constitue pas une admission des faits reprochés, mais uniquement la confirmation que j'ai reçu cette lettre.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 24. Lettre de cessation d'emploi
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "letter_termination",
    title: "Lettre de cessation d'emploi",
    category: "lettre",
    version: "1.0",
    isRequired: false,
    bodyMarkdown: `# Lettre de cessation d'emploi

{{date.todayFr}}
- **À l'attention de :** {{employee.fullName}}
- **Poste :** {{employee.position}}
**Objet : Cessation d'emploi**

{{employee.firstName}},

Par la présente, {{company.fullName}} t'informe que ton emploi à titre de {{employee.position}} prendra fin le **[DATE DE FIN]**, conformément aux dispositions de la *Loi sur les normes du travail* du Québec.

**Préavis légal (article 82 LNT) :**
Selon ton ancienneté depuis le {{employee.startDateFr}}, le préavis applicable est de :
- Moins de 3 mois : aucun préavis requis
- 3 mois à moins d'1 an : 1 semaine
- 1 an à moins de 5 ans : 2 semaines
- 5 ans à moins de 10 ans : 4 semaines
- 10 ans et plus : 8 semaines

**Dispositions finales :**
- Dernier jour de travail : **[DATE]**
- Versement du salaire restant : prochaine paie régulière
- Indemnité de vacances accumulées : versée avec la dernière paie
- Relevé d'emploi (RE) : transmis à Service Canada dans les cinq (5) jours suivant le dernier jour
- T4 et Relevé 1 pour l'année fiscale en cours : transmis avant la fin février

**Restitution des biens :**
Tu devras restituer au plus tard le dernier jour de travail :
- Ordinateur portable, accessoires, écran
- Clés, badges d'accès, cartes professionnelles
- Téléphone cellulaire (le cas échéant)
- Tout autre équipement appartenant à {{company.fullName}}
**Obligations post-emploi :**
Nous te rappelons que les obligations de confidentialité et de non-concurrence prévues à ton contrat demeurent en vigueur après la cessation d'emploi, conformément aux clauses signées.

Nous te remercions pour ta contribution chez {{company.fullName}} et te souhaitons beaucoup de succès dans tes projets futurs.

Cordialement,

**{{employee.manager.fullName}}**
{{company.fullName}}${SIGNATURES_BLOCK}`,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ONBOARDING (4) — catégorie "onboarding"
  // ═══════════════════════════════════════════════════════════════════════

  // ───────────────────────────────────────────────────────────────────────
  // 25. Accusé de réception manuel employé
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "onboarding_manual_acknowledgment",
    title: "Accusé de réception — Manuel de l'employé",
    category: "onboarding",
    version: "1.0",
    isRequired: true,
    bodyMarkdown: `# Accusé de réception — Manuel de l'employé

Je soussigné{{employee.accordE}}, {{employee.fullName}}, occupant le poste de {{employee.position}} au sein de {{company.fullName}}, reconnais par la présente avoir :

- Reçu une copie du manuel de l'employé de {{company.fullName}}
- Pris connaissance des politiques et procédures qui y sont contenues
- Eu l'occasion de poser toutes les questions nécessaires à ma bonne compréhension du document
- Compris que je suis tenu{{employee.accordE}} de respecter l'ensemble des dispositions du manuel pendant la durée de mon emploi

Je m'engage à consulter le manuel régulièrement et à demander des éclaircissements à mon supérieur immédiat {{employee.manager.fullName}} ou au responsable RH en cas de doute.

Je comprends que {{company.fullName}} se réserve le droit de modifier le contenu du manuel en tout temps, et qu'il m'incombe de me tenir informé{{employee.accordE}} des mises à jour.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 26. Inventaire équipement remis
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "onboarding_equipment_inventory",
    title: "Inventaire d'équipement remis à l'employé",
    category: "onboarding",
    version: "1.0",
    isRequired: true,
    bodyMarkdown: `# Inventaire d'équipement remis à l'employé

- **Employé :** {{employee.fullName}}
- **Poste :** {{employee.position}}
- **Date de remise :** {{date.todayFr}}
## Équipement remis

| Catégorie | Description | Numéro de série | État |
|---|---|---|---|
| Ordinateur portable | [Marque, modèle] | [S/N] | Neuf / Usagé bon état |
| Écran externe | [Marque, modèle] | [S/N] | |
| Souris et clavier | | | |
| Téléphone cellulaire | [Marque, modèle] | [IMEI] | |
| Casque audio | | | |
| Sacoche / Étui transport | | | |
| Carte d'accès / Badge | [N°] | | |
| Clé(s) physique(s) | [Description] | | |
| Équipement de protection (EPI) | [Liste] | | |
| Outils techniques | [Liste si applicable] | | |
| Autre | | | |

## Engagement de l'employé

Je soussigné{{employee.accordE}}, {{employee.fullName}}, reconnais avoir reçu en bon état l'équipement listé ci-dessus, appartenant à {{company.fullName}}.

Je m'engage à :
- Utiliser cet équipement de manière responsable, dans le cadre de mes fonctions
- Le maintenir en bon état et signaler sans délai tout bris ou perte
- Le restituer en bon état (usure normale exceptée) lors de mon départ ou sur demande de {{company.fullName}}
- Couvrir les frais de remplacement en cas de perte ou de bris par négligence
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 27. Politique retour au travail post-CNESST
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "onboarding_return_to_work_cnesst",
    title: "Politique de retour au travail post-CNESST",
    category: "onboarding",
    version: "1.0",
    isRequired: false,
    bodyMarkdown: `# Politique de retour au travail post-CNESST

**Conformité :** *Loi sur les accidents du travail et les maladies professionnelles* (LATMP), articles 234 à 246.

**Entre les parties soussignées :**

{{company.fullName}} et {{employee.fullName}}.

## Engagement de l'employeur
{{company.fullName}} s'engage à favoriser le retour au travail prompt et sécuritaire de tout employé absent suite à une lésion professionnelle reconnue par la CNESST, dans le respect des limitations fonctionnelles établies par le médecin traitant.

## Communication pendant l'absence
- Contact régulier (minimum mensuel) avec l'employé absent
- Transmission des nouvelles administratives (paies, paie de vacances, avantages sociaux)
- Soutien dans les démarches auprès de la CNESST

## Retour progressif (assignation temporaire)
Si le médecin traitant autorise un retour à des tâches modifiées :
- L'employeur propose une assignation temporaire compatible avec les limitations
- Le médecin doit signer le formulaire d'assignation (article 179 LATMP)
- La rémunération est maintenue au niveau du salaire pré-lésion

## Retour définitif
Lors du retour à temps plein :
- Réintégration au poste prélésion ou à un poste équivalent
- Adaptation ergonomique du poste si nécessaire
- Formation de rafraîchissement si l'absence a duré plus de 6 mois

## Droit de retour au travail
L'employé conserve son droit de retour pendant :
- **Un (1) an** si l'entreprise compte 20 employés ou moins
- **Deux (2) ans** si l'entreprise compte plus de 20 employés

## Engagement de l'employé
- Collaborer activement avec son médecin traitant et la CNESST
- Respecter les limitations fonctionnelles établies
- Informer rapidement l'employeur de toute évolution de sa condition
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 28. Acceptation politique vacances annuelles
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "onboarding_vacation_policy_acceptance",
    title: "Acceptation de la politique de vacances annuelles",
    category: "onboarding",
    version: "1.0",
    isRequired: true,
    bodyMarkdown: `# Acceptation de la politique de vacances annuelles

**Conformité :** *Loi sur les normes du travail* du Québec, articles 66 à 77.

**Entre les parties soussignées :**

{{company.fullName}} et {{employee.fullName}}.

## Année de référence
L'année de référence pour le calcul des vacances chez {{company.fullName}} s'étend du **1er mai au 30 avril** de l'année suivante, conformément à la *Loi sur les normes du travail*.

## Durée des vacances
- **Moins de 1 an de service** : 1 jour par mois complet (max 2 semaines)
- **1 an à moins de 3 ans** : 2 semaines (indemnité 4%)
- **3 ans et plus** : 3 semaines (indemnité 6%)
- **10 ans et plus** : à confirmer selon politique interne

## Indemnité de vacances
Le taux applicable pour {{employee.fullName}} est de **{{employee.vacationPct}} %** de la rémunération brute gagnée pendant l'année de référence.

## Période de prise des vacances
- Les vacances doivent être prises dans les **douze (12) mois** suivant la fin de l'année de référence
- Le calendrier des vacances est établi conjointement entre l'employé et son supérieur immédiat
- Pour les périodes très demandées (été, fêtes), {{company.fullName}} utilise un système de sélection avec attribution selon l'ancienneté (vacation bidding)
- Préavis minimum : **sept (7) jours** pour les demandes courantes

## Fractionnement
Les vacances peuvent être prises en blocs d'une (1) semaine ou plus. Sur demande de l'employé, des fractions plus petites (journées isolées) peuvent être accordées sous réserve des besoins opérationnels.

## Engagement de l'employé
Je reconnais avoir pris connaissance de la politique de vacances annuelles de {{company.fullName}} et m'engage à respecter les délais de demande et les procédures établies.
${SIGNATURES_BLOCK}`,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // POLITIQUES GÉNÉRALES SUPPLÉMENTAIRES (12)
  // ═══════════════════════════════════════════════════════════════════════

  // ───────────────────────────────────────────────────────────────────────
  // 29. Politique de cybersécurité d'entreprise
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "cybersecurity_policy",
    title: "Politique de cybersécurité d'entreprise",
    category: "policy",
    version: "1.0",
    isRequired: true,
    bodyMarkdown: `# Politique de cybersécurité d'entreprise

**Politique applicable à tous les employés de {{company.fullName}}.**

## Objet
La présente politique définit les règles de cybersécurité applicables à l'ensemble des systèmes d'information de {{company.fullName}} et de ses clients, en conformité avec la *Loi 25* et les meilleures pratiques de l'industrie.

## Authentification et accès
- **Authentification multifacteur (AMF)** obligatoire pour : courriel, VPN, accès aux systèmes clients, dépôts Git, plateformes infonuagiques
- Comptes utilisateurs nominatifs : aucun partage de compte
- Principe du moindre privilège : accès accordés selon le strict besoin opérationnel
- Révocation immédiate des accès lors d'un départ ou changement de poste
- Verrouillage automatique de session après 10 minutes d'inactivité

## Postes de travail
- Antivirus à jour en permanence (déploiement centralisé)
- Mises à jour de sécurité (OS, navigateurs, logiciels métiers) appliquées dans les 14 jours
- Chiffrement du disque dur (BitLocker ou FileVault) obligatoire sur tous les portables
- Verrouillage manuel obligatoire avant toute absence du poste

## Phishing et ingénierie sociale
- Aucune information confidentielle transmise par courriel non chiffré
- Vérification téléphonique systématique pour toute demande de transfert de fonds ou changement bancaire
- Signalement immédiat à l'équipe TI de tout courriel suspect (bouton « Signaler » dans Outlook)
- Formation annuelle obligatoire sur la sécurité de l'information

## Données clients
- Stockage uniquement sur les espaces approuvés (SharePoint, OneDrive entreprise, dépôts internes)
- Interdiction stricte d'utiliser des services personnels (Gmail, Dropbox perso, clés USB non chiffrées)
- Toute exfiltration nécessite une autorisation écrite du supérieur immédiat

## Incidents
Tout incident réel ou suspecté (perte d'appareil, intrusion, divulgation accidentelle) doit être signalé sans délai au responsable TI et au responsable de la protection des renseignements personnels ({{company.email}}), conformément à l'article 3.5 de la Loi 25.

## Sanctions
Le non-respect de la présente politique peut entraîner des mesures disciplinaires pouvant aller jusqu'au congédiement pour motif sérieux, sans préjudice des recours civils ou pénaux applicables.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 30. Politique de gestion des mots de passe
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "password_policy",
    title: "Politique de gestion des mots de passe",
    category: "policy",
    version: "1.0",
    isRequired: true,
    bodyMarkdown: `# Politique de gestion des mots de passe

**Politique applicable à tous les employés de {{company.fullName}}.**

## Objet
Définir les exigences minimales pour la création, le stockage et la gestion des mots de passe utilisés dans le cadre du travail.

## Complexité minimale
Tout mot de passe professionnel doit respecter :
- **Longueur minimale : 14 caractères** (16 pour les comptes à privilèges)
- Combinaison de majuscules, minuscules, chiffres et caractères spéciaux
- Aucun mot du dictionnaire, prénom, date de naissance, nom de l'entreprise ou du client
- Aucune réutilisation des 12 derniers mots de passe
- Aucun mot de passe identique entre comptes professionnels et personnels

## Phrase de passe (recommandée)
L'utilisation de phrases de passe (4 à 6 mots sans rapport, ex. : « cheval-bleu-tournevis-44-érable ») est privilégiée à l'aide-mémoire et à la robustesse.

## Gestionnaire de mots de passe
{{company.fullName}} fournit un gestionnaire de mots de passe d'entreprise (1Password, Bitwarden ou équivalent). Son utilisation est **obligatoire** pour :
- Tous les comptes professionnels nominatifs
- Les comptes clients et VPN
- Les clés API et secrets techniques

## Rotation
- Comptes à privilèges (admin domaine, base de données, infrastructure) : rotation tous les **90 jours**
- Comptes utilisateurs standards : rotation uniquement en cas de soupçon de compromission
- Aucune notation papier, aucun stockage dans un fichier texte non chiffré

## Partage et délégation
- Le partage direct de mots de passe est interdit
- Pour collaborer, utiliser la fonction de partage chiffré du gestionnaire approuvé
- Les comptes partagés (legacy) doivent être migrés vers des comptes nominatifs dans les meilleurs délais

## Compromission
En cas de doute (alerte d'accès, hameçonnage suspecté, perte d'appareil) : changer immédiatement le mot de passe concerné et signaler à l'équipe TI.

## Sanctions
Le non-respect peut entraîner la suspension d'accès, des mesures disciplinaires et, en cas de négligence grave ayant causé un incident, le congédiement pour motif sérieux.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 31. Politique BYOD
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "byod_policy",
    title: "Politique BYOD (apporter son propre appareil)",
    category: "policy",
    version: "1.0",
    isRequired: false,
    bodyMarkdown: `# Politique BYOD — Apporter son propre appareil

**Politique applicable à tous les employés de {{company.fullName}}.**

## Objet
Encadrer l'utilisation d'appareils personnels (téléphone, tablette, ordinateur) pour effectuer du travail pour {{company.fullName}}, dans le respect de la sécurité et de la *Loi 25*.

## Appareils admissibles
- Téléphones intelligents iOS 16+ ou Android 12+
- Tablettes équivalentes
- Ordinateurs portables uniquement sur autorisation écrite du responsable TI

Aucun appareil rooté, jailbreaké ou non maintenu par son éditeur n'est admissible.

## Conditions techniques obligatoires
- Verrouillage par mot de passe ou biométrie
- Chiffrement de l'appareil activé
- Système d'exploitation à jour
- Inscription au gestionnaire d'appareils mobiles (MDM) de {{company.fullName}}
- Compartimentation des données professionnelles dans un profil dédié (work profile Android, Managed Apps iOS)

## Usages autorisés
- Courriel professionnel via l'application Outlook gérée
- Messagerie d'équipe (Teams)
- Accès à l'agenda professionnel
- Authentification multifacteur (application authentificatrice)

## Usages interdits
- Stockage local de fichiers clients ou de code source
- Capture d'écran de contenus confidentiels
- Utilisation de réseaux Wi-Fi publics sans VPN
- Installation d'applications de productivité non approuvées pour traiter des données du travail
- Connexion à des bornes de recharge USB publiques sans bloqueur de données

## Effacement à distance
L'{{employee.employed}} consent à l'effacement à distance du profil professionnel par {{company.fullName}} en cas de :
- Perte ou vol de l'appareil
- Cessation d'emploi
- Soupçon de compromission

L'effacement vise uniquement les données professionnelles ; les données personnelles ne sont pas affectées par cette opération.

## Responsabilités financières
{{company.fullName}} ne couvre pas les frais d'achat, de réparation ou de forfait cellulaire des appareils personnels, sauf entente écrite spécifique.

## Révocation
L'admissibilité au BYOD peut être révoquée en tout temps en cas de non-conformité.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 32. Politique médias sociaux
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "social_media_policy",
    title: "Politique d'utilisation des médias sociaux",
    category: "policy",
    version: "1.0",
    isRequired: false,
    bodyMarkdown: `# Politique d'utilisation des médias sociaux

**Politique applicable à tous les employés de {{company.fullName}}.**

## Objet
Encadrer l'utilisation des médias sociaux (LinkedIn, Facebook, Instagram, X, TikTok, YouTube, blogues, forums) tant à titre personnel que professionnel, lorsqu'un lien est susceptible d'être fait avec {{company.fullName}}.

## Usage personnel
L'{{employee.employed}} demeure libre d'exprimer ses opinions personnelles à condition de :
- Préciser clairement que les propos n'engagent que lui/elle
- Ne pas se présenter comme porte-parole de {{company.fullName}}
- Respecter la confidentialité (aucune mention de clients, projets, négociations en cours)
- Respecter les collègues et la dignité humaine
- S'abstenir de tout contenu discriminatoire, haineux ou diffamatoire

## Représentation officielle de l'entreprise
Seules les personnes désignées sont autorisées à publier au nom de {{company.fullName}} sur les comptes officiels. Les communications de presse ou réponses à des médias passent obligatoirement par la direction.

## Contenu visuel
- Aucune photo prise en chantier client sans autorisation écrite du client ET de {{company.fullName}}
- Aucun code source, schéma électrique, ou écran HMI ne doit apparaître dans une publication
- Les badges, uniformes et logos clients doivent être floutés ou retirés

## LinkedIn
- Les fonctions actuelles doivent refléter fidèlement la réalité du poste
- Recommandations professionnelles : permises et encouragées
- Sollicitation active de clients de {{company.fullName}} interdite pendant l'emploi et pour 12 mois suivant la cessation (article 2089 C.c.Q.)

## Réseaux sociaux et heures de travail
L'usage personnel des médias sociaux pendant les heures de travail doit demeurer occasionnel et raisonnable. Il ne doit pas nuire à la productivité ni à la sécurité (interdiction stricte pendant les interventions terrain).

## Plaintes et signalements
Tout contenu signalé comme problématique sera évalué par les RH. Les mesures peuvent aller de l'avertissement au congédiement pour motif sérieux.

## Présomption de bonne foi
La présente politique n'a pas pour effet de restreindre l'exercice légitime des droits prévus à la *Charte des droits et libertés de la personne* du Québec, notamment la liberté d'expression.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 33. Politique cadeaux et hospitalité
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "gifts_hospitality_policy",
    title: "Politique sur les cadeaux et l'hospitalité",
    category: "policy",
    version: "1.0",
    isRequired: true,
    bodyMarkdown: `# Politique sur les cadeaux et l'hospitalité

**Politique applicable à tous les employés de {{company.fullName}}.**

## Principe
{{company.fullName}} entretient des relations d'affaires basées sur la qualité, la compétitivité et l'intégrité. Aucun cadeau ou marque d'hospitalité ne doit influencer (ni paraître influencer) une décision d'affaires.

## Cadeaux acceptables
Sont généralement acceptables, sans déclaration préalable :
- Objets promotionnels symboliques (stylos, calendriers, casquettes) d'une valeur inférieure à **50 $**
- Repas d'affaires modestes en présence de l'interlocuteur
- Cartes de Noël et de saison

## Cadeaux à déclarer
Doivent faire l'objet d'une déclaration écrite à {{employee.manager.fullName}} :
- Cadeaux d'une valeur unitaire entre **50 $ et 200 $**
- Invitations à des événements (gala, spectacle, événement sportif)
- Voyages, hébergements ou formations offerts par un fournisseur ou un client

## Cadeaux interdits
Sont strictement interdits, sans exception :
- Sommes d'argent, virements, chèques-cadeaux échangeables contre des espèces
- Cadeaux de plus de **200 $**
- Cadeaux conditionnels à une décision (attribution de contrat, recommandation, signature)
- Cadeaux destinés à des proches de l'{{employee.employed}}
- Cadeaux reçus dans le cadre d'un processus d'appel d'offres en cours

## Refus poli
En cas de refus, l'{{employee.employed}} peut invoquer la présente politique. Un modèle de courriel de refus est disponible auprès des RH.

## Conformité anti-corruption
La présente politique est complémentaire à la *Loi sur la corruption d'agents publics étrangers* (Canada) et à la *Loi concernant la lutte contre la corruption* (Québec). Aucun paiement de facilitation, pot-de-vin ou autre avantage indu n'est toléré.

## Sanctions
Toute violation peut entraîner des mesures disciplinaires pouvant aller jusqu'au congédiement pour motif sérieux et, le cas échéant, des poursuites pénales.

## Registre des cadeaux
Les RH tiennent un registre confidentiel des déclarations, accessible aux fins d'audit.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 34. Politique anti-corruption / anti-pots-de-vin
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "anti_corruption_policy",
    title: "Politique anti-corruption et anti-pots-de-vin",
    category: "policy",
    version: "1.0",
    isRequired: true,
    bodyMarkdown: `# Politique anti-corruption et anti-pots-de-vin

**Politique applicable à tous les employés de {{company.fullName}}.**

**Conformité légale :** *Loi sur la corruption d'agents publics étrangers* (LCAPE, Canada), *Loi concernant la lutte contre la corruption* (Québec, c. L-6.1), *Code criminel* (art. 119 à 125).

## Engagement
{{company.fullName}} adopte la tolérance zéro envers toute forme de corruption, qu'elle soit active ou passive, directe ou indirecte, dans toutes ses relations d'affaires au Québec, au Canada ou à l'étranger.

## Définitions
- **Corruption :** offrir, promettre, donner, solliciter ou recevoir un avantage indu en vue d'influencer une décision
- **Pot-de-vin :** somme ou avantage versé en échange d'une faveur
- **Paiement de facilitation :** petit montant versé à un agent public pour accélérer un acte administratif courant — **strictement interdit**
- **Agent public :** fonctionnaire, élu, employé d'une société d'État ou d'une organisation internationale

## Comportements interdits
- Offrir ou promettre tout avantage à un agent public ou privé en vue d'obtenir un contrat, un permis, une approbation
- Verser des commissions occultes ou des « frais de consultant » non justifiés
- Faire transiter des paiements par des intermédiaires sans contrôle ni justification
- Utiliser des dons politiques ou caritatifs comme paravent à un paiement illicite
- Recevoir un avantage en échange d'une influence sur une décision d'affaires

## Diligence raisonnable sur les partenaires
Avant tout engagement significatif avec un agent commercial, distributeur, sous-traitant ou partenaire, les RH et la direction effectuent une vérification appropriée (antécédents, réputation, propriété effective).

## Livres et registres
Toutes les transactions doivent être documentées avec précision et reflétées fidèlement dans la comptabilité. La création de comptes occultes, de fausses factures ou de paiements non documentés est interdite.

## Mécanisme de signalement
Tout employé qui constate ou soupçonne un acte de corruption doit le signaler :
- À son supérieur immédiat
- Ou à {{company.email}} (canal confidentiel)
- Ou anonymement via le mécanisme externe désigné

Aucune représaille ne sera tolérée envers une personne signalant de bonne foi (protection des lanceurs d'alerte).

## Sanctions
Toute violation entraînera des mesures disciplinaires pouvant aller jusqu'au congédiement pour motif sérieux. Des poursuites criminelles peuvent également être engagées, conformément au *Code criminel* canadien.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 35. Politique langue française (Loi 96)
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "french_language_policy_law96",
    title: "Politique sur la langue française (conformité Loi 96)",
    category: "policy",
    version: "1.0",
    isRequired: true,
    bodyMarkdown: `# Politique sur la langue française

**Conformité légale :** *Charte de la langue française* (RLRQ c. C-11), telle que modifiée par la *Loi 96*.

**Politique applicable à tous les employés de {{company.fullName}}.**

## Principe
Le français est la langue normale et habituelle du travail chez {{company.fullName}}. La présente politique vise à garantir le respect du droit fondamental de tout employé de travailler en français au Québec.

## Communications internes
Toute communication interne (notes de service, courriels d'équipe, présentations, formations, manuels) est rédigée et tenue en français.

## Documents employés
Sont obligatoirement remis en français :
- Offre d'emploi
- Contrat de travail individuel
- Avenants au contrat
- Évaluations de rendement
- Mesures disciplinaires
- Politiques internes
- Communications relatives aux conditions d'emploi (paies, vacances, avantages sociaux)

Une version dans une autre langue peut être fournie en complément à la demande de l'{{employee.employed}}, sans jamais se substituer à la version française.

## Affichage et avis
L'affichage interne (sécurité, instructions, panneaux, étiquettes) est en français. Tout texte en anglais, le cas échéant, doit être de taille égale ou inférieure au texte français.

## Outils technologiques
{{company.fullName}} s'efforce de fournir des logiciels disposant d'une interface en français lorsque cela est techniquement réalisable. Pour les logiciels métiers spécialisés sans interface française disponible (B&R Automation Studio, certaines plateformes FANUC), une documentation d'accompagnement en français est fournie.

## Relations avec la clientèle au Québec
Les communications écrites et orales avec la clientèle au Québec sont prioritairement en français, sauf demande explicite du client.

## Connaissance d'une autre langue
La connaissance d'une autre langue que le français n'est exigée que lorsqu'elle est objectivement nécessaire à l'accomplissement des tâches (relation avec des clients hors Québec, documentation technique étrangère). Cette exigence est documentée dans la description de poste, conformément à l'article 46 de la Charte.

## Recours
Tout employé qui estime ses droits linguistiques bafoués peut s'adresser au responsable RH ou, directement, à l'**Office québécois de la langue française (OQLF)**.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 36. Politique d'accommodation religieuse
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "religious_accommodation_policy",
    title: "Politique d'accommodation religieuse",
    category: "policy",
    version: "1.0",
    isRequired: false,
    bodyMarkdown: `# Politique d'accommodation religieuse

**Conformité :** *Charte des droits et libertés de la personne* du Québec, articles 10 et 20.

**Politique applicable à tous les employés de {{company.fullName}}.**

## Principe
{{company.fullName}} reconnaît le droit fondamental de tout employé à la liberté de religion. L'Employeur s'engage à étudier toute demande d'accommodation raisonnable visant à concilier les croyances ou pratiques religieuses avec les exigences du travail.

## Demandes admissibles (exemples non limitatifs)
- Aménagement d'horaire pour fêtes religieuses non statutaires
- Pauses ponctuelles pour prière
- Adaptations vestimentaires compatibles avec les exigences de sécurité (EPI, équipement de protection)
- Régimes alimentaires lors d'événements organisés par l'entreprise
- Espace de recueillement (selon disponibilité)

## Processus
1. L'{{employee.employed}} soumet sa demande par écrit à son supérieur immédiat ou aux RH
2. La demande est analysée dans un délai raisonnable (généralement 10 jours ouvrables)
3. Une rencontre est organisée pour discuter des options
4. Une réponse motivée est transmise par écrit

## Limite : contrainte excessive
L'employeur peut refuser ou modifier une demande qui constituerait une **contrainte excessive**, notamment en raison de :
- Coût disproportionné
- Atteinte significative à la sécurité (LSST)
- Impact opérationnel majeur ou ingérable pour l'équipe
- Atteinte aux droits d'autres employés

Toute décision de refus est motivée par écrit.

## Confidentialité
Les motifs de la demande sont traités avec discrétion et ne sont partagés qu'avec les personnes ayant strictement besoin de les connaître pour mettre en œuvre l'accommodement.

## Non-discrimination
Aucune mesure de représailles ne sera prise contre une personne ayant formulé une demande d'accommodation religieuse. Toute discrimination fondée sur la religion est strictement interdite.

## Recours
En cas de désaccord persistant, l'{{employee.employed}} peut s'adresser à la **Commission des droits de la personne et des droits de la jeunesse** du Québec.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 37. Politique grossesse et congé parental
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "parental_leave_policy",
    title: "Politique grossesse, maternité, paternité et congé parental",
    category: "policy",
    version: "1.0",
    isRequired: true,
    bodyMarkdown: `# Politique grossesse, maternité, paternité et congé parental

**Conformité :** *Loi sur les normes du travail* (art. 81.2 à 81.17), *Régime québécois d'assurance parentale* (RQAP), *Loi sur la santé et la sécurité du travail* (programme « Pour une maternité sans danger »).

**Politique applicable à tous les employés de {{company.fullName}}.**

## Engagement
{{company.fullName}} soutient les employés dans la planification et la prise des congés liés à la naissance ou à l'adoption d'un enfant, dans le plein respect des protections prévues par la loi.

## Congé de maternité
- **Durée :** jusqu'à **18 semaines** consécutives (art. 81.4 LNT)
- Peut débuter au plus tôt 16 semaines avant la date prévue d'accouchement
- Préavis écrit de 3 semaines à l'employeur (avec certificat médical)
- Prestations RQAP selon le régime choisi (de base ou particulier)

## Congé de paternité
- **Durée :** jusqu'à **5 semaines** consécutives (art. 81.2 LNT)
- À prendre dans les 78 semaines suivant la naissance
- Préavis écrit de 3 semaines à l'employeur

## Congé parental
- **Durée :** jusqu'à **65 semaines** consécutives (art. 81.10 LNT)
- Accessible aux deux parents (peut être partagé)
- Prestations RQAP selon le régime choisi

## Congé pour adoption
Mêmes protections que les congés parentaux pour les enfants adoptés.

## Programme « Pour une maternité sans danger » (CNESST)
Une employée enceinte ou qui allaite et dont le travail comporte des risques peut demander un retrait préventif. {{company.fullName}} collabore avec la CNESST pour :
- Identifier les risques (exposition à des produits chimiques, port de charges, postures, etc.)
- Proposer une réaffectation à des tâches sans danger
- À défaut, autoriser le retrait préventif rémunéré

## Protection de l'emploi
À l'issue du congé, l'{{employee.employed}} retrouve son poste habituel ou un poste comparable, avec les mêmes avantages, le même salaire (indexé selon la politique) et la même ancienneté.

## Accumulation des avantages
Pendant les congés, l'{{employee.employed}} continue d'accumuler de l'ancienneté. Les régimes d'assurance collective sont maintenus, sous réserve du paiement de la portion employé applicable.

## Aménagement du retour
{{company.fullName}} favorise un retour progressif lorsque possible (horaire allégé pendant 2 à 4 semaines, télétravail partiel). Toute demande d'aménagement permanent doit être soumise aux RH.

## Allaitement
Des pauses d'allaitement ou de tirage du lait peuvent être accordées, et un espace privé et propre est mis à disposition à cette fin.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 38. Politique violence en milieu de travail
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "workplace_violence_policy",
    title: "Politique de prévention de la violence en milieu de travail",
    category: "policy",
    version: "1.0",
    isRequired: true,
    bodyMarkdown: `# Politique de prévention de la violence en milieu de travail

**Conformité :** *Loi sur la santé et la sécurité du travail* (art. 51), *Code civil du Québec* (art. 2087), *Charte des droits et libertés*.

**Politique applicable à tous les employés de {{company.fullName}}.**

## Principe
Tout employé a droit à un milieu de travail exempt de violence physique, verbale ou psychologique, qu'elle provienne d'un collègue, d'un supérieur, d'un subordonné, d'un client ou d'un tiers.

## Définition
Constitue de la violence en milieu de travail tout comportement ou geste qui :
- Cause ou peut causer un préjudice physique
- Cause ou peut causer un préjudice psychologique (intimidation, menaces, propos hostiles répétés)
- Inclut le harcèlement, le sabotage de travail, la cyberintimidation et les menaces de mort

La présente politique est complémentaire à la *Politique de prévention du harcèlement psychologique et sexuel*.

## Comportements interdits
- Coups, bousculades, voies de fait
- Menaces verbales ou écrites (y compris par courriel, messagerie, médias sociaux)
- Intimidation, mise à l'écart organisée
- Possession ou usage d'armes sur les lieux de travail ou en chantier client
- Comportements menaçants envers une personne ou ses proches

## Risques particuliers au métier
{{company.fullName}} reconnaît certains risques spécifiques :
- Interventions en chantier dans des sites isolés
- Travail en horaire atypique ou de nuit
- Travail en présence de tiers (sous-traitants, employés du client)
- Conflits liés à la conduite de véhicule (rage au volant)

Des mesures préventives sont mises en place : protocoles de communication terrain, équipements de signalement d'urgence, jumelage en cas de risque accru.

## Signalement
Tout incident doit être signalé sans délai :
- Pour danger immédiat : composer le 911
- À {{employee.manager.fullName}} ou au responsable RH dans les 24 heures
- Par courriel à {{company.email}} pour les situations moins urgentes

## Enquête et mesures
{{company.fullName}} s'engage à mener une enquête rapide, impartiale et confidentielle. Des mesures provisoires peuvent être prises (séparation des parties, suspension administrative). Les sanctions peuvent inclure le congédiement et la dénonciation aux autorités policières.

## Soutien aux victimes
Programme d'aide aux employés (PAE) confidentiel offert. Soutien à la démarche judiciaire le cas échéant. Aucune représaille tolérée à l'égard d'une personne signalant de bonne foi.

## Formation
Une formation de sensibilisation est offerte à tous les employés à l'embauche, puis aux deux ans.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 39. Politique vestimentaire
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "dress_code_policy",
    title: "Politique vestimentaire",
    category: "policy",
    version: "1.0",
    isRequired: false,
    bodyMarkdown: `# Politique vestimentaire

**Politique applicable à tous les employés de {{company.fullName}}.**

## Principe
La tenue vestimentaire doit refléter le professionnalisme de {{company.fullName}}, garantir la sécurité de l'{{employee.employed}} et favoriser le confort pour l'exécution des tâches.

## Bureau (administratif, ventes, ingénierie)
Tenue **business casual** :
- Pantalons, jupes, jeans propres et non troués
- Chemises, polos, chandails à manches courtes ou longues
- Souliers fermés ou propres
- Bermudas et sandales tolérés en période estivale, sous réserve des exigences de la journée (rencontre client, visite atelier)

À éviter en présence de clients : casquettes, vêtements de plage, vêtements à messages provocants.

## Atelier et chantier client (technique, automatisation)
Le port des équipements de protection individuelle (EPI) est **obligatoire et primaire** :
- Bottes de sécurité CSA (embout d'acier, semelle antiperforation)
- Lunettes de sécurité
- Casque de sécurité lorsque exigé par le client ou l'analyse de risque
- Vêtements ignifuges (arc flash) lorsque exigé par la nature des travaux
- Veste haute visibilité sur les sites où elle est requise
- Gants adaptés à la tâche
- Protection auditive en zone bruyante

{{company.fullName}} fournit les EPI conformes aux normes CSA et CNESST.

## Rencontres clients formelles, événements
Tenue d'affaires soignée requise : pantalon habillé, chemise, chaussures de ville. Les femmes peuvent opter pour un tailleur, une robe ou une combinaison équivalente.

## Logos et identification
Le port du polo ou de la veste brodés au logo {{company.fullName}} est encouragé lors des interventions chez les clients. Aucun vêtement aux couleurs d'un concurrent direct n'est toléré pendant les heures de travail.

## Hygiène
Une hygiène corporelle adéquate est attendue. Les parfums forts sont à éviter (allergies des collègues et des clients).

## Tatouages et perçages
Les tatouages et perçages visibles sont permis, à l'exception de symboles haineux, vulgaires ou contraires aux valeurs d'inclusion de l'entreprise.

## Accommodements
Les demandes d'accommodement (médicales, religieuses) sont étudiées conformément à la politique applicable, dans les limites de la sécurité au travail.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 40. Politique présence et ponctualité
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "attendance_policy",
    title: "Politique de présence et de ponctualité",
    category: "policy",
    version: "1.0",
    isRequired: true,
    bodyMarkdown: `# Politique de présence et de ponctualité

**Politique applicable à tous les employés de {{company.fullName}}.**

## Principe
La présence régulière et la ponctualité sont essentielles à la bonne marche des opérations de {{company.fullName}} et au respect des engagements pris envers les clients.

## Horaire de travail
- Les horaires sont définis par contrat individuel ({{employee.hoursPerWeek}} heures par semaine)
- Les variations d'horaire ponctuelles doivent être approuvées par {{employee.manager.fullName}}
- Pour les techniciens en chantier, l'horaire est ajusté aux besoins des clients (jour, soir, fin de semaine, sur appel)

## Système de pointage
L'{{employee.employed}} doit pointer ses heures via le système de pointage électronique de {{company.fullName}} :
- À l'arrivée et au départ
- À chaque transition de projet ou de tâche facturable
- Toute correction doit être soumise et approuvée par le supérieur immédiat dans les 5 jours ouvrables

## Retards
- Tout retard de plus de 15 minutes doit être signalé sans délai au supérieur immédiat
- Les retards répétés non justifiés font l'objet d'un suivi formel
- Au-delà de 3 retards non justifiés dans une période de 30 jours, une mesure disciplinaire peut être appliquée

## Absences non prévues
- Aviser le supérieur immédiat **avant** le début du quart de travail
- Pour une absence pour maladie, un certificat médical peut être exigé après 3 jours consécutifs
- Une absence non avisée pendant 3 jours consécutifs peut être considérée comme un abandon de poste

## Absences planifiées
- Les vacances, congés personnels et formations doivent être demandés à l'avance via le portail RH
- Préavis minimum : 7 jours pour les courtes absences, 30 jours pour les vacances de plus d'une semaine
- L'approbation est sujette aux besoins opérationnels et au principe d'équité

## Absences pour obligations familiales (art. 79.7 LNT)
L'{{employee.employed}} peut s'absenter jusqu'à **10 journées par année** pour obligations familiales ou parentales (les deux premières journées sont rémunérées après 3 mois de service continu).

## Conséquences
Le non-respect de la présente politique peut entraîner :
- Avertissement verbal puis écrit
- Suspension sans solde
- En cas d'absentéisme chronique non motivé : congédiement administratif

## Communication
Pour signaler une absence : appel téléphonique direct au supérieur immédiat (un courriel ou SMS seul ne suffit pas pour les absences imprévues).
${SIGNATURES_BLOCK}`,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // POLITIQUES SANTÉ SÉCURITÉ TERRAIN (9)
  // ═══════════════════════════════════════════════════════════════════════

  // ───────────────────────────────────────────────────────────────────────
  // 41. Programme cadenassage LOTO
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "loto_lockout_program",
    title: "Programme de cadenassage (LOTO) et contrôle des énergies",
    category: "policy",
    version: "1.0",
    isRequired: true,
    targetDepartments: ["Technique", "Ingénierie", "Automatisation"],
    bodyMarkdown: `# Programme de cadenassage (LOTO) et contrôle des énergies dangereuses

**Conformité légale :** *Règlement sur la santé et la sécurité du travail* (RSST), article 188.2 et suivants, *Loi sur la santé et la sécurité du travail* (LSST). Norme CSA Z460.

**Politique applicable à tous les employés de {{company.fullName}} effectuant des interventions d'entretien, de réparation ou de mise en service sur des équipements industriels.**

## Objet et champ d'application
Le présent programme vise à protéger tous les travailleurs contre les démarrages accidentels et la libération d'énergies dangereuses (électrique, mécanique, hydraulique, pneumatique, thermique, chimique, gravitationnelle) lors de toute intervention sur des équipements industriels, conformément à l'article 188.2 RSST.

## Identification des énergies
Avant toute intervention, l'intervenant identifie :
- La source d'énergie principale (panneau, sectionneur)
- Toutes les énergies résiduelles (condensateurs, ressorts comprimés, fluides sous pression, charges suspendues)
- Toutes les sources d'énergie auxiliaires (alimentation de secours, automate, démarrage à distance)

## Procédure de cadenassage en 7 étapes
1. **Préparation et notification** : aviser l'opérateur et le donneur d'ouvrage ; obtenir l'autorisation
2. **Arrêt de l'équipement** : selon la procédure normale du fabricant
3. **Isolement** : couper toutes les sources d'énergie identifiées
4. **Cadenassage** : poser son cadenas personnel et identifié sur chaque dispositif d'isolement
5. **Étiquetage** : apposer l'étiquette de mise en garde avec nom, date, motif
6. **Dissipation des énergies résiduelles** : purges, mises à la terre, blocage mécanique
7. **Vérification (« essai de démarrage négatif »)** : tenter de démarrer l'équipement pour confirmer l'absence d'énergie ; mesurer avec un détecteur de tension

## Cadenas personnel
- Chaque intervenant possède son **propre cadenas à clé unique**, identifié à son nom
- Aucun partage de cadenas
- Aucun cadenas commun ne peut servir de substitut
- Les cadenas sont fournis par {{company.fullName}}
## Travail en équipe
Lorsque plusieurs personnes interviennent sur le même équipement, **chaque intervenant pose son propre cadenas** (boîte de cadenassage multipoints utilisée au besoin). Aucun retrait d'un cadenas par une autre personne n'est permis.

## Levée du cadenassage
Seul le **poseur du cadenas** peut le retirer, après :
- Avoir vérifié la sécurité de la zone
- Avoir réinstallé les protecteurs et dispositifs de sécurité
- Avoir avisé l'opérateur

En cas d'absence du poseur, une procédure exceptionnelle de retrait par le superviseur s'applique (formulaire écrit, tentative de joindre le poseur, vérification rigoureuse).

## Cadenassage chez le client
Lorsque {{company.fullName}} intervient sur un site client, le programme du client prévaut s'il est plus contraignant. À défaut, le présent programme s'applique.

## Formation et habilitation
Tous les intervenants reçoivent une formation théorique et pratique :
- À l'embauche
- Aux 3 ans (recyclage obligatoire)
- Lors de l'introduction de nouveaux équipements
- Documentation conservée au dossier RH (LSST art. 51.1)

## Documentation
Une fiche de cadenassage est rédigée pour chaque équipement type, indiquant les énergies, les points d'isolement et la séquence. Ces fiches sont disponibles auprès de {{employee.manager.fullName}}.

## Sanctions
Le non-respect du présent programme constitue un manquement grave aux obligations de l'{{employee.employed}} (art. 49 LSST) et peut entraîner des mesures disciplinaires pouvant aller jusqu'au congédiement pour motif sérieux, sans préjudice des recours pénaux applicables.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 42. Politique EPI
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "ppe_policy",
    title: "Politique sur les équipements de protection individuelle (EPI)",
    category: "policy",
    version: "1.0",
    isRequired: true,
    targetDepartments: ["Technique", "Ingénierie", "Automatisation"],
    bodyMarkdown: `# Politique sur les équipements de protection individuelle (EPI)

**Conformité :** *Loi sur la santé et la sécurité du travail* (art. 51), *Règlement sur la santé et la sécurité du travail* (RSST), normes CSA et ANSI applicables.

**Politique applicable à tous les employés de {{company.fullName}} exposés à des risques en atelier ou en chantier.**

## Principe
Les EPI constituent la **dernière ligne de défense** contre les risques résiduels après élimination, substitution et mesures d'ingénierie. {{company.fullName}} fournit gratuitement les EPI requis et veille à leur utilisation conforme.

## EPI de base (obligatoires en chantier)
- **Bottes de sécurité** CSA grade 1 (embout d'acier, semelle antiperforation)
- **Lunettes de sécurité** CSA Z94.3
- **Casque de sécurité** CSA Z94.1 (classe E pour risque électrique)
- **Veste haute visibilité** ANSI/ISEA 107 classe 2 ou 3 selon le contexte
- **Gants** adaptés (mécaniques, électriques diélectriques, anti-coupure)
- **Protection auditive** en zone supérieure à 85 dB

## EPI spécialisés selon les risques
- **Travaux électriques sous tension :** vêtements résistants à l'arc électrique (catégorie selon analyse), gants diélectriques classe 00 à 4 testés annuellement, visière arc flash
- **Soudage :** masque autoassombrissant, gants de soudeur, tablier en cuir
- **Espaces clos :** harnais, détecteur 4 gaz, masque respiratoire
- **Travail en hauteur :** harnais antichute CSA Z259.10 et système d'arrêt de chute
- **Produits chimiques :** gants nitrile ou butyle, lunettes étanches, protection respiratoire si requise

## Inspection et entretien
- Inspection visuelle avant chaque utilisation
- Tout EPI endommagé doit être retiré du service et remplacé sans délai
- Les EPI à durée de vie limitée (harnais, casques) sont remplacés selon les recommandations du fabricant
- Les gants diélectriques sont testés annuellement par un laboratoire accrédité

## Fourniture
{{company.fullName}} fournit les EPI à l'embauche et lors du remplacement. L'{{employee.employed}} doit signaler tout besoin de remplacement à {{employee.manager.fullName}}.

## Responsabilités de l'{{employee.employed}} (art. 49 LSST)
- Porter les EPI requis en tout temps dans les zones désignées
- Maintenir les EPI en bon état et propres
- Signaler immédiatement tout EPI défectueux
- Refuser d'effectuer un travail si les EPI requis ne sont pas disponibles ou conformes

## Visiteurs et sous-traitants
Toute personne pénétrant dans une zone à risque doit porter les EPI applicables. {{company.fullName}} met à disposition des EPI de visite.

## Sanctions
Le non-port intentionnel d'un EPI requis constitue une violation grave pouvant mener à des mesures disciplinaires jusqu'au congédiement, et peut entraîner une amende pénale (LSST art. 236).
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 43. Politique espaces clos
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "confined_spaces_policy",
    title: "Politique sur le travail en espaces clos",
    category: "policy",
    version: "1.0",
    isRequired: false,
    targetDepartments: ["Technique", "Ingénierie", "Automatisation"],
    bodyMarkdown: `# Politique sur le travail en espaces clos

**Conformité :** *Règlement sur la santé et la sécurité du travail* (RSST), section XXVI (art. 297 à 312), norme CSA Z1006.

**Politique applicable à tous les employés de {{company.fullName}} susceptibles d'intervenir dans des espaces clos chez des clients industriels.**

## Définition (art. 1 RSST)
Un **espace clos** est un espace totalement ou partiellement fermé, non conçu pour être occupé par des personnes, possédant des moyens d'entrée et de sortie restreints, présentant des risques en raison de son atmosphère, de sa configuration ou de son contenu (silos, réservoirs, fosses, conduites, cuves, trémies).

## Risques principaux
- Atmosphères dangereuses (manque d'oxygène, gaz toxiques, vapeurs inflammables)
- Engloutissement (grain, liquides, matières en vrac)
- Coincement
- Énergies dangereuses (LOTO requis)
- Chaleur extrême

## Interdiction sans autorisation
**Aucun employé de {{company.fullName}} ne pénètre dans un espace clos sans :**
- Une **autorisation écrite** (permis d'entrée) signée par le superviseur et le donneur d'ouvrage
- Une analyse de risques préalable
- Des tests atmosphériques (O₂, LIE, H₂S, CO) avant et pendant l'intervention
- Un surveillant à l'extérieur pendant toute la durée de l'intervention
- Un plan de sauvetage opérationnel

## Conditions atmosphériques sécuritaires
- Oxygène : entre 19,5% et 23%
- Gaz inflammables : moins de 10% de la LIE
- H₂S : moins de 10 ppm
- CO : moins de 25 ppm
Au-delà de ces seuils, ventilation forcée obligatoire ou équipement respiratoire autonome.

## Équipement minimal
- Détecteur 4 gaz calibré et fonctionnel
- Harnais de sauvetage et treuil
- Communication bidirectionnelle (radio, ligne de vie)
- Ventilateur portatif
- Éclairage 12V antidéflagrant si requis

## Formation obligatoire
Tout intervenant et surveillant doit avoir suivi une formation reconnue d'au moins **8 heures**, mise à jour aux 3 ans.

## Politique d'abstention
En cas de doute sur la sécurité ou en l'absence de l'un des éléments ci-dessus, l'intervenant a le droit et le devoir de **refuser l'entrée** (LSST art. 12). Ce refus ne peut donner lieu à aucune sanction.

## Coordination avec le client
Lorsque {{company.fullName}} intervient sur un site client, le programme d'espaces clos du client s'applique en plus du présent programme. Un permis d'entrée client est exigé.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 44. Politique travail en hauteur
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "working_at_heights_policy",
    title: "Politique sur le travail en hauteur",
    category: "policy",
    version: "1.0",
    isRequired: false,
    targetDepartments: ["Technique", "Ingénierie", "Automatisation"],
    bodyMarkdown: `# Politique sur le travail en hauteur

**Conformité :** *Règlement sur la santé et la sécurité du travail* (RSST), articles 346 et suivants, *Code de sécurité pour les travaux de construction* (CSTC) S-2.1, r.4.

**Politique applicable à tous les employés de {{company.fullName}} susceptibles de travailler en hauteur.**

## Principe et seuil d'application
La protection contre les chutes est requise dès qu'un travailleur :
- Risque une chute de plus de **3 mètres** (hauteur générale)
- Travaille au-dessus d'un équipement dangereux (peu importe la hauteur)
- Travaille sur un toit en pente
- Travaille à proximité d'une ouverture (puits, trémie)

## Hiérarchie des mesures de protection
1. **Élimination** du travail en hauteur (préfabrication au sol)
2. **Protection collective** : garde-corps, plateforme, échafaudage conforme
3. **Restreinte** : système qui empêche d'atteindre la zone de chute
4. **Arrêt de chute** : harnais + ligne de vie + ancrage (en dernier recours)

## Équipements antichutes
- **Harnais complet** CSA Z259.10, classe A
- **Cordon d'assujettissement** CSA Z259.11 avec absorbeur d'énergie
- **Ancrage** capable de soutenir **22,2 kN** (~5 000 lb) par travailleur
- **Casque** muni d'une jugulaire (Z94.1 type 2 recommandé)

## Plan de sauvetage
Toute opération impliquant l'arrêt de chute doit comporter un **plan de sauvetage écrit** prévoyant la récupération d'un travailleur suspendu en moins de **15 minutes** (risque de syndrome du harnais).

## Échelles
- Échelle inclinée selon le ratio 4:1 (1 m d'éloignement pour 4 m de hauteur)
- Dépassement de 1 m au-dessus du palier
- Trois points de contact en tout temps
- Aucun travail prolongé depuis une échelle

## Plateformes élévatrices (nacelles, chariots)
- Formation conforme à la norme CSA B354 obligatoire (carte attestant)
- Harnais antichute en tout temps dans la nacelle
- Inspection visuelle quotidienne
- Aucune utilisation par vents > 45 km/h ou orage électrique

## Échafaudages
- Montage et démontage par personnel formé
- Inspection avant chaque quart par un travailleur compétent
- Étiquette d'inspection visible (vert = conforme, jaune = restrictions, rouge = interdit)

## Conditions météo
Toute intervention extérieure en hauteur est suspendue en cas d'orage, de pluie verglaçante, de vents > 45 km/h ou de visibilité réduite.

## Droit de refus
L'{{employee.employed}} qui juge les conditions dangereuses doit refuser le travail et aviser son superviseur (LSST art. 12). Aucune représaille tolérée.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 45. Politique manipulation produits chimiques (SIMDUT)
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "chemical_handling_simdut",
    title: "Politique sur la manipulation de produits chimiques (SIMDUT 2015)",
    category: "policy",
    version: "1.0",
    isRequired: true,
    targetDepartments: ["Technique", "Ingénierie", "Automatisation"],
    bodyMarkdown: `# Politique sur la manipulation de produits chimiques — SIMDUT 2015

**Conformité :** *Loi sur les produits dangereux* (Canada), *Règlement sur les produits dangereux*, *Règlement sur l'information concernant les produits dangereux* (Québec, RIPD), SIMDUT 2015 (SGH).

**Politique applicable à tous les employés de {{company.fullName}}.**

## Principe
{{company.fullName}} s'engage à assurer la manipulation sécuritaire de tous les produits chimiques utilisés en atelier ou en chantier, conformément aux exigences du SIMDUT 2015 harmonisé avec le SGH.

## Formation obligatoire
Tout employé exposé à des produits dangereux doit avoir suivi la formation SIMDUT 2015 :
- À l'embauche, avant la première exposition
- Lors de l'introduction d'un nouveau produit
- Au minimum aux 3 ans

## Étiquetage
- **Étiquette du fournisseur** : sur le contenant d'origine (pictogrammes SGH, mentions de danger, conseils de prudence)
- **Étiquette du lieu de travail** : sur tout contenant secondaire ou décanté (nom du produit, principaux dangers, référence à la FDS)

Aucun contenant sans étiquette n'est toléré.

## Fiches de données de sécurité (FDS)
- Une FDS conforme et à jour (moins de 3 ans) doit être disponible pour chaque produit
- Les FDS sont accessibles au format papier et numérique en tout temps
- En chantier, l'{{employee.employed}} a accès aux FDS via tablette ou téléphone

## Stockage
- Selon les incompatibilités (acides séparés des bases, oxydants des combustibles)
- Dans des armoires ventilées pour les solvants
- Sous bac de rétention pour les liquides
- Étiquetage clair des zones de stockage

## EPI requis (selon le produit)
- Gants chimiquement résistants (consulter la FDS section 8)
- Lunettes étanches ou écran facial
- Tablier ou combinaison
- Protection respiratoire si indiquée
- Douche oculaire et douche d'urgence à proximité

## Manipulation
- Travailler sous ventilation appropriée
- Aucune consommation alimentaire à proximité
- Aucun transvasement par aspiration buccale
- Refermer le contenant immédiatement après usage

## Gestion des déchets
Les déchets chimiques sont collectés dans des contenants identifiés et éliminés via un fournisseur autorisé (jamais à l'égout). Tenue d'un registre.

## Déversement et urgence
- Petit déversement : utiliser la trousse d'absorption et signaler
- Déversement important : évacuer, isoler la zone, appeler le 911 et signaler à Urgence-Environnement (1 866 694-5454)
- Éclaboussure oculaire : rincer 15 minutes à la douche oculaire et consulter un médecin

## Tenue de registre
{{company.fullName}} tient à jour un inventaire des produits dangereux utilisés et conserve les FDS.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 46. Politique conduite véhicule entreprise
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "company_vehicle_policy",
    title: "Politique sur la conduite d'un véhicule de l'entreprise",
    category: "policy",
    version: "1.0",
    isRequired: false,
    targetDepartments: ["Technique", "Ingénierie", "Automatisation", "Ventes"],
    bodyMarkdown: `# Politique sur la conduite d'un véhicule de l'entreprise

**Conformité :** *Code de la sécurité routière* du Québec, *Loi sur la santé et la sécurité du travail*.

**Politique applicable à tous les employés de {{company.fullName}} autorisés à conduire un véhicule de l'entreprise.**

## Conditions préalables
- Détenir un **permis de conduire valide** de la classe appropriée (classe 5 minimum)
- Avoir fourni un **dossier de conduite SAAQ** propre (analysé par les RH)
- Avoir signé le présent document
- Être âgé{{employee.accordE}} d'au moins 21 ans pour conduire les véhicules de plus de 3 500 kg

L'{{employee.employed}} doit informer sans délai son supérieur en cas de suspension, retrait ou changement de classe de son permis.

## Usages autorisés
- Déplacements professionnels (chantier, livraison, formation)
- Trajet domicile-bureau si véhicule attribué nominalement
- Usage personnel **autorisé** uniquement avec accord écrit (avantage imposable à déclarer)

## Usages interdits
- Transport de passagers non liés à l'entreprise (sauf urgence)
- Remorquage non autorisé
- Conduite hors Canada continental sans autorisation écrite
- Toute activité illégale

## Conduite responsable
- Respecter rigoureusement le Code de la sécurité routière
- Aucune utilisation du téléphone tenu en main (mode mains libres obligatoire, art. 443.1 CSR)
- Boucler la ceinture en tout temps
- Vitesse adaptée aux conditions (neige, pluie, brouillard)
- Aucune consommation d'alcool, cannabis ou drogue avant et pendant la conduite

## Entretien
L'{{employee.employed}} doit :
- Effectuer la vérification visuelle quotidienne (huile, pneus, liquides, feux)
- Signaler tout bris ou défectuosité à {{employee.manager.fullName}}
- Faire effectuer l'entretien régulier (changement d'huile, pneus, etc.) selon le calendrier

## Carburant et frais
- Carburant payé via la carte d'essence fournie ou remboursé sur reçu
- Aucun achat personnel imputé à la carte
- Reçus conservés pour fins comptables

## Accidents
En cas d'accident, peu importe la gravité :
1. Sécuriser les lieux et porter assistance
2. Appeler le 911 si blessés ou dommages > 2 000 $
3. Compléter le constat amiable
4. **Aviser {{employee.manager.fullName}} dans les 24 heures**
5. Soumettre un rapport écrit dans les 48 heures
6. Aucune négociation, aucune admission de responsabilité au tiers

## Contraventions et infractions
Toute contravention est à la charge personnelle du conducteur. Une accumulation excessive (3 contraventions / 12 mois ou 4 points d'inaptitude) peut entraîner la révocation du privilège de conduire un véhicule de l'entreprise.

## Restitution
Le véhicule doit être restitué propre, complet (clés, carte d'essence, papiers d'immatriculation) au plus tard le dernier jour de travail.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 47. Politique déplacement chez client
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "client_site_visit_policy",
    title: "Politique de déplacement et de comportement chez le client",
    category: "policy",
    version: "1.0",
    isRequired: true,
    targetDepartments: ["Technique", "Ingénierie", "Automatisation", "Ventes"],
    bodyMarkdown: `# Politique de déplacement et de comportement chez le client

**Politique applicable à tous les employés de {{company.fullName}} se déplaçant chez des clients.**

## Représentation de {{company.fullName}}

Chaque employé en déplacement chez un client représente l'image, les valeurs et le professionnalisme de {{company.fullName}}. Son comportement engage la réputation de l'entreprise.

## Préparation
Avant chaque déplacement :
- Confirmer le rendez-vous (date, heure, lieu, contact)
- Vérifier les exigences spécifiques du site (EPI, formation accueil, billet d'avion, hôtel)
- Avoir en main : badge, carte professionnelle, ordre de travail
- Vérifier l'équipement requis (laptop, programmeur, câbles, outils)

## Sécurité au site client
- Suivre la **séance d'accueil sécurité** obligatoire à l'arrivée
- Respecter les règles du client (vitesse, zones interdites, EPI)
- Suivre le programme de cadenassage du client (ou celui de {{company.fullName}} si plus contraignant)
- En cas de doute : **arrêter et consulter** {{employee.manager.fullName}}
## Comportement professionnel
- Ponctualité absolue
- Tenue vestimentaire conforme à la politique applicable (atelier ou bureau)
- Respect des interlocuteurs : langage courtois, écoute active
- Aucun commentaire négatif sur le client, ses équipements ou la concurrence devant des tiers
- Aucune photo, vidéo ou capture d'écran sans autorisation écrite du client

## Confidentialité
- Toute information vue ou entendue chez un client est confidentielle (Loi 25 et entente NDA)
- Ne pas discuter des affaires d'un client devant un autre client
- Ne pas comparer publiquement les clients entre eux

## Réseautage et invitations
- Repas d'affaires : acceptables si dans les limites de la politique cadeaux
- Invitations à des événements : signaler à {{employee.manager.fullName}}
- Aucun acceptation d'avantage personnel important

## Frais de déplacement
- Voyage : avion classe économique (sauf vol > 6 h sur approbation)
- Hôtel : catégorie milieu de gamme, à proximité du site client
- Repas : indemnités quotidiennes selon la politique RH
- Frais kilométriques : remboursés au taux ARC/RQ en vigueur
- Reçus obligatoires pour tout remboursement
- Soumission de la note de frais dans les 14 jours suivant le retour

## Imprévus et urgences
En cas d'imprévu (annulation, problème technique majeur, accident) : aviser {{employee.manager.fullName}} dans les meilleurs délais.

## Comportement hors heures
Lors de déplacements impliquant un séjour hôtelier, l'{{employee.employed}} demeure ambassadeur de {{company.fullName}} :
- Modération dans la consommation d'alcool
- Aucun usage de substances illicites
- Aucun comportement susceptible de nuire à la réputation

## Couverture CNESST
Les accidents survenus dans le cadre d'un déplacement professionnel sont couverts par la CNESST. Tout incident doit être déclaré sans délai.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 48. Politique premiers secours
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "first_aid_policy",
    title: "Politique sur les premiers secours et les secouristes",
    category: "policy",
    version: "1.0",
    isRequired: false,
    bodyMarkdown: `# Politique sur les premiers secours et les secouristes

**Conformité :** *Règlement sur les normes minimales de premiers secours et de premiers soins* (CNESST), *Loi sur la santé et la sécurité du travail*.

**Politique applicable à tous les employés de {{company.fullName}}.**

## Engagement
{{company.fullName}} s'assure qu'en tout temps, un nombre suffisant de secouristes certifiés est disponible sur les lieux de travail pour intervenir en cas de blessure ou de malaise.

## Nombre minimal de secouristes
- 1 secouriste pour 1 à 50 employés présents
- 1 secouriste additionnel par tranche de 100 employés
- Pour les chantiers : au moins 1 secouriste par équipe sur place

## Certification des secouristes
- Formation reconnue par la CNESST (cours de **Secourisme en milieu de travail**, 16 heures)
- Recyclage obligatoire aux **3 ans**
- Frais et heures de formation entièrement assumés par {{company.fullName}}
- Liste des secouristes affichée dans les zones communes

## Trousses de premiers secours
- Composition conforme à l'annexe du Règlement CNESST
- Une trousse fixe au siège social, vérifiée mensuellement
- Une trousse mobile dans chaque véhicule de service
- Une trousse mobile pour les déplacements en chantier

## Registre des incidents
Tout incident, blessure ou malaise (même mineur) doit être consigné au **registre des premiers secours**, conformément à l'art. 280 LATMP. Le registre contient :
- Date et heure
- Personne concernée
- Description de la blessure
- Soins prodigués
- Nom du secouriste

## Intervention
En présence d'une blessure :
1. **Évaluer la sécurité** (sa propre sécurité d'abord)
2. **Alerter** un secouriste et appeler le 911 si grave
3. **Secourir** dans la limite des compétences
4. **Documenter** au registre

## Téléphones d'urgence
Affichés à proximité des téléphones :
- 911 (urgences)
- Centre antipoison du Québec : 1 800 463-5060
- Info-Santé : 811
- Coordonnées du secouriste de garde

## Réception des soins
{{company.fullName}} n'oblige aucun employé à recevoir des soins. L'{{employee.employed}} peut refuser ou demander un transport ambulancier. Tout transport médical lié au travail est couvert par la CNESST.

## Confidentialité
Les informations médicales recueillies dans le cadre des premiers secours sont confidentielles et conservées sous la responsabilité des RH.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 49. Politique déclaration incidents
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "incident_reporting_policy",
    title: "Politique de déclaration des incidents et quasi-accidents",
    category: "policy",
    version: "1.0",
    isRequired: true,
    bodyMarkdown: `# Politique de déclaration des incidents et quasi-accidents

**Conformité :** *Loi sur les accidents du travail et les maladies professionnelles* (LATMP), *Loi sur la santé et la sécurité du travail* (LSST), exigences CNESST.

**Politique applicable à tous les employés de {{company.fullName}}.**

## Principe
La déclaration de tous les incidents — y compris les quasi-accidents — est un outil essentiel d'amélioration continue de la santé et sécurité chez {{company.fullName}}. Aucune représaille ne sera tolérée à l'égard d'une personne signalant de bonne foi.

## Définitions
- **Accident du travail** : événement imprévu attribuable à toute cause survenant à une personne par le fait ou à l'occasion de son travail, lui causant une lésion professionnelle (art. 2 LATMP)
- **Incident** : événement non désiré ayant causé un dommage matériel sans blessure
- **Quasi-accident** : événement non désiré qui aurait pu causer une blessure ou un dommage, mais qui s'est terminé sans conséquence (« passé proche »)

## Obligation de déclarer
Tout employé qui :
- Subit un accident ou une blessure
- Est témoin d'un accident
- Constate une situation dangereuse ou un quasi-accident

doit le signaler **immédiatement** à son supérieur immédiat {{employee.manager.fullName}} et compléter le formulaire de déclaration dans les **24 heures**.

## Soins médicaux
- Pour blessure grave : composer le 911
- Pour blessure mineure : premiers secours sur place, puis consultation au besoin
- L'employé blessé a le **libre choix** de son médecin et de son établissement de soins (art. 192 LATMP)
- Les frais de consultation et de transport sont remboursés par la CNESST

## Démarches CNESST
En cas d'accident avec arrêt de travail :
- L'Employeur remplit l'**Avis de l'employeur et demande de remboursement (ADR)**
- L'Employé remplit la **Réclamation du travailleur** (formulaire 1939)
- L'Employeur transmet les documents à la CNESST dans les délais légaux
- L'Employeur verse les premiers 14 jours d'indemnité (90% du salaire net)

## Enquête interne
Pour tout accident avec blessure ou tout quasi-accident à fort potentiel :
- Enquête menée par le comité SST ou la direction
- Identification des causes (immédiates et profondes)
- Mise en place de mesures correctives
- Suivi documenté

## Registre
{{company.fullName}} tient un registre confidentiel des incidents conforme à l'art. 280 LATMP, conservé minimum **5 ans**.

## Décès ou accident grave
En cas de décès ou de blessure grave, l'Employeur **doit aviser la CNESST sans délai** (art. 62 LSST), préserver les lieux dans l'état où ils se trouvaient au moment de l'accident, et collaborer à l'enquête de l'inspecteur CNESST.

## Représailles interdites
Aucune mesure de représailles (congédiement, suspension, rétrogradation) ne peut être prise contre un employé qui :
- Déclare un accident
- Exerce son droit de refus
- Collabore à une enquête CNESST

Tout manquement à cette règle expose l'Employeur à des poursuites pénales et civiles.
${SIGNATURES_BLOCK}`,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // POLITIQUES TECHNIQUES (6)
  // ═══════════════════════════════════════════════════════════════════════

  // ───────────────────────────────────────────────────────────────────────
  // 50. Politique gestion code source
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "source_code_management_policy",
    title: "Politique de gestion du code source",
    category: "policy",
    version: "1.0",
    isRequired: true,
    targetPositions: ["Programmeur automatisation", "Programmeur robotique", "Ingénieur logiciel / automatisation"],
    targetDepartments: ["Ingénierie", "Automatisation"],
    bodyMarkdown: `# Politique de gestion du code source

**Politique applicable à tous les employés de {{company.fullName}} impliqués dans le développement de code, de configurations ou de programmes d'automates.**

## Principe
Tout code source produit chez {{company.fullName}} est un actif stratégique de l'entreprise et doit être versionné, documenté et protégé selon les règles établies.

## Système de versionnage
- **Git** est l'outil de versionnage standard de {{company.fullName}}
- Hébergement sur les dépôts internes (serveur Git d'entreprise ou GitHub Enterprise)
- Aucun code professionnel ne doit être hébergé sur un compte Git personnel (GitHub.com perso, GitLab perso)
- Les programmes d'automates B&R, Allen-Bradley, Siemens et FANUC sont également versionnés (export texte structuré, snapshots binaires)

## Modèle de branches
- **main** (ou master) : code stable, mis en production, protégé
- **develop** : intégration des fonctionnalités
- **feature/*** : développement d'une fonctionnalité
- **hotfix/*** : correctif urgent en production
- **release/*** : préparation d'une livraison client

Les branches main et develop sont protégées : aucun push direct, intégration par pull request uniquement.

## Commits
- Messages clairs et concis, **en anglais ou en français** selon le projet
- Une seule modification logique par commit
- Référence au ticket / numéro de demande client lorsque applicable
- Aucun secret (mot de passe, clé API, certificat) ne doit être commité

## Revue de code (pull requests)
- Toute modification doit faire l'objet d'une pull request
- Approbation par au moins **un pair** avant fusion
- Pour les changements critiques (sécurité, code production client) : double approbation incluant un ingénieur senior

## Documentation
Chaque dépôt doit contenir :
- Un fichier README à jour (objectif, dépendances, démarrage rapide)
- Une documentation technique des fonctions clés
- Un journal de versions (CHANGELOG)
- Les schémas d'architecture si pertinents

## Secrets et configurations sensibles
- Utiliser le coffre-fort de secrets approuvé (Azure Key Vault, AWS Secrets Manager ou équivalent)
- Aucun secret en clair dans le code
- Variables d'environnement séparées pour dev, test, production

## Sauvegardes
Les dépôts internes sont sauvegardés quotidiennement avec une rétention minimale de 30 jours. Pour les projets clients critiques, une copie est également remise au client à la livraison finale (sous réserve de l'entente contractuelle).

## Code legacy et code client
- Le code legacy hérité de clients ou de fournisseurs doit être documenté quant à son origine et à sa licence
- L'incorporation de bibliothèques tierces nécessite une vérification de la licence (interdiction GPL/AGPL dans les livrables clients sans approbation)

## Départ d'un employé
À la cessation d'emploi :
- Tous les accès aux dépôts sont révoqués
- Aucune copie locale ne peut être conservée
- Une attestation de suppression est signée
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 51. Politique licences logicielles
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "software_license_policy",
    title: "Politique de gestion des licences logicielles",
    category: "policy",
    version: "1.0",
    isRequired: true,
    targetDepartments: ["Ingénierie", "Automatisation", "Technique"],
    bodyMarkdown: `# Politique de gestion des licences logicielles

**Politique applicable à tous les employés de {{company.fullName}} utilisant des logiciels professionnels.**

## Principe
Tous les logiciels utilisés dans le cadre du travail doivent être acquis et utilisés conformément à leur licence. {{company.fullName}} interdit strictement l'utilisation de logiciels non autorisés, piratés ou hors licence.

## Logiciels métiers principaux
{{company.fullName}} détient des licences pour, sans s'y limiter :
- **B&R Automation Studio** (programmation PLC B&R)
- **Siemens TIA Portal** (S7-1200, S7-1500, WinCC)
- **Allen-Bradley Studio 5000 / RSLogix 5000** (ControlLogix, CompactLogix)
- **FANUC ROBOGUIDE et Teach Pendant Programming (TPP)**
- **AutoCAD / AutoCAD Electrical**
- **EPLAN Electric P8**
- **SolidWorks**
- **Microsoft 365**
- **Outils de développement** (Visual Studio, JetBrains, etc.)

## Acquisition
- Toute nouvelle licence est acquise par {{employee.manager.fullName}} ou les TI, jamais directement par l'employé
- Aucun achat personnel n'est remboursé sans approbation préalable écrite
- Les licences sont enregistrées dans un inventaire centralisé

## Types de licences
- **Nominative** : attribuée à une personne précise, non transférable
- **Flottante** (jeton) : partagée via un serveur de licences (limite simultanée)
- **Site / volume** : pour l'ensemble du site ou un nombre prédéterminé de postes
- **Abonnement** : renouvelé selon la fréquence convenue

L'{{employee.employed}} doit respecter le type d'utilisation prévu par chaque licence.

## Interdictions
- Aucune copie ou installation au-delà du nombre de postes licenciés
- Aucun partage de clé de licence avec une personne externe
- Aucune utilisation d'une licence sur du matériel personnel sans autorisation
- Aucune désactivation de mécanisme de gestion de licences
- Aucun usage d'outils piratés (cracks, keygens, versions « warez »)

## Logiciels libres et open source
- Acceptables sous réserve de respect de la licence (MIT, Apache 2.0, BSD : permissifs ; GPL/AGPL : copyleft à valider)
- L'incorporation dans un livrable client nécessite la validation de la compatibilité juridique
- Tenir un inventaire des composants open source utilisés (SBOM)

## Logiciels personnels
L'installation de logiciels personnels (jeux, lecteurs vidéo, outils de productivité non approuvés) sur les postes de travail est interdite, sauf approbation préalable des TI.

## Audit
{{company.fullName}} se réserve le droit d'auditer en tout temps les installations logicielles sur ses postes. Tout logiciel non autorisé sera supprimé sans préavis.

## Sanctions
Le non-respect peut entraîner :
- Mesures disciplinaires pouvant aller jusqu'au congédiement
- Recours civils ou pénaux des éditeurs en cas de contrefaçon (*Loi sur le droit d'auteur*)
- Recours en responsabilité personnelle si dommage causé à l'entreprise

## Départ d'un employé
À la cessation d'emploi, toutes les licences nominatives sont récupérées et désactivées. L'{{employee.employed}} ne peut conserver aucune copie.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 52. Politique PI étendue
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "ip_assignment_extended_policy",
    title: "Politique de propriété intellectuelle étendue — Cession explicite",
    category: "policy",
    version: "1.0",
    isRequired: true,
    targetPositions: ["Programmeur automatisation", "Programmeur robotique", "Ingénieur logiciel / automatisation", "Concepteur / Dessinateur"],
    targetDepartments: ["Ingénierie", "Automatisation"],
    bodyMarkdown: `# Politique de propriété intellectuelle étendue — Cession explicite

**Conformité :** *Loi sur le droit d'auteur* (Canada, L.R.C. 1985, c. C-42, art. 13(3)), *Code civil du Québec* (art. 2087 et 2088), *Loi sur les brevets* (Canada).

**Politique applicable à tous les employés de {{company.fullName}} créant du code, des schémas, des dessins ou toute autre œuvre dans le cadre de leurs fonctions.**

## Objet
La présente politique précise et **renforce explicitement** les dispositions de la *Politique de propriété intellectuelle* générale, afin de couvrir tous les actifs intellectuels stratégiques de {{company.fullName}}, notamment les codes sources et plans techniques.

## Cession expresse à {{company.fullName}}

L'{{employee.employed}} **cède irrévocablement, dès leur création**, à {{company.fullName}} la totalité des droits patrimoniaux portant sur les œuvres suivantes produites dans le cadre de son emploi :

- **Codes sources** : programmes informatiques en tout langage (C, C++, C#, Python, JavaScript/TypeScript, etc.)
- **Programmes d'automates** : Ladder (LD), Function Block Diagram (FBD), Structured Text (ST), Instruction List (IL), Sequential Function Chart (SFC) pour toute plateforme PLC (B&R, Allen-Bradley, Siemens, Schneider, Omron, etc.)
- **Programmes de robots** : TPP FANUC, RAPID ABB, KRL KUKA, etc.
- **Configurations HMI/SCADA** : WinCC, FactoryTalk View, B&R MappView, Ignition, etc.
- **Schémas et plans** : AutoCAD, AutoCAD Electrical, EPLAN, SolidWorks (mécanique et électrique)
- **Documentation technique** : manuels, procédures, recettes, journaux de mise en service
- **Bases de données** : structures, scripts, requêtes
- **Algorithmes** : méthodes de contrôle, recettes propriétaires, calculs spécifiques
- **Inventions** : brevetables ou non, modèles industriels
- **Toute œuvre dérivée** des éléments ci-dessus

## Portée géographique et temporelle
La cession est :
- **Mondiale** (tous les territoires)
- **Perpétuelle** (durée de protection légale maximale)
- **Exclusive** à {{company.fullName}}
-**Libre de redevances** (aucune compensation additionnelle au salaire)
- **Cumulative** avec tous les droits prévus par la loi en faveur de l'employeur

## Renonciation aux droits moraux
Dans la mesure permise par la *Loi sur le droit d'auteur*, l'{{employee.employed}} **renonce expressément** à ses droits moraux (paternité et intégrité de l'œuvre) au bénéfice de {{company.fullName}} et de ses ayants droit, qui peuvent :
- Modifier les œuvres sans avis
- Les utiliser sans mention du nom de l'auteur
- Les associer à des produits, services ou marques
- Les exploiter commercialement sans rémunération supplémentaire

## Inventions et brevets
Pour toute invention conçue pendant l'emploi et liée aux activités de {{company.fullName}} :
- L'{{employee.employed}} divulgue **sans délai** l'invention à son supérieur
- L'{{employee.employed}} signe **tous les documents** nécessaires aux dépôts de brevet (Canada, États-Unis, OMPI)
- {{company.fullName}} assume les frais
- L'{{employee.employed}} peut être nommé{{employee.accordE}} comme inventeur (droit moral) sans en être le propriétaire

##Œuvres préexistantes
Pour préserver les œuvres antérieures, l'{{employee.employed}} doit déposer une **annexe écrite** listant les œuvres créées avant son embauche (dépôts publics, projets personnels, code open source). À défaut, toutes les œuvres seront présumées créées en cours d'emploi.

## Restriction post-emploi
Après la cessation d'emploi, l'{{employee.employed}} :
- Ne peut **réutiliser, modifier, distribuer ou publier** le code, les schémas ou les programmes produits chez {{company.fullName}}
- Doit **détruire toutes copies locales** (postes personnels, cloud personnel, courriels)
- Ne peut prétendre à un droit moral lui permettant d'exiger le retrait ou la modification des œuvres

## Confidentialité du code source client
Le code et les programmes développés pour un client spécifique sont **doublement protégés** :
- Propriété de {{company.fullName}} ou du client selon le contrat
- Couvert par la confidentialité (NDA signé)
- Aucune réutilisation chez un autre client sans autorisation expresse

## Open source publié
Si {{company.fullName}} décide de publier certains éléments en open source, la décision appartient exclusivement à la direction. L'{{employee.employed}} ne peut publier de code professionnel à titre personnel sans autorisation écrite.

## Sanctions
Toute violation peut donner lieu à :
- Mesures disciplinaires jusqu'au congédiement pour motif sérieux
- Recours civils (injonction, dommages-intérêts)
- Poursuites pénales (contrefaçon, vol de secret commercial)
- Engagement de la responsabilité personnelle de l'{{employee.employed}}

## Effet cumulatif
La présente politique s'ajoute aux clauses de cession de PI prévues au contrat individuel et à la politique de propriété intellectuelle générale, et ne s'y substitue pas.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 53. Politique backup et DR
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "backup_disaster_recovery_policy",
    title: "Politique de sauvegarde et de reprise après sinistre",
    category: "policy",
    version: "1.0",
    isRequired: false,
    targetDepartments: ["Ingénierie", "Automatisation", "Administration"],
    bodyMarkdown: `# Politique de sauvegarde et de reprise après sinistre

**Politique applicable à tous les employés de {{company.fullName}} impliqués dans la gestion ou la production de données.**

## Principe
{{company.fullName}} met en œuvre une stratégie de sauvegarde rigoureuse pour assurer la continuité de ses activités et protéger les actifs informationnels des clients contre les pertes, sinistres et cyberattaques.

## Règle 3-2-1
La stratégie de sauvegarde repose sur la règle internationale **3-2-1** :
- **3 copies** de chaque donnée critique
- Sur **2 supports différents** (disque, cloud)
- Dont **1 hors site** (géographiquement distinct)

## Périmètre des sauvegardes
Sont sauvegardés au minimum :
- Dépôts de code source (Git internes)
- Bases de données de production (clients et internes)
- Fichiers de configuration des projets clients (PLC, HMI, SCADA, robot)
- Plans, schémas et documentation technique (AutoCAD, EPLAN, SolidWorks)
- Courriels et données collaboratives (Microsoft 365, OneDrive, SharePoint)
- Comptabilité et données financières

## Fréquence
- **Sauvegardes incrémentales** : quotidiennes
- **Sauvegardes complètes** : hebdomadaires
- **Conservation** : 7 jours en accès rapide, 90 jours en archive, 1 an pour fins légales
- **Données fiscales** : 7 ans (obligation Revenu Québec / ARC)

## Tests de restauration
{{company.fullName}} effectue des **tests de restauration trimestriels** pour valider l'intégrité et la disponibilité des sauvegardes. Les résultats sont documentés.

## Chiffrement
Les sauvegardes contenant des données sensibles ou des renseignements personnels (Loi 25) sont **chiffrées au repos et en transit** (AES-256).

## Plan de reprise (DRP)
Un **plan de reprise après sinistre** documenté définit :
- Les **RTO** (Recovery Time Objective) pour chaque système critique
- Les **RPO** (Recovery Point Objective) maximaux tolérés
- Les rôles et responsabilités en cas de sinistre
- Les procédures de communication interne et avec les clients
- Le site de repli (cloud secondaire)

## Continuité chez le client
Pour les projets clients critiques, {{company.fullName}} remet au client une **copie complète et documentée** des programmes, configurations et sauvegardes au moment de la livraison finale et à chaque mise à jour majeure, sous réserve des conditions contractuelles.

## Responsabilités de l'employé
- Ne pas stocker de données critiques uniquement sur un poste local
- Utiliser les espaces partagés (OneDrive entreprise, SharePoint, dépôts Git)
- Signaler tout incident affectant la disponibilité des données
- Participer aux exercices de restauration lorsque demandé

## Cyberattaque (rançongiciel)
En cas de cyberattaque détectée :
- Isoler immédiatement le poste affecté (déconnexion réseau)
- Aviser l'équipe TI et la direction sans délai
- **Ne pas payer de rançon** sans décision de la direction
- Activer le plan de reprise depuis les sauvegardes hors ligne

## Conformité légale
La présente politique est conforme à la *Loi 25* (article 3.5 sur les incidents de confidentialité) et aux exigences contractuelles habituelles des clients en automatisation industrielle.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 54. Politique accès systèmes clients
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "client_systems_access_policy",
    title: "Politique d'accès aux systèmes des clients (VPN, audits, traces)",
    category: "policy",
    version: "1.0",
    isRequired: true,
    targetDepartments: ["Ingénierie", "Automatisation", "Technique", "Service après-vente"],
    bodyMarkdown: `# Politique d'accès aux systèmes des clients

**Politique applicable à tous les employés de {{company.fullName}} qui accèdent à distance ou sur site aux systèmes informatiques et industriels des clients.**

## Principe
L'accès aux systèmes d'un client est un privilège accordé par le client à {{company.fullName}} dans le cadre d'un mandat. Cet accès doit être utilisé exclusivement aux fins du mandat et de manière à protéger la sécurité et l'intégrité des systèmes du client.

## Outils d'accès autorisés
- **Secomea SiteManager** (déploiement standard {{company.fullName}} pour accès industriel sécurisé)
- VPN client (selon les exigences spécifiques du client)
- Outils de prise de contrôle approuvés (TeamViewer entreprise, AnyDesk avec compte d'affaires)
- Connexions directes physiques en chantier

Aucun outil personnel (TeamViewer gratuit, RustDesk, etc.) n'est toléré.

## Comptes nominatifs
Chaque intervenant utilise un **compte nominatif** chez le client. Les comptes partagés sont à proscrire. Si un client impose un compte partagé, la situation est documentée par écrit.

## Authentification forte
L'accès à distance utilise systématiquement :
- Mot de passe complexe (conforme à la *Politique de gestion des mots de passe*)
- Authentification multifacteur (AMF) lorsque techniquement disponible
- Connexion via réseau sécurisé (pas de Wi-Fi public sans VPN)

## Principe du moindre privilège
L'{{employee.employed}} demande et n'utilise que les **privilèges strictement nécessaires** à l'exécution de sa tâche. Les accès administrateur sont limités aux opérations qui le requièrent et sont relâchés en fin d'intervention.

## Journalisation et traces
Toutes les sessions d'accès à un système client sont **journalisées** :
- Date et heure de connexion / déconnexion
- Identité de l'intervenant
- Système concerné
- Description sommaire des opérations effectuées

{{company.fullName}} peut auditer ces journaux à tout moment.

## Modifications sur systèmes en production
Avant toute modification sur un système en production client :
- Validation avec le client (courriel, ticket ou bon de travail signé)
- Sauvegarde du programme / configuration avant modification
- Documentation du changement (version, motif, intervenant)
- Période d'observation après modification
- Communication des changements au client

## Confidentialité
- Toute information vue sur les systèmes du client est confidentielle (NDA)
- Aucune capture d'écran sans autorisation
- Aucun téléchargement de données non requis
- Aucun partage de credentials d'un client avec un autre client ou employé non concerné

## Refus du client
Si le client n'autorise pas un mode d'accès, refuse l'AMF, ou exige des pratiques jugées non sécuritaires, l'intervenant en informe son supérieur. Une dérogation écrite, datée et signée par le client peut être requise.

## Départ ou changement de mandat
- Les accès à un client sont **immédiatement révoqués** lorsque le mandat se termine ou que l'intervenant est réaffecté
- À la cessation d'emploi : révocation de tous les accès clients dans les 24 heures

## Incident
Tout incident (perte d'accès, action erronée, suspicion de compromission d'un compte client) est signalé immédiatement à {{employee.manager.fullName}} et au client concerné, conformément à l'entente de service.

## Sanctions
L'utilisation abusive ou non autorisée des accès clients constitue une faute grave susceptible d'entraîner le congédiement pour motif sérieux et des poursuites civiles ou pénales (atteinte à un système informatique, *Code criminel* art. 342.1).
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 55. Politique cybersécurité IT/OT
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "it_ot_cybersecurity_policy",
    title: "Politique de cybersécurité industrielle (IT/OT, ICS/SCADA)",
    category: "policy",
    version: "1.0",
    isRequired: true,
    targetPositions: ["Programmeur automatisation", "Programmeur robotique", "Ingénieur électrique", "Ingénieur logiciel / automatisation", "Technicien automatisation"],
    targetDepartments: ["Ingénierie", "Automatisation", "Technique"],
    bodyMarkdown: `# Politique de cybersécurité industrielle — IT/OT, ICS/SCADA

**Politique applicable à tous les employés de {{company.fullName}} intervenant sur des systèmes de contrôle industriel (ICS), des automates programmables (PLC), des systèmes SCADA, HMI ou des réseaux OT.**

## Principe
La cybersécurité industrielle (OT) est aussi critique que la cybersécurité bureautique (IT). Une compromission d'un système de contrôle peut causer des dommages matériels, environnementaux ou humains. {{company.fullName}} s'aligne sur les bonnes pratiques **IEC 62443** (cybersécurité des systèmes d'automatisation industriels).

## Séparation IT / OT
- Les réseaux OT (PLC, HMI, SCADA, robotique) doivent être **séparés** des réseaux IT bureautiques par un pare-feu industriel ou une zone démilitarisée (DMZ industrielle)
- Aucune connexion directe entre un poste bureautique et un PLC sans passer par la DMZ
- Les protocoles industriels (Profinet, EtherNet/IP, Modbus TCP, OPC UA) sont confinés au réseau OT

## Zones et conduits (IEC 62443)
{{company.fullName}} recommande à ses clients de structurer leurs réseaux selon le modèle :
- **Niveau 0** : capteurs/actionneurs
- **Niveau 1** : automates (PLC)
- **Niveau 2** : supervision (HMI, SCADA)
- **Niveau 3** : exploitation (MES, historiens)
- **DMZ industrielle** : interface vers le niveau 4
- **Niveau 4-5** : IT bureautique / cloud

Chaque niveau est isolé par des contrôles d'accès stricts.

## Durcissement des postes d'ingénierie
- Système d'exploitation à jour (Windows 10/11 LTSC recommandé)
- Antivirus compatible avec les logiciels d'automatisation
- Désactivation des ports USB hors usage (politique de port USB encadrée)
- Aucun usage personnel sur les postes d'ingénierie OT
- Comptes locaux avec privilèges restreints

## Authentification des PLC et HMI
- Activer les protections par mot de passe sur les PLC modernes (TIA Portal, Studio 5000, B&R)
- Aucun mot de passe par défaut conservé
- Activer la journalisation des accès en écriture lorsque disponible
- Documenter les comptes par projet client

## Transferts entre clients
- Aucune clé USB partagée entre clients sans formatage et antivirus préalable
- Les fichiers PLC sont transférés via les outils internes contrôlés
- Aucun téléchargement direct d'un site client à un autre

## Mises à jour firmware
- Les mises à jour de firmware des PLC, modules, robots ne sont effectuées qu'avec :
  - L'autorisation écrite du client
  - Une sauvegarde complète préalable
  - Un plan de retour en arrière
  - Une fenêtre d'arrêt planifiée

## Accès distants
Conformément à la *Politique d'accès aux systèmes clients* :
- Privilégier les solutions sécurisées (Secomea SiteManager, VPN avec AMF)
- Aucun port industriel exposé directement sur Internet
- Pare-feu industriel actif en tout temps

## Incident OT
Tout incident soupçonné (PLC arrêté de manière inexpliquée, modification non autorisée, alerte SCADA inhabituelle) est :
1. Signalé immédiatement au client
2. Documenté avec horodatage et captures
3. Investigué par un ingénieur senior
4. Si compromission confirmée : isolation du système et activation du plan de réponse

## Formation
Les programmeurs et ingénieurs sont formés aux principes de la **cybersécurité industrielle** :
- À l'embauche
- Lors de l'introduction de nouvelles plateformes
- Recyclage annuel

## Conformité contractuelle
Lorsqu'un client impose un cadre spécifique (NERC CIP, NIS2, ISO 27001/IEC 62443), {{company.fullName}} s'engage à respecter les exigences additionnelles documentées dans le contrat de service.
${SIGNATURES_BLOCK}`,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ENGAGEMENTS PROFESSIONNELS (2)
  // ═══════════════════════════════════════════════════════════════════════

  // ───────────────────────────────────────────────────────────────────────
  // 56. Engagement OIQ — Ingénieur
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "engagement_oiq_engineer",
    title: "Engagement professionnel — Ingénieur (OIQ)",
    category: "legal",
    version: "1.0",
    isRequired: true,
    targetPositions: ["Ingénieur électrique", "Ingénieur mécanique", "Ingénieur logiciel / automatisation"],
    bodyMarkdown: `# Engagement professionnel — Ingénieur membre de l'OIQ

**Conformité :** *Loi sur les ingénieurs* (RLRQ c. I-9), *Code de déontologie des ingénieurs* (c. I-9, r. 6), *Code des professions* (c. C-26).

**Entre les parties soussignées :**

{{company.fullName}} et {{employee.fullName}}, ingénieur{{employee.accordE}} (ou candidat{{employee.accordE}} à la profession d'ingénieur — CPI) au sein du département {{employee.department}}.

## Statut professionnel
L'{{employee.employed}} déclare être :
- Membre en règle de l'**Ordre des ingénieurs du Québec (OIQ)**, numéro de membre : [À COMPLÉTER]
- OU Candidat{{employee.accordE}} à la profession d'ingénieur (CPI)
- En possession d'un titre, sceau et signature numérique valides
- Couvert par l'assurance responsabilité professionnelle obligatoire (Fonds d'assurance OIQ)

## Obligation de maintien
L'{{employee.employed}} s'engage à :
- Acquitter sa cotisation annuelle à l'OIQ (remboursée par {{company.fullName}} sur preuve)
- Compléter la **formation continue obligatoire de 30 heures par période de 2 ans** dont au moins 1 heure en éthique et déontologie (Règlement sur la formation continue obligatoire)
- Aviser sans délai l'employeur de tout changement de statut (suspension, radiation, restriction d'exercice)

## Sceau professionnel
Le sceau d'ingénieur :
- Est strictement personnel et incessible
- N'est apposé que sur des documents que l'{{employee.employed}} a personnellement préparés, surveillés ou révisés
- Ne peut être prêté ni utilisé par un tiers
- L'{{employee.employed}} est seul{{employee.accordE}} responsable de son utilisation

{{company.fullName}} reconnaît et respecte le caractère personnel de la signature professionnelle.

## Code de déontologie
L'{{employee.employed}} s'engage à respecter en tout temps le **Code de déontologie des ingénieurs**, notamment :
- Devoir d'intégrité, d'honneur et de dignité (art. 2.01)
- Devoir d'agir dans l'intérêt public et le respect de la sécurité (art. 2.04)
- Obligation de signalement des risques pour le public ou l'environnement (art. 2.03)
- Indépendance professionnelle et absence de conflit d'intérêts (art. 3.05.01 et suivants)
- Secret professionnel (art. 3.06.01)
- Compétence : ne pas accepter de mandat hors de ses compétences (art. 3.01.01)

## Primauté du Code de déontologie
En cas de conflit entre les directives de {{company.fullName}} et les obligations déontologiques de l'OIQ, **les obligations déontologiques ont préséance**. L'{{employee.employed}} doit aviser sa direction et, au besoin, consulter le syndic ou la conseillère en éthique de l'OIQ.

## Refus de signer
L'{{employee.employed}} a le droit, et le devoir, de refuser de signer ou de sceller un document qu'{{employee.pronoun}} n'a pas personnellement préparé ou surveillé, ou dont le contenu est contraire à ses obligations professionnelles. {{company.fullName}} reconnaît ce droit et s'engage à ne pas pénaliser un tel refus.

## Documents préparés sous supervision
Lorsque l'{{employee.employed}} supervise un CPI, un technicien ou un dessinateur, {{employee.pronoun}} est responsable de la révision technique avant apposition de son sceau, conformément à la *Loi sur les ingénieurs*.

## Signalement d'enjeux
Si l'{{employee.employed}} constate un enjeu de sécurité, d'environnement ou de santé publique dans un projet ou un mandat, {{employee.pronoun}} doit le signaler par écrit à la direction et, au besoin, alerter les autorités compétentes (CNESST, MELCC, etc.).

## Plainte disciplinaire
En cas de plainte déposée contre l'{{employee.employed}} auprès du syndic de l'OIQ, {{company.fullName}} collabore selon ses obligations légales et soutient l'{{employee.employed}} dans la mesure compatible avec l'éthique.

## Formation et perfectionnement
{{company.fullName}} favorise le développement professionnel : remboursement des inscriptions à des cours et conférences reconnus, journées de formation rémunérées, accès à des publications techniques.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 57. Engagement CPA — Comptable
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "engagement_cpa_accountant",
    title: "Engagement professionnel — Comptable (CPA)",
    category: "legal",
    version: "1.0",
    isRequired: true,
    targetPositions: ["Comptable"],
    bodyMarkdown: `# Engagement professionnel — Comptable membre de l'Ordre des CPA du Québec

**Conformité :** *Loi sur les comptables professionnels agréés* (c. C-48.1), *Code de déontologie des comptables professionnels agréés* (c. C-48.1, r. 6), *Code des professions* (c. C-26).

**Entre les parties soussignées :**

{{company.fullName}} et {{employee.fullName}}, comptable au sein du département {{employee.department}}.

## Statut professionnel
L'{{employee.employed}} déclare son statut professionnel :
- [ ] Membre en règle de l'**Ordre des CPA du Québec**, numéro de membre : [À COMPLÉTER]
- [ ] Candidat{{employee.accordE}} à l'exercice de la profession (CEPA)
- [ ] Technicien(ne) en comptabilité (non membre)

Pour les membres de l'Ordre, l'{{employee.employed}} s'engage à maintenir son adhésion en règle pendant toute la durée de l'emploi.

## Obligation de maintien et formation continue
L'{{employee.employed}} (membre CPA) s'engage à :
- Acquitter sa cotisation annuelle (remboursée par {{company.fullName}} sur preuve)
- Compléter la **formation continue obligatoire** : 120 heures vérifiables par cycle de 3 ans, dont au moins 4 heures en éthique
- Souscrire à l'assurance responsabilité professionnelle obligatoire
- Aviser sans délai l'employeur de tout changement de statut

## Secret professionnel étendu
L'{{employee.employed}} est tenu{{employee.accordE}} au **secret professionnel** prévu à l'article 9 de la *Charte des droits et libertés de la personne*. Ce secret s'étend, conformément à la jurisprudence québécoise et au Code de déontologie CPA :
- À toutes les **communications** entre le comptable et la clientèle ou l'employeur
- À l'**identité même de la clientèle** dans certains cas
- Aux **stratégies fiscales** et planifications confidentielles
- Aux **données financières internes** (marges, salaires, négociations, fusions-acquisitions)
- Aux informations apprises **incidemment** dans l'exercice des fonctions

Le secret professionnel demeure en vigueur **après la cessation d'emploi**, sans limite de temps.

## Code de déontologie CPA
L'{{employee.employed}} s'engage à respecter le **Code de déontologie des comptables professionnels agréés**, notamment :
- Intégrité (art. 7)
- Compétence (art. 11)
- Objectivité et indépendance professionnelle (art. 22 et suivants)
- Confidentialité (art. 49 et suivants)
- Respect des normes professionnelles (NCA, NCMM, NCNV selon mandat)
- Probité dans la tenue des dossiers et la production des états financiers

## Primauté déontologique
En cas de conflit entre les directives de {{company.fullName}} et les obligations déontologiques de l'Ordre des CPA, **les obligations déontologiques ont préséance**. L'{{employee.employed}} avisera la direction et, au besoin, consultera la ligne d'éthique de l'Ordre.

## Refus d'attester ou de signer
L'{{employee.employed}} a le droit et le devoir de **refuser d'attester** ou de signer un document, état financier ou déclaration fiscale contenant une information fausse, trompeuse, ou non conforme aux normes professionnelles. {{company.fullName}} reconnaît ce droit et ne peut pénaliser un tel refus.

## Conflit d'intérêts
L'{{employee.employed}} déclare tout intérêt personnel ou familial susceptible de conflit avec ses fonctions :
- Détention de parts dans un client, fournisseur ou concurrent
- Activités externes en comptabilité, fiscalité ou audit pour des tiers
- Mandat antérieur ou en cours pour un client de {{company.fullName}}
Toute activité professionnelle externe rémunérée doit être autorisée par écrit.

## Confidentialité fiscale
Les renseignements transmis à {{company.fullName}} ou à ses clients dans le cadre de mandats fiscaux sont strictement confidentiels (*Loi sur l'administration fiscale* art. 69, *Loi de l'impôt sur le revenu* art. 241).

## Conservation des dossiers
L'{{employee.employed}} collabore à la conservation des dossiers selon les exigences :
- **Loi de l'impôt sur le revenu (ARC)** : 6 ans après la fin de l'année visée
- **Loi sur les impôts du Québec** : 6 ans
- **Normes professionnelles CPA** : 10 ans pour les missions d'examen et d'audit

## Lanceur d'alerte / fraude
Si l'{{employee.employed}} constate une fraude, un détournement ou une irrégularité significative, {{employee.pronoun}} doit la signaler à la direction par écrit. {{company.fullName}} garantit l'absence de représailles et collabore aux enquêtes éventuelles.

## Plainte disciplinaire
En cas de plainte déposée contre l'{{employee.employed}} auprès du syndic, {{company.fullName}} collabore selon ses obligations légales et soutient l'{{employee.employed}} dans la mesure compatible avec l'éthique.

## Développement professionnel
{{company.fullName}} favorise le perfectionnement : remboursement des inscriptions à des formations CPA reconnues, journées de formation rémunérées, abonnement aux publications professionnelles.
${SIGNATURES_BLOCK}`,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // LETTRES ADDITIONNELLES (7)
  // ═══════════════════════════════════════════════════════════════════════

  // ───────────────────────────────────────────────────────────────────────
  // 58. Lettre changement de poste (sans promotion)
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "letter_position_change",
    title: "Lettre de changement de poste",
    category: "lettre",
    version: "1.0",
    isRequired: false,
    bodyMarkdown: `# Lettre de changement de poste

{{date.todayFr}}
**À l'attention de :** {{employee.fullName}}
**Objet : Confirmation de changement de poste**

Cher(ère) {{employee.firstName}},

Suite à nos récentes discussions, nous confirmons par la présente ton changement de poste au sein de {{company.fullName}}.

- **Nouveau poste :** {{employee.position}}
- **Département :** {{employee.department}}
- **Date d'effet :** {{date.todayFr}}
- **Supérieur immédiat :** {{employee.manager.fullName}}
Ce changement reflète l'évolution de nos besoins opérationnels et tes intérêts professionnels. Les autres conditions de ton contrat (salaire, horaire, vacances, avantages sociaux) demeurent inchangées.

Tes nouvelles fonctions principales seront discutées en détail lors d'une rencontre avec ton nouveau supérieur immédiat. Une description de poste mise à jour te sera remise dans les meilleurs délais.

Nous te remercions pour ta flexibilité et ta contribution continue à {{company.fullName}}. Nous demeurons à ta disposition pour toute question.

Cordialement,

**{{employee.manager.fullName}}**
{{company.fullName}}${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 59. Lettre fin période d'essai positive
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "letter_probation_passed",
    title: "Lettre de fin de période d'essai — Confirmation de permanence",
    category: "lettre",
    version: "1.0",
    isRequired: false,
    bodyMarkdown: `# Confirmation de fin de période d'essai

{{date.todayFr}}
**À l'attention de :** {{employee.fullName}}
**Objet : Fin satisfaisante de ta période d'essai et confirmation de ton statut permanent**

Cher(ère) {{employee.firstName}},

C'est avec grand plaisir que nous te confirmons la **réussite de ta période d'essai** à titre de {{employee.position}} au sein du département {{employee.department}}.

Depuis ton entrée en fonction le {{employee.startDateFr}}, tu as démontré :
- Une intégration réussie à l'équipe {{employee.team}}
- Un engagement professionnel marqué
- Une maîtrise progressive de tes responsabilités
- Un respect des valeurs et politiques de {{company.fullName}}
En conséquence, ton emploi devient **permanent à temps plein** à compter d'aujourd'hui, aux conditions prévues à ton contrat de travail initial.

À compter de cette date :
- Tu deviens admissible aux **avantages sociaux complets** (assurance collective, etc.)
- Les protections de la *Loi sur les normes du travail* relatives au préavis de cessation s'appliquent pleinement
- Tu participes pleinement aux programmes de développement professionnel

Une rencontre de suivi sera planifiée avec {{employee.manager.fullName}} pour discuter de tes objectifs à moyen terme.

Au nom de toute l'équipe de {{company.fullName}}, je te félicite et te souhaite la meilleure des continuations parmi nous.

Cordialement,

**{{employee.manager.fullName}}**
{{company.fullName}}${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 60. Lettre prolongation période d'essai
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "letter_probation_extended",
    title: "Lettre de prolongation de la période d'essai",
    category: "lettre",
    version: "1.0",
    isRequired: false,
    bodyMarkdown: `# Prolongation de la période d'essai

{{date.todayFr}}
**À l'attention de :** {{employee.fullName}}
**Objet : Prolongation de ta période d'essai**

Cher(ère) {{employee.firstName}},

Suite à notre rencontre d'évaluation, et après analyse de ton intégration au poste de {{employee.position}} au sein du département {{employee.department}}, nous t'informons que **ta période d'essai est prolongée** pour une durée additionnelle.

**Nouvelle date de fin de la période d'essai :** [DATE À COMPLÉTER]

## Motifs de la prolongation
La prolongation vise à te permettre d'atteindre les objectifs suivants, qui n'ont pu être pleinement consolidés pendant la période initiale :
- [Objectif 1 — à personnaliser]
- [Objectif 2 — à personnaliser]
- [Objectif 3 — à personnaliser]

## Accompagnement
Pour soutenir ton développement, les mesures suivantes seront mises en place :
- Rencontres hebdomadaires avec ton supérieur immédiat {{employee.manager.fullName}}
- Formation ciblée sur les compétences à renforcer
- Jumelage avec un collègue expérimenté de l'équipe {{employee.team}} (le cas échéant)
- Évaluation formelle à mi-parcours

## Conditions inchangées
Toutes les autres conditions de ton contrat de travail demeurent inchangées : salaire ({{employee.salaryFormatted}}), horaire ({{employee.hoursPerWeek}} h/sem), avantages.

## Conséquences possibles
À la fin de la nouvelle période d'essai :
- Si les objectifs sont atteints : confirmation de ton statut permanent
- À défaut : fin du lien d'emploi, sans préavis additionnel à celui prévu à la *Loi sur les normes du travail*

Nous croyons en ton potentiel et te souhaitons d'utiliser cette période pour démontrer pleinement tes capacités. N'hésite pas à solliciter ton supérieur ou les RH pour tout besoin.

Cordialement,

**{{employee.manager.fullName}}**
{{company.fullName}}
---

J'ai pris connaissance de la présente lettre et de ses conditions.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 61. Avertissement écrit 2e niveau
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "letter_disciplinary_warning_2",
    title: "Avertissement disciplinaire écrit — 2e niveau",
    category: "lettre",
    version: "1.0",
    isRequired: false,
    bodyMarkdown: `# Avertissement disciplinaire — 2e niveau

{{date.todayFr}}
- **À l'attention de :** {{employee.fullName}}
- **Poste :** {{employee.position}}
- **Département :** {{employee.department}}
**Objet : Avertissement disciplinaire écrit — 2e niveau**

{{employee.firstName}},

Faisant suite à l'avertissement écrit de premier niveau qui t'a été remis le **[DATE]** concernant **[SUJET INITIAL]**, et **malgré nos échanges et le plan d'action mis en place**, nous constatons la persistance ou la répétition des manquements suivants :

**Faits constatés depuis le 1er avertissement :**
- [Fait 1 — date, description précise]
- [Fait 2 — date, description précise]
- [Fait 3 — si applicable]

Ces comportements constituent une récidive par rapport à la mise en garde déjà formulée et représentent un manquement grave aux obligations contractuelles et aux politiques internes de {{company.fullName}}.

## Mesures correctives renforcées
- Respect immédiat et sans réserve des politiques internes
- Suivi rapproché avec {{employee.manager.fullName}} (rencontres hebdomadaires)
- Plan d'amélioration mesurable sur une période de **30 jours**
- Soutien possible via le Programme d'aide aux employés (PAE)

## Conséquences en cas de nouvelle récidive
Toute nouvelle récidive ou tout nouveau manquement de nature similaire entraînera des mesures disciplinaires plus sévères pouvant inclure :
- **Suspension sans solde** d'une durée à être déterminée
- **Avertissement final** précédant la cessation d'emploi
- **Congédiement pour motif sérieux** conformément aux articles 82 et 124 LNT

## Versement au dossier
Le présent avertissement sera versé à ton dossier RH et y demeurera pour une période de **douze (12) mois**, à moins d'une nouvelle infraction.

Nous demeurons disponibles pour t'accompagner dans la mise en œuvre des correctifs requis. Nous t'invitons à prendre les présents constats avec le sérieux qu'ils méritent.

Cordialement,

**{{employee.manager.fullName}}**
{{company.fullName}}
---

**Accusé de réception**

J'ai pris connaissance du présent avertissement. Ma signature ne constitue pas une admission des faits, mais uniquement la confirmation que j'ai reçu cette lettre.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 62. Avertissement final
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "letter_disciplinary_warning_final",
    title: "Avertissement disciplinaire écrit — Final (dernier avis avant cessation)",
    category: "lettre",
    version: "1.0",
    isRequired: false,
    bodyMarkdown: `# Avertissement disciplinaire FINAL

{{date.todayFr}}
- **À l'attention de :** {{employee.fullName}}
- **Poste :** {{employee.position}}
- **Département :** {{employee.department}}
**Objet : AVERTISSEMENT FINAL — Dernier avis avant cessation d'emploi**

{{employee.firstName}},

Le présent avertissement constitue un **dernier avis formel** avant l'application de mesures pouvant aller jusqu'au **congédiement pour motif sérieux**, conformément aux articles 82 et 124 de la *Loi sur les normes du travail*.

Malgré :
- L'avertissement verbal du **[DATE]**
- L'avertissement écrit de 1er niveau du **[DATE]**
- L'avertissement écrit de 2e niveau du **[DATE]**
- Les rencontres et plans d'action successifs

les manquements suivants sont à nouveau constatés :

**Faits récents (dernière période) :**
- [Fait 1 — date, description précise, contexte]
- [Fait 2 — date, description précise, contexte]

Ces faits, combinés à l'historique disciplinaire, constituent une faute grave répétée et démontrent un défaut persistant de te conformer aux exigences raisonnables de l'employeur, aux politiques internes et aux engagements pris.

## Mesures immédiates
- **Suspension administrative sans solde** de [X jours] à compter du **[DATE]**
- Rencontre obligatoire avec le département RH au retour de suspension
- Plan de redressement ultime avec engagements écrits et mesurables sur **30 jours**

## Conséquence d'un nouveau manquement
**Tout nouveau manquement, qu'il soit de même nature ou non, entraînera la cessation immédiate de ton emploi pour motif sérieux, sans préavis ni indemnité tenant lieu de préavis**, conformément à l'article 82.1 LNT et à la jurisprudence applicable.

## Soutien
{{company.fullName}} réitère son ouverture à fournir le soutien suivant :
- Programme d'aide aux employés (PAE) confidentiel
- Rencontre avec un représentant RH dans un climat respectueux
- Possibilité d'être accompagné{{employee.accordE}} lors des rencontres formelles

Nous t'invitons à prendre cet avertissement avec le plus grand sérieux. La poursuite de ton emploi chez {{company.fullName}} dépend de ta volonté manifeste et démontrable de te conformer aux exigences attendues.

Cordialement,

**{{employee.manager.fullName}}**
{{company.fullName}}
---

**Accusé de réception**

J'ai pris connaissance du présent avertissement final et de ses conséquences potentielles. Ma signature ne constitue pas une admission des faits, mais uniquement la confirmation que j'ai reçu cette lettre.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 63. Mise à pied temporaire
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "letter_temporary_layoff",
    title: "Lettre de mise à pied temporaire",
    category: "lettre",
    version: "1.0",
    isRequired: false,
    bodyMarkdown: `# Mise à pied temporaire

{{date.todayFr}}
- **À l'attention de :** {{employee.fullName}}
- **Poste :** {{employee.position}}
**Objet : Mise à pied temporaire**

{{employee.firstName}},

Nous t'informons par la présente que {{company.fullName}} doit procéder à une **mise à pied temporaire** affectant ton emploi de {{employee.position}}, en raison de **[motif : baisse d'activité, fin d'un mandat client, restructuration temporaire, etc.]**.

## Conditions de la mise à pied
- **Date de début :** **[DATE]**
- **Durée prévue :** **[X semaines / mois]** (à confirmer selon l'évolution)
- **Date de rappel anticipée :** **[DATE]** (sujet à changement)
- **Statut d'emploi :** maintenu — il ne s'agit pas d'une cessation d'emploi

## Préavis (article 82 LNT)
Conformément à l'article 82 de la *Loi sur les normes du travail*, la présente lettre te transmet un préavis ou, le cas échéant, une indemnité tenant lieu de préavis, calculée selon ton ancienneté depuis le {{employee.startDateFr}} :
- Moins de 3 mois : aucun préavis
- 3 mois à moins d'1 an : 1 semaine
- 1 an à moins de 5 ans : 2 semaines
- 5 ans à moins de 10 ans : 4 semaines
- 10 ans et plus : 8 semaines

Si la mise à pied **dépasse 6 mois**, elle est considérée comme une cessation d'emploi définitive aux fins de la LNT et déclenche l'application complète des indemnités prévues.

## Relevé d'emploi
Un **Relevé d'emploi (RE)** sera produit et transmis à Service Canada dans les **5 jours** suivant le dernier jour travaillé. Il indiquera le motif **« A - Manque de travail / Fin de saison ou de contrat »**, te permettant de demander des prestations d'assurance-emploi.

## Avantages sociaux
- L'assurance collective est **maintenue** pendant les premières [X] semaines, sous réserve du paiement de ta cotisation employé
- Tu peux choisir de poursuivre la couverture à tes frais au-delà de cette période
- Les vacances accumulées seront versées avec la dernière paie

## Restitution temporaire
Tu n'es pas tenu{{employee.accordE}} de restituer les équipements de l'entreprise pendant la mise à pied, à moins d'un avis contraire. Les biens demeurent sous ta responsabilité.

## Rappel au travail
Tu seras avisé{{employee.accordE}} par écrit (courriel ou lettre) du rappel au travail au moins **7 jours** avant la date de retour prévue. À défaut de te présenter, ta mise à pied pourrait être convertie en cessation d'emploi définitive.

## Disponibilité
Nous te demandons de demeurer joignable et de nous aviser de tout changement de coordonnées.

Nous regrettons cette situation et te remercions de ta compréhension. Nous demeurons disponibles pour toute question.

Cordialement,

**{{employee.manager.fullName}}**
{{company.fullName}}${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 64. Lettre rappel au travail
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "letter_recall_to_work",
    title: "Lettre de rappel au travail (suite à une mise à pied)",
    category: "lettre",
    version: "1.0",
    isRequired: false,
    bodyMarkdown: `# Rappel au travail

{{date.todayFr}}
- **À l'attention de :** {{employee.fullName}}
- **Poste :** {{employee.position}}
**Objet : Rappel au travail suite à ta mise à pied**

Cher(ère) {{employee.firstName}},

Nous avons le plaisir de te confirmer que **{{company.fullName}} te rappelle au travail** suite à la période de mise à pied temporaire qui a débuté le **[DATE DE DÉBUT]**.

## Modalités du retour
- **Date de retour :** **[DATE]**
- **Heure de présence :** **[HEURE]**
- **Lieu :** {{company.address}} (ou autre lieu : [À PRÉCISER])
- **Poste retrouvé :** {{employee.position}} au sein du département {{employee.department}}
-**Supérieur immédiat :** {{employee.manager.fullName}}
-**Conditions :** identiques à celles précédant la mise à pied (salaire {{employee.salaryFormatted}}, horaire {{employee.hoursPerWeek}} h/sem)

## Continuité d'ancienneté
Ta période de mise à pied n'interrompt pas ta relation d'emploi. Ton ancienneté depuis le {{employee.startDateFr}} est intégralement préservée.

## Avantages sociaux
- Ton assurance collective reprend pleinement (sans nouveau délai de carence)
- Tes congés et vacances accumulés avant la mise à pied demeurent acquis
- Ton compte de banque de jours personnels / maladie reprend à son solde antérieur

## Accueil de retour
Une rencontre de retour avec {{employee.manager.fullName}} est prévue afin de :
- Faire le point sur les projets en cours
- Mettre à jour tes connaissances (nouveautés clients, processus, équipements)
- Identifier les besoins éventuels de remise à niveau ou de formation

## Service Canada
N'oublie pas d'aviser **Service Canada** de la fin de ta période d'admissibilité aux prestations d'assurance-emploi à compter de ta date de retour.

## Confirmation
Nous te prions de **confirmer ta présence par retour de courriel ou par téléphone au {{company.phone}} au plus tard le [DATE LIMITE]**.

Toute l'équipe de {{company.fullName}} se réjouit de te revoir. Au plaisir de te retrouver.

Cordialement,

**{{employee.manager.fullName}}**
{{company.fullName}}${SIGNATURES_BLOCK}`,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ONBOARDING SPÉCIALISÉS (5)
  // ═══════════════════════════════════════════════════════════════════════

  // ───────────────────────────────────────────────────────────────────────
  // 65. Onboarding programmeur
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "onboarding_checklist_programmer",
    title: "Liste de vérification onboarding — Programmeur",
    category: "onboarding",
    version: "1.0",
    isRequired: false,
    targetPositions: ["Programmeur automatisation", "Programmeur robotique", "Ingénieur logiciel / automatisation"],
    targetDepartments: ["Ingénierie", "Automatisation"],
    bodyMarkdown: `# Liste de vérification onboarding — Programmeur

- **{{employee.employed}} :** {{employee.fullName}}
- **Poste :** {{employee.position}}
- **Date d'entrée :** {{employee.startDateFr}}
- **Supérieur immédiat :** {{employee.manager.fullName}}
## Jour 1 — Accueil
- [ ] Accueil par {{employee.manager.fullName}} et tour des installations
- [ ] Remise du badge d'accès
- [ ] Présentation de l'équipe {{employee.team}}
- [ ] Présentation des autres départements (administratif, comptabilité, ventes)
- [ ] Remise et signature du manuel de l'employé
- [ ] Signature des politiques obligatoires (NDA, code de conduite, propriété intellectuelle étendue, cybersécurité)

## Équipement informatique
- [ ] Remise de l'ordinateur portable (configuré et chiffré)
- [ ] Remise écran(s), souris, clavier
- [ ] Compte courriel {{company.email}} créé et configuré
- [ ] Compte Microsoft 365 actif (Teams, OneDrive, SharePoint)
- [ ] Gestionnaire de mots de passe configuré
- [ ] Authentificateur multifacteur installé
- [ ] VPN configuré et testé

## Accès aux dépôts de code
- [ ] Compte sur le serveur Git interne (ou GitHub Enterprise)
- [ ] Clé SSH ajoutée et clonage d'un dépôt de test réussi
- [ ] Permissions sur les dépôts pertinents accordées
- [ ] Accès aux outils de revue de code et de tickets

## Licences logicielles
- [ ] **B&R Automation Studio** installé et licence active
- [ ] **Siemens TIA Portal** installé (version selon projets)
- [ ] **Allen-Bradley Studio 5000** installé (si applicable)
- [ ] **FANUC ROBOGUIDE** installé (si applicable)
- [ ] **AutoCAD Electrical** installé (si applicable)
- [ ] **Visual Studio / IDE** principal installé
- [ ] Inventaire des licences attribuées documenté

## Accès clients (selon affectation)
- [ ] **Secomea SiteManager** installé et configuré
- [ ] Comptes nominatifs créés chez les clients affectés
- [ ] Validation des accès VPN clients
- [ ] Documentation des credentials dans le coffre-fort de secrets

## Formation initiale (premières semaines)
- [ ] Formation SIMDUT 2015
- [ ] Formation aux politiques de cybersécurité IT/OT
- [ ] Formation au standard de codage {{company.fullName}}
- [ ] Formation au modèle de branches Git et au processus de revue
- [ ] Présentation des projets clients en cours
- [ ] Jumelage avec un programmeur senior pendant 4 à 6 semaines

## Documentation
- [ ] Accès au répertoire de documentation technique
- [ ] Accès aux templates et bibliothèques internes
- [ ] Accès aux schémas types et procédures de mise en service
- [ ] Compréhension de l'architecture des solutions {{company.fullName}}
## Administratif
- [ ] Formulaires fiscaux TD1 (fédéral) et TP-1015.3 (Québec) complétés
- [ ] Inscription au régime d'assurance collective (après période d'essai)
- [ ] Dépôt direct activé
- [ ] Coordonnées d'urgence transmises aux RH
- [ ] Photo professionnelle prise

## Rencontre de suivi
- [ ] Rencontre J+7
- [ ] Rencontre J+30
- [ ] Évaluation J+90 (fin de période d'essai)

## Confirmation
Je soussigné{{employee.accordE}}, {{employee.fullName}}, confirme avoir complété les étapes ci-dessus et reçu l'ensemble des équipements et accès requis pour exercer mes fonctions.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 66. Onboarding technicien terrain
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "onboarding_checklist_field_tech",
    title: "Liste de vérification onboarding — Technicien terrain",
    category: "onboarding",
    version: "1.0",
    isRequired: false,
    targetPositions: ["Technicien", "Technicien automatisation", "Technicien électrique", "Technicien mécanique"],
    targetDepartments: ["Technique", "Ingénierie", "Automatisation"],
    bodyMarkdown: `# Liste de vérification onboarding — Technicien terrain

- **{{employee.employed}} :** {{employee.fullName}}
- **Poste :** {{employee.position}}
- **Date d'entrée :** {{employee.startDateFr}}
- **Supérieur immédiat :** {{employee.manager.fullName}}
## Jour 1 — Accueil
- [ ] Accueil par {{employee.manager.fullName}} et visite des installations
- [ ] Remise du badge d'accès
- [ ] Présentation de l'équipe {{employee.team}}
- [ ] Visite de l'atelier et de l'entrepôt
- [ ] Remise et signature du manuel de l'employé
- [ ] Signature des politiques obligatoires (NDA, code de conduite, EPI, cadenassage)

## Équipement de protection individuelle (EPI)
- [ ] **Bottes de sécurité CSA grade 1** remises et essayées
- [ ] **Casque de sécurité CSA Z94.1** (classe E pour risque électrique)
- [ ] **Lunettes de sécurité CSA Z94.3**
- [ ] **Veste haute visibilité ANSI/ISEA 107**
- [ ] **Gants** (mécaniques + diélectriques selon poste)
- [ ] **Protection auditive** (bouchons et coquilles)
- [ ] **Harnais antichute CSA Z259.10** (si applicable)
- [ ] **Vêtements résistants à l'arc électrique** (si applicable)
- [ ] Inventaire des EPI documenté

## Outils techniques
- [ ] Coffre à outils personnel ou trousse remise
- [ ] Multimètre, ampèremètre, testeur de tension
- [ ] Outils de communication PLC (câbles, programmateurs)
- [ ] Ordinateur portable pour interventions
- [ ] Téléphone cellulaire de l'entreprise (si applicable)
- [ ] Cadenas personnels identifiés pour LOTO
- [ ] Étiquettes LOTO personnelles

## Formations sécurité OBLIGATOIRES
- [ ] **Formation cadenassage LOTO** (théorique + pratique, RSST art. 188.2)
- [ ] **Formation SIMDUT 2015** complétée et attestation conservée
- [ ] **Formation espaces clos** (si applicable, 8 h minimum)
- [ ] **Formation travail en hauteur** (si applicable)
- [ ] **Cours de secourisme en milieu de travail** (CNESST, 16 h) — recommandé
- [ ] Présentation des politiques santé-sécurité internes
- [ ] Lecture et signature du programme de cadenassage

## Véhicule de service
- [ ] Permis de conduire validé (copie remise aux RH)
- [ ] Dossier SAAQ analysé
- [ ] Politique conduite véhicule signée
- [ ] Clés du véhicule attribué remises
- [ ] Carte d'essence remise
- [ ] Carte d'immatriculation et preuve d'assurance présentées
- [ ] Vérification visuelle du véhicule effectuée

## Accès informatique
- [ ] Compte courriel {{company.email}} créé
- [ ] Compte Microsoft 365 actif
- [ ] Application de pointage installée sur le téléphone
- [ ] Accès à la base de connaissances technique
- [ ] **Secomea SiteManager** installé et configuré

## Accès clients
- [ ] Comptes nominatifs créés chez les clients affectés
- [ ] Procédures de cadenassage spécifiques aux clients étudiées
- [ ] Formations d'accueil sécurité des clients planifiées

## Premières interventions
- [ ] Première semaine en accompagnement avec un technicien senior
- [ ] Première intervention solo planifiée seulement après validation
- [ ] Procédure d'appel d'urgence connue (911, supérieur, RH)

## Administratif
- [ ] Formulaires fiscaux TD1 et TP-1015.3 complétés
- [ ] Inscription au régime d'assurance collective (après période d'essai)
- [ ] Dépôt direct activé
- [ ] Coordonnées d'urgence transmises
- [ ] Carte d'employé / carte d'affaires remise

## Rencontres de suivi
- [ ] Rencontre J+7 — bilan EPI et accompagnement
- [ ] Rencontre J+30 — bilan sécurité et opérations
- [ ] Évaluation J+90 — fin de période d'essai

## Confirmation
Je soussigné{{employee.accordE}}, {{employee.fullName}}, confirme avoir reçu l'ensemble des équipements, formations et accès requis pour exercer mes fonctions de manière sécuritaire.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 67. Onboarding ingénieur
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "onboarding_checklist_engineer",
    title: "Liste de vérification onboarding — Ingénieur",
    category: "onboarding",
    version: "1.0",
    isRequired: false,
    targetPositions: ["Ingénieur électrique", "Ingénieur mécanique", "Ingénieur logiciel / automatisation"],
    targetDepartments: ["Ingénierie"],
    bodyMarkdown: `# Liste de vérification onboarding — Ingénieur

- **{{employee.employed}} :** {{employee.fullName}}
- **Poste :** {{employee.position}}
- **Date d'entrée :** {{employee.startDateFr}}
- **Supérieur immédiat :** {{employee.manager.fullName}}
## Statut professionnel OIQ
- [ ] Statut OIQ confirmé : Ingénieur{{employee.accordE}} en règle / CPI
- [ ] Numéro de membre OIQ documenté : ___________
- [ ] Copie de l'attestation de membre en règle remise aux RH
- [ ] Couverture d'assurance responsabilité OIQ validée
- [ ] Signature de l'engagement professionnel OIQ (formulaire dédié)

## Sceau professionnel
- [ ] Sceau personnel disponible (acquisition au besoin)
- [ ] Signature numérique configurée (selon les exigences OIQ 2022+)
- [ ] Politique d'utilisation du sceau lue et signée
- [ ] Procédure de revue avant scellement comprise

## Formation continue
- [ ] Cycle de formation continue OIQ en cours (30 h / 2 ans, dont 1 h éthique)
- [ ] Inscription aux infolettres OIQ
- [ ] Budget formation annuel discuté avec {{employee.manager.fullName}}
## Accueil
- [ ] Accueil par {{employee.manager.fullName}} et tour des installations
- [ ] Présentation de l'équipe {{employee.team}} et des programmeurs/techniciens supervisés
- [ ] Présentation des autres ingénieurs
- [ ] Remise et signature du manuel de l'employé
- [ ] Signature des politiques obligatoires (NDA, code de conduite, PI étendue, cybersécurité IT/OT)

## Équipement
- [ ] Ordinateur portable haute performance configuré et chiffré
- [ ] Écrans double moniteur
- [ ] Téléphone cellulaire d'entreprise
- [ ] Carte d'affaires personnalisée
- [ ] Compte courriel {{company.email}}
- [ ] Microsoft 365 (Teams, OneDrive, SharePoint)
- [ ] VPN d'entreprise

## Accès projets
- [ ] Accès aux dépôts de projets (Git interne, SharePoint)
- [ ] Présentation des projets en cours
- [ ] Présentation des projets historiques pertinents
- [ ] Accès aux bibliothèques de schémas et standards internes
- [ ] Accès aux normes (IEC, CSA, ISO, IEEE) via abonnement de l'entreprise

## Logiciels de conception
- [ ] **AutoCAD / AutoCAD Electrical** installé
- [ ] **EPLAN Electric P8** installé (si applicable)
- [ ] **SolidWorks** installé (si applicable)
- [ ] **MATLAB / Simulink** installé (si applicable)
- [ ] Logiciels d'automatisation pertinents (TIA Portal, Studio 5000, etc.)

## Sécurité et accès terrain
- [ ] EPI complet remis (selon la *Politique EPI*)
- [ ] Formation SIMDUT complétée
- [ ] Formation cadenassage LOTO (si interventions terrain prévues)
- [ ] Politique conduite véhicule signée (si applicable)

## Cybersécurité industrielle
- [ ] Formation IEC 62443 (sensibilisation initiale)
- [ ] Politique cybersécurité IT/OT signée
- [ ] Accès à la documentation des architectures clients

## Réseautage professionnel
- [ ] Profil LinkedIn mis à jour (mention de {{company.fullName}})
- [ ] Présentation aux clients clés planifiée
- [ ] Identification d'un mentor interne senior

## Administratif
- [ ] Formulaires fiscaux TD1 et TP-1015.3 complétés
- [ ] Inscription au régime d'assurance collective (après période d'essai)
- [ ] Cotisation OIQ : modalités de remboursement expliquées
- [ ] Dépôt direct activé
- [ ] Coordonnées d'urgence transmises

## Rencontres de suivi
- [ ] Rencontre J+7
- [ ] Rencontre J+30
- [ ] Rencontre J+60
- [ ] Évaluation J+90 (fin de période d'essai)

## Confirmation
Je soussigné{{employee.accordE}}, {{employee.fullName}}, confirme avoir complété les étapes ci-dessus et reçu l'ensemble des équipements, accès et engagements requis pour exercer mes fonctions d'ingénieur{{employee.accordE}}.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 68. Onboarding comptable
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "onboarding_checklist_accountant",
    title: "Liste de vérification onboarding — Comptable",
    category: "onboarding",
    version: "1.0",
    isRequired: false,
    targetPositions: ["Comptable"],
    targetDepartments: ["Comptabilité"],
    bodyMarkdown: `# Liste de vérification onboarding — Comptable

- **{{employee.employed}} :** {{employee.fullName}}
- **Poste :** {{employee.position}}
- **Date d'entrée :** {{employee.startDateFr}}
- **Supérieur immédiat :** {{employee.manager.fullName}}
## Statut professionnel CPA (si applicable)
- [ ] Statut CPA confirmé : Membre / CEPA / Technicien
- [ ] Numéro de membre CPA documenté : ___________
- [ ] Attestation de membre en règle au dossier
- [ ] Couverture d'assurance responsabilité confirmée
- [ ] Signature de l'engagement professionnel CPA (formulaire dédié)
- [ ] Cycle de formation continue (120 h / 3 ans dont 4 h éthique) confirmé

## Accueil
- [ ] Accueil par {{employee.manager.fullName}} et tour des installations
- [ ] Présentation de l'équipe {{employee.team}}
- [ ] Présentation des autres départements (RH, ventes, ingénierie)
- [ ] Remise et signature du manuel de l'employé
- [ ] **Signature des politiques renforcées** : NDA, secret professionnel, confidentialité Loi 25, anti-corruption

## Confidentialité renforcée
- [ ] Lecture et signature de la *Politique sur les renseignements personnels — Loi 25*
- [ ] Lecture et signature de la *Politique anti-corruption*
- [ ] Discussion sur les obligations de secret professionnel CPA (étendu)
- [ ] Engagement de confidentialité sur les salaires et marges signé

## Équipement
- [ ] Ordinateur portable configuré et chiffré
- [ ] Écrans double moniteur (recommandé pour comptabilité)
- [ ] Calculatrice professionnelle (12 chiffres)
- [ ] Compte courriel {{company.email}}
- [ ] Téléphone IP / cellulaire (si applicable)
- [ ] Gestionnaire de mots de passe configuré
- [ ] Authentificateur multifacteur installé

## Accès systèmes financiers
- [ ] Logiciel comptable principal (Sage / QuickBooks / autre) — accès accordé
- [ ] Système de paie — accès aux fonctions pertinentes
- [ ] Portail bancaire d'entreprise — accès avec AMF
- [ ] **Mon dossier d'entreprise — ARC** (accès délégué selon rôle)
- [ ] **Mon dossier pour les entreprises — Revenu Québec**
- [ ] Système de gestion des dépenses
- [ ] Système de facturation client
- [ ] Microsoft 365 (Teams, Excel, SharePoint)

## Connaissances spécifiques
- [ ] Présentation des principaux clients et fournisseurs
- [ ] Présentation du cycle comptable interne (paie, TPS/TVQ, T4, R1)
- [ ] Présentation des dossiers fiscaux en cours
- [ ] Présentation des assurances et avantages sociaux des employés
- [ ] Accès à la documentation des procédures comptables internes
- [ ] Présentation des modalités d'audit / mission d'examen externe

## Conformité fiscale
- [ ] Calendrier des échéances fiscales (TPS, TVQ, acomptes provisionnels, T4, R1)
- [ ] Procédures de paie (DAS, RRQ, AE, RQAP) revues
- [ ] Politique de conservation des documents (7 ans fiscal) connue
- [ ] Procédure d'archivage et de destruction sécuritaire des documents

## Cybersécurité
- [ ] Formation sur la prévention de la fraude par hameçonnage
- [ ] Procédures de validation des transferts de fonds (double approbation)
- [ ] Politique sur les modifications bancaires de fournisseurs (vérification téléphonique)

## Administratif
- [ ] Formulaires fiscaux TD1 et TP-1015.3 complétés
- [ ] Inscription au régime d'assurance collective (après période d'essai)
- [ ] Cotisation CPA : modalités de remboursement expliquées
- [ ] Dépôt direct activé
- [ ] Coordonnées d'urgence transmises

## Rencontres de suivi
- [ ] Rencontre J+7
- [ ] Rencontre J+30
- [ ] Rencontre J+60
- [ ] Évaluation J+90 (fin de période d'essai)

## Confirmation
Je soussigné{{employee.accordE}}, {{employee.fullName}}, confirme avoir complété les étapes ci-dessus et reçu l'ensemble des équipements, accès et engagements de confidentialité requis pour exercer mes fonctions.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 69. Évaluation 30/60/90
  // ───────────────────────────────────────────────────────────────────────
  {
    key: "evaluation_30_60_90",
    title: "Modèle d'évaluation 30 / 60 / 90 jours",
    category: "onboarding",
    version: "1.0",
    isRequired: false,
    bodyMarkdown: `# Évaluation 30 / 60 / 90 jours — Période d'essai

- **{{employee.employed}} :** {{employee.fullName}}
- **Poste :** {{employee.position}}
- **Département :** {{employee.department}}
- **Date d'entrée :** {{employee.startDateFr}}
- **Supérieur immédiat :** {{employee.manager.fullName}}
- **Fin de période d'essai prévue :** {{contract.probationEndDateFr}}
## Objectifs de la démarche
La présente évaluation vise à :
- Soutenir l'intégration de l'{{employee.employed}} à {{company.fullName}}
- Identifier les forces, défis et besoins de formation
- Établir des objectifs clairs et mesurables
- Préparer la confirmation du statut permanent à la fin de la période d'essai

---

## ÉVALUATION À 30 JOURS

**Date :** ___________

### Intégration sociale
- Relation avec l'équipe {{employee.team}} : ___________
- Adaptation à la culture d'entreprise : ___________
- Communication interne : ___________

### Maîtrise des outils
- Équipement informatique et logiciels : ___________
- Accès aux systèmes : ___________
- Documentation interne consultée : ___________

### Forces observées
- ___________
- ___________

### Défis à surveiller
- ___________
- ___________

### Plan d'action 30-60 jours
- [ ] ___________
- [ ] ___________
- [ ] ___________

**Notes du supérieur :**
___________

**Commentaires de l'{{employee.employedLower}} :**
___________

---

## ÉVALUATION À 60 JOURS

**Date :** ___________

### Performance technique
- Maîtrise progressive des responsabilités : ___________
- Qualité du travail livré : ___________
- Autonomie : ___________

### Comportement professionnel
- Respect des politiques (sécurité, confidentialité) : ___________
- Ponctualité et présence : ___________
- Initiative et engagement : ___________

### Formation complétée
- ___________
- ___________

### Progrès vs plan 30-60 jours
- [ ] Objectif 1 : atteint / partiel / non atteint
- [ ] Objectif 2 : atteint / partiel / non atteint
- [ ] Objectif 3 : atteint / partiel / non atteint

### Plan d'action 60-90 jours
- [ ] ___________
- [ ] ___________
- [ ] ___________

**Notes du supérieur :**
___________

**Commentaires de l'{{employee.employedLower}} :**
___________

---

## ÉVALUATION À 90 JOURS (Fin de période d'essai)

**Date :** ___________

### Bilan technique global
- Compétences techniques démontrées : ___________
- Contributions concrètes : ___________
- Niveau d'autonomie atteint : ___________

### Bilan comportemental
- Intégration à l'équipe : ___________
- Adhésion aux valeurs : ___________
- Respect des politiques : ___________

### Forces principales (à valoriser)
- ___________
- ___________
- ___________

### Axes de développement (court terme)
- ___________
- ___________

### Recommandation
- [ ] **Confirmation du statut permanent** — l'{{employee.employedLower}} répond aux attentes
- [ ] **Prolongation de la période d'essai** — motifs spécifiques à préciser ci-dessous
- [ ] **Cessation de la relation d'emploi** — motifs spécifiques à préciser ci-dessous

**Motifs détaillés :**
___________

### Objectifs pour les 6 prochains mois
1. ___________
2. ___________
3. ___________

**Plan de formation 12 mois :**
___________

---

## Note importante

Je reconnais avoir participé à cette évaluation et avoir reçu une copie. Ma signature n'implique pas nécessairement mon accord avec l'ensemble des constats.

## Signatures

{{signature.employee}}

{{signature.employer}}
`,
  },
];

// ════════════════════════════════════════════════════════════════════════════
// CONTRACT TEMPLATES — 19 contrats
// Modèle : ContractTemplate
// ════════════════════════════════════════════════════════════════════════════

type SeedContractTemplate = {
  name: string;
  contractType: string; // valeurs QC : permanent_full_time | permanent_part_time | temporary | seasonal | on_call | student | internship | freelance | autre
  bodyMarkdown: string;
  defaultSalary?: number;
  defaultRate?: number;
  defaultHoursPerWeek?: number;
  defaultVacationPct?: number;
  probationDays?: number;
  targetPositions?: string[];
  targetDepartments?: string[];
};

// Préambule commun pour les contrats CDI
function cdiPreamble(roleLabel: string): string {
  return `# ${roleLabel}

**Entre les parties soussignées :**

{{company.fullName}}, personne morale légalement constituée ayant son siège social au {{company.address}}, immatriculée sous le NEQ {{company.neq}}, ci-après désignée « l'Employeur »,

ET

{{employee.fullName}}, domicilié{{employee.accordE}} au {{employee.address}}, ci-après désigné{{employee.accordE}} « l'{{employee.employed}} ».

**Les parties conviennent de ce qui suit :**
`;
}

// Sections communes salaire/conditions (CDI)
const COMMON_CDI_SECTIONS = `
## Rémunération
- **Salaire annuel brut :** {{contract.salaryFormatted}}
-**Taux horaire équivalent :** {{contract.hourlyRate}} $ / heure
- **Modalités :** versement aux deux semaines par dépôt direct
- **Indemnité de vacances :** {{contract.vacationPct}} % conformément à la *Loi sur les normes du travail*

## Durée de travail
- **Heures normales :** {{contract.hoursPerWeek}} heures par semaine
- **Horaire habituel :** du lundi au vendredi, selon entente avec le supérieur immédiat
- **Heures supplémentaires :** rémunérées à 1,5 fois le taux horaire après 40 heures/semaine (LNT)
- **Pauses :** 30 minutes non payées pour les quarts de plus de 5 heures consécutives

## Période d'essai
{{#if contract.probationEndDateFr}}Une période d'essai (probation) s'étendra du {{contract.startDateFr}} au {{contract.probationEndDateFr}}. Pendant cette période, chaque partie peut mettre fin au présent contrat sans préavis ni indemnité, sous réserve des droits prévus par la loi.{{/if}}{{#unless contract.probationEndDateFr}}Aucune période d'essai n'est prévue au présent contrat.{{/unless}}

## Avantages sociaux
- Assurance collective (maladie, dentaire, invalidité) après la période d'essai
- Programme d'aide aux employés (PAE) confidentiel
- Régime de retraite collectif (selon admissibilité)
- Jours fériés payés conformément à la LNT (8 jours statutaires)
- Banque de journées personnelles et de maladie (politique interne)

## Confidentialité, propriété intellectuelle et non-concurrence
L'{{employee.employed}} s'engage à respecter les politiques de {{company.fullName}} en matière de :
- Confidentialité et protection des renseignements personnels (Loi 25)
- Propriété intellectuelle (cession automatique des œuvres créées au travail)
- Non-sollicitation des clients et employés pendant 12 mois post-emploi

## Politiques applicables
L'{{employee.employed}} s'engage à respecter l'ensemble des politiques internes, notamment :
- Code de conduite professionnelle
- Politique anti-harcèlement psychologique et sexuel
- Politique sur l'alcool et les drogues
- Politique de santé et sécurité au travail (CNESST)
- Toute autre politique en vigueur ou à venir

## Cessation d'emploi
Conformément aux articles 82 à 84 de la *Loi sur les normes du travail*, les préavis suivants s'appliquent :
- Moins de 3 mois : aucun préavis
- 3 mois à moins d'1 an : 1 semaine
- 1 an à moins de 5 ans : 2 semaines
- 5 ans à moins de 10 ans : 4 semaines
- 10 ans et plus : 8 semaines

## Langue (Loi 96)
Conformément à la *Charte de la langue française* (Loi 96), le présent contrat est rédigé en français. L'{{employee.employed}} reconnaît avoir reçu et compris le présent contrat en français.

## Droit applicable et juridiction
Le présent contrat est régi par les lois du Québec, en particulier le *Code civil du Québec* et la *Loi sur les normes du travail*. Tout litige sera soumis aux tribunaux du district judiciaire de Québec.
${SIGNATURES_BLOCK}`;

// Variante : sections communes pour TECHNICIENS TERRAIN
// (cadenassage, EPI, conduite véhicule, déplacements client)
const COMMON_FIELD_TECH_SECTIONS = `
## Rémunération
- **Salaire annuel brut :** {{contract.salaryFormatted}}
-**Taux horaire équivalent :** {{contract.hourlyRate}} $ / heure
- **Modalités :** versement aux deux semaines par dépôt direct
- **Indemnité de vacances :** {{contract.vacationPct}} % conformément à la *Loi sur les normes du travail*
- **Prime de déplacement / per diem :** selon politique en vigueur lors d'affectations chez des clients

## Durée de travail et déplacements
- **Heures normales :** {{contract.hoursPerWeek}} heures par semaine
- **Horaire :** ajustable selon les besoins des clients (jour, soir, fin de semaine, sur appel)
- **Heures supplémentaires :** rémunérées à 1,5 fois le taux horaire après 40 heures/semaine (LNT)
- **Déplacements :** font partie intégrante du poste (Québec et occasionnellement hors province)

## Période d'essai
{{#if contract.probationEndDateFr}}Une période d'essai s'étendra du {{contract.startDateFr}} au {{contract.probationEndDateFr}}. Chaque partie peut mettre fin au contrat sans préavis pendant cette période, sous réserve des droits prévus par la loi.{{/if}}{{#unless contract.probationEndDateFr}}Aucune période d'essai n'est prévue au présent contrat.{{/unless}}

## Santé et sécurité — Engagements spécifiques
L'{{employee.employed}} reconnaît et s'engage à respecter rigoureusement :
- Le **Programme de cadenassage (LOTO)** (RSST art. 188.2) — formation obligatoire à l'embauche et recyclage aux 3 ans
- La **Politique sur les EPI** — port obligatoire en tout temps en zone à risque (bottes CSA, casque, lunettes, harnais)
- La **Politique SIMDUT 2015** pour la manipulation des produits chimiques
- La **Politique sur le travail en espaces clos** (le cas échéant)
- La **Politique sur le travail en hauteur** (le cas échéant)
- La **Politique de déclaration des incidents et quasi-accidents**
- Les programmes de sécurité spécifiques aux sites clients

## Conduite de véhicule de l'entreprise
L'{{employee.employed}} accepte de conduire un véhicule de l'entreprise dans le cadre de ses fonctions et s'engage à :
- Maintenir un permis de conduire valide (classe 5 minimum)
- Respecter la **Politique sur la conduite d'un véhicule de l'entreprise**
- Fournir annuellement son dossier de conduite SAAQ
- Signaler immédiatement toute suspension, retrait ou contravention significative

## Avantages sociaux
- Assurance collective (maladie, dentaire, invalidité) après la période d'essai
- Programme d'aide aux employés (PAE) confidentiel
- Régime de retraite collectif (selon admissibilité)
- Jours fériés payés conformément à la LNT (8 jours statutaires)
- EPI fournis et entretenus par l'employeur
- Remboursement des bottes de sécurité selon la politique

## Confidentialité, propriété intellectuelle et non-concurrence
L'{{employee.employed}} s'engage à respecter les politiques de {{company.fullName}} en matière de :
- Confidentialité et protection des renseignements personnels (Loi 25)
- Propriété intellectuelle (cession automatique des œuvres créées au travail)
- Confidentialité absolue sur les installations, processus et données vus chez les clients
- Non-sollicitation des clients et employés pendant 12 mois post-emploi

## Politiques applicables
L'{{employee.employed}} s'engage à respecter l'ensemble des politiques internes, notamment :
- Code de conduite professionnelle
- Politique anti-harcèlement psychologique et sexuel
- Politique sur l'alcool et les drogues (tolérance zéro pour conduite et opération d'équipement)
- Politique de déplacement et de comportement chez le client
- Toute autre politique en vigueur ou à venir

## Cessation d'emploi
Conformément aux articles 82 à 84 de la *Loi sur les normes du travail*, les préavis suivants s'appliquent :
- Moins de 3 mois : aucun préavis
- 3 mois à moins d'1 an : 1 semaine
- 1 an à moins de 5 ans : 2 semaines
- 5 ans à moins de 10 ans : 4 semaines
- 10 ans et plus : 8 semaines

## Langue (Loi 96)
Conformément à la *Charte de la langue française* (Loi 96), le présent contrat est rédigé en français. L'{{employee.employed}} reconnaît avoir reçu et compris le présent contrat en français.

## Droit applicable et juridiction
Le présent contrat est régi par les lois du Québec. Tout litige sera soumis aux tribunaux du district judiciaire de Québec.
${SIGNATURES_BLOCK}`;

// Variante : sections communes pour PROGRAMMEURS
// (cession PI code source RENFORCÉE)
const COMMON_PROGRAMMER_SECTIONS = `
## Rémunération
- **Salaire annuel brut :** {{contract.salaryFormatted}}
-**Taux horaire équivalent :** {{contract.hourlyRate}} $ / heure
- **Modalités :** versement aux deux semaines par dépôt direct
- **Indemnité de vacances :** {{contract.vacationPct}} % conformément à la *Loi sur les normes du travail*

## Durée de travail
- **Heures normales :** {{contract.hoursPerWeek}} heures par semaine
- **Horaire habituel :** du lundi au vendredi, formule hybride possible après la période d'essai
- **Heures supplémentaires :** rémunérées à 1,5 fois le taux horaire après 40 heures/semaine (LNT)
- **Disponibilité ponctuelle** pour mises en service ou interventions critiques

## Période d'essai
{{#if contract.probationEndDateFr}}Une période d'essai s'étendra du {{contract.startDateFr}} au {{contract.probationEndDateFr}}. Chaque partie peut mettre fin au contrat sans préavis pendant cette période, sous réserve des droits prévus par la loi.{{/if}}{{#unless contract.probationEndDateFr}}Aucune période d'essai n'est prévue au présent contrat.{{/unless}}

## Propriété intellectuelle — Clause renforcée et cession explicite du code
Conformément à l'article 13(3) de la *Loi sur le droit d'auteur* (Canada), aux articles 2087 et 2088 du *Code civil du Québec*, et à la *Politique de propriété intellectuelle étendue* de {{company.fullName}}, l'{{employee.employed}} **cède irrévocablement, dès leur création**, à {{company.fullName}} la totalité des droits patrimoniaux portant sur, sans s'y limiter :

- **Codes sources** : tout langage informatique (C, C++, C#, Python, JavaScript/TypeScript, Java, etc.)
- **Programmes d'automates** : Ladder, FBD, Structured Text, IL, SFC pour B&R, Allen-Bradley (Studio 5000), Siemens (TIA Portal, Step 7), Schneider, Omron et toute autre plateforme PLC
- **Programmes de robots** : FANUC TPP, ABB RAPID, KUKA KRL, etc.
- **Configurations HMI/SCADA** : WinCC, FactoryTalk View, Mappview, Ignition, etc.
- **Documentation technique, recettes, paramétrages, scripts d'automatisation**
- **Inventions** brevetables ou non, modèles industriels
- **Toute œuvre dérivée**

La cession est mondiale, perpétuelle, exclusive et libre de redevances. L'{{employee.employed}} **renonce expressément** à ses droits moraux dans la mesure permise par la loi.

L'{{employee.employed}} s'engage à signer tout document additionnel (cession spécifique, dépôt de brevet, attestation) requis pour parfaire les droits de {{company.fullName}}.

## Confidentialité et cybersécurité
L'{{employee.employed}} reconnaît avoir signé et s'engage à respecter :
- L'**Entente de confidentialité** (5 ans post-emploi)
- La **Politique de cybersécurité d'entreprise** (AMF, gestionnaire de mots de passe, postes durcis)
- La **Politique de cybersécurité industrielle IT/OT** (IEC 62443, séparation des réseaux)
- La **Politique de gestion du code source** (Git, dépôts internes uniquement, aucun secret en clair)
- La **Politique d'accès aux systèmes des clients** (Secomea SiteManager, comptes nominatifs, AMF)
- La **Politique de gestion des licences logicielles** (B&R, Siemens TIA Portal, Studio 5000, AutoCAD, etc.)
- La **Politique BYOD** (si applicable)

## Avantages sociaux
- Assurance collective (maladie, dentaire, invalidité) après la période d'essai
- Programme d'aide aux employés (PAE) confidentiel
- Régime de retraite collectif (selon admissibilité)
- Jours fériés payés conformément à la LNT (8 jours statutaires)
- Budget de formation continue (conférences, livres techniques, cours en ligne)

## Non-concurrence et non-sollicitation
Conformément à l'article 2089 du *Code civil du Québec*, l'{{employee.employed}} s'engage à ne pas :
- **Solliciter** les clients de {{company.fullName}} pour son propre compte ou pour un concurrent, pendant **12 mois** suivant la cessation d'emploi
- **Solliciter ou débaucher** les employés de {{company.fullName}} pendant la même période
- Exercer pour son propre compte ou pour un concurrent direct sur le territoire du Québec, pendant **6 mois** post-emploi, des fonctions concurrentes utilisant les méthodes propriétaires de l'entreprise

Ces clauses sont jugées raisonnables compte tenu du caractère stratégique de l'accès aux clients, aux méthodes et au code source de l'entreprise.

## Politiques applicables
L'{{employee.employed}} s'engage à respecter l'ensemble des politiques internes (code de conduite, harcèlement, alcool/drogues, médias sociaux, etc.).

## Cessation d'emploi et restitution
Conformément aux articles 82 à 84 LNT, les préavis applicables sont ceux prévus par la loi. À la cessation :
- Tous les accès informatiques sont révoqués dans les 24 heures
- L'{{employee.employed}} restitue ou détruit toutes copies du code, des configurations et de la documentation
- Une attestation de non-conservation est signée

## Langue (Loi 96)
Conformément à la *Charte de la langue française*, le présent contrat est rédigé en français.

## Droit applicable et juridiction
Le présent contrat est régi par les lois du Québec. Tout litige sera soumis aux tribunaux du district judiciaire de Québec.
${SIGNATURES_BLOCK}`;

const CONTRACT_TEMPLATES: SeedContractTemplate[] = [
  // ───────────────────────────────────────────────────────────────────────
  // 9. CDI Technicien automatisation
  // ───────────────────────────────────────────────────────────────────────
  {
    name: "Permanent — Technicien automatisation",
    targetPositions: ["Technicien", "Technicien automatisation", "Technicien électrique", "Technicien mécanique"],
    targetDepartments: ["Ingénierie", "Technique", "Automatisation"],
    contractType: "permanent_full_time",
    defaultSalary: 65000,
    defaultRate: 32.5,
    defaultHoursPerWeek: 40,
    defaultVacationPct: 4.0,
    probationDays: 90,
    bodyMarkdown: `${cdiPreamble("Contrat de travail à durée indéterminée — Technicien automatisation")}

## Engagement
L'Employeur engage l'{{employee.employed}} à titre de **Technicien automatisation** au sein du département {{employee.department}}, à compter du {{contract.startDateFr}}.

## Fonctions principales
L'{{employee.employed}} exercera les fonctions suivantes, sans s'y limiter :
- Programmation et mise en service de systèmes d'automatisation industrielle (PLC, HMI, SCADA)
- Intervention sur des équipements Siemens (S7-1500, TIA Portal, WinCC), Allen-Bradley (ControlLogix, Studio 5000), B&R Automation
- Diagnostic et résolution de pannes en atelier et chez les clients
- Documentation technique des installations (schémas, procédures, manuels)
- Soutien technique à distance aux clients (téléphone, accès sécurisé)
- Participation aux audits techniques et aux refactorisations de code legacy
- Respect rigoureux des normes CSA, IEC et CNESST en chantier
- Toute autre tâche connexe demandée par le supérieur immédiat

## Lieu de travail
Le lieu principal est le siège social de {{company.fullName}}. Des déplacements chez les clients (Québec, Canada, occasionnellement international) sont à prévoir et font partie intégrante du poste. Les frais de déplacement sont remboursés selon la politique en vigueur.
${COMMON_CDI_SECTIONS}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 10. CDI Ingénieur
  // ───────────────────────────────────────────────────────────────────────
  {
    name: "Permanent — Ingénieur",
    targetPositions: ["Ingénieur électrique", "Ingénieur mécanique", "Ingénieur logiciel / automatisation"],
    targetDepartments: ["Ingénierie"],
    contractType: "permanent_full_time",
    defaultSalary: 90000,
    defaultRate: 45.0,
    defaultHoursPerWeek: 40,
    defaultVacationPct: 4.0,
    probationDays: 90,
    bodyMarkdown: `${cdiPreamble("Contrat de travail à durée indéterminée — Ingénieur")}

## Engagement
L'Employeur engage l'{{employee.employed}} à titre d'**Ingénieur{{employee.accordE}}** au sein du département {{employee.department}}, à compter du {{contract.startDateFr}}.

## Fonctions principales
- Conception de systèmes d'automatisation industrielle (architecture, sélection composants)
- Élaboration de devis techniques et de cahiers des charges
- Supervision technique de projets de mise en service
- Validation des conceptions et signature des plans (sceau OIQ si applicable)
- Mentorat des techniciens et accompagnement de l'équipe {{employee.team}}
- Représentation technique de {{company.fullName}} auprès des clients
- Veille technologique et innovation
- Respect du Code de déontologie de l'Ordre des ingénieurs du Québec

## Lieu de travail et déplacements
Le lieu principal est le siège social de {{company.fullName}}. Des déplacements clients sont fréquents. Une tolérance de télétravail jusqu'à 2 jours par semaine peut être accordée selon les besoins opérationnels.

## Obligations professionnelles
L'{{employee.employed}} doit maintenir en règle son adhésion à l'OIQ et à la *Loi sur les ingénieurs* du Québec. Les cotisations professionnelles sont remboursées par l'Employeur sur présentation de reçus.
${COMMON_CDI_SECTIONS}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 11. CDI Comptable / Responsable finances
  // ───────────────────────────────────────────────────────────────────────
  {
    name: "Permanent — Comptable / Responsable finances",
    targetPositions: ["Comptable"],
    targetDepartments: ["Comptabilité", "Finances", "Administration"],
    contractType: "permanent_full_time",
    defaultSalary: 70000,
    defaultRate: 35.0,
    defaultHoursPerWeek: 37.5,
    defaultVacationPct: 4.0,
    probationDays: 90,
    bodyMarkdown: `${cdiPreamble("Contrat de travail à durée indéterminée — Comptable / Responsable finances")}

## Engagement
L'Employeur engage l'{{employee.employed}} à titre de **Comptable / Responsable des finances** au sein du département {{employee.department}}, à compter du {{contract.startDateFr}}.

## Fonctions principales
- Tenue de livres complète (comptes clients, fournisseurs, conciliations bancaires)
- Production des états financiers mensuels, trimestriels et annuels
- Gestion de la paie (calcul, déductions à la source, T4, Relevé 1)
- Conformité fiscale (TPS/TVQ, acomptes provisionnels Revenu Québec et ARC)
- Préparation des dossiers pour mission d'examen ou audit externe
- Suivi de la trésorerie, gestion des comptes à recevoir et à payer
- Production de rapports de gestion à la direction
- Support à l'équipe {{employee.team}} sur les questions de facturation
- Veille fiscale et réglementaire (Revenu Québec, ARC, IFRS/NCECF)

## Lieu de travail
Le lieu principal est le siège social de {{company.fullName}}. Une formule hybride (télétravail partiel) est possible après la période d'essai.

## Confidentialité particulière
En raison de l'accès aux informations financières sensibles (salaires, marges, comptes clients), l'{{employee.employed}} est tenu{{employee.accordE}} à une obligation de confidentialité renforcée. Toute divulgation non autorisée constitue un motif sérieux de cessation d'emploi.

## Obligations professionnelles
Si l'{{employee.employed}} est titulaire d'un titre comptable (CPA), {{employee.pronoun}} doit maintenir en règle son adhésion à l'Ordre des CPA du Québec. Les cotisations sont remboursées par l'Employeur.
${COMMON_CDI_SECTIONS}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 12. CDI Représentant RH
  // ───────────────────────────────────────────────────────────────────────
  {
    name: "Permanent — Coordonnateur RH",
    targetPositions: ["Coordonnateur RH"],
    targetDepartments: ["Ressources humaines", "Administration"],
    contractType: "permanent_full_time",
    defaultSalary: 62000,
    defaultRate: 31.0,
    defaultHoursPerWeek: 37.5,
    defaultVacationPct: 4.0,
    probationDays: 90,
    bodyMarkdown: `${cdiPreamble("Contrat de travail à durée indéterminée — Représentant RH")}

## Engagement
L'Employeur engage l'{{employee.employed}} à titre de **Représentant{{employee.accordE}} des ressources humaines** au sein du département {{employee.department}}, à compter du {{contract.startDateFr}}.

## Fonctions principales
- Soutien au recrutement (affichage, présélection, entrevues, vérifications)
- Gestion du processus d'accueil et d'intégration (onboarding) des nouveaux employés
- Administration des dossiers employés (contrats, avenants, dossiers numériques)
- Soutien à la gestion de la paie et des avantages sociaux
- Suivi des absences, congés, vacances (CNESST)
- Application des politiques internes (harcèlement, conduite, santé-sécurité)
- Soutien à la résolution de conflits et accompagnement des gestionnaires
- Veille réglementaire (LNT, LSST, Loi 25)
- Participation aux comités santé-sécurité et autres comités RH

## Lieu de travail
Le lieu principal est le siège social de {{company.fullName}}. Télétravail partiel possible après la période d'essai.

## Confidentialité renforcée
En raison de l'accès à des renseignements personnels sensibles (NAS, données médicales, salaires, mesures disciplinaires), l'{{employee.employed}} est tenu{{employee.accordE}} à une obligation stricte de confidentialité, conformément à la *Loi 25* et à la *Loi sur les normes du travail*.

## Développement professionnel
{{company.fullName}} encourage l'adhésion à l'Ordre des CRHA et rembourse les cotisations professionnelles et la formation continue, sur approbation préalable.
${COMMON_CDI_SECTIONS}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 13. CDI Assistant administratif
  // ───────────────────────────────────────────────────────────────────────
  {
    name: "Permanent — Adjoint administratif",
    targetPositions: ["Adjoint{{employee.accordE}} administratif"],
    targetDepartments: ["Administration"],
    contractType: "permanent_full_time",
    defaultSalary: 48000,
    defaultRate: 24.0,
    defaultHoursPerWeek: 37.5,
    defaultVacationPct: 4.0,
    probationDays: 90,
    bodyMarkdown: `${cdiPreamble("Contrat de travail à durée indéterminée — Assistant{{employee.accordE}} / Adjoint{{employee.accordE}} administratif")}

## Engagement
L'Employeur engage l'{{employee.employed}} à titre d'**Assistant{{employee.accordE}} / Adjoint{{employee.accordE}} administratif** au sein du département {{employee.department}}, à compter du {{contract.startDateFr}}.

## Fonctions principales
- Accueil téléphonique et physique des visiteurs
- Gestion de la correspondance (courriels, courrier postal)
- Coordination des agendas et des réunions
- Préparation de documents (lettres, présentations, devis, factures)
- Soutien logistique aux déplacements (réservations, frais)
- Gestion des fournitures de bureau et de l'inventaire
- Classement et archivage de documents (papier et numérique)
- Soutien administratif à l'équipe {{employee.team}} et au supérieur immédiat {{employee.manager.fullName}}
- Toute autre tâche administrative requise

## Lieu de travail
Le lieu principal est le siège social de {{company.fullName}}. La nature du poste implique une présence physique régulière.

## Confidentialité
L'{{employee.employed}} aura accès à des informations confidentielles (correspondance, dossiers clients, données RH). Une obligation stricte de confidentialité s'applique.

## Compétences attendues
- Maîtrise du français écrit et oral (Loi 96)
- Bonne connaissance de la suite Microsoft 365 (Word, Excel, Outlook, Teams)
- Sens de l'organisation et autonomie
- Discrétion et professionnalisme
${COMMON_CDI_SECTIONS}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 14. CDI Gestionnaire / Directeur
  // ───────────────────────────────────────────────────────────────────────
  {
    name: "Permanent — Gestionnaire de projet",
    targetPositions: ["Chargé de projet"],
    targetDepartments: ["Gestion de projet", "Direction"],
    contractType: "permanent_full_time",
    defaultSalary: 110000,
    defaultRate: 55.0,
    defaultHoursPerWeek: 40,
    defaultVacationPct: 6.0,
    probationDays: 180,
    bodyMarkdown: `${cdiPreamble("Contrat de travail à durée indéterminée — Gestionnaire / Directeur")}

## Engagement
L'Employeur engage l'{{employee.employed}} à titre de **Gestionnaire / Directeur** du département {{employee.department}}, à compter du {{contract.startDateFr}}.

## Fonctions principales
- Direction et supervision de l'équipe {{employee.team}}
- Définition des objectifs opérationnels et stratégiques du département
- Évaluation du rendement des employés sous sa responsabilité
- Recrutement, intégration et développement des talents
- Gestion du budget et des ressources du département
- Reddition de comptes à la direction générale
- Représentation de {{company.fullName}} auprès des clients et partenaires stratégiques
- Veille concurrentielle et identification d'opportunités d'affaires
- Participation aux comités de direction
- Application et amélioration des politiques internes

## Lieu de travail et disponibilité
Le lieu principal est le siège social. Compte tenu du caractère stratégique du poste, l'{{employee.employed}} doit faire preuve d'une grande flexibilité d'horaire, incluant occasionnellement des soirs et fins de semaine. Aucune rémunération additionnelle n'est due pour les heures supplémentaires (cadre supérieur exclu de l'article 54 LNT).

## Confidentialité et loyauté
L'{{employee.employed}} est tenu{{employee.accordE}} à une obligation de loyauté renforcée envers {{company.fullName}}. Toute activité externe rémunérée doit faire l'objet d'une autorisation préalable écrite.

## Clause de non-concurrence
Pendant une période de **douze (12) mois** suivant la cessation d'emploi, l'{{employee.employed}} s'engage à ne pas exercer d'activité concurrente directe à celles de {{company.fullName}} sur le territoire du Québec, ni à solliciter les clients ou employés de l'entreprise. Cette clause est jugée raisonnable compte tenu du caractère stratégique du poste (article 2089 C.c.Q.).
${COMMON_CDI_SECTIONS}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 15. CDD (Contrat à durée déterminée)
  // ───────────────────────────────────────────────────────────────────────
  {
    name: "Temporaire — durée déterminée",
    contractType: "temporary",
    defaultHoursPerWeek: 40,
    defaultVacationPct: 4.0,
    probationDays: 30,
    bodyMarkdown: `${cdiPreamble("Contrat de travail à durée déterminée (CDD)")}

## Engagement et durée
L'Employeur engage l'{{employee.employed}} à titre de {{employee.position}} pour une **durée déterminée**, débutant le {{contract.startDateFr}} et se terminant **automatiquement** le {{contract.endDateFr}}, sans qu'aucun préavis ne soit requis de part et d'autre.

{{#if contract.endDateFr}}**Date de fin convenue :** {{contract.endDateFr}}{{/if}}

## Justification du caractère temporaire
Le présent contrat est conclu pour un besoin temporaire spécifique :
- [Préciser : surcroît de travail, remplacement, projet ponctuel, etc.]

## Fonctions
L'{{employee.employed}} exercera les fonctions liées au poste de {{employee.position}}, telles que définies par le supérieur immédiat {{employee.manager.fullName}}, au sein du département {{employee.department}}.

## Rémunération
- **Salaire annuel équivalent :** {{contract.salaryFormatted}} (au prorata de la durée)
- **Taux horaire :** {{contract.hourlyRate}} $ / heure
- **Indemnité de vacances :** {{contract.vacationPct}} % versée à chaque paie ou en fin de contrat

## Durée de travail
- {{contract.hoursPerWeek}} heures par semaine
- Heures supplémentaires rémunérées à 1,5x après 40 h/semaine (LNT)

## Période d'essai
{{#if contract.probationEndDateFr}}Période d'essai jusqu'au {{contract.probationEndDateFr}}. Chaque partie peut résilier sans préavis pendant cette période.{{/if}}

## Renouvellement
Le présent contrat ne fait l'objet d'aucune tacite reconduction. Tout renouvellement doit faire l'objet d'une nouvelle entente écrite signée par les deux parties avant l'échéance.

## Cessation anticipée
Une cessation anticipée par l'Employeur, sans motif sérieux, donnera droit à l'indemnité prévue à l'article 82.1 de la *Loi sur les normes du travail* (paiement du préavis légal selon l'ancienneté).

## Avantages sociaux
Les CDD bénéficient des mêmes avantages sociaux que les employés permanents, au prorata de la durée du contrat, conformément à l'article 87.1 LNT (interdiction de disparité de traitement basée sur le statut d'emploi).

## Politiques applicables
L'{{employee.employed}} s'engage à respecter toutes les politiques internes de {{company.fullName}} (conduite, confidentialité, harcèlement, sécurité).

## Langue, droit applicable
Contrat rédigé en français (Loi 96), régi par les lois du Québec.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 16. Convention de stage rémunéré
  // ───────────────────────────────────────────────────────────────────────
  {
    name: "Stage rémunéré",
    contractType: "internship",
    defaultRate: 20.0,
    defaultHoursPerWeek: 35,
    defaultVacationPct: 4.0,
    probationDays: 0,
    bodyMarkdown: `# Convention de stage rémunéré

**Entre les parties soussignées :**

{{company.fullName}}, ci-après désignée « l'Entreprise hôte »,

ET

{{employee.fullName}}, étudiant{{employee.accordE}} inscrit{{employee.accordE}} au programme **[NOM DU PROGRAMME]** à l'établissement **[NOM DE L'INSTITUTION]**, ci-après désigné{{employee.accordE}} « le/la Stagiaire ».

ET (le cas échéant)

**[NOM DE L'INSTITUTION D'ENSEIGNEMENT]**, ci-après désignée « l'Établissement ».

## Objet du stage
Le présent stage vise à permettre au/à la Stagiaire d'acquérir une expérience pratique dans le domaine de l'automatisation industrielle, en complément de sa formation académique.

## Durée et horaires
- **Date de début :** {{contract.startDateFr}}
-**Date de fin :** {{contract.endDateFr}}
-**Horaire :** {{contract.hoursPerWeek}} heures par semaine
- **Lieu :** siège social de {{company.fullName}} au {{company.address}}
## Objectifs pédagogiques
Le/la Stagiaire sera initié{{employee.accordE}} à :
- L'environnement de travail en automatisation industrielle
- Les outils et logiciels professionnels (Siemens TIA Portal, Studio 5000, etc.)
- Les méthodes de documentation et de gestion de projet
- La collaboration en équipe et la relation client
- Les normes de sécurité applicables (CNESST, LSST)

## Rémunération
- **Taux horaire :** {{contract.hourlyRate}} $ / heure (conforme ou supérieur au salaire minimum du Québec)
- **Indemnité de vacances :** {{contract.vacationPct}} % versée à chaque paie
- **Modalités :** versement aux deux semaines par dépôt direct
- **Déductions :** RRQ, AE, RQAP, impôts fédéral et provincial

## Encadrement
Le/la Stagiaire sera encadré{{employee.accordE}} par **{{employee.manager.fullName}}**, qui agira comme superviseur de stage. Une rencontre de suivi hebdomadaire est prévue.

## Évaluation
Une évaluation formelle sera remise à mi-parcours et en fin de stage. Une copie sera transmise à l'Établissement aux fins d'évaluation académique.

## Obligations du Stagiaire
- Respecter les politiques et procédures de {{company.fullName}}
- Maintenir la confidentialité des informations professionnelles (Loi 25)
- Faire preuve de ponctualité, d'assiduité et de professionnalisme
- Aviser sans délai en cas d'absence

## Couverture CNESST
Le/la Stagiaire est couvert{{employee.accordE}} par la CNESST en cas d'accident du travail :
- Si le stage est non rémunéré : couverture par l'Établissement d'enseignement
- Si le stage est rémunéré : couverture par l'Employeur (cas présent)

## Propriété intellectuelle
Toute création produite par le/la Stagiaire dans le cadre du stage appartient à {{company.fullName}}, conformément à la *Loi sur le droit d'auteur*.

## Cessation anticipée
Le stage peut être résilié par l'une ou l'autre des parties avec un préavis de **deux (2) semaines** ou pour motif sérieux sans préavis.

## Langue et droit applicable
Convention rédigée en français (Loi 96), régie par les lois du Québec.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 17. Contrat étudiant temps partiel
  // ───────────────────────────────────────────────────────────────────────
  {
    name: "Étudiant temps partiel",
    contractType: "student",
    defaultRate: 18.0,
    defaultHoursPerWeek: 20,
    defaultVacationPct: 4.0,
    probationDays: 30,
    bodyMarkdown: `# Contrat de travail — Étudiant à temps partiel

**Entre les parties soussignées :**

{{company.fullName}}, ci-après « l'Employeur »,

ET

{{employee.fullName}}, étudiant{{employee.accordE}} actif(ve), ci-après « l'{{employee.employed}} étudiant{{employee.accordE}} ».

## Engagement
L'Employeur engage l'{{employee.employed}} à titre de {{employee.position}}, sur une base **temps partiel**, à compter du {{contract.startDateFr}}{{#if contract.endDateFr}}, jusqu'au {{contract.endDateFr}}{{/if}}.

## Statut étudiant
L'{{employee.employed}} confirme être inscrit{{employee.accordE}} à temps plein dans un établissement d'enseignement reconnu et s'engage à maintenir ce statut pendant la durée du présent contrat. Tout changement (abandon des études, diplomation, passage à temps partiel) doit être communiqué dans les sept (7) jours.

## Horaires
- **Heures hebdomadaires :** {{contract.hoursPerWeek}} heures (modulables selon les périodes scolaires)
- **Pendant les sessions d'études :** horaire flexible compatible avec le calendrier académique
- **Pendant les vacances scolaires :** possibilité d'horaire à temps plein (jusqu'à 40 h/semaine) sur entente

## Rémunération
- **Taux horaire :** {{contract.hourlyRate}} $ / heure
- **Indemnité de vacances :** {{contract.vacationPct}} % versée à chaque paie
- **Modalités :** versement aux deux semaines par dépôt direct

## Période d'essai
{{#if contract.probationEndDateFr}}Période d'essai jusqu'au {{contract.probationEndDateFr}}.{{/if}}

## Fonctions
L'{{employee.employed}} effectuera les tâches confiées par son supérieur immédiat {{employee.manager.fullName}} au sein du département {{employee.department}}, en lien avec le poste de {{employee.position}}.

## Avantages sociaux
Les employés à temps partiel bénéficient des protections minimales prévues à la *Loi sur les normes du travail* :
- Salaire minimum respecté
- Indemnité de vacances 4%
- Jours fériés payés au prorata
- Pas de discrimination basée sur le statut d'emploi (art. 87.1 LNT)

## Politiques applicables
L'{{employee.employed}} s'engage à respecter toutes les politiques internes (conduite, confidentialité, harcèlement, sécurité, alcool/drogues).

## Cessation d'emploi
Chaque partie peut mettre fin au présent contrat avec un préavis conforme à la LNT (selon l'ancienneté). Pendant la période d'essai, aucun préavis n'est requis.

## Langue et droit applicable
Contrat rédigé en français (Loi 96), régi par les lois du Québec.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 18. Contrat de sous-traitance
  // ───────────────────────────────────────────────────────────────────────
  {
    name: "Pigiste / Sous-traitance",
    contractType: "freelance",
    defaultRate: 75.0,
    defaultVacationPct: 0,
    probationDays: 0,
    bodyMarkdown: `# Contrat de sous-traitance (travailleur autonome)

**IMPORTANT :** Le présent contrat est conclu avec un **travailleur autonome / sous-traitant** au sens du *Code civil du Québec* (articles 2098 et suivants). Il ne crée AUCUN lien d'emploi. Le Sous-traitant n'est pas un salarié au sens de la *Loi sur les normes du travail*.

**Entre les parties soussignées :**

{{company.fullName}}, ci-après « le Client »,

ET

{{employee.fullName}}, exploitant une entreprise individuelle (ou personne morale) sous le NEQ [À COMPLÉTER], ci-après « le Sous-traitant ».

## Objet
Le Sous-traitant s'engage à fournir au Client les services suivants :
- [Description précise des services / livrables]
- Services liés au poste fonctionnel de {{employee.position}}
## Durée
- **Début :** {{contract.startDateFr}}
-**Fin :** {{contract.endDateFr}} (ou à l'atteinte des livrables convenus)

## Indépendance du Sous-traitant
Le Sous-traitant :
- Conserve la pleine maîtrise de l'exécution de ses services
- Fournit son propre matériel et ses propres outils
- Peut exécuter les services depuis le lieu de son choix (sauf indication contraire)
- Peut travailler simultanément pour d'autres clients
- N'est pas tenu de respecter un horaire fixe imposé
- Assume seul ses charges fiscales, ses cotisations RRQ et son assurance

## Rémunération et facturation
- **Taux :** {{contract.hourlyRate}} $ / heure (ou forfait selon entente)
- **Facturation :** le Sous-traitant émet une facture mensuelle, incluant TPS/TVQ si applicable
- **Paiement :** net 30 jours suivant la date de facture
- **Aucune retenue à la source :** le Sous-traitant assume seul ses obligations fiscales

## Aucune relation d'emploi
Les parties reconnaissent expressément :
- Aucune relation employeur-employé n'est créée
- Le Sous-traitant n'a droit à aucun avantage social (vacances, assurance, jours fériés, RRQ employeur, AE)
- Aucune indemnité de cessation d'emploi n'est due en fin de contrat
- Le Sous-traitant ne peut prétendre à un statut de salarié devant un tribunal

## Responsabilité et assurance
Le Sous-traitant s'engage à maintenir en vigueur :
- Assurance responsabilité civile (minimum 2 000 000 $)
- Assurance accidents du travail (s'il s'inscrit volontairement à la CNESST comme travailleur autonome)
- Toute autre assurance requise par sa profession

## Confidentialité
Le Sous-traitant s'engage à maintenir la confidentialité de toutes les informations du Client, conformément aux politiques en vigueur et à la *Loi 25*.

## Propriété intellectuelle
Tous les livrables produits dans le cadre du présent contrat sont cédés en pleine propriété au Client dès la livraison et le paiement.

## Résiliation
Chaque partie peut résilier le présent contrat avec un préavis écrit de **trente (30) jours**, ou immédiatement en cas de manquement grave.

## Langue et droit applicable
Contrat rédigé en français (Loi 96), régi par les lois du Québec. Tout litige sera soumis aux tribunaux du district judiciaire de Québec.
${SIGNATURES_BLOCK}`,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // CONTRATS SPÉCIALISÉS VNK (9)
  // ═══════════════════════════════════════════════════════════════════════

  // ───────────────────────────────────────────────────────────────────────
  // 19. Permanent — Programmeur PLC
  // ───────────────────────────────────────────────────────────────────────
  {
    name: "Permanent — Programmeur PLC",
    targetPositions: ["Programmeur automatisation"],
    targetDepartments: ["Ingénierie", "Automatisation"],
    contractType: "permanent_full_time",
    defaultSalary: 75000,
    defaultRate: 37.5,
    defaultHoursPerWeek: 40,
    defaultVacationPct: 4.0,
    probationDays: 90,
    bodyMarkdown: `${cdiPreamble("Contrat de travail à durée indéterminée — Programmeur PLC")}

## Engagement

L'Employeur engage l'{{employee.employed}} à titre de **Programmeur PLC / automatisation** au sein du département {{employee.department}}, à compter du **{{contract.startDateFr}}**.

## Fonctions principales

L'{{employee.employed}} exercera notamment, sans que la liste soit limitative, les fonctions suivantes :

- Programmation de systèmes de contrôle industriel sur **B&R Automation Studio** (Structured Text IEC 61131-3, Ladder, FBD).
- Programmation sur **Allen-Bradley** (Studio 5000, RSLogix, ControlLogix, CompactLogix).
- Programmation sur **Siemens** (TIA Portal, Step 7, S7-1200 / S7-1500, WinCC).
- Configuration **HMI** et **SCADA** (B&R MappView, FactoryTalk View, WinCC).
- Conception et mise en place d'**architectures de communication** (Profinet, EtherNet/IP, OPC UA, Modbus).
- Mise en service sur site client : démarrage, calibration, optimisation.
- Diagnostic et résolution de pannes (atelier et à distance via Secomea SiteManager).
- **Documentation technique** : commentaires de code, manuels d'utilisation, dossiers de mise en service.
- Revue de code et **mentorat** des programmeurs juniors.
- Veille technologique sur les plateformes d'automatisation.

## Lieu de travail

Le lieu principal est le siège social de {{company.fullName}}. Une formule hybride (télétravail jusqu'à deux (2) jours par semaine) est possible après la période d'essai. Des déplacements chez les clients (Québec, Canada et occasionnellement à l'international) sont à prévoir pour les mises en service.

## Rémunération

Les conditions financières du présent engagement sont les suivantes :

| Élément | Détail |
| --- | --- |
| Salaire annuel brut | **{{contract.salaryFormatted}}** |
| Taux horaire équivalent | {{contract.hourlyRate}} $ / heure |
| Fréquence de paie | Versement aux deux semaines, par dépôt direct |
| Indemnité de vacances | {{contract.vacationPct}} % (conforme à la *Loi sur les normes du travail*) |
| Heures par semaine | {{contract.hoursPerWeek}} heures |

## Durée de travail

- **Heures normales :** {{contract.hoursPerWeek}} heures par semaine.
- **Horaire habituel :** du lundi au vendredi, formule hybride possible après la période d'essai.
- **Heures supplémentaires :** rémunérées à 1,5 fois le taux horaire après 40 heures par semaine (LNT).
- **Disponibilité ponctuelle** pour mises en service ou interventions critiques.

## Période d'essai

{{#if contract.probationEndDateFr}}Une période d'essai s'étendra du **{{contract.startDateFr}}** au **{{contract.probationEndDateFr}}**. Pendant cette période, chaque partie peut mettre fin au présent contrat sans préavis ni indemnité, sous réserve des droits prévus par la loi.{{/if}}{{#unless contract.probationEndDateFr}}Aucune période d'essai n'est prévue au présent contrat.{{/unless}}

## Propriété intellectuelle — Clause renforcée et cession explicite du code

Conformément à l'article 13(3) de la *Loi sur le droit d'auteur* (Canada), aux articles 2087 et 2088 du *Code civil du Québec*, et à la *Politique de propriété intellectuelle étendue* de {{company.fullName}}, l'{{employee.employed}} **cède irrévocablement, dès leur création**, à {{company.fullName}} la totalité des droits patrimoniaux portant notamment sur :

- **Codes sources** : tout langage informatique (C, C++, C#, Python, JavaScript / TypeScript, Java, etc.).
- **Programmes d'automates** : Ladder, FBD, Structured Text, IL, SFC pour B&R, Allen-Bradley (Studio 5000), Siemens (TIA Portal, Step 7), Schneider, Omron et toute autre plateforme PLC.
- **Programmes de robots** : FANUC TPP, ABB RAPID, KUKA KRL, etc.
- **Configurations HMI / SCADA** : WinCC, FactoryTalk View, MappView, Ignition, etc.
- **Documentation technique**, recettes, paramétrages, scripts d'automatisation.
- **Inventions** brevetables ou non, modèles industriels.
- **Toute œuvre dérivée**.

La cession est **mondiale, perpétuelle, exclusive et libre de redevances**. L'{{employee.employed}} renonce expressément à ses droits moraux dans la mesure permise par la loi. Il s'engage à signer tout document additionnel (cession spécifique, dépôt de brevet, attestation) requis pour parfaire les droits de {{company.fullName}}.

## Confidentialité et cybersécurité

L'{{employee.employed}} reconnaît avoir signé et s'engage à respecter les politiques internes suivantes :

- L'**Entente de confidentialité** (5 ans post-emploi).
- La **Politique de cybersécurité d'entreprise** (AMF, gestionnaire de mots de passe, postes durcis).
- La **Politique de cybersécurité industrielle IT / OT** (IEC 62443, séparation des réseaux).
- La **Politique de gestion du code source** (Git, dépôts internes uniquement, aucun secret en clair).
- La **Politique d'accès aux systèmes des clients** (Secomea SiteManager, comptes nominatifs, AMF).
- La **Politique de gestion des licences logicielles** (B&R, Siemens TIA Portal, Studio 5000, AutoCAD, etc.).
- La **Politique BYOD** (si applicable).

## Avantages sociaux

- Assurance collective (maladie, dentaire, invalidité) après la période d'essai.
- Programme d'aide aux employés (PAE) confidentiel.
- Régime de retraite collectif (selon admissibilité).
- Jours fériés payés conformément à la LNT (8 jours statutaires).
- Budget annuel de formation continue (conférences, livres techniques, cours en ligne).

## Non-concurrence et non-sollicitation

Conformément à l'article 2089 du *Code civil du Québec*, l'{{employee.employed}} s'engage à ne pas :

- **Solliciter** les clients de {{company.fullName}} pour son propre compte ou pour un concurrent, pendant **12 mois** suivant la cessation d'emploi.
- **Solliciter ou débaucher** les employés de {{company.fullName}} pendant la même période.
- **Exercer** pour son propre compte ou pour un concurrent direct sur le territoire du Québec, pendant **6 mois** post-emploi, des fonctions concurrentes utilisant les méthodes propriétaires de l'entreprise.

> Ces clauses sont jugées raisonnables compte tenu du caractère stratégique de l'accès aux clients, aux méthodes et au code source de l'entreprise.

## Politiques applicables

L'{{employee.employed}} s'engage à respecter l'ensemble des politiques internes en vigueur, notamment : code de conduite professionnelle, prévention du harcèlement, politique sur l'alcool et les drogues, politique sur les médias sociaux, et toute autre politique adoptée ultérieurement.

## Cessation d'emploi et restitution

Conformément aux articles 82 à 84 LNT, les préavis applicables sont ceux prévus par la loi. À la cessation de l'emploi :

1. Tous les accès informatiques sont **révoqués dans les 24 heures**.
2. L'{{employee.employed}} **restitue ou détruit** toutes copies du code, des configurations et de la documentation.
3. Une **attestation de non-conservation** est signée par l'{{employee.employed}}.

## Langue (Loi 96)

Conformément à la *Charte de la langue française*, le présent contrat est rédigé en français. L'{{employee.employed}} reconnaît avoir reçu et compris le présent contrat dans cette langue.

## Droit applicable et juridiction

Le présent contrat est régi par les lois du Québec. Tout litige sera soumis aux tribunaux du district judiciaire de Québec.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 20. Permanent — Programmeur robotique
  // ───────────────────────────────────────────────────────────────────────
  {
    name: "Permanent — Programmeur robotique",
    targetPositions: ["Programmeur robotique"],
    targetDepartments: ["Ingénierie", "Automatisation"],
    contractType: "permanent_full_time",
    defaultSalary: 78000,
    defaultRate: 39.0,
    defaultHoursPerWeek: 40,
    defaultVacationPct: 4.0,
    probationDays: 90,
    bodyMarkdown: `${cdiPreamble("Contrat de travail à durée indéterminée — Programmeur robotique")}

## Engagement
L'Employeur engage l'{{employee.employed}} à titre de **Programmeur robotique** au sein du département {{employee.department}}, à compter du {{contract.startDateFr}}.

## Fonctions principales
L'{{employee.employed}} exercera les fonctions suivantes, sans s'y limiter :
- Programmation de robots industriels **FANUC** (TPP, ROBOGUIDE, iRVision, Karel)
- Programmation **ABB** (RAPID, RobotStudio) lorsque applicable
- Programmation **KUKA** (KRL, WorkVisual) lorsque applicable
- Programmation de robots collaboratifs (cobots) selon les besoins
- Conception de cellules robotisées : sélection d'outils (EOAT), définition des trajectoires, optimisation des cycles
- Intégration avec systèmes de vision industrielle (FANUC iRVision, Cognex, Keyence)
- Mise en service sur site client : calibration, ajustements, formation des opérateurs
- Validation de sécurité des cellules (CSA Z434, ISO 10218)
- Diagnostic et résolution de pannes (atelier et à distance)
- Documentation complète : programmes commentés, manuels opérateur, dossiers de cellule
- Collaboration étroite avec les programmeurs PLC pour l'intégration des cellules dans des lignes complètes

## Lieu de travail
Le lieu principal est le siège social de {{company.fullName}}. Les mises en service nécessitent des déplacements chez les clients, principalement au Québec. Télétravail possible pour les phases de programmation hors ligne (ROBOGUIDE, RobotStudio).

## Sécurité spécifique robotique
L'{{employee.employed}} reconnaît les risques particuliers liés à la robotique et s'engage à respecter strictement :
- Les **procédures de cadenassage** lors de toute intervention en cellule
- Les **zones de sécurité** définies (barrières, scrutateurs laser, tapis sensibles)
- Les **modes de marche** (auto, manuel réduit, manuel pleine vitesse) selon les contextes
- Les normes **CSA Z434** et **ISO 10218** pour la sécurité robotique
${COMMON_PROGRAMMER_SECTIONS}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 21. Permanent — Concepteur / Dessinateur CAD
  // ───────────────────────────────────────────────────────────────────────
  {
    name: "Permanent — Concepteur / Dessinateur CAD",
    targetPositions: ["Concepteur / Dessinateur"],
    targetDepartments: ["Ingénierie"],
    contractType: "permanent_full_time",
    defaultSalary: 62000,
    defaultRate: 31.0,
    defaultHoursPerWeek: 40,
    defaultVacationPct: 4.0,
    probationDays: 90,
    bodyMarkdown: `${cdiPreamble("Contrat de travail à durée indéterminée — Concepteur / Dessinateur CAD")}

## Engagement
L'Employeur engage l'{{employee.employed}} à titre de **Concepteur / Dessinateur CAD** au sein du département {{employee.department}}, à compter du {{contract.startDateFr}}.

## Fonctions principales
L'{{employee.employed}} exercera les fonctions suivantes, sans s'y limiter :
- Conception et dessin de schémas électriques sur **AutoCAD Electrical** et **EPLAN Electric P8**
- Conception mécanique sur **SolidWorks** (le cas échéant)
- Élaboration de listes de matériel, schémas d'armoires, schémas de câblage
- Conformité aux normes applicables (CSA C22.2, IEC 60204-1, CSA Z434 pour cellules robotisées)
- Mise à jour des plans **tel que construit (as-built)** suite aux mises en service
- Bibliothèque de symboles, blocs et macros propriétaires
- Gestion documentaire des révisions (versionnage, codification, historique)
- Collaboration avec les ingénieurs (sceau OIQ requis sur les schémas finaux)
- Collaboration avec les programmeurs PLC pour l'adéquation schéma / programme
- Élaboration de manuels d'instruction et procédures pour le client

## Lieu de travail
Le lieu principal est le siège social. Formule hybride possible après la période d'essai. Déplacements ponctuels chez les clients pour relevés terrain.

## Propriété intellectuelle — Dessins et schémas
Conformément à l'article 13(3) de la *Loi sur le droit d'auteur*, à la *Politique de propriété intellectuelle étendue* et au présent contrat, **tous les dessins, schémas, plans, listes de matériel et documents techniques** produits par l'{{employee.employed}} dans le cadre de son emploi sont la propriété exclusive de {{company.fullName}}, incluant :
- Schémas AutoCAD et AutoCAD Electrical
- Schémas EPLAN
- Modèles SolidWorks (pièces, assemblages, mises en plan)
- Listes de matériel et de câbles
- Plans d'armoires électriques
- Bibliothèques de symboles personnalisés

L'{{employee.employed}} renonce expressément à ses droits moraux dans la mesure permise par la loi.
${COMMON_CDI_SECTIONS}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 22. Permanent — Chargé de projet
  // ───────────────────────────────────────────────────────────────────────
  {
    name: "Permanent — Chargé de projet",
    targetPositions: ["Chargé de projet"],
    targetDepartments: ["Gestion de projet"],
    contractType: "permanent_full_time",
    defaultSalary: 95000,
    defaultRate: 47.5,
    defaultHoursPerWeek: 40,
    defaultVacationPct: 4.0,
    probationDays: 120,
    bodyMarkdown: `${cdiPreamble("Contrat de travail à durée indéterminée — Chargé de projet")}

## Engagement
L'Employeur engage l'{{employee.employed}} à titre de **Chargé{{employee.accordE}} de projet** au sein du département {{employee.department}}, à compter du {{contract.startDateFr}}.

## Fonctions principales
L'{{employee.employed}} exercera les fonctions suivantes, sans s'y limiter :
- Planification, exécution et clôture de projets d'automatisation et de robotique
- Gestion du triangle classique : portée, échéancier, budget
- Coordination des équipes internes pluridisciplinaires (ingénieurs, programmeurs, techniciens, dessinateurs)
- Communication client : rencontres de démarrage, suivis périodiques, gestion des changements
- Suivi des engagements contractuels, des livrables et des jalons
- Production des rapports d'avancement, des feuilles de route, des registres de risques
- Coordination avec les fournisseurs et sous-traitants
- Gestion des changements et négociation des avenants
- Clôture de projet : livraison, formation client, transfert au service après-vente
- Retour d'expérience post-projet pour amélioration continue

## Lieu de travail
Le lieu principal est le siège social. Présence régulière chez les clients lors des phases critiques (mise en service, démarrage). Déplacements fréquents au Québec, occasionnels au Canada et à l'international.

## Délégation budgétaire et autorité
{{company.fullName}} délègue à l'{{employee.employed}} une **autorité budgétaire** allant jusqu'à **[montant à préciser]** par projet pour les achats opérationnels, l'embauche de sous-traitants ponctuels et la gestion des aléas. Toute décision excédant ce seuil requiert l'approbation préalable de la direction.

## Communication et représentation
L'{{employee.employed}} représente {{company.fullName}} auprès du client tout au long du projet et est porteur(se) de l'image et de la qualité de service de l'entreprise. Toute communication majeure doit être documentée par écrit (courriel ou registre de projet).

## Outils de gestion
- Maîtrise des outils internes (système ERP, registre de projet, suivi des heures)
- Microsoft Project ou équivalent pour les échéanciers
- Méthodologies hybrides (cascade, agile selon contexte)
- Reporting hebdomadaire à la direction
${COMMON_CDI_SECTIONS}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 23. Permanent — Représentant des ventes
  // ───────────────────────────────────────────────────────────────────────
  {
    name: "Permanent — Représentant des ventes",
    targetPositions: ["Représentant des ventes", "Vendeur"],
    targetDepartments: ["Ventes"],
    contractType: "permanent_full_time",
    defaultSalary: 70000,
    defaultRate: 35.0,
    defaultHoursPerWeek: 40,
    defaultVacationPct: 4.0,
    probationDays: 90,
    bodyMarkdown: `${cdiPreamble("Contrat de travail à durée indéterminée — Représentant des ventes")}

## Engagement
L'Employeur engage l'{{employee.employed}} à titre de **Représentant{{employee.accordE}} des ventes** au sein du département {{employee.department}}, à compter du {{contract.startDateFr}}.

## Fonctions principales
- Développement et prospection de nouveaux comptes industriels
- Maintien et croissance du portefeuille de clients existants
- Identification des besoins et qualification des opportunités
- Coordination avec le département technique pour l'élaboration des devis
- Présentation des solutions {{company.fullName}} aux clients (visites, conférences, salons)
- Négociation commerciale et conclusion d'affaires
- Suivi de la satisfaction client post-livraison
- Tenue à jour rigoureuse du CRM (opportunités, comptes, contacts)
- Reporting hebdomadaire sur le pipeline et les activités
- Veille concurrentielle et identification des tendances marché
- Participation aux salons industriels (CFIB, ISA, Automation Fair, etc.)

## Lieu de travail
Le lieu principal est le siège social. Déplacements fréquents chez les prospects et clients au Québec et au Canada, ponctuels aux États-Unis.

## Rémunération
- **Salaire annuel de base :** {{contract.salaryFormatted}}
-**Taux horaire équivalent :** {{contract.hourlyRate}} $ / heure
- **Plan de commissions :** selon le programme de rémunération variable annuel (objectif annuel défini, paliers, accélérateurs)
- **Frais de déplacement et représentation :** remboursés selon la politique en vigueur
- **Indemnité de vacances :** {{contract.vacationPct}} %

## Plan de commissions
- Commissions versées sur les contrats signés ET facturés
- Calcul mensuel, versement mensuel
- Plan détaillé fourni en annexe et révisé annuellement
- Aucune commission n'est due en cas de cessation d'emploi pour motif sérieux

## Durée de travail
- {{contract.hoursPerWeek}} heures par semaine, horaire flexible selon les besoins du marché
- Heures supplémentaires non rémunérées (poste exclu de l'art. 54 LNT vu la rémunération variable)

## Période d'essai
{{#if contract.probationEndDateFr}}Période d'essai jusqu'au {{contract.probationEndDateFr}}.{{/if}}

## Confidentialité commerciale renforcée
L'{{employee.employed}} reconnaît avoir accès à des informations commerciales hautement sensibles (prix, marges, listes de clients, stratégies). Une obligation stricte de confidentialité s'applique pendant et après l'emploi.

## NON-SOLLICITATION (article 2089 C.c.Q.)
Pendant une période de **douze (12) mois** suivant la cessation d'emploi, peu importe la cause, l'{{employee.employed}} s'engage à ne pas :
- **Solliciter, démarcher ou contacter** les clients de {{company.fullName}} avec lesquels {{employee.pronoun}} a eu des contacts dans les 24 mois précédant son départ
- **Solliciter ou débaucher** un employé de {{company.fullName}}
-**Utiliser ou divulguer** les listes de prospects, comptes, contacts et stratégies de prix

Cette clause est jugée raisonnable compte tenu de la nature commerciale du poste, du territoire (Québec et Canada) et de l'accès privilégié aux relations clients.

## Politiques applicables
L'{{employee.employed}} s'engage à respecter les politiques de {{company.fullName}} : code de conduite, cadeaux et hospitalité, anti-corruption, médias sociaux, déplacement chez le client.

## Avantages sociaux
Assurance collective, PAE, REER collectif selon admissibilité, allocation véhicule ou véhicule fourni (selon politique).

## Cessation, langue, juridiction
Conformément à la *Loi sur les normes du travail* et au *Code civil du Québec*. Contrat rédigé en français (Loi 96), régi par les lois du Québec.
${SIGNATURES_BLOCK}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 24. Permanent — Soumissionnaire / Estimateur
  // ───────────────────────────────────────────────────────────────────────
  {
    name: "Permanent — Soumissionnaire / Estimateur",
    targetPositions: ["Soumissionnaire / Estimateur"],
    targetDepartments: ["Ventes", "Ingénierie"],
    contractType: "permanent_full_time",
    defaultSalary: 72000,
    defaultRate: 36.0,
    defaultHoursPerWeek: 40,
    defaultVacationPct: 4.0,
    probationDays: 90,
    bodyMarkdown: `${cdiPreamble("Contrat de travail à durée indéterminée — Soumissionnaire / Estimateur")}

## Engagement
L'Employeur engage l'{{employee.employed}} à titre de **Soumissionnaire / Estimateur** au sein du département {{employee.department}}, à compter du {{contract.startDateFr}}.

## Fonctions principales
- Analyse des cahiers des charges, des plans et des devis techniques fournis par les clients
- Évaluation des heures de conception, programmation, intégration et mise en service
- Sollicitation et compilation des prix de matériel auprès des fournisseurs
- Élaboration des estimations détaillées (matériel, main-d'œuvre, sous-traitance, contingences)
- Rédaction des soumissions techniques et commerciales en français de qualité (Loi 96)
- Validation des hypothèses techniques avec les ingénieurs et programmeurs
- Suivi des soumissions soumises et adaptation suite aux questions des clients
- Tenue à jour des outils internes (chiffriers d'estimation, base de données de prix)
- Analyse post-projet : comparaison estimé vs réel pour amélioration continue
- Collaboration avec les représentants des ventes en phase d'avant-vente

## Lieu de travail
Le lieu principal est le siège social. Formule hybride possible après la période d'essai. Déplacements ponctuels chez les clients pour visites de relevé / préchiffrage.

## Confidentialité COMMERCIALE renforcée
En raison de son accès aux **prix coûtants des fournisseurs**, aux **marges appliquées**, aux **stratégies de pricing** et aux **soumissions en cours**, l'{{employee.employed}} est tenu{{employee.accordE}} à une obligation de confidentialité hautement renforcée. La divulgation de ces éléments à un tiers, y compris à un employé non concerné, peut constituer un motif sérieux de cessation d'emploi.

## Non-utilisation post-emploi
L'{{employee.employed}} ne peut, après son départ, utiliser les informations de marges, les stratégies de pricing ou les bases de prix de {{company.fullName}} au bénéfice de tout autre employeur, partenaire ou client. Cette obligation est complémentaire aux clauses générales de non-concurrence et de non-sollicitation.

## Compétences attendues
- Très bonne maîtrise des principes d'automatisation, instrumentation et robotique
- Solides compétences Excel (modélisation, fonctions avancées)
- Connaissance des fournisseurs Allen-Bradley, Siemens, Phoenix Contact, Rittal, FANUC
- Rigueur, sens du détail, capacité à respecter les délais serrés
- Très bonne maîtrise du français écrit (Loi 96)
${COMMON_CDI_SECTIONS}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 25. Permanent — Coordonnateur SAV
  // ───────────────────────────────────────────────────────────────────────
  {
    name: "Permanent — Coordonnateur SAV",
    targetPositions: ["Coordonnateur SAV", "Support client"],
    targetDepartments: ["Service après-vente", "Support"],
    contractType: "permanent_full_time",
    defaultSalary: 68000,
    defaultRate: 34.0,
    defaultHoursPerWeek: 40,
    defaultVacationPct: 4.0,
    probationDays: 90,
    bodyMarkdown: `${cdiPreamble("Contrat de travail à durée indéterminée — Coordonnateur SAV / Support client")}

## Engagement
L'Employeur engage l'{{employee.employed}} à titre de **Coordonnateur(trice) SAV / Support client** au sein du département {{employee.department}}, à compter du {{contract.startDateFr}}.

## Fonctions principales
- Premier point de contact pour les demandes de support après livraison
- Triage et qualification des appels et tickets de service
- Coordination des interventions techniques (programmeurs, techniciens, ingénieurs)
- Suivi des contrats d'entretien et des ententes de niveau de service (SLA)
- Gestion des **garanties** : analyse de couverture, autorisation des remplacements, retours fournisseur
- Suivi des **astreintes** : rotation des intervenants en mode garde, communication des coordonnées au client
- Tenue à jour du système de tickets / CRM
- Reddition de comptes hebdomadaire sur les indicateurs de performance (temps de réponse, taux de résolution)
- Identification des problèmes récurrents et remontée aux équipes de conception
- Préparation des renouvellements de contrats d'entretien
- Coordination des formations clients post-livraison

## Lieu de travail et disponibilité
Le lieu principal est le siège social. Présence physique requise pendant les heures d'ouverture du service.

## Astreintes (garde rotative)
L'{{employee.employed}} participe à la **rotation d'astreinte** du SAV, selon un calendrier établi 30 jours à l'avance :
- Une semaine sur [X] (le nombre dépend de la taille de l'équipe)
- Couverture en dehors des heures normales (soirs, fins de semaine, jours fériés)
- Indemnité d'astreinte : selon politique interne en vigueur
- Compensation des heures travaillées en astreinte au taux applicable (1.5x après 40 h/sem)

## Engagements de service
- Réponse aux demandes prioritaires dans les SLA convenus avec chaque client
- Communication proactive en cas de retard ou de complication
- Tenue rigoureuse de la documentation d'incident

## Compétences attendues
- Excellent service à la clientèle et gestion des situations délicates
- Bonne maîtrise technique des systèmes d'automatisation (formation continue assurée)
- Capacité de coordination multi-équipe
- Maîtrise des outils CRM / billetterie
- Français impeccable (Loi 96), anglais fonctionnel (clientèle hors Québec)
${COMMON_CDI_SECTIONS}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 26. Permanent — Technicien électrique
  // ───────────────────────────────────────────────────────────────────────
  {
    name: "Permanent — Technicien électrique",
    targetPositions: ["Technicien électrique"],
    targetDepartments: ["Technique"],
    contractType: "permanent_full_time",
    defaultSalary: 68000,
    defaultRate: 34.0,
    defaultHoursPerWeek: 40,
    defaultVacationPct: 4.0,
    probationDays: 90,
    bodyMarkdown: `${cdiPreamble("Contrat de travail à durée indéterminée — Technicien électrique")}

## Engagement
L'Employeur engage l'{{employee.employed}} à titre de **Technicien(ne) électrique** au sein du département {{employee.department}}, à compter du {{contract.startDateFr}}.

## Fonctions principales
- Assemblage, câblage et essais en atelier des armoires électriques (basse tension et contrôle)
- Installation des panneaux électriques chez les clients
- Raccordement de moteurs, variateurs (VFD), démarreurs progressifs
- Installation de capteurs, instrumentation et actionneurs
- Tests de continuité, mesures de résistance d'isolement, vérifications électriques
- Intervention en mise en service avec les programmeurs PLC
- Diagnostic et résolution de pannes électriques en atelier et en chantier
- Lecture et interprétation des schémas électriques (AutoCAD, EPLAN)
- Mises à jour des schémas tel que construit
- Respect des normes : **Code canadien de l'électricité** (CSA C22.1), **NFPA 79**, **CSA Z460** (cadenassage), **CSA Z462** (sécurité électrique)

## Qualifications professionnelles
- Diplôme d'études professionnelles en électricité ou DEC en technologie de l'électronique industrielle
- Carte de compétence pertinente le cas échéant (Compétence Québec / CCQ si chantiers assujettis)
- Atout : **certification arc flash** et formation au travail sous tension
${COMMON_FIELD_TECH_SECTIONS}`,
  },

  // ───────────────────────────────────────────────────────────────────────
  // 27. Permanent — Technicien mécanique
  // ───────────────────────────────────────────────────────────────────────
  {
    name: "Permanent — Technicien mécanique",
    targetPositions: ["Technicien mécanique"],
    targetDepartments: ["Technique"],
    contractType: "permanent_full_time",
    defaultSalary: 65000,
    defaultRate: 32.5,
    defaultHoursPerWeek: 40,
    defaultVacationPct: 4.0,
    probationDays: 90,
    bodyMarkdown: `${cdiPreamble("Contrat de travail à durée indéterminée — Technicien mécanique")}

## Engagement
L'Employeur engage l'{{employee.employed}} à titre de **Technicien(ne) mécanique** au sein du département {{employee.department}}, à compter du {{contract.startDateFr}}.

## Fonctions principales
- Assemblage mécanique des cellules et systèmes en atelier
- Installation et alignement des équipements en chantier client
- Lecture et interprétation des plans mécaniques (SolidWorks, AutoCAD)
- Préparation, soudure légère et ajustements mécaniques au besoin
- Installation et réglage des systèmes pneumatiques et hydrauliques
- Démarrage mécanique en collaboration avec les programmeurs (calibration de capteurs, ajustement d'outils EOAT)
- Diagnostic et résolution de problèmes mécaniques sur des équipements industriels
- Entretien préventif et correctif
- Tenue à jour de la documentation technique mécanique
- Respect des normes applicables (CSA Z432 protection des machines, ISO 12100)

## Qualifications professionnelles
- DEP en mécanique industrielle, mécanique de machines fixes, ou DEC en technologie de maintenance industrielle
- Atouts : carte CCQ (mécanicien de chantier), formation soudure, lecture de plans hydrauliques/pneumatiques
${COMMON_FIELD_TECH_SECTIONS}`,
  },
];

// ════════════════════════════════════════════════════════════════════════════
// SEED EXECUTION
// ════════════════════════════════════════════════════════════════════════════

export async function seedDocumentTemplates() {
  console.log("🌱 Seed : bibliothèque de templates de documents FR-QC\n");

  // ─── CLEANUP : retire les duplicates "(copie)" laisses par
  // duplicateTemplateAction / duplicateLegalTemplateAction / duplicateHandbookAction.
  // Le seed est idempotent : on garde uniquement les templates originaux.
  // ─────────────────────────────────────────────────────────────────────────
  const legalCopies = await prisma.legalDocumentTemplate.deleteMany({
    where: { title: { contains: "(copie)" } },
  });
  const contractCopies = await prisma.contractTemplate.deleteMany({
    where: { name: { contains: "(copie)" } },
  });
  // Cahier : modele DocumentHandbook (cast any : meme limitation que plus bas
  // tant que `prisma generate` n'a pas reconnu le modele dans certains envs).
  let handbookCopiesCount = 0;
  try {
    const prismaAnyEarly = prisma as unknown as {
      documentHandbook: {
        deleteMany: (args: unknown) => Promise<{ count: number }>;
      };
    };
    const r = await prismaAnyEarly.documentHandbook.deleteMany({
      where: { title: { contains: "(copie)" } },
    });
    handbookCopiesCount = r.count;
  } catch {
    /* DocumentHandbook pas dans le client genere : ignore. */
  }
  console.log(
    `  ✓ Nettoyage "(copie)" : ${legalCopies.count} legal + ${contractCopies.count} contrat + ${handbookCopiesCount} cahier supprime(s)`,
  );

  // ─── LEGAL TEMPLATES (50) ───────────────────────────────────────────────
  let createdLegal = 0;
  let updatedLegal = 0;
  let unclassified = 0;
  for (const t of LEGAL_TEMPLATES) {
    const classification = TEMPLATE_CLASSIFICATION[t.key];
    if (!classification) {
      unclassified++;
      console.warn(`  ⚠ Template non classifie (defaut applique) : ${t.key}`);
    }
    const { ack, scope } = classification ?? DEFAULT_CLASSIFICATION;
    const adaptedBody = adaptTemplateBody(t.bodyMarkdown, scope, ack);
    const data = {
      key: t.key,
      title: t.title,
      category: t.category,
      version: t.version,
      bodyMarkdown: adaptedBody,
      isRequired: t.isRequired,
      isActive: true,
      isStarter: true,
      targetPositions: t.targetPositions ?? [],
      targetDepartments: t.targetDepartments ?? [],
      // FIXME: cast jusqu'au prochain `npx prisma generate` (acknowledgmentMode
      // et signatureScope sont en DB mais pas encore dans le client TS genere).
      ...({ acknowledgmentMode: ack, signatureScope: scope } as object),
    };
    const existing = await prisma.legalDocumentTemplate.findUnique({
      where: { key: t.key },
    });
    if (existing) {
      await prisma.legalDocumentTemplate.update({
        where: { key: t.key },
        data,
      });
      updatedLegal++;
    } else {
      await prisma.legalDocumentTemplate.create({ data });
      createdLegal++;
    }
  }
  console.log(`  ✓ Documents légaux : ${createdLegal} créés, ${updatedLegal} mis à jour${unclassified > 0 ? ` (${unclassified} non classifies)` : ""}`);

  // ─── CONTRACT TEMPLATES (19) ────────────────────────────────────────────
  // ContractTemplate n'a pas de clé unique (name n'est pas @unique).
  // On upsert manuellement via findFirst(name) + create/update.
  let createdContracts = 0;
  let updatedContracts = 0;
  for (const t of CONTRACT_TEMPLATES) {
    const data = {
      name: t.name,
      contractType: t.contractType,
      bodyMarkdown: t.bodyMarkdown,
      defaultSalary: t.defaultSalary ?? null,
      defaultRate: t.defaultRate ?? null,
      defaultHoursPerWeek: t.defaultHoursPerWeek ?? null,
      defaultVacationPct: t.defaultVacationPct ?? null,
      probationDays: t.probationDays ?? null,
      isActive: true,
      isStarter: true,
      targetPositions: t.targetPositions ?? [],
      targetDepartments: t.targetDepartments ?? [],
    };
    const existing = await prisma.contractTemplate.findFirst({
      where: { name: t.name },
    });
    if (existing) {
      await prisma.contractTemplate.update({
        where: { id: existing.id },
        data,
      });
      updatedContracts++;
    } else {
      await prisma.contractTemplate.create({ data });
      createdContracts++;
    }
  }
  console.log(`  ✓ Contrats : ${createdContracts} créés, ${updatedContracts} mis à jour`);

  // ─── HANDBOOK "Manuel de l'employé VNK" ─────────────────────────────────
  // Regroupe automatiquement TOUS les templates "reading_only" issus de la
  // famille politiques / codes / chartes / accuses / manuels. L'employe signe
  // UNE FOIS le manuel et couvre l'ensemble des engagements generaux, plutot
  // que de devoir signer 30+ politiques individuellement.
  //
  // FIXME: cast (prisma as any) jusqu'au prochain `npx prisma generate` ;
  // les modeles DocumentHandbook / DocumentHandbookItem sont en DB mais
  // peuvent ne pas etre encore connus du client TS genere.
  const prismaAny = prisma as unknown as {
    legalDocumentTemplate: {
      findMany: (args: unknown) => Promise<Array<{ id: number; title: string; key: string }>>;
    };
    documentHandbook: {
      upsert: (args: unknown) => Promise<{ id: number; title: string }>;
    };
    documentHandbookItem: {
      deleteMany: (args: unknown) => Promise<{ count: number }>;
      createMany: (args: unknown) => Promise<{ count: number }>;
    };
  };

  // On inclut TOUS les templates reading_only (= politiques, codes, chartes,
  // accuses, manuels, programmes internes). Categorie technique ("legal",
  // "onboarding") nest pas pertinente ; le critere fonctionnel est l'engagement
  // (lecture seule = candidat au cahier ; signature = doc individuel).
  const handbookTemplates = await prismaAny.legalDocumentTemplate.findMany({
    where: {
      isActive: true,
      acknowledgmentMode: "reading_only",
    },
    orderBy: { title: "asc" },
  });

  const handbook = await prismaAny.documentHandbook.upsert({
    where: { key: "vnk_employee_handbook" },
    update: {
      title: "Manuel de l'employé VNK Automatisation",
      subtitle: "Politiques internes, codes de conduite et engagements généraux",
      coverIntro:
        "Ce manuel regroupe l'ensemble des politiques internes, codes de conduite et engagements généraux applicables à tous les employés de VNK Automatisation Inc.\n\nEn signant ce manuel, vous reconnaissez avoir pris connaissance de chaque chapitre et vous engagez à les respecter.",
      version: "1.0",
      isRequired: true,
      isActive: true,
      signatureScope: "employee_only",
    },
    create: {
      key: "vnk_employee_handbook",
      title: "Manuel de l'employé VNK Automatisation",
      subtitle: "Politiques internes, codes de conduite et engagements généraux",
      coverIntro:
        "Ce manuel regroupe l'ensemble des politiques internes, codes de conduite et engagements généraux applicables à tous les employés de VNK Automatisation Inc.\n\nEn signant ce manuel, vous reconnaissez avoir pris connaissance de chaque chapitre et vous engagez à les respecter.",
      version: "1.0",
      isRequired: true,
      isActive: true,
      signatureScope: "employee_only",
    },
  });

  // On reconstruit la liste des items a chaque execution (idempotent) :
  // delete + createMany pour garantir l'ordre correct et permettre l'ajout
  // de nouveaux templates a la bibliotheque sans intervention manuelle.
  await prismaAny.documentHandbookItem.deleteMany({
    where: { handbookId: handbook.id },
  });
  if (handbookTemplates.length > 0) {
    await prismaAny.documentHandbookItem.createMany({
      data: handbookTemplates.map((t, idx) => ({
        handbookId: handbook.id,
        templateId: t.id,
        orderIndex: idx,
      })),
      skipDuplicates: true,
    });
  }
  console.log(
    `  ✓ Cahier "${handbook.title}" : ${handbookTemplates.length} chapitre${handbookTemplates.length > 1 ? "s" : ""} inclus`,
  );

  const total = LEGAL_TEMPLATES.length + CONTRACT_TEMPLATES.length;
  console.log(`\n✅ Seed terminé — ${total} templates au total (${LEGAL_TEMPLATES.length} légaux + ${CONTRACT_TEMPLATES.length} contrats) + 1 cahier employé`);
}

// Exécution standalone (compat CJS via ts-node + ESM via tsx/node récent).
// On évite `require.main === module` (KO en ESM) et `import.meta` (KO en CJS).
// On compare process.argv[1] au nom du fichier courant : si match, on lance.
const argvScript = (process.argv[1] ?? "").replace(/\\/g, "/").toLowerCase();
const isDirectRun = argvScript.endsWith("seed-document-templates.ts") ||
  argvScript.endsWith("seed-document-templates.js");

if (isDirectRun) {
  seedDocumentTemplates()
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
