import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./store";
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

// ── Sessions ───────────────────────────────────────────────────────────
const COOKIE = "soko_session";

export function sessionValue(userId: string) {
  const exp = Date.now() + 1000 * 60 * 60 * 12;
  const body = `${userId}.${exp}`;
  return `${body}.${hmac(body)}`;
}

export async function currentUser(): Promise<User | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts;
  if (!safeEqual(sig, hmac(`${id}.${exp}`)) || Number(exp) < Date.now()) return null;
  return db().users.find((u) => u.id === id) ?? null;
}

export async function setSession(userId: string) {
  (await cookies()).set(COOKIE, sessionValue(userId), { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 12 });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
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
