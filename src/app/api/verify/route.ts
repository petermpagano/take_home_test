import { NextResponse } from "next/server";
import { AnthropicProvider } from "@/lib/provider";
import type { LabelImage } from "@/lib/provider";
import { buildResult } from "@/lib/verify";
import type { ApplicationData, BeverageType, VerificationResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30; // Vercel function ceiling; a call should take ~3-5s.

const VALID_MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VALID_BEVERAGE: BeverageType[] = ["beer", "wine", "spirits", "unknown"];

interface VerifyRequest {
  image?: { data?: string; mediaType?: string };
  application?: Partial<ApplicationData>;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Server is missing ANTHROPIC_API_KEY. See README setup." },
      { status: 500 },
    );
  }

  let body: VerifyRequest;
  try {
    body = (await req.json()) as VerifyRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { image, application } = body;
  if (!image?.data || !image.mediaType) {
    return NextResponse.json(
      { error: "An image (base64 data + mediaType) is required." },
      { status: 400 },
    );
  }
  if (!VALID_MEDIA.includes(image.mediaType)) {
    return NextResponse.json(
      { error: `Unsupported image type: ${image.mediaType}` },
      { status: 400 },
    );
  }

  const app: ApplicationData = {
    beverageType: VALID_BEVERAGE.includes(application?.beverageType as BeverageType)
      ? (application!.beverageType as BeverageType)
      : "unknown",
    brandName: application?.brandName?.trim() || undefined,
    classType: application?.classType?.trim() || undefined,
    alcoholContent: application?.alcoholContent?.trim() || undefined,
    netContents: application?.netContents?.trim() || undefined,
    producerNameAddress: application?.producerNameAddress?.trim() || undefined,
    countryOfOrigin: application?.countryOfOrigin?.trim() || undefined,
  };

  const labelImage: LabelImage = {
    data: image.data,
    mediaType: image.mediaType as LabelImage["mediaType"],
  };

  const provider = new AnthropicProvider();
  const started = Date.now();
  try {
    const extraction = await provider.extract(labelImage, app);
    const result: VerificationResult = {
      ...buildResult(extraction, app),
      elapsedMs: Date.now() - started,
      model: provider.model,
    };
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    console.error("verify error:", message);
    return NextResponse.json(
      { error: `Verification failed: ${message}` },
      { status: 502 },
    );
  }
}
