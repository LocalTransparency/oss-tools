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
