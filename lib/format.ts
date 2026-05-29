// Money + label formatting. Amounts from the BE are bigint minor-unit STRINGS
// (USDC = 6dp); never parse them as JS numbers for math — only for display.

/** "1500000" (6dp) → "$1.50". Negative-safe. */
export function formatUsdc(minor: string, decimals = 6): string {
  const neg = minor.startsWith("-");
  const digits = (neg ? minor.slice(1) : minor).padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const frac = digits.slice(digits.length - decimals).slice(0, 2).padEnd(2, "0");
  const wholeGrouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}$${wholeGrouped}.${frac}`;
}

// Indicative USD→PHP for display only. Real FX comes from the remit quote (unbuilt);
// this is just the headline "≈ ₱x" on the wallet card.
export const PHP_PER_USD = 56.42;

/** USDC minor-unit string → "₱x.xx" at the indicative rate (display only). */
export function formatPhpFromUsdcMinor(minor: string, rate = PHP_PER_USD): string {
  const usd = Number(minor) / 1_000_000;
  const php = usd * rate;
  return `₱${php.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function initialsOf(first?: string | null, last?: string | null): string {
  const a = (first ?? "").trim()[0] ?? "";
  const b = (last ?? "").trim()[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

const TX_LABELS: Record<string, string> = {
  fund_in: "Money added",
  fund_in_returned: "Deposit returned",
  crypto_deposit: "Crypto deposit",
  remit: "Sent to family",
  card_authz: "Card authorization",
  card_settle: "Card purchase",
  card_authz_reversal: "Card reversal",
  yield_accrual: "Interest earned",
};
export function txLabel(kind: string): string {
  return TX_LABELS[kind] ?? kind.replace(/_/g, " ");
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const DECLINE_REASON_LABELS: Record<string, string> = {
  card_not_active: "Card not active",
  capability_disabled: "Online payments off",
  account_frozen: "Account frozen",
  kyc_tier_insufficient: "Verification needed",
  insufficient_funds: "Not enough balance",
  mcc_blocked: "Merchant not allowed",
  velocity_exceeded: "Spending limit reached",
  geo_blocked: "Region not allowed",
  fraud_hold: "Security hold",
  suspicious_transaction: "Flagged for review",
  internal_error: "Couldn't process",
};
export function declineReasonLabel(reason?: string | null): string {
  if (!reason) return "Declined";
  return DECLINE_REASON_LABELS[reason] ?? "Declined";
}

const CARD_STATUS_LABELS: Record<string, string> = {
  not_activated: "Not activated",
  active: "Active",
  frozen: "Frozen",
  locked: "Locked",
  canceled: "Canceled",
};
export function cardStatusLabel(status: string): string {
  return CARD_STATUS_LABELS[status] ?? status;
}
