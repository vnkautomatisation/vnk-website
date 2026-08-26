// Statutory payroll parameters, by calendar year.
//
// These change every January (indexation, new maximums, rate cuts). They live
// here, in one dated table, so the yearly update is a single edit and never a
// hunt through the calculation code.
//
// Sources to check each January:
//   - Federal: CRA T4127 "Payroll Deductions Formulas"
//   - Quebec:  Revenu Quebec TP-1015.F "Formulas to Calculate Source Deductions"
//   - QPP / QPIP / EI maximums: Retraite Quebec, RQAP, Canada Employment Insurance
//
// A year with no table of its own falls back to the most recent one and is
// flagged `provisional`: the engine still runs, but the UI warns that the
// stubs must be checked against the official tables before the money goes out.

export type TaxBracket = { upTo: number | null; rate: number };

export type PayrollRates = {
  year: number;
  provisional: boolean;
  federal: {
    brackets: TaxBracket[];
    /** Rate at which non-refundable credits are converted. */
    creditRate: number;
    basicPersonalAmount: number;
    canadaEmploymentAmount: number;
    /** Quebec residents pay 16.5% less federal tax. */
    quebecAbatement: number;
  };
  quebec: {
    brackets: TaxBracket[];
    creditRate: number;
    basicPersonalAmount: number;
  };
  qpp: {
    /** Maximum pensionable earnings. */
    maxPensionable: number;
    basicExemption: number;
    /** Base + first additional contribution. */
    rate: number;
    /** Base portion alone: credited at tax time, while the rest is deducted. */
    baseRate: number;
    /** Second additional contribution, on earnings above maxPensionable. */
    maxPensionable2: number;
    rate2: number;
  };
  ei: { rate: number; maxInsurable: number };
  qpip: { rate: number; maxInsurable: number };
};

const RATES: PayrollRates[] = [
  {
    year: 2025,
    provisional: false,
    federal: {
      brackets: [
        { upTo: 57_375, rate: 0.145 },
        { upTo: 114_750, rate: 0.205 },
        { upTo: 177_882, rate: 0.26 },
        { upTo: 253_414, rate: 0.29 },
        { upTo: null, rate: 0.33 },
      ],
      creditRate: 0.145,
      basicPersonalAmount: 16_129,
      canadaEmploymentAmount: 1_471,
      quebecAbatement: 0.165,
    },
    quebec: {
      brackets: [
        { upTo: 53_255, rate: 0.14 },
        { upTo: 106_495, rate: 0.19 },
        { upTo: 129_590, rate: 0.24 },
        { upTo: null, rate: 0.2575 },
      ],
      creditRate: 0.14,
      basicPersonalAmount: 18_571,
    },
    qpp: {
      maxPensionable: 71_300,
      basicExemption: 3_500,
      rate: 0.064,
      baseRate: 0.054,
      maxPensionable2: 81_200,
      rate2: 0.04,
    },
    ei: { rate: 0.0131, maxInsurable: 65_700 },
    qpip: { rate: 0.00494, maxInsurable: 98_000 },
  },
  {
    // Published figures. Federal indexation 2.0%, Quebec 2.05%. The lowest
    // federal rate is 14% for a full year (it was cut mid-2025), and both the
    // QPP and QPIP rates went down.
    year: 2026,
    provisional: false,
    federal: {
      brackets: [
        { upTo: 58_523, rate: 0.14 },
        { upTo: 117_045, rate: 0.205 },
        { upTo: 181_440, rate: 0.26 },
        { upTo: 258_482, rate: 0.29 },
        { upTo: null, rate: 0.33 },
      ],
      creditRate: 0.14,
      basicPersonalAmount: 16_452,
      canadaEmploymentAmount: 1_501,
      quebecAbatement: 0.165,
    },
    quebec: {
      brackets: [
        { upTo: 54_345, rate: 0.14 },
        { upTo: 108_680, rate: 0.19 },
        { upTo: 132_245, rate: 0.24 },
        { upTo: null, rate: 0.2575 },
      ],
      creditRate: 0.14,
      basicPersonalAmount: 18_952,
    },
    qpp: {
      // 6.3% = 5.3% base + 1.0% additional. Max employee contribution
      // (74 600 - 3 500) x 6.3% = 4 479.30 $.
      maxPensionable: 74_600,
      basicExemption: 3_500,
      rate: 0.063,
      baseRate: 0.053,
      maxPensionable2: 85_000,
      rate2: 0.04,
    },
    ei: { rate: 0.0130, maxInsurable: 68_900 },
    qpip: { rate: 0.0043, maxInsurable: 103_000 },
  },
];

/** Rates for a year, falling back to the most recent table defined. */
export function getPayrollRates(year: number): PayrollRates {
  const exact = RATES.find((r) => r.year === year);
  if (exact) return exact;
  const latest = RATES.reduce((a, b) => (b.year > a.year ? b : a));
  return { ...latest, year, provisional: true };
}

export function payrollRateYears(): number[] {
  return RATES.map((r) => r.year);
}
