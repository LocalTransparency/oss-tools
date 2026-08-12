const dollars = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
});
const cents = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
});

export const fmtDollars = (n: number) => dollars.format(Math.round(n));
export const fmtCents = (n: number) => cents.format(n);
/** Signed delta for neutral display: "+$5" / "−$681" / "$0" */
export const fmtDelta = (n: number) => {
  const r = Math.round(n);
  if (r === 0) return '$0';
  return (r > 0 ? '+' : '−') + dollars.format(Math.abs(r));
};
/**
 * Referendum rates are quoted in cents per $100 and can carry a half-cent
 * (the district's committed 2027 rate is 38.5¢). `toFixed(2)` would render
 * that as "0.39" — a misstatement of the figure this tool exists to report.
 * Show three decimals, trimming a trailing zero only past the second place.
 */
export const fmtRate = (rate: number) =>
  rate.toFixed(3).replace(/(\.\d{2}\d*?)0+$/, '$1');
