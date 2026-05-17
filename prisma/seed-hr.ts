// Seed RH — jours fériés Québec + politiques par défaut.
// Exécution standalone : tsx prisma/seed-hr.ts
//
// Peut être appelée depuis le seed principal en important seedHrData().
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Jours fériés payés au Québec (LNT) — 8 jours
function generateHolidays(year: number) {
  // Calculs simples (les dates Pâques/Action de grâce sont calculées via algo)
  const easter = computeEaster(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  // Lundi de Pâques (alternatif à Vendredi saint)
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  // Fête de la Reine / Patriotes (lundi avant 25 mai)
  const may24 = new Date(year, 4, 24);
  const patriotes = new Date(may24);
  patriotes.setDate(24 - (may24.getDay() === 0 ? 6 : may24.getDay() - 1));

  // Action de grâce (2e lundi octobre)
  const oct1 = new Date(year, 9, 1);
  const thanksgiving = new Date(year, 9, 1 + ((1 - oct1.getDay() + 7) % 7) + 7);

  // Fête du Travail (1er lundi septembre)
  const sep1 = new Date(year, 8, 1);
  const labourDay = new Date(year, 8, 1 + ((1 - sep1.getDay() + 7) % 7));

  return [
    { date: new Date(year, 0, 1), name: "Jour de l'An" },
    { date: goodFriday, name: "Vendredi saint" },
    { date: patriotes, name: "Journée nationale des patriotes" },
    { date: new Date(year, 5, 24), name: "Fête nationale du Québec" },
    { date: new Date(year, 6, 1), name: "Fête du Canada" },
    { date: labourDay, name: "Fête du Travail" },
    { date: thanksgiving, name: "Action de grâce" },
    { date: new Date(year, 11, 25), name: "Noël" },
  ];
}

function computeEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Politiques RH obligatoires Québec
const DEFAULT_POLICIES = [
  {
    key: "harassment",
    title: "Politique de prévention du harcèlement psychologique et sexuel",
    version: "1.0",
    bodyMarkdown: `# Politique de prévention du harcèlement psychologique et sexuel au travail

**En vigueur :** [date]
**Référence légale :** Articles 81.18 à 81.20 de la *Loi sur les normes du travail* du Québec

## 1. Engagement de l'employeur
VNK Automatisation Inc. s'engage à offrir à toutes ses employées et à tous ses employés un milieu de travail exempt de toute forme de harcèlement psychologique et sexuel.

## 2. Définition
Le harcèlement psychologique est une conduite vexatoire se manifestant soit par des comportements, des paroles, des actes ou des gestes répétés qui :
- sont hostiles ou non désirés ;
- portent atteinte à la dignité ou à l'intégrité psychologique ou physique du salarié ;
- entraînent, pour celui-ci, un milieu de travail néfaste.

Une seule conduite grave peut aussi constituer du harcèlement si elle porte une telle atteinte et produit un effet nocif continu.

## 3. Comportements interdits
- Insultes, menaces, intimidation, isolement, dénigrement
- Avances sexuelles non désirées
- Commentaires offensants liés à l'origine, religion, orientation sexuelle, handicap, âge, sexe
- Cyberintimidation par courriel, réseaux sociaux ou texto

## 4. Mécanisme de plainte
Tout employé qui se croit victime de harcèlement doit en aviser son supérieur immédiat OU le responsable RH désigné. Si le harceleur présumé est le supérieur immédiat, la plainte est dirigée vers la direction générale.

**Confidentialité garantie.** Aucune représaille ne sera tolérée envers une personne ayant déposé une plainte de bonne foi.

## 5. Enquête
L'employeur s'engage à mener une enquête rapide, impartiale et confidentielle. Les sanctions peuvent aller jusqu'au congédiement.

## 6. Recours externe
L'employé peut aussi déposer une plainte directement à la **CNESST** dans les 2 ans suivant la dernière manifestation de harcèlement.
`,
    effectiveFrom: new Date(),
  },
  {
    key: "remote_work",
    title: "Politique de télétravail",
    version: "1.0",
    bodyMarkdown: `# Politique de télétravail

## 1. Admissibilité
Le télétravail est offert aux employés dont le poste est compatible (administratif, programmation, support technique à distance). L'admissibilité est déterminée conjointement par l'employé et son superviseur.

## 2. Conditions
- Disposer d'un espace de travail sécuritaire à domicile
- Avoir une connexion Internet stable (min. 50 Mbps)
- Respecter les horaires convenus
- Être joignable pendant les heures de travail

## 3. Équipement
L'employeur fournit l'équipement informatique de base. Tout équipement attribué doit être retourné lors d'un retour au bureau permanent ou à la fin d'emploi.

## 4. Sécurité de l'information
- Connexion VPN obligatoire pour accéder aux systèmes internes
- Pas de stockage de fichiers confidentiels sur appareil personnel
- Verrouillage automatique session après 10 min d'inactivité

## 5. Santé et sécurité
L'employé doit signaler tout incident survenu pendant les heures de télétravail (ergonomie, accident). La CNESST couvre les accidents en télétravail.
`,
    effectiveFrom: new Date(),
  },
  {
    key: "it_usage",
    title: "Politique d'utilisation des ressources informatiques",
    version: "1.0",
    bodyMarkdown: `# Politique d'utilisation des ressources informatiques

## 1. Portée
Cette politique couvre tous les équipements, logiciels, comptes et données mis à disposition par VNK Automatisation Inc.

## 2. Utilisation acceptable
- Usage professionnel prioritaire
- Usage personnel raisonnable toléré (pauses, lunch)
- Respect des droits d'auteur et licences logicielles

## 3. Interdictions
- Téléchargement de contenu illégal ou contraire aux bonnes mœurs
- Installation de logiciels non autorisés
- Partage des identifiants/mots de passe
- Utilisation d'outils contournant la sécurité (proxy non autorisé, VPN externe)

## 4. Sécurité
- Mot de passe ≥ 12 caractères avec MAJ, min, chiffre
- Activation obligatoire de la 2FA (ou passkey)
- Verrouillage session quand on quitte le bureau
- Signalement immédiat d'un appareil perdu/volé

## 5. Surveillance
L'employeur se réserve le droit de surveiller l'utilisation des ressources informatiques dans le respect de la *Loi 25* et de la *Charte des droits et libertés*.

## 6. Sanctions
Toute violation peut entraîner des mesures disciplinaires pouvant aller jusqu'au congédiement, sans préjudice des recours civils ou pénaux.
`,
    effectiveFrom: new Date(),
  },
  {
    key: "code_of_conduct",
    title: "Code de conduite éthique",
    version: "1.0",
    bodyMarkdown: `# Code de conduite éthique

## Nos valeurs
1. **Intégrité** — Faire ce qui est juste, même quand personne ne regarde
2. **Respect** — Traiter tout le monde avec dignité et courtoisie
3. **Excellence** — Viser la qualité dans chaque livrable client
4. **Sécurité** — Mettre la sécurité avant tout en chantier
5. **Confidentialité** — Protéger les informations sensibles des clients et collègues

## Conduite attendue
- Respecter les engagements pris envers clients et collègues
- Signaler tout conflit d'intérêts potentiel
- Refuser cadeaux ou avantages susceptibles d'influencer une décision
- Représenter l'entreprise de façon professionnelle (en personne, en ligne, sur les réseaux sociaux)

## Conduite interdite
- Discrimination ou propos discriminatoires (Charte des droits)
- Utilisation des informations confidentielles à des fins personnelles
- Concurrence déloyale envers VNK pendant et après l'emploi
- Représentation non autorisée de l'entreprise

## Dénonciation
Tout employé peut signaler de bonne foi un manquement à ce code via le canal de divulgation d'irrégularités. Aucune représaille ne sera tolérée.
`,
    effectiveFrom: new Date(),
  },
  {
    key: "data_privacy",
    title: "Politique de protection des renseignements personnels (Loi 25)",
    version: "1.0",
    bodyMarkdown: `# Politique de protection des renseignements personnels

**Conformité :** *Loi modernisant des dispositions législatives en matière de protection des renseignements personnels (Loi 25, Québec)*

## 1. Données collectées
VNK Automatisation Inc. collecte les renseignements suivants pour la gestion d'emploi :
- Identité (nom, NAS, date de naissance)
- Coordonnées (adresse, téléphone, courriel)
- Information bancaire pour dépôt direct (chiffrée AES-256)
- Antécédents professionnels et formations
- Coordonnées d'urgence
- Données de santé liées au travail (CNESST)

## 2. Finalités
Ces données servent uniquement à :
- Gestion du contrat de travail
- Versement de la paie et avantages sociaux
- Conformité fiscale (T4, Relevé 1)
- Sécurité au travail
- Communication d'urgence

## 3. Conservation
Les données sont conservées pendant la durée de l'emploi + 7 ans (obligation fiscale Revenu Québec/ARC) puis détruites ou anonymisées.

## 4. Vos droits (Loi 25)
- **Accès** : consulter toutes les données vous concernant (exportation à la demande)
- **Rectification** : corriger toute donnée inexacte
- **Effacement** : demander la suppression (sauf obligations légales)
- **Portabilité** : recevoir vos données en format structuré

## 5. Responsable
La personne responsable de la protection des renseignements personnels chez VNK est : **[NOM RESPONSABLE]**, joignable à **[EMAIL]**.

## 6. Incident
En cas d'incident de confidentialité, VNK s'engage à :
- Notifier la Commission d'accès à l'information dans les meilleurs délais
- Aviser les personnes concernées si risque de préjudice sérieux
- Documenter l'incident dans le registre prévu à cet effet
`,
    effectiveFrom: new Date(),
  },
];

export async function seedHrData() {
  console.log("🌱 Seed RH : jours fériés + politiques par défaut\n");

  // Jours fériés pour année courante + suivante
  const thisYear = new Date().getFullYear();
  for (const year of [thisYear, thisYear + 1]) {
    const holidays = generateHolidays(year);
    for (const h of holidays) {
      try {
        await prisma.holiday.upsert({
          where: { date_name: { date: h.date, name: h.name } },
          create: { date: h.date, name: h.name, type: "statutory", isPaid: true },
          update: {},
        });
      } catch {
        // ignore duplicates
      }
    }
    console.log(`  ✓ ${year} : ${holidays.length} jours fériés`);
  }

  // Politiques par défaut
  // On a besoin d'un publisher (super_admin)
  const publisher = await prisma.admin.findFirst({
    where: { customRole: { name: "super_admin" } },
  });
  if (!publisher) {
    console.log("  ⚠️  Aucun super_admin trouvé — politiques non créées. Lancez après le seed principal.");
    return;
  }

  for (const p of DEFAULT_POLICIES) {
    const existing = await prisma.hrPolicy.findUnique({ where: { key: p.key } });
    if (existing) {
      console.log(`  · ${p.key} : déjà existante (vous pouvez la modifier dans le portail)`);
      continue;
    }
    await prisma.hrPolicy.create({
      data: { ...p, publishedBy: publisher.id, isActive: true },
    });
    console.log(`  ✓ Politique créée : ${p.title}`);
  }

  console.log("\n✅ Seed RH terminé.");
}

// Exécution standalone
if (require.main === module) {
  seedHrData()
    .catch((err) => { console.error(err); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
}
