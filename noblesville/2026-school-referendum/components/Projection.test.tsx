import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

  // Finding I (minor): a prior version of this test only checked two
  // substrings and a bare /2034/ — an assertion that can't fail without also
  // failing the more precise tests below (which check all four statistics'
  // labels AND their rendered dollar values), so it was deleted rather than
  // kept as dead weight that reads as coverage. See the
  // "operating-only labelling" and "operating-vs-combined arithmetic" describe
  // blocks below for the tests that actually cover this.

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

  // Finding C (critical): only finalYearIncrease and averageYearOverYearStep
  // were pinned to a value above; firstYearChange and averageIncreaseVsBase
  // had no value assertion anywhere, so swapping their rendered figures left
  // both suites green — the exact decorative-guard pattern this describe
  // block otherwise exists to prevent. Pin both remaining statistics too.
  it('pins the 2027 change and the average-increase-over-2026 statistics', () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    expect(dollarsIn(statLine(/2027 change/i))).toBe(1.05);
    expect(dollarsIn(statLine(/average increase over 2026/i))).toBe(8.19);
  });
});

// Finding 1 (critical): the growth fields carried only step="0.1", no
// min/max, and no validation. A visitor entering -150 (meant as -1.5%,
// mistyped) used to flip the assessed value's sign every year and,
// pre-engine-fix, fabricate a confident positive dollar figure from a
// negative gross AV. The engine itself is now safe (lib/tax/engine.test.ts),
// but an absurd growth assumption is still not something this tool should
// silently accept or silently clamp — it must produce a visible message and
// leave the table on the last real assumption, the same way a half-typed
// entry does.
describe('growth override rejects an out-of-range entry with a visible message (Finding 1)', () => {
  const cellText = (year: number, col: number) => {
    const row = within(screen.getByRole('table')).getByText(String(year)).closest('tr')!;
    return within(row).getAllByRole('cell')[col].textContent!;
  };
  const OPERATING_MO = 3;

  it('a wildly out-of-range entry (-150) shows a visible message and does not change the projection', () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    const before = cellText(2034, OPERATING_MO);

    const input = screen.getByLabelText(/growth after 2027/i);
    // A single programmatic set (rather than keystroke-by-keystroke typing)
    // so the assertion targets the range check itself: typing "-150" one
    // character at a time passes through "-1" and "-15", both of which are
    // legitimately in-range and would otherwise commit before "-150" lands —
    // see CapClassPanel.test.tsx for the same reasoning.
    fireEvent.change(input, { target: { value: '-150' } });

    expect(screen.getByRole('alert')).toHaveTextContent(/between -20% and 20%/i);
    expect(cellText(2034, OPERATING_MO)).toBe(before);
  });

  it('recovering with an in-range entry clears the message and updates the projection', () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    const before = cellText(2034, OPERATING_MO);

    const input = screen.getByLabelText(/growth after 2027/i);
    fireEvent.change(input, { target: { value: '-150' } });
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '0' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(cellText(2034, OPERATING_MO)).not.toBe(before);
  });

  it('the input carries min/max attributes as defense in depth against out-of-range input', () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    const input = screen.getByLabelText(/growth after 2027/i);
    expect(input).toHaveAttribute('min', '-20');
    expect(input).toHaveAttribute('max', '20');
  });
});

// Finding D (important): operatingRates carries status: 'public-commitment'
// and a note that it is not legally binding and the board votes a rate
// annually — but that note was never rendered anywhere near the table, so a
// voter reading the 2031-2034 rows had no way to know the board could
// lawfully exceed them, up to the authorized ceiling. The caveat must be
// visible next to the schedule's own Source link (not buried in a collapsed
// <details> that only ever spoke about 2027), and it must name the real
// ceiling, not a vague "may change."
describe('the published schedule is disclosed as non-binding (Finding D)', () => {
  it('states the schedule is a public commitment, not binding, and names the authorized ceiling', () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    expect(screen.getByText(/not a legally binding rate/i)).toBeInTheDocument();
    expect(screen.getByText(/board votes a rate every year/i)).toBeInTheDocument();
    expect(screen.getByText(/authorized \$0\.57/)).toBeInTheDocument();
  });

  it('covers the out years (2031-2034), not just 2027', () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    const caveat = screen.getByText(/could set any year shown here/i).closest('p')!;
    expect(caveat).toHaveTextContent(/2027/);
    expect(caveat).toHaveTextContent(/2034/);
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
