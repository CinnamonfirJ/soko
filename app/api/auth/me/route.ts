import { ok } from "@/lib/http";
import { currentUser } from "@/lib/security";
export async function GET() { return ok({ user: await currentUser() }); }
