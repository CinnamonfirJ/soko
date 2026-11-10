import { handleProviderWebhook } from "@/lib/engine";
import { NextResponse } from "next/server";

// Verified provider callbacks. Signature: HMAC-SHA256(`${timestamp}.${rawBody}`) with SOKO_WEBHOOK_SECRET.
export async function POST(req: Request) {
  const raw = await req.text();
  const r = handleProviderWebhook(raw, req.headers.get("x-soko-timestamp"), req.headers.get("x-soko-signature"));
  return NextResponse.json({ message: r.message }, { status: r.status });
}
