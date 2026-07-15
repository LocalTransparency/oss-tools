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
          assessed value and are not stored or logged by this site. All tax math runs in your browser.
        </p>
      </section>
    </main>
  );
}
