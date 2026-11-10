import "server-only";
import crypto from "node:crypto";
import { headers } from "next/headers";
import { commit, db } from "./store";
import { auth } from "./auth";
import { countryFromPhone } from "./corridors";
import type { User } from "./types";

const SECRET = process.env.SOKO_SIGNING_SECRET || "dev-only-signing-secret-change-me";
export const WEBHOOK_SECRET = process.env.SOKO_WEBHOOK_SECRET || "dev-only-webhook-secret";
const OPS_KEY = process.env.SOKO_OPS_KEY || "ops-access-key";

export const hmac = (data: string, key = SECRET) => crypto.createHmac("sha256", key).update(data).digest("base64url");

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ── Sessions (Better Auth, stored in Neon Postgres) ─────────────────
/** The signed-in user, from the Better Auth session cookie. Mirrors a minimal row into the app store. */
export async function currentUser(): Promise<User | null> {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const u = session?.user as ({ id: string; phoneNumber?: string | null; createdAt: Date | string } & Record<string, unknown>) | undefined;
  if (!u?.phoneNumber) return null;
  const store = db();
  let row = store.users.find((x) => x.id === u.id);
  if (!row) {
    row = { id: u.id, phone: u.phoneNumber, country: countryFromPhone(u.phoneNumber) ?? "NG", verificationStatus: "PHONE_VERIFIED", createdAt: new Date(u.createdAt).toISOString() };
    store.users.push(row);
    commit();
  }
  return row;
}

// ── Authorization tokens: bound to exact quote + recipient + amount ───
export function authToken(p: { txId: string; quoteId: string; recipientId: string; totalMinor: number; userId: string }) {
  const exp = Date.now() + 5 * 60 * 1000;
  const body = `${p.txId}|${p.quoteId}|${p.recipientId}|${p.totalMinor}|${p.userId}|${exp}`;
  return `${Buffer.from(body).toString("base64url")}.${hmac(body)}`;
}

export function verifyAuthToken(token: string, p: { txId: string; quoteId: string; recipientId: string; totalMinor: number; userId: string }): string | null {
  const [b, sig] = token.split(".");
  if (!b || !sig) return "Malformed authorization.";
  const body = Buffer.from(b, "base64url").toString();
  if (!safeEqual(sig, hmac(body))) return "Authorization signature invalid.";
  const [txId, quoteId, recipientId, total, userId, exp] = body.split("|");
  if (Number(exp) < Date.now()) return "Authorization expired. Review the transfer again.";
  if (txId !== p.txId || quoteId !== p.quoteId || recipientId !== p.recipientId || Number(total) !== p.totalMinor || userId !== p.userId)
    return "Authorization does not match this transfer.";
  return null;
}

export function signWebhook(body: string, ts: number) {
  return hmac(`${ts}.${body}`, WEBHOOK_SECRET);
}

export function verifyWebhook(body: string, ts: string | null, sig: string | null) {
  if (!ts || !sig) return false;
  if (Math.abs(Date.now() - Number(ts)) > 5 * 60 * 1000) return false; // replay window
  return safeEqual(sig, signWebhook(body, Number(ts)));
}

export function isOps(req: Request) {
  const k = req.headers.get("x-ops-key");
  return !!k && safeEqual(k, OPS_KEY);
}

// ── Simple velocity control (per user, in-memory) ──────────────────────
const g = globalThis as unknown as { __velocity?: Map<string, number[]> };
export function velocityOk(key: string, max: number, windowMs: number) {
  g.__velocity ??= new Map();
  const t = Date.now();
  const arr = (g.__velocity.get(key) ?? []).filter((x) => t - x < windowMs);
  if (arr.length >= max) return false;
  arr.push(t);
  g.__velocity.set(key, arr);
  return true;
}
