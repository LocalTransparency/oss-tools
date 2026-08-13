import type { ReactNode } from 'react';
import type { AvBuckets, BillBreakdown, DistrictReferendumConfig, TaxDistrict } from '@/lib/tax/types';
import { buildScenarios, computeAllScenarios } from '@/lib/tax/scenarios';
import { presentCapClasses } from '@/lib/tax/engine';
import { CAP2_AV_DEDUCTION, CIRCUIT_BREAKER_RATES, HOMESTEAD_CREDIT } from '@/lib/tax/indiana/assumptions';
import { fmtCents, fmtDelta, fmtDollars, fmtRate } from '@/lib/format';
import { Projection } from './Projection';
import { ProjectionErrorBoundary } from './ProjectionErrorBoundary';

interface Props {
  config: DistrictReferendumConfig;
  addressLabel: string | null;
  buckets: AvBuckets;
  district: TaxDistrict;
  homestead: boolean;
  assessmentYear: number | null;
  propertyReportUrl: string | null;
}

/**
 * With per-class caps, a parcel holding value in more than one constitutional
 * class has a blended cap that no single percentage describes. Name the rate
 * only when exactly one class carries gross AV; otherwise describe it as a
 * blend across the classes present.
 */
export function circuitBreakerCapLabel(buckets: AvBuckets): string {
  const present = presentCapClasses(buckets);
  if (present.length <= 1) {
    const cls = present[0] ?? 1;
    return `Circuit breaker cap (${CIRCUIT_BREAKER_RATES.value[cls] * 100}% of gross AV)`;
  }
  const pct = present.map((c) => `${CIRCUIT_BREAKER_RATES.value[c] * 100}%`).join('/');
  return `Circuit breaker cap (blended ${pct} by property class)`;
}

/** Exact visible text of the Cap 2 deduction row's label, minus any status badge — held as a constant so the row and its tests can't drift apart. */
export const CAP2_DEDUCTION_LABEL = '− Cap 2 deduction (SEA 1 phase-in)';

function MathRows({ b, buckets, config }: { b: BillBreakdown; buckets: AvBuckets; config: DistrictReferendumConfig }) {
  const { debt, debtEndYear } = config.referendum;
  // CAP2_AV_DEDUCTION is `estimated`, not `confirmed` (see
  // lib/tax/indiana/assumptions.ts) — it must never render as a settled
  // figure among the confirmed rows around it. Read the status/source off
  // the config itself, not a hardcoded label, so this self-corrects if the
  // status is ever promoted to `confirmed`.
  const cap2Badge = CAP2_AV_DEDUCTION.status !== 'confirmed' ? (
    <a
      href={CAP2_AV_DEDUCTION.source}
      className="ml-1 rounded border border-warning-border bg-warning-bg px-1 align-middle text-[10px] font-normal text-warning-fg no-underline"
    >
      {CAP2_AV_DEDUCTION.status}
    </a>
  ) : null;
  const rows: Array<[string, ReactNode, string]> = [
    ['gross', 'Gross assessed value', fmtCents(b.grossAV)],
    ['std', '− Standard homestead deduction', fmtCents(b.standardDeduction)],
    ['suppl', '− Supplemental homestead deduction', fmtCents(b.supplementalDeduction)],
    ['cap2', <>{CAP2_DEDUCTION_LABEL}{cap2Badge && <> {cap2Badge}</>}</>, fmtCents(b.cap2Deduction)],
    ['net', '= Net assessed value', fmtCents(b.netAV)],
    ['nonref', `Non-referendum tax (rate ${b.nonReferendumRate.toFixed(4)} per $100)`, fmtCents(b.nonReferendumGross)],
    ['cbcap', circuitBreakerCapLabel(buckets), fmtCents(b.circuitBreakerCap)],
    ['cbcredit', '− Circuit breaker credit', fmtCents(b.circuitBreakerCredit)],
    ['homecredit', `− Supplemental homestead credit (${HOMESTEAD_CREDIT.value.rate * 100}%, max $${HOMESTEAD_CREDIT.value.max})`, fmtCents(b.supplementalHomesteadCredit)],
    ['netaftercredits', '= Non-referendum tax after credits', fmtCents(b.nonReferendumNet)],
    ['refop', '+ School referendum operating tax', fmtCents(b.referendumOperatingTax)],
  ];
  if (debt) {
    const through = debtEndYear ? `, through ${debtEndYear.value}` : '';
    rows.push(['refdebt', `+ School referendum debt tax ($${fmtRate(debt.value)}${through})`, fmtCents(b.referendumDebtTax)]);
  }
  rows.push(['total', 'Total estimated bill', fmtCents(b.total)]);
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([key, label, value]) => (
          <tr key={key} className="border-b border-border">
            <td className="py-1 pr-4">{label}</td>
            <td className="py-1 text-right font-mono tabular-nums">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Results({
  config, addressLabel, buckets, district, homestead, assessmentYear, propertyReportUrl,
}: Props) {
  const REFERENDUM = config.referendum;
  const SOURCES = config.sources;
  const SCENARIOS = buildScenarios(config);
  const committed = REFERENDUM.committed2027;
  const r = computeAllScenarios(buckets, district, config);
  const passVsFail = r.passCommitted.total - r.fail.total;
  const passVsFailMax = r.passMax.total - r.fail.total;

  return (
    <section aria-label="Estimated property tax comparison" className="space-y-6">
      <header className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">
          {addressLabel
            ? `Estimated property taxes for ${addressLabel} — ${config.name}`
            : `Estimated property taxes — ${config.name}`}
        </h2>
        <p className="mt-1 text-xs text-muted">
          These figures are specific to the {config.name} district ({config.county} County). An address in
          a different district would see different rates and a different result.
        </p>
      </header>

      {REFERENDUM.explainer && (
        <div className="rounded-md border border-border bg-surface-2 p-4 text-sm">
          <h3 className="mb-1 font-medium">What this referendum does</h3>
          <p>
            {REFERENDUM.explainer}{' '}
            <a className="text-accent underline" href={REFERENDUM.proposedMax.source}>
              Read the DLGF determination
            </a>.
          </p>
        </div>
      )}

      {!homestead && (
        <p className="rounded-md border border-warning-border bg-warning-bg p-3 text-sm text-warning-fg">
          County records do not show a homestead deduction for this parcel, so its cap class
          was inferred from county parcel attributes rather than a homestead flag. A parcel&rsquo;s
          value can span more than one class — check the split in the panel above and adjust it
          if it doesn&rsquo;t match your own records.
        </p>
      )}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <li className="rounded-md border border-border bg-surface p-4">
          <div className="font-medium">Current<br /><span className="font-normal text-xs text-muted">pay-2026</span></div>
          <p className="mt-2 text-xs text-muted">Estimated annual bill</p>
          <div className="text-lg font-mono tabular-nums">{fmtDollars(r.current.total)}</div>
          <p className="mt-2 text-xs text-muted">Change vs. current bill</p>
          <div className="font-mono tabular-nums">—</div>
        </li>
        <li className="rounded-md border border-border bg-surface p-4">
          <div className="font-medium">If it passes<br /><span className="font-normal text-xs text-muted">pay-2027 est.</span></div>
          <p className="mt-2 text-xs text-muted">Estimated annual bill</p>
          <div className="text-lg font-mono tabular-nums">{fmtDollars(r.passCommitted.total)}</div>
          <div className="mt-1 text-xs text-muted">
            {committed
              ? <>at {config.name}&rsquo;s committed 2027 rate (${fmtRate(committed.value)}); up to {fmtDollars(r.passMax.total)} if the full authorized ${fmtRate(REFERENDUM.proposedMax.value)} were levied</>
              : <>at the authorized maximum rate (${fmtRate(REFERENDUM.proposedMax.value)})</>}
          </div>
          <p className="mt-2 text-xs text-muted">Change vs. current bill</p>
          <div className="font-mono tabular-nums">{fmtDelta(r.passCommitted.total - r.current.total)}/yr</div>
        </li>
        <li className="rounded-md border border-border bg-surface p-4">
          <div className="font-medium">If it fails<br /><span className="font-normal text-xs text-muted">pay-2027 est.</span></div>
          <p className="mt-2 text-xs text-muted">Estimated annual bill</p>
          <div className="text-lg font-mono tabular-nums">{fmtDollars(r.fail.total)}</div>
          <p className="mt-2 text-xs text-muted">Change vs. current bill</p>
          <div className="font-mono tabular-nums">{fmtDelta(r.fail.total - r.current.total)}/yr</div>
        </li>
      </ul>

      <div className="rounded-md border border-border bg-surface p-4">
        <h2 className="font-medium">Difference between {config.name} passing and failing</h2>
        <p className="mt-1 tabular-nums">
          {committed
            ? <><span className="text-lg font-mono">{fmtDelta(passVsFail)}/yr</span>{' '}({fmtCents(passVsFail / 12)}/mo) at the committed 2027 rate;{' '}{fmtDelta(passVsFailMax)}/yr ({fmtCents(passVsFailMax / 12)}/mo) at the authorized maximum.</>
            : <><span className="text-lg font-mono">{fmtDelta(passVsFailMax)}/yr</span>{' '}({fmtCents(passVsFailMax / 12)}/mo) at the authorized maximum rate.</>}
        </p>
      </div>

      {/* projectReferendumLine throws for a schedule year outside the
          DEDUCTIONS/CAP2_AV_DEDUCTION tables (see lib/tax/projection.ts).
          The scenario cards above are what a voter most needs and must keep
          rendering even if a routine data edit to a district's operatingRates
          breaks this panel — see ProjectionErrorBoundary's doc. */}
      <ProjectionErrorBoundary>
        <Projection buckets={buckets} config={config} />
      </ProjectionErrorBoundary>

      <details className="rounded-md border border-border bg-surface p-4">
        <summary className="cursor-pointer font-medium">How this was calculated</summary>
        <div className="mt-4 space-y-6">
          {([r.current, r.passCommitted, r.passMax, r.fail] as const).map((b) => (
            <div key={b.scenario}>
              <h3 className="mb-2 font-medium">{SCENARIOS[b.scenario].label}</h3>
              <MathRows b={b} buckets={buckets} config={config} />
            </div>
          ))}
          <div className="text-xs text-muted space-y-1">
            <p>
              These figures come from the {config.name} referendum determination and the district&rsquo;s
              published rates and commitments.
            </p>
            {committed && (
              <p>
                The ${fmtRate(committed.value)} figure is the district&rsquo;s public commitment for 2027 only — it is not legally
                binding, and later years may be set higher, up to the authorized ${fmtRate(REFERENDUM.proposedMax.value)}.{' '}
                <a className="text-accent underline" href={committed.source}>Source</a>.
              </p>
            )}
            <p>
              Pay-2027 non-referendum rates are not certified until January 2027; this estimate holds them
              at certified pay-2026 levels.
              {SOURCES.budgetOrder2026 ? <> <a className="text-accent underline" href={SOURCES.budgetOrder2026}>2026 budget order</a>.</> : null}
            </p>
            {assessmentYear != null && (
              <p>
                County gross assessed value is from the {assessmentYear} assessment. The &ldquo;current&rdquo;
                column applies pay-2026 rules to that value, so it may differ slightly from your actual 2026 bill.
              </p>
            )}
            {propertyReportUrl && (
              <p><a className="text-accent underline" href={propertyReportUrl}>Official county property report for this parcel</a></p>
            )}
          </div>
        </div>
      </details>
    </section>
  );
}
