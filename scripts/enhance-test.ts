/**
 * Validates that deterministic enhancement (brightness/contrast/grayscale —
 * the same operations the browser applies via canvas) can recover an
 * underexposed-but-intact label that the model otherwise struggles to read.
 * No generative AI is used — enhancement must never invent label content.
 *   npx tsx scripts/enhance-test.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { AnthropicProvider } from "../src/lib/provider";
import { buildResult } from "../src/lib/verify";
import type { ApplicationData } from "../src/lib/types";

for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const app: ApplicationData = {
  beverageType: "spirits",
  brandName: "Old Tom Distillery",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
};

const provider = new AnthropicProvider();

async function check(label: string, buf: Buffer) {
  const result = buildResult(
    await provider.extract({ data: buf.toString("base64"), mediaType: "image/jpeg" }, app),
    app,
  );
  console.log(`\n=== ${label} ===`);
  console.log(`imageReadable: ${result.imageReadable}  verdict: ${result.verdict.toUpperCase()}`);
  console.log(`notes: ${result.imageNotes || "(none)"}`);
  console.log("read:", Object.entries(result.extracted)
    .filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(" | ") || "(nothing)");
}

async function main() {
  const src = join(process.cwd(), "public", "samples", "good-bourbon.png");

  // Underexposed but otherwise intact (detail is present, just dark).
  const dark = await sharp(src)
    .modulate({ brightness: 0.3 })
    .resize(480)
    .jpeg({ quality: 60 })
    .toBuffer();

  // Deterministic enhancement: grayscale + contrast + brightness — the same
  // class of operation the browser canvas filter applies. No new content.
  const enhanced = await sharp(dark)
    .grayscale()
    .linear(1.5, 0) // contrast (multiply)
    .modulate({ brightness: 1.9 }) // lift exposure
    .sharpen()
    .jpeg({ quality: 85 })
    .toBuffer();

  await check("DARK (as captured)", dark);
  await check("AFTER ENHANCEMENT", enhanced);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
