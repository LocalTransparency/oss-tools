import { DEDUCTIONS, HOMESTEAD_CREDIT, SOURCES as STATE_SOURCES } from '@/lib/tax/indiana/assumptions';
import { DISTRICTS } from '@/lib/tax/indiana/districts';
import { NOBLESVILLE } from '@/lib/tax/indiana/districts/noblesville';
import Link from 'next/link';

export const metadata = { title: 'Methodology — Referendum Tax Estimator' };

// Shared source URLs are identical across the Hamilton districts; read them off one config.
const SHARED = NOBLESVILLE.sources;

export default function Methodology() {
  const standard2026 = DEDUCTIONS[2026].value.standard.toLocaleString('en-US');
  const supp2026 = DEDUCTIONS[2026].value.supplementalRate * 100;
  const standard2027 = DEDUCTIONS[2027].value.standard.toLocaleString('en-US');
  const supp2027 = DEDUCTIONS[2027].value.supplementalRate * 100;
  const creditRate = HOMESTEAD_CREDIT.value.rate * 100;
  const creditMax = HOMESTEAD_CREDIT.value.max;

  // Noblesville is used as a labeled worked example where concrete numbers help.
  const nobRef = NOBLESVILLE.referendum;
  const nobMax = nobRef.proposedMax.value.toFixed(2);
  const nobCurrent = nobRef.currentOperating!.value.toFixed(2);
  const nobCommitted = nobRef.committed2027!.value.toFixed(2);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">How these estimates work</h1>
      <p><Link className="text-accent underline" href="/">← Back to the calculator</Link></p>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">What&rsquo;s on the ballot</h2>
        <p className="text-sm">
          Each Hamilton County school district this tool covers has an <em>operating</em> referendum on the
          November 3, 2026 ballot. Each authorizes a rate of up to a district-specific maximum, per $100 of
          net assessed value, for up to 8 years (pay-2027 through 2034), replacing that district&rsquo;s current
          operating referendum. The specifics differ by district:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>
            Some districts also levy a <strong>separate referendum debt rate</strong> that continues regardless
            of this vote (Noblesville, Hamilton Southeastern, Westfield Washington). For them, &ldquo;fails&rdquo;
            does <em>not</em> mean zero referendum tax — the debt line stays.
          </li>
          <li>
            <strong>Carmel Clay</strong> is different: its 2026 question repeals and replaces <em>both</em> of its
            current referendums — the operating rate and a school-safety rate — with a single new operating rate.
            If it fails, both current rates end.
          </li>
          <li>
            <strong>Sheridan</strong> has no separate debt or safety component, so its whole current referendum is
            what&rsquo;s up for renewal.
          </li>
        </ul>
        <p className="text-sm">
          The exact rates, maximum levy, and ballot language for your district come from its DLGF determination —
          the same document the results panel links to (see <a className="text-accent underline" href="#sources">Sources</a> below).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Why the &ldquo;if it passes&rdquo; figure sometimes shows two rates</h2>
        <p className="text-sm">
          Every ballot authorizes a <em>maximum</em> rate, and a district&rsquo;s board sets the actual rate each
          year within that ceiling. When a district has <em>publicly committed</em> to a specific first-year rate
          below its maximum, we show the bill at both the committed rate and the authorized maximum, so you see
          both the plan and the ceiling. When a district has not published a fixed first-year rate (its board will
          set it annually), we show the authorized maximum only.
        </p>
        <p className="text-sm">
          For example, Noblesville Schools authorizes up to ${nobMax} but has publicly committed to ${nobCommitted}
          {' '}for 2027 (replacing its current ${nobCurrent} operating rate){' '}
          <a className="text-accent underline" href={nobRef.committed2027!.source}>(source)</a>, so both figures are
          shown for Noblesville addresses.
        </p>
      </section>

      {/*
        FAQ crossover thresholds below (Noblesville City taxing district, total rate 2.5549%,
        non-referendum rate 2.1049% = 2.5549% − 0.45% current referendum total) are a labeled,
        district-specific worked example — derived, not computed at runtime, kept as literals with
        the derivation cited here so they can be checked against the engine (see the guard tests in
        lib/tax/scenarios.test.ts):
          - $333k cap-binding threshold: circuit breaker binds when non-referendum tax on pay-2027 net
            AV exceeds the 1% cap on gross AV:
              2.1049% × 0.54 × (AV − 40000) > 1% × AV  →  AV ≈ $333,000
          - $440k pass-vs-current crossover: referendum tax at the committed 2027 rate on pay-2027 net
            AV equals referendum tax at the current rate on pay-2026 net AV:
              0.41% × 0.54 × (AV − 40000) = 0.37% × 0.60 × (AV − 48000)  →  AV ≈ $440,000
      */}
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Why might my estimate go <em>down</em> if it passes?</h2>
        <p className="text-sm">
          For many higher-value owner-occupied homes, the estimate with the referendum passing can be slightly
          <em> lower</em> than the current bill. That isn&rsquo;t an error — it&rsquo;s how the 2025 property tax
          law interacts with the referendum rate:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>
            Above a certain assessed value, the 1% constitutional cap already limits the non-referendum part of
            the bill, so that part is the same whether the referendum passes or fails.
          </li>
          <li>
            What changes is the referendum line: today&rsquo;s operating rate applies to this year&rsquo;s net
            assessed value; the proposed rate would apply to next year&rsquo;s net assessed value, which the 2025
            law makes substantially smaller — and the reduction is proportionally larger for higher-value homes.
          </li>
          <li>
            Above a district-specific threshold, the shrinking net assessed value can outweigh the rate change, so
            the estimated bill dips slightly below today&rsquo;s.
          </li>
        </ul>
        <p className="text-sm">
          The exact crossover depends on the district and taxing-district rate. As a worked example, in
          Noblesville City&rsquo;s taxing district (at Noblesville&rsquo;s committed ${nobCommitted} rate) the 1% cap
          already binds above roughly $333,000 of assessed value, and the estimate dips below today&rsquo;s above
          about $440,000. At a district&rsquo;s authorized <em>maximum</em>, the estimate generally increases at
          every value — which is why, when a commitment exists, both figures are shown.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">The 2025 property tax law (SEA 1)</h2>
        <p className="text-sm">
          Indiana&rsquo;s 2025 reform changes homestead deductions each year: for taxes paid in 2026 your
          home&rsquo;s assessed value is reduced by ${standard2026} and then by {supp2026}% of the remainder; for taxes
          paid in 2027 it&rsquo;s ${standard2027} and {supp2027}%. It also adds a credit of {creditRate}% of your bill (up to ${creditMax})
          that excludes referendum taxes. Because referendum rates apply to that shrinking net assessed value, a
          given maximum rate raises fewer dollars per home in 2027 than it would have in 2026 — which is the
          districts&rsquo; stated reason a replacement maximum is set higher than the expiring rate.{' '}
          <a className="text-accent underline" href={STATE_SOURCES.sea1Memo}>DLGF guidance memo</a>
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Estimates, not bills</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>2027 non-referendum rates are not certified until January 2027; we hold them at certified 2026 levels (<a className="text-accent underline" href={SHARED.budgetOrder2026}>2026 budget order</a>).</li>
          <li>Assessed values come from Hamilton County&rsquo;s public parcel data at lookup time and reflect the most recent assessment.</li>
          <li>This tool models owner-occupied homesteads only (1% cap class). Rentals, farms, and businesses follow different rules.</li>
          <li>Other deductions some households have (mortgage age 65+, veteran, etc.) are not modeled and would lower all columns.</li>
        </ul>
      </section>

      <section id="sources" className="space-y-2 scroll-mt-4">
        <h2 className="text-lg font-medium">Sources</h2>
        <p className="text-sm">Every figure is traced to a primary source. Per-district ballot terms:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {Object.values(DISTRICTS).map((d) => (
            <li key={d.id}>
              {d.name} — <a className="text-accent underline" href={d.referendum.proposedMax.source}>DLGF determination</a>
              {d.sources.districtReferendumPage && (
                <> · <a className="text-accent underline" href={d.sources.districtReferendumPage}>district page</a></>
              )}
            </li>
          ))}
        </ul>
        <p className="text-sm">
          Shared: <a className="text-accent underline" href={SHARED.countyRateSheet2026}>Hamilton County 2026 rate sheet</a>
          {' '}(current referendum rates &amp; certified totals) ·{' '}
          <a className="text-accent underline" href={SHARED.budgetOrder2026}>2026 budget order</a> ·{' '}
          <a className="text-accent underline" href={STATE_SOURCES.sea1Memo}>SEA 1 (2025) deductions/credits memo</a> ·{' '}
          <a className="text-accent underline" href="https://www.in.gov/dlgf/referendum-information/">DLGF referendum index</a>
        </p>
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
