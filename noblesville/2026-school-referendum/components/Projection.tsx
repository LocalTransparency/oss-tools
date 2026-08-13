'use client';

import { useMemo, useState } from 'react';
import type { AvBuckets, DistrictReferendumConfig } from '@/lib/tax/types';
import { projectReferendumLine, projectionStats } from '@/lib/tax/projection';
import { fmtCents, fmtRate } from '@/lib/format';
import { ProjectionChart } from './ProjectionChart';

interface Props {
  buckets: AvBuckets;
  config: DistrictReferendumConfig;
}

/** Percent, rounded to one decimal — avoids floating-point noise like 3.5000000000000004. */
const pct1 = (fraction: number) => Math.round(fraction * 1000) / 10;

/**
 * A growth override holds the field's raw text separately from the number the
 * projection actually uses.
 *
 * They have to be separate because a half-typed entry is not a rate. `Number('')`
 * is 0 and finite, so clearing the field to type a new figure would otherwise read
 * as "0% growth" and swing every projected year while the user's cursor is still
 * in the box. `'-'` and `'3.'` are the same problem mid-keystroke.
 *
 * So `text` is whatever is in the field, and `value` only advances when the field
 * parses to a real number — leaving the table steady until the entry means
 * something. `outOfRange` is the twin case for a NUMBER that parses fine but is
 * not a plausible assessed-value growth rate (e.g. -150, meant as -1.5% and
 * mistyped) — see MIN_GROWTH_PCT/MAX_GROWTH_PCT below.
 */
interface PctOverride {
  text: string;
  value: number;
  outOfRange: boolean;
}

/**
 * Sane bounds for a year-over-year assessed-value growth assumption. -150%
 * growth is not a real input, it's a decimal-point mistake (-1.5% typed as
 * -150) — HTML's `min`/`max` on `type="number"` do not stop that from being
 * typed or pasted, so this range is enforced again here, in the change
 * handler, where a violation can be surfaced as a visible message instead of
 * silently clamped. Silently clamping to the boundary would itself be a
 * plausible-but-wrong output: the visitor would see a number and have no way
 * to know it wasn't what they typed.
 */
const MIN_GROWTH_PCT = -20;
const MAX_GROWTH_PCT = 20;

/**
 * Keep the typed text; advance the committed rate only on a parseable,
 * in-range entry. An out-of-range entry is treated the same as an
 * unparseable one for the committed rate (frozen at the last real value) but
 * is flagged distinctly so the caller can show why nothing moved.
 */
const nextOverride = (raw: string, previous: PctOverride | null, fallback: number): PctOverride => {
  const n = Number(raw);
  const parseable = raw.trim() !== '' && Number.isFinite(n);
  const outOfRange = parseable && (n < MIN_GROWTH_PCT || n > MAX_GROWTH_PCT);
  const advance = parseable && !outOfRange;
  return { text: raw, value: advance ? n : previous?.value ?? fallback, outOfRange };
};

/**
 * Year-by-year view of the referendum line across a district's published
 * multi-year schedule (lib/tax/projection.ts). Renders nothing when the
 * district hasn't published one.
 *
 * `projectionStats`'s four headline statistics are computed from operating
 * tax ONLY — the referendum debt rate is levied through `debtEndYear`
 * regardless of how this ballot question goes, so it isn't a consequence of
 * the vote and is deliberately excluded from those four numbers. To keep
 * that distinction visible instead of implicit, this component:
 *   1. renders a distinct operating-only column in the table (not just a
 *      combined monthly total), so a reader can check the stats against the
 *      exact series they come from;
 *   2. labels all four statistics "(operating tax only)"; and
 *   3. states plainly, next to the debt columns, why debt is excluded.
 * Item 4 (a regression test asserting this labelling stays put) lives in
 * Projection.test.tsx.
 */
export function Projection({ buckets, config }: Props) {
  const projection = config.referendum.projection;
  const districtGrowth = projection?.avGrowth.value;

  const [firstYear, setFirstYear] = useState<PctOverride | null>(null);
  const [laterYears, setLaterYears] = useState<PctOverride | null>(null);
  const modified = firstYear !== null || laterYears !== null;

  const growth = useMemo(() => {
    if (!districtGrowth || !modified) return undefined;
    const years = Object.keys(districtGrowth).map(Number).sort((a, b) => a - b);
    const out: Record<number, number> = {};
    years.forEach((y, i) => {
      const override = i === 0 ? firstYear : laterYears;
      out[y] = override === null ? districtGrowth[y] : override.value / 100;
    });
    return out;
  }, [districtGrowth, modified, firstYear, laterYears]);

  const rows = useMemo(
    () => projectReferendumLine(buckets, config, growth ? { avGrowth: growth } : {}),
    [buckets, config, growth],
  );

  // A projection needs a base year plus at least one projected year to mean
  // anything; districtGrowth is re-checked here (not just above) so it can
  // narrow the type for the reads below.
  if (!projection || !districtGrowth || rows.length < 2) return null;

  const stats = projectionStats(rows);
  const base = rows[0];
  const firstProjectedYear = rows[1].year;
  const laterYear = rows[2]?.year ?? firstProjectedYear;
  const finalYear = rows[rows.length - 1].year;
  const firstYearDefault = pct1(districtGrowth[firstProjectedYear]);
  const laterYearsDefault = pct1(districtGrowth[laterYear]);
  const debtEndYear = config.referendum.debtEndYear?.value;
  const debtEndLabel = debtEndYear ?? 'its final levy year';

  return (
    <section
      aria-labelledby="projection-heading"
      className="space-y-4 rounded-md border border-border bg-surface p-4"
    >
      <div>
        <h2 id="projection-heading" className="font-medium">
          The referendum line, {firstProjectedYear}&ndash;{finalYear}
        </h2>
        <p className="mt-1 text-sm">
          Rates are {config.name}&rsquo;s published schedule. Assessed-value growth defaults to the{' '}
          <strong>district&#39;s assumption</strong> of {firstYearDefault.toFixed(1)}% for{' '}
          {firstProjectedYear} and {laterYearsDefault.toFixed(1)}% each year after that.{' '}
          <a className="text-accent underline" href={projection.avGrowth.source}>Source</a>.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="block">
          Growth in {firstProjectedYear} (%)
          <input
            type="number"
            step="0.1"
            min={MIN_GROWTH_PCT}
            max={MAX_GROWTH_PCT}
            className="mt-1 block w-24 rounded-md border border-border bg-surface p-2"
            value={firstYear?.text ?? String(firstYearDefault)}
            onChange={(e) => setFirstYear((prev) => nextOverride(e.target.value, prev, firstYearDefault))}
          />
        </label>
        <label className="block">
          Growth after {firstProjectedYear} (%)
          <input
            type="number"
            step="0.1"
            min={MIN_GROWTH_PCT}
            max={MAX_GROWTH_PCT}
            className="mt-1 block w-24 rounded-md border border-border bg-surface p-2"
            value={laterYears?.text ?? String(laterYearsDefault)}
            onChange={(e) => setLaterYears((prev) => nextOverride(e.target.value, prev, laterYearsDefault))}
          />
        </label>
        {(firstYear?.outOfRange || laterYears?.outOfRange) && (
          <p role="alert" className="w-full text-sm text-warning-fg">
            Enter a growth rate between {MIN_GROWTH_PCT}% and {MAX_GROWTH_PCT}% — the projection
            below still uses the last valid rate.
          </p>
        )}
        {modified && (
          <button
            type="button"
            className="text-accent underline"
            onClick={() => {
              setFirstYear(null);
              setLaterYears(null);
            }}
          >
            Reset to the district&rsquo;s assumption
          </button>
        )}
      </div>

      <ProjectionChart rows={rows} />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="mb-2 text-left text-xs text-muted">
            Estimated referendum tax by year for the entered assessed value. This is the
            referendum line only, not your whole tax bill. The <strong>operating</strong> columns
            are the referendum-operating-only series the four statistics below are computed from.
            The <strong>debt</strong> columns are shown separately and excluded from those
            statistics, because {config.name}&rsquo;s referendum debt rate is levied through{' '}
            {debtEndLabel} regardless of whether this referendum passes. The scenario figures
            above price the assessed value as entered; this table instead applies{' '}
            {config.name}&rsquo;s assessed-value growth assumption, so the {firstProjectedYear}{' '}
            figures differ between the two.
          </caption>
          <thead>
            <tr className="border-b border-border-strong text-left">
              <th scope="col" className="py-1 pr-3">Year</th>
              <th scope="col" className="py-1 pr-3">Gross AV</th>
              <th scope="col" className="py-1 pr-3">Net AV</th>
              <th scope="col" className="py-1 pr-3">Operating rate</th>
              <th scope="col" className="py-1 pr-3">Referendum operating tax/mo<br /><span className="font-normal text-muted">(operating only)</span></th>
              <th scope="col" className="py-1 pr-3">Debt rate</th>
              <th scope="col" className="py-1 pr-3">Debt tax/mo<br /><span className="font-normal text-muted">(excluded from stats)</span></th>
              <th scope="col" className="py-1 pr-3">Total referendum/mo</th>
              <th scope="col" className="py-1">vs {base.year}/mo<br /><span className="font-normal text-muted">(operating only)</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.year} className="border-b border-border">
                <th scope="row" className="py-1 pr-3 text-left font-normal">{r.year}</th>
                <td className="py-1 pr-3 font-mono tabular-nums">{fmtCents(r.grossAV)}</td>
                <td className="py-1 pr-3 font-mono tabular-nums">{fmtCents(r.netAV)}</td>
                <td className="py-1 pr-3 font-mono tabular-nums">{fmtRate(r.operatingRate)}</td>
                <td className="py-1 pr-3 font-mono tabular-nums">{fmtCents(r.operatingTax / 12)}</td>
                <td className="py-1 pr-3 font-mono tabular-nums">
                  {r.debtRate === 0 ? '—' : fmtRate(r.debtRate)}
                </td>
                <td className="py-1 pr-3 font-mono tabular-nums">
                  {r.debtTax === 0 ? '—' : fmtCents(r.debtTax / 12)}
                </td>
                <td className="py-1 pr-3 font-mono tabular-nums">{fmtCents(r.monthly)}</td>
                <td className="py-1 font-mono tabular-nums">
                  {r.year === base.year ? '—' : fmtCents(r.operatingTax / 12 - base.operatingTax / 12)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <p className="text-sm">
          The four figures below describe the <strong>referendum operating tax only</strong>. The
          separate debt rate (shown above) is excluded from them because it stays on the bill
          through {debtEndLabel} regardless of whether this referendum passes.
        </p>
        <ul aria-label="How to read these figures" className="mt-2 space-y-1 text-sm">
          <li>
            <strong>{firstProjectedYear} change (operating tax only):</strong>{' '}
            {fmtCents(stats.firstYearChange)}/month &mdash; next year&rsquo;s operating-only
            monthly amount minus {base.year}&rsquo;s.
          </li>
          <li>
            <strong>Average increase over {base.year} (operating tax only):</strong>{' '}
            {fmtCents(stats.averageIncreaseVsBase)}/month &mdash; the mean, across every projected
            year, of that year&rsquo;s operating-only excess over {base.year}.
          </li>
          <li>
            <strong>{finalYear} increase (operating tax only):</strong>{' '}
            {fmtCents(stats.finalYearIncrease)}/month &mdash; the final year&rsquo;s operating-only
            monthly amount minus {base.year}&rsquo;s.
          </li>
          <li>
            <strong>Average year-over-year step (operating tax only):</strong>{' '}
            {fmtCents(stats.averageYearOverYearStep)}/month &mdash; the mean of the successive
            year-to-year differences in the operating-only monthly amount. Equal to the final
            year&rsquo;s increase, above, divided by {rows.length - 1}.
          </li>
        </ul>
      </div>
    </section>
  );
}
