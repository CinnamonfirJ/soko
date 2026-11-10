import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const res = await auth.api.signOut({ headers: req.headers, asResponse: true }).catch(() => null);
  const out = NextResponse.json({ ok: true });
  res?.headers.getSetCookie().forEach((c) => out.headers.append("set-cookie", c));
  return out;
}
