import type { DistrictReferendumConfig } from '../../types';

const SOURCES = {
  budgetOrder2026:
    'https://www.in.gov/dlgf/files/2026-reports/2026-budget-orders/Hamilton-260115-2026-Budget-Order.pdf',
  countyRateSheet2026:
    'https://www.hamiltoncounty.in.gov/DocumentCenter/View/31240/2026-District-Rates-PDF',
  dlgfDetermination:
    'https://www.in.gov/dlgf/files/referendum-documentation2/2026-november-referendum-documents/26-032-A-Hamilton-Southeastern-Schools-Operating-Determination.pdf',
  districtReferendumPage: 'https://www.hseschools.org/community/referendum-2026',
} as const;

export const HAMILTON_SOUTHEASTERN: DistrictReferendumConfig = {
  id: 'hamilton-southeastern',
  name: 'Hamilton Southeastern Schools',
  county: 'Hamilton',
  sources: SOURCES,
  referendum: {
    currentOperating: {
      value: 0.1995, source: SOURCES.countyRateSheet2026, status: 'confirmed',
      note: '2023 operating referendum; repealed and replaced by the 2026 ballot question.',
    },
    debt: {
      value: 0.089, source: SOURCES.countyRateSheet2026, status: 'confirmed',
      note: 'Referendum debt; continues regardless of the 2026 operating vote.',
    },
    proposedMax: {
      value: 0.36, source: SOURCES.dlgfDetermination, status: 'confirmed',
      note: 'Ballot-authorized maximum rate; max annual levy $47,500,000; up to 8 years (pay-2027 through 2034).',
    },
    explainer:
      'Hamilton Southeastern’s 2026 question repeals and replaces its 2023 operating referendum ($0.1995) with a new operating rate of up to $0.36. A separate referendum debt rate ($0.089) stays on your bill either way — it is not part of this vote.',
  },
  // Fishers-area taxing districts (HSE side of the Fall Creek / Delaware township
  // splits — the Noblesville-schools portions are "Noblesville FC" / "Noblesville SE").
  gisGate: /fishers|^delaware$|^fall\s*creek$/i,
  taxDistricts: [
    { name: 'Fishers', match: /^fishers$/i, totalRate2026: 2.1994 },
    { name: 'Fishers–Fall Creek', match: /^fishers\s*fc$/i, totalRate2026: 2.1684 },
    { name: 'Delaware Township', match: /^delaware$/i, totalRate2026: 1.7871 },
    { name: 'Fall Creek Township', match: /^fall\s*creek$/i, totalRate2026: 1.7245 },
  ],
};
