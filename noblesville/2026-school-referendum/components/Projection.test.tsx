import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Projection } from './Projection';
import { NOBLESVILLE } from '../lib/tax/indiana/districts/noblesville';

const buckets = { cap1: 350000, cap2: 0, cap3: 0 };

describe('Projection', () => {
  it('renders a row for every projected year', () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    for (const y of [2026, 2027, 2028, 2031, 2034]) {
      expect(screen.getByText(String(y))).toBeInTheDocument();
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
    expect(within(table).getByText(/operating tax\/mo/i)).toBeInTheDocument();
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
