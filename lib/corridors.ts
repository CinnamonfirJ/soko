import type { CurrencyCode } from "./money";

export type RouteStatus = "LIVE" | "SANDBOX" | "UNAVAILABLE" | "MAINTENANCE";
export type PayoutMethod = "MOBILE_MONEY" | "BANK";

export interface Country {
  code: string;
  name: string;
  flag: string;
  currency: CurrencyCode;
  dial: string;
  /** National significant number length range for mobile money numbers. */
  phoneLen: [number, number];
  mobileMoney: string[];
}

export const COUNTRIES: Country[] = [
  { code: "NG", name: "Nigeria", flag: "🇳🇬", currency: "NGN", dial: "+234", phoneLen: [10, 10], mobileMoney: ["OPay", "PalmPay"] },
  { code: "GH", name: "Ghana", flag: "🇬🇭", currency: "GHS", dial: "+233", phoneLen: [9, 9], mobileMoney: ["MTN MoMo", "Telecel Cash", "AT Money"] },
  { code: "KE", name: "Kenya", flag: "🇰🇪", currency: "KES", dial: "+254", phoneLen: [9, 9], mobileMoney: ["M-Pesa", "Airtel Money"] },
  { code: "UG", name: "Uganda", flag: "🇺🇬", currency: "UGX", dial: "+256", phoneLen: [9, 9], mobileMoney: ["MTN MoMo", "Airtel Money"] },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", currency: "ZAR", dial: "+27", phoneLen: [9, 9], mobileMoney: [] },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿", currency: "TZS", dial: "+255", phoneLen: [9, 9], mobileMoney: ["M-Pesa", "Tigo Pesa"] },
  { code: "SN", name: "Senegal", flag: "🇸🇳", currency: "XOF", dial: "+221", phoneLen: [9, 9], mobileMoney: ["Orange Money", "Wave"] },
  { code: "RW", name: "Rwanda", flag: "🇷🇼", currency: "RWF", dial: "+250", phoneLen: [9, 9], mobileMoney: ["MTN MoMo"] },
  { code: "ZW", name: "Zimbabwe", flag: "🇿🇼", currency: "ZWG", dial: "+263", phoneLen: [9, 9], mobileMoney: ["EcoCash"] },
  { code: "EG", name: "Egypt", flag: "🇪🇬", currency: "EGP", dial: "+20", phoneLen: [10, 10], mobileMoney: [] },
];

export interface Corridor {
  id: string;
  source: string;
  destination: string;
  sourceCurrency: CurrencyCode;
  destinationCurrency: CurrencyCode;
  status: RouteStatus;
  payoutMethods: PayoutMethod[];
  fundingMethods: string[];
  /** Integer-scaled mid rate (×1,000,000) — sandbox reference only, never shown as a live price. */
  midRate: bigint;
  minMinor: number;
  maxMinor: number;
  settlement: { stablecoin: string; chain: string } | null;
  etaMinutes: [number, number] | null;
  note?: string;
}

const C = (c: Omit<Corridor, "id">): Corridor => ({ ...c, id: `${c.source}-${c.destination}` });

// Configuration-driven registry. Nothing here is LIVE: no production provider approval exists.
// Flip a route to LIVE only after every Real-Money Launch Gate condition (PRD §7.3) is met.
export const CORRIDORS: Corridor[] = [
  // ── South Africa (priority market) ──
  C({ source: "ZA", destination: "ZW", sourceCurrency: "ZAR", destinationCurrency: "ZWG", status: "SANDBOX", payoutMethods: ["MOBILE_MONEY"], fundingMethods: ["Bank transfer (EFT)", "Card"], midRate: 1_488_900n, minMinor: 50_00, maxMinor: 50_000_00, settlement: { stablecoin: "USDT", chain: "Celo" }, etaMinutes: [5, 30] }),
  C({ source: "ZA", destination: "NG", sourceCurrency: "ZAR", destinationCurrency: "NGN", status: "SANDBOX", payoutMethods: ["BANK", "MOBILE_MONEY"], fundingMethods: ["Bank transfer (EFT)", "Card"], midRate: 83_330_000n, minMinor: 50_00, maxMinor: 50_000_00, settlement: { stablecoin: "USDT", chain: "Celo" }, etaMinutes: [5, 30] }),
  C({ source: "ZA", destination: "GH", sourceCurrency: "ZAR", destinationCurrency: "GHS", status: "SANDBOX", payoutMethods: ["MOBILE_MONEY", "BANK"], fundingMethods: ["Bank transfer (EFT)", "Card"], midRate: 778_000n, minMinor: 50_00, maxMinor: 50_000_00, settlement: { stablecoin: "USDT", chain: "Celo" }, etaMinutes: [5, 30] }),
  C({ source: "ZA", destination: "KE", sourceCurrency: "ZAR", destinationCurrency: "KES", status: "SANDBOX", payoutMethods: ["MOBILE_MONEY"], fundingMethods: ["Bank transfer (EFT)", "Card"], midRate: 7_170_000n, minMinor: 50_00, maxMinor: 50_000_00, settlement: { stablecoin: "USDT", chain: "Celo" }, etaMinutes: [10, 45] }),
  C({ source: "NG", destination: "ZA", sourceCurrency: "NGN", destinationCurrency: "ZAR", status: "SANDBOX", payoutMethods: ["BANK"], fundingMethods: ["Bank transfer", "Card"], midRate: 12_000n, minMinor: 1_000_00, maxMinor: 2_000_000_00, settlement: { stablecoin: "USDT", chain: "Celo" }, etaMinutes: [10, 60] }),
  C({ source: "KE", destination: "ZA", sourceCurrency: "KES", destinationCurrency: "ZAR", status: "SANDBOX", payoutMethods: ["BANK"], fundingMethods: ["M-Pesa"], midRate: 139_500n, minMinor: 100_00, maxMinor: 300_000_00, settlement: { stablecoin: "USDT", chain: "Celo" }, etaMinutes: [10, 60] }),
  C({ source: "GH", destination: "ZA", sourceCurrency: "GHS", destinationCurrency: "ZAR", status: "SANDBOX", payoutMethods: ["BANK"], fundingMethods: ["Mobile money"], midRate: 1_285_700n, minMinor: 10_00, maxMinor: 50_000_00, settlement: { stablecoin: "USDT", chain: "Celo" }, etaMinutes: [10, 60] }),
  C({ source: "NG", destination: "GH", sourceCurrency: "NGN", destinationCurrency: "GHS", status: "SANDBOX", payoutMethods: ["MOBILE_MONEY", "BANK"], fundingMethods: ["Bank transfer", "Card"], midRate: 9_350n, minMinor: 1_000_00, maxMinor: 2_000_000_00, settlement: { stablecoin: "USDT", chain: "Celo" }, etaMinutes: [5, 30] }),
  C({ source: "NG", destination: "KE", sourceCurrency: "NGN", destinationCurrency: "KES", status: "SANDBOX", payoutMethods: ["MOBILE_MONEY"], fundingMethods: ["Bank transfer", "Card"], midRate: 82_400n, minMinor: 1_000_00, maxMinor: 2_000_000_00, settlement: { stablecoin: "USDT", chain: "Celo" }, etaMinutes: [10, 45] }),
  C({ source: "GH", destination: "NG", sourceCurrency: "GHS", destinationCurrency: "NGN", status: "SANDBOX", payoutMethods: ["BANK", "MOBILE_MONEY"], fundingMethods: ["Mobile money"], midRate: 106_950_000n, minMinor: 10_00, maxMinor: 50_000_00, settlement: { stablecoin: "USDT", chain: "Celo" }, etaMinutes: [5, 30] }),
  C({ source: "KE", destination: "UG", sourceCurrency: "KES", destinationCurrency: "UGX", status: "SANDBOX", payoutMethods: ["MOBILE_MONEY"], fundingMethods: ["M-Pesa"], midRate: 28_650_000n, minMinor: 100_00, maxMinor: 300_000_00, settlement: { stablecoin: "USDT", chain: "Celo" }, etaMinutes: [5, 20] }),
  C({ source: "KE", destination: "TZ", sourceCurrency: "KES", destinationCurrency: "TZS", status: "SANDBOX", payoutMethods: ["MOBILE_MONEY"], fundingMethods: ["M-Pesa"], midRate: 20_150_000n, minMinor: 100_00, maxMinor: 300_000_00, settlement: { stablecoin: "USDT", chain: "Celo" }, etaMinutes: [10, 60] }),
  C({ source: "GH", destination: "SN", sourceCurrency: "GHS", destinationCurrency: "XOF", status: "MAINTENANCE", payoutMethods: ["MOBILE_MONEY"], fundingMethods: ["Mobile money"], midRate: 38_400_000n, minMinor: 10_00, maxMinor: 50_000_00, settlement: { stablecoin: "USDT", chain: "Celo" }, etaMinutes: null }),
  C({ source: "NG", destination: "EG", sourceCurrency: "NGN", destinationCurrency: "EGP", status: "UNAVAILABLE", payoutMethods: [], fundingMethods: [], midRate: 0n, minMinor: 0, maxMinor: 0, settlement: null, etaMinutes: null }),
];

export const country = (code: string) => COUNTRIES.find((c) => c.code === code);
export const findCorridor = (src: string, dst: string) => CORRIDORS.find((c) => c.source === src && c.destination === dst);
export const corridorById = (id: string) => CORRIDORS.find((c) => c.id === id);

export const isTransactable = (c: Corridor | undefined) => !!c && (c.status === "LIVE" || c.status === "SANDBOX");

/** Client-safe serialisation (bigint → string). */
export function publicCorridor(c: Corridor) {
  return { ...c, midRate: c.midRate.toString() };
}
export type PublicCorridor = ReturnType<typeof publicCorridor>;

export const sourceCountries = () => COUNTRIES.filter((c) => CORRIDORS.some((k) => k.source === c.code));

export function normalizePhone(raw: string, countryCode: string): { ok: true; e164: string } | { ok: false; error: string } {
  const c = country(countryCode);
  if (!c) return { ok: false, error: "Unknown country." };
  let digits = raw.replace(/[^\d+]/g, "");
  const dial = c.dial.replace("+", "");
  if (digits.startsWith("+")) {
    if (!digits.startsWith("+" + dial)) return { ok: false, error: `Use a ${c.name} number starting with ${c.dial}.` };
    digits = digits.slice(1 + dial.length);
  } else if (digits.startsWith("00" + dial)) digits = digits.slice(2 + dial.length);
  else if (digits.startsWith(dial) && digits.length > c.phoneLen[1]) digits = digits.slice(dial.length);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length < c.phoneLen[0] || digits.length > c.phoneLen[1]) return { ok: false, error: `Check this number. ${c.name} numbers have ${c.phoneLen[0]} digits after ${c.dial}.` };
  return { ok: true, e164: `${c.dial}${digits}` };
}

export function mask(id: string): string {
  if (id.length <= 4) return "••••";
  return id.slice(0, Math.min(4, id.length - 4)) + " •••• " + id.slice(-4);
}

/** Country for an E.164 number, by longest matching dial code. */
export function countryFromPhone(phone: string): string | undefined {
  const p = "+" + phone.replace(/\D/g, "");
  return COUNTRIES.slice().sort((a, b) => b.dial.length - a.dial.length).find((c) => p.startsWith(c.dial))?.code;
}
