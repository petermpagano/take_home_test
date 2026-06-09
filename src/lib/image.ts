// Client-side image downscaling. Shrinking the image before upload keeps
// payloads small and the round-trip fast — directly serving the <5s target —
// without hurting the model's ability to read the label.

const MAX_DIMENSION = 1568; // matches the model's effective vision resolution
const JPEG_QUALITY = 0.85;

export interface PreparedImage {
  dataUrl: string; // full data: URL, for preview
  base64: string; // base64 payload only, for the API
  mediaType: "image/jpeg";
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const base64 = dataUrl.split(",")[1] ?? "";
  return { dataUrl, base64, mediaType: "image/jpeg" };
}
