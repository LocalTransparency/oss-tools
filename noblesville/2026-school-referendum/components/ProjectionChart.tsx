import type { ProjectionRow } from '../lib/tax/projection';

const W = 640;
const H = 220;
const PAD_X = 44;
const PAD_Y = 20;

/**
 * Small inline-SVG line chart of the multi-year referendum projection,
 * mounted above the table in Projection.tsx.
 *
 * Hand-rolled rather than a charting dependency: this app has exactly three
 * runtime dependencies (next, react, react-dom, plus @localtransparency/design),
 * the series is nine points, and the design system is CSS-token based, so a
 * charting library would need theme plumbing this doesn't. Colors below are
 * the same @localtransparency/design custom properties Projection.tsx uses
 * via Tailwind utilities (tokens.css defines --lt-accent, --lt-border,
 * --lt-muted), so the chart follows light/dark automatically without any
 * theme wiring of its own.
 *
 * Plots `operatingTax / 12` -- the SAME series projectionStats() and the
 * table's "Referendum operating tax/mo" column are built from -- and
 * deliberately NOT `monthly`, which folds in the referendum debt rate that
 * stays on the bill through debtEndYear regardless of this vote (see the
 * doc comments on ProjectionRow and projectionStats in lib/tax/projection.ts).
 * Plotting `monthly` here would draw a picture that contradicts the
 * operating-only statistics displayed beside it.
 *
 * aria-hidden: this is decorative duplication of the adjacent table, which
 * remains the accessible representation of the same data.
 */
export function ProjectionChart({ rows }: { rows: ProjectionRow[] }) {
  if (rows.length === 0) return null;

  const values = rows.map((r) => r.operatingTax / 12);
  // Zero-based baseline, deliberately: this chart sits next to a live ballot
  // question, and truncating the y-axis to the data's own $55-71 range would
  // make a real but modest month-to-month change look like a cliff. A
  // zero-based axis is the anti-exaggeration choice, even though it compresses
  // the series into roughly the bottom fifth of the plot height -- legibility
  // of small wiggles is intentionally traded for not overstating the change.
  // Do not "fix" this by tightening the axis to the data range.
  const min = Math.min(...values, 0);
  const max = Math.max(...values);
  const span = max - min || 1;

  const x = (i: number) => PAD_X + (i * (W - PAD_X - PAD_Y)) / Math.max(1, rows.length - 1);
  const y = (v: number) => H - PAD_Y - ((v - min) / span) * (H - PAD_Y * 2);

  const line = rows
    .map((r, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(r.operatingTax / 12).toFixed(1)}`)
    .join(' ');

  return (
    <div aria-hidden="true" className="mt-2">
      <p className="text-xs text-muted">Referendum operating tax only, per month (excludes debt)</p>
      {/* "auto" is a CSS height keyword, not a valid SVG height attribute
          value (the attribute wants a <length>) -- setting it as a raw
          attribute here previously produced a console error ("Expected
          length, 'auto'"). Sizing goes through the className instead. */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        aria-hidden="true"
        focusable="false"
      >
        <line
          x1={PAD_X}
          y1={H - PAD_Y}
          x2={W - PAD_Y}
          y2={H - PAD_Y}
          stroke="var(--lt-border)"
          strokeWidth="1"
        />
        <path d={line} fill="none" stroke="var(--lt-accent)" strokeWidth="2" />
        {rows.map((r, i) => (
          <circle
            key={r.year}
            cx={x(i).toFixed(1)}
            cy={y(r.operatingTax / 12).toFixed(1)}
            r="3"
            fill="var(--lt-accent)"
          />
        ))}
        {rows.map((r, i) => (
          <text
            key={r.year}
            x={x(i).toFixed(1)}
            y={H - PAD_Y + 14}
            textAnchor="middle"
            fontSize="10"
            fill="var(--lt-muted)"
          >
            {r.year}
          </text>
        ))}
      </svg>
    </div>
  );
}
