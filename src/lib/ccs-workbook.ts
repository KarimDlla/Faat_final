import JSZip from "jszip";

// ─────────────────────────────────────────────────────────────────────────────────────────────
// CCS pricing workbook (public/templates/FAAT CCS Pricing Workbook.xlsx)
//
// This file is the ONLY place that knows the layout of that workbook. It follows the rules in
// FAAT-Pricing-Integration-Spec:
//   • Excel formulas are never touched, rewritten or re-implemented. Excel stays the source of
//     truth for every price; this code only writes INPUT cells (quantity, FOB, header labels).
//   • Only the FOB (and quantity) comes from the quotation. Profit %, overhead, banking, customs,
//     tax %, discount % … are manual inputs and keep whatever the template has.
//   • The AI never calculates a price. It only supplies the numbers that go into those cells.
//
// How it edits the file: the .xlsx is a zip of XML files. We patch just the cells we need with
// string-level XML substitution (same approach as docx-template.ts), so every style, column
// width, merged cell and formula survives exactly as the owner built it. (SheetJS would drop
// most of that formatting on write.)
// ─────────────────────────────────────────────────────────────────────────────────────────────

export type CcsKind = "L" | "E" | "M";

/** How many groups of each family the supplied workbook physically contains. */
export const CCS_CAPACITY: Record<CcsKind, number> = { L: 5, E: 2, M: 2 };

export const CCS_KIND_LABEL: Record<CcsKind, string> = { L: "Elevators", E: "Escalators", M: "Moving Walks" };

export type CcsGroupInput = {
  /** "L1", "E2", "M1" … (case / spaces are tolerated). */
  code: string;
  description?: string;
  quantity: number;
  /** FOB price for ONE unit of this group. 0 / undefined = not known yet. */
  fobUnit?: number;
  /** Optional technical data for the "Lx Info" sheets (elevators only). 0 / undefined = not known. */
  technical?: { totalHeightM?: number; landingDoors?: number; tractionRopes?: number };
};

export type CcsProjectInfo = { projectName?: string; quoteNumber?: string; quoteDate?: string };

export type CcsFillResult = {
  blob: Blob;
  /** Groups that were written into the workbook. */
  placed: string[];
  /** Groups that could NOT be written, with a human-readable reason (never dropped silently). */
  skipped: { code: string; reason: string }[];
  /** Placed groups that still have no FOB, so the user must type it in Excel. */
  missingFob: string[];
};

export function parseCcsCode(code: string): { kind: CcsKind; index: number } | null {
  const m = /^\s*([LEMlem])\s*[-_ ]?\s*(\d{1,3})\s*$/.exec(code ?? "");
  if (!m) return null;
  const index = Number(m[2]);
  if (index < 1) return null;
  return { kind: m[1].toUpperCase() as CcsKind, index };
}

// Sheet names exactly as they appear in the workbook (note the "L5 Cost" quirk of the original).
const COST_SHEET: Record<string, string> = {
  L1: "L1", L2: "L2", L3: "L3", L4: "L4", L5: "L5 Cost", E1: "E1", E2: "E2", M1: "M1", M2: "M2",
};
const INFO_SHEET: Record<string, string> = { L1: "L1 Info", L2: "L2 Info", L3: "L3 Info", L4: "L4 Info", L5: "L5 Info" };
// Row order used by the "Proposed Price" sheet (one row per group, in this order, in every block).
const ROW_ORDER = ["L1", "L2", "L3", "L4", "L5", "E1", "E2", "M1", "M2"];
const PROPOSED_BLOCK_START_ROWS = [8, 21, 34, 50, 63]; // each block has 9 rows (ROW_ORDER)

// ── tiny XML helpers ─────────────────────────────────────────────────────────────────────────
const escXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function colToNum(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}
function splitAddr(addr: string): { col: string; row: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(addr)!;
  return { col: m[1], row: Number(m[2]) };
}

export function buildCell(addr: string, style: string | null, value: string | number): string {
  const s = style ? ` s="${style}"` : "";
  if (typeof value === "number") return `<c r="${addr}"${s}><v>${Number.isFinite(value) ? value : 0}</v></c>`;
  return `<c r="${addr}"${s} t="inlineStr"><is><t xml:space="preserve">${escXml(value)}</t></is></c>`;
}

/** Write one INPUT cell (never a formula cell). Keeps the cell's existing style. */
export function setCell(xml: string, addr: string, value: string | number, fallbackStyle: string | null = null): string {
  const existing = new RegExp(`<c r="${addr}"(?:\\s[^>]*?)?(?:/>|>[\\s\\S]*?</c>)`).exec(xml);
  if (existing) {
    if (/<f[\s>/]/.test(existing[0])) throw new Error(`Refusing to overwrite formula cell ${addr}`);
    const style = /\ss="(\d+)"/.exec(existing[0].slice(0, existing[0].indexOf(">") + 1))?.[1] ?? fallbackStyle;
    return xml.replace(existing[0], buildCell(addr, style, value));
  }
  const { col, row } = splitAddr(addr);
  const newCell = buildCell(addr, fallbackStyle, value);
  const rowRe = new RegExp(`<row r="${row}"(?:\\s[^>]*?)?(?:/>|>[\\s\\S]*?</row>)`);
  const rowMatch = rowRe.exec(xml);
  if (rowMatch) {
    const rowXml = rowMatch[0];
    if (rowXml.endsWith("/>")) return xml.replace(rowXml, rowXml.slice(0, -2) + `>${newCell}</row>`);
    // Insert in column order.
    const cells = [...rowXml.matchAll(/<c r="([A-Z]+)\d+"/g)];
    const after = cells.find((c) => colToNum(c[1]) > colToNum(col));
    const patched = after
      ? rowXml.replace(new RegExp(`<c r="${after[1]}${row}"`), `${newCell}<c r="${after[1]}${row}"`)
      : rowXml.replace(/<\/row>$/, `${newCell}</row>`);
    return xml.replace(rowXml, patched);
  }
  // Row does not exist at all: insert it in row order inside <sheetData>.
  const rows = [...xml.matchAll(/<row r="(\d+)"/g)];
  const next = rows.find((r) => Number(r[1]) > row);
  const newRow = `<row r="${row}">${newCell}</row>`;
  if (next) return xml.replace(new RegExp(`<row r="${next[1]}"`), `${newRow}<row r="${next[1]}"`);
  return xml.replace("</sheetData>", `${newRow}</sheetData>`);
}

/** Drop cached results of formula cells so no stale number (e.g. the sample L1 total) is ever shown. */
export function stripFormulaCaches(xml: string): string {
  return xml.replace(/<c\b([^>]*?)(?<!\/)>([\s\S]*?)<\/c>/g, (full, attrs: string, inner: string) => {
    if (!/<f[\s>/]/.test(inner)) return full;
    const cleanAttrs = attrs.replace(/\st="[^"]*"/, "");
    const cleanInner = inner.replace(/<v>[\s\S]*?<\/v>/, "");
    return `<c${cleanAttrs}>${cleanInner}</c>`;
  });
}

export async function readWorkbookParts(zip: JSZip): Promise<Record<string, string>> {
  const wbXml = await zip.file("xl/workbook.xml")!.async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
  const rels = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
    const target = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
    if (id && target) rels.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target}`);
  }
  const out: Record<string, string> = {};
  for (const m of wbXml.matchAll(/<sheet\b[^>]*>/g)) {
    const name = /\bname="([^"]+)"/.exec(m[0])?.[1];
    const rid = /\br:id="([^"]+)"/.exec(m[0])?.[1];
    if (name && rid && rels.has(rid)) out[name.replace(/&amp;/g, "&")] = rels.get(rid)!;
  }
  return out;
}

/** Tell Excel to recalculate every formula itself when the file is opened. */
export async function enableFullCalcOnLoad(zip: JSZip): Promise<void> {
  const wbXml = await zip.file("xl/workbook.xml")!.async("string");
  const withCalc = /<calcPr\b[^>]*>/.test(wbXml)
    ? wbXml.replace(/<calcPr\b([^>]*?)\/?>/, (_m: string, a: string) => `<calcPr${a.replace(/\sfullCalcOnLoad="[^"]*"/, "")} fullCalcOnLoad="1"/>`)
    : wbXml.replace("</workbook>", `<calcPr fullCalcOnLoad="1"/></workbook>`);
  zip.file("xl/workbook.xml", withCalc);
}

const positive = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

/**
 * Fill the CCS workbook with the project's groups.
 * Every one of the 9 cost sheets is written (qty + FOB), including the groups the project does NOT
 * have (set to 0), so the sample numbers the template shipped with can never leak into a real file.
 */
export async function fillCcsWorkbook(template: ArrayBuffer, project: CcsProjectInfo, groups: CcsGroupInput[]): Promise<CcsFillResult> {
  const zip = await JSZip.loadAsync(template);
  const sheetPaths = await readWorkbookParts(zip);
  const sheets = new Map<string, string>();
  for (const [name, path] of Object.entries(sheetPaths)) sheets.set(name, await zip.file(path)!.async("string"));

  const placedByCode = new Map<string, CcsGroupInput>();
  const skipped: CcsFillResult["skipped"] = [];
  for (const g of groups) {
    const parsed = parseCcsCode(g.code);
    if (!parsed) { skipped.push({ code: g.code, reason: "الرمز غير معروف — استخدم L1.. للمصاعد، E1.. للسلالم المتحركة، M1.. للممرات المتحركة" }); continue; }
    const code = `${parsed.kind}${parsed.index}`;
    if (parsed.index > CCS_CAPACITY[parsed.kind]) {
      skipped.push({ code, reason: `ملف CCS الحالي يحتوي ${CCS_CAPACITY[parsed.kind]} مجموعات فقط من نوع ${CCS_KIND_LABEL[parsed.kind]}` });
      continue;
    }
    if (placedByCode.has(code)) { skipped.push({ code, reason: "الرمز مكرر — لا يمكن وضع مجموعتين في نفس الورقة" }); continue; }
    placedByCode.set(code, g);
  }

  const edit = (sheetName: string, fn: (xml: string) => string) => {
    const xml = sheets.get(sheetName);
    if (xml === undefined) throw new Error(`ورقة "${sheetName}" غير موجودة في ملف CCS`);
    sheets.set(sheetName, fn(xml));
  };

  const missingFob: string[] = [];
  for (const code of ROW_ORDER) {
    const g = placedByCode.get(code);
    const qty = g && positive(g.quantity) ? g.quantity : 0;
    const fob = g && positive(g.fobUnit) ? g.fobUnit : 0;
    if (g && qty > 0 && fob === 0) missingFob.push(code);

    edit(COST_SHEET[code], (xml) => {
      let x = setCell(xml, "D12", qty); // Qty         (FOB price per elevator row)
      x = setCell(x, "E12", fob);       // Rate = FOB per unit
      if (project.projectName) x = setCell(x, "C2", project.projectName);
      if (project.quoteNumber) x = setCell(x, "D6", project.quoteNumber);
      if (project.quoteDate) x = setCell(x, "D7", project.quoteDate);
      return x;
    });

    // Technical sheets only exist for elevators and only receive facts the quotation really states.
    const info = INFO_SHEET[code];
    if (g && info && sheets.has(info)) {
      edit(info, (xml) => {
        let x = xml;
        if (positive(g.technical?.totalHeightM)) x = setCell(x, "C8", g.technical!.totalHeightM!);
        if (positive(g.technical?.landingDoors)) x = setCell(x, "C9", g.technical!.landingDoors!);
        if (positive(g.technical?.tractionRopes)) x = setCell(x, "C13", g.technical!.tractionRopes!);
        if (qty > 0) x = setCell(x, "C33", qty);
        return x;
      });
    }
  }

  // Row labels on "Proposed Price" (text only — all numbers there are formulas / manual inputs).
  edit("Proposed Price", (xml) => {
    let x = xml;
    if (project.projectName) x = setCell(x, "C2", project.projectName);
    ROW_ORDER.forEach((code, i) => {
      const g = placedByCode.get(code);
      const label = g?.description?.trim() ? `${code} — ${g.description.trim()}` : code;
      for (const start of PROPOSED_BLOCK_START_ROWS) x = setCell(x, `B${start + i}`, label);
    });
    return x;
  });
  if (project.projectName) edit("Discounted Price", (xml) => setCell(xml, "C2", project.projectName!));

  // Write back: formulas keep their text, but their cached numbers are dropped and Excel is told to
  // recalculate on open, so every total is computed by Excel itself from the new inputs.
  for (const [name, path] of Object.entries(sheetPaths)) zip.file(path, stripFormulaCaches(sheets.get(name)!));
  await enableFullCalcOnLoad(zip);

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  return { blob, placed: [...placedByCode.keys()], skipped, missingFob };
}

/** Sheets that fillCcsWorkbook writes to. A replacement CCS workbook must contain all of them. */
export async function validateCcsWorkbook(buffer: ArrayBuffer): Promise<{ ok: boolean; missing: string[]; error?: string }> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    if (!zip.file("xl/workbook.xml")) return { ok: false, missing: [], error: "الملف ليس مصنف Excel صالحاً (xl/workbook.xml غير موجود)" };
    const names = new Set(Object.keys(await readWorkbookParts(zip)));
    const required = [...Object.values(COST_SHEET), "Proposed Price", "Discounted Price"];
    const missing = required.filter((n) => !names.has(n));
    return { ok: missing.length === 0, missing };
  } catch {
    return { ok: false, missing: [], error: "تعذر فتح الملف — تأكد أنه .xlsx سليم" };
  }
}
