import type { ApplicationData } from "./types";

/**
 * The mandatory Government Health Warning Statement, verbatim per 27 CFR §16.21.
 * The "GOVERNMENT WARNING:" prefix must additionally appear in capital letters
 * and bold type on the label (27 CFR §16.22).
 */
export const GOVERNMENT_WARNING_TEXT =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not " +
  "drink alcoholic beverages during pregnancy because of the risk of birth " +
  "defects. (2) Consumption of alcoholic beverages impairs your ability to " +
  "drive a car or operate machinery, and may cause health problems.";

/** The two mandatory statements, normalized for comparison. */
export const WARNING_STATEMENTS = [
  "according to the surgeon general, women should not drink alcoholic " +
    "beverages during pregnancy because of the risk of birth defects.",
  "consumption of alcoholic beverages impairs your ability to drive a car or " +
    "operate machinery, and may cause health problems.",
];

/** Field definitions used to drive both the form and the comparison output. */
export const FIELD_DEFS: {
  key: keyof ApplicationData;
  label: string;
  placeholder: string;
  helper: string;
}[] = [
  {
    key: "brandName",
    label: "Brand Name",
    placeholder: "OLD TOM DISTILLERY",
    helper: "The brand name as written on the application.",
  },
  {
    key: "classType",
    label: "Class / Type Designation",
    placeholder: "Kentucky Straight Bourbon Whiskey",
    helper: "e.g. Kentucky Straight Bourbon Whiskey, Cabernet Sauvignon, IPA.",
  },
  {
    key: "alcoholContent",
    label: "Alcohol Content",
    placeholder: "45% Alc./Vol. (90 Proof)",
    helper: "ABV, and proof for spirits.",
  },
  {
    key: "netContents",
    label: "Net Contents",
    placeholder: "750 mL",
    helper: "e.g. 750 mL, 12 FL OZ.",
  },
  {
    key: "producerNameAddress",
    label: "Bottler / Producer Name & Address",
    placeholder: "Bottled by Old Tom Distillery, Bardstown, KY",
    helper: "Optional.",
  },
  {
    key: "countryOfOrigin",
    label: "Country of Origin",
    placeholder: "Product of Scotland",
    helper: "Optional — required for imports.",
  },
];
