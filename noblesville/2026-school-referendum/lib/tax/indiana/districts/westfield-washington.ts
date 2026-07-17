import type { DistrictReferendumConfig } from '../../types';

const SOURCES = {
  budgetOrder2026:
    'https://www.in.gov/dlgf/files/2026-reports/2026-budget-orders/Hamilton-260115-2026-Budget-Order.pdf',
  countyRateSheet2026:
    'https://www.hamiltoncounty.in.gov/DocumentCenter/View/31240/2026-District-Rates-PDF',
  dlgfDetermination:
    'https://www.in.gov/dlgf/files/referendum-documentation2/2026-november-referendum-documents/26-007-Westfield-Washington-Schools-Operating-Determination.pdf',
  districtReferendumPage: 'https://www.wws.k12.in.us/departments/business/your-dollars-at-work',
} as const;

export const WESTFIELD_WASHINGTON: DistrictReferendumConfig = {
  id: 'westfield-washington',
  name: 'Westfield Washington Schools',
  county: 'Hamilton',
  sources: SOURCES,
  referendum: {
    currentOperating: {
      value: 0.17, source: SOURCES.countyRateSheet2026, status: 'confirmed',
      note: '2022 operating referendum; replaced by the 2026 ballot question.',
    },
    debt: {
      value: 0.079, source: SOURCES.countyRateSheet2026, status: 'confirmed',
      note: 'Referendum debt; continues regardless of the 2026 operating vote.',
    },
    proposedMax: {
      value: 0.3941, source: SOURCES.dlgfDetermination, status: 'confirmed',
      note: 'Ballot-authorized maximum rate; max annual levy $38,000,000; up to 8 years (pay-2027 through 2034).',
    },
    explainer:
      'Westfield Washington’s 2026 question replaces its 2022 operating referendum ($0.17) with a new operating rate of up to $0.3941. A separate referendum debt rate ($0.079) stays on your bill either way — it is not part of this vote.',
  },
  gisGate: /westfield/i,
  taxDistricts: [
    { name: 'Westfield', match: /^westfield$/i, totalRate2026: 2.3448 },
    { name: 'Westfield–Washington Township', match: /^westfield\s+washington/i, totalRate2026: 1.9372 },
    { name: 'Westfield–Ag Abated', match: /^westfield\s+ag/i, totalRate2026: 1.6285 },
  ],
};
