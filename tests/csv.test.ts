import { describe, expect, it } from "vitest";
import { parseApplicationCsv, parseCsv, resultsToCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("handles quoted fields with embedded commas", () => {
    const rows = parseCsv('a,b\n"x,y",z');
    expect(rows).toEqual([
      ["a", "b"],
      ["x,y", "z"],
    ]);
  });

  it("handles escaped quotes", () => {
    const rows = parseCsv('h\n"say ""hi"""');
    expect(rows[1][0]).toBe('say "hi"');
  });
});

describe("parseApplicationCsv", () => {
  it("maps rows by filename with normalized beverage type", () => {
    const csv =
      "filename,beverageType,brandName,alcoholContent\n" +
      "a.png,SPIRITS,Old Tom,45%\n" +
      "b.png,banana,Sunset,13%";
    const map = parseApplicationCsv(csv);
    expect(map.get("a.png")?.brandName).toBe("Old Tom");
    expect(map.get("a.png")?.beverageType).toBe("spirits");
    expect(map.get("b.png")?.beverageType).toBe("unknown"); // invalid -> unknown
  });

  it("returns empty map when no filename column", () => {
    expect(parseApplicationCsv("brand\nfoo").size).toBe(0);
  });
});

describe("resultsToCsv", () => {
  it("escapes quotes and joins rows", () => {
    const csv = resultsToCsv([
      { filename: "a.png", verdict: "PASS", warning: "match", issues: "" },
    ]);
    expect(csv.split("\n")[0]).toBe(
      "filename,verdict,government_warning,issues",
    );
    expect(csv).toContain('"a.png","PASS","match",""');
  });
});
