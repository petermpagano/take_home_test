"use client";

import { useState } from "react";
import { ResultDetail, VerdictBanner } from "@/components/results";
import { verifyLabel } from "@/lib/client";
import { prepareImage, type PreparedImage } from "@/lib/image";
import { FIELD_DEFS } from "@/lib/ttb";
import type { ApplicationData, BeverageType, VerificationResult } from "@/lib/types";

const BEVERAGE_OPTIONS: { value: BeverageType; label: string }[] = [
  { value: "spirits", label: "Distilled Spirits" },
  { value: "wine", label: "Wine" },
  { value: "beer", label: "Beer / Malt" },
  { value: "unknown", label: "Not sure" },
];

export default function SingleLabelPage() {
  const [app, setApp] = useState<ApplicationData>({ beverageType: "spirits" });
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [error, setError] = useState("");

  function setField(key: keyof ApplicationData, value: string) {
    setApp((a) => ({ ...a, [key]: value }));
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError("");
    setResult(null);
    setEnhanced(false);
    try {
      setFile(f);
      setFileName(f.name);
      setImage(await prepareImage(f));
    } catch {
      setError("Could not read that image file. Try a JPG or PNG.");
    }
  }

  async function runVerify(img: PreparedImage) {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const r = await verifyLabel(img, app);
      setResult(r);
      // Auto-fill the form with what the AI read off the label, so the agent
      // can review and correct the extracted values in place.
      setApp({
        beverageType: r.beverageType === "unknown" ? app.beverageType : r.beverageType,
        brandName: r.extracted.brandName ?? "",
        classType: r.extracted.classType ?? "",
        alcoholContent: r.extracted.alcoholContent ?? "",
        netContents: r.extracted.netContents ?? "",
        producerNameAddress: r.extracted.producerNameAddress ?? "",
        countryOfOrigin: r.extracted.countryOfOrigin ?? "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  function onVerify() {
    if (image) runVerify(image);
  }

  // Re-process the original photo with brightness/contrast/grayscale and
  // re-check — a one-click recovery for dark/low-contrast photos before an
  // agent gives up and requests a new image.
  async function enhanceAndRetry() {
    if (!file) return;
    setEnhanced(true);
    const img = await prepareImage(file, { enhance: true });
    setImage(img);
    await runVerify(img);
  }

  // Reset to a clean slate for the next application: clear the photo, the
  // result, and the form (which now holds the last label's scanned values).
  function nextLabel() {
    setImage(null);
    setFile(null);
    setFileName("");
    setResult(null);
    setError("");
    setEnhanced(false);
    setApp({ beverageType: "spirits" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* Left: inputs */}
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Verify a label</h1>
          <p className="text-slate-600">
            Enter the application details to check against, add the label photo,
            then press Verify. Fields you leave blank will be filled in from
            what the AI reads on the label.
          </p>
        </div>

        <div>
          <label className="mb-1 block font-semibold">Beverage type</label>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={app.beverageType}
            onChange={(e) =>
              setApp((a) => ({
                ...a,
                beverageType: e.target.value as BeverageType,
              }))
            }
          >
            {BEVERAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {FIELD_DEFS.map((f) => (
          <div key={f.key}>
            <label className="mb-1 block font-semibold">{f.label}</label>
            <input
              type="text"
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              placeholder={f.placeholder}
              value={app[f.key] ?? ""}
              onChange={(e) => setField(f.key, e.target.value)}
            />
            <p className="mt-1 text-sm text-slate-500">{f.helper}</p>
          </div>
        ))}
      </div>

      {/* Right: image + action + result */}
      <div className="space-y-6">
        <div>
          <label className="mb-1 block font-semibold">Label photo</label>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-8 text-center hover:border-agency">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image.dataUrl}
                alt="Label preview"
                className="max-h-64 rounded"
              />
            ) : (
              <>
                <span className="text-4xl">📷</span>
                <span className="mt-2 font-semibold text-agency">
                  Choose a label photo
                </span>
                <span className="text-sm text-slate-500">JPG or PNG</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
          {fileName && (
            <p className="mt-1 text-sm text-slate-500">{fileName}</p>
          )}
        </div>

        {/* The Verify button is shown until a result comes back; once a
            result is on screen, the primary action becomes "next label". */}
        {!result && (
          <button
            onClick={onVerify}
            disabled={!image || busy}
            className="w-full rounded-lg bg-agency px-6 py-4 text-xl font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {busy ? "Verifying…" : "Verify label"}
          </button>
        )}

        {error && (
          <p className="rounded-md bg-red-50 px-4 py-3 text-red-800">{error}</p>
        )}

        {result && (
          <div className="space-y-4">
            <VerdictBanner verdict={result.verdict} elapsedMs={result.elapsedMs} />

            {/* Offer a one-click enhancement when the photo was flagged as
                unreadable or quality-noted, before the agent gives up. */}
            {!enhanced && (!result.imageReadable || result.imageNotes) && (
              <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center">
                <button
                  onClick={enhanceAndRetry}
                  disabled={busy || !file}
                  className="rounded-lg bg-amber-600 px-5 py-3 font-bold text-white hover:bg-amber-700 disabled:bg-slate-300"
                >
                  ✨ Enhance photo &amp; re-check
                </button>
                <span className="text-sm text-amber-900 sm:ml-1">
                  Adjusts brightness &amp; contrast to recover a dark or
                  low-contrast photo — then reads it again.
                </span>
              </div>
            )}
            {enhanced && (
              <p className="text-sm text-slate-500">
                Showing results after photo enhancement.
              </p>
            )}

            {/* Clear next-step guidance so the agent is never stuck. */}
            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
              <button
                onClick={nextLabel}
                className="rounded-lg bg-agency px-5 py-3 text-lg font-bold text-white hover:bg-blue-800"
              >
                ▶ Verify another label
              </button>
              <span className="text-sm text-slate-500 sm:ml-1">
                The form above now shows what the AI read off this label. Start
                the next one when you’re ready.
              </span>
            </div>

            <ResultDetail result={result} />
          </div>
        )}
      </div>
    </div>
  );
}
