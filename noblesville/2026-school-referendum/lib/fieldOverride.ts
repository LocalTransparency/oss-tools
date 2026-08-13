/**
 * Shared primitive behind every numeric override field in this app
 * (components/Projection.tsx's growth-rate inputs, components/CapClassPanel.tsx's
 * AV-split inputs). A controlled numeric input cannot be driven straight off
 * the committed number: `Number('')` is 0 and finite, so clearing the field
 * to retype a value would read as "0" and commit before the visitor's cursor
 * has typed anything, and formatting the committed number back into the
 * input (e.g. `String(value)`) drops whatever the visitor is mid-typing — a
 * trailing "." or a run of leading zeros never survives the round trip.
 *
 * `text` always mirrors what is actually in the box, verbatim. `value` only
 * advances when `text` parses to a real, valid number (per `isValid`);
 * otherwise it holds the previous value, so downstream computation stays
 * stable while an entry is unparseable or invalid. `parseable` tells the
 * caller whether THIS keystroke produced a real number at all, independent
 * of whether that number was valid — Projection.tsx uses that distinction to
 * show an "out of range" message only for a parseable-but-invalid entry, not
 * for a half-typed one.
 */
export interface FieldOverride {
  text: string;
  value: number;
}

export function nextFieldOverride(
  raw: string,
  previous: FieldOverride | null,
  fallback: number,
  isValid: (n: number) => boolean = () => true,
): FieldOverride & { parseable: boolean; valid: boolean } {
  const n = Number(raw);
  const parseable = raw.trim() !== '' && Number.isFinite(n);
  const valid = parseable && isValid(n);
  return { text: raw, value: valid ? n : (previous?.value ?? fallback), parseable, valid };
}
