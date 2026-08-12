import type { DistrictReferendumConfig } from '../../types';

const SOURCES = {
  budgetOrder2026:
    'https://www.in.gov/dlgf/files/2026-reports/2026-budget-orders/Hamilton-260115-2026-Budget-Order.pdf',
  countyRateSheet2026:
    'https://www.hamiltoncounty.in.gov/DocumentCenter/View/31240/2026-District-Rates-PDF',
  dlgfDetermination:
    'https://www.in.gov/dlgf/files/referendum-documentation2/2026-november-referendum-documents/26-015-Noblesville-Schools-Operating-Determination.pdf',
  districtReferendumPage: 'https://www.noblesvilleschools.org/referendum',
  districtAnnouncement2026_08_12:
    'https://www.noblesvilleschools.org/referendum',
  districtCalculator:
    'https://noblesvilleschoolsorg.finalsite.com/uploaded/NoblesvilleSchools_ReferendumCalculator.html',
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
      value: 0.385, source: SOURCES.districtAnnouncement2026_08_12, status: 'public-commitment',
      note: 'District public commitment for 2027 only, announced 2026-08-12 (revised down from $0.41); not legally binding; later years are projected higher, up to $0.57 authorized.',
    },
    debtEndYear: {
      value: 2032, source: SOURCES.districtReferendumPage, status: 'confirmed',
      note: 'Final levy year for the 2010 referendum debt.',
    },
    projection: {
      operatingRates: {
        value: {
          2026: 0.37, 2027: 0.385, 2028: 0.425, 2029: 0.465,
          2030: 0.505, 2031: 0.545, 2032: 0.545, 2033: 0.545, 2034: 0.545,
        },
        source: SOURCES.districtCalculator,
        status: 'public-commitment',
        note: 'Per-year operating rates hardcoded in the district\'s published calculator (retrieved 2026-08-12). Rises 4.0 cents per year through 2031, then holds; never reaches the authorized $0.57. Not legally binding — the board votes a rate annually.',
      },
      avGrowth: {
        value: {
          2027: 0.053, 2028: 0.035, 2029: 0.035, 2030: 0.035,
          2031: 0.035, 2032: 0.035, 2033: 0.035, 2034: 0.035,
        },
        source: SOURCES.districtCalculator,
        status: 'public-commitment',
        note: 'District assumption (retrieved 2026-08-12): 5.3% for 2027, stated as the median annual growth of local existing residential parcels between the Hamilton County 2026 and 2027 certified net AV data sets; 3.5% each year thereafter.',
      },
    },
    explainer:
      'Noblesville Schools’ 2026 question replaces its current operating referendum ($0.37) with a new operating rate of up to $0.57 (the district publicly committed to $0.385 for 2027 on 2026-08-12). A separate referendum debt rate ($0.08, levied through 2032) stays on your bill either way — it is not part of this vote.',
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
