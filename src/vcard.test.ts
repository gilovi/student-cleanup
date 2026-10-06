import { describe, expect, it } from "vitest";
import { splitVcf } from "./vcard";

function card(lines: string[]): string {
  return ["BEGIN:VCARD", "VERSION:3.0", ...lines, "END:VCARD"].join("\r\n");
}

function student(opts: { main?: string; home?: string; parents?: [string, string][] }): string {
  const lines = [
    "N:שלום;אלישע;;;",
    "FN:אלישע שלום",
    "ORG: ישיבת צביה פתח תקווה י3",
    `TEL;TYPE=HOME:${opts.home ?? ""}`,
    `TEL;TYPE=CELL:${opts.main ?? ""}`,
    "ADR;TYPE=HOME:העינבל 20/3;פתח תקווה",
    "EMAIL;TYPE=INTERNET;TYPE=HOME:",
  ];
  (opts.parents ?? []).forEach(([label, num], i) => {
    lines.push(`item${i + 1}.TEL:${num}`, `item${i + 1}.X-ABLabel:${label}`);
  });
  return card(lines);
}

const names = (vcf: string) => splitVcf(vcf).contacts.map((c) => [c.name, c.number]);

describe("splitVcf", () => {
  it("splits main and both distinct parents; main keeps the plain name", () => {
    const vcf = student({ main: "0501", parents: [["אבא", "0502"], ["אמא", "0503"]] });
    expect(names(vcf)).toEqual([
      ["אלישע שלום", "0501"],
      ["אלישע שלום-אבא", "0502"],
      ["אלישע שלום-אמא", "0503"],
    ]);
  });

  it("merges a parent number that equals the main number under the parent's name", () => {
    const vcf = student({ main: "0501", parents: [["אבא", "0502"], ["אמא", "0501"]] });
    expect(names(vcf)).toEqual([
      ["אלישע שלום-אמא", "0501"],
      ["אלישע שלום-אבא", "0502"],
    ]);
  });

  it("labels a number shared by both parents as אבא\\אמא", () => {
    const vcf = student({ main: "0501", parents: [["אבא", "0502"], ["אמא", "0502"]] });
    expect(names(vcf)).toEqual([
      ["אלישע שלום", "0501"],
      ["אלישע שלום-אבא\\אמא", "0502"],
    ]);
  });

  it("infers the missing parent for the main number, marked with ?", () => {
    const vcf = student({ main: "0501", parents: [["אבא", "0502"]] });
    expect(names(vcf)).toEqual([
      ["אלישע שלום-אמא?", "0501"],
      ["אלישע שלום-אבא", "0502"],
    ]);
  });

  it("labels the main number אבא\\אמא? when no parents are listed", () => {
    expect(names(student({ main: "0501" }))).toEqual([["אלישע שלום-אבא\\אמא?", "0501"]]);
  });

  it("does not mark a main number that equals the only parent's number", () => {
    const vcf = student({ main: "0501", parents: [["אבא", "0501"]] });
    expect(names(vcf)).toEqual([["אלישע שלום-אבא", "0501"]]);
  });

  it("adds the home landline with -בית and skips empty phones", () => {
    const vcf = student({ home: "039305534", main: "0501", parents: [["אבא", "0502"], ["אמא", "0503"]] });
    expect(names(vcf)).toContainEqual(["אלישע שלום-בית", "039305534"]);
    expect(splitVcf(student({ parents: [["אבא", "0502"], ["אמא", "0503"]] })).contacts).toHaveLength(2);
  });

  it("writes N and FN with the label and keeps other fields, dropping empty ones", () => {
    const vcf = student({ main: "0501", parents: [["אבא", "0502"], ["אמא", "0503"]] });
    const out = splitVcf(vcf).vcf;
    const cards = out.split("END:VCARD").filter((c) => c.trim());
    expect(cards).toHaveLength(3);
    expect(cards[1]).toContain("N:שלום-אבא;אלישע;;;");
    expect(cards[1]).toContain("FN:אלישע שלום-אבא");
    expect(cards[1]).toContain("ADR;TYPE=HOME:העינבל 20/3;פתח תקווה");
    expect(cards[1]).toContain("TEL;TYPE=CELL:0502");
    expect(cards[1]).not.toContain("X-ABLabel");
    expect(cards[1]).not.toContain("EMAIL");
    expect(out).toContain("\r\n");
  });

  it("handles several cards, LF line endings, a BOM and folded lines", () => {
    const a = student({ main: "0501", parents: [["אבא", "0502"], ["אמא", "0503"]] });
    const b = card(["N:רבי;איתמר;;;", "FN:איתמר", "  רבי", "TEL;TYPE=CELL:0601"]);
    const res = splitVcf(String.fromCharCode(0xfeff) + [a, b].join("\n\n").replace(/\r\n/g, "\n"));
    expect(res.sourceCount).toBe(2);
    expect(res.contacts.map((c) => c.name)).toContain("איתמר רבי-אבא\\אמא?");
  });

  it("throws on input with no vCards", () => {
    expect(() => splitVcf("hello")).toThrow();
  });
});
