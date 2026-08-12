import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Results, { circuitBreakerCapLabel } from './Results';
import { bucketsOf, findDistrict } from '@/lib/tax/engine';
import { NOBLESVILLE } from '@/lib/tax/indiana/districts/noblesville';
import { CARMEL_CLAY } from '@/lib/tax/indiana/districts/carmel-clay';
import type { DistrictReferendumConfig } from '@/lib/tax/types';

const city = findDistrict(NOBLESVILLE, 'Noblesville City')!;

function renderCity(extra: Partial<React.ComponentProps<typeof Results>> = {}) {
  return render(
    <Results
      config={NOBLESVILLE}
      addressLabel="1234 Conner St"
      buckets={bucketsOf(350000, 1)}
      district={city}
      homestead={true}
      assessmentYear={2026}
      propertyReportUrl={null}
      {...extra}
    />,
  );
}

describe('<Results>', () => {
  it('leads with a district-specific header naming the address and district', () => {
    renderCity();
    expect(screen.getByRole('heading', { name: /1234 Conner St.*Noblesville Schools/i })).toBeInTheDocument();
  });

  it('renders all three scenario totals for a $350k city homestead', () => {
    renderCity();
    expect(screen.getByText('$4,015')).toBeInTheDocument();   // current
    expect(screen.getByText('$3,978')).toBeInTheDocument();   // pass at committed 0.385
    expect(screen.getByText('$3,334')).toBeInTheDocument();   // fail
    expect(screen.getAllByText(/\$4,288/).length).toBeGreaterThan(0);  // pass at authorized max
  });

  it('shows the pass-vs-fail difference in $/yr and $/mo', () => {
    renderCity();
    expect(screen.getByText(/\+\$644/)).toBeInTheDocument();      // 644.49/yr
    expect(screen.getByText(/\$53\.71/)).toBeInTheDocument();     // per month
  });

  it('shows a non-homestead notice when homestead is false', () => {
    renderCity({ homestead: false });
    expect(screen.getByText(/cap class\s+was inferred from county parcel attributes/i)).toBeInTheDocument();
    expect(screen.queryByText(/assumes an owner-occupied homestead/i)).not.toBeInTheDocument();
  });

  it('exposes the math breakdown with net AV and cap figures', () => {
    renderCity();
    expect(screen.getByText(/how this was calculated/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\$181,200/).length).toBeGreaterThan(0); // pay-2026 net AV
    expect(screen.getAllByText(/\$167,400/).length).toBeGreaterThan(0); // pay-2027 net AV
  });

  it('shows the district-specific "what this referendum does" explainer with a determination link', () => {
    renderCity();
    expect(screen.getByRole('heading', { name: /what this referendum does/i })).toBeInTheDocument();
    expect(screen.getByText(/separate referendum debt rate .* stays on your bill/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /read the dlgf determination/i })).toBeInTheDocument();
  });

  it('explains Carmel Clay’s full repeal-and-replace of both referendums', () => {
    const carmelCarmel = findDistrict(CARMEL_CLAY, 'Carmel')!;
    render(
      <Results
        config={CARMEL_CLAY}
        addressLabel="1 Main St"
        buckets={bucketsOf(500000, 1)}
        district={carmelCarmel}
        homestead={true}
        assessmentYear={2026}
        propertyReportUrl={null}
      />,
    );
    expect(screen.getByText(/repeals and replaces BOTH of its current referendums/i)).toBeInTheDocument();
  });

  it('renders a minimal config (no debt, no committed2027) without crashing or a debt row', () => {
    const minimal: DistrictReferendumConfig = {
      id: 'minimal', name: 'Minimal Schools', county: 'Test', sources: {},
      referendum: { proposedMax: { value: 0.25, source: 'https://example.test/ballot', status: 'confirmed' } },
      gisGate: /minimal/i,
      taxDistricts: [{ name: 'Minimal Township', match: /township/i, totalRate2026: 2.0 }],
    };
    render(
      <Results
        config={minimal}
        addressLabel={null}
        buckets={bucketsOf(350000, 1)}
        district={minimal.taxDistricts[0]}
        homestead={true}
        assessmentYear={null}
        propertyReportUrl={null}
      />,
    );
    expect(screen.getByRole('heading', { name: /Estimated property taxes.*Minimal Schools/i })).toBeInTheDocument();
    expect(screen.queryByText(/referendum debt tax/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/public commitment for 2027 only/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/committed 2027 rate/i)).not.toBeInTheDocument();
  });

  it('names the single class rate in the circuit breaker cap label when only one class carries gross AV', () => {
    renderCity(); // fixture buckets route entirely into cap class 1 (homestead)
    // One row per rendered scenario (current, passCommitted, passMax, fail).
    expect(screen.getAllByText(/circuit breaker cap \(1% of gross AV\)/i)).toHaveLength(4);
  });

  it('reconciles gross minus every shown deduction to the shown net AV when cap-2 value is present', () => {
    // A parcel split across cap 1 and cap 2 exercises the deduction this test
    // guards: MathRows must render the cap-2 (SEA 1) deduction row, or gross
    // minus the shown deductions no longer equals the shown net AV.
    render(
      <Results
        config={NOBLESVILLE}
        addressLabel={null}
        buckets={{ cap1: 200000, cap2: 150000, cap3: 0 }}
        district={city}
        homestead={true}
        assessmentYear={2026}
        propertyReportUrl={null}
      />,
    );
    const parse = (el: Element) => Number(el.textContent!.replace(/[^0-9.]/g, ''));
    const rowValue = (label: string) =>
      parse(screen.getAllByText(label)[0].closest('tr')!.querySelector('td:last-child')!);

    const gross = rowValue('Gross assessed value');
    const std = rowValue('− Standard homestead deduction');
    const suppl = rowValue('− Supplemental homestead deduction');
    const cap2Ded = rowValue('− Cap 2 deduction (SEA 1 phase-in)');
    const net = rowValue('= Net assessed value');

    expect(cap2Ded).toBeGreaterThan(0); // proves the row reflects a real, nonzero cap-2 deduction
    expect(gross - std - suppl - cap2Ded).toBeCloseTo(net, 2);
  });
});

describe('circuitBreakerCapLabel', () => {
  it('names the rate when exactly one cap class has nonzero gross AV', () => {
    expect(circuitBreakerCapLabel({ cap1: 350000, cap2: 0, cap3: 0 })).toBe(
      'Circuit breaker cap (1% of gross AV)',
    );
    expect(circuitBreakerCapLabel({ cap1: 0, cap2: 400000, cap3: 0 })).toBe(
      'Circuit breaker cap (2% of gross AV)',
    );
    expect(circuitBreakerCapLabel({ cap1: 0, cap2: 0, cap3: 400000 })).toBe(
      'Circuit breaker cap (3% of gross AV)',
    );
  });

  it('describes a blended cap, never a single percentage, when more than one class has nonzero gross AV', () => {
    expect(circuitBreakerCapLabel({ cap1: 350000, cap2: 100000, cap3: 0 })).toBe(
      'Circuit breaker cap (blended 1%/2% by property class)',
    );
    expect(circuitBreakerCapLabel({ cap1: 350000, cap2: 100000, cap3: 50000 })).toBe(
      'Circuit breaker cap (blended 1%/2%/3% by property class)',
    );
  });
});
