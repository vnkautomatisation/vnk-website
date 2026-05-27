// Construction du contexte de rendu pour un employe (et eventuellement un
// contrat associe). Toutes les valeurs sont aplaties + formattees en string,
// pretes a etre injectees dans le moteur de rendu (render-engine.ts).
//
// Le contexte respecte les cles definies dans variable-registry.ts.

import "server-only";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import type { TemplateContext } from "./render-engine";
import {
  formatCurrencyCad,
  formatDateFr,
  formatDateFrLong,
  formatDateIso,
  formatNasFull,
  formatNumber,
  formatPercent,
  formatPhone,
  maskNas,
  normalizeGender,
  defaultCivility,
  gTitle,
  gPronoun,
  gPronounObj,
  gPronounDet,
  gEmployed,
  gBorn,
  gAccordE,
  tenureMonths,
  tenureYears,
  tenureLabelFr,
  hourlyToAnnual,
  annualToHourly,
  computeProbationEnd,
} from "./quebec-helpers";

export interface BuildContextOptions {
  // Si fourni, ajoute les variables contract.* depuis ce contrat
  contractId?: number;
  // Override : NAS deja dechiffre par l'appelant (sinon on tente FamilyDependent du conjoint)
  overrideNas?: string;
}

// Constantes de fallback (utilisees si le setting n'est pas configure)
const DEFAULT_COMPANY_NAME = "VNK Automatisation";
const DEFAULT_COMPANY_FULL_NAME = "VNK Automatisation Inc.";

export async function buildContextFromEmployee(
  employeeId: number,
  opts: BuildContextOptions = {},
): Promise<TemplateContext> {
  const ctx: TemplateContext = {};

  // ─── Employe ─────────────────────────────────────────────
  const employee = await prisma.admin.findUnique({
    where: { id: employeeId },
    include: {
      manager: {
        select: { id: true, fullName: true, email: true },
      },
      position: {
        select: { id: true, name: true },
      },
      team: {
        select: { id: true, name: true },
      },
    },
  });

  if (employee) {
    const fullName = (employee.fullName ?? "").trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    const firstName = parts.length > 0 ? parts[0] : "";
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";

    ctx["employee.fullName"] = fullName;
    ctx["employee.firstName"] = firstName;
    ctx["employee.lastName"] = lastName;
    ctx["employee.email"] = employee.email ?? "";
    ctx["employee.phone"] = formatPhone(employee.phone);
    ctx["employee.address"] = ""; // Pas de champ address direct sur Admin
    ctx["employee.position"] = employee.position?.name ?? "";
    ctx["employee.department"] = employee.department ?? "";
    ctx["employee.team"] = employee.team?.name ?? "";
    ctx["employee.startDate"] = formatDateIso(employee.startDate);
    ctx["employee.startDateFr"] = formatDateFrLong(employee.startDate);
    ctx["employee.manager.fullName"] = employee.manager?.fullName ?? "";
    ctx["employee.manager.email"] = employee.manager?.email ?? "";

    // ── Naissance + ancienneté ──
    ctx["employee.birthdateFr"] = formatDateFrLong(employee.birthdate);
    const tMonths = tenureMonths(employee.startDate);
    ctx["employee.tenureMonths"] = String(tMonths);
    ctx["employee.tenureYears"] = String(tenureYears(employee.startDate));
    ctx["employee.tenureLabel"] = tenureLabelFr(employee.startDate);

    // ── Genre grammatical / accord épicène ──
    // Champs gender/civility/preferredPronouns ajoutés au modèle Admin (mai 2026).
    // Si null sur l'employé, on retombe sur "prefer_not_to_say" → forme épicène.
    const rawGender = (employee as { gender?: string | null }).gender ?? null;
    const rawCivility = (employee as { civility?: string | null }).civility ?? null;
    const gender = normalizeGender(rawGender);

    // Genre normalisé exposé au moteur de rendu (utilisé par {{#ifGender}})
    ctx["employee.gender"] = gender;
    ctx["employee.civility"] = rawCivility ?? defaultCivility(gender);
    ctx["employee.title"] = gTitle(gender);
    ctx["employee.pronoun"] = gPronoun(gender);
    ctx["employee.pronounObj"] = gPronounObj(gender);
    ctx["employee.pronounDet"] = gPronounDet(gender);
    ctx["employee.employed"] = gEmployed(gender, true);
    ctx["employee.employedLower"] = gEmployed(gender, false);
    ctx["employee.born"] = gBorn(gender, false);
    ctx["employee.accordE"] = gAccordE(gender);

    // Salaire / taux : provenance principale = dernier contrat actif ou contrat fourni
    // (la valeur du contrat sera ecrasee plus bas si opts.contractId est fourni)
    const latestContract = await prisma.employeeContract.findFirst({
      where: { adminId: employeeId, status: { in: ["active", "signed_employer"] } },
      orderBy: { startDate: "desc" },
      select: {
        salaryAnnual: true,
        hourlyRate: true,
        hoursPerWeek: true,
        vacationPct: true,
      },
    });

    const empSalary = latestContract?.salaryAnnual
      ? Number(latestContract.salaryAnnual)
      : null;
    const empRate = latestContract?.hourlyRate
      ? Number(latestContract.hourlyRate)
      : null;
    const empHours = latestContract?.hoursPerWeek ?? null;
    const empVac = latestContract?.vacationPct
      ? Number(latestContract.vacationPct)
      : null;

    ctx["employee.salary"] = empSalary !== null ? String(empSalary) : "";
    ctx["employee.salaryFormatted"] =
      empSalary !== null ? formatCurrencyCad(empSalary) : "";
    ctx["employee.hourlyRate"] = empRate !== null ? formatCurrencyCad(empRate) : "";
    ctx["employee.hoursPerWeek"] = empHours !== null ? formatNumber(empHours) : "";
    ctx["employee.vacationPct"] = empVac !== null ? formatPercent(empVac, 1) : "";

    // NAS : champ non present sur Admin ; on accepte un override par l'appelant
    // (UI peut le passer si chiffre/dechiffre cote secret). Sinon masque vide.
    ctx["employee.nas"] = opts.overrideNas ? maskNas(opts.overrideNas) : "";
    // NAS formaté non masqué (XXX XXX XXX) — usage RH interne uniquement.
    // À ne JAMAIS exposer dans un contrat partagé avec l'employé sans validation.
    ctx["employee.nasFormatted"] = opts.overrideNas ? formatNasFull(opts.overrideNas) : "";
  } else {
    // Employe introuvable : initialise les cles vides pour eviter placeholders restants
    for (const k of [
      "employee.fullName",
      "employee.firstName",
      "employee.lastName",
      "employee.email",
      "employee.phone",
      "employee.address",
      "employee.position",
      "employee.department",
      "employee.team",
      "employee.startDate",
      "employee.startDateFr",
      "employee.manager.fullName",
      "employee.manager.email",
      "employee.salary",
      "employee.salaryFormatted",
      "employee.hourlyRate",
      "employee.hoursPerWeek",
      "employee.vacationPct",
      "employee.nas",
      "employee.nasFormatted",
      "employee.birthdateFr",
      "employee.tenureMonths",
      "employee.tenureYears",
      "employee.tenureLabel",
    ]) {
      ctx[k] = "";
    }
    // Fallback épicène pour les variables grammaticales quand l'employé est introuvable
    const fallbackGender = normalizeGender(null);
    ctx["employee.gender"] = fallbackGender;
    ctx["employee.civility"] = defaultCivility(fallbackGender);
    ctx["employee.title"] = gTitle(fallbackGender);
    ctx["employee.pronoun"] = gPronoun(fallbackGender);
    ctx["employee.pronounObj"] = gPronounObj(fallbackGender);
    ctx["employee.pronounDet"] = gPronounDet(fallbackGender);
    ctx["employee.employed"] = gEmployed(fallbackGender, true);
    ctx["employee.employedLower"] = gEmployed(fallbackGender, false);
    ctx["employee.born"] = gBorn(fallbackGender, false);
    ctx["employee.accordE"] = gAccordE(fallbackGender);
  }

  // ─── Entreprise (via Setting) ─────────────────────────────
  const [
    companyName,
    companyAddress,
    companyCity,
    companyProvince,
    companyPostalCode,
    companyPhone,
    companyEmail,
    companyNeq,
  ] = await Promise.all([
    getSetting<string>("general", "company_name"),
    getSetting<string>("company", "address"),
    getSetting<string>("company", "city"),
    getSetting<string>("company", "province"),
    getSetting<string>("company", "postal_code"),
    getSetting<string>("company", "phone"),
    getSetting<string>("company", "email"),
    getSetting<string>("company", "neq"),
  ]);

  const fullAddress = [companyAddress, companyCity, companyProvince, companyPostalCode]
    .map((s) => (s ?? "").trim())
    .filter((s) => s.length > 0)
    .join(", ");

  // Nom court : derive du nom complet (sans "Inc."/"Ltd."/"Ltée"/etc.)
  const fullLegal = (companyName ?? DEFAULT_COMPANY_FULL_NAME).trim();
  const shortName = fullLegal
    .replace(/\b(inc\.?|ltée\.?|ltd\.?|ltee\.?|s\.e\.n\.c\.?|enr\.?)\b/gi, "")
    .trim()
    .replace(/\s+/g, " ") || DEFAULT_COMPANY_NAME;

  ctx["company.name"] = shortName;
  ctx["company.fullName"] = fullLegal;
  ctx["company.address"] = fullAddress;
  ctx["company.phone"] = formatPhone(companyPhone ?? "");
  ctx["company.email"] = companyEmail ?? "";
  ctx["company.neq"] = companyNeq ?? "";

  // ─── Date ────────────────────────────────────────────────
  const now = new Date();
  ctx["date.today"] = formatDateIso(now);
  ctx["date.todayFr"] = formatDateFr(now);

  // ─── Contrat ─────────────────────────────────────────────
  if (opts.contractId) {
    const contract = await prisma.employeeContract.findUnique({
      where: { id: opts.contractId },
    });
    if (contract && contract.adminId === employeeId) {
      const salary = contract.salaryAnnual ? Number(contract.salaryAnnual) : null;
      const rate = contract.hourlyRate ? Number(contract.hourlyRate) : null;
      const hours = contract.hoursPerWeek ?? null;
      const vac = contract.vacationPct ? Number(contract.vacationPct) : null;

      ctx["contract.title"] = contract.title ?? "";
      ctx["contract.contractType"] = contract.contractType ?? "";
      ctx["contract.startDate"] = formatDateIso(contract.startDate);
      ctx["contract.startDateFr"] = formatDateFrLong(contract.startDate);
      ctx["contract.endDate"] = formatDateIso(contract.endDate);
      ctx["contract.endDateFr"] = formatDateFrLong(contract.endDate);
      ctx["contract.probationEndDate"] = formatDateIso(contract.probationEndDate);
      ctx["contract.probationEndDateFr"] = formatDateFrLong(
        contract.probationEndDate,
      );
      ctx["contract.salaryAnnual"] = salary !== null ? String(salary) : "";
      ctx["contract.salaryFormatted"] =
        salary !== null ? formatCurrencyCad(salary) : "";
      ctx["contract.hourlyRate"] = rate !== null ? formatCurrencyCad(rate) : "";
      ctx["contract.hoursPerWeek"] = hours !== null ? formatNumber(hours) : "";
      ctx["contract.vacationPct"] = vac !== null ? formatPercent(vac, 1) : "";

      // ── Conversions auto taux ↔ salaire annuel ──
      const computedAnnualFromHourly = hourlyToAnnual(rate, hours);
      const computedHourlyFromAnnual = annualToHourly(salary, hours);
      ctx["contract.salaryAnnualFromHourly"] =
        computedAnnualFromHourly !== null
          ? formatCurrencyCad(computedAnnualFromHourly)
          : "";
      ctx["contract.hourlyFromAnnual"] =
        computedHourlyFromAnnual !== null
          ? formatCurrencyCad(computedHourlyFromAnnual)
          : "";

      // ── Fin de probation auto (start + 90 j) ──
      const autoProbation = computeProbationEnd(contract.startDate, 90);
      ctx["contract.probationEndAutoFr"] = autoProbation
        ? formatDateFrLong(autoProbation)
        : "";

      // Si on a un contrat explicite, ses valeurs ecrasent celles de l'employee.*
      // (on suppose que c'est ce contrat qui est en cours de signature)
      ctx["employee.salary"] = ctx["contract.salaryAnnual"];
      ctx["employee.salaryFormatted"] = ctx["contract.salaryFormatted"];
      ctx["employee.hourlyRate"] = ctx["contract.hourlyRate"];
      ctx["employee.hoursPerWeek"] = ctx["contract.hoursPerWeek"];
      ctx["employee.vacationPct"] = ctx["contract.vacationPct"];
    } else {
      // Contrat introuvable ou ne correspond pas a l'employe
      initEmptyContract(ctx);
    }
  } else {
    initEmptyContract(ctx);
  }

  // ─── Signatures (ancres litterales conservees pour le PDF) ──
  // Le moteur de rendu produit ces placeholders dans le markdown final ;
  // PDFKit les remplace ensuite par les blocs de signature dessines.
  ctx["signature.employee"] = "[Signature employé]";
  ctx["signature.employer"] = "[Signature employeur]";

  return ctx;
}

function initEmptyContract(ctx: TemplateContext): void {
  ctx["contract.title"] = "";
  ctx["contract.contractType"] = "";
  ctx["contract.startDate"] = "";
  ctx["contract.startDateFr"] = "";
  ctx["contract.endDate"] = "";
  ctx["contract.endDateFr"] = "";
  ctx["contract.probationEndDate"] = "";
  ctx["contract.probationEndDateFr"] = "";
  ctx["contract.probationEndAutoFr"] = "";
  ctx["contract.salaryAnnual"] = "";
  ctx["contract.salaryFormatted"] = "";
  ctx["contract.hourlyRate"] = "";
  ctx["contract.hoursPerWeek"] = "";
  ctx["contract.vacationPct"] = "";
  ctx["contract.salaryAnnualFromHourly"] = "";
  ctx["contract.hourlyFromAnnual"] = "";
}
