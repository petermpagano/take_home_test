# Approach & Design Notes

A short tour of the thinking behind this prototype, for reviewers. Setup and
full feature docs are in the [README](./README.md); this focuses on *decisions
and why*.

## Framing

The interview notes describe a team drowning in routine matching ("is the
number on the form the same as the number on the label?"), burned by a slow
scanning vendor, serving agents with a wide range of tech comfort, and sitting
behind a restrictive federal network. I treated four things as the real
acceptance criteria — not just "build a label checker":

1. **Speed** — results in ~5s or agents won't use it (the vendor died at 30–40s).
2. **Simplicity** — usable by a 73-year-old; one obvious action per screen.
3. **Judgment, not brittle matching** — `STONE'S THROW` = `Stone's Throw`.
4. **The Government Warning is exact** — wording + ALL-CAPS, bold heading.

Everything below follows from those.

## Key decisions

**Vision LLM, not OCR + rules.** A vision model reads imperfect photos *and*
applies judgment in one step. The prior vendor's rigid OCR is exactly what
failed; brittle string-equality is exactly what Dave warned about. This is the
core bet, and it's what makes the "good enough" matching actually good.

**Claude Sonnet 4.6, thinking off.** The binding constraint is latency. Sonnet
is fast and strong at vision/judgment; with thinking disabled and the image
downscaled client-side, steady-state is ~4s — under the 5s bar. The model is
configurable via `ANTHROPIC_MODEL`, so quality/latency can be re-tuned.

**Perception vs. compliance are split on purpose.** The model *perceives*
(reads the label, judges fuzzy matches) and *reports* what it saw. A
**deterministic function** (`src/lib/warning.ts`) owns the Government Warning
pass/fail decision against the exact 27 CFR §16.21 text. A compliance rule that
must be exact shouldn't be left to model discretion — so it lives in code that
is auditable and unit-tested. This division is the heart of the design.

**Structured output.** The vision call is constrained to a JSON schema, so the
server always gets valid, typed data — no fragile parsing of free text.

**Stateless — no database, by design.** Verification is a pure function, so
nothing is persisted. This follows Marcus's "don't store anything sensitive"
guidance *and* avoids creating a system of record that triggers PII/retention/
federal-compliance obligations. A DB belongs in production *with* that
compliance work, not in a prototype.

**Network-safe architecture.** The browser only calls the app's own origin; the
ML endpoint is reached server-side, off the federal network, and no
third-party resources load. The firewall that blocked the vendor's ML endpoints
doesn't affect this app — it only needs to allow one domain. The
`VisionProvider` interface is the seam for swapping in an on-prem/Azure model
later.

## How the verdict is built

```
image + expected values
   └─► Claude (structured output): extracted fields, per-field judgment,
        verbatim warning text + formatting flags, image-quality read
            └─► buildResult(): map comparisons → verify warning (deterministic)
                 → PASS / NEEDS REVIEW / FAIL
```

- **PASS** — every provided field matches and the warning is compliant.
- **NEEDS REVIEW** — something a human should glance at (a borderline field, or
  a legibility concern on an otherwise-correct warning).
- **FAIL** — a real mismatch, a non-compliant warning, or an unreadable image.

"Review vs. fail" matters: a hard-to-read warning is *review* ("confirm the type
size"), while wrong wording or a non-caps/non-bold heading is a hard *fail*.

## UX choices

Large type, color **and** text labels (not color alone), one primary action per
screen, an obvious upload zone, processing time shown on every result (to prove
the speed promise), and — after a verdict — a clear "Verify another label" so an
agent is never at a dead end. After verifying, the form auto-fills with what the
AI read, so the agent reviews extracted values in place.

## Going beyond the brief

- **Batch mode** — 200–300 labels at peak; parallel processing, CSV in/out.
- **Imperfect-photo handling** — robust to angle/glare/low light; graceful
  "request a better photo" when truly illegible; one-click brightness/contrast
  **enhancement** to recover marginal photos (deterministic only — a generative
  "enhance" could fabricate label text, which is disqualifying for compliance).
- **Synthetic test fixtures** — reproducible labels for the pass/fail/mismatch/
  unreadable cases, plus a live end-to-end smoke test (`scripts/smoke.ts`).

## Trade-offs & limitations

- Cloud API for the prototype; production would swap the provider for an
  on-prem/Azure model behind the same interface.
- The warning check covers the standard §16.21 statement; type-size measurement
  and per-beverage exemptions (e.g. ABV-optional cases) are next.
- Batch matching is by filename (CSV stands in for the COLA data source).
- A provided field that's absent from the label is treated as FAIL; easy to
  relax to REVIEW if policy prefers.
- First request after a cold start / 24h idle is slower (~10–15s) due to
  one-time structured-output schema compilation; steady-state is ~4s.

## What I'd do next

COLA data integration (replacing the CSV), a persisted decision audit trail
(with the retention/PII work that implies), type-size measurement for the
warning, confidence scores surfaced per field, and an on-prem model evaluation
for the locked-down network.

## Tests

`npm test` — deterministic logic (warning rule, verdict assembly, CSV).
`scripts/smoke.ts`, `scripts/degrade-test.ts`, `scripts/enhance-test.ts` — live
end-to-end checks against the real model.
