import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Better Auth's own endpoints (get-session, sign-out, phone-number/*) at /api/identity/*.
export const { GET, POST } = toNextJsHandler(auth);
