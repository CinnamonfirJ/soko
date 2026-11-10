import { CORRIDORS, COUNTRIES, publicCorridor } from "@/lib/corridors";
import { ok } from "@/lib/http";

export async function GET() {
  return ok({ countries: COUNTRIES, corridors: CORRIDORS.map(publicCorridor) });
}
