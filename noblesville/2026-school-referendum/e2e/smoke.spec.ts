import { test, expect } from '@playwright/test';

const candidate = {
  parcelNo: '160', stateParcelNo: '29', address: '1234 CONNER ST', city: 'Noblesville',
  zip: '46060', grossAV: 350000, assessmentYear: 2026, homestead: true,
  taxDistrictName: 'Noblesville City', propertyReportUrl: '',
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
    page.getByText(/not affiliated with Noblesville Schools or any campaign/i),
  ).toBeVisible();
});
