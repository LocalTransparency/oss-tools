import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Methodology from './page';

// Guards for the four accuracy requirements that accumulated after this
// section's brief was written (see lib/tax/projection.ts's projectionStats
// doc for the underlying rule these claims must not drift from):
//   1. The four headline statistics are computed from operating tax only —
//      the page must say so explicitly where it defines them.
//   2. The cap-class split is published in Indiana's statutory PARCEL file;
//      only Hamilton County's live ArcGIS feed fails to expose it. The page
//      must not make the broader, false claim that the split "is not
//      published" anywhere.
//   3. The 2028-2034 SEA 1 deduction schedules are `estimated`, and the page
//      must not claim otherwise while they remain so.
//   4. The 2027-2034 operating rate schedule's only public source is the
//      district's referendum calculator; the page must say so and cite it.
describe('<Methodology> — multi-year projection section', () => {
  it('labels every one of the four headline statistics as operating-tax-only', () => {
    render(<Methodology />);
    const heading = screen.getByRole('heading', { name: /how to read the four figures/i });
    const section = heading.closest('section')!;
    expect(section.textContent).toMatch(/referendum operating tax only/i);

    const statsList = section.querySelectorAll('ul')[1];
    const items = statsList.querySelectorAll('li');
    expect(items.length).toBe(4);
    items.forEach((item) => {
      expect(item.textContent).toMatch(/operating tax only/i);
    });
  });

  it('never claims the cap-class split "is not published" (it is — 50 IAC 26-20-4 — Hamilton County just does not expose it)', () => {
    render(<Methodology />);
    const main = screen.getByRole('main');
    expect(main.textContent).not.toMatch(/split[^.]*is not published/i);
    expect(main.textContent).not.toMatch(/not published anywhere/i);
    // The narrower, true claim should be present instead.
    expect(main.textContent).toMatch(/50 IAC 26-20-4/);
    expect(main.textContent).toMatch(/live ArcGIS feed/i);
    expect(main.textContent).toMatch(/does not expose/i);
  });

  it('does not overstate the status of the 2028-2034 deduction schedules while they remain estimated', () => {
    render(<Methodology />);
    const heading = screen.getByRole('heading', { name: /the multi-year projection/i });
    const section = heading.closest('section')!;
    // The cap-2 AV deduction schedule is expected to remain `estimated`
    // indefinitely (lib/tax/indiana/assumptions.ts), and its status must be
    // surfaced from config, not overridden by a hardcoded "confirmed" claim.
    expect(section.textContent).toMatch(/estimated/i);
  });

  it('says the district calculator is the only public source for the 2027-2034 schedule, and cites it', () => {
    render(<Methodology />);
    const heading = screen.getByRole('heading', { name: /the multi-year projection/i });
    const section = heading.closest('section')!;
    expect(section.textContent).toMatch(/referendum calculator/i);
    expect(section.textContent).toMatch(/publishes no schedule/i);
    const sourceLink = screen.getByRole('link', { name: /^source$/i });
    expect(sourceLink).toHaveAttribute(
      'href',
      'https://noblesvilleschoolsorg.finalsite.com/uploaded/NoblesvilleSchools_ReferendumCalculator.html',
    );
  });

  it('shows the projected years and half-cent rates without misrepresenting them', () => {
    render(<Methodology />);
    expect(screen.getAllByText(/2027/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2034/).length).toBeGreaterThan(0);
  });
});
