import JSZip from "jszip";
import { enableFullCalcOnLoad, readWorkbookParts, setCell, stripFormulaCaches } from "./ccs-workbook";
import { lookupSpec, type SpecLike } from "./docx-template";

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Placeholder-driven Excel filling, done the same way as ccs-workbook.ts: at XML level.
//   • Formulas are never touched or re-implemented. A target cell that holds a formula is refused and
//     reported, never overwritten. Styles, merges, widths and formulas survive exactly as authored.
//   • Excel recalculates everything itself on open (cached results dropped, fullCalcOnLoad set).
//   • The template says WHERE each value goes, in one of two ways (they can be combined):
//       1. Placeholder cells: a cell whose text is {{TOKEN}}, {{SPEC:label}} or contains one inside text.
//       2. An optional cell map (JSON): [{ "sheet": "Cost", "cell": "D12", "source": "TOTAL_QTY_NUM" }]
//          for input cells that already hold a sample number and can't carry a placeholder.
//   • Repeating rows: a row with {{ITEMS_ROW}} in one of its cells is the line-item template. Item N is
//     written N rows below it. Rows are NEVER inserted (that would shift formula references), so the
//     template must leave enough free rows below; items that don't fit are reported, not dropped silently.
// ─────────────────────────────────────────────────────────────────────────────────────────────

export type CellMapEntry = { sheet: string; cell: string; source: string; repeat?: "down"; max?: number };
export type XlsxSkip = { where: string; reason: string };
export type XlsxFillResult = { blob: Blob; written: number; unfilled: string[]; skipped: XlsxSkip[] };

const XL_TOKEN_RE = () => /\{\{\s*((?:SPEC:[^{}]+?)|items\.[a-zA-Z0-9_]+|[A-Z0-9_]+)\s*\}\}/g;
const MARKER = "{{ITEMS_ROW}}";
const CELL_ADDR_RE = /^([A-Z]{1,3})([1-9]\d{0,6})$/;

const decodeXml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

async function readSharedStrings(zip: JSZip): Promise<string[]> {
  const f = zip.file("xl/sharedStrings.xml");
  if (!f) return [];
  const xml = (await f.async("string")).replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  return [...xml.matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)].map((m) =>
    [...(m[1] ?? "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decodeXml(t[1])).join(""),
  );
}

type CellInfo = { addr: string; col: string; row: number; style: string | null; hasFormula: boolean; hasValue: boolean; text: string | null };

function scanCells(xml: string, sst: string[]): CellInfo[] {
  const out: CellInfo[] = [];
  for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = m[1], inner = m[2] ?? "";
    const addr = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
    if (!addr) continue;
    const a = /^([A-Z]+)(\d+)$/.exec(addr)!;
    const t = /\bt="([^"]*)"/.exec(attrs)?.[1];
    const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
    const hasFormula = /<f[\s>/]/.test(inner);
    let text: string | null = null;
    if (!hasFormula && t === "s" && v !== undefined) text = sst[Number(v)] ?? null;
    else if (!hasFormula && t === "inlineStr") text = [...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((x) => decodeXml(x[1])).join("");
    const hasValue = hasFormula || (text !== null ? text.trim() !== "" : v !== undefined && v !== "");
    out.push({ addr, col: a[1], row: Number(a[2]), style: /\bs="(\d+)"/.exec(attrs)?.[1] ?? null, hasFormula, hasValue, text });
  }
  return out;
}

const isPlaceholder = (c: CellInfo) => c.text !== null && c.text.includes("{{");

function typed(value: string | number): string | number {
  if (typeof value === "number") return value;
  return /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value;
}

type Values = Record<string, string | number>;
type Item = Record<string, string | number>;

export type CellMapParse = { ok: boolean; map: CellMapEntry[]; errors: string[] };
export function parseCellMap(jsonText: string): CellMapParse {
  let raw: unknown;
  try { raw = JSON.parse(jsonText); } catch { return { ok: false, map: [], errors: ["ملف الربط ليس JSON صالحاً"] }; }
  const list = Array.isArray(raw) ? raw : (raw as { cells?: unknown })?.cells;
  if (!Array.isArray(list)) return { ok: false, map: [], errors: ["ملف الربط يجب أن يكون قائمة، أو كائناً فيه الحقل cells"] };
  const map: CellMapEntry[] = [], errors: string[] = [];
  list.forEach((e, i) => {
    const o = e as Partial<CellMapEntry>;
    const where = `الإدخال ${i + 1}`;
    if (!o || typeof o.sheet !== "string" || !o.sheet.trim()) return void errors.push(`${where}: sheet مفقود`);
    if (typeof o.cell !== "string" || !CELL_ADDR_RE.test(o.cell)) return void errors.push(`${where}: عنوان الخلية غير صالح (مثال: D12)`);
    if (typeof o.source !== "string" || !o.source.trim()) return void errors.push(`${where}: source مفقود`);
    if (o.repeat !== undefined && o.repeat !== "down") return void errors.push(`${where}: repeat يقبل القيمة "down" فقط`);
    if (o.repeat === "down" && !o.source.startsWith("items.")) return void errors.push(`${where}: repeat يعمل مع مصادر items.* فقط`);
    if (o.max !== undefined && (!Number.isInteger(o.max) || o.max < 1 || o.max > 500)) return void errors.push(`${where}: max يجب أن يكون بين 1 و500`);
    map.push({ sheet: o.sheet.trim(), cell: o.cell, source: o.source.trim(), repeat: o.repeat, max: o.max });
  });
  return { ok: errors.length === 0, map, errors };
}

export type XlsxScan = {
  ok: boolean;
  error?: string;
  tokens: string[];
  specLabels: string[];
  itemFields: string[];
  hasItemsRow: boolean;
  placeholderCells: number;
  mapEntries: number;
  /** Problems with the cell map itself (unknown sheet, bad address ...). */
  mapProblems: string[];
};

export async function scanXlsxTemplate(buffer: ArrayBuffer, cellMap: CellMapEntry[] = []): Promise<XlsxScan> {
  const base = { tokens: [], specLabels: [], itemFields: [], hasItemsRow: false, placeholderCells: 0, mapEntries: cellMap.length, mapProblems: [] as string[] };
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(buffer); } catch { return { ok: false, error: "الملف ليس ملف Excel (.xlsx) صالحاً", ...base }; }
  if (!zip.file("xl/workbook.xml")) return { ok: false, error: "الملف ليس ملف Excel (.xlsx) صالحاً: xl/workbook.xml غير موجود", ...base };
  const sheetPaths = await readWorkbookParts(zip);
  const sst = await readSharedStrings(zip);
  const tokens = new Set<string>(), specs = new Set<string>(), fields = new Set<string>();
  let hasItemsRow = false, placeholderCells = 0;
  const addKey = (k: string) => {
    if (k === "ITEMS_ROW") return;
    if (k.startsWith("SPEC:")) specs.add(k.slice(5).trim());
    else if (k.startsWith("items.")) fields.add(k.slice(6));
    else tokens.add(k);
  };
  for (const path of Object.values(sheetPaths)) {
    const xml = await zip.file(path)?.async("string");
    if (!xml) continue;
    for (const c of scanCells(xml, sst).filter(isPlaceholder)) {
      placeholderCells++;
      if (c.text!.includes(MARKER)) hasItemsRow = true;
      for (const m of c.text!.matchAll(XL_TOKEN_RE())) addKey(m[1].trim());
    }
  }
  const mapProblems: string[] = [];
  for (const e of cellMap) {
    if (!(e.sheet in sheetPaths)) mapProblems.push(`الورقة "${e.sheet}" غير موجودة في الملف (الإدخال ${e.cell})`);
    addKey(e.source);
  }
  return { ok: true, tokens: [...tokens], specLabels: [...specs], itemFields: [...fields], hasItemsRow, placeholderCells, mapEntries: cellMap.length, mapProblems };
}

export async function fillXlsxXml(
  templateBuffer: ArrayBuffer,
  values: Values,
  items: Item[],
  cellMap: CellMapEntry[] = [],
  specs: SpecLike[] = [],
): Promise<XlsxFillResult> {
  const zip = await JSZip.loadAsync(templateBuffer);
  const sheetPaths = await readWorkbookParts(zip);
  const sst = await readSharedStrings(zip);
  const sheets = new Map<string, string>();
  for (const [name, path] of Object.entries(sheetPaths)) sheets.set(name, await zip.file(path)!.async("string"));

  const unfilled = new Set<string>();
  const skipped: XlsxSkip[] = [];
  let written = 0;

  const resolve = (key: string, item?: Item): string | number | undefined => {
    if (key.startsWith("items.")) return item?.[key.slice(6)];
    if (key.startsWith("SPEC:")) return lookupSpec(specs, key.slice(5));
    return values[key];
  };
  // Text of a placeholder cell → the value to write. A cell that is exactly one token keeps the value's
  // type (numbers stay numbers, so formulas can use them); a token inside other text becomes text.
  const render = (text: string, item?: Item): string | number => {
    const clean = text.replace(MARKER, "");
    const sole = /^\s*\{\{\s*((?:SPEC:[^{}]+?)|items\.[a-zA-Z0-9_]+|[A-Z0-9_]+)\s*\}\}\s*$/.exec(clean);
    if (sole) {
      const key = sole[1].trim();
      const v = resolve(key, item);
      if (v === undefined) { unfilled.add(key); return "—"; }
      return v === "" ? "" : typed(v);
    }
    return clean.replace(XL_TOKEN_RE(), (_m: string, k: string) => {
      const v = resolve(k.trim(), item);
      if (v === undefined) { unfilled.add(k.trim()); return "—"; }
      return String(v);
    });
  };
  const put = (sheet: string, xml: string, addr: string, value: string | number, style: string | null): string => {
    try { const out = setCell(xml, addr, value, style); written++; return out; }
    catch { skipped.push({ where: `${sheet}!${addr}`, reason: "الخلية تحتوي معادلة — لا يتم الكتابة فوق المعادلات" }); return xml; }
  };

  for (const [sheet, original] of sheets) {
    let xml = original;
    const cells = scanCells(xml, sst);
    const placeholders = cells.filter(isPlaceholder);
    const markerRow = placeholders.find((c) => c.text!.includes(MARKER))?.row ?? null;

    for (const c of placeholders.filter((p) => p.row !== markerRow)) xml = put(sheet, xml, c.addr, render(c.text!), c.style);

    if (markerRow !== null) {
      const tpl = placeholders.filter((c) => c.row === markerRow);
      const rows = items.length ? items : [undefined];
      for (let i = 0; i < rows.length; i++) {
        const r = markerRow + i;
        if (i > 0) {
          const blocked = cells.some((c) => c.row === r && tpl.some((t) => t.col === c.col) && c.hasValue);
          if (blocked) {
            skipped.push({ where: `${sheet}!${r}`, reason: `لا توجد صفوف فارغة كافية تحت صف البنود — لم تُكتب ${rows.length - i} من ${rows.length} بنود. اترك صفوفاً فارغة أسفل الجدول.` });
            break;
          }
        }
        for (const t of tpl) {
          const v = rows[i] ? render(t.text!, rows[i]) : (t.text!.replace(MARKER, "").trim() === "" ? "" : "—");
          if (i > 0 && v === "") continue;
          xml = put(sheet, xml, `${t.col}${r}`, v, t.style);
        }
      }
    }

    for (const e of cellMap.filter((m) => m.sheet === sheet)) {
      const a = CELL_ADDR_RE.exec(e.cell)!;
      if (e.repeat === "down") {
        const max = e.max ?? 100;
        const field = e.source.slice(6);
        items.slice(0, max).forEach((it, i) => {
          const v = it[field];
          if (v === undefined) { unfilled.add(e.source); return; }
          xml = put(sheet, xml, `${a[1]}${Number(a[2]) + i}`, typed(v), null);
        });
        if (items.length > max) skipped.push({ where: `${sheet}!${e.cell}`, reason: `البنود ${items.length} أكثر من الحد ${max} في ملف الربط — لم تُكتب الزائدة` });
        continue;
      }
      const v = resolve(e.source);
      if (v === undefined) { unfilled.add(e.source); continue; }
      xml = put(sheet, xml, e.cell, typed(v), null);
    }
    sheets.set(sheet, xml);
  }
  for (const e of cellMap) if (!sheets.has(e.sheet)) skipped.push({ where: `${e.sheet}!${e.cell}`, reason: "الورقة غير موجودة في الملف" });

  for (const [name, path] of Object.entries(sheetPaths)) zip.file(path, stripFormulaCaches(sheets.get(name)!));
  await enableFullCalcOnLoad(zip);
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  return { blob, written, unfilled: [...unfilled], skipped };
}
