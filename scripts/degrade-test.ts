/**
 * Demonstrates robustness to imperfect photos (Jenny's ask): takes a clean
 * sample label, degrades it (rotation, low light, blur, glare, JPEG
 * compression), and runs it through the real vision provider.
 * Writes the degraded image to public/samples/degraded-bourbon.jpg so it can
 * also be tried in the app.
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

async function main() {
  const src = join(SAMPLES, "good-bourbon.png");

  // Glare: a bright off-center radial highlight, like a reflection on glass.
  const glare = Buffer.from(
    `<svg width="600" height="800"><defs><radialGradient id="g" cx="38%" cy="28%" r="45%">` +
      `<stop offset="0%" stop-color="white" stop-opacity="0.9"/>` +
      `<stop offset="100%" stop-color="white" stop-opacity="0"/></radialGradient></defs>` +
      `<rect width="600" height="800" fill="url(#g)"/></svg>`,
  );

  const glared = await sharp(src)
    .composite([{ input: glare, blend: "screen" }])
    .toBuffer();

  // Then: dim lighting, slight blur, off-axis rotation, downscale, low-quality JPEG.
  const degraded = await sharp(glared)
    .modulate({ brightness: 0.6 }) // poor lighting
    .blur(1.6) // soft focus
    .rotate(9, { background: { r: 30, g: 30, b: 30 } }) // weird angle
    .resize(520) // small phone capture
    .jpeg({ quality: 42 }) // compression artifacts
    .toBuffer();

  writeFileSync(join(SAMPLES, "degraded-bourbon.jpg"), degraded);
  console.log("Wrote public/samples/degraded-bourbon.jpg\n");

  const provider = new AnthropicProvider();
  const t0 = Date.now();
  const extraction = await provider.extract(
    { data: degraded.toString("base64"), mediaType: "image/jpeg" },
    app,
  );
  const result = buildResult(extraction, app);
  const ms = Date.now() - t0;

  console.log(`Model: ${provider.model}   (${ms}ms)`);
  console.log(`imageReadable: ${result.imageReadable}`);
  console.log(`imageNotes: ${result.imageNotes || "(none)"}`);
  console.log(`verdict: ${result.verdict.toUpperCase()}\n`);
  console.log("Read off the degraded label:");
  for (const [k, v] of Object.entries(result.extracted)) {
    console.log(`  ${k.padEnd(20)} ${v ?? "(not found)"}`);
  }
  console.log("\nField checks:");
  for (const f of result.fields) {
    console.log(`  ${f.field.padEnd(22)} ${f.status}`);
  }
  console.log(`\nGovernment Warning: ${result.warning.status}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
