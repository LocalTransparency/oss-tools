import type { DistrictReferendumConfig } from '../../types';

const SOURCES = {
  budgetOrder2026:
    'https://www.in.gov/dlgf/files/2026-reports/2026-budget-orders/Hamilton-260115-2026-Budget-Order.pdf',
  countyRateSheet2026:
    'https://www.hamiltoncounty.in.gov/DocumentCenter/View/31240/2026-District-Rates-PDF',
  dlgfDetermination:
    'https://www.in.gov/dlgf/files/referendum-documentation2/2026-november-referendum-documents/26-003-Sheridan-Community-School-Corporation-Operating-Determination.pdf',
} as const;

export const SHERIDAN: DistrictReferendumConfig = {
  id: 'sheridan',
  name: 'Sheridan Community Schools',
  county: 'Hamilton',
  sources: SOURCES,
  referendum: {
    currentOperating: {
      value: 0.25, source: SOURCES.countyRateSheet2026, status: 'confirmed',
      note: '2023 operating referendum ($0.25, through 2031); replaced by the 2026 ballot question.',
    },
    proposedMax: {
      value: 0.4, source: SOURCES.dlgfDetermination, status: 'confirmed',
      note: 'Ballot-authorized maximum rate; max annual levy $2,900,000; up to 8 years (pay-2027 through 2034).',
    },
    explainer:
      'Sheridan Community Schools’ 2026 question replaces its 2023 operating referendum ($0.25) with a new operating rate of up to $0.40. Sheridan has no separate referendum debt, so the whole current referendum is what’s up for renewal.',
  },
  gisGate: /sheridan/i,
  taxDistricts: [
    { name: 'Sheridan', match: /^sheridan$/i, totalRate2026: 2.7455 },
    { name: 'Sheridan–Rural', match: /^sheridan\s+rural$/i, totalRate2026: 1.9409 },
    { name: 'Sheridan–Ag Abated', match: /^sheridan\s+ag/i, totalRate2026: 1.9409 },
  ],
};
