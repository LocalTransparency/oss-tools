import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Projection } from './Projection';
import { NOBLESVILLE } from '../lib/tax/indiana/districts/noblesville';

const buckets = { cap1: 350000, cap2: 0, cap3: 0 };

describe('Projection', () => {
  it('renders a row for every projected year', () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    const table = screen.getByRole('table');
    for (const y of [2026, 2027, 2028, 2031, 2034]) {
      expect(within(table).getByText(String(y))).toBeInTheDocument();
    }
  });

  it('shows the half-cent rate without rounding', () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    expect(screen.getByText('0.385')).toBeInTheDocument();
    expect(screen.queryByText('0.39')).not.toBeInTheDocument();
  });

  it('labels all four statistics distinctly', () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    const stats = screen.getByRole('list', { name: /how to read these figures/i });
    expect(within(stats).getByText(/average year-over-year step/i)).toBeInTheDocument();
    expect(within(stats).getByText(/average increase over 2026/i)).toBeInTheDocument();
    expect(within(stats).getByText(/2034/)).toBeInTheDocument();
  });

  it('attributes the growth assumption to the district and lets it be changed', async () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    expect(screen.getByText(/district's assumption/i)).toBeInTheDocument();
    const input = screen.getByLabelText(/growth after 2027/i);
    await userEvent.clear(input);
    await userEvent.type(input, '0');
    expect(screen.getByRole('button', { name: /reset to the district/i })).toBeInTheDocument();
  });

  it('renders nothing for a district without a published schedule', () => {
    const noSchedule = { ...NOBLESVILLE, referendum: { ...NOBLESVILLE.referendum, projection: undefined } };
    const { container } = render(<Projection buckets={buckets} config={noSchedule} />);
    expect(container).toBeEmptyDOMElement();
  });

  // Regression guard: the scenario cards above this table price the entered AV
  // as-is, while this table grows it by the district's assumption, so the same
  // year (2027) shows two different, both-correct referendum-operating figures
  // ($644.49/yr in the scenario cards vs. $683.06/yr here for a $350k homestead)
  // with nothing else on screen reconciling them. The caption must say so.
  it('reconciles the caption’s "for the entered assessed value" claim with the table’s grown figures', () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    expect(
      screen.getByText(/scenario figures above price the assessed value as entered/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/2027 figures differ between the two/i)).toBeInTheDocument();
  });
});

// Regression guard for Task 13's hard requirement: the four headline statistics
// are computed from operating tax only (referendum debt is levied through
// debtEndYear regardless of how the vote goes, so projectionStats excludes it —
// see lib/tax/projection.ts). This project has twice shipped a slope presented
// as a level and a methodology equation that didn't match the number beside it;
// these tests exist so a future edit can't silently drop the labelling that
// keeps this table honest about which series its statistics come from.
describe('operating-only labelling (must not silently regress)', () => {
  it('renders a distinct operating-only column in the table, separate from the combined total', () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    const table = screen.getByRole('table');
    expect(within(table).getByText(/referendum operating tax\/mo/i)).toBeInTheDocument();
    expect(within(table).getByText(/debt tax\/mo/i)).toBeInTheDocument();
    expect(within(table).getByText(/total referendum\/mo/i)).toBeInTheDocument();
  });

  it('labels every one of the four statistics as referendum operating tax only', () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    const stats = screen.getByRole('list', { name: /how to read these figures/i });
    const items = within(stats).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    for (const item of items) {
      expect(within(item).getByText(/operating tax only/i)).toBeInTheDocument();
    }
  });

  it('states plainly, near the debt figures, that debt is excluded from the four statistics because it is levied regardless of the vote', () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    expect(screen.getAllByText(/excluded from (those|these four) statistics/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/regardless of whether this referendum passes/i).length).toBeGreaterThan(0);
  });

  it('shows the debt rate through debtEndYear (2032) and stops it after', () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    const table = screen.getByRole('table');
    const row2032 = within(table).getByText('2032').closest('tr')!;
    const row2033 = within(table).getByText('2033').closest('tr')!;
    expect(within(row2032).getByText('0.08')).toBeInTheDocument();
    expect(within(row2033).queryByText('0.08')).not.toBeInTheDocument();
  });
});

// A label test alone can't catch a numbers bug: someone could swap the
// operating-only column's source data for the combined (operating + debt)
// figure while leaving every "(operating tax only)" label untouched, and the
// tests above would stay green. These pin the actual rendered arithmetic for
// a $350,000 cap-1 homestead, computed once via lib/tax/projectReferendumLine
// directly (not re-derived here), so a swap like that fails loudly.
describe('operating-vs-combined arithmetic reconciles (must not silently regress)', () => {
  // Cell order in each <tbody> row, matching the JSX in Projection.tsx:
  // [grossAV, netAV, operatingRate, operatingTax/mo, debtRate, debtTax/mo, total/mo, vsBase/mo]
  const OPERATING_TAX_MO = 3;
  const TOTAL_MO = 6;
  const VS_BASE_MO = 7;

  function dataCells(table: HTMLElement, year: number) {
    const row = within(table).getByText(String(year)).closest('tr')!;
    return within(row).getAllByRole('cell');
  }

  function statLine(label: RegExp) {
    const stats = screen.getByRole('list', { name: /how to read these figures/i });
    return within(stats).getByText(label).closest('li')!.textContent!;
  }

  const dollarsIn = (text: string) => Number(text.match(/\$[\d.]+/)![0].slice(1));

  it("the 2027 row's operating-only cell and combined-total cell are different, correct figures", () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    const cells = dataCells(screen.getByRole('table'), 2027);
    // Operating tax only ($56.92/mo) and the combined total including debt
    // ($68.75/mo) differ by exactly the 2027 debt component — asserting both
    // makes it impossible for one column to silently become an alias of the
    // other.
    expect(cells[OPERATING_TAX_MO].textContent).toBe('$56.92');
    expect(cells[TOTAL_MO].textContent).toBe('$68.75');
  });

  it('the 2034 "vs 2026" cell equals the rendered 2034-increase statistic', () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    const vsBaseCell = dataCells(screen.getByRole('table'), 2034)[VS_BASE_MO].textContent!;
    const finalYearStat = dollarsIn(statLine(/2034 increase/i));
    expect(dollarsIn(vsBaseCell)).toBe(finalYearStat);
    expect(finalYearStat).toBe(15.05);
  });

  it('the average year-over-year step equals the 2034 increase divided by 8', () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    const finalYearIncrease = dollarsIn(statLine(/2034 increase/i));
    const averageStep = dollarsIn(statLine(/average year-over-year step/i));
    // Each figure is independently rounded to the cent for display, so the
    // identity holds only to within a cent here even though the underlying
    // unrounded numbers satisfy it exactly (see lib/tax/projection.test.ts).
    expect(averageStep * 8).toBeCloseTo(finalYearIncrease, 1);
    expect(averageStep).toBe(1.88);
  });
});

describe('growth override tolerates a half-typed entry', () => {
  const cellText = (year: number, col: number) => {
    const row = within(screen.getByRole('table')).getByText(String(year)).closest('tr')!;
    return within(row).getAllByRole('cell')[col].textContent!;
  };
  // Cell order matches the JSX in Projection.tsx (the year sits in a <th>):
  // [grossAV, netAV, operatingRate, operatingTax/mo, debtRate, debtTax/mo, total/mo, vsBase/mo]
  const OPERATING_MO = 3;

  it('clearing the field leaves the projection on the last real figure', async () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    const before = cellText(2034, OPERATING_MO);

    const input = screen.getByLabelText(/growth after 2027/i);
    await userEvent.clear(input);

    // An empty box is a keystroke, not an assumption. Number('') is 0 and
    // finite, so a naive parse would read this as "0% growth" and swing every
    // projected year while the cursor is still in the field.
    expect(input).toHaveValue(null);
    expect(cellText(2034, OPERATING_MO)).toBe(before);
  });

  it('recomputes once the entry parses to a number', async () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    const before = cellText(2034, OPERATING_MO);

    const input = screen.getByLabelText(/growth after 2027/i);
    await userEvent.clear(input);
    await userEvent.type(input, '0');

    // 0% growth after 2027 is a real answer, and differs from the district's 3.5%.
    expect(cellText(2034, OPERATING_MO)).not.toBe(before);
  });
});
