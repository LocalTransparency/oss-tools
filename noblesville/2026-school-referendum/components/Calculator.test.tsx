import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Calculator from './Calculator';

// userEvent ships with @testing-library/react v16 as separate pkg — install if missing:
// npm install -D @testing-library/user-event

const candidate = {
  parcelNo: '160', stateParcelNo: '29', address: '1234 CONNER ST', city: 'Noblesville',
  zip: '46060', grossAV: 350000, assessmentYear: 2026, homestead: true,
  taxDistrictName: 'Noblesville City', propertyReportUrl: '',
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
});
