import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectionChart } from './ProjectionChart';
import { projectReferendumLine } from '../lib/tax/projection';
import { NOBLESVILLE } from '../lib/tax/indiana/districts/noblesville';

const rows = projectReferendumLine({ cap1: 350000, cap2: 0, cap3: 0 }, NOBLESVILLE);

describe('ProjectionChart', () => {
  it('is hidden from assistive tech, since the table carries the same data', () => {
    const { container } = render(<ProjectionChart rows={rows} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('plots one point per year', () => {
    const { container } = render(<ProjectionChart rows={rows} />);
    expect(container.querySelectorAll('circle')).toHaveLength(rows.length);
  });

  it('uses design tokens rather than hardcoded colors', () => {
    const { container } = render(<ProjectionChart rows={rows} />);
    expect(container.innerHTML).toMatch(/var\(--/);
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it('renders nothing when there are no rows', () => {
    const { container } = render(<ProjectionChart rows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

// Task 13 already caught this project shipping a component whose header
// strings said "operating tax only" while the code plotted the combined
// (operating + debt) figure -- nine tests stayed green because none of them
// checked the actual series. `monthly` (operatingTax + debtTax, /12) and
// `operatingTax / 12` are numerically different for every year through
// debtEndYear (2032), so this test recomputes the chart's own x/y scale from
// the operating-only series and asserts every rendered circle's `cy` matches
// it exactly. Swapping the plotted field back to `monthly` moves those
// circles to different, non-matching y positions and this test fails loudly.
describe('plots the operating-only series, not the combined monthly total (must not silently regress)', () => {
  const W = 640;
  const H = 220;
  const PAD_X = 44;
  const PAD_Y = 20;

  function expectedCy(operatingMonthlyValues: number[], v: number) {
    const min = Math.min(...operatingMonthlyValues, 0);
    const max = Math.max(...operatingMonthlyValues);
    const span = max - min || 1;
    return (H - PAD_Y - ((v - min) / span) * (H - PAD_Y * 2)).toFixed(1);
  }

  function expectedCx(i: number, count: number) {
    return (PAD_X + (i * (W - PAD_X - PAD_Y)) / Math.max(1, count - 1)).toFixed(1);
  }

  it("every circle's position matches operatingTax / 12, not monthly", () => {
    // Guard the fixture itself: if debtTax were ever 0 for every row, monthly
    // and operatingTax / 12 would coincide and this test could pass even with
    // the wrong field plotted. NOBLESVILLE's debt runs through 2032, so this
    // must hold for the row set under test.
    const divergentYear = rows.find((r) => r.debtTax > 0);
    expect(divergentYear).toBeDefined();
    expect(divergentYear!.monthly).not.toBeCloseTo(divergentYear!.operatingTax / 12, 1);

    const { container } = render(<ProjectionChart rows={rows} />);
    const circles = Array.from(container.querySelectorAll('circle'));
    expect(circles).toHaveLength(rows.length);

    const operatingMonthly = rows.map((r) => r.operatingTax / 12);
    rows.forEach((r, i) => {
      expect(circles[i]).toHaveAttribute('cx', expectedCx(i, rows.length));
      expect(circles[i]).toHaveAttribute('cy', expectedCy(operatingMonthly, r.operatingTax / 12));
    });
  });
});
