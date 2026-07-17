import type { DistrictReferendumConfig } from '../../types';

const SOURCES = {
  budgetOrder2026:
    'https://www.in.gov/dlgf/files/2026-reports/2026-budget-orders/Hamilton-260115-2026-Budget-Order.pdf',
  countyRateSheet2026:
    'https://www.hamiltoncounty.in.gov/DocumentCenter/View/31240/2026-District-Rates-PDF',
  dlgfDetermination:
    'https://www.in.gov/dlgf/files/referendum-documentation2/2026-november-referendum-documents/26-030-Carmel-Clay-Schools-Operating-Determination.pdf',
  districtReferendumPage: 'https://www.ccs.k12.in.us/services/business/schoolfinance/referendums',
} as const;

export const CARMEL_CLAY: DistrictReferendumConfig = {
  id: 'carmel-clay',
  name: 'Carmel Clay Schools',
  county: 'Hamilton',
  sources: SOURCES,
  referendum: {
    // The 2026 question repeals and replaces BOTH existing referendums — the 2023
    // operating ($0.19) and the school-safety ($0.05) — with one combined operating
    // referendum. So the full $0.24 is what "fails" if the question is rejected;
    // there is no continuing debt component.
    currentOperating: {
      value: 0.24, source: SOURCES.dlgfDetermination, status: 'confirmed',
      note: 'Combined existing operating ($0.19) + school safety ($0.05) referendums; the 2026 question repeals and replaces both. Component rates from the county rate sheet.',
    },
    proposedMax: {
      value: 0.4274, source: SOURCES.dlgfDetermination, status: 'confirmed',
      note: 'Ballot-authorized maximum rate; max annual levy $61,981,519; up to 8 years (pay-2027 through 2034).',
    },
    explainer:
      'Unlike most districts, Carmel Clay’s 2026 question repeals and replaces BOTH of its current referendums — the operating rate ($0.19) and the school-safety rate ($0.05) — with a single new operating referendum. So if it fails, both of those current rates end; if it passes, they are replaced by one rate of up to $0.4274.',
  },
  gisGate: /carmel/i,
  taxDistricts: [
    { name: 'Carmel', match: /^carmel$/i, totalRate2026: 2.0167 },
    { name: 'Carmel–Washington Township', match: /^carmel\s+washington$/i, totalRate2026: 2.4068 },
    { name: 'Carmel–County TIF', match: /^carmel\s+county\s+tif$/i, totalRate2026: 2.0167 },
  ],
};
