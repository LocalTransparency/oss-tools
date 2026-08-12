# Primary source found for the SEA 1 deduction schedules — 2026-08-12

Source: DLGF, "Report on Property Tax Exemptions, Deductions, and Abatements," April 30 2026
https://www.in.gov/dlgf/files/2026-Exemptions-and-Deductions-Report.pdf

## 1. Standard homestead deduction — CONFIRMED (IC 6-1.1-12-37)

The report enumerates it **by ASSESSMENT DATE**, verbatim:

  1. for the 2025 assessment date, $48,000
  2. for the 2026 assessment date, $40,000
  3. for the 2027 assessment date, $30,000
  4. for the 2028 assessment date, $20,000
  5. for the 2029 assessment date, $10,000
  6. for the 2030 assessment date and each assessment date thereafter, $0

*** THE SUBTLETY THAT MUST BE DOCUMENTED IN CODE ***
Indiana assessment year N sets taxes payable in year N+1. DLGF states this plainly on its
Assessed Value Search page: "the assessed value for a particular year (for instance 2015)
is the value upon which taxes are based in the following year (i.e. 2016)."

Our `DEDUCTIONS` map is keyed by PAY year. Converting:

| assessment date | pay year | standard | our current value | match |
|---|---|---|---|---|
| 2025 | 2026 | 48,000 | 48,000 | yes |
| 2026 | 2027 | 40,000 | 40,000 | yes |
| 2027 | 2028 | 30,000 | 30,000 | yes |
| 2028 | 2029 | 20,000 | 20,000 | yes |
| 2029 | 2030 | 10,000 | 10,000 | yes |
| 2030+ | 2031+ | 0 | 0 | yes |

All six agree. Without the +1 shift documented in the code, a future reader comparing our
map against the statute will conclude we are off by one year and "fix" a correct table.

## 2. Supplemental homestead deduction — CONFIRMED (IC 6-1.1-12-37.5)

Enumerated **by PAY year** (no shift needed), verbatim: "For property taxes due and payable
after 2025, as follows: 1. Forty percent (40%) for taxes first due and payable in 2026.
2. Forty-six percent (46%) ... 2027. 3. Fifty-two percent (52%) ... 2028. 4. Fifty-seven
percent (57%) ... 2029. 5. Sixty-two percent (62%) ... 2030. 6. Sixty-six and seven-tenths
percent (66.7%) for taxes first due and payable in 2031, and each year thereafter."

Matches our 0.40 / 0.46 / 0.52 / 0.57 / 0.62 / 0.667 exactly.

Citation care: the passage is preceded by the IC 6-1.1-12-37.5 heading (real property, the
$600,000-tier supplemental homestead deduction). The IC 6-1.1-12-40.5 cite appearing just
AFTER it belongs to the parallel mobile/manufactured-home section, not to real property.
Do not cite 40.5 for the real-property schedule.

## 3. Cap 2 AV deduction — STILL `estimated`

The 6% / 12% / 19% / 25% / 30% / 33.4% phase-in for non-homestead residential and
agricultural land is NOT in this report. Searched: "33.4%" zero hits, "12% for taxes" zero
hits, "non-homestead residential" zero hits. It remains sourced only to the district's
calculator as a cross-check and must keep `status: 'estimated'`.

## Action
See Task 17. Promote the standard and supplemental schedules to `confirmed` with this
source; leave CAP2_AV_DEDUCTION `estimated`; document the assessment-date/pay-year shift.
