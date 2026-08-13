'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Isolates a thrown error inside the multi-year projection panel so it fails
 * on its own instead of white-screening the whole calculator.
 *
 * `projectReferendumLine` throws a named error when a district's
 * `projection.operatingRates` schedule reaches a pay year missing from
 * `DEDUCTIONS` or `CAP2_AV_DEDUCTION` (see lib/tax/projection.ts and
 * lib/tax/engine.ts) — correct behavior for that function, but nothing
 * upstream caught it. components/Projection.tsx calls it inside a `useMemo`,
 * and there was no error boundary anywhere in the app, so extending a
 * district's operatingRates without extending assumptions.ts — a routine
 * data edit per the README — would take down the entire page, not just the
 * projection table.
 *
 * The data-integrity test in
 * lib/tax/indiana/districts/hamilton-districts.test.ts is the real guard —
 * it catches this before deploy. This boundary is the second line of
 * defense: if a mismatch ships anyway, the four scenario cards above (the
 * part a voter most needs) keep working, and this panel fails visibly rather
 * than either a blank page (React's default for an uncaught render error) or
 * a silent `return null` (indistinguishable from "this district published no
 * schedule," which would hide a real defect).
 */
export class ProjectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <section
          role="alert"
          className="rounded-md border border-warning-border bg-warning-bg p-4 text-sm text-warning-fg"
        >
          The multi-year projection is unavailable right now. The estimates above are unaffected.
        </section>
      );
    }
    return this.props.children;
  }
}
