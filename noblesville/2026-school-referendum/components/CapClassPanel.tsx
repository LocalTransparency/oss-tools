'use client';

import { useState } from 'react';
import type { AvBuckets, CapClass } from '@/lib/tax/types';
import { CLASS_LABEL, type CapClassInference } from '@/lib/tax/indiana/capClass';
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

  // A bucket must never go negative: the circuit-breaker credit is computed
  // per class from that class's own gross AV (see computeBill in
  // lib/tax/engine.ts), and a negative gross AV inflates the credit — e.g.
  // {cap1: 350000, cap3: -100000} understates the bill. Clamp at the point
  // a value enters state so a negative bucket can never reach the engine.
  const set = (key: keyof AvBuckets) => (raw: string) => {
    const n = Number(raw.replace(/[^0-9.-]/g, ''));
    const clamped = Number.isFinite(n) ? Math.max(0, n) : 0;
    onChange({ ...value, [key]: clamped });
  };

  const total = value.cap1 + value.cap2 + value.cap3;
  // Indiana's homestead covers the dwelling plus one acre; the remainder of
  // a larger homestead parcel is likely under the 2% cap even though this
  // parcel's inferred class is 1%. An unparseable/missing acreage (null)
  // can't be ruled out as multi-acre, so it warns too rather than being
  // silently treated like a confirmed sub-acre lot.
  const multiAcreHomestead = inference.capClass === 1 && (deededAcres === null || deededAcres > 1);

  return (
    <section aria-labelledby="capclass-heading" className="space-y-3 rounded-md border border-border bg-surface p-4">
      <h3 id="capclass-heading" className="font-medium">How this property is capped</h3>
      <p className="text-sm">
        {fmtDollars(total)} assessed value, treated under the state&rsquo;s{' '}
        <strong>{CAP_PERCENT[inference.capClass]}% cap — {CLASS_LABEL[inference.capClass]}</strong>{' '}
        class.
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
                  value={String(value[key])}
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
