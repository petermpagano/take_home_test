import type { ApplicationData, BeverageType } from "./types";

/** Minimal CSV parser supporting quoted fields and embedded commas/quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const BEVERAGES: BeverageType[] = ["beer", "wine", "spirits", "unknown"];

/**
 * Parse a CSV of expected application data into a map keyed by filename.
 * Recognized headers (case-insensitive): filename, beverageType, brandName,
 * classType, alcoholContent, netContents, producerNameAddress, countryOfOrigin.
 */
export function parseApplicationCsv(
  text: string,
): Map<string, ApplicationData> {
  const rows = parseCsv(text);
  const map = new Map<string, ApplicationData>();
  if (rows.length < 2) return map;

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name.toLowerCase());
  const fileIdx = idx("filename");
  if (fileIdx === -1) return map;

  for (const row of rows.slice(1)) {
    const filename = row[fileIdx]?.trim();
    if (!filename) continue;
    const get = (name: string) => {
      const i = idx(name);
      return i >= 0 ? row[i]?.trim() || undefined : undefined;
    };
    const bev = (get("beverageType") ?? "unknown").toLowerCase() as BeverageType;
    map.set(filename, {
      beverageType: BEVERAGES.includes(bev) ? bev : "unknown",
      brandName: get("brandName"),
      classType: get("classType"),
      alcoholContent: get("alcoholContent"),
      netContents: get("netContents"),
      producerNameAddress: get("producerNameAddress"),
      countryOfOrigin: get("countryOfOrigin"),
    });
  }
  return map;
}

/** Build a results CSV for download. */
export function resultsToCsv(
  rows: { filename: string; verdict: string; warning: string; issues: string }[],
): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const header = "filename,verdict,government_warning,issues";
  const body = rows.map(
    (r) =>
      [r.filename, r.verdict, r.warning, r.issues].map(esc).join(","),
  );
  return [header, ...body].join("\n");
}
