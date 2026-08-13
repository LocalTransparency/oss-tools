# This tool vs. the district's calculator

Five real Hamilton County parcels, chosen to cover the profiles that exercise
different parts of the engine — a plain homesteaded parcel, a homesteaded
parcel over one acre (where Indiana's cap-class split cannot be fully
resolved from public data), a non-homestead residential parcel, a parcel
whose county homestead code is unconfirmed, and a commercial parcel — run
through this tool and through a verbatim transcription of Noblesville
Schools' published calculator
(`lib/tax/districtCalculator.fixture.ts`). All figures use 2026 assessed
values from Hamilton County's public parcel feed. **Parcels are identified
by parcel number only; no addresses appear in this document or anywhere in
this tool's output**, consistent with the tool's privacy posture (nothing a
visitor enters is stored).

District calculator retrieved 2026-08-12 from
<https://noblesvilleschoolsorg.finalsite.com/uploaded/NoblesvilleSchools_ReferendumCalculator.html>.

## Scope difference, stated once

The district's calculator computes the **referendum line only**
(`net AV × rate ÷ 100`) — no non-referendum rate, no circuit breaker, no
homestead credit. This tool computes that same line *and* the full tax
bill, including non-referendum rates, the circuit breaker, and the
supplemental homestead credit. The comparison table below is therefore
restricted to the referendum operating line — the only figure both models
produce — and full-bill figures are broken out separately, below, as
context this tool alone provides.

## Method

For each parcel, `PROPCLASS`, `hmstd_code`, and `AVTAXYR` were run through
this tool's own cap-class inference (`inferCapClass`, `lib/tax/indiana/capClass.ts`) —
the same inference the live tool applies to a real address lookup, before
any manual override — to get the same `AvBuckets` split a real visitor
would see by default. Those buckets were run through both
`projectReferendumLine` (this tool) and `districtCalculatorAnnual` (the
district's transcribed formula) for pay year 2027, and separately through
`computeAllScenarios` for this tool's full four-scenario bill. `TAXDISTNAM`
was resolved to a certified tax district via `findDistrict` for the
non-referendum rate used in the full-bill figures.

## Comparison table — 2027 referendum operating line

| Parcel | Class | Homestead | Gross AV | Inferred cap | 2027 line (this tool) | 2027 line (district) | Δ |
|---|---|---|---|---|---|---|---|
| `1007300306018000` | 510 | 1 (active) | $403,500 | 1 — Homestead | $800.18 | $800.18 | $0.00 |
| `1006150000004009` | 511, 5.68 ac | 1 (active) | $797,200 | 1 — Homestead | $1,662.06 | $1,662.06 | $0.00 |
| `1006150000004000` | 510 | 0 (none) | $1,331,000 | 2 — Non-homestead res./ag | $4,748.43 | $4,748.43 | $0.00 |
| `1110160000007101` | 511, 1.45 ac | -1 (unconfirmed) | $336,500 | 2 — Non-homestead res./ag (fallback) | $1,200.49 | $1,200.49 | $0.00 |
| `1111060000014201` | 425, 6.55 ac | 0 (none) | $4,662,200 | 3 — Other (commercial) | $18,900.79 | $18,900.79 | $0.00 |

*"2027 line" is the operating-referendum tax only (excludes the $0.08
referendum debt rate, which the district's calculator does not model — see
"Why any row differs" below). Both figures apply the district's published
5.3% (2027) AV-growth assumption to the 2026 base and the pay-2027 SEA 1
deduction schedule ($40,000 standard / 46% supplemental).*

## Why any row differs

**It doesn't, for any of these five parcels — by design, not by accident.**
Both models compute net AV from the identical inputs (the same grown AV,
the same standard/supplemental/Cap 2 deduction schedule) and multiply by
the identical rate, so the operating line agrees to the cent whenever the
inputs are identical. This is verified generally, not just for these five
parcels, in `lib/tax/districtCalculator.test.ts`, which checks six
synthetic cases (homestead, non-homestead, commercial, and mixed) to the
same $0.01 tolerance.

Two mechanisms exist in this engine that *could* diverge from the
district's model, documented in that same test file, but none of the five
parcels above triggers them:

- **75% supplemental-deduction cap** (IC 6-1.1-12-37.5). This engine caps
  the supplemental homestead deduction at 75% of gross AV; the district's
  transcribed formula does not enforce that cap explicitly. No homestead AV
  small enough to hit it appears among Hamilton's real parcels at the
  current 46–66.7% supplemental rates, so this has never been observed to
  produce a difference — it is a defensive floor, not an active divergence.
- **Zero flooring per bucket.** This engine floors each cap-class bucket's
  net AV at zero independently; the district's raw arithmetic can, in
  principle, go negative before the rate is applied. Both models agree in
  every case tested because Hamilton homestead AVs are well above the
  deduction schedule's absolute floor.

**The multi-acre homestead parcel (`1006150000004009`, class 511, 5.68
acres) is the split-cap case this tool cannot fully resolve** — see "Scope
difference" above and the full explanation in the Full-bill section below.
Because the county's active homestead code alone drives this tool's
*default* inference, the parcel above was priced with its **entire**
$797,200 AV in cap 1 (1% cap), matching what the district's calculator does
with the same single AV figure — so the two agree here too, but both are
agreeing on an approximation, not on ground truth. See below.

## Full-bill context (this tool only)

Full pay-2027 bills, from `computeAllScenarios`'s `passCommitted` scenario
(committed 2027 operating rate $0.385, referendum debt $0.08, non-referendum
rate held at the certified pay-2026 total and flagged `estimated`):

| Parcel | Non-referendum net | Referendum (op. $0.385 + debt $0.08) | **Total pay-2027 bill** |
|---|---|---|---|
| `1007300306018000` | $3,735.00 | $912.75 | **$4,647.75** |
| `1006150000004009` | $5,401.53 | $1,901.33 | **$7,302.86** |
| `1006150000004000` | $16,332.33 | $5,446.45 | **$21,778.78** |
| `1110160000007101` | $6,233.03 | $1,376.96 | **$7,609.99** |
| `1111060000014201` | $98,134.65 | $21,679.23 | **$119,813.88** |

Two things worth flagging, both intentional behavior rather than defects:

1. **Non-referendum rates are estimated.** They are derived from each tax
   district's certified pay-2026 total rate minus the current referendum
   components, then held flat for pay-2027 — the certified pay-2027
   non-referendum rate will not be public until the county's next budget
   order. `nonReferendumRate` in `BillBreakdown` carries this status.
2. **This four-scenario bill does not apply AV growth; the multi-year
   projection table (`projectReferendumLine`, used in the comparison table
   above) does.** `computeAllScenarios` prices "if it passes" at the same
   entered gross AV as "current" — it changes the rate and the deduction
   schedule year but not the AV itself. That is why, for the same parcel,
   this table's referendum-operating figure is smaller than the
   correspondingly-grown 2027 row in the multi-year projection (e.g.
   `1007300306018000`: $755.72 here vs. $800.18 in the projection table
   above, a difference of the district's assumed 5.3% 2027 AV growth, not a
   discrepancy). Both behaviors are documented at their definitions in
   `lib/tax/scenarios.ts` and `lib/tax/projection.ts`.

**The multi-acre homestead case, in full.** Indiana splits a parcel's
assessed value across cap classes — a homestead on more than one acre is
capped at 1% on the dwelling plus one acre and 2% on the rest. Indiana's
statutory PARCEL file (50 IAC 26-20-4) publishes each parcel's assessed
value broken out by cap class, but **Hamilton County's public parcel
service — the live ArcGIS Open Data feed this tool queries — does not
expose that breakout.** For `1006150000004009` (5.68 acres, active
homestead), this tool's automatic inference therefore treats the full
$797,200 as cap 1, the same simplification the district's own calculator
makes when fed a single AV figure. Both models' agreement on this parcel
reflects that shared simplification, not independent confirmation that it
is correct. A visitor who knows their true cap-1/cap-2 split can enter it
manually via the cap-class panel; doing so will move this tool's bill away
from the district's calculator's number, because the district's published
tool offers no equivalent manual split.

## Indiana DLGF Referendum Impact Calculator (state)

Indiana's DLGF, in partnership with the Indiana Business Research Center at
IU, publishes its own calculator at
<https://gateway.ifionline.org/CalculatorsDLGF/RefCalculator.aspx>
("Indiana Gateway for Government Units"), retrieved 2026-08-12.

**Its methodology, quoted verbatim from the page:**

> \*PLEASE NOTE that in computing this estimated gross tax liability, the
> calculator is using the maximum rate for which the unit is seeking
> approval through the referendum. … The calculator represents the worst
> case scenario for a capital referendum tax rate … For school
> corporations, the operating referendum tax rate is not based on proposed
> debt for capital improvements, but what the school corporation represents
> is necessary to maintain operations in addition to the operations fund
> tax rate.

So where the district's own calculator (and this tool's `passCommitted`
scenario) prices Noblesville's committed **$0.385** 2027 rate, the state's
calculator would price the same parcel at the authorized **$0.57
maximum** — the figure this tool's `passMax` scenario already computes.
Neither the district's tool nor the state's tool shows the other's number
on the same page; this tool's four-scenario view is the only place that
shows both side by side. This tool's `passMax` scenario for the same five
parcels — the figure a maximum-rate methodology like the state's implies,
even though no comparable output could be obtained directly from the state
tool itself (see below) — is:

| Parcel | Referendum tax at $0.57 (`passMax`) | Total bill at $0.57 |
|---|---|---|
| `1007300306018000` | $1,275.88 | $5,010.89 |
| `1006150000004009` | $2,657.77 | $8,059.31 |
| `1006150000004000` | $7,613.32 | $23,945.65 |
| `1110160000007101` | $1,924.78 | $8,157.81 |
| `1111060000014201` | $30,304.30 | $128,438.95 |

The property-type dropdown on the state calculator uses the exact same
three cap classes this tool infers — "Homestead (Owner-occupied residence)"
(0.01 → 1% cap), "Residential Rental, Non-Homestead Residential, and
Agricultural" (0.02 → 2% cap), "Other" (0.03 → 3% cap) — and its own
in-page notice states the identical caveat this tool's methodology page
makes about multi-acre homesteads: *"If the homestead deduction is
selected, this referendum impact calculator assumes that 100% of the
entered assessed value is eligible for the homestead deduction and
credits. Indiana law states that only the value of the primary residence,
plus a maximum of one (1) acre of land, is eligible... Be advised that if
your property contains more than this amount of land, your actual tax bill
will likely be higher than what is estimated here."*

**No comparable output was obtained from the state calculator, and none is
fabricated here.** Two independent obstacles, found while investigating
this:

1. It is an ASP.NET Web Forms page (`__VIEWSTATE`/`__EVENTVALIDATION`
   postback fields; no client-side calculation model). Its referenced
   `../js/ReferendumCalculator.js` returns HTTP 404, and no other script on
   the page performs the computation client-side — the arithmetic runs
   server-side on form postback, so there is no JS model to read or call
   without submitting a real, session-bound form postback.
2. More fundamentally: as retrieved 2026-08-12, the page's county dropdown
   (`ddl_RefCounties`) lists only five counties — Allen, Hendricks, Lake,
   Perry, and Porter. **Hamilton County is not a selectable option**, so
   Noblesville's referendum could not be selected and no figure — matching
   or otherwise — could be produced for it through this tool, independent
   of the scripting issue. (The county list may be populated per active
   referendum cycle by DLGF staff and could change; this reflects only what
   was live at retrieval time.)

The comparison this document can make with confidence is therefore
methodological, not numerical: the state calculator's stated approach (max
authorized rate, single-field homestead assumption, no debt component) maps
directly onto this tool's `passMax` scenario, and the caveats it discloses
about multi-acre homesteads are the same limitation this tool discloses
about its own cap-class inference.
