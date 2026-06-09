import type { ApplicationData, ModelExtraction } from "../types";

export interface LabelImage {
  /** base64-encoded image data (no data: prefix). */
  data: string;
  /** e.g. "image/jpeg", "image/png", "image/webp". */
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}

/**
 * A vision provider reads a label image and compares it against the
 * application data. Kept behind an interface so the AI backend is swappable —
 * e.g. for an on-prem / Azure-hosted model in a locked-down federal network
 * (a concern raised by IT in the discovery interviews).
 */
export interface VisionProvider {
  readonly model: string;
  extract(
    image: LabelImage,
    application: ApplicationData,
  ): Promise<ModelExtraction>;
}

export { AnthropicProvider } from "./anthropic";
