# Multi-district support — design

**Date:** 2026-07-17
**Status:** Approved
**Scope:** `noblesville/2026-school-referendum/` — `lib/lookup/`, `lib/tax/indiana/`,
`components/`, `app/`
**Depends on:** the statewide-law + per-district config split
(`2026-07-17-indiana-tax-structure-design.md`)

## Goal

Resolve the user's entered address to the correct district's referendum config
automatically (no more hardcoded `NOBLESVILLE`), and clearly communicate that the
numbers shown are specific to that address's school district. Real coverage this
phase: any Hamilton County district that has a `DistrictReferendumConfig` (today,
Noblesville). The lookup widens to all of Hamilton County so neighboring-district
residents get a truthful, named "not yet covered" answer instead of a dead end.

Out of scope (future): additional counties' lookup adapters; building other
districts' referendum data; renaming the tool directory.

## Architecture — two resolution seams

### 1. County lookup seam (`lib/lookup/`)

```
lib/lookup/
  arcgis.ts              # generic, reused: sanitizeSearchTerm, normalizeStreetSuffixes,
                         #   buildQueryUrl, parseResponse, isHomestead
  types.ts               # CountyLookupSource interface
  counties/
    hamilton.ts          # Hamilton adapter implementing CountyLookupSource
    index.ts             # COUNTY_SOURCES registry { hamilton }
```

```ts
export interface CountyLookupSource {
  county: string;                                  // 'Hamilton'
  search(term: string): Promise<ParcelCandidate[]>;
}
```

- The Hamilton adapter is today's `searchParcels` logic **minus the hardcoded
  `AND UPPER(TAXDISTNAM) LIKE '%NOBLESVILLE%'` clause**. Hamilton's ArcGIS service is
  already county-scoped, so dropping the school filter is what makes it Hamilton-wide;
  the address `LIKE` clause still narrows by street.
- `buildQueryUrl` loses its Noblesville filter (becomes address-clause only). The
  generic ArcGIS helpers stay in `arcgis.ts` and are called by the adapter.
- `app/api/lookup/route.ts` calls `COUNTY_SOURCES.hamilton.search(term)`. Only one
  county exists, so no address→county routing yet — that's the future extension the
  registry shape anticipates.

### 2. District resolution seam (tax layer)

New resolver, keyed on each config's existing `gisGate`:

```ts
// lib/tax/indiana/districts/index.ts (or a sibling resolve.ts)
export function resolveTaxDistrict(
  taxDistrictName: string,
): { config: DistrictReferendumConfig; district: TaxDistrict } | null {
  for (const config of Object.values(DISTRICTS)) {
    const district = findDistrict(config, taxDistrictName);
    if (district) return { config, district };
  }
  return null;
}
```

Replaces `findDistrict(NOBLESVILLE, name)` in `Calculator`. Returns both which
referendum data (config) and which rate row (`TaxDistrict`).

### 3. County roster (uncovered-district naming)

```
lib/tax/indiana/counties/
  hamilton.ts            # HAMILTON: county name + school-district roster
  index.ts               # COUNTIES registry
```

```ts
export interface CountySchoolDistrict {
  name: string;          // 'Noblesville Schools'
  gisGate: RegExp;       // matches TAXDISTNAM
  configId?: DistrictId; // present when full referendum data exists
}
export const HAMILTON = {
  name: 'Hamilton',
  schoolDistricts: [/* verified entries only */] as CountySchoolDistrict[],
};
```

```ts
export function nameUncoveredDistrict(taxDistrictName: string): string | null;
```

**Accuracy rule (decided):** populate roster entries only where the
`TAXDISTNAM` → school-corporation mapping is verified against county data. Today that
is Noblesville alone. Unverified districts are intentionally absent, so
`nameUncoveredDistrict` returns `null` and the UI shows a generic county-level
message rather than a confidently-wrong name. The roster fills in as each district's
patterns are verified. A wrong name is worse than a generic message.

Boundary discipline: `lib/tax/` never imports lookup/GIS code; `lib/lookup/` never
imports referendum math. The glue (parcel `TAXDISTNAM` → config) lives in the tax
layer because `gisGate` already exists there for exactly this.

## Data flow

1. User enters address → `POST /api/lookup` → `COUNTY_SOURCES.hamilton.search(term)`
   → candidate parcels across Hamilton County (each carries `taxDistrictName`).
2. User selects a candidate → `resolveTaxDistrict(candidate.taxDistrictName)`:
   - **covered** → render `Results` with `{ config, district, parcel }`.
   - **not covered** → uncovered state: `nameUncoveredDistrict(name)` → named
     message if verified, else generic *"We found your parcel in Hamilton County,
     but it's not in a district this tool covers yet."*
3. Manual entry stays Noblesville-scoped this phase (only district with data); the
   district `<select>` is structured to grow as configs are added.

## UI changes — the four specificity cues

`Results.tsx` **takes `config: DistrictReferendumConfig` as a prop** and derives
`REFERENDUM`/`SOURCES`/`SCENARIOS` internally, eliminating the module-level
non-null-assertion seam. Because `debt`/`debtEndYear`/`committed2027` are optional,
rendering becomes conditional:

- the referendum-debt math row renders only when `config.referendum.debt` exists;
- the committed-2027 card copy and its footnote render only when `committed2027`
  exists; otherwise the "if it passes" card shows the authorized-max rate alone.

This conditional rendering is the generalization that lets the next district drop in
without editing `Results.tsx`.

Cues:
1. **District header on results** — `Results` leads with a banner naming the parcel
   (or manual district) and the district: *"Estimates for 123 Conner St —
   Noblesville Schools district."*
2. **District name in scenario copy** — scenario labels/explanations reference
   `config.name` instead of generic "the referendum," so shared screenshots stay
   self-identifying. Small change in `buildScenarios` labels / Results copy.
3. **Dynamic title + landing H1** — after resolution, `Calculator` sets
   `document.title` to name the resolved district (client-side). The static landing
   H1 **stays Noblesville-centric** (only district with data), reworded so a
   neighboring-district resident isn't confused when their result names a different
   district. The resolved-district header (cue 1) is the primary specificity carrier.
4. **Sources panel names the district** — the "how this was calculated" section
   states which district's DLGF determination and commitments the figures come from,
   using that config's own `sources` URLs.

## Error handling

- Uncovered but valid Hamilton parcel → named or generic not-covered message
  (never an error). Distinct from "no parcels found" (bad address).
- `resolveTaxDistrict` returning `null` for a selected candidate is the uncovered
  path, not a failure.
- Existing lookup error handling (upstream failure → manual-entry fallback) unchanged.

## Testing

- `resolveTaxDistrict`: Noblesville TAXDISTNAM variants → correct `{config, district}`;
  a non-Noblesville / unknown Hamilton name → `null`.
- `nameUncoveredDistrict`: unverified Hamilton name → `null` (generic fallback);
  verified entries (as the roster grows) → correct name. Registry-key↔`configId`
  integrity (each `configId` resolves to a real registered config).
- Hamilton adapter / `buildQueryUrl`: no longer emits the `%NOBLESVILLE%` clause;
  address clause and suffix-normalization behavior preserved. Update the existing
  `arcgis.test.ts` assertions that asserted the Noblesville filter.
- `Results` renders correctly from a `config` prop, including a **minimal config**
  (no `debt`/`committed2027`): debt row and committed copy are omitted, no crash —
  this proves the non-null-assertion seam is gone.
- Noblesville numeric outputs remain identical (all anchored dollar-figure tests).
- Component-level: covered selection renders district header; uncovered selection
  renders the not-covered state.

## Documentation

Update the README "Adding a district" section: note that a covered district also
needs a verified roster entry in its county file (`configId` linking config↔roster),
and that lookup is county-scoped via `CountyLookupSource` (adding a county = one
adapter + one registry line).
