// Money is always integer minor units. FX rates are fixed-point integers scaled by RATE_SCALE.
// No floating-point arithmetic is used to compute amounts.

export const RATE_SCALE = 1_000_000n;

export type CurrencyCode = "NGN" | "GHS" | "KES" | "UGX" | "ZAR" | "TZS" | "XOF" | "RWF" | "ZWG" | "USD" | "EGP";

export const CURRENCIES: Record<CurrencyCode, { name: string; decimals: number; symbol: string }> = {
  NGN: { name: "Nigerian naira", decimals: 2, symbol: "₦" },
  GHS: { name: "Ghanaian cedi", decimals: 2, symbol: "GH₵" },
  KES: { name: "Kenyan shilling", decimals: 2, symbol: "KSh" },
  UGX: { name: "Ugandan shilling", decimals: 0, symbol: "USh" },
  ZAR: { name: "South African rand", decimals: 2, symbol: "R" },
  TZS: { name: "Tanzanian shilling", decimals: 2, symbol: "TSh" },
  XOF: { name: "West African CFA franc", decimals: 0, symbol: "CFA" },
  RWF: { name: "Rwandan franc", decimals: 0, symbol: "RF" },
  ZWG: { name: "Zimbabwe Gold", decimals: 2, symbol: "ZiG" },
  USD: { name: "US dollar", decimals: 2, symbol: "$" },
  EGP: { name: "Egyptian pound", decimals: 2, symbol: "E£" },
};

/** Parse a user-typed decimal string into minor units without floats. Returns null if invalid. */
export function parseToMinor(input: string, currency: CurrencyCode): number | null {
  const clean = input.replace(/[,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const decimals = CURRENCIES[currency].decimals;
  const [whole, frac = ""] = clean.split(".");
  if (frac.length > decimals) return null;
  const minor = BigInt(whole) * 10n ** BigInt(decimals) + BigInt((frac + "0".repeat(decimals)).slice(0, decimals) || "0");
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(minor);
}

/** Convert source minor units to destination minor units with an integer-scaled rate (floor). */
export function convertMinor(sourceMinor: number, rateScaled: bigint, from: CurrencyCode, to: CurrencyCode): number {
  const fd = BigInt(CURRENCIES[from].decimals);
  const td = BigInt(CURRENCIES[to].decimals);
  // dest = source / 10^fd * rate * 10^td
  const num = BigInt(sourceMinor) * rateScaled * 10n ** td;
  const den = RATE_SCALE * 10n ** fd;
  return Number(num / den);
}

/** Percentage fee in basis points, rounded up to the nearest minor unit. */
export function bpsFee(minor: number, bps: number): number {
  const v = BigInt(minor) * BigInt(bps);
  return Number((v + 9999n) / 10000n);
}

export function formatMinor(minor: number, currency: CurrencyCode, opts: { code?: boolean } = {}): string {
  const d = CURRENCIES[currency].decimals;
  const neg = minor < 0;
  const abs = BigInt(Math.abs(minor));
  const base = 10n ** BigInt(d);
  const whole = (abs / base).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = d > 0 ? "." + (abs % base).toString().padStart(d, "0") : "";
  const s = `${neg ? "-" : ""}${whole}${frac}`;
  return opts.code === false ? s : `${s} ${currency}`;
}

export function formatRate(rateScaled: string | bigint, from: CurrencyCode, to: CurrencyCode): string {
  const r = BigInt(rateScaled);
  const whole = r / RATE_SCALE;
  // Keep enough precision for small rates (e.g. 0.009347) but trim long tails on large ones.
  const frac = (r % RATE_SCALE).toString().padStart(6, "0").slice(0, whole >= 10n ? 4 : 6).replace(/0+$/, "");
  return `1 ${from} = ${whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${frac ? "." + frac : ""} ${to}`;
}
