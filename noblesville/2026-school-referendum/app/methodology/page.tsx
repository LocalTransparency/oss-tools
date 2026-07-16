import { DEDUCTIONS, HOMESTEAD_CREDIT, REFERENDUM, REFERENDUM_DEBT_END_YEAR, SOURCES } from '@/lib/tax/assumptions';
import Link from 'next/link';

export const metadata = { title: 'Methodology — Noblesville Referendum Tax Estimator' };

export default function Methodology() {
  const proposedMax = REFERENDUM.proposedMax.value.toFixed(2);
  const proposedMaxCents = Math.round(REFERENDUM.proposedMax.value * 100);
  const currentOperating = REFERENDUM.currentOperating.value.toFixed(2);
  const currentOperatingCents = Math.round(REFERENDUM.currentOperating.value * 100);
  const debt = REFERENDUM.debt.value.toFixed(2);
  const debtEndYear = REFERENDUM_DEBT_END_YEAR.value;
  const committed2027 = REFERENDUM.committed2027.value.toFixed(2);
  const standard2026 = DEDUCTIONS[2026].value.standard.toLocaleString('en-US');
  const supp2026 = DEDUCTIONS[2026].value.supplementalRate * 100;
  const standard2027 = DEDUCTIONS[2027].value.standard.toLocaleString('en-US');
  const supp2027 = DEDUCTIONS[2027].value.supplementalRate * 100;
  const creditRate = HOMESTEAD_CREDIT.value.rate * 100;
  const creditMax = HOMESTEAD_CREDIT.value.max;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">How these estimates work</h1>
      <p><Link className="underline" href="/">← Back to the calculator</Link></p>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">What&rsquo;s on the ballot</h2>
        <p className="text-sm">
          Noblesville Schools has an operating referendum on the November 3, 2026 ballot. It authorizes a
          rate of up to ${proposedMax} per $100 of net assessed value for up to 8 years, replacing the 2018
          operating referendum (${currentOperating}), which expires after 2026. A separate ${debt} referendum debt rate,
          approved in 2010, continues through {debtEndYear} <em>regardless of this vote</em> — so &ldquo;fails&rdquo;
          does not mean zero referendum tax.{' '}
          <a className="underline" href={SOURCES.dlgfDetermination}>DLGF determination</a> ·{' '}
          <a className="underline" href={SOURCES.districtReferendumPage}>district referendum page</a>
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Why we show two &ldquo;passes&rdquo; numbers</h2>
        <p className="text-sm">
          The ballot authorizes up to ${proposedMax}. The district has publicly committed to set a rate no higher
          than ${committed2027} for 2027 (and says it will not use the full ${proposedMax} in all eight years), but that
          commitment is not legally binding and later years may be higher. We show the bill at ${committed2027} and
          at ${proposedMax} so you can see both the plan and the ceiling.{' '}
          <a className="underline" href={REFERENDUM.committed2027.source}>Source</a>
        </p>
        <p className="text-sm">
          This is also why you may have seen two very different cost figures: the ballot&rsquo;s
          statutorily-required &ldquo;$955 per year for a median $350,000 residence&rdquo; is computed at
          the ${proposedMax}{' '}maximum, while the district&rsquo;s &ldquo;$2.30 more per month&rdquo; framing reflects
          its below-maximum rate plan. Both are arithmetic from the same law — at different rates.
        </p>
      </section>

      {/*
        FAQ crossover thresholds below (Noblesville City taxing district, total rate 2.5549%,
        non-referendum rate 2.1049% = 2.5549% − 0.45% current referendum total) are derived, not
        computed at runtime — kept as literals with the derivation cited here so they can be checked
        against the engine (see the guard tests in lib/tax/scenarios.test.ts):
          - $333k cap-binding threshold: circuit breaker binds when non-referendum tax on pay-2027 net
            AV exceeds the 1% cap on gross AV:
              2.1049% × 0.54 × (AV − 40000) > 1% × AV  →  AV ≈ $333,000
            (0.54 = 1 − 0.46 pay-2027 supplemental deduction rate; $40,000 = pay-2027 standard deduction)
          - $440k pass-vs-current crossover: referendum tax at the committed 2027 rate on pay-2027 net AV
            equals referendum tax at the current rate on pay-2026 net AV:
              0.41% × 0.54 × (AV − 40000) = 0.37% × 0.60 × (AV − 48000)  →  AV ≈ $440,000
            (0.60 = 1 − 0.40 pay-2026 supplemental deduction rate; $48,000 = pay-2026 standard deduction)
      */}
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Why does my estimate go down if it passes?</h2>
        <p className="text-sm">
          For many higher-value owner-occupied homes, the estimate with the referendum passing (at
          the district&rsquo;s committed ${committed2027} rate) is slightly <em>lower</em> than the current bill.
          That isn&rsquo;t an error — it&rsquo;s how the 2025 property tax law interacts with the two referendum
          rates:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>
            Above roughly $333,000 in assessed value (in Noblesville City&rsquo;s taxing district), the 1%
            constitutional cap already limits the non-referendum part of the bill, so that part is the
            same whether the referendum passes or fails.
          </li>
          <li>
            What changes is the referendum line: today&rsquo;s ${currentOperating} operating rate applies to
            this year&rsquo;s net assessed value; the proposed ${committed2027} would apply to next
            year&rsquo;s net assessed value, which the 2025 law makes substantially smaller — and the
            reduction is proportionally larger for higher-value homes.
          </li>
          <li>
            Above about $440,000 assessed value, the shrinking net assessed value outweighs the higher
            rate, so the estimated bill dips slightly below today&rsquo;s.
          </li>
        </ul>
        <p className="text-sm">
          This applies at the district&rsquo;s committed ${committed2027} rate. At the ballot&rsquo;s authorized
          maximum of ${proposedMax}, the estimate increases for homes at every value — which is why both
          figures are always shown.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">The 2025 property tax law (SEA 1)</h2>
        <p className="text-sm">
          Indiana&rsquo;s 2025 reform changes homestead deductions each year: for taxes paid in 2026 your
          home&rsquo;s assessed value is reduced by ${standard2026} and then by {supp2026}% of the remainder; for taxes
          paid in 2027 it&rsquo;s ${standard2027} and {supp2027}%. It also adds a credit of {creditRate}% of your bill (up to ${creditMax})
          that excludes referendum taxes. Because referendum rates apply to that shrinking net assessed
          value, a {proposedMaxCents}&cent; maximum in 2027 raises fewer dollars per home than it would have in 2026 —
          which is the district&rsquo;s stated reason the replacement maximum is higher than the expiring
          {' '}{currentOperatingCents}&cent; rate. <a className="underline" href={SOURCES.sea1Memo}>DLGF guidance memo</a>
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Estimates, not bills</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>2027 non-referendum rates are not certified until January 2027; we hold them at certified 2026 levels (<a className="underline" href={SOURCES.budgetOrder2026}>2026 budget order</a>).</li>
          <li>Assessed values come from Hamilton County&rsquo;s public parcel data at lookup time and reflect the most recent assessment.</li>
          <li>This tool models owner-occupied homesteads only (1% cap class). Rentals, farms, and businesses follow different rules.</li>
          <li>Other deductions some households have (mortgage age 65+, veteran, etc.) are not modeled and would lower all three columns.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Privacy</h2>
        <p className="text-sm">
          Addresses you enter are forwarded to Hamilton County&rsquo;s public parcel service to find your
          assessed value. They are never stored, logged, or sent to analytics. County responses are
          cached in memory for up to ten minutes to reduce load during busy periods — never written to
          disk or logs. We collect basic anonymous usage statistics (page views) via Google Tag Manager;
          nothing you type into this site is included. All tax math runs in your browser.
        </p>
      </section>
    </main>
  );
}
