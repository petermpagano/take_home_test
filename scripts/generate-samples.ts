/**
 * Generates synthetic alcohol-label PNGs under public/samples for testing and
 * demos. Each label exercises a different compliance scenario. Run with:
 *   npm run generate:samples
 *
 * These are deterministic SVG renders (no external AI image tools needed), so
 * the test set is reproducible.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const OUT = join(process.cwd(), "public", "samples");

const WARNING_LINES = [
  "(1) According to the Surgeon General, women should not drink",
  "alcoholic beverages during pregnancy because of the risk of birth",
  "defects. (2) Consumption of alcoholic beverages impairs your ability",
  "to drive a car or operate machinery, and may cause health problems.",
];

interface LabelSpec {
  brand: string;
  classType: string;
  alcohol: string;
  netContents: string;
  producer: string;
  /** "good" = all-caps bold prefix; "titlecase" = non-compliant; "none" = omitted. */
  warning: "good" | "titlecase" | "none";
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function svg(spec: LabelSpec): string {
  let warningBlock = "";
  if (spec.warning !== "none") {
    const prefix =
      spec.warning === "good"
        ? `<tspan font-weight="bold">GOVERNMENT WARNING:</tspan>`
        : `<tspan>Government Warning:</tspan>`;
    warningBlock = `
      <text x="50" y="615" font-size="14" fill="#222" font-family="Georgia, serif">${prefix} ${esc(WARNING_LINES[0])}</text>
      ${WARNING_LINES.slice(1)
        .map(
          (ln, i) =>
            `<text x="50" y="${635 + i * 20}" font-size="14" fill="#222" font-family="Georgia, serif">${esc(ln)}</text>`,
        )
        .join("\n")}`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
  <rect width="600" height="800" fill="#f7f3e9"/>
  <rect x="20" y="20" width="560" height="760" fill="none" stroke="#3a2e1f" stroke-width="4"/>
  <text x="300" y="150" text-anchor="middle" font-size="44" font-weight="bold" fill="#3a2e1f" font-family="Georgia, serif">${esc(spec.brand)}</text>
  <text x="300" y="220" text-anchor="middle" font-size="24" fill="#5a4a33" font-family="Georgia, serif">${esc(spec.classType)}</text>
  <line x1="120" y1="260" x2="480" y2="260" stroke="#8a7a5a" stroke-width="2"/>
  <text x="300" y="330" text-anchor="middle" font-size="28" fill="#3a2e1f" font-family="Georgia, serif">${esc(spec.alcohol)}</text>
  <text x="300" y="380" text-anchor="middle" font-size="22" fill="#3a2e1f" font-family="Georgia, serif">${esc(spec.netContents)}</text>
  <text x="300" y="470" text-anchor="middle" font-size="16" fill="#5a4a33" font-family="Georgia, serif">${esc(spec.producer)}</text>
  ${warningBlock}
</svg>`;
}

const SAMPLES: Record<string, LabelSpec> = {
  // Fully compliant — should PASS against the matching CSV row.
  "good-bourbon.png": {
    brand: "OLD TOM DISTILLERY",
    classType: "Kentucky Straight Bourbon Whiskey",
    alcohol: "45% Alc./Vol. (90 Proof)",
    netContents: "750 mL",
    producer: "Bottled by Old Tom Distillery, Bardstown, KY",
    warning: "good",
  },
  // Warning printed in title case, not bold — should FAIL the warning check.
  "bad-warning-titlecase.png": {
    brand: "RIVERBEND RESERVE",
    classType: "Tennessee Whiskey",
    alcohol: "40% Alc./Vol. (80 Proof)",
    netContents: "750 mL",
    producer: "Distilled & bottled by Riverbend, Lynchburg, TN",
    warning: "titlecase",
  },
  // ABV on label differs from the application — should be a MISMATCH.
  "abv-mismatch.png": {
    brand: "OLD TOM DISTILLERY",
    classType: "Kentucky Straight Bourbon Whiskey",
    alcohol: "50% Alc./Vol. (100 Proof)",
    netContents: "750 mL",
    producer: "Bottled by Old Tom Distillery, Bardstown, KY",
    warning: "good",
  },
  // No government warning at all — should FAIL.
  "missing-warning.png": {
    brand: "SUNSET CELLARS",
    classType: "Napa Valley Cabernet Sauvignon",
    alcohol: "13.5% Alc./Vol.",
    netContents: "750 mL",
    producer: "Produced & bottled by Sunset Cellars, Napa, CA",
    warning: "none",
  },
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const [name, spec] of Object.entries(SAMPLES)) {
    const buf = Buffer.from(svg(spec));
    await sharp(buf).png().toFile(join(OUT, name));
    console.log("wrote", name);
  }
  console.log(`\nDone. ${Object.keys(SAMPLES).length} sample labels in ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
