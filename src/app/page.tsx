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
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function setField(key: keyof ApplicationData, value: string) {
    setApp((a) => ({ ...a, [key]: value }));
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setResult(null);
    try {
      setFileName(file.name);
      setImage(await prepareImage(file));
    } catch {
      setError("Could not read that image file. Try a JPG or PNG.");
    }
  }

  async function onVerify() {
    if (!image) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await verifyLabel(image, app));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* Left: inputs */}
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Verify a label</h1>
          <p className="text-slate-600">
            Enter the application details, add the label photo, then press
            Verify.
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

        <button
          onClick={onVerify}
          disabled={!image || busy}
          className="w-full rounded-lg bg-agency px-6 py-4 text-xl font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? "Verifying…" : "Verify label"}
        </button>

        {error && (
          <p className="rounded-md bg-red-50 px-4 py-3 text-red-800">{error}</p>
        )}

        {result && (
          <div className="space-y-4">
            <VerdictBanner verdict={result.verdict} elapsedMs={result.elapsedMs} />
            <ResultDetail result={result} />
          </div>
        )}
      </div>
    </div>
  );
}
