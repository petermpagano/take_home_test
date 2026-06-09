/**
 * Demonstrates robustness to imperfect photos (Jenny's ask) AND the graceful
 * "request a better photo" fallback. Generates two degraded versions of a
 * clean label — one rough-but-readable, one genuinely unreadable — and runs
 * each through the real vision provider.
 *
 * Writes both to public/samples/ so they can be tried in the app.
 *   npx tsx scripts/degrade-test.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { AnthropicProvider } from "../src/lib/provider";
import { buildResult } from "../src/lib/verify";
import type { ApplicationData } from "../src/lib/types";

for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const SAMPLES = join(process.cwd(), "public", "samples");

const app: ApplicationData = {
  beverageType: "spirits",
  brandName: "Old Tom Distillery",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
};

function glareSvg(): Buffer {
  return Buffer.from(
    `<svg width="600" height="800"><defs><radialGradient id="g" cx="38%" cy="28%" r="45%">` +
      `<stop offset="0%" stop-color="white" stop-opacity="0.95"/>` +
      `<stop offset="100%" stop-color="white" stop-opacity="0"/></radialGradient></defs>` +
      `<rect width="600" height="800" fill="url(#g)"/></svg>`,
  );
}

interface Degradation {
  brightness: number;
  blur: number;
  rotate: number;
  resize: number;
  quality: number;
}

async function degrade(src: string, d: Degradation): Promise<Buffer> {
  const glared = await sharp(src)
    .composite([{ input: glareSvg(), blend: "screen" }])
    .toBuffer();
  return sharp(glared)
    .modulate({ brightness: d.brightness })
    .blur(d.blur)
    .rotate(d.rotate, { background: { r: 20, g: 20, b: 20 } })
    .resize(d.resize)
    .jpeg({ quality: d.quality })
    .toBuffer();
}

async function run(label: string, file: string, buf: Buffer) {
  writeFileSync(join(SAMPLES, file), buf);
  const provider = new AnthropicProvider();
  const t0 = Date.now();
  const result = buildResult(
    await provider.extract({ data: buf.toString("base64"), mediaType: "image/jpeg" }, app),
    app,
  );
  const ms = Date.now() - t0;
  console.log(`\n=== ${label}  (${file}, ${(buf.length / 1024) | 0} KB, ${ms}ms) ===`);
  console.log(`imageReadable: ${result.imageReadable}`);
  console.log(`verdict:       ${result.verdict.toUpperCase()}`);
  console.log(`imageNotes:    ${result.imageNotes || "(none)"}`);
  if (result.imageReadable) {
    console.log("read:", Object.entries(result.extracted)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${v}`)
      .join(" | "));
  } else {
    console.log("→ app shows: “The label image could not be read clearly. " +
      "Please request a better photo.”");
  }
}

async function main() {
  const src = join(SAMPLES, "good-bourbon.png");

  await run(
    "ROUGH BUT READABLE",
    "degraded-bourbon.jpg",
    await degrade(src, { brightness: 0.6, blur: 1.6, rotate: 9, resize: 520, quality: 42 }),
  );

  await run(
    "TOO FAR GONE",
    "unreadable-bourbon.jpg",
    await degrade(src, { brightness: 0.22, blur: 7, rotate: 22, resize: 150, quality: 12 }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
