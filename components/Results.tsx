import type { BillBreakdown, TaxDistrict } from '@/lib/tax/types';
import { computeAllScenarios } from '@/lib/tax/scenarios';
import {
  CIRCUIT_BREAKER_RATE,
  HOMESTEAD_CREDIT,
  REFERENDUM,
  SCENARIOS,
  SOURCES,
} from '@/lib/tax/assumptions';
import { fmtCents, fmtDelta, fmtDollars } from '@/lib/format';

interface Props {
  grossAV: number;
  district: TaxDistrict;
  homestead: boolean;
  assessmentYear: number | null;
  propertyReportUrl: string | null;
}

function MathRows({ b }: { b: BillBreakdown }) {
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
    [`+ School referendum debt tax ($${REFERENDUM.debt.value.toFixed(2)}, through 2032)`, fmtCents(b.referendumDebtTax)],
    ['Total estimated bill', fmtCents(b.total)],
  ];
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-b border-gray-200 dark:border-gray-700">
            <td className="py-1 pr-4">{label}</td>
            <td className="py-1 text-right tabular-nums">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Results({ grossAV, district, homestead, assessmentYear, propertyReportUrl }: Props) {
  const r = computeAllScenarios(grossAV, district);
  const passVsFail = r.passCommitted.total - r.fail.total;
  const passVsFailMax = r.passMax.total - r.fail.total;

  return (
    <section aria-label="Estimated property tax comparison" className="space-y-6">
      {!homestead && (
        <p className="rounded border border-amber-400 bg-amber-50 p-3 text-sm dark:bg-amber-950">
          County records do not show a homestead deduction for this parcel. This estimate
          assumes an owner-occupied homestead and will not match bills for rentals or second homes.
        </p>
      )}

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="p-2 text-left" scope="col">&nbsp;</th>
            <th className="p-2 text-right" scope="col">Current<br /><span className="font-normal text-xs">pay-2026</span></th>
            <th className="p-2 text-right" scope="col">If it passes<br /><span className="font-normal text-xs">pay-2027 est.</span></th>
            <th className="p-2 text-right" scope="col">If it fails<br /><span className="font-normal text-xs">pay-2027 est.</span></th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t">
            <th className="p-2 text-left font-medium" scope="row">Estimated annual bill</th>
            <td className="p-2 text-right text-lg tabular-nums">{fmtDollars(r.current.total)}</td>
            <td className="p-2 text-right">
              <div className="text-lg tabular-nums">{fmtDollars(r.passCommitted.total)}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                at the district&rsquo;s committed 2027 rate (${REFERENDUM.committed2027.value.toFixed(2)}); up to {fmtDollars(r.passMax.total)} if the
                full authorized ${REFERENDUM.proposedMax.value.toFixed(2)} were levied
              </div>
            </td>
            <td className="p-2 text-right text-lg tabular-nums">{fmtDollars(r.fail.total)}</td>
          </tr>
          <tr className="border-t">
            <th className="p-2 text-left font-medium" scope="row">Change vs. current bill</th>
            <td className="p-2 text-right">—</td>
            <td className="p-2 text-right tabular-nums">{fmtDelta(r.passCommitted.total - r.current.total)}/yr</td>
            <td className="p-2 text-right tabular-nums">{fmtDelta(r.fail.total - r.current.total)}/yr</td>
          </tr>
        </tbody>
      </table>

      <div className="rounded border p-4">
        <h2 className="font-medium">Difference between passing and failing</h2>
        <p className="mt-1 tabular-nums">
          <span className="text-lg">{fmtDelta(passVsFail)}/yr</span>{' '}
          ({fmtCents(passVsFail / 12)}/mo) at the committed 2027 rate;{' '}
          {fmtDelta(passVsFailMax)}/yr ({fmtCents(passVsFailMax / 12)}/mo) at the authorized maximum.
        </p>
      </div>

      <details className="rounded border p-4">
        <summary className="cursor-pointer font-medium">How this was calculated</summary>
        <div className="mt-4 space-y-6">
          {([r.current, r.passCommitted, r.passMax, r.fail] as const).map((b) => (
            <div key={b.scenario}>
              <h3 className="mb-2 font-medium">{SCENARIOS[b.scenario].label}</h3>
              <MathRows b={b} />
            </div>
          ))}
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <p>
              The ${REFERENDUM.committed2027.value.toFixed(2)} figure is the district&rsquo;s public commitment for 2027 only — it is not legally
              binding, and later years may be set higher, up to the authorized ${REFERENDUM.proposedMax.value.toFixed(2)}.{' '}
              <a className="underline" href={REFERENDUM.committed2027.source}>Source</a>.
            </p>
            <p>
              Pay-2027 non-referendum rates are not certified until January 2027; this estimate holds them
              at certified pay-2026 levels. <a className="underline" href={SOURCES.budgetOrder2026}>2026 budget order</a>.
            </p>
            {assessmentYear != null && (
              <p>
                County gross assessed value is from the {assessmentYear} assessment. The &ldquo;current&rdquo;
                column applies pay-2026 rules to that value, so it may differ slightly from your actual 2026 bill.
              </p>
            )}
            {propertyReportUrl && (
              <p><a className="underline" href={propertyReportUrl}>Official county property report for this parcel</a></p>
            )}
          </div>
        </div>
      </details>
    </section>
  );
}
