import type {
  FieldStatus,
  OverallVerdict,
  VerificationResult,
} from "@/lib/types";

const STATUS_META: Record<
  FieldStatus,
  { icon: string; label: string; cls: string }
> = {
  match: { icon: "✓", label: "Match", cls: "bg-green-100 text-green-800" },
  review: { icon: "!", label: "Review", cls: "bg-amber-100 text-amber-800" },
  mismatch: { icon: "✕", label: "Mismatch", cls: "bg-red-100 text-red-800" },
  not_found: { icon: "—", label: "Not found", cls: "bg-red-100 text-red-800" },
};

export function StatusPill({ status }: { status: FieldStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-sm font-bold ${m.cls}`}
    >
      <span aria-hidden>{m.icon}</span>
      {m.label}
    </span>
  );
}

const VERDICT_META: Record<
  OverallVerdict,
  { title: string; sub: string; cls: string }
> = {
  pass: {
    title: "PASS",
    sub: "Label matches the application.",
    cls: "bg-green-600",
  },
  review: {
    title: "NEEDS REVIEW",
    sub: "A human should confirm the flagged items.",
    cls: "bg-amber-500",
  },
  fail: {
    title: "FAIL",
    sub: "One or more required items do not match.",
    cls: "bg-red-600",
  },
};

export function VerdictBanner({
  verdict,
  elapsedMs,
}: {
  verdict: OverallVerdict;
  elapsedMs?: number;
}) {
  const m = VERDICT_META[verdict];
  return (
    <div className={`rounded-lg px-6 py-5 text-white ${m.cls}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-3xl font-extrabold tracking-tight">{m.title}</div>
          <div className="text-base opacity-95">{m.sub}</div>
        </div>
        {typeof elapsedMs === "number" && (
          <div className="text-right text-sm opacity-90">
            <div className="font-semibold">{(elapsedMs / 1000).toFixed(1)}s</div>
            <div>processing</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ResultDetail({ result }: { result: VerificationResult }) {
  return (
    <div className="space-y-5">
      {!result.imageReadable && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-red-800">
          The label image could not be read clearly. Please request a better
          photo. {result.imageNotes}
        </p>
      )}
      {result.imageReadable && result.imageNotes && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-amber-800">
          Image note: {result.imageNotes}
        </p>
      )}

      {/* Field comparisons */}
      <section>
        <h3 className="mb-2 text-lg font-bold">Field comparison</h3>
        {result.fields.length === 0 ? (
          <p className="text-slate-500">
            No application fields were provided to compare.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full border-collapse text-left">
              <thead className="bg-slate-50 text-sm uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Field</th>
                  <th className="px-4 py-2">Application</th>
                  <th className="px-4 py-2">On label</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.fields.map((f) => (
                  <tr key={f.key} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3 font-semibold">{f.field}</td>
                    <td className="px-4 py-3 text-slate-700">{f.expected}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {f.found ?? <span className="text-slate-400">—</span>}
                      {f.note && (
                        <div className="mt-1 text-sm text-slate-500">{f.note}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={f.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Government warning */}
      <section>
        <h3 className="mb-2 text-lg font-bold">Government Warning</h3>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-3">
            <StatusPill status={result.warning.status} />
            <span className="text-slate-600">{result.warning.note}</span>
          </div>
          {result.warning.foundText && (
            <blockquote className="mb-3 rounded bg-slate-50 px-4 py-3 text-sm italic text-slate-700">
              “{result.warning.foundText}”
            </blockquote>
          )}
          {result.warning.issues.length > 0 && (
            <ul className="list-inside list-disc space-y-1 text-red-700">
              {result.warning.issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
