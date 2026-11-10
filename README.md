# SokoBot

**Send money across Africa without figuring out how money moves across Africa.**

SokoBot is a conversational cross-border payments app for mobile money users. Message it on **WhatsApp** or in the app ("send R500 to my brother in Harare"), or use the transfer form. SokoBot shows the exact rate, every fee and what your recipient gets before you pay, then follows your money step by step until the payout is confirmed. Recipients receive local currency in their mobile money wallet or bank account. They don't need SokoBot, a crypto wallet, or any new app.

## Why SokoBot

- **Understand me.** Describe a payment in plain language, in WhatsApp or in the app. Soko Assistant turns it into a transfer you can check and edit.
- **Show me exactly what happens.** Sending amount, exchange rate, each fee, total to pay and amount received, all shown up front with a locked quote.
- **Handle the complexity.** Mobile money collection, conversion to **USDT (Tether)**, cross-border settlement and local mobile money payout are coordinated behind one simple flow.
- **No false success.** A transfer is only marked delivered once the recipient's provider confirms the payout.

## Built on Tether (USDT)

Every SokoBot transfer moves across the border as USDT:

1. **Collect** local money from the sender (EFT, card, M-Pesa, MoMo).
2. **Convert** it to USDT through a liquidity partner. This sets the rate that's locked into the quote.
3. **Settle** the USDT across the border onchain, in minutes, without correspondent banks.
4. **Convert** the USDT to the recipient's currency through a payout partner.
5. **Pay out** to the recipient's mobile money wallet or bank account, and mark it delivered only once the payout is confirmed.

USDT gives every corridor one shared, dollar-stable pool of liquidity. Adding a route such as South Africa → Zimbabwe is a configuration change, not a new banking integration. Users never see crypto: they send rand and their family receives ZiG on EcoCash.

## SokoBot on WhatsApp

Most of our users already live in WhatsApp, so SokoBot works there too:

1. The user messages SokoBot on WhatsApp: *"Send R500 to my brother Tendai in Harare."*
2. Soko Assistant understands the request, asks for anything missing, and replies with a short summary.
3. The reply includes a **secure, expiring link** that opens the transfer already filled in.
4. The user checks the live rate and fees and confirms on SokoBot's secure page. Saying "yes" in WhatsApp never authorizes a payment.
5. Status updates (payment received, money on the way, money delivered) come back in the same chat.

How it connects: an approved WhatsApp Business provider forwards messages through **n8n** to `POST /api/channels/whatsapp`. SokoBot returns the reply text, the updated draft, and the secure link. Links are HMAC-signed, carry only the draft (never payment details), and expire after 30 minutes.

```bash
curl -X POST http://localhost:3000/api/channels/whatsapp   -H "content-type: application/json"   -H "x-soko-channel-secret: $SOKO_WHATSAPP_SECRET"   -d '{"from":"+27821234567","text":"Send R500 to my brother Tendai in Harare"}'
```

## Routes

| From | To |
|---|---|
| 🇿🇦 South Africa (ZAR) | Zimbabwe, Nigeria, Ghana, Kenya |
| 🇳🇬 Nigeria (NGN) | Ghana, Kenya, South Africa |
| 🇬🇭 Ghana (GHS) | Nigeria, South Africa |
| 🇰🇪 Kenya (KES) | Uganda, Tanzania, South Africa |

Payout methods include MTN MoMo, M-Pesa, Airtel Money, EcoCash, Telecel Cash and major banks (Capitec, Standard Bank, FNB, Absa, Nedbank, GTBank, Access, Equity, KCB and more). Routes are configuration-driven, so new corridors can be added without new screens.

## Product tour

1. **Landing:** what SokoBot does, how money travels, the available routes.
2. **WhatsApp:** message SokoBot, get a secure link, confirm on the web, and get updates in the chat.
3. **Sign in:** phone number plus a one-time code (filled in automatically).
4. **Home:** start a transfer, ask Soko, follow an active transfer, or send again to a saved recipient.
5. **Soko Assistant:** natural-language drafting. It never sets prices and never pays on its own.
6. **Send money:** route and amount, then recipient, then a live quote, then review and confirm.
7. **Checkout:** pay through the payment partner's hosted page.
8. **Tracking:** payment received, then transfer processing, then paying recipient, then money delivered.
9. **Receipt:** shareable, with masked recipient details and every reference.
10. **Activity, Recipients, Profile, Support:** history, saved people, settings and help.
11. **Operations console (`/ops`):** search transfers, view provider events, resolve reviews.

### Walkthrough scenarios

| Scenario | How to see it |
|---|---|
| Successful transfer | Any route above, a normal recipient number. Delivered in about 15 seconds. |
| Payout rejected after payment | Recipient number ending in **0000**. The transfer moves to "Needs attention" and the ops team can refund or retry. |
| Provider outcome unclear | Recipient number ending in **9999**. Held for reconciliation; retries are blocked until it's resolved. |
| Payment cancelled | Choose "Cancel payment" on the checkout page. |
| Rate expiry | Wait two minutes on the quote. SokoBot fetches a fresh rate and asks you to confirm again. |
| Unavailable / paused route | Nigeria → Egypt (not offered), Ghana → Senegal (paused for maintenance). |

## Built for trust

- **The assistant drafts, the payment engine decides.** Chat can't authorize, price or execute a payment.
- **Authorization is bound to the exact transfer.** Each confirmation is signed against the specific quote, recipient, amount and user, and expires in five minutes.
- **Expired or already-used quotes can't be paid.**
- **No double payments.** Transfer creation and payment are idempotent, so double taps and retries reuse the same transfer.
- **Payment is confirmed by the provider, not the browser.** Only a signed provider webhook marks a transfer as paid. Webhooks are signature-checked, replay-protected and de-duplicated.
- **Settlement isn't delivery.** "Delivered" requires payout confirmation from the recipient's provider.
- **Unknown means review, not failure.** Ambiguous outcomes go to manual review with a full audit trail.
- **Exact money math.** All amounts are stored as integers in each currency's smallest unit, and exchange rates use fixed-point arithmetic.
- **Privacy by default.** Recipient numbers are masked everywhere they're shown, and card and bank details stay with the payment partner.

## Architecture

```
app/                       Next.js App Router (UI + API route handlers)
  page.tsx                 landing
  signin/                  phone + one-time code
  app/                     signed-in shell (sidebar on desktop, bottom nav on mobile)
    page.tsx               home
    assistant/             Soko Assistant
    send/                  route & amount, recipient, quote, review & confirm
    transfers/[id]/        payment, live tracking, receipt, recovery
    activity/ recipients/ profile/ support/
  checkout/[id]/           partner-hosted checkout page
  ops/                     operations console
  api/                     corridors, quotes, assistant, auth, transactions, recipients,
                           support, provider webhooks, ops,
                           channels/whatsapp (inbound messages), drafts/whatsapp (secure links)
lib/
  money.ts                 integer minor units + fixed-point FX
  corridors.ts             corridor registry (countries, currencies, payout methods, limits, status)
  stateMachine.ts          transfer states, allowed transitions, append-only event log
  engine.ts                quotes, transfers, authorization, payments, webhooks, ops actions
  providers.ts             payment provider adapter interface
  security.ts              signed sessions, authorization tokens, webhook signatures, rate limits
  intent.ts                natural language → transfer draft (Claude structured output, rules fallback)
  whatsapp.ts              WhatsApp replies, signed draft links, sender country detection
  store.ts                 persistence layer
```

**Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, Framer Motion, Lucide, Anthropic SDK (Claude) for intent extraction, USDT (Tether) settlement rail, n8n + WhatsApp Business for the chat channel.

## Run locally

```bash
npm install
cp .env.example .env.local   # set your secrets
npm run build && npm start   # http://localhost:3000
```

`npm run dev` also works for development.

| Variable | Purpose |
|---|---|
| `SOKO_SIGNING_SECRET` | Signs sessions and payment authorizations |
| `SOKO_WEBHOOK_SECRET` | Verifies payment provider webhooks |
| `SOKO_OPS_KEY` | Access key for the operations console |
| `SOKO_WHATSAPP_SECRET` | Shared secret the WhatsApp orchestrator (n8n) sends with each inbound message |
| `SOKO_PUBLIC_URL` | Public base URL used in links sent over WhatsApp |
| `ANTHROPIC_API_KEY` | Optional. Enables Claude-powered intent extraction in Soko Assistant |

## Design

Midnight `#010511`, Deep Azure `#0046DE` and Coral Rose `#FEB192` on a layered, moving canvas:

- A hero transfer card floating above three glowing platforms, each drifting on its own slow rhythm, inside a soft light ring.
- Light ribbons and drifting aurora behind the content, with a fine film grain.
- The money route drawn as a glowing node graph with a travelling pulse.
- A particle sphere for Soko Assistant, and a tilted, scrolling wall of routes.
- Manrope headlines with *Instrument Serif* italic accents.

Mobile-first down to 320px. Every animation respects `prefers-reduced-motion`, and no animation ever implies a payment step happened before it was confirmed.

## Roadmap

- Production payment partner integrations for collection and payout on each corridor
- Live USDT liquidity partners for on- and off-ramps in each corridor, with public settlement links
- WhatsApp Business provider go-live (number approval, message templates, delivery notifications)
- SMS and WhatsApp one-time codes
- Postgres (Supabase) storage with payout details encrypted at rest
- Saved-recipient verification with provider name matching
