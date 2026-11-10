import { interpret, type Draft } from "@/lib/intent";
import { body, fail, ok } from "@/lib/http";
import { currentUser, velocityOk } from "@/lib/security";

export async function POST(req: Request) {
  try {
    const b = await body<{ message: string; draft?: Draft }>(req);
    const text = String(b.message ?? "").slice(0, 600);
    if (!text.trim()) return ok({ error: "Say something first." }, 422);
    const user = await currentUser();
    if (!velocityOk("asst:" + (user?.id ?? "anon"), 20, 60_000)) return ok({ error: "Slow down a little and try again." }, 429);
    return ok(await interpret(text, b.draft ?? {}, user?.country));
  } catch (e) { return fail(e); }
}
