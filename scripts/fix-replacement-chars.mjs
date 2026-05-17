// Fix U+FFFD replacement chars (�) en remplaçant chaque mot cassé par sa version propre.
// Usage: node scripts/fix-replacement-chars.mjs <file1> [file2 ...]
import { readFileSync, writeFileSync } from "node:fs";

// Map de mots cassés (avec �) → version propre. Liste exhaustive des cas rencontrés.
const REPLACEMENTS = [
  // CNESST view
  ["irr�versible", "irréversible"],
  ["supprim�", "supprimé"],
  ["Envoy�", "Envoyé"],
  ["envoy�", "envoyé"],
  ["envoy�es", "envoyées"],
  ["enregistr�", "enregistré"],
  ["� la CNESST", "à la CNESST"],
  ["Marquer envoy�", "Marquer envoyé"],
  // Generic word fixes
  ["R�union", "Réunion"],
  ["r�union", "réunion"],
  ["retir�e", "retirée"],
  ["d�finitivement", "définitivement"],
  ["d�j�", "déjà"],
  ["support�", "supporté"],
  ["T�l�charger", "Télécharger"],
  ["t�l�charger", "télécharger"],
  ["g�n�ration", "génération"],
  ["g�n�rer", "générer"],
  ["g�n�r�", "généré"],
  ["g�n�r�e", "générée"],
  ["g�n�r�s", "générés"],
  ["g�n�r�es", "générées"],
  ["remplac�s", "remplacés"],
  ["remplac�e", "remplacée"],
  ["remplac�", "remplacé"],
  ["employ�s", "employés"],
  ["employ�", "employé"],
  ["employ�e", "employée"],
  ["employ�es", "employées"],
  ["D�mar", "Démar"],
  ["d�marr�", "démarré"],
  ["d�marr�e", "démarrée"],
  ["ferm�e", "fermée"],
  ["ferm�es", "fermées"],
  ["ferm�", "fermé"],
  ["approuv�es", "approuvées"],
  ["approuv�e", "approuvée"],
  ["approuv�s", "approuvés"],
  ["approuv�", "approuvé"],
  ["entr�e", "entrée"],
  ["entr�es", "entrées"],
  ["r�viser", "réviser"],
  ["r�sultat", "résultat"],
  ["r�sultats", "résultats"],
  ["historique sera perdu", "historique sera perdu"],
  ["Date d'envoi � la", "Date d'envoi à la"],
  ["envoy� � la", "envoyé à la"],
  ["� approuver", "à approuver"],
  ["enregistr�es", "enregistrées"],
  ["� (AAAA", "à (AAAA"],
  ["(AAAA-MM-JJ)", "(AAAA-MM-JJ)"],
  // Em-dashes that became �
  ['"�"', '"—"'],
  ["return \"�\";", "return \"—\";"],
  // Stand-alone � à proximité d'un mot
  ["� r�viser", "à réviser"],
  ["� chaque paie", " avant chaque paie"],
  ["� approuver", "à approuver"],
  // Pointage / timeclock specifics
  ["Pointage fermé � ", "Pointage fermé à "],
  ["travail � approuvées", "travail · approuvées"],
  ["Démarr� � ", "Démarré à "],
  ["Arr�ter", "Arrêter"],
  ["Approuv�e", "Approuvée"],
  ["Approuv�", "Approuvé"],
  ["Supprim�", "Supprimé"],
  ["s�lectionn�e", "sélectionnée"],
  ["s�lectionn�es", "sélectionnées"],
  ["D�s�lectionner", "Désélectionner"],
  ["Aucune entrée � réviser", "Aucune entrée à réviser"],
  ["Rejet�e", "Rejetée"],
  ['{" � "}', '{" · "}'],
  ['" � en cours"', '" · en cours"'],
  ["Entr�e ajout�e", "Entrée ajoutée"],
  ["p�riode oubli�e", "période oubliée"],
  ["soumise � approbation", "soumise à approbation"],
  ["D�but", "Début"],
  ["Cat�gorie", "Catégorie"],
  // Trainings view
  ["retir� de votre dossier", "retiré de votre dossier"],
];

function fixFile(filepath) {
  let content = readFileSync(filepath, "utf8");
  if (!content.includes("�")) {
    console.log(`= ${filepath} (aucun � trouvé)`);
    return false;
  }
  let changes = 0;
  for (const [bad, good] of REPLACEMENTS) {
    if (content.includes(bad)) {
      const before = content;
      content = content.split(bad).join(good);
      if (content !== before) changes++;
    }
  }
  // Compte les � restants
  const remaining = (content.match(/�/g) ?? []).length;
  writeFileSync(filepath, content, "utf8");
  if (remaining > 0) {
    console.log(`⚠ ${filepath} (${changes} remplacements, ${remaining} � restants à fixer manuellement)`);
  } else {
    console.log(`✓ ${filepath} (${changes} remplacements)`);
  }
  return true;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node scripts/fix-replacement-chars.mjs <file1> [file2 ...]");
  process.exit(1);
}
for (const f of files) {
  try { fixFile(f); } catch (err) { console.error(`✗ ${f}: ${err.message}`); }
}
