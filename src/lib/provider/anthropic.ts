import Anthropic from "@anthropic-ai/sdk";
import { FIELD_DEFS, GOVERNMENT_WARNING_TEXT } from "../ttb";
import type { ApplicationData, ModelExtraction } from "../types";
import type { LabelImage, VisionProvider } from "./index";

const DEFAULT_MODEL = "claude-sonnet-4-6";

// JSON schema for structured output. Every object sets additionalProperties:false
// (required by the structured-outputs feature).
const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    beverageType: {
      type: "string",
      enum: ["beer", "wine", "spirits", "unknown"],
    },
    imageReadable: { type: "boolean" },
    imageNotes: {
      type: "string",
      description:
        "Brief note on image quality (angle, glare, blur). Empty string if the image is clean.",
    },
    extracted: {
      type: "object",
      additionalProperties: false,
      description:
        "What you read off the label for each standard field, verbatim. null if the field is absent. Always fill this in regardless of which expected values were provided.",
      properties: {
        brandName: { type: ["string", "null"] },
        classType: { type: ["string", "null"] },
        alcoholContent: { type: ["string", "null"] },
        netContents: { type: ["string", "null"] },
        producerNameAddress: { type: ["string", "null"] },
        countryOfOrigin: { type: ["string", "null"] },
      },
      required: [
        "brandName",
        "classType",
        "alcoholContent",
        "netContents",
        "producerNameAddress",
        "countryOfOrigin",
      ],
    },
    comparisons: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: { type: "string" },
          expected: { type: "string" },
          found: { type: ["string", "null"] },
          status: {
            type: "string",
            enum: ["match", "review", "mismatch", "not_found"],
          },
          note: { type: "string" },
        },
        required: ["key", "expected", "found", "status", "note"],
      },
    },
    governmentWarning: {
      type: "object",
      additionalProperties: false,
      properties: {
        present: { type: "boolean" },
        verbatimText: { type: ["string", "null"] },
        prefixAllCaps: { type: "boolean" },
        prefixBold: { type: "boolean" },
        legibilityConcern: { type: "boolean" },
      },
      required: [
        "present",
        "verbatimText",
        "prefixAllCaps",
        "prefixBold",
        "legibilityConcern",
      ],
    },
  },
  required: [
    "beverageType",
    "imageReadable",
    "imageNotes",
    "extracted",
    "comparisons",
    "governmentWarning",
  ],
} as const;

function buildPrompt(application: ApplicationData): string {
  const provided = FIELD_DEFS.filter((f) => {
    const v = application[f.key];
    return typeof v === "string" && v.trim() !== "";
  }).map((f) => `  - key="${f.key}" (${f.label}): expected = "${application[f.key]}"`);

  return `You are a TTB (Alcohol and Tobacco Tax and Trade Bureau) compliance assistant. A label reviewer has uploaded a photo of an alcohol beverage label and the data from its COLA application. Your job is to read the label and compare it to the application.

The photo may be imperfect — taken at an angle, with glare, or under poor lighting. Do your best to read it. Only set imageReadable=false if the label genuinely cannot be read.

EXPECTED APPLICATION VALUES (compare each against what the label shows):
${provided.length ? provided.join("\n") : "  (none provided — extraction only)"}

Always fill in "extracted" with what the label shows for every standard field (brandName, classType, alcoholContent, netContents, producerNameAddress, countryOfOrigin) — verbatim, or null if absent — regardless of which expected values were provided.

For EACH expected field above, output one entry in "comparisons" using the same "key". Set "found" to the exact text read from the label (or null if that field is absent), and set "status":
  - "match"      → the same information. Use JUDGMENT: ignore case, punctuation, spacing, and obviously-equivalent wording (e.g. "STONE'S THROW" vs "Stone's Throw" is a match; "750 mL" vs "750ML" is a match). Explain briefly in "note".
  - "review"     → plausibly the same but you are not confident (partially legible, ambiguous, or a borderline difference a human should confirm).
  - "mismatch"   → meaningfully different information (e.g. a different ABV number, a different brand).
  - "not_found"  → the field is not present on the label at all.

GOVERNMENT WARNING: Report what you observe — do not judge compliance yourself.
  - present: is a government warning statement present at all?
  - verbatimText: transcribe the FULL warning exactly as printed, including the "GOVERNMENT WARNING:" prefix. null if absent.
  - prefixAllCaps: is the "GOVERNMENT WARNING:" heading printed in ALL CAPITAL LETTERS?
  - prefixBold: does the "GOVERNMENT WARNING:" heading appear in bold type?
  - legibilityConcern: is the warning text noticeably small or hard to read?
For reference, the required wording is: "${GOVERNMENT_WARNING_TEXT}"

Also determine beverageType from the label.

Return ONLY the structured JSON.`;
}

export class AnthropicProvider implements VisionProvider {
  readonly model: string;
  private client: Anthropic;

  constructor(apiKey?: string, model?: string) {
    this.model = model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
    this.client = new Anthropic({
      apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
    });
  }

  async extract(
    image: LabelImage,
    application: ApplicationData,
  ): Promise<ModelExtraction> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1500,
      // Thinking is intentionally left off: extraction + comparison is well
      // within the model's base capability, and skipping it keeps us under
      // the ~5s review target that the agents require.
      output_config: {
        format: { type: "json_schema", schema: OUTPUT_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: image.mediaType,
                data: image.data,
              },
            },
            { type: "text", text: buildPrompt(application) },
          ],
        },
      ],
    } as Anthropic.MessageCreateParamsNonStreaming);

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No structured output returned from the model.");
    }
    return JSON.parse(textBlock.text) as ModelExtraction;
  }
}
