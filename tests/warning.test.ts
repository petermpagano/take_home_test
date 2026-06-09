import { describe, expect, it } from "vitest";
import { normalize, verifyWarning } from "@/lib/warning";
import { GOVERNMENT_WARNING_TEXT } from "@/lib/ttb";
import type { ModelExtraction } from "@/lib/types";

type GW = ModelExtraction["governmentWarning"];

const compliant: GW = {
  present: true,
  verbatimText: GOVERNMENT_WARNING_TEXT,
  prefixAllCaps: true,
  prefixBold: true,
  legibilityConcern: false,
};

describe("normalize", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalize("  GOVERNMENT   WARNING:\n foo ")).toBe(
      "government warning: foo",
    );
  });
  it("normalizes curly quotes and dashes", () => {
    expect(normalize("women’s—health")).toBe("women's-health");
  });
});

describe("verifyWarning", () => {
  it("passes a fully compliant warning", () => {
    const r = verifyWarning(compliant);
    expect(r.status).toBe("match");
    expect(r.issues).toHaveLength(0);
  });

  it("fails when the warning is missing entirely", () => {
    const r = verifyWarning({
      present: false,
      verbatimText: null,
      prefixAllCaps: false,
      prefixBold: false,
      legibilityConcern: false,
    });
    expect(r.status).toBe("mismatch");
    expect(r.present).toBe(false);
  });

  it("fails when the prefix is title case (not all caps)", () => {
    const r = verifyWarning({
      ...compliant,
      verbatimText: GOVERNMENT_WARNING_TEXT.replace(
        "GOVERNMENT WARNING:",
        "Government Warning:",
      ),
      prefixAllCaps: false,
    });
    expect(r.status).toBe("mismatch");
    expect(r.issues.join(" ")).toMatch(/capital letters/i);
  });

  it("fails when the prefix is not bold", () => {
    const r = verifyWarning({ ...compliant, prefixBold: false });
    expect(r.status).toBe("mismatch");
    expect(r.issues.join(" ")).toMatch(/bold/i);
  });

  it("fails when a mandatory statement is reworded", () => {
    const r = verifyWarning({
      ...compliant,
      verbatimText: GOVERNMENT_WARNING_TEXT.replace(
        "birth defects",
        "health issues",
      ),
    });
    expect(r.status).toBe("mismatch");
    expect(r.issues.join(" ")).toMatch(/word-for-word/i);
  });

  it("tolerates case and spacing differences in the body text", () => {
    const r = verifyWarning({
      ...compliant,
      verbatimText: GOVERNMENT_WARNING_TEXT.toUpperCase().replace(/\s+/g, "  "),
    });
    expect(r.status).toBe("match");
  });

  it("flags a legibility concern", () => {
    const r = verifyWarning({ ...compliant, legibilityConcern: true });
    expect(r.status).toBe("mismatch");
    expect(r.issues.join(" ")).toMatch(/small|hard to read/i);
  });
});
