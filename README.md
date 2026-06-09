# TTB Label Verifier

An AI-assisted prototype that helps TTB compliance agents verify alcohol
beverage labels against COLA application data — in about **3–5 seconds** per
label, with a UI built for non-technical reviewers.

> Proof of concept only. Not connected to the COLA system. A human reviewer
> makes the final determination.

---

## What it does

Two modes:

1. **Single Label** — the agent types the expected application values (brand,
   class/type, ABV, net contents, producer, country of origin), uploads the
   label photo, and presses **Verify**. They get back:
   - An overall **PASS / NEEDS REVIEW / FAIL** banner with the processing time.
   - A **field-by-field comparison** (Application vs. On-label) with a
     plain-language note on each.
   - A dedicated **Government Warning** check (exact wording + ALL-CAPS, bold
     heading per 27 CFR §16.21–16.22).

2. **Batch** — drop in many label photos at once (the "200–300 at peak season"
   pain point), optionally with a **CSV of expected values matched by filename**.
   Labels are processed in parallel, shown in a results table, and the verdicts
   can be **exported to CSV**.

### How it addresses the interview feedback

| Stakeholder concern | How the prototype responds |
| --- | --- |
| **Speed** — "if we can't get results in ~5s, nobody will use it" (Sarah) | One structured vision call on a fast model (Sonnet 4.6), with thinking off and client-side image downscaling. The UI shows the elapsed time on every result. |
| **Simplicity** — "something my mother could figure out" (Sarah) | Large type, one primary action per screen, color **plus** text labels (not color alone), obvious upload zone. |
| **Batch** — importers dump hundreds at once (Sarah/Janet) | Batch mode with parallel processing + CSV in / CSV out. |
| **Judgment, not brittle matching** — "STONE'S THROW" vs "Stone's Throw" (Dave) | The model compares with judgment and explains each verdict; case/punctuation/obvious-equivalent differences are a match, with a note. |
| **The warning is exact** — title case got one rejected (Jenny) | A deterministic rule (not the model's opinion) checks the exact §16.21 wording and the ALL-CAPS, bold heading. |
| **Imperfect photos** — angles, glare (Jenny) | Vision models read angled/glare images well; if a label truly can't be read, the result says so and asks for a better photo. |
| **Locked-down federal network / cloud APIs blocked** (Marcus) | The browser only talks to the app's own domain; the ML endpoint is called server-side, off the agent's network — so blocked ML endpoints don't break it. No third-party resources load. The AI also sits behind a `VisionProvider` interface for an on-prem/Azure swap. (See "Network & firewall".) |

---

## Setup

**Prerequisites:** Node.js 18+ and an [Anthropic API key](https://console.anthropic.com).

```bash
# 1. Install dependencies
npm install

# 2. Configure your API key
cp .env.example .env.local
#   then edit .env.local and set ANTHROPIC_API_KEY=sk-ant-...

# 3. (Optional) Generate the synthetic test labels
npm run generate:samples

# 4. Run it
npm run dev
#   open http://localhost:3000
```

### Try it

After `npm run generate:samples`, four test labels appear in
`public/samples/` with a matching `sample-applications.csv`:

| File | Expected outcome |
| --- | --- |
| `good-bourbon.png` | **PASS** — matches its CSV row, compliant warning |
| `abv-mismatch.png` | **FAIL** — label shows 50% but the application says 45% |
| `bad-warning-titlecase.png` | **FAIL** — "Government Warning:" is title case, not ALL CAPS/bold |
| `missing-warning.png` | **FAIL** — no government warning present |
| `degraded-bourbon.jpg` | **REVIEW** — a deliberately bad photo (dark, blurred, rotated, glare, heavy compression); the AI still reads every field and flags it for a human look |

In **Single Label** mode, fill the form from a CSV row and upload the matching
image. In **Batch** mode, select all four images and the CSV at once.

### Tests

```bash
npm test
```

Unit tests cover the deterministic logic: the Government Warning rule
(`tests/warning.test.ts`), the overall verdict logic (`tests/verify.test.ts`),
and the CSV parsing (`tests/csv.test.ts`).

---

## How it works

```
Browser                         Next.js API (/api/verify)              Anthropic
─────────                       ─────────────────────────              ─────────
downscale image  ──────────►    AnthropicProvider.extract()  ───────►  vision call
(prepareImage)                  (structured JSON output)                (Sonnet 4.6)
                                         │
                                buildResult():
                                  • map field comparisons
                                  • verifyWarning() ← deterministic §16.21 rule
                                  • compute PASS/REVIEW/FAIL
                                         │
results UI       ◄──────────────  VerificationResult + elapsedMs
```

**The split of responsibility is deliberate:**

- **The model does perception + judgment** — reading an imperfect photo and
  deciding whether "STONE'S THROW" equals "Stone's Throw". That's what models
  are good at and what brittle string matching gets wrong.
- **Deterministic code owns the compliance decision** — the Government Warning
  must be exact, so the pass/fail rule lives in `src/lib/warning.ts` where it is
  auditable and unit-tested, not left to the model's discretion. The model only
  *reports* what it saw (verbatim text + formatting); the code decides.

**Structured output** — the vision call is constrained to a JSON schema
(`output_config.format`), so the response is always valid, typed data — no
fragile parsing of free-text.

### Project layout

```
src/
  app/
    page.tsx              Single-label screen
    batch/page.tsx        Batch screen
    api/verify/route.ts   Verification endpoint
  components/results.tsx  Verdict banner, status pills, result detail
  lib/
    provider/             VisionProvider interface + Anthropic implementation
    ttb.ts                Canonical §16.21 warning text + field definitions
    warning.ts            Deterministic Government Warning rule (tested)
    verify.ts             Assembles the overall verdict (tested)
    image.ts              Client-side downscaling
    csv.ts                Batch CSV in/out (tested)
scripts/generate-samples.ts   Synthetic test-label generator
tests/                    Vitest unit tests
```

---

## Network & firewall (why the agent's blocked ML endpoints don't matter)

Marcus's warning — *"our network blocks outbound traffic to a lot of domains... half the [vendor's] features didn't work because our firewall blocked connections to their ML endpoints"* — is about the **agent's browser** reaching ML endpoints directly. This app is built so that never happens:

```
Agent's browser ──► the app's own domain ──► (server-side) ──► api.anthropic.com
  (inside the           (one origin to                 (this hop runs in the
   federal network)      allowlist)                     cloud, NOT on the
                                                         agent's network)
```

- The browser makes **exactly one kind of network call**: a same-origin `POST /api/verify` to the app itself. It never connects to `api.anthropic.com`.
- The Anthropic call happens **server-side** (in the Next.js API route, running on Vercel/host infrastructure) — outside the locked-down network entirely. So a firewall that blocks ML endpoints doesn't break anything.
- The app loads **no third-party resources** — no CDN, no Google Fonts, no analytics, no external images (verified). The firewall only needs to allow the **one** app domain.
- The API key lives **only** on the server (env var), never shipped to the browser.

This is the structural difference from the failed vendor pilot: their client reached the ML endpoint directly (and got blocked); here the agent's network only needs to reach one ordinary web app. For a real federal deployment the app would be hosted on an allowlisted/Azure domain — and because the AI sits behind the `VisionProvider` interface, the server-side hop could even be pointed at an on-prem or Azure-hosted model so **no** traffic leaves the network.

## Handling imperfect photos & enhancement

- **The vision model is robust to bad photos** — angled, dark, blurry, glare, low-resolution all usually read fine (see `scripts/degrade-test.ts`).
- **Graceful fallback:** when a photo genuinely can't be read, the result is *unreadable* → **FAIL** with "request a better photo" (matching the agents' current manual fallback) rather than a guessed verdict.
- **One-click enhancement:** if a photo is flagged (unreadable or quality-noted), an **"✨ Enhance photo & re-check"** button re-processes it with brightness/contrast/grayscale adjustment and reads it again — a recovery attempt before the agent gives up. Validate with `scripts/enhance-test.ts`.
- **Why not "AI-enhance" the image?** Deliberately avoided. Using a *generative* model to clean up a label can **invent or alter text** — it could "enhance" a missing warning into a present one. For a compliance tool that verifies what's actually printed, enhancement must be plain, content-preserving signal processing only.

## Tools used

- **Next.js 14 (App Router) + TypeScript** — one deployable app: React UI +
  serverless API route. Simple to run and to deploy.
- **Anthropic Claude (`claude-sonnet-4-6`)** vision via `@anthropic-ai/sdk`,
  using structured outputs.
- **Tailwind CSS** for the clean, high-contrast UI.
- **sharp** to rasterize synthetic SVG test labels.
- **Vitest** for unit tests.

---

## Assumptions & trade-offs

- **Model choice (Sonnet over Opus).** The single hardest constraint here is the
  ~5-second target. I defaulted to `claude-sonnet-4-6` (fast, strong vision and
  judgment) rather than the most capable Opus model, and turned thinking off,
  because latency is the make-or-break requirement for adoption. The model is
  configurable via `ANTHROPIC_MODEL`.
- **Cloud API vs. the federal firewall.** Marcus noted outbound traffic to ML
  endpoints is often blocked. For a **prototype**, calling the Anthropic API is
  the fastest path to a working demo. For production in a locked-down network,
  the `VisionProvider` interface is the seam: drop in an Azure-hosted or on-prem
  vision model behind the same interface and nothing else changes. This is a
  documented limitation, not an oversight.
- **No database / no persistence — by design.** Verification is a pure
  function (image + expected values → verdict), so the app is stateless:
  images and application data are processed in memory for the request and never
  written to disk or a database. This is a deliberate decision, not a missing
  feature — it directly follows Marcus's guidance ("for a prototype, don't do
  anything crazy; we're not storing anything sensitive") and avoids creating a
  system of record that would trigger the PII, document-retention, and federal
  compliance obligations he flagged for production. Batch results live in the
  browser and export to CSV, so agents keep what they need without us retaining
  anything. A production system would add a database *together with* that
  compliance work (decision audit trail, retention rules) — which is exactly
  why it belongs after the prototype.
- **Imperfect photos are handled.** Using a vision model (rather than the
  rigid OCR the prior vendor used) means angled, dark, blurry, glare-affected,
  and low-resolution photos are usually still readable. Run
  `npx tsx scripts/degrade-test.ts` to see it: a clean label is rotated,
  darkened, blurred, given glare, and JPEG-crushed, and the model still reads
  every field — flagging the quality and returning **NEEDS REVIEW** rather than
  failing. Only when a label genuinely can't be read does it return
  unreadable and ask for a better photo (the current manual fallback). Type-size
  legibility is surfaced as a review flag, not an automatic rejection.
- **`not_found` for a provided field is treated as FAIL.** If the agent entered
  an expected value and it isn't on the label, that's a real discrepancy. Easy
  to relax to "review" if policy prefers.
- **The warning rule is US TTB-specific** and currently covers the standard
  §16.21 statement. Type-size measurement (vs. the model's legibility flag) and
  per-beverage exemptions (e.g. ABV-optional cases) would be next.
- **Batch matching is by filename.** A real integration would pull application
  data from COLA rather than a CSV; the CSV stands in for that data source.

---

## Deployment

Deployed on **Vercel**. Set `ANTHROPIC_API_KEY` (and optionally
`ANTHROPIC_MODEL`) as environment variables in the Vercel project settings. The
deployed URL is at the top of the repository / project submission.
