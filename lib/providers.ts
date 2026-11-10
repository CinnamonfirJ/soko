import "server-only";
import crypto from "node:crypto";
import { bpsFee, convertMinor, CURRENCIES } from "./money";
import type { Corridor } from "./corridors";

// Provider adapter interface. Real adapters (collection, on-ramp, payout) implement the same
// shape. Only the sandbox adapter exists until a provider approves the use case (PRD D1–D6).
export interface QuoteResult {
  provider: string;
  providerReference: string;
  fxRate: bigint;
  destinationAmountMinor: number;
  fundingFeeMinor: number;
  conversionFeeMinor: number;
  networkFeeMinor: number;
  payoutFeeMinor: number;
  platformFeeMinor: number;
  guaranteed: boolean;
  ttlSeconds: number;
}

export interface ProviderAdapter {
  name: string;
  quote(c: Corridor, sourceAmountMinor: number, fundingMethod?: string): Promise<QuoteResult>;
}

/** Flat fee expressed in major units, converted to the currency's minor units. */
const flat = (major: number, cur: keyof typeof CURRENCIES) => major * 10 ** CURRENCIES[cur].decimals;

const FLAT_PAYOUT: Partial<Record<string, number>> = { NGN: 150, GHS: 1, KES: 15, ZAR: 2 };
const FLAT_NETWORK: Partial<Record<string, number>> = { NGN: 50, GHS: 0.5, KES: 5, ZAR: 0.5 };

export const sandboxProvider: ProviderAdapter = {
  name: "SokoBot FX",
  async quote(c, sourceAmountMinor, fundingMethod) {
    // Tiny deterministic drift so refreshed quotes visibly differ (simulates a moving market).
    const minute = Math.floor(Date.now() / 60_000);
    const drift = BigInt((minute % 7) - 3); // −3..+3 bps
    const fxRate = (c.midRate * (10_000n + drift)) / 10_000n;
    const sc = c.sourceCurrency;
    return {
      provider: this.name,
      providerReference: "q_" + crypto.randomBytes(6).toString("hex"),
      fxRate,
      destinationAmountMinor: convertMinor(sourceAmountMinor, fxRate, sc, c.destinationCurrency),
      fundingFeeMinor: bpsFee(sourceAmountMinor, fundingMethod === "Card" ? 140 : 50),
      conversionFeeMinor: bpsFee(sourceAmountMinor, 40),
      networkFeeMinor: c.settlement ? Math.round(flat(FLAT_NETWORK[sc] ?? 1, sc)) : 0,
      payoutFeeMinor: Math.round(flat(FLAT_PAYOUT[sc] ?? 2, sc)),
      platformFeeMinor: bpsFee(sourceAmountMinor, 30),
      guaranteed: false,
      ttlSeconds: 120,
    };
  },
};

export const providerFor = (_c: Corridor): ProviderAdapter => sandboxProvider;
