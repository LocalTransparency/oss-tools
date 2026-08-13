import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Calculator from './Calculator';

// userEvent ships with @testing-library/react v16 as separate pkg — install if missing:
// npm install -D @testing-library/user-event

const candidate = {
  parcelNo: '160', stateParcelNo: '29', address: '1234 CONNER ST', city: 'Noblesville',
  zip: '46060', grossAV: 350000, assessmentYear: 2026, homestead: true,
  taxDistrictName: 'Noblesville City', propertyReportUrl: '',
  homesteadCode: 1, propertyClass: '510', avLand: 0, avImprove: 0, deededAcres: 0.25,
  // Cap-class fields the API route adds at response time (see app/api/lookup/route.ts).
  capClass: 1 as const,
  capClassConfidence: 'high' as const,
  capClassReason: 'An active homestead deduction places this parcel in the state’s "Homestead (Owner-occupied residence)" class (1% cap).',
};

afterEach(() => vi.restoreAllMocks());

describe('<Calculator>', () => {
  it('searches, picks a candidate, shows results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [candidate] }), { status: 200 }),
    ));
    const user = userEvent.setup();
    render(<Calculator />);
    await user.type(screen.getByLabelText(/address/i), '1234 conner st');
    await user.click(screen.getByRole('button', { name: /look up/i }));
    await user.click(await screen.findByRole('button', { name: /1234 CONNER ST/i }));
    await waitFor(() => expect(screen.getByText('$4,015')).toBeInTheDocument());
    expect(document.title).toMatch(/Noblesville Schools referendum/i);
  });

  it('falls back to manual entry on upstream failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'upstream' }), { status: 502 }),
    ));
    const user = userEvent.setup();
    render(<Calculator />);
    await user.type(screen.getByLabelText(/address/i), '1234 conner st');
    await user.click(screen.getByRole('button', { name: /look up/i }));
    expect(await screen.findByText(/county lookup isn.t available/i)).toBeInTheDocument();
  });

  it('shows a too-short message (not the county-unavailable message) on a 400 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'query-too-short' }), { status: 400 }),
    ));
    const user = userEvent.setup();
    render(<Calculator />);
    await user.type(screen.getByLabelText(/address/i), '1234 conner st');
    await user.click(screen.getByRole('button', { name: /look up/i }));
    expect(await screen.findByText(/address looks too short/i)).toBeInTheDocument();
    expect(screen.queryByText(/county lookup isn.t available/i)).not.toBeInTheDocument();
  });

  it('manual entry computes results without any lookup', async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    await user.click(screen.getByRole('button', { name: /enter assessed value manually/i }));
    await user.type(screen.getByLabelText(/gross assessed value/i), '350000');
    await user.selectOptions(screen.getByLabelText(/taxing district/i), 'Noblesville City');
    await user.click(screen.getByRole('button', { name: /calculate/i }));
    expect(await screen.findByText('$4,015')).toBeInTheDocument();
  });

  it('clears the out-of-district message when manual entry fails validation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ ...candidate, taxDistrictName: 'Wayne Township' }] }), { status: 200 }),
    ));
    const user = userEvent.setup();
    render(<Calculator />);
    await user.type(screen.getByLabelText(/address/i), '1234 conner st');
    await user.click(screen.getByRole('button', { name: /look up/i }));
    await user.click(await screen.findByRole('button', { name: /1234 CONNER ST/i }));
    expect(await screen.findByText(/in a school district this tool covers yet/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /enter assessed value manually/i }));
    await user.type(screen.getByLabelText(/gross assessed value/i), '0');
    await user.click(screen.getByRole('button', { name: /calculate/i }));
    expect(await screen.findByText(/between \$1 and \$50,000,000/i)).toBeInTheDocument();
    expect(screen.queryByText(/in a school district this tool covers yet/i)).not.toBeInTheDocument();
  });

  it('shows out-of-district message for unmatched districts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ ...candidate, taxDistrictName: 'Wayne Township' }] }), { status: 200 }),
    ));
    const user = userEvent.setup();
    render(<Calculator />);
    await user.type(screen.getByLabelText(/address/i), '1234 conner st');
    await user.click(screen.getByRole('button', { name: /look up/i }));
    await user.click(await screen.findByRole('button', { name: /1234 CONNER ST/i }));
    expect(await screen.findByText(/in a school district this tool covers yet/i)).toBeInTheDocument();
  });

  // Finding B (critical): CapClassPanel's onChange is wired to Calculator's
  // setBuckets, but nothing at the Calculator level ever proved that edit
  // actually reaches the rendered bill. CapClassPanel.test.tsx proves the
  // panel EMITS edited buckets; Results.test.tsx proves Results renders
  // whatever buckets it's GIVEN; neither joins the two. A reviewer could
  // rewire Calculator to rebuild buckets from parcel.grossAV/parcel.capClass
  // on every render (ignoring the panel's edits) and both of those suites
  // would stay green. This test selects a real parcel, moves value from cap
  // 1 to cap 2 through the panel exactly as a visitor would, and asserts the
  // rendered total actually changes as a result.
  it('moving value from cap 1 to cap 2 through the panel changes the rendered total (Finding B)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [candidate] }), { status: 200 }),
    ));
    const user = userEvent.setup();
    render(<Calculator />);
    await user.type(screen.getByLabelText(/address/i), '1234 conner st');
    await user.click(screen.getByRole('button', { name: /look up/i }));
    await user.click(await screen.findByRole('button', { name: /1234 CONNER ST/i }));
    expect(await screen.findByText('$4,015')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /adjust the split/i }));
    const cap1Input = screen.getByLabelText(/1% cap/i);
    const cap2Input = screen.getByLabelText(/2% cap/i);
    fireEvent.change(cap1Input, { target: { value: '150000' } });
    fireEvent.change(cap2Input, { target: { value: '200000' } });

    await waitFor(() => expect(screen.queryByText('$4,015')).not.toBeInTheDocument());
  });

  // Finding F (important): the grossAV guard (Calculator.tsx, `select`) and
  // the isValidCapClass fallback (same function) were exercised only by
  // Playwright e2e specs — `npx vitest run` stayed fully green if either was
  // deleted, so a CI run that skips or flakes Playwright could merge a $0 or
  // NaN bill undetected. jsdom coverage for both, using the same mocked-fetch
  // harness the rest of this file already uses.
  it('shows an explicit error, not a $0 bill, when grossAV is missing from the API response (Finding F)', async () => {
    const withoutGrossAV: Record<string, unknown> = { ...candidate };
    delete withoutGrossAV.grossAV;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [withoutGrossAV] }), { status: 200 }),
    ));
    const user = userEvent.setup();
    render(<Calculator />);
    await user.type(screen.getByLabelText(/address/i), '1234 conner st');
    await user.click(screen.getByRole('button', { name: /look up/i }));
    await user.click(await screen.findByRole('button', { name: /1234 CONNER ST/i }));
    expect(await screen.findByText(/couldn.t read this parcel.s assessed value/i)).toBeInTheDocument();
    expect(screen.queryByText('$0', { exact: true })).not.toBeInTheDocument();
  });

  it('falls back to the homestead cap class, not a $0 or NaN bill, when the API capClass is invalid (Finding F)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ ...candidate, capClass: 5 }] }), { status: 200 }),
    ));
    const user = userEvent.setup();
    render(<Calculator />);
    await user.type(screen.getByLabelText(/address/i), '1234 conner st');
    await user.click(screen.getByRole('button', { name: /look up/i }));
    await user.click(await screen.findByRole('button', { name: /1234 CONNER ST/i }));
    expect(await screen.findByText(/didn.t return a cap class for this parcel/i)).toBeInTheDocument();
    expect(await screen.findByText('$4,015')).toBeInTheDocument();
  });

  // Finding H (minor): isValidCapClass alone guarded capClass, but
  // capClassConfidence/capClassReason cross the same untyped JSON boundary
  // unguarded — a valid capClass with a missing reason rendered an empty
  // disclosure paragraph instead of falling back to the same "we don't know"
  // panel state used when capClass itself is missing.
  it('falls back to the homestead disclosure when capClass is valid but capClassReason is missing (Finding H)', async () => {
    const bad = { ...candidate, capClassReason: '' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [bad] }), { status: 200 }),
    ));
    const user = userEvent.setup();
    render(<Calculator />);
    await user.type(screen.getByLabelText(/address/i), '1234 conner st');
    await user.click(screen.getByRole('button', { name: /look up/i }));
    await user.click(await screen.findByRole('button', { name: /1234 CONNER ST/i }));
    expect(await screen.findByText(/didn.t return a cap class for this parcel/i)).toBeInTheDocument();
  });
});
