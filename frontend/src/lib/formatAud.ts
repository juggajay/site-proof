// The single AUD money formatter for the app. Money is money: approvals, the
// costs page, and the subbie docket surfaces must never disagree by rounding, so
// `formatAud` always shows cents. `formatAudWhole` is the explicit whole-dollar
// variant for the rare surface that deliberately wants a rounded figure — reach
// for it on purpose, not by accident.
export function formatAud(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
}

export function formatAudWhole(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
