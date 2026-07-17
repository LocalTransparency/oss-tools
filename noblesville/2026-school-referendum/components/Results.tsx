import type { BillBreakdown, DistrictReferendumConfig, TaxDistrict } from '@/lib/tax/types';
import { buildScenarios, computeAllScenarios } from '@/lib/tax/scenarios';
import { CIRCUIT_BREAKER_RATE, HOMESTEAD_CREDIT } from '@/lib/tax/indiana/assumptions';
import { fmtCents, fmtDelta, fmtDollars } from '@/lib/format';

interface Props {
  config: DistrictReferendumConfig;
  addressLabel: string | null;
  grossAV: number;
  district: TaxDistrict;
  homestead: boolean;
  assessmentYear: number | null;
  propertyReportUrl: string | null;
}

function MathRows({ b, config }: { b: BillBreakdown; config: DistrictReferendumConfig }) {
  const { debt, debtEndYear } = config.referendum;
  const rows: Array<[string, string]> = [
    ['Gross assessed value', fmtCents(b.grossAV)],
    ['− Standard homestead deduction', fmtCents(b.standardDeduction)],
    ['− Supplemental homestead deduction', fmtCents(b.supplementalDeduction)],
    ['= Net assessed value', fmtCents(b.netAV)],
    [`Non-referendum tax (rate ${b.nonReferendumRate.toFixed(4)} per $100)`, fmtCents(b.nonReferendumGross)],
    [`Circuit breaker cap (${CIRCUIT_BREAKER_RATE.value * 100}% of gross AV)`, fmtCents(b.circuitBreakerCap)],
    ['− Circuit breaker credit', fmtCents(b.circuitBreakerCredit)],
    [`− Supplemental homestead credit (${HOMESTEAD_CREDIT.value.rate * 100}%, max $${HOMESTEAD_CREDIT.value.max})`, fmtCents(b.supplementalHomesteadCredit)],
    ['= Non-referendum tax after credits', fmtCents(b.nonReferendumNet)],
    ['+ School referendum operating tax', fmtCents(b.referendumOperatingTax)],
  ];
  if (debt) {
    const through = debtEndYear ? `, through ${debtEndYear.value}` : '';
    rows.push([`+ School referendum debt tax ($${debt.value.toFixed(2)}${through})`, fmtCents(b.referendumDebtTax)]);
  }
  rows.push(['Total estimated bill', fmtCents(b.total)]);
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-b border-border">
            <td className="py-1 pr-4">{label}</td>
            <td className="py-1 text-right font-mono tabular-nums">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Results({
  config, addressLabel, grossAV, district, homestead, assessmentYear, propertyReportUrl,
}: Props) {
  const REFERENDUM = config.referendum;
  const SOURCES = config.sources;
  const SCENARIOS = buildScenarios(config);
  const committed = REFERENDUM.committed2027;
  const r = computeAllScenarios(grossAV, district, config);
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
          County records do not show a homestead deduction for this parcel. This estimate
          assumes an owner-occupied homestead and will not match bills for rentals or second homes.
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
              ? <>at {config.name}&rsquo;s committed 2027 rate (${committed.value.toFixed(2)}); up to {fmtDollars(r.passMax.total)} if the full authorized ${REFERENDUM.proposedMax.value.toFixed(2)} were levied</>
              : <>at the authorized maximum rate (${REFERENDUM.proposedMax.value.toFixed(2)})</>}
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

      <details className="rounded-md border border-border bg-surface p-4">
        <summary className="cursor-pointer font-medium">How this was calculated</summary>
        <div className="mt-4 space-y-6">
          {([r.current, r.passCommitted, r.passMax, r.fail] as const).map((b) => (
            <div key={b.scenario}>
              <h3 className="mb-2 font-medium">{SCENARIOS[b.scenario].label}</h3>
              <MathRows b={b} config={config} />
            </div>
          ))}
          <div className="text-xs text-muted space-y-1">
            <p>
              These figures come from the {config.name} referendum determination and the district&rsquo;s
              published rates and commitments.
            </p>
            {committed && (
              <p>
                The ${committed.value.toFixed(2)} figure is the district&rsquo;s public commitment for 2027 only — it is not legally
                binding, and later years may be set higher, up to the authorized ${REFERENDUM.proposedMax.value.toFixed(2)}.{' '}
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
