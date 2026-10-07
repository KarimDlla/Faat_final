import JSZip from "jszip";
import type { Client, Project, Proposal, SpecField } from "./types";
import { systemLabel } from "./labels";
import { formatMoney } from "./utils";
import { toArabicSpec } from "./spec-ar";

// ---------------------------------------------------------------------------
// Generic .docx template filler.
//
// Why: the Word proposal must come from FAAT's approved template (branding,
// layout, legal wording) — not be assembled field-by-field in code. This file
// only ever REPLACES {{TOKEN}} placeholders that already exist in the
// template; it never writes prose or invents a value. A token with nothing to
// fill is left visibly empty ("—"), matching the "never invent data" rule.
//
// Swapping in a new template later (once one is uploaded) needs no code
// change here as long as it reuses the same {{TOKEN}} names — anything
// unrecognized is just left blank and reported back to the caller.
// ---------------------------------------------------------------------------

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// A value containing "\n" becomes a real Word line break (<w:br/>) rather than
// a literal backslash-n, so multi-line spec/terms text renders correctly.
function toRunXml(value: string) {
  return escapeXml(value).split("\n").join("</w:t></w:r><w:r><w:br/><w:t xml:space=\"preserve\">");
}

export type DocxFillResult = { blob: Blob; unfilledTokens: string[] };
export type SpecLike = { key?: string; label?: string; value: string };

// Plain tokens are UPPER_SNAKE ({{CLIENT_NAME}}). Generic spec tokens are {{SPEC:<label>}} — they are
// resolved by NAME against whatever specifications the quotation really contained, so a new template
// (chiller, VRF, ...) needs no new code: the author just writes the spec's name in the template.
const TOKEN_RE = () => /\{\{\s*((?:SPEC:[^{}]+?)|[A-Z0-9_]+)\s*\}\}/g;
const ITEM_TOKEN_RE = () => /\{\{\s*items\.([a-zA-Z0-9_]+)\s*\}\}/g;
const WORD_PARTS_RE = /^word\/(document|header\d*|footer\d*)\.xml$/;

const normLabel = (v: string) => v.toLowerCase().replace(/[\s:：\-_/()،,.]+/g, "");

export function lookupSpec(specs: SpecLike[], label: string): string | undefined {
  const want = normLabel(label);
  if (!want) return undefined;
  const filled = specs.filter((s) => s.value?.trim());
  const names = (s: SpecLike) => [s.label, s.key].filter((x): x is string => !!x).map(normLabel);
  const hit = filled.find((s) => names(s).some((n) => n === want)) ?? filled.find((s) => names(s).some((n) => n.includes(want)));
  return hit?.value.trim();
}

// Word often splits one typed token ("{{CLIENT_NAME}}") across several <w:r>/<w:t> pieces (spell-check,
// formatting, editing history). A plain regex then never sees the token. Within each paragraph, move any
// token that spans several <w:t> nodes into the first of them (keeping that run's formatting) and empty
// the others. The paragraph's visible text is unchanged.
export function mergeSplitTokens(xml: string): string {
  return xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (para) => {
    const nodeRe = /<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g;
    const nodes = [...para.matchAll(nodeRe)];
    if (nodes.length < 2) return para;
    const texts = nodes.map((n) => n[2]);
    const concat = texts.join("");
    if (!concat.includes("{{")) return para;
    let changed = false;
    for (const m of concat.matchAll(/\{\{[^{}]*\}\}/g)) {
      const s = m.index!, e = s + m[0].length;
      const bounds: number[] = [0];
      for (const t of texts) bounds.push(bounds[bounds.length - 1] + t.length);
      let i = -1, j = -1;
      for (let k = 0; k < texts.length; k++) {
        if (i < 0 && bounds[k] <= s && s < bounds[k + 1]) i = k;
        if (j < 0 && bounds[k] < e && e <= bounds[k + 1]) j = k;
      }
      if (i < 0 || j < 0 || i === j) continue;
      const prefix = texts[i].slice(0, s - bounds[i]);
      const suffix = texts[j].slice(e - bounds[j]);
      texts[i] = prefix + m[0];
      for (let k = i + 1; k < j; k++) texts[k] = "";
      texts[j] = suffix;
      changed = true;
    }
    if (!changed) return para;
    let idx = 0;
    return para.replace(nodeRe, (_full, attrs: string | undefined, _t: string) => {
      const text = texts[idx++];
      const a = attrs ?? "";
      const withSpace = /xml:space=/.test(a) ? a : `${a} xml:space="preserve"`;
      return `<w:t${withSpace}>${text}</w:t>`;
    });
  });
}

// Some templates (see buildElevatorTokens' table) repeat one table row per commercial line item —
// L1, L2, L3... groups instead of a fixed single row. The row containing the literal marker
// "{{ITEMS_ROW}}" (anywhere in one of its cells, alongside real {{items.field}} tokens in that
// same row) is cloned once per item; with no items, one placeholder row of dashes is kept so the
// table isn't silently empty.
function findLastRowStart(xml: string, beforeIndex: number): number {
  // "<w:tr" alone is ambiguous — it's also a prefix of "<w:trPr>" and "<w:trHeight>", both of
  // which appear *inside* a row, before its cell text. Only "<w:tr " or "<w:tr>" is the row
  // element itself.
  const re = /<w:tr[ >]/g;
  let m: RegExpExecArray | null;
  let last = -1;
  while ((m = re.exec(xml))) {
    if (m.index >= beforeIndex) break;
    last = m.index;
  }
  return last;
}

function expandItemsRow(xml: string, items: Record<string, string>[]): string {
  const markerIdx = xml.indexOf("{{ITEMS_ROW}}");
  if (markerIdx === -1) return xml;
  const rowStart = findLastRowStart(xml, markerIdx);
  const closeTag = "</w:tr>";
  const closeIdx = xml.indexOf(closeTag, markerIdx);
  if (rowStart === -1 || closeIdx === -1) return xml;
  const rowEnd = closeIdx + closeTag.length;
  const rowTemplate = xml.slice(rowStart, rowEnd).replace("{{ITEMS_ROW}}", "");

  const rows = (items.length ? items : [{}]).map((item) =>
    rowTemplate.replace(ITEM_TOKEN_RE(), (_m: string, key: string) => (item[key] !== undefined && item[key] !== "" ? toRunXml(String(item[key])) : "—"))
  );
  return xml.slice(0, rowStart) + rows.join("") + xml.slice(rowEnd);
}


// ---------------------------------------------------------------------------
// Table-cell style for filled values: every table cell that holds a placeholder gets Noto Sans Arabic, 11 pt,
// centred horizontally (paragraph) and vertically (cell). Static labels are not touched. Values that contain Arabic
// letters also get a right-to-left paragraph/run, so mixed text like "الطابق الأرضي: ستانليس ستيل" reads correctly.
// ---------------------------------------------------------------------------
const CELL_FONT = "Noto Sans Arabic";
const CELL_FONT_SIZE_HALF_POINTS = 22;   // Word stores size in half-points: 22 = 11 pt
const ARABIC_CHAR = /[\u0600-\u06FF]/;
const RUN_RE = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g;
const PARA_RE = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
const CELL_RE = /<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g;
// children that must stay AFTER <w:sz>/<w:szCs> inside <w:rPr>
const RPR_AFTER_SIZE = /<w:(?:highlight|u|effect|bdr|shd|fitText|vertAlign|rtl|cs|em|lang|eastAsianLayout|specVanish|oMath)\b/;
const RPR_AFTER_RTL = /<w:(?:cs|em|lang|eastAsianLayout|specVanish|oMath)\b/;

function insertBefore(inner: string, re: RegExp, add: string): string {
  const m = re.exec(inner);
  return m ? inner.slice(0, m.index) + add + inner.slice(m.index) : inner + add;
}

function styleRun(run: string, rtl: boolean): string {
  const fonts = `<w:rFonts w:ascii="${CELL_FONT}" w:hAnsi="${CELL_FONT}" w:eastAsia="${CELL_FONT}" w:cs="${CELL_FONT}"/>`;
  const size = `<w:sz w:val="${CELL_FONT_SIZE_HALF_POINTS}"/><w:szCs w:val="${CELL_FONT_SIZE_HALF_POINTS}"/>`;
  const open = /^<w:r(?:\s[^>]*)?>/.exec(run)![0];
  let rest = run.slice(open.length);
  let inner = "";
  const pr = /^<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(rest);
  if (pr) { inner = pr[1]; rest = rest.slice(pr[0].length); }
  else if (rest.startsWith("<w:rPr/>")) rest = rest.slice(8);
  inner = inner.replace(/<w:(?:rFonts|sz|szCs)\b[^>]*\/>/g, "");
  const style = /^<w:rStyle\b[^>]*\/>/.exec(inner);
  inner = style ? style[0] + fonts + inner.slice(style[0].length) : fonts + inner;
  inner = insertBefore(inner, RPR_AFTER_SIZE, size);
  if (rtl && !/<w:rtl\b/.test(inner)) inner = insertBefore(inner, RPR_AFTER_RTL, "<w:rtl/>");
  return `${open}<w:rPr>${inner}</w:rPr>${rest}`;
}

function stylePara(para: string, rtl: boolean): string {
  const open = /^<w:p(?:\s[^>]*)?>/.exec(para)![0];
  let rest = para.slice(open.length);
  let inner = "";
  const pp = /^<w:pPr>([\s\S]*?)<\/w:pPr>/.exec(rest);
  if (pp) { inner = pp[1]; rest = rest.slice(pp[0].length); }
  inner = inner.replace(/<w:jc\b[^>]*\/>/g, "");
  if (rtl && !/<w:bidi\b/.test(inner)) {
    inner = insertBefore(inner, /<w:(?:adjustRightInd|snapToGrid|spacing|ind|contextualSpacing|mirrorIndents|suppressOverlap|textDirection|textAlignment|textboxTightWrap|outlineLvl|divId|cnfStyle|rPr|sectPr|pPrChange)\b/, "<w:bidi/>");
  }
  // Zero space before/after: with the document's default paragraph spacing the text block (text + trailing gap) is what
  // gets vertically centred, so the text itself sits visibly high in the cell. Single line spacing, no extra gap.
  inner = inner.replace(/<w:spacing\b[^>]*\/>/g, "");
  inner = insertBefore(inner, /<w:(?:ind|contextualSpacing|mirrorIndents|suppressOverlap|jc|textDirection|textAlignment|textboxTightWrap|outlineLvl|divId|cnfStyle|rPr|sectPr|pPrChange)\b/, `<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>`);
  inner = insertBefore(inner, /<w:(?:textDirection|textAlignment|textboxTightWrap|outlineLvl|divId|cnfStyle|rPr|sectPr|pPrChange)\b/, `<w:jc w:val="center"/>`);
  const body = rest.replace(RUN_RE, (r) => styleRun(r, rtl));
  return `${open}<w:pPr>${inner}</w:pPr>${body}`;
}

function paraText(para: string): string {
  return [...para.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("");
}

/** Step 1 (before filling): style every table cell that contains a placeholder. */
function styleTokenCells(xml: string): string {
  return xml.replace(CELL_RE, (cell) => {
    if (!cell.includes("{{")) return cell;
    let c = cell.replace(/<w:noWrap\s*\/>/g, "");   // Arabic text is longer than the English it replaces: let it wrap
    if (/<w:tcPr>/.test(c)) {
      c = c.replace(/<w:tcPr>([\s\S]*?)<\/w:tcPr>/, (_m, inner: string) =>
        `<w:tcPr>${inner.replace(/<w:vAlign\b[^>]*\/>/g, "")}<w:vAlign w:val="center"/></w:tcPr>`);
    } else {
      c = c.replace(/^(<w:tc(?:\s[^>]*)?>)/, `$1<w:tcPr><w:vAlign w:val="center"/></w:tcPr>`);
    }
    return c.replace(PARA_RE, (p) => stylePara(p, false));
  });
}

/** Step 2 (after filling): runs created for line breaks have no formatting yet, and the text direction depends on the
 *  final value — so re-apply the style to every paragraph that step 1 marked (identified by its font). */
function finishStyledParagraphs(xml: string): string {
  return xml.replace(PARA_RE, (p) => {
    if (!p.includes(`w:ascii="${CELL_FONT}"`)) return p;
    return stylePara(p, ARABIC_CHAR.test(paraText(p)));
  });
}

export type DocxFillOptions = { /** Noto Sans Arabic 11 pt, centred, for every filled table cell. */ tableStyle?: boolean };

export async function fillDocxTemplate(
  templateBuffer: ArrayBuffer,
  tokens: Record<string, string>,
  items: Record<string, string>[] = [],
  specs: SpecLike[] = [],
  options: DocxFillOptions = {},
): Promise<DocxFillResult> {
  const zip = await JSZip.loadAsync(templateBuffer);
  if (!zip.file("word/document.xml")) throw new Error("القالب غير صالح: word/document.xml غير موجود");
  const unfilled = new Set<string>();

  const resolve = (key: string): string | undefined => (key.startsWith("SPEC:") ? lookupSpec(specs, key.slice(5)) : tokens[key]);

  for (const path of Object.keys(zip.files).filter((p) => WORD_PARTS_RE.test(p))) {
    let xml = await zip.file(path)!.async("text");
    xml = mergeSplitTokens(xml);
    if (options.tableStyle) xml = styleTokenCells(xml);
    xml = expandItemsRow(xml, items);
    xml = xml.replace(TOKEN_RE(), (match: string, key: string) => {
      const value = resolve(key.trim());
      return value !== undefined ? toRunXml(value) : match;
    });
    // Whatever the token map didn't cover, don't leave a raw "{{TAG}}" in front of the customer —
    // clear it, but tell the caller so it shows up as a reviewable gap instead of a silent one.
    xml = xml.replace(TOKEN_RE(), (_m: string, key: string) => { unfilled.add(key.trim()); return "—"; });
    xml = xml.replace(ITEM_TOKEN_RE(), (_m: string, key: string) => { unfilled.add(`items.${key}`); return "—"; });
    if (options.tableStyle) xml = finishStyledParagraphs(xml);
    zip.file(path, xml);
  }

  const out = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  return { blob: out, unfilledTokens: [...unfilled] };
}

export type DocxScan = {
  ok: boolean;
  error?: string;
  /** Plain tokens ({{CLIENT_NAME}}). */
  tokens: string[];
  /** Generic spec tokens, as the label that follows "SPEC:". */
  specLabels: string[];
  /** {{items.<field>}} names used inside a repeating row. */
  itemFields: string[];
  hasItemsRow: boolean;
};

// Used at upload time: tell the user what the template contains BEFORE it is saved.
export async function scanDocxTemplate(buffer: ArrayBuffer): Promise<DocxScan> {
  const empty = { tokens: [], specLabels: [], itemFields: [], hasItemsRow: false };
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(buffer); } catch { return { ok: false, error: "الملف ليس ملف Word (.docx) صالحاً", ...empty }; }
  if (!zip.file("word/document.xml")) return { ok: false, error: "الملف ليس ملف Word (.docx) صالحاً: word/document.xml غير موجود", ...empty };
  const tokens = new Set<string>(), specs = new Set<string>(), fields = new Set<string>();
  let hasItemsRow = false;
  for (const path of Object.keys(zip.files).filter((p) => WORD_PARTS_RE.test(p))) {
    const xml = mergeSplitTokens(await zip.file(path)!.async("text"));
    if (xml.includes("{{ITEMS_ROW}}")) hasItemsRow = true;
    for (const m of xml.matchAll(TOKEN_RE())) {
      const k = m[1].trim();
      if (k === "ITEMS_ROW") continue;
      if (k.startsWith("SPEC:")) specs.add(k.slice(5).trim()); else tokens.add(k);
    }
    for (const m of xml.matchAll(ITEM_TOKEN_RE())) fields.add(m[1]);
  }
  return { ok: true, tokens: [...tokens], specLabels: [...specs], itemFields: [...fields], hasItemsRow };
}

// Best-effort, pattern-based lookup — works for any system type since it
// matches on what the spec is *called*, not on a fixed per-system field list.
function findSpec(specs: SpecField[], pattern: RegExp): string {
  const hit = specs.find((s) => pattern.test(s.label || s.key));
  return hit?.value?.trim() || "";
}

export function buildProposalTokens(proposal: Proposal, project: Project, client: Client): Record<string, string> {
  const specs = proposal.specs;
  const extraction = proposal.extraction;
  const generalSpecs = extraction?.generalSpecifications.map((s) => ({ key: s.key, label: s.key, value: s.value })) ?? specs;

  const model = findSpec(generalSpecs, /model|موديل/i);
  const type = findSpec(generalSpecs, /type|نوع/i);
  const capacity = findSpec(generalSpecs, /capacity|حمولة|قدرة/i);
  const rating = findSpec(generalSpecs, /speed|rating|rated|سرعة|تصنيف/i);
  const control = findSpec(generalSpecs, /control|تحكم/i);

  // Specs beyond the five above still need to be visible somewhere — folded into the
  // free-text TECHNICAL_SPECIFICATIONS paragraph so nothing extracted gets silently dropped.
  const consumed = new Set([model, type, capacity, rating, control].filter(Boolean));
  const extraSpecText = generalSpecs
    .filter((s) => s.value && !consumed.has(s.value))
    .map((s) => `${s.label || s.key}: ${s.value}`)
    .join("\n");

  const itemQty = extraction?.items.reduce((n, x) => n + Math.max(0, x.quantity), 0) || proposal.units?.reduce((n, u) => n + u.quantity, 0) || 0;

  const projectUnderstanding = `يتم إعداد العرض بناءً على متطلبات المشروع والوثائق المتاحة، مع مراعاة التنسيق الهندسي، التوريد، التركيب، الاختبارات والتشغيل والتسليم وفق نطاق الأعمال المعتمد.`;
  const proposedSolution = `تقديم حل ${systemLabel[proposal.systemType].en} متكامل وفق البيانات الفنية المستخرجة من كوتيشن المورد والمراجعة البشرية قبل الاعتماد.`;
  const scope = `• التوريد وفق المواصفات المعتمدة\n• التنسيق الهندسي والتركيب ضمن حدود العرض\n• الاختبارات والتشغيل والتسليم\n• الضمان والصيانة المجانية حسب الشروط المبينة`;
  const exclusions = `• أي أعمال أو مواد غير مذكورة صراحة في هذا العرض\n• الأعمال المدنية الرئيسية والتغذية الكهربائية العامة ما لم تُذكر ضمن نطاق العرض\n• أي تغيير بعد الاعتماد يخضع لتقييم وأمر تغيير منفصل`;
  const generalTerms = `تخضع الأسعار لصلاحية العرض ${proposal.validityDays} يوماً من تاريخ العرض. أي تعديل في النطاق أو المواصفات أو الكميات بعد الاعتماد قد يؤدي إلى تعديل القيمة والمدة. جميع البيانات المستخرجة من عروض الموردين تخضع للمراجعة والاعتماد قبل إصدار العرض النهائي.`;
  const company = `FAAT Engineering، بجذور تعود إلى عام 1968، هي مقاول إقليمي للأعمال الكهروميكانيكية يركز على الأنظمة الهندسية الموثوقة والتنفيذ المنضبط والأداء طويل الأمد. تقدم الشركة حلولاً متكاملة في المصاعد والسلالم الكهربائية، HVAC، وحدات معالجة الهواء الصحية، وأنظمة التهوية وإدارة الدخان، وتشمل خدماتها التصميم والتوريد والتركيب والتشغيل والتسليم والتحديث والدعم طوال دورة حياة النظام.`;

  return {
    PROPOSAL_REF: `${proposal.number}${proposal.revision ? ` / Rev ${proposal.revision}` : ""}`,
    PROPOSAL_DATE: proposal.date,
    CLIENT_NAME: client.name || client.nameAr || "—",
    PROJECT_NAME: project.name || project.nameAr || "",
    PROJECT_LOCATION: project.location || "",
    SYSTEM_TYPE_EN: extraction?.systemLabel || systemLabel[proposal.systemType].en,
    SYSTEM_TYPE_AR: systemLabel[proposal.systemType].ar,
    COMPANY_PROFILE: company,
    PROJECT_UNDERSTANDING: projectUnderstanding,
    PROPOSED_SOLUTION: proposedSolution,
    SCOPE_OF_WORK: scope,
    TECHNICAL_SPECIFICATIONS: extraSpecText,
    MODEL: model || "—",
    TYPE: type || "—",
    CAPACITY: capacity || "—",
    RATING: rating || "—",
    CONTROL_SYSTEM: control || "—",
    COMMERCIAL_OFFER: "القيمة الإجمالية للعرض بالدولار الأمريكي، شاملة التوريد والتركيب والتشغيل وفق نطاق الأعمال أعلاه:",
    QUANTITY: String(itemQty || proposal.units?.reduce((n, u) => n + u.quantity, 0) || 1),
    CONTRACT_VALUE: formatMoney(proposal.sellingPrice, proposal.currency),
    ADDITIONAL_QTY: "",
    ADDITIONAL_VALUE: "",
    TOTAL_CONTRACT_VALUE: formatMoney(proposal.sellingPrice, proposal.currency),
    DELIVERY_SCHEDULE: `التوريد: ${proposal.schedule.supplyMin}–${proposal.schedule.supplyMax} أسبوع · التركيب: ${proposal.schedule.installMin}–${proposal.schedule.installMax} أسبوع · الاختبار والتشغيل: ${proposal.schedule.testMin}–${proposal.schedule.testMax} أسبوع`,
    PAYMENT_TERMS: `دفعة مقدمة ${proposal.payment.advance}% - عند الشحن ${proposal.payment.shipping}% - عند التسليم ${proposal.payment.handover}%`,
    WARRANTY_TERMS: extraction?.terms.warranty || `ضمان ${proposal.schedule.warrantyMonths} شهر، وصيانة مجانية ${proposal.schedule.freeMaintenanceMonths} شهر.`,
    EXCLUSIONS: exclusions,
    GENERAL_TERMS: generalTerms,
    AUTHORIZED_SIGNATORY: proposal.owner || "",
  };
}

const ARABIC_MONTHS = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"];
function arabicDate(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return `${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ---------------------------------------------------------------------------
// Elevator-specific token builder, for public/templates/FAAT Elevator Offer
// Template.docx (FAAT's real SHARP-elevator proposal document). This template
// has fixed row labels for elevator/cabin/landing specs — that's the actual
// approved document layout, not something invented here; the values dropped
// into those rows are still whatever the AI actually found (fuzzy-matched by
// label, same "never invent" rule as buildProposalTokens above), never
// fabricated. Commercial line items repeat once per L1/L2/L3 group
// (proposal.units) via the {{ITEMS_ROW}} marker handled in fillDocxTemplate.
//
// Caveats worth knowing (see chat for the full explanation):
// - This template prices in Syrian Lira in its own static wording; the actual
//   number filled in follows proposal.currency as-is, no conversion is guessed.
// - The payment schedule (percent + amount of each instalment, and the 95% / 5% wording of the
//   "الاستحقاق" and "تثبيت الطلبية" clauses) is NOT static any more: it follows proposal.payment
//   (advance / shipping / handover — the three fields on the website) through the PAYMENT_* tokens.
// - TOTAL_PRICE_WORDS (amount spelled out in Arabic words) is left as the same
//   formatted number rather than a generated Arabic word-form, since an
//   auto-generated number-to-words conversion risks being wrong — fill that
//   manually until a proper Arabic numeral-to-words routine is added.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Quotation tables → specs. Supplier quotations usually list cabin / landing specs as a TABLE
// (columns "Item | Component | Specification": row "Cabin rear wall" → "Mirror etching hairline ...").
// Those rows live in extraction.dynamicTables, NOT in generalSpecifications, so they were never
// searched. Every 2-column "name → value" table is flattened here into ordinary specs
// (label = the component cell, value = the specification cell). Price/quantity tables are skipped.
// ---------------------------------------------------------------------------
type TableLike = { columns: { key: string; label: string; type?: string }[]; rows: { cells: { key: string; value: string }[] }[] };
const COL_INDEX = /^(item|no\.?|#|sr\.?|s\/n|ref|م|الرقم|رقم|ت)$/i;
const COL_LABEL = /component|parameter|part|feature|name|description|الجزء|البند|المكون|المعامل|الوصف/i;
const COL_VALUE = /spec|value|detail|remark|المواصفات|المواصفة|القيمة|التفاصيل/i;
const COL_MONEY = /price|total|amount|qty|quantity|cost|سعر|كمية|إجمالي|الإجمالي|مبلغ/i;

export function flattenTableSpecs(tables: TableLike[] | undefined): SpecLike[] {
  const out: SpecLike[] = [];
  for (const t of tables ?? []) {
    const cols = t.columns.map((c) => ({ ...c, name: (c.label || c.key || "").trim() }));
    const data = cols.filter((c) => !COL_INDEX.test(c.name));   // the "Item" number column is only an index
    if (data.length < 2) continue;
    if (data.some((c) => COL_MONEY.test(c.name) || c.type === "currency")) continue;   // price / quantity tables
    let valueCol = data.find((c) => COL_VALUE.test(c.name));
    let labelCol = data.find((c) => c !== valueCol && COL_LABEL.test(c.name)) ?? data.find((c) => c !== valueCol);
    if (!valueCol) valueCol = data.length === 2 ? data.find((c) => c !== labelCol) : undefined;
    if (!labelCol || !valueCol) continue;
    for (const r of t.rows) {
      const get = (key: string) => r.cells.find((c) => c.key === key)?.value?.trim() ?? "";
      const label = get(labelCol.key), value = get(valueCol.key);
      if (label && value) out.push({ key: label, label, value });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Bilingual aliases. Supplier quotations are usually English while the template rows are Arabic, so
// matching on Arabic labels alone left most rows as "—". Each token lists every name it may appear
// under (Arabic + English), in priority order. Add a synonym here — no other code change needed.
// A spec is matched when its (normalised) label CONTAINS an alias; each spec is used at most once.
// ---------------------------------------------------------------------------
export const ELEVATOR_SPEC_ALIASES: Record<string, string[]> = {
  ELV_NAME: ["اسم المصعد", "elevator name", "lift name", "product name"],
  ELV_MODEL: ["طراز المصعد", "طراز", "موديل", "elevator model", "lift model", "model no", "model"],
  ELV_TYPE: ["نوع المصعد", "elevator type", "lift type", "type of elevator", "usage", "application"],
  ELV_CAPACITY: ["الحمولة", "rated load", "load capacity", "capacity", "load"],
  ELV_PERSONS: ["عدد الأشخاص", "persons", "passengers", "people"],
  ELV_FLOORS_STOPS_OPENINGS: ["الطوابق/ المواقف", "الطوابق", "floors/stops/openings", "floors stops", "stops/doors", "floors", "stops", "landings"],
  ELV_SERVED_STOPS: ["أسماء المواقف", "served floors", "served stops", "floor names", "stop names", "floors served"],
  ELV_DOOR_DIM: ["أبعاد الباب", "door size", "door dimension", "door opening size", "opening size", "clear opening", "door width"],
  // Direction of the landing doors = the quotation's "Car entrances" row (Single / Double ...). It must NOT match
  // "Door opening type" (Center opening / Side opening) — that one belongs to ELV_LANDING_DOOR_TYPE.
  ELV_LANDING_DOOR_DIRECTION: ["اتجاه الأبواب", "car entrances", "car entrance", "entrances", "entrance", "door opening direction", "opening direction", "door direction"],
  ELV_LANDING_DOOR_TYPE: ["نوع الأبواب الطابقية", "door opening type", "opening type", "door opening mode", "opening mode", "landing door type", "hall door type", "door type"],
  ELV_SHAFT_CONSTRUCTION: ["إنشاء البئر", "hoistway type", "shaft type", "hoistway construction", "shaft construction", "hoistway structure", "shaft structure", "hoistway material", "shaft material"],
  ELV_SHAFT_DIM: ["أبعاد البئر", "shaft size", "shaft dimension", "hoistway size", "hoistway dimension", "shaft width", "shaft"],
  ELV_OVERHEAD: ["ارتفاع البئر", "overhead", "headroom", "top floor height", "top height"],
  ELV_PIT_DEPTH: ["عمق الحفرة", "pit depth", "pit"],
  ELV_TRAVEL: ["شوط الصاعدة", "travel height", "lifting height", "travel", "rise"],
  ELV_TOTAL_HEIGHT: ["الارتفاع الكلي", "total height", "overall height"],
  ELV_CAR_DIM: ["أبعاد الصاعدة", "car size", "car dimension", "cabin size", "cabin dimension", "car internal", "internal size"],
  ELV_MOTOR: ["المحرك", "traction machine", "motor", "machine type", "gearless", "machine"],
  ELV_MACHINE_ROOM: ["غرفة المحرك", "machine room", "machine-room", "mrl", "mr/mrl"],
  ELV_CONTROL_PANEL: ["لوحة التحكم", "control panel", "control cabinet", "control board", "controller", "integration control", "integrated control"],
  ELV_OPERATION_SYSTEM: ["نظام التشغيل", "operation mode", "operation system", "control mode", "control system", "operation", "control", "collective", "duplex", "simplex"],
  ELV_SPEED: ["السرعة", "rated speed", "speed", "velocity", "m/s"],

  CABIN_WALL_RIGHT: ["الجدار اليميني", "right wall", "right side wall", "side wall", "cabin wall", "car wall"],
  CABIN_WALL_LEFT: ["الجدار اليساري", "left wall", "left side wall", "side wall", "cabin wall", "car wall"],
  CABIN_WALL_REAR: ["الجدار الخلفي", "rear wall", "back wall", "cabin wall", "car wall"],
  CABIN_CEILING: ["سقف الصاعدة", "car ceiling", "cabin ceiling", "ceiling", "canopy"],
  CABIN_FLOOR: ["أرضية الصاعدة", "car floor", "cabin floor", "floor finish", "flooring", "floor material", "floor"],
  CABIN_DOOR: ["باب الصاعدة", "car door", "cabin door"],
  CABIN_COP: ["لوحة الطلب الداخلية", "car operating panel", "cop"],
  CABIN_LIGHTING: ["الإضاءة", "lighting", "light"],
  CABIN_VENTILATION: ["التهوية", "ventilation", "fan"],
  CABIN_HANDRAIL: ["مسكة اليد", "handrail", "hand rail"],

  LANDING_GROUND_DOOR: ["باب الطابق الأرضي", "main landing door", "ground floor door", "main floor door", "landing door", "hall door"],
  LANDING_GROUND_FRAME: ["إطار الباب الأرضي", "main landing frame", "ground floor frame", "main floor frame", "door jamb", "jamb", "door frame"],
  LANDING_DOORS: ["الأبواب الطابقية", "other landing doors", "landing doors", "landing door", "hall doors", "hall door"],
  LANDING_FRAME: ["إطار الأبواب الطابقية", "landing door frame", "landing frame", "hall door frame", "door jamb", "jamb", "door frame"],
  LANDING_LOP: ["لوحة الطلب الطابقية", "landing operating panel", "hall call", "landing call", "hall button", "lop"],
};


// Payment schedule straight from the website's three fields (proposal.payment). Percent tokens are bare numbers (the
// template keeps its own "%" sign). Amounts are computed from the same percentages, so the % and the amount next to
// it can never disagree; when the three percentages add up to 100 the last amount takes the rounding remainder so the
// three amounts always add up to the total exactly.
function paymentTokens(proposal: Proposal): Record<string, string> {
  const pay = proposal.payment ?? { advance: 0, shipping: 0, handover: 0 };
  const pct = [pay.advance, pay.shipping, pay.handover].map((n) => (Number.isFinite(n) ? n : 0));
  const total = proposal.sellingPrice;
  const amounts = pct.map((p) => Math.round((total * p) / 100));
  if (Math.abs(pct[0] + pct[1] + pct[2] - 100) < 1e-9) amounts[2] = total - amounts[0] - amounts[1];
  const num = (n: number) => String(Math.round(n * 100) / 100);
  return {
    PAYMENT_1_PCT: num(pct[0]), PAYMENT_2_PCT: num(pct[1]), PAYMENT_3_PCT: num(pct[2]),
    // Everything due once the goods reach the site = advance + shipping instalment (the clauses' "95%").
    PAYMENT_ON_ARRIVAL_PCT: num(pct[0] + pct[1]),
    PAYMENT_1_AMOUNT: formatMoney(amounts[0], proposal.currency),
    PAYMENT_2_AMOUNT: formatMoney(amounts[1], proposal.currency),
    PAYMENT_3_AMOUNT: formatMoney(amounts[2], proposal.currency),
  };
}

// Rows of the "مواصفات الكبين" and "مواصفات قاعة الوصول" tables — written in Arabic.
const ARABIC_TABLE_TOKENS = [
  "CABIN_WALL_RIGHT", "CABIN_WALL_LEFT", "CABIN_WALL_REAR", "CABIN_CEILING", "CABIN_FLOOR", "CABIN_DOOR", "CABIN_COP",
  "CABIN_LIGHTING", "CABIN_VENTILATION", "CABIN_HANDRAIL",
  "LANDING_GROUND_DOOR", "LANDING_GROUND_FRAME", "LANDING_DOORS", "LANDING_FRAME", "LANDING_LOP",
];

// A sentence that describes the control PANEL/system hardware (e.g. "Adopt Monarch 3000+ integration control system").
// Requires "control" + system/panel/cabinet/board or "controller", so "Full selective control" / "Start protection control"
// (standard functions) do not match, and the operation-mode row ("Control system: Duplex") is excluded below.
const CONTROL_PANEL_TEXT = /control\s*(system|panel|cabinet|board)|controller|لوحة\s*التحكم/i;
const OPERATION_MODE_TEXT = /simplex|duplex|triplex|collective/i;
function findControlPanelText(ex: Proposal["extraction"] | undefined): string | undefined {
  return findFreeText(ex, CONTROL_PANEL_TEXT, OPERATION_MODE_TEXT);
}
// First sentence (≥ 4 words) anywhere in the quotation's free text that matches `include` and not `exclude`.
function findFreeText(ex: Proposal["extraction"] | undefined, include: RegExp, exclude?: RegExp): string | undefined {
  if (!ex) return undefined;
  const texts: string[] = [
    ...(ex.notes ?? []),
    ...(ex.projectStructure ?? []).flatMap((p) => [p.title, p.summary]),
    ...(ex.generalSpecifications ?? []).flatMap((g) => [g.value]),
    ...(ex.items ?? []).flatMap((it) => [it.description, ...it.specifications.map((s) => s.value)]),
    ...(ex.dynamicTables ?? []).flatMap((t) => t.rows.flatMap((r) => r.cells.map((c) => c.value))),
  ].map((x) => (x ?? "").replace(/\s+/g, " ").trim()).filter(Boolean);
  // At least 4 words: a bare row label such as "Control system" is not the answer, the sentence about it is.
  return texts.find((x) => x.split(" ").length >= 4 && include.test(x) && !(exclude?.test(x)));
}

export function buildElevatorTokens(proposal: Proposal, project: Project, client: Client): { tokens: Record<string, string>; items: Record<string, string>[]; missing: string[]; unmatchedSpecs: string[]; untranslated: string[] } {
  const extraction = proposal.extraction;
  // Specs can sit in generalSpecifications or on a specific line item (items[].specifications), and
  // can also be edited per group in the review screen (proposal.units[].specs) — search all of them.
  const itemSpecs = extraction?.items.flatMap((it) => it.specifications.map((s) => ({ key: s.key, label: s.key, value: s.value }))) ?? [];
  const unitSpecs = (proposal.units ?? []).flatMap((u) => (u.specs ?? []).map((s) => ({ key: s.key, label: s.label || s.key, value: s.value })));
  const generalSpecs: SpecLike[] = [
    ...(extraction?.generalSpecifications.map((s) => ({ key: s.key, label: s.key, value: s.value })) ?? proposal.specs),
    ...itemSpecs,
    ...flattenTableSpecs(extraction?.dynamicTables),
    ...unitSpecs,
  ].filter((s) => s.value?.trim());

  const used = new Set<SpecLike>();
  const missing: string[] = [];
  // Word-level matching: alias "cop" must not hit "Scope of supply", "floor" must not hit "Floors".
  const words = (v: string) => ` ${v.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
  const labelsOf = (s: SpecLike) => [s.label, s.key].filter((x): x is string => !!x).map(words);
  // A "Lighting" spec that is really the electrical supply ("Power supply: lighting 220V") is not the cabin lighting.
  const EXCLUDE: Record<string, RegExp> = {
    CABIN_LIGHTING: /power|supply|voltage|volt|phase|hz|تغذية|كهرب|جهد/i,
    CABIN_VENTILATION: /power|supply|voltage|volt|phase|hz|تغذية|كهرب|جهد/i,
    // "Door opening size" is the door dimension; "Door opening type" / "direction" are not.
    ELV_DOOR_DIM: /type|direction|mode|نوع|اتجاه/i,
    ELV_SHAFT_DIM: /type|construction|structure|material|نوع|إنشاء/i,
  };
  // Values that identify a row regardless of what the label says (collective/duplex = operation system).
  // The control PANEL is often a label-less line in the quotation's special notes ("Adopt <brand> integration control
  // system"), so it is recognised by what the sentence says, never by its row number.
  const VALUE_HINT: Record<string, RegExp> = {
    ELV_OPERATION_SYSTEM: /simplex|duplex|triplex|collective|selective|group control/i,
    ELV_CONTROL_PANEL: CONTROL_PANEL_TEXT,
  };
  const EXCLUDE_VALUE: Record<string, RegExp> = { ELV_CONTROL_PANEL: /simplex|duplex|triplex|collective/i };
  // One quotation row can legitimately describe several template rows (one "Cabin side wall" for left AND
  // right, one "Landing door" for ground + other floors, one "Door jamb" for both frames) — never consumed.
  const SHARED = new Set(["CABIN_WALL_RIGHT", "CABIN_WALL_LEFT", "CABIN_WALL_REAR", "LANDING_GROUND_DOOR", "LANDING_DOORS", "LANDING_GROUND_FRAME", "LANDING_FRAME"]);
  const find = (token: string, aliases: string[]): SpecLike | undefined => {
    const ok = (s: SpecLike) => (SHARED.has(token) || !used.has(s)) && !(EXCLUDE[token]?.test(`${s.label ?? ""} ${s.key ?? ""}`)) && !(EXCLUDE_VALUE[token]?.test(s.value ?? ""));
    const hint = VALUE_HINT[token];
    if (hint && token !== "ELV_CONTROL_PANEL") { const h = generalSpecs.find((s) => ok(s) && hint.test(s.value)); if (h) return h; }
    for (const alias of aliases) {
      const a = words(alias);
      if (a.trim() === "") continue;
      const hit = generalSpecs.find((s) => ok(s) && labelsOf(s).some((n) => n === a))
        ?? generalSpecs.find((s) => ok(s) && labelsOf(s).some((n) => n.includes(a)));
      if (hit) return hit;
    }
    if (hint && token === "ELV_CONTROL_PANEL") return generalSpecs.find((s) => ok(s) && hint.test(s.value));
    return undefined;
  };
  const pick = (token: string): string => {
    const hit = find(token, ELEVATOR_SPEC_ALIASES[token] ?? []);
    if (!hit) { missing.push(token); return "—"; }
    if (!SHARED.has(token)) used.add(hit);
    return hit.value.trim();
  };

  const firstItem = extraction?.items[0];
  const units = proposal.units?.length ? proposal.units : [{ id: "u1", code: "L1", description: "المجموعة الرئيسية", quantity: 1, specs: [] as SpecField[] }];
  const totalQty = units.reduce((n, u) => n + u.quantity, 0) || 1;

  // Order matters: specific rows first, generic ones (model/type/shaft/floor...) after, so a broad
  // alias can't swallow a more specific spec.
  const t: Record<string, string> = {};
  for (const k of ["ELV_LANDING_DOOR_TYPE", "ELV_DOOR_DIM", "ELV_LANDING_DOOR_DIRECTION", "ELV_SHAFT_CONSTRUCTION", "ELV_SHAFT_DIM", "ELV_OVERHEAD", "ELV_PIT_DEPTH", "ELV_TOTAL_HEIGHT", "ELV_TRAVEL",
    "ELV_CAR_DIM", "ELV_SERVED_STOPS", "ELV_FLOORS_STOPS_OPENINGS", "ELV_PERSONS", "ELV_CAPACITY", "ELV_MACHINE_ROOM", "ELV_MOTOR", "ELV_CONTROL_PANEL",
    "ELV_OPERATION_SYSTEM", "ELV_SPEED", "ELV_NAME", "ELV_TYPE", "ELV_MODEL",
    "CABIN_COP", "CABIN_DOOR", "CABIN_CEILING", "CABIN_FLOOR", "CABIN_LIGHTING", "CABIN_VENTILATION", "CABIN_HANDRAIL",
    "LANDING_GROUND_FRAME", "LANDING_GROUND_DOOR", "LANDING_FRAME", "LANDING_DOORS", "LANDING_LOP"]) t[k] = pick(k);
  for (const k of ["CABIN_WALL_RIGHT", "CABIN_WALL_LEFT", "CABIN_WALL_REAR"]) t[k] = pick(k);

  // Name / model / type often live only in the line item itself (e.g. "SE500M Passenger Elevator").
  // Those fallbacks are real data, so they don't count as missing.
  const fb = (token: string, value: string | undefined) => {
    if (t[token] === "—" && value) { t[token] = value; const i = missing.indexOf(token); if (i >= 0) missing.splice(i, 1); }
  };
  fb("ELV_NAME", firstItem?.description);
  fb("ELV_MODEL", firstItem?.code || firstItem?.description);
  fb("ELV_TYPE", firstItem?.category);
  // Control panel: if no labelled spec carried it, look at free text of the quotation (special notes, unlabeled table
  // rows, structure summaries) for a sentence about the control system/panel. Real text only — nothing is invented.
  fb("ELV_CONTROL_PANEL", findControlPanelText(extraction));
  fb("CABIN_HANDRAIL", findFreeText(extraction, /hand\s*-?\s*rail/i));
  // Quotations phrase this line as "Adopt <brand> integration control system" — the word "Adopt" is supplier wording,
  // not part of the product name, so it is dropped (rest of the sentence stays exactly as written).
  if (t.ELV_CONTROL_PANEL && t.ELV_CONTROL_PANEL !== "—") {
    const cleaned = t.ELV_CONTROL_PANEL.replace(/^\s*(adopts?|adopted|adopting|use|using)\s*[:\-]?\s+/i, "").trim();
    if (cleaned) t.ELV_CONTROL_PANEL = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // Cabin + landing-hall tables are written in Arabic. Glossary translation only; unknown English words are kept as-is
  // and reported (untranslated) instead of being guessed.
  const untranslated = new Set<string>();
  for (const k of ARABIC_TABLE_TOKENS) {
    if (!t[k] || t[k] === "—") continue;
    const r = toArabicSpec(t[k]);
    t[k] = r.text;
    r.untranslated.forEach((w) => untranslated.add(w));
  }

  const items = units.map((u) => {
    const unitSpecCapacity = u.specs.find((s) => (ELEVATOR_SPEC_ALIASES.ELV_CAPACITY).some((a) => normLabel(s.label || s.key).includes(normLabel(a))))?.value;
    const unitSpecStops = u.specs.find((s) => (ELEVATOR_SPEC_ALIASES.ELV_FLOORS_STOPS_OPENINGS).some((a) => normLabel(s.label || s.key).includes(normLabel(a))))?.value;
    const share = u.quantity / totalQty;
    return {
      name: u.code ? `${u.code} — ${u.description}` : u.description,
      capacity: unitSpecCapacity || t.ELV_CAPACITY || "—",
      stops: unitSpecStops || t.ELV_FLOORS_STOPS_OPENINGS || "—",
      qty: String(u.quantity),
      price: formatMoney(Math.round(proposal.sellingPrice * share), proposal.currency),
    };
  });

  const totalFormatted = formatMoney(proposal.sellingPrice, proposal.currency);
  const offerNo = `${proposal.number}${proposal.revision ? ` / Rev ${proposal.revision}` : ""}`;

  const tokens: Record<string, string> = {
    OFFER_NO: offerNo,
    PROPOSAL_DATE: proposal.date,
    PROPOSAL_DATE_AR: arabicDate(proposal.date),
    SIGN_CITY: "دمشق",
    PROJECT_NAME: project.name || project.nameAr || "",
    CLIENT_NAME: client.name || client.nameAr || "—",
    VALIDITY_DAYS: String(proposal.validityDays || ""),

    ELV_COUNT: String(totalQty),
    ...t,

    INSTALL_DURATION: proposal.schedule ? `${proposal.schedule.installMin}–${proposal.schedule.installMax} أسبوع من تاريخ توريد التجهيزات إلى الموقع` : "",

    TOTAL_QTY: String(totalQty),
    TOTAL_PRICE: totalFormatted,
    TOTAL_PRICE_WORDS: totalFormatted,
    ...paymentTokens(proposal),
  };

  const unmatchedSpecs = generalSpecs.filter((s) => !used.has(s)).map((s) => `${s.label || s.key}: ${s.value}`);
  return { tokens, items, missing, unmatchedSpecs, untranslated: [...untranslated] };
}
