import { describe, expect, it } from "vitest";
import { buildResult } from "@/lib/verify";
import { GOVERNMENT_WARNING_TEXT } from "@/lib/ttb";
import type { ApplicationData, ModelExtraction } from "@/lib/types";

const app: ApplicationData = {
  beverageType: "spirits",
  brandName: "Old Tom Distillery",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
};

function extraction(over: Partial<ModelExtraction> = {}): ModelExtraction {
  return {
    beverageType: "spirits",
    imageReadable: true,
    imageNotes: "",
    extracted: {
      brandName: "OLD TOM DISTILLERY",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
      producerNameAddress: null,
      countryOfOrigin: null,
    },
    comparisons: [
      {
        key: "brandName",
        expected: "Old Tom Distillery",
        found: "OLD TOM DISTILLERY",
        status: "match",
        note: "Case differs only.",
      },
    ],
    governmentWarning: {
      present: true,
      verbatimText: GOVERNMENT_WARNING_TEXT,
      prefixAllCaps: true,
      prefixBold: true,
      legibilityConcern: false,
    },
    ...over,
  };
}

describe("buildResult verdict logic", () => {
  it("PASS when all fields match and warning is compliant", () => {
    expect(buildResult(extraction(), app).verdict).toBe("pass");
  });

  it("maps the human-readable field label", () => {
    const r = buildResult(extraction(), app);
    expect(r.fields[0].field).toBe("Brand Name");
  });

  it("FAIL on a field mismatch", () => {
    const r = buildResult(
      extraction({
        comparisons: [
          {
            key: "alcoholContent",
            expected: "45% Alc./Vol.",
            found: "50% Alc./Vol.",
            status: "mismatch",
            note: "Different ABV.",
          },
        ],
      }),
      app,
    );
    expect(r.verdict).toBe("fail");
  });

  it("REVIEW when a field needs a human look (warning still ok)", () => {
    const r = buildResult(
      extraction({
        comparisons: [
          {
            key: "brandName",
            expected: "Old Tom Distillery",
            found: "Old Tomm Distillery",
            status: "review",
            note: "Possible typo — confirm.",
          },
        ],
      }),
      app,
    );
    expect(r.verdict).toBe("review");
  });

  it("FAIL when the image is unreadable", () => {
    const r = buildResult(
      extraction({ imageReadable: false, imageNotes: "Too blurry" }),
      app,
    );
    expect(r.verdict).toBe("fail");
  });

  it("FAIL when the warning is non-compliant even if fields match", () => {
    const r = buildResult(
      extraction({
        governmentWarning: {
          present: true,
          verbatimText: GOVERNMENT_WARNING_TEXT,
          prefixAllCaps: false,
          prefixBold: true,
          legibilityConcern: false,
        },
      }),
      app,
    );
    expect(r.verdict).toBe("fail");
  });
});
