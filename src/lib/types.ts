// Shared types for the TTB label verification flow.

export type BeverageType = "beer" | "wine" | "spirits" | "unknown";

/** The fields an agent enters from the COLA application, to check against the label. */
export interface ApplicationData {
  beverageType: BeverageType;
  brandName?: string;
  classType?: string;
  alcoholContent?: string;
  netContents?: string;
  producerNameAddress?: string;
  countryOfOrigin?: string;
}

export type FieldStatus = "match" | "review" | "mismatch" | "not_found";

/** Per-field comparison between the application value and what the label shows. */
export interface FieldComparison {
  field: string; // human-readable field label, e.g. "Brand Name"
  key: keyof ApplicationData;
  expected: string;
  found: string | null; // what was read off the label (null = not present)
  status: FieldStatus;
  note: string; // plain-language explanation of the verdict
}

/** Result of the dedicated Government Warning compliance check (27 CFR §16.21). */
export interface WarningResult {
  present: boolean;
  status: FieldStatus;
  foundText: string | null;
  prefixAllCaps: boolean;
  prefixBold: boolean;
  legibilityConcern: boolean;
  issues: string[]; // specific compliance problems found
  note: string;
}

export type OverallVerdict = "pass" | "review" | "fail";

/** The model's reading of each standard field off the label (verbatim, null if absent). */
export interface ExtractedFields {
  brandName: string | null;
  classType: string | null;
  alcoholContent: string | null;
  netContents: string | null;
  producerNameAddress: string | null;
  countryOfOrigin: string | null;
}

export interface VerificationResult {
  verdict: OverallVerdict;
  beverageType: BeverageType;
  imageReadable: boolean;
  imageNotes: string;
  fields: FieldComparison[];
  warning: WarningResult;
  /** What the AI read off the label, for each standard field (used to auto-fill the form). */
  extracted: ExtractedFields;
  /** Server-side processing time in milliseconds (proves the speed target). */
  elapsedMs: number;
  model: string;
}

/** Shape returned by the vision model (structured output). */
export interface ModelExtraction {
  beverageType: BeverageType;
  imageReadable: boolean;
  imageNotes: string;
  extracted: ExtractedFields;
  comparisons: {
    key: string;
    expected: string;
    found: string | null;
    status: FieldStatus;
    note: string;
  }[];
  governmentWarning: {
    present: boolean;
    verbatimText: string | null;
    prefixAllCaps: boolean;
    prefixBold: boolean;
    legibilityConcern: boolean;
  };
}
