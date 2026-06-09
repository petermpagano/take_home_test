import type { PreparedImage } from "./image";
import type { ApplicationData, VerificationResult } from "./types";

/** POST a prepared image + application data to the verify endpoint. */
export async function verifyLabel(
  image: PreparedImage,
  application: ApplicationData,
): Promise<VerificationResult> {
  const res = await fetch("/api/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: { data: image.base64, mediaType: image.mediaType },
      application,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error ?? `Request failed (${res.status}).`);
  }
  return json as VerificationResult;
}
