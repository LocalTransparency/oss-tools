import { test, expect } from '@playwright/test';

// A realistic /api/lookup response (see app/api/lookup/route.ts and
// EnrichedParcelCandidate in lib/lookup/arcgis.ts): raw county attributes
// plus the capClass/capClassConfidence/capClassReason/deededAcres fields the
// route computes and adds at response time.
const candidate = {
  parcelNo: '160', stateParcelNo: '29', address: '1234 CONNER ST', city: 'Noblesville',
  zip: '46060', grossAV: 350000, assessmentYear: 2026, homestead: true,
  taxDistrictName: 'Noblesville City', propertyReportUrl: '',
  homesteadCode: 1, propertyClass: '510', avLand: 0, avImprove: 0, deededAcres: 0.25,
  capClass: 1 as const,
  capClassConfidence: 'high' as const,
  capClassReason: 'An active homestead deduction places this parcel in the state’s "Homestead (Owner-occupied residence)" class (1% cap).',
};

test('address → results → math section', async ({ page }) => {
  await page.route('**/api/lookup**', (route) =>
    route.fulfill({ json: { candidates: [candidate] } }),
  );
  await page.goto('/tools/2026-school-referendum');
  await page.getByLabel(/address/i).fill('1234 conner st');
  await page.getByRole('button', { name: /look up/i }).click();
  await page.getByRole('button', { name: /1234 CONNER ST/i }).click();
  await expect(page.getByText('$4,015', { exact: true })).toBeVisible();
  await expect(page.getByText('$3,334', { exact: true })).toBeVisible();
  await page.getByText(/how this was calculated/i).click();
  await expect(page.getByText('$181,200').first()).toBeVisible();
  await expect(
    page.getByText(/not affiliated with any school district or campaign/i),
  ).toBeVisible();
});

// Regression for the bug where a candidate missing capClass (an absent or
// malformed field from /api/lookup) produced all-zero AV buckets and every
// scenario silently rendered $0. bucketsOf must fall back to cap class 1
// (homestead) instead of zeroing the parcel out — see lib/tax/engine.ts.
//
// The bill isn't the whole story: CapClassPanel is what's supposed to make
// that fallback assumption visible and correctable (see engine.ts's comment
// on bucketsOf). If the panel is fed the same missing fields raw, it renders
// a broken sentence naming no class at all — correct math, but a disclosure
// the visitor can't act on. So this also asserts the panel actually names a
// class and states the assumption in words, not just that the bill is right.
test('address → results renders the real bill, and names the assumed cap class, when capClass is missing from the API response', async ({ page }) => {
  const candidateWithoutCapClass: Record<string, unknown> = { ...candidate };
  delete candidateWithoutCapClass.capClass;
  delete candidateWithoutCapClass.capClassConfidence;
  delete candidateWithoutCapClass.capClassReason;
  await page.route('**/api/lookup**', (route) =>
    route.fulfill({ json: { candidates: [candidateWithoutCapClass] } }),
  );
  await page.goto('/tools/2026-school-referendum');
  await page.getByLabel(/address/i).fill('1234 conner st');
  await page.getByRole('button', { name: /look up/i }).click();
  await page.getByRole('button', { name: /1234 CONNER ST/i }).click();
  await expect(page.getByText('$4,015', { exact: true })).toBeVisible();
  await expect(page.getByText('$0', { exact: true })).not.toBeVisible();
  await expect(page.getByText(/1% cap — Homestead/i)).toBeVisible();
  await expect(
    page.getByText(/didn.t return a cap class for this parcel, so it is treated as a homestead/i),
  ).toBeVisible();
});

// Twin of the capClass gap above, in the grossAV field instead: a candidate
// whose gross assessed value is missing or non-numeric must not silently
// render a $0 bill either. Surfaced the same way — an explicit message and
// the manual-entry path, never a number built from data that isn't there.
test('shows an explicit error, not a $0 bill, when grossAV is missing from the API response', async ({ page }) => {
  const candidateWithoutGrossAV: Record<string, unknown> = { ...candidate };
  delete candidateWithoutGrossAV.grossAV;
  await page.route('**/api/lookup**', (route) =>
    route.fulfill({ json: { candidates: [candidateWithoutGrossAV] } }),
  );
  await page.goto('/tools/2026-school-referendum');
  await page.getByLabel(/address/i).fill('1234 conner st');
  await page.getByRole('button', { name: /look up/i }).click();
  await page.getByRole('button', { name: /1234 CONNER ST/i }).click();
  await expect(page.getByText(/couldn.t read this parcel.s assessed value/i)).toBeVisible();
  await expect(page.getByText('$0', { exact: true })).not.toBeVisible();
  await expect(page.getByLabel(/gross assessed value/i)).toBeVisible();
});
