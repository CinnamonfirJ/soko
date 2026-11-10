import { ok } from "@/lib/http";
import { toTransferDraft, verifyDraftLink } from "@/lib/whatsapp";

// Opens a draft created in WhatsApp. The token carries only the draft; the user still reviews, gets a live
// quote and authorizes on the web.
export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  const d = verifyDraftLink(t);
  if (!d) return ok({ error: "This link has expired. Message Soko on WhatsApp again for a new one." }, 410);
  return ok({ draft: toTransferDraft(d) });
}
