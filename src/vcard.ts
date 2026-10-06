export const FATHER = "אבא";
export const MOTHER = "אמא";
export const BOTH = `${FATHER}\\${MOTHER}`;
export const HOME = "בית";
const GUESS = "?";

export interface SplitContact {
  name: string;
  number: string;
}

export interface SplitResult {
  vcf: string;
  contacts: SplitContact[];
  sourceCount: number;
}

interface Prop {
  group: string;
  name: string;
  params: string;
  value: string;
  raw: string;
}

function parseLine(raw: string): Prop | null {
  const colon = raw.indexOf(":");
  if (colon < 0) return null;
  const head = raw.slice(0, colon);
  const value = raw.slice(colon + 1).trim();
  const semi = head.indexOf(";");
  const key = semi < 0 ? head : head.slice(0, semi);
  const params = semi < 0 ? "" : head.slice(semi + 1);
  const dot = key.indexOf(".");
  const group = dot < 0 ? "" : key.slice(0, dot);
  const name = (dot < 0 ? key : key.slice(dot + 1)).toUpperCase();
  return { group, name, params: params.toUpperCase(), value, raw };
}

function labelFor(labels: string[]): string {
  if (labels.includes(FATHER) && labels.includes(MOTHER)) {
    return [BOTH, ...labels.filter((l) => l !== FATHER && l !== MOTHER)].join("\\");
  }
  return labels.join("\\");
}

function splitCard(body: string): { cards: string[]; contacts: SplitContact[] } {
  const props = body
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l.trim())
    .map(parseLine)
    .filter((p): p is Prop => p !== null);

  const fn = props.find((p) => p.name === "FN")?.value ?? "";
  const n = (props.find((p) => p.name === "N")?.value ?? fn).split(";");
  const family = n[0] ?? "";
  const given = n[1] ?? "";
  const displayName = fn || [given, family].filter(Boolean).join(" ");

  const groupLabels = new Map<string, string>();
  for (const p of props) if (p.name === "X-ABLABEL" && p.group) groupLabels.set(p.group, p.value);

  let main: string | null = null;
  let home: string | null = null;
  const parents = new Map<string, string[]>();
  for (const p of props) {
    if (p.name !== "TEL" || !p.value) continue;
    const label = p.group ? groupLabels.get(p.group) : undefined;
    if (label) {
      const list = parents.get(p.value) ?? [];
      if (!list.includes(label)) list.push(label);
      parents.set(p.value, list);
    } else if (p.params.includes("HOME")) {
      home ??= p.value;
    } else {
      main ??= p.value;
    }
  }

  const entries = new Map<string, { label: string | null; type: string }>();
  for (const [num, labels] of parents) entries.set(num, { label: labelFor(labels), type: "CELL" });
  if (main && !entries.has(main)) {
    // The main number's owner is only inferred here, so the label is marked as a guess.
    const present = new Set([...parents.values()].flat());
    const missing = [FATHER, MOTHER].filter((l) => !present.has(l));
    const label = missing.length === 2 ? BOTH : missing.length === 1 ? missing[0] : null;
    entries.set(main, { label: label && label + GUESS, type: "CELL" });
  }
  if (home && !entries.has(home)) entries.set(home, { label: HOME, type: "HOME" });

  const kept = props.filter(
    (p) => !["BEGIN", "END", "VERSION", "N", "FN", "TEL", "X-ABLABEL"].includes(p.name) && p.value,
  );

  const order = [...new Set([main, ...parents.keys(), home].filter((x): x is string => !!x))];
  const cards: string[] = [];
  const contacts: SplitContact[] = [];
  for (const num of order) {
    const { label, type } = entries.get(num)!;
    const suffix = label ? `-${label}` : "";
    const name = displayName + suffix;
    cards.push(
      [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `N:${family}${suffix};${given};;;`,
        `FN:${name}`,
        ...kept.map((p) => p.raw),
        `TEL;TYPE=${type}:${num}`,
        "END:VCARD",
      ].join("\r\n"),
    );
    contacts.push({ name, number: num });
  }
  return { cards, contacts };
}

/** Splits every vCard so each phone number becomes its own contact named "<name>-<label>". */
export function splitVcf(text: string): SplitResult {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const bodies = [...unfolded.matchAll(/BEGIN:VCARD\r?\n([\s\S]*?)END:VCARD/gi)].map((m) => m[1]);
  if (bodies.length === 0) throw new Error("לא נמצאו אנשי קשר בקובץ");

  const cards: string[] = [];
  const contacts: SplitContact[] = [];
  for (const body of bodies) {
    const r = splitCard(body);
    cards.push(...r.cards);
    contacts.push(...r.contacts);
  }
  return { vcf: cards.join("\r\n\r\n") + "\r\n", contacts, sourceCount: bodies.length };
}
