import { FIELD_DEFS } from "./ttb";
import { verifyWarning } from "./warning";
import type {
  ApplicationData,
  FieldComparison,
  ModelExtraction,
  OverallVerdict,
  VerificationResult,
} from "./types";

const LABELS = new Map(FIELD_DEFS.map((f) => [f.key as string, f.label]));

/**
 * Combine the model's perception with the deterministic warning rule into a
 * single, auditable verdict.
 *
 * Verdict logic:
 *   FAIL   → any field mismatch, the warning fails, or the image is unreadable.
 *   REVIEW → any field needs a human look, or there's a legibility concern.
 *   PASS   → everything matches and the warning is compliant.
 */
export function buildResult(
  extraction: ModelExtraction,
  application: ApplicationData,
): Omit<VerificationResult, "elapsedMs" | "model"> {
  const fields: FieldComparison[] = extraction.comparisons.map((c) => ({
    field: LABELS.get(c.key) ?? c.key,
    key: c.key as keyof ApplicationData,
    expected: c.expected,
    found: c.found,
    status: c.status,
    note: c.note,
  }));

  const warning = verifyWarning(extraction.governmentWarning);

  let verdict: OverallVerdict = "pass";
  if (!extraction.imageReadable) {
    verdict = "fail";
  } else if (
    fields.some((f) => f.status === "mismatch" || f.status === "not_found") ||
    warning.status === "mismatch"
  ) {
    verdict = "fail";
  } else if (fields.some((f) => f.status === "review")) {
    verdict = "review";
  }

  return {
    verdict,
    beverageType: extraction.beverageType,
    imageReadable: extraction.imageReadable,
    imageNotes: extraction.imageNotes,
    fields,
    warning,
  };
}
