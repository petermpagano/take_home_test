"use client";

import { Fragment, useMemo, useState } from "react";
import { ResultDetail, StatusPill, VerdictBanner } from "@/components/results";
import { verifyLabel } from "@/lib/client";
import { parseApplicationCsv, resultsToCsv } from "@/lib/csv";
import { prepareImage } from "@/lib/image";
import type { ApplicationData, VerificationResult } from "@/lib/types";

const CONCURRENCY = 5; // keep several in flight without overwhelming the API

interface Item {
  id: number;
  file: File;
  name: string;
  status: "pending" | "running" | "done" | "error";
  result?: VerificationResult;
  error?: string;
}

export default function BatchPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [csvMap, setCsvMap] = useState<Map<string, ApplicationData>>(new Map());
  const [csvName, setCsvName] = useState("");
  const [running, setRunning] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const done = items.filter((i) => i.status === "done" || i.status === "error").length;
  const counts = useMemo(() => {
    const c = { pass: 0, review: 0, fail: 0 };
    for (const i of items) if (i.result) c[i.result.verdict]++;
    return c;
  }, [items]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next: Item[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((file, i) => ({
        id: Date.now() + i,
        file,
        name: file.name,
        status: "pending" as const,
      }));
    setItems((prev) => [...prev, ...next]);
  }

  async function onCsv(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setCsvMap(parseApplicationCsv(text));
    setCsvName(file.name);
  }

  function update(id: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function runAll() {
    setRunning(true);
    const queue = [...items];
    async function worker() {
      while (queue.length) {
        const item = queue.shift();
        if (!item) break;
        update(item.id, { status: "running" });
        try {
          const image = await prepareImage(item.file);
          const app = csvMap.get(item.name) ?? { beverageType: "unknown" as const };
          const result = await verifyLabel(image, app);
          update(item.id, { status: "done", result });
        } catch (e) {
          update(item.id, {
            status: "error",
            error: e instanceof Error ? e.message : "Failed",
          });
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker),
    );
    setRunning(false);
  }

  function exportCsv() {
    const rows = items
      .filter((i) => i.result)
      .map((i) => ({
        filename: i.name,
        verdict: i.result!.verdict.toUpperCase(),
        warning: i.result!.warning.status,
        issues: i.result!.warning.issues.join("; "),
      }));
    const blob = new Blob([resultsToCsv(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ttb-batch-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Batch verification</h1>
        <p className="text-slate-600">
          Add many label photos at once. Optionally upload a CSV of expected
          application values (matched by file name) to compare each label.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-6 text-center hover:border-agency">
          <span className="text-2xl">🖼️</span>
          <span className="mt-1 font-semibold text-agency">Add label photos</span>
          <span className="text-sm text-slate-500">Select multiple images</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </label>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-6 text-center hover:border-agency">
          <span className="text-2xl">📄</span>
          <span className="mt-1 font-semibold text-agency">
            Application data CSV
          </span>
          <span className="text-sm text-slate-500">
            {csvName || "Optional — matched by filename"}
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => onCsv(e.target.files?.[0])}
          />
        </label>
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={runAll}
            disabled={running}
            className="rounded-lg bg-agency px-6 py-3 text-lg font-bold text-white hover:bg-blue-800 disabled:bg-slate-300"
          >
            {running ? `Verifying ${done}/${items.length}…` : `Verify ${items.length} labels`}
          </button>
          {done > 0 && (
            <>
              <span className="font-semibold text-green-700">{counts.pass} pass</span>
              <span className="font-semibold text-amber-700">{counts.review} review</span>
              <span className="font-semibold text-red-700">{counts.fail} fail</span>
              <button
                onClick={exportCsv}
                className="ml-auto rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold hover:bg-slate-50"
              >
                Export CSV
              </button>
            </>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-sm uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">File</th>
                <th className="px-4 py-2">Verdict</th>
                <th className="px-4 py-2">Warning</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <Fragment key={i.id}>
                  <tr className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold">{i.name}</td>
                    <td className="px-4 py-3">
                      {i.status === "running" && (
                        <span className="text-slate-500">Verifying…</span>
                      )}
                      {i.status === "pending" && (
                        <span className="text-slate-400">Queued</span>
                      )}
                      {i.status === "error" && (
                        <span className="text-red-700">{i.error}</span>
                      )}
                      {i.result && <StatusPill status={statusForVerdict(i.result.verdict)} />}
                    </td>
                    <td className="px-4 py-3">
                      {i.result && <StatusPill status={i.result.warning.status} />}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {i.result && (
                        <button
                          onClick={() => setOpenId(openId === i.id ? null : i.id)}
                          className="text-agency underline"
                        >
                          {openId === i.id ? "Hide" : "Details"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {openId === i.id && i.result && (
                    <tr className="border-t border-slate-100 bg-slate-50">
                      <td colSpan={4} className="px-4 py-4">
                        <VerdictBanner
                          verdict={i.result.verdict}
                          elapsedMs={i.result.elapsedMs}
                        />
                        <div className="mt-4">
                          <ResultDetail result={i.result} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function statusForVerdict(v: VerificationResult["verdict"]) {
  return v === "pass" ? "match" : v === "review" ? "review" : "mismatch";
}
