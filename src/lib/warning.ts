import { WARNING_STATEMENTS } from "./ttb";
import type { ModelExtraction, WarningResult } from "./types";

/** Lowercase, collapse whitespace, normalize curly quotes/dashes for comparison. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’‛]/g, "'") // curly single quotes -> '
    .replace(/[“”]/g, '"') // curly double quotes -> "
    .replace(/[–—]/g, "-") // en/em dash -> -
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Verify the Government Warning against 27 CFR §16.21 / §16.22.
 *
 * This is intentionally deterministic: the vision model reports what it *saw*
 * (the verbatim text plus formatting observations), and this function owns the
 * compliance *decision*. That keeps the pass/fail rule auditable and testable,
 * rather than trusting the model's judgment on a rule that must be exact.
 */
export function verifyWarning(
  gw: ModelExtraction["governmentWarning"],
): WarningResult {
  const issues: string[] = [];

  if (!gw.present || !gw.verbatimText || gw.verbatimText.trim() === "") {
    return {
      present: false,
      status: "mismatch",
      foundText: gw.verbatimText ?? null,
      prefixAllCaps: false,
      prefixBold: false,
      legibilityConcern: gw.legibilityConcern,
      issues: ["No Government Warning statement found on the label."],
      note: "The mandatory Government Warning is missing. This is a required element on all alcohol beverage labels.",
    };
  }

  const found = gw.verbatimText ?? "";
  const normalized = normalize(found);

  // 1. The "GOVERNMENT WARNING:" prefix must be present.
  const hasPrefix = /government\s+warning\s*:/i.test(found);
  if (!hasPrefix) {
    issues.push('Missing the "GOVERNMENT WARNING:" heading.');
  }

  // 2. The prefix must be in capital letters and bold (27 CFR §16.22).
  if (!gw.prefixAllCaps) {
    issues.push(
      'The "GOVERNMENT WARNING:" heading is not in all capital letters (it must be).',
    );
  }
  if (!gw.prefixBold) {
    issues.push(
      'The "GOVERNMENT WARNING:" heading does not appear bold (it must be bold).',
    );
  }

  // 3. Both mandatory statements must be present, word-for-word.
  WARNING_STATEMENTS.forEach((statement, i) => {
    if (!normalized.includes(statement)) {
      issues.push(
        `Statement (${i + 1}) does not match the required wording word-for-word.`,
      );
    }
  });

  // 4. Legibility / type-size concern flagged by the model.
  if (gw.legibilityConcern) {
    issues.push(
      "The warning text may be too small or hard to read — verify type size meets requirements.",
    );
  }

  const status: WarningResult["status"] =
    issues.length === 0 ? "match" : "mismatch";

  return {
    present: true,
    status,
    foundText: found,
    prefixAllCaps: gw.prefixAllCaps,
    prefixBold: gw.prefixBold,
    legibilityConcern: gw.legibilityConcern,
    issues,
    note:
      status === "match"
        ? "Government Warning is present and matches the required wording and formatting."
        : "Government Warning has compliance issues — see details.",
  };
}
