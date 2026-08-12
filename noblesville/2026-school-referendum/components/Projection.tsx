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

// A non-numeric or partial entry (e.g. clearing the field mid-edit) must not
// propagate NaN through every projected year's tax figures.
const parsePct = (raw: string) => {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
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

  const [firstYearPct, setFirstYearPct] = useState<number | null>(null);
  const [laterYearsPct, setLaterYearsPct] = useState<number | null>(null);
  const modified = firstYearPct !== null || laterYearsPct !== null;

  const growth = useMemo(() => {
    if (!districtGrowth || !modified) return undefined;
    const years = Object.keys(districtGrowth).map(Number).sort((a, b) => a - b);
    const out: Record<number, number> = {};
    years.forEach((y, i) => {
      const override = i === 0 ? firstYearPct : laterYearsPct;
      out[y] = override === null ? districtGrowth[y] : override / 100;
    });
    return out;
  }, [districtGrowth, modified, firstYearPct, laterYearsPct]);

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
            className="mt-1 block w-24 rounded-md border border-border bg-surface p-2"
            value={firstYearPct ?? firstYearDefault}
            onChange={(e) => setFirstYearPct(parsePct(e.target.value))}
          />
        </label>
        <label className="block">
          Growth after {firstProjectedYear} (%)
          <input
            type="number"
            step="0.1"
            className="mt-1 block w-24 rounded-md border border-border bg-surface p-2"
            value={laterYearsPct ?? laterYearsDefault}
            onChange={(e) => setLaterYearsPct(parsePct(e.target.value))}
          />
        </label>
        {modified && (
          <button
            type="button"
            className="text-accent underline"
            onClick={() => {
              setFirstYearPct(null);
              setLaterYearsPct(null);
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
