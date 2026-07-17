import type { DistrictReferendumConfig } from '../../types';

const SOURCES = {
  budgetOrder2026:
    'https://www.in.gov/dlgf/files/2026-reports/2026-budget-orders/Hamilton-260115-2026-Budget-Order.pdf',
  countyRateSheet2026:
    'https://www.hamiltoncounty.in.gov/DocumentCenter/View/31240/2026-District-Rates-PDF',
  dlgfDetermination:
    'https://www.in.gov/dlgf/files/referendum-documentation2/2026-november-referendum-documents/26-015-Noblesville-Schools-Operating-Determination.pdf',
  districtReferendumPage: 'https://www.noblesvilleschools.org/referendum',
} as const;

export const NOBLESVILLE: DistrictReferendumConfig = {
  id: 'noblesville',
  name: 'Noblesville Schools',
  county: 'Hamilton',
  sources: SOURCES,
  referendum: {
    currentOperating: {
      value: 0.37, source: SOURCES.countyRateSheet2026, status: 'confirmed',
      note: '2018 operating referendum; last levy pay-2026.',
    },
    debt: {
      value: 0.08, source: SOURCES.countyRateSheet2026, status: 'confirmed',
      note: '2010 referendum debt; continues through 2032 regardless of the 2026 vote.',
    },
    proposedMax: {
      value: 0.57, source: SOURCES.dlgfDetermination, status: 'confirmed',
      note: 'Ballot-authorized maximum rate; max annual levy $43,842,578; up to 8 years.',
    },
    committed2027: {
      value: 0.41, source: SOURCES.districtReferendumPage, status: 'public-commitment',
      note: 'District public commitment for 2027 only; not legally binding; later years may be higher, up to $0.57.',
    },
    debtEndYear: {
      value: 2032, source: SOURCES.districtReferendumPage, status: 'confirmed',
      note: 'Final levy year for the 2010 referendum debt.',
    },
  },
  // Gate admits every Noblesville-Schools taxing district. Note "Nob Wayne" is
  // abbreviated in the GIS layer and does NOT contain "noblesville".
  gisGate: /noblesville|nob\s+wayne/i,
  /**
   * Certified pay-2026 total district rates (county rate sheet). `match` is tested
   * against the live ArcGIS TAXDISTNAM value (verified against the parcel service),
   * NOT the DLGF rate-sheet label — the two differ (e.g. GIS "Noblesville SE" is the
   * Delaware Township portion; GIS "Noblesville FC" is Fall Creek; GIS "Nob Wayne").
   */
  taxDistricts: [
    { name: 'Noblesville–Fall Creek', match: /noblesville\s+fc/i, totalRate2026: 2.4503 },
    { name: 'Noblesville–Delaware', match: /noblesville\s+se/i, totalRate2026: 2.4813 },
    { name: 'Noblesville–Wayne', match: /nob\s+wayne/i, totalRate2026: 2.4737 },
    { name: 'Noblesville City', match: /noblesville\s+city/i, totalRate2026: 2.5549 },
    { name: 'Noblesville Township', match: /noblesville\s+twp/i, totalRate2026: 1.8444 },
  ],
};
