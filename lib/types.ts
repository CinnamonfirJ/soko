import type { CurrencyCode } from "./money";
import type { PayoutMethod } from "./corridors";

export type TxState =
  | "DRAFT" | "QUOTE_REQUESTED" | "QUOTE_READY" | "QUOTE_EXPIRED" | "AWAITING_AUTHORIZATION"
  | "AWAITING_FUNDING" | "FUNDING_PENDING" | "FUNDED" | "SETTLEMENT_PENDING" | "SETTLED"
  | "PAYOUT_PENDING" | "PAYOUT_CONFIRMED" | "COMPLETED" | "FAILED" | "MANUAL_REVIEW"
  | "REFUND_PENDING" | "REFUNDED";

export type StageStatus = "NOT_STARTED" | "PENDING" | "CONFIRMED" | "FAILED" | "UNKNOWN" | "SKIPPED";

export interface Quote {
  id: string;
  userId: string;
  corridorId: string;
  sourceCurrency: CurrencyCode;
  destinationCurrency: CurrencyCode;
  sourceAmountMinor: number;
  destinationAmountMinor: number;
  fxRate: string; // integer-scaled ×1e6
  fundingFeeMinor: number;
  conversionFeeMinor: number;
  networkFeeMinor: number;
  payoutFeeMinor: number;
  platformFeeMinor: number;
  totalFeesMinor: number;
  totalAmountMinor: number;
  providerReference: string;
  provider: string;
  guaranteed: boolean;
  createdAt: string;
  expiresAt: string;
  status: "ACTIVE" | "EXPIRED" | "CONSUMED";
  sandbox: boolean;
}

export interface Recipient {
  id: string;
  ownerId: string;
  displayName: string;
  nickname?: string;
  destinationCountry: string;
  payoutMethod: PayoutMethod;
  provider: string; // e.g. "MTN MoMo" or bank name
  destinationIdentifier: string; // stored server-side; never returned unmasked except to owner during review
  maskedIdentifier: string;
  verificationStatus: "UNVERIFIED" | "NAME_MATCHED";
  saved: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  reference: string;
  userId: string;
  quoteId: string;
  recipientId: string;
  corridorId: string;
  sourceCurrency: CurrencyCode;
  destinationCurrency: CurrencyCode;
  sourceAmountMinor: number;
  destinationAmountMinor: number;
  totalAmountMinor: number;
  totalFeesMinor: number;
  state: TxState;
  fundingStatus: StageStatus;
  settlementStatus: StageStatus;
  payoutStatus: StageStatus;
  providerReference?: string;
  fundingReference?: string;
  payoutReference?: string;
  blockchainTxHash?: string;
  blockchainChain?: string;
  blockchainSimulated?: boolean;
  idempotencyKey: string;
  fundingIdempotencyKey?: string;
  authorizedAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  sandbox: boolean;
  /** Internal sandbox scenario derived from the recipient test number. */
  scenario: "HAPPY" | "PAYOUT_FAIL" | "PAYOUT_UNKNOWN" | "FUNDING_FAIL";
  nextProviderEventAt?: string;
  reviewNote?: string;
}

export interface TxEvent {
  id: string;
  transactionId: string;
  type: string;
  source: "USER" | "SYSTEM" | "PROVIDER" | "OPS" | "CHAIN";
  fromState?: TxState;
  toState?: TxState;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface SupportCase {
  id: string;
  transactionId?: string;
  userId: string;
  category: string;
  message: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  createdAt: string;
}

export interface User {
  id: string;
  phone: string;
  country: string;
  verificationStatus: "PHONE_VERIFIED" | "KYC_PENDING" | "KYC_VERIFIED";
  createdAt: string;
  name?: string;
}

export interface Db {
  users: User[];
  quotes: Quote[];
  recipients: Recipient[];
  transactions: Transaction[];
  events: TxEvent[];
  support: SupportCase[];
  otps: { phone: string; code: string; expiresAt: string; attempts: number }[];
  processedWebhooks: string[];
}
