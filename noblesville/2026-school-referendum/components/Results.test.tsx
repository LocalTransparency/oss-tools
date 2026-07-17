import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Results from './Results';
import { findDistrict } from '@/lib/tax/engine';
import { NOBLESVILLE } from '@/lib/tax/indiana/districts/noblesville';

const city = findDistrict(NOBLESVILLE, 'Noblesville City')!;

describe('<Results>', () => {
  it('renders all three scenario totals for a $350k city homestead', () => {
    render(<Results grossAV={350000} district={city} homestead={true} assessmentYear={2026} propertyReportUrl={null} />);
    expect(screen.getByText('$4,015')).toBeInTheDocument();   // current
    expect(screen.getByText('$4,020')).toBeInTheDocument();   // pass at committed 0.41
    expect(screen.getByText('$3,334')).toBeInTheDocument();   // fail
    expect(screen.getAllByText(/\$4,288/).length).toBeGreaterThan(0);  // pass at authorized max, secondary line
  });

  it('shows the pass-vs-fail difference in $/yr and $/mo', () => {
    render(<Results grossAV={350000} district={city} homestead={true} assessmentYear={2026} propertyReportUrl={null} />);
    expect(screen.getByText(/\+\$686/)).toBeInTheDocument();      // 686.34/yr
    expect(screen.getByText(/\$57\.20/)).toBeInTheDocument();     // per month
  });

  it('shows a non-homestead notice when homestead is false', () => {
    render(<Results grossAV={350000} district={city} homestead={false} assessmentYear={2026} propertyReportUrl={null} />);
    expect(screen.getByText(/assumes an owner-occupied homestead/i)).toBeInTheDocument();
  });

  it('exposes the math breakdown with net AV and cap figures', () => {
    render(<Results grossAV={350000} district={city} homestead={true} assessmentYear={2026} propertyReportUrl={null} />);
    expect(screen.getByText(/how this was calculated/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\$181,200/).length).toBeGreaterThan(0); // pay-2026 net AV
    expect(screen.getAllByText(/\$167,400/).length).toBeGreaterThan(0); // pay-2027 net AV
  });
});
