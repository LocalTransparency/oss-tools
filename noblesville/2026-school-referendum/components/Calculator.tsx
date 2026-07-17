'use client';

import { useState } from 'react';
import type { ParcelCandidate } from '@/lib/lookup/arcgis';
import { resolveTaxDistrict } from '@/lib/tax/indiana/districts/resolve';
import { nameUncoveredDistrict } from '@/lib/tax/indiana/counties/hamilton';
import { NOBLESVILLE } from '@/lib/tax/indiana/districts/noblesville';
import type { DistrictReferendumConfig, TaxDistrict } from '@/lib/tax/types';
import { fmtDollars } from '@/lib/format';
import Results from './Results';

type Selection =
  | { kind: 'parcel'; parcel: ParcelCandidate; config: DistrictReferendumConfig; district: TaxDistrict }
  | { kind: 'manual'; grossAV: number; config: DistrictReferendumConfig; district: TaxDistrict };

export default function Calculator() {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<ParcelCandidate[] | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualAV, setManualAV] = useState('');
  const [manualDistrict, setManualDistrict] = useState(NOBLESVILLE.taxDistricts[3].name); // Noblesville City
  // null = covered/none; { name } = uncovered (name is the district name when
  // verified, or null for the generic "not covered" message).
  const [uncovered, setUncovered] = useState<{ name: string | null } | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setCandidates(null); setSelection(null); setUncovered(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query }),
      });
      if (res.status === 400) {
        setError(
          'That address looks too short — try the street number and street name (e.g. 1234 Conner St).',
        );
        return;
      }
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
    const resolved = resolveTaxDistrict(parcel.taxDistrictName);
    if (!resolved) {
      setUncovered({ name: nameUncoveredDistrict(parcel.taxDistrictName) });
      setSelection(null);
      return;
    }
    setUncovered(null);
    setSelection({ kind: 'parcel', parcel, config: resolved.config, district: resolved.district });
    document.title = `${resolved.config.name} referendum — property tax estimate`;
  }

  function calculateManual(e: React.FormEvent) {
    e.preventDefault();
    const grossAV = Number(manualAV.replace(/[,$\s]/g, ''));
    const district = NOBLESVILLE.taxDistricts.find((d) => d.name === manualDistrict);
    if (!Number.isFinite(grossAV) || grossAV <= 0 || grossAV > 50_000_000 || !district) {
      setError('Enter a gross assessed value between $1 and $50,000,000.');
      setUncovered(null); setSelection(null);
      return;
    }
    setError(null); setUncovered(null);
    setSelection({ kind: 'manual', grossAV, config: NOBLESVILLE, district });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={lookup} className="space-y-2">
        <label htmlFor="address" className="block font-medium">Your street address</label>
        <div className="flex gap-2">
          <input
            id="address"
            className="w-full rounded-md border border-border bg-surface p-2"
            placeholder="e.g. 1234 Conner St"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="street-address"
          />
          <button type="submit" disabled={busy || query.trim().length < 4}
            className="rounded-md bg-accent px-4 py-2 font-medium text-accent-contrast hover:bg-accent-hover disabled:opacity-50">
            {busy ? 'Searching…' : 'Look up'}
          </button>
        </div>
        <p className="text-xs text-muted">
          Your address is sent to Hamilton County&rsquo;s public parcel service to find your assessed
          value. It is not stored or logged by this site.
        </p>
      </form>

      <button type="button" className="text-sm text-accent underline" onClick={() => setManualOpen((v) => !v)}>
        Enter assessed value manually
      </button>

      {manualOpen && (
        <form onSubmit={calculateManual} className="space-y-2 rounded-md border border-border bg-surface p-4">
          <label htmlFor="manual-av" className="block font-medium">Gross assessed value</label>
          <input id="manual-av" className="w-full rounded-md border border-border bg-surface p-2" inputMode="numeric"
            placeholder="e.g. 350000" value={manualAV} onChange={(e) => setManualAV(e.target.value)} />
          <label htmlFor="manual-district" className="block font-medium">Taxing district</label>
          <select id="manual-district" className="w-full rounded-md border border-border bg-surface p-2"
            value={manualDistrict} onChange={(e) => setManualDistrict(e.target.value)}>
            {NOBLESVILLE.taxDistricts.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
          </select>
          <p className="text-xs text-muted">
            Inside Noblesville city limits, choose Noblesville City. Not sure? Your taxing district is
            printed on your tax bill (Form TS-1).
          </p>
          <button type="submit" className="rounded-md bg-accent px-4 py-2 font-medium text-accent-contrast hover:bg-accent-hover">Calculate</button>
        </form>
      )}

      {error && <p role="alert" className="rounded-md border border-warning-border bg-warning-bg p-3 text-sm text-warning-fg">{error}</p>}

      {candidates && candidates.length === 0 && (
        <p className="text-sm">
          No matching parcels found in Hamilton County. Check the spelling, try just the street
          number and name, or enter your assessed value manually above.
        </p>
      )}

      {candidates && candidates.length >= 1 && !selection && (
        <ul className="space-y-1">
          {candidates.map((c) => (
            <li key={c.parcelNo}>
              <button type="button" onClick={() => select(c)} className="w-full rounded-md border border-border bg-surface p-2 text-left hover:bg-surface-2">
                {c.address}, {c.city} {c.zip} — gross AV {fmtDollars(c.grossAV)}
              </button>
            </li>
          ))}
        </ul>
      )}

      {uncovered && (
        <p role="alert" className="rounded-md border border-border bg-surface p-3 text-sm">
          {uncovered.name
            ? `We found your parcel, but it's in the ${uncovered.name} district, which this tool doesn't cover yet. That district's school rates differ, so these numbers wouldn't apply.`
            : `We found your parcel in Hamilton County, but it isn't in a school district this tool covers yet. Its school rates differ, so these numbers wouldn't apply.`}
        </p>
      )}

      {selection?.kind === 'parcel' && (
        <Results
          config={selection.config}
          addressLabel={selection.parcel.address}
          grossAV={selection.parcel.grossAV}
          district={selection.district}
          homestead={selection.parcel.homestead}
          assessmentYear={selection.parcel.assessmentYear || null}
          propertyReportUrl={selection.parcel.propertyReportUrl || null}
        />
      )}
      {selection?.kind === 'manual' && (
        <Results
          config={selection.config}
          addressLabel={null}
          grossAV={selection.grossAV}
          district={selection.district}
          homestead={true}
          assessmentYear={null}
          propertyReportUrl={null}
        />
      )}
    </div>
  );
}
