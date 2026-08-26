// Source deductions for a Quebec pay period.
//
// Replaces the flat 10% / 5% placeholders: this follows the shape of the
// official formulas (CRA T4127 option 1, Revenu Quebec TP-1015.F) — annualize
// the period's pay, run it through the brackets, subtract the credits, divide
// back by the number of periods.
//
// Statutory contributions are computed from year-to-date EARNINGS rather than
// year-to-date contributions, so the exemption, the two QPP bands and every
// annual maximum land exactly right, including on the period that crosses a cap.
//
// Simplifications, all conservative and all on the tax side:
//   - only the basic personal amounts are credited (no TD1 extra claims)
//   - no RRSP, union dues, alimony or other authorized deductions
//   - no commissions, no bonuses spread over the year
// An employee with extra TD1 claims will have slightly too much tax withheld
// and is made whole at the annual return.

import { getPayrollRates, type PayrollRates, type TaxBracket } from "@/lib/services/payroll-rates";

export type DeductionInput = {
  /** Gross pay for this period. */
  gross: number;
  /** Gross already paid to this employee earlier in the same calendar year. */
  ytdGross: number;
  /** Pay periods in the year: 52, 26, 24 or 12. */
  periodsPerYear: number;
  year: number;
};

export type Deductions = {
  federal: number;
  provincial: number;
  qpp: number;
  ei: number;
  qpip: number;
  total: number;
  /** True when the year's parameters are estimates, not official figures. */
  provisionalRates: boolean;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Tax on an annual income, walked bracket by bracket. */
function taxOnBrackets(income: number, brackets: TaxBracket[]): number {
  let tax = 0;
  let floor = 0;
  for (const b of brackets) {
    const ceiling = b.upTo ?? Infinity;
    if (income <= floor) break;
    tax += (Math.min(income, ceiling) - floor) * b.rate;
    floor = ceiling;
  }
  return Math.max(0, tax);
}

/**
 * Contribution owed on the slice of earnings falling in this period.
 * `annual` maps total year earnings to the total contribution owed on them, so
 * the period's share is simply the difference.
 */
function periodShare(ytd: number, gross: number, annual: (earnings: number) => number): number {
  return Math.max(0, annual(ytd + gross) - annual(ytd));
}

/**
 * QPP for one period. The $3,500 exemption is annual but consumed period by
 * period, exactly as the official formula prorates it; the pensionable slice
 * is what is left under the year's maximum.
 */
function qppForPeriod(gross: number, ytd: number, P: number, r: PayrollRates["qpp"]): {
  total: number; base: number; enhanced: number;
} {
  const pensionable = Math.max(0, Math.min(gross, r.maxPensionable - ytd));
  const contributory = Math.max(0, pensionable - r.basicExemption / P);
  const base = contributory * r.baseRate;
  // Second additional contribution, on the band above the maximum.
  const second = Math.max(0, Math.min(ytd + gross, r.maxPensionable2) - Math.max(ytd, r.maxPensionable)) * r.rate2;
  const enhanced = contributory * (r.rate - r.baseRate) + second;
  return { total: base + enhanced, base, enhanced };
}

export function calculateDeductions(input: DeductionInput): Deductions {
  const rates = getPayrollRates(input.year);
  const { gross, ytdGross, periodsPerYear: P } = input;

  if (gross <= 0) {
    return { federal: 0, provincial: 0, qpp: 0, ei: 0, qpip: 0, total: 0, provisionalRates: rates.provisional };
  }

  const qppParts = qppForPeriod(gross, ytdGross, P, rates.qpp);
  const qpp = qppParts.total;
  const ei = periodShare(ytdGross, gross, (e) => Math.min(e, rates.ei.maxInsurable) * rates.ei.rate);
  const qpip = periodShare(ytdGross, gross, (e) => Math.min(e, rates.qpip.maxInsurable) * rates.qpip.rate);

  // Annualized income drives the brackets. The enhanced QPP contribution is a
  // deduction from income; the base one, like EI and QPIP, is a credit.
  const annualIncome = Math.max(0, gross * P - qppParts.enhanced * P);
  const annualContributions = (qppParts.base + ei + qpip) * P;

  const fed = rates.federal;
  const federalCredits = fed.creditRate * (
    fed.basicPersonalAmount
    + Math.min(fed.canadaEmploymentAmount, annualIncome)
    + annualContributions
  );
  const federalAnnual = Math.max(0, taxOnBrackets(annualIncome, fed.brackets) - federalCredits)
    * (1 - fed.quebecAbatement);

  const qc = rates.quebec;
  const quebecCredits = qc.creditRate * (qc.basicPersonalAmount + annualContributions);
  const quebecAnnual = Math.max(0, taxOnBrackets(annualIncome, qc.brackets) - quebecCredits);

  const federal = round2(federalAnnual / P);
  const provincial = round2(quebecAnnual / P);
  const out = {
    federal,
    provincial,
    qpp: round2(qpp),
    ei: round2(ei),
    qpip: round2(qpip),
    provisionalRates: rates.provisional,
  };
  return { ...out, total: round2(federal + provincial + out.qpp + out.ei + out.qpip) };
}

/** Pay periods in a year, from one period's length. */
export function periodsPerYear(startDate: Date, endDate: Date): number {
  const days = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  if (days <= 8) return 52;
  if (days <= 15) return 26;
  if (days <= 16) return 24;
  return 12;
}
