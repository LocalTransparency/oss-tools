'use client';

import { useState } from 'react';
import type { ParcelCandidate } from '@/lib/lookup/arcgis';
import { DISTRICTS, findDistrict } from '@/lib/tax/assumptions';
import type { TaxDistrict } from '@/lib/tax/types';
import { fmtDollars } from '@/lib/format';
import Results from './Results';

type Selection =
  | { kind: 'parcel'; parcel: ParcelCandidate; district: TaxDistrict }
  | { kind: 'manual'; grossAV: number; district: TaxDistrict };

export default function Calculator() {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<ParcelCandidate[] | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualAV, setManualAV] = useState('');
  const [manualDistrict, setManualDistrict] = useState(DISTRICTS[3].name); // Noblesville City
  const [outOfDistrict, setOutOfDistrict] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setCandidates(null); setSelection(null); setOutOfDistrict(false);
    try {
      const res = await fetch(`/api/lookup?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('lookup-failed');
      const body = (await res.json()) as { candidates: ParcelCandidate[] };
      setCandidates(body.candidates);
    } catch {
      setError(
        "The county lookup isn't available right now. You can enter your gross assessed value manually below — it's on your tax bill (Form TS-1) or the county property report.",
      );
      setManualOpen(true);
    } finally {
      setBusy(false);
    }
  }

  function select(parcel: ParcelCandidate) {
    const district = findDistrict(parcel.taxDistrictName);
    if (!district) { setOutOfDistrict(true); setSelection(null); return; }
    setOutOfDistrict(false);
    setSelection({ kind: 'parcel', parcel, district });
  }

  function calculateManual(e: React.FormEvent) {
    e.preventDefault();
    const grossAV = Number(manualAV.replace(/[,$\s]/g, ''));
    const district = DISTRICTS.find((d) => d.name === manualDistrict);
    if (!Number.isFinite(grossAV) || grossAV <= 0 || grossAV > 50_000_000 || !district) {
      setError('Enter a gross assessed value between $1 and $50,000,000.');
      return;
    }
    setError(null); setOutOfDistrict(false);
    setSelection({ kind: 'manual', grossAV, district });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={lookup} className="space-y-2">
        <label htmlFor="address" className="block font-medium">Your street address</label>
        <div className="flex gap-2">
          <input
            id="address"
            className="w-full rounded border p-2"
            placeholder="e.g. 1234 Conner St"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="street-address"
          />
          <button type="submit" disabled={busy || query.trim().length < 4}
            className="rounded border px-4 py-2 font-medium disabled:opacity-50">
            {busy ? 'Searching…' : 'Look up'}
          </button>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Your address is sent to Hamilton County&rsquo;s public parcel service to find your assessed
          value. It is not stored or logged by this site.
        </p>
      </form>

      <button type="button" className="text-sm underline" onClick={() => setManualOpen((v) => !v)}>
        Enter assessed value manually
      </button>

      {manualOpen && (
        <form onSubmit={calculateManual} className="space-y-2 rounded border p-4">
          <label htmlFor="manual-av" className="block font-medium">Gross assessed value</label>
          <input id="manual-av" className="w-full rounded border p-2" inputMode="numeric"
            placeholder="e.g. 350000" value={manualAV} onChange={(e) => setManualAV(e.target.value)} />
          <label htmlFor="manual-district" className="block font-medium">Taxing district</label>
          <select id="manual-district" className="w-full rounded border p-2"
            value={manualDistrict} onChange={(e) => setManualDistrict(e.target.value)}>
            {DISTRICTS.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
          </select>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Inside Noblesville city limits, choose Noblesville City. Not sure? Your taxing district is
            printed on your tax bill (Form TS-1).
          </p>
          <button type="submit" className="rounded border px-4 py-2 font-medium">Calculate</button>
        </form>
      )}

      {error && <p role="alert" className="rounded border border-amber-400 bg-amber-50 p-3 text-sm dark:bg-amber-950">{error}</p>}

      {candidates && candidates.length === 0 && (
        <p className="text-sm">
          No matching parcels found in the Noblesville Schools district. Check the spelling, try just the
          street number and name, or enter your assessed value manually above.
        </p>
      )}

      {candidates && candidates.length >= 1 && !selection && (
        <ul className="space-y-1">
          {candidates.map((c) => (
            <li key={c.parcelNo}>
              <button type="button" onClick={() => select(c)} className="w-full rounded border p-2 text-left hover:bg-gray-50 dark:hover:bg-gray-900">
                {c.address}, {c.city} {c.zip} — gross AV {fmtDollars(c.grossAV)}
              </button>
            </li>
          ))}
        </ul>
      )}

      {outOfDistrict && (
        <p className="rounded border p-3 text-sm">
          This tool covers homes in the Noblesville Schools district (its five Hamilton County taxing
          districts). That parcel&rsquo;s taxing district isn&rsquo;t one of them, so its school rates differ
          and these numbers wouldn&rsquo;t apply.
        </p>
      )}

      {selection?.kind === 'parcel' && (
        <Results
          grossAV={selection.parcel.grossAV}
          district={selection.district}
          homestead={selection.parcel.homestead}
          assessmentYear={selection.parcel.assessmentYear || null}
          propertyReportUrl={selection.parcel.propertyReportUrl || null}
        />
      )}
      {selection?.kind === 'manual' && (
        <Results grossAV={selection.grossAV} district={selection.district}
          homestead={true} assessmentYear={null} propertyReportUrl={null} />
      )}
    </div>
  );
}
