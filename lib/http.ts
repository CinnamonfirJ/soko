import "server-only";
import { NextResponse } from "next/server";
import { PaymentError } from "./engine";
import { TransitionError } from "./stateMachine";
import { currentUser } from "./security";
import type { User } from "./types";

export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });

export function fail(e: unknown) {
  if (e instanceof PaymentError) return NextResponse.json({ error: e.message, code: e.code, fieldErrors: (e as PaymentError & { fieldErrors?: unknown }).fieldErrors }, { status: e.status });
  if (e instanceof TransitionError) return NextResponse.json({ error: "This transfer can't do that right now.", code: "ILLEGAL_STATE" }, { status: 409 });
  console.error(e);
  return NextResponse.json({ error: "Something's taking longer than expected. Your reference is saved.", code: "INTERNAL" }, { status: 500 });
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) throw new PaymentError("Please sign in to continue.", 401, "UNAUTHENTICATED");
  return u;
}

export async function body<T>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { throw new PaymentError("Invalid request body."); }
}
