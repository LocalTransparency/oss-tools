import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Results from './Results';
import { findDistrict } from '@/lib/tax/engine';
import { NOBLESVILLE } from '@/lib/tax/indiana/districts/noblesville';
import type { DistrictReferendumConfig } from '@/lib/tax/types';

const city = findDistrict(NOBLESVILLE, 'Noblesville City')!;

function renderCity(extra: Partial<React.ComponentProps<typeof Results>> = {}) {
  return render(
    <Results
      config={NOBLESVILLE}
      addressLabel="1234 Conner St"
      grossAV={350000}
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
    expect(screen.getByText('$4,020')).toBeInTheDocument();   // pass at committed 0.41
    expect(screen.getByText('$3,334')).toBeInTheDocument();   // fail
    expect(screen.getAllByText(/\$4,288/).length).toBeGreaterThan(0);  // pass at authorized max
  });

  it('shows the pass-vs-fail difference in $/yr and $/mo', () => {
    renderCity();
    expect(screen.getByText(/\+\$686/)).toBeInTheDocument();      // 686.34/yr
    expect(screen.getByText(/\$57\.20/)).toBeInTheDocument();     // per month
  });

  it('shows a non-homestead notice when homestead is false', () => {
    renderCity({ homestead: false });
    expect(screen.getByText(/assumes an owner-occupied homestead/i)).toBeInTheDocument();
  });

  it('exposes the math breakdown with net AV and cap figures', () => {
    renderCity();
    expect(screen.getByText(/how this was calculated/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\$181,200/).length).toBeGreaterThan(0); // pay-2026 net AV
    expect(screen.getAllByText(/\$167,400/).length).toBeGreaterThan(0); // pay-2027 net AV
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
        grossAV={350000}
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
});
