import { REFERENDUM, SOURCES } from '@/lib/tax/assumptions';
import Link from 'next/link';

export const metadata = { title: 'Methodology — Noblesville Referendum Tax Estimator' };

export default function Methodology() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">How these estimates work</h1>
      <p><Link className="underline" href="/">← Back to the calculator</Link></p>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">What&rsquo;s on the ballot</h2>
        <p className="text-sm">
          Noblesville Schools has an operating referendum on the November 3, 2026 ballot. It authorizes a
          rate of up to $0.57 per $100 of net assessed value for up to 8 years, replacing the 2018
          operating referendum ($0.37), which expires after 2026. A separate $0.08 referendum debt rate,
          approved in 2010, continues through 2032 <em>regardless of this vote</em> — so &ldquo;fails&rdquo;
          does not mean zero referendum tax.{' '}
          <a className="underline" href={SOURCES.dlgfDetermination}>DLGF determination</a> ·{' '}
          <a className="underline" href={SOURCES.districtReferendumPage}>district referendum page</a>
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Why we show two &ldquo;passes&rdquo; numbers</h2>
        <p className="text-sm">
          The ballot authorizes up to $0.57. The district has publicly committed to set a rate no higher
          than $0.41 for 2027 (and says it will not use the full $0.57 in all eight years), but that
          commitment is not legally binding and later years may be higher. We show the bill at $0.41 and
          at $0.57 so you can see both the plan and the ceiling.{' '}
          <a className="underline" href={REFERENDUM.committed2027.source}>Source</a>
        </p>
        <p className="text-sm">
          This is also why you may have seen two very different cost figures: the ballot&rsquo;s
          statutorily-required &ldquo;$955 per year for a median $350,000 residence&rdquo; is computed at
          the $0.57 maximum, while the district&rsquo;s &ldquo;$2.30 more per month&rdquo; framing reflects
          its below-maximum rate plan. Both are arithmetic from the same law — at different rates.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">The 2025 property tax law (SEA 1)</h2>
        <p className="text-sm">
          Indiana&rsquo;s 2025 reform changes homestead deductions each year: for taxes paid in 2026 your
          home&rsquo;s assessed value is reduced by $48,000 and then by 40% of the remainder; for taxes
          paid in 2027 it&rsquo;s $40,000 and 46%. It also adds a credit of 10% of your bill (up to $300)
          that excludes referendum taxes. Because referendum rates apply to that shrinking net assessed
          value, a 57&cent; maximum in 2027 raises fewer dollars per home than it would have in 2026 —
          which is the district&rsquo;s stated reason the replacement maximum is higher than the expiring
          37&cent; rate. <a className="underline" href={SOURCES.sea1Memo}>DLGF guidance memo</a>
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
