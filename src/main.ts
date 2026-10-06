import { splitVcf, type SplitResult } from "./vcard";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const drop = $<HTMLLabelElement>("drop");
const input = $<HTMLInputElement>("file");
const error = $<HTMLParagraphElement>("error");
const result = $<HTMLElement>("result");
const summary = $<HTMLParagraphElement>("summary");
const rows = $<HTMLTableSectionElement>("rows");
const download = $<HTMLButtonElement>("download");

let current: { result: SplitResult; fileName: string } | null = null;

function outputName(name: string): string {
  return name.replace(/\.vcf$/i, "") + "_split.vcf";
}

function render(res: SplitResult): void {
  summary.textContent = `${res.sourceCount} אנשי קשר פוצלו ל-${res.contacts.length}.`;
  rows.replaceChildren(
    ...res.contacts.map((c) => {
      const tr = document.createElement("tr");
      const name = document.createElement("td");
      name.textContent = c.name;
      if (c.name.endsWith("?")) name.className = "guess";
      const num = document.createElement("td");
      num.className = "num";
      num.textContent = c.number;
      tr.append(name, num);
      return tr;
    }),
  );
  result.hidden = false;
}

async function handle(file: File | undefined): Promise<void> {
  if (!file) return;
  error.hidden = true;
  result.hidden = true;
  try {
    const res = splitVcf(await file.text());
    current = { result: res, fileName: file.name };
    render(res);
  } catch (e) {
    current = null;
    error.textContent = e instanceof Error ? e.message : "שגיאה בקריאת הקובץ";
    error.hidden = false;
  }
}

download.addEventListener("click", () => {
  if (!current) return;
  const blob = new Blob([current.result.vcf], { type: "text/vcard;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = outputName(current.fileName);
  a.click();
  URL.revokeObjectURL(a.href);
});

input.addEventListener("change", () => {
  void handle(input.files?.[0]);
  input.value = "";
});
drop.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    input.click();
  }
});
drop.addEventListener("dragover", (e) => {
  e.preventDefault();
  drop.classList.add("over");
});
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("over");
  void handle(e.dataTransfer?.files[0]);
});
// Dropping a file outside the zone would otherwise navigate away from the app.
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());
