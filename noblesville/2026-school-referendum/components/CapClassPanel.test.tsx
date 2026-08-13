import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CapClassPanel } from './CapClassPanel';
import { computeBill, findDistrict } from '@/lib/tax/engine';
import { buildScenarios } from '@/lib/tax/scenarios';
import { NOBLESVILLE } from '@/lib/tax/indiana/districts/noblesville';
import type { AvBuckets } from '@/lib/tax/types';
import type { CapClassInference } from '@/lib/tax/indiana/capClass';

const base = {
  value: { cap1: 350000, cap2: 0, cap3: 0 },
  inference: { capClass: 1 as const, confidence: 'high' as const, reason: 'An active homestead deduction places this parcel under the 1% cap.' },
  deededAcres: 0.25,
};

// CapClassPanel is a controlled component: it emits an edited bucket set via
// onChange and expects the caller to feed it back through `value` (exactly
// how components/Calculator.tsx will use it). A bare render() with a static
// `value` prop and a no-op onChange cannot exercise more than one keystroke
// — after the first change event, React resets the input to the unchanged
// `value` prop, so a bare render can only ever prove the FIRST keystroke was
// handled. This harness closes that loop for multi-character typing tests.
function Harness({
  initial, inference, deededAcres, onChange,
}: {
  initial: AvBuckets;
  inference: CapClassInference;
  deededAcres: number;
  onChange: (b: AvBuckets) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <CapClassPanel
      value={value}
      inference={inference}
      deededAcres={deededAcres}
      onChange={(b) => { setValue(b); onChange(b); }}
    />
  );
}

describe('CapClassPanel', () => {
  it('states the inferred class and its reason', () => {
    render(<CapClassPanel {...base} onChange={() => {}} />);
    // Scoped to the <strong> summary: the fixture's own reason text also
    // contains "1% cap" (real capClass.ts reasons do too, for some but not
    // all branches — see lib/tax/indiana/capClass.ts), so an unscoped query
    // would match two elements. The summary is the panel's own authoritative
    // statement of the class and must carry the percentage regardless of
    // what the caller-supplied reason string happens to say.
    expect(screen.getByText(/1% cap/, { selector: 'strong' })).toBeInTheDocument();
  });

  it('warns when confidence is low', () => {
    render(<CapClassPanel {...base} inference={{ ...base.inference, confidence: 'low', reason: 'unconfirmed (-1)' }} onChange={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent(/unconfirmed/i);
  });

  it('flags a multi-acre homestead as likely split across caps', () => {
    render(<CapClassPanel {...base} deededAcres={5.68} onChange={() => {}} />);
    expect(screen.getByText(/dwelling plus one acre/i)).toBeInTheDocument();
    expect(screen.getByText(/5\.68/)).toBeInTheDocument();
  });

  it('does not show the acreage note for a sub-acre homestead', () => {
    render(<CapClassPanel {...base} onChange={() => {}} />);
    expect(screen.queryByText(/dwelling plus one acre/i)).not.toBeInTheDocument();
  });

  // Finding 5: an unparseable/missing county acreage figure (null — see
  // lib/lookup/arcgis.ts) must not be silently treated as a confirmed
  // sub-acre lot. It can't be ruled out as multi-acre, so the warning fires,
  // worded for "we don't know" rather than a specific acreage.
  it('flags a homestead with unknown (null) acreage as possibly multi-acre, rather than silently withholding the warning', () => {
    render(<CapClassPanel {...base} deededAcres={null} onChange={() => {}} />);
    expect(screen.getByText(/dwelling plus one acre/i)).toBeInTheDocument();
    expect(screen.getByText(/missing or unreadable/i)).toBeInTheDocument();
    expect(screen.queryByText(/this parcel is null acres/i)).not.toBeInTheDocument();
  });

  it('never claims the split is unpublished — only that the county parcel service does not expose it', () => {
    render(<CapClassPanel {...base} deededAcres={5.68} onChange={() => {}} />);
    expect(screen.queryByText(/does not publish that split/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/split is not published/i)).not.toBeInTheDocument();
    expect(screen.getByText(/public parcel service doesn.t expose that split/i)).toBeInTheDocument();
  });

  it('emits edited buckets from the override inputs', async () => {
    const onChange = vi.fn();
    render(<Harness initial={base.value} inference={base.inference} deededAcres={base.deededAcres} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /adjust/i }));
    const cap2 = screen.getByLabelText(/2% cap/i);
    await userEvent.clear(cap2);
    await userEvent.type(cap2, '100000');
    expect(onChange).toHaveBeenLastCalledWith({ cap1: 350000, cap2: 100000, cap3: 0 });
  });

  // A prior review found that a negative bucket inflates the circuit-breaker
  // credit: {cap1: 350000, cap3: -100000} turned a $4,015 bill into $1,015.
  // That was unreachable while Results.tsx forced a single positive bucket;
  // the override inputs above make it reachable, so every bucket must clamp
  // at zero the moment a value enters state — as defense in depth on top of
  // the engine fix below.
  it('clamps a negative override to zero, and proves it matches the legitimate-zero bill', async () => {
    const onChange = vi.fn();
    render(<CapClassPanel {...base} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /adjust/i }));
    const cap3 = screen.getByLabelText(/3% cap/i);
    // A single programmatic set (rather than keystroke-by-keystroke typing)
    // so the assertion targets the clamp itself, not incidental behavior of
    // a controlled input re-rendering mid-keystroke.
    fireEvent.change(cap3, { target: { value: '-100000' } });

    expect(onChange).toHaveBeenLastCalledWith({ cap1: 350000, cap2: 0, cap3: 0 });
    const emitted = onChange.mock.calls.map((call) => call[0] as AvBuckets);
    expect(emitted.every((b) => b.cap1 >= 0 && b.cap2 >= 0 && b.cap3 >= 0)).toBe(true);

    // A follow-up review fix closed the exploit at the engine itself
    // (computeBill/computeNetAV now floor every bucket at zero on entry — see
    // lib/tax/engine.ts), so the previously-exploited unclamped negative
    // bucket now matches the legitimate-zero bill too, not just the
    // UI-clamped one. The UI clamp above remains defense in depth: no
    // negative number should sit in component state at all, even though the
    // engine can no longer be fooled by one that does.
    const city = findDistrict(NOBLESVILLE, 'Noblesville City')!;
    const scenario = buildScenarios(NOBLESVILLE).current;
    const clampedBuckets = onChange.mock.calls.at(-1)![0] as AvBuckets;
    const clampedBill = computeBill(clampedBuckets, city, scenario, NOBLESVILLE);
    const legitimateZeroBill = computeBill({ cap1: 350000, cap2: 0, cap3: 0 }, city, scenario, NOBLESVILLE);
    const previouslyExploitedBill = computeBill({ cap1: 350000, cap2: 0, cap3: -100000 }, city, scenario, NOBLESVILLE);

    expect(clampedBill.total).toBe(legitimateZeroBill.total);
    expect(previouslyExploitedBill.total).toBe(legitimateZeroBill.total);
  });
});

// Finding A (critical): the headline used to be derived from `inference`,
// which is set once at parcel selection and never updated. Following this
// panel's own "Adjust the split" prompt to correct a misclassified parcel
// left the headline still insisting the WHOLE parcel was under the
// original single class — contradicting Results.tsx's blended-cap label for
// the exact same buckets. The headline must be derived from the live
// buckets instead.
describe('the headline reflects the live buckets, not the stale inference (Finding A)', () => {
  it('says the value is split across classes once the buckets straddle two classes, even though inference still names only class 1', () => {
    render(
      <CapClassPanel
        {...base}
        value={{ cap1: 150000, cap2: 200000, cap3: 0 }}
        inference={{ ...base.inference, capClass: 1 }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/split across/i)).toBeInTheDocument();
    expect(screen.getByText(/1%\/2%/)).toBeInTheDocument();
    // Must not still claim the whole parcel is under a single cap.
    expect(screen.queryByText(/treated under the state.s/i)).not.toBeInTheDocument();
  });

  it('hides the multi-acre prompt once value has actually moved into cap 2, even on a multi-acre parcel', () => {
    render(
      <CapClassPanel
        {...base}
        value={{ cap1: 150000, cap2: 200000, cap3: 0 }}
        deededAcres={5.68}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText(/dwelling plus one acre/i)).not.toBeInTheDocument();
  });

  it('still shows the multi-acre prompt when the split has not moved anything into cap 2 yet', () => {
    render(<CapClassPanel {...base} deededAcres={5.68} onChange={() => {}} />);
    expect(screen.getByText(/dwelling plus one acre/i)).toBeInTheDocument();
  });
});

// Finding G (minor): the override inputs round-tripped every keystroke
// through Number(), so clearing a field yielded "" → 0 → wrote back "0",
// and the next keystroke landed after that leading zero; a typed "." was
// silently dropped because it parses to the same number as before it. Fixed
// by reusing Projection.tsx's text/value split (lib/fieldOverride.ts): the
// input displays exactly what was typed until it parses, rather than a
// string re-derived from the committed number.
describe('override inputs preserve raw typed text (Finding G)', () => {
  it('clearing a field leaves it empty instead of snapping back to "0"', async () => {
    render(<CapClassPanel {...base} onChange={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /adjust/i }));
    const cap1 = screen.getByLabelText(/1% cap/i);
    await userEvent.clear(cap1);
    expect(cap1).toHaveValue('');
  });

  it('typing after clearing does not pick up a stray leading zero', async () => {
    const onChange = vi.fn();
    render(
      <Harness initial={base.value} inference={base.inference} deededAcres={base.deededAcres} onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /adjust/i }));
    const cap1 = screen.getByLabelText(/1% cap/i);
    await userEvent.clear(cap1);
    await userEvent.type(cap1, '7');
    expect(cap1).toHaveValue('7');
    expect(onChange).toHaveBeenLastCalledWith({ cap1: 7, cap2: 0, cap3: 0 });
  });

  it('a typed decimal point is not silently dropped mid-entry', () => {
    render(<CapClassPanel {...base} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /adjust/i }));
    const cap1 = screen.getByLabelText(/1% cap/i);
    fireEvent.change(cap1, { target: { value: '350000.' } });
    expect(cap1).toHaveValue('350000.');
  });
});
