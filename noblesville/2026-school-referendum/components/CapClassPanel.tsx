'use client';

import { useState } from 'react';
import type { AvBuckets, CapClass } from '@/lib/tax/types';
import { presentCapClasses } from '@/lib/tax/engine';
import { CLASS_LABEL, type CapClassInference } from '@/lib/tax/indiana/capClass';
import { nextFieldOverride, type FieldOverride } from '@/lib/fieldOverride';
import { fmtDollars } from '@/lib/format';

/** Constitutional cap rate, as a whole percent, keyed the same way as CLASS_LABEL. */
const CAP_PERCENT: Record<CapClass, number> = { 1: 1, 2: 2, 3: 3 };

const BUCKET_KEYS = ['cap1', 'cap2', 'cap3'] as const;

interface Props {
  value: AvBuckets;
  inference: CapClassInference;
  // null when the county's acreage figure is missing or unparseable (see
  // lib/lookup/arcgis.ts) — distinct from a genuine zero-acre parcel, and
  // treated as "can't rule out multi-acre" below rather than silently as
  // "not multi-acre."
  deededAcres: number | null;
  onChange: (b: AvBuckets) => void;
}

/**
 * Shows which Indiana constitutional cap class (IC 6-1.1-20.6) a parcel is
 * inferred to fall under, and lets the visitor correct it or split the
 * assessed value across the three classes. The inference is a
 * dominant-class guess (see lib/tax/indiana/capClass.ts) — this panel is
 * the manual override that makes that guess correctable.
 */
export function CapClassPanel({ value, inference, deededAcres, onChange }: Props) {
  const [open, setOpen] = useState(false);
  // One raw-text override per bucket input, kept independent of `value` — see
  // lib/fieldOverride.ts for why. Without this, clearing a field to retype it
  // snapped straight back to "0" (Number('') is 0 and finite) and a typed
  // "." never survived the round trip through `value`'s formatted string
  // (Finding G) — the same bug Projection.tsx's growth fields solved first.
  const [overrides, setOverrides] = useState<Partial<Record<keyof AvBuckets, FieldOverride>>>({});

  // A bucket must never go negative: the circuit-breaker credit is computed
  // per class from that class's own gross AV (see computeBill in
  // lib/tax/engine.ts), and a negative gross AV inflates the credit — e.g.
  // {cap1: 350000, cap3: -100000} understates the bill. Clamp at the point
  // a value enters state so a negative bucket can never reach the engine.
  // The clamp applies only once an entry actually parses — a half-typed "-"
  // or a cleared field must not commit anything at all (that's the frozen
  // case field.parseable === false handles).
  const set = (key: keyof AvBuckets) => (raw: string) => {
    const field = nextFieldOverride(raw, overrides[key] ?? null, value[key]);
    setOverrides((o) => ({ ...o, [key]: { text: field.text, value: field.value } }));
    if (field.parseable) {
      onChange({ ...value, [key]: Math.max(0, field.value) });
    }
  };

  const total = value.cap1 + value.cap2 + value.cap3;
  // Finding A: which class(es) actually hold value RIGHT NOW, derived from
  // the live buckets — not from `inference`, which is set once at parcel
  // selection and never updated. Without this, correcting the split below
  // (exactly what this panel invites) left the headline above still naming
  // the parcel's original, now-wrong, single class. `inference` still
  // supplies the reason/confidence text below: that genuinely describes what
  // the county's parcel attributes suggested at lookup time and doesn't
  // change just because the visitor corrected the split.
  const present = presentCapClasses(value);
  const singleClass: CapClass | null = present.length <= 1 ? (present[0] ?? inference.capClass) : null;

  // Indiana's homestead covers the dwelling plus one acre; the remainder of
  // a larger homestead parcel is likely under the 2% cap even though this
  // parcel's inferred class is 1%. An unparseable/missing acreage (null)
  // can't be ruled out as multi-acre, so it warns too rather than being
  // silently treated like a confirmed sub-acre lot. Gated on `singleClass`
  // (buckets-derived), not the stale inference, so the prompt disappears the
  // moment the visitor actually moves value into cap 2 below — the split it
  // was nudging toward has already happened.
  const multiAcreHomestead = singleClass === 1 && (deededAcres === null || deededAcres > 1);

  return (
    <section aria-labelledby="capclass-heading" className="space-y-3 rounded-md border border-border bg-surface p-4">
      <h3 id="capclass-heading" className="font-medium">How this property is capped</h3>
      <p className="text-sm">
        {singleClass !== null ? (
          <>
            {fmtDollars(total)} assessed value, treated under the state&rsquo;s{' '}
            <strong>{CAP_PERCENT[singleClass]}% cap — {CLASS_LABEL[singleClass]}</strong>{' '}
            class.
          </>
        ) : (
          <>
            {fmtDollars(total)} assessed value, split across the state&rsquo;s{' '}
            <strong>{present.map((c) => `${CAP_PERCENT[c]}%`).join('/')} cap classes</strong>{' '}
            by property class, as entered below.
          </>
        )}
      </p>

      {inference.confidence === 'low' ? (
        <p role="status" className="rounded-md border border-warning-border bg-warning-bg p-3 text-sm text-warning-fg">
          {inference.reason}
        </p>
      ) : (
        <p className="text-sm text-muted">{inference.reason}</p>
      )}

      {multiAcreHomestead && (
        <p className="text-sm text-muted">
          {deededAcres === null
            ? "The county's acreage figure for this parcel is missing or unreadable, so we can't confirm it's a single acre or less."
            : `This parcel is ${deededAcres} acres.`}{' '}
          Indiana&rsquo;s homestead covers the dwelling plus one
          acre, so part of the land value is likely assessed under the 2% cap. The county&rsquo;s
          public parcel service doesn&rsquo;t expose that split, so adjust it below if you know your
          own figures.
        </p>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-sm text-accent underline"
      >
        {open ? 'Hide' : 'Adjust'} the split
      </button>

      {open && (
        <div className="space-y-2">
          {BUCKET_KEYS.map((key, i) => {
            const cls = (i + 1) as CapClass;
            return (
              <label key={key} className="block text-sm">
                {CAP_PERCENT[cls]}% cap — {CLASS_LABEL[cls]}
                <input
                  type="text"
                  inputMode="numeric"
                  value={overrides[key]?.text ?? String(value[key])}
                  onChange={(e) => set(key)(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-surface p-2"
                />
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}
