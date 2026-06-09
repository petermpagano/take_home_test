/**
 * Live end-to-end smoke test: runs each generated sample label through the real
 * vision provider + verdict logic, and checks the verdict + latency.
 * Run: npx tsx scripts/smoke.ts   (requires ANTHROPIC_API_KEY in .env.local)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AnthropicProvider } from "../src/lib/provider";
import { buildResult } from "../src/lib/verify";
import type { ApplicationData } from "../src/lib/types";

// Minimal .env.local loader (standalone scripts don't get Next's env loading).
for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const SAMPLES_DIR = join(process.cwd(), "public", "samples");

const CASES: { file: string; expect: string; app: ApplicationData }[] = [
  {
    file: "good-bourbon.png",
    expect: "pass",
    app: {
      beverageType: "spirits",
      brandName: "Old Tom Distillery",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
    },
  },
  {
    file: "abv-mismatch.png",
    expect: "fail",
    app: {
      beverageType: "spirits",
      brandName: "Old Tom Distillery",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
    },
  },
  {
    file: "bad-warning-titlecase.png",
    expect: "fail",
    app: { beverageType: "spirits", brandName: "Riverbend Reserve" },
  },
  {
    file: "missing-warning.png",
    expect: "fail",
    app: { beverageType: "wine", brandName: "Sunset Cellars" },
  },
];

async function main() {
  const provider = new AnthropicProvider();
  console.log(`Model: ${provider.model}\n`);
  let passed = 0;

  for (const c of CASES) {
    const data = readFileSync(join(SAMPLES_DIR, c.file)).toString("base64");
    const t0 = Date.now();
    const extraction = await provider.extract(
      { data, mediaType: "image/png" },
      c.app,
    );
    const result = buildResult(extraction, c.app);
    const ms = Date.now() - t0;
    const ok = result.verdict === c.expect;
    if (ok) passed++;
    console.log(
      `${ok ? "✓" : "✗"} ${c.file.padEnd(28)} verdict=${result.verdict.toUpperCase().padEnd(7)} ` +
        `warning=${result.warning.status.padEnd(9)} ${ms}ms ${ok ? "" : `(expected ${c.expect})`}`,
    );
    if (!ok || result.warning.issues.length) {
      result.warning.issues.forEach((i) => console.log(`    warning: ${i}`));
      result.fields
        .filter((f) => f.status !== "match")
        .forEach((f) => console.log(`    field ${f.field}: ${f.status} — ${f.note}`));
    }
  }

  console.log(`\n${passed}/${CASES.length} cases matched expected verdict.`);
  process.exit(passed === CASES.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
