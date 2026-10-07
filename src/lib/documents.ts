import * as XLSX from "xlsx";
import { toast } from "sonner";
import type { Client, Project, Proposal } from "./types";
import { computePricing } from "./pricing";
import { systemLabel } from "./labels";
import { fillDocxTemplate } from "./docx-template";
import { fillXlsxTemplate, isPlaceholderTemplate } from "./xlsx-template";
import { CCS_CAPACITY, fillCcsWorkbook, type CcsGroupInput } from "./ccs-workbook";
import { splitElevatorGroups } from "./split-elevator-groups";
import { fillXlsxXml } from "./xlsx-fill";
import { templateStore } from "./template-registry";
import { DEFAULT_CCS_TEMPLATE_PATH, DEFAULT_ELEVATOR_WORD_TEMPLATE_PATH, DEFAULT_EXCEL_TEMPLATE_PATH, DEFAULT_WORD_TEMPLATE_PATH, excelSlotType } from "./template-defaults";
import { buildExcelValues, buildWordValues } from "./template-values";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function names(proposal: Proposal, project: Project) {
  const base = `FAAT ${systemLabel[proposal.systemType].en} Proposal - ${project.name} - ${proposal.number}`;
  return {
    docx: `${base}.docx`,
    xlsx: `FAAT Cost Sheet - ${project.name} - ${proposal.number}.xlsx`,
  };
}

// If a real placeholder-based Excel template is dropped at this path (with {{TOKEN}} cells and,
// optionally, a {{ITEMS_ROW}} marker row — see xlsx-template.ts), it's used as-is. Otherwise we
// fall back to building a plain, fully-dynamic workbook from the extraction data below — this
// fallback still never invents values, it's just not styled against an approved template yet.
const EXCEL_TEMPLATE_PATH = DEFAULT_EXCEL_TEMPLATE_PATH;

// Elevator / escalator / moving-walk projects are priced with the owner's CCS workbook. Its Excel
// formulas stay exactly as built — this code only writes the inputs (quantity + FOB per group, plus a
// few header labels and elevator facts). Everything else (profit %, overhead, customs, tax %,
// discount %…) stays manual in Excel. See ccs-workbook.ts.
const CCS_TEMPLATE_PATH = DEFAULT_CCS_TEMPLATE_PATH;

async function generateCcsExcel(proposal: Proposal, project: Project) {
  // A CCS workbook uploaded through the template manager (same sheets/cells) wins over the built-in one.
  const custom = await templateStore.getActive(excelSlotType(proposal.systemType), "xlsx");
  const buffer = custom && custom.mode === "ccs" ? custom.data : await fetchTemplate(CCS_TEMPLATE_PATH, "Excel");
  let groups: CcsGroupInput[] = (proposal.units ?? []).map((u) => ({
    code: u.code, description: u.description, quantity: u.quantity, fobUnit: u.fobUnit, technical: u.technical,
  }));
  // One elevator = one cost sheet. If a group still says "L1 × 2" (e.g. the quantity was edited by hand after
  // extraction), split it here so every elevator is priced separately. No-op when already split.
  if (proposal.systemType === "elevators") {
    const r = splitElevatorGroups(groups, { max: CCS_CAPACITY.L });
    groups = r.groups;
    if (r.overflow) toast.warning(`عدد المصاعد أكبر من ${CCS_CAPACITY.L} — لم يتم فصل المجموعات في Excel، راجع الأوراق يدوياً.`);
  }
  const { blob, skipped, missingFob } = await fillCcsWorkbook(buffer, {
    projectName: project.name, quoteNumber: proposal.extraction?.quoteNumber, quoteDate: proposal.extraction?.quoteDate,
  }, groups);
  // Never drop anything silently: tell the user exactly what did not make it into the workbook.
  for (const sk of skipped) toast.warning(`لم تُضف المجموعة ${sk.code} إلى ملف Excel: ${sk.reason}`);
  if (missingFob.length) toast.warning(`FOB غير محدد للمجموعات: ${missingFob.join("، ")} — أدخله في ورقة التكلفة داخل Excel`);
  const filename = names(proposal, project).xlsx;
  downloadBlob(blob, filename);
  return filename;
}

export async function generateExcel(proposal: Proposal, project: Project, client: Client) {
  if ((proposal.systemType === "elevators" || proposal.systemType === "escalators") && proposal.units?.length) return generateCcsExcel(proposal, project);
  const pricing = computePricing(proposal.fob, proposal.costLines, proposal.sellingPrice);
  const extraction = proposal.extraction;

  // An Excel template uploaded for this system type (placeholders and/or cell map) — filled at XML level
  // so its formulas and formatting survive. Takes priority over everything below.
  const custom = await templateStore.getActive(excelSlotType(proposal.systemType), "xlsx");
  if (custom && custom.mode === "tokens") {
    const { values, items, specs } = buildExcelValues(proposal, project, client);
    const res = await fillXlsxXml(custom.data, values, items, custom.cellMap ?? [], specs);
    if (res.unfilled.length) toast.warning(`قالب Excel: لا توجد بيانات للحقول التالية وتُركت "—": ${res.unfilled.join("، ")}`);
    for (const sk of res.skipped) toast.warning(`قالب Excel — ${sk.where}: ${sk.reason}`);
    const filename = names(proposal, project).xlsx;
    downloadBlob(res.blob, filename);
    return filename;
  }

  const templateRes = await fetch(encodeURI(EXCEL_TEMPLATE_PATH)).catch(() => null);
  if (templateRes?.ok) {
    const buf = await templateRes.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellStyles: true });
    if (isPlaceholderTemplate(wb)) {
      const tokens = {
        PROJECT_NAME: project.name, CLIENT_NAME: client.name || client.nameAr,
        SYSTEM_LABEL: extraction?.systemLabel || systemLabel[proposal.systemType].en,
        SUPPLIER: extraction?.supplier ?? "", QUOTE_NUMBER: extraction?.quoteNumber ?? "", QUOTE_DATE: extraction?.quoteDate ?? "",
        CURRENCY: proposal.currency, SUPPLIER_GRAND_TOTAL: extraction?.commercial.grandTotal ?? proposal.fob,
        SELLING_PRICE: proposal.sellingPrice, MARGIN: pricing.marginAmount, OPERATING_COST: pricing.operating,
      };
      const items = (extraction?.items ?? []).map((x) => ({ location: x.location, category: x.category, code: x.code, description: x.description, qty: x.quantity, unit: x.unit, unit_price: x.unitPrice, total: x.total }));
      const { unfilled } = fillXlsxTemplate(wb, tokens, items);
      if (unfilled.length) console.warn("Excel template: unmapped placeholders left blank —", unfilled.join(", "));
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true, compression: true });
      const filename = names(proposal, project).xlsx;
      downloadBlob(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
      return filename;
    }
  }

  const wb = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet([
    ["FAAT Engineering — Quotation / Proposal"], ["Project", project.name], ["Client", client.name || client.nameAr],
    ["System", extraction?.systemLabel || systemLabel[proposal.systemType].en], ["Supplier", extraction?.supplier ?? ""], ["Quotation", extraction?.quoteNumber ?? ""],
    ["Date", extraction?.quoteDate ?? ""], ["Currency", proposal.currency], ["Supplier Grand Total", extraction?.commercial.grandTotal ?? proposal.fob], ["Proposal Selling Price", proposal.sellingPrice],
  ]);
  const items = XLSX.utils.aoa_to_sheet([
    ["Location","Category","Code","Description","Qty","Unit","Unit Price","Total","Specifications"],
    ...(extraction?.items ?? []).map((x) => [x.location,x.category,x.code,x.description,x.quantity,x.unit,x.unitPrice,x.total,x.specifications.map((s) => `${s.key}: ${s.value}`).join(" | ")]),
  ]);
  const specs = XLSX.utils.aoa_to_sheet([["Specification","Value"], ...(extraction?.generalSpecifications ?? proposal.specs.map((s) => ({ key: s.label || s.key, value: s.value }))).map((x) => [x.key, x.value])]);
  const commercial = XLSX.utils.aoa_to_sheet([["Commercial Item","Amount"],["Supplier quotation", extraction?.commercial.grandTotal ?? proposal.fob],["Operating cost", pricing.operating],["Selling price", proposal.sellingPrice],["Margin", pricing.marginAmount]]);
  const sheets: [XLSX.WorkSheet, string][] = [[summary,"Summary"],[items,"Items"],[specs,"Specifications"],[commercial,"Commercial"]];
  if (extraction?.dynamicTables.length) {
    extraction.dynamicTables.forEach((table, i) => {
      const rows = [table.columns.map((c) => c.label || c.key), ...table.rows.map((r) => table.columns.map((c) => r.cells.find((cell) => cell.key === c.key)?.value ?? ""))];
      sheets.push([XLSX.utils.aoa_to_sheet(rows), (table.title || `Table ${i + 1}`).slice(0, 31)]);
    });
  }
  sheets.forEach(([ws]) => { ws["!cols"] = [{ wch: 24 },{ wch: 24 },{ wch: 18 },{ wch: 45 },{ wch: 10 },{ wch: 10 },{ wch: 14 },{ wch: 14 },{ wch: 55 }]; });
  sheets.forEach(([ws, name]) => XLSX.utils.book_append_sheet(wb, ws, name));
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array", compression: true });
  const filename = names(proposal, project).xlsx;
  downloadBlob(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
  return filename;
}

// Word proposals are filled into an approved template — not assembled paragraph-by-paragraph in
// code — see docx-template.ts. Elevators get FAAT's real, detailed SHARP-elevator proposal
// template (elevator/cabin/landing spec tables, commercial table repeated per L1/L2/L3 group,
// FAAT's actual legal & payment terms); every other system type still uses the generic template
// until a matching real template exists for them.
const WORD_TEMPLATE_PATH = DEFAULT_WORD_TEMPLATE_PATH;
const ELEVATOR_WORD_TEMPLATE_PATH = DEFAULT_ELEVATOR_WORD_TEMPLATE_PATH;

async function fetchTemplate(path: string, kind: "Word" | "Excel" = "Word"): Promise<ArrayBuffer> {
  // Filenames with spaces need proper encoding, or some dev/production static servers won't match them.
  const res = await fetch(encodeURI(path));
  if (!res.ok) throw new Error(`قالب ${kind} غير موجود على ${path} (HTTP ${res.status}). تأكد أن الملف موجود فعلاً تحت public${path}.`);
  const buffer = await res.arrayBuffer();
  // A real .docx is a zip archive and must start with the "PK" signature. If a dev server ever
  // falls back to serving index.html for an unmatched static path (common SPA fallback
  // behavior), `res.ok` can still be true even though this isn't the file we asked for —
  // catch that here instead of silently handing JSZip garbage.
  const bytes = new Uint8Array(buffer.slice(0, 2));
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error(`الملف الذي تم جلبه من ${path} ليس ملف ${kind} صالحاً (ربما تم إرجاع صفحة أخرى بدلاً منه). تأكد من مسار الملف تحت public${path}.`);
  return buffer;
}

export async function generateWord(proposal: Proposal, project: Project, client: Client) {
  // Priority: a template uploaded for this system type → the built-in one (elevators have their own).
  const custom = await templateStore.getActive(proposal.systemType, "docx");
  const path = proposal.systemType === "elevators" ? ELEVATOR_WORD_TEMPLATE_PATH : WORD_TEMPLATE_PATH;
  const templateBuffer = custom ? custom.data : await fetchTemplate(path);
  const { tokens, items, specs, missing, unmatchedSpecs, untranslated } = buildWordValues(proposal, project, client);
  // Elevator offer: filled table cells use Noto Sans Arabic 11 pt, centred.
  const { blob, unfilledTokens } = await fillDocxTemplate(templateBuffer, tokens, items, specs, { tableStyle: proposal.systemType === "elevators" });
  const paySum = (proposal.payment?.advance ?? 0) + (proposal.payment?.shipping ?? 0) + (proposal.payment?.handover ?? 0);
  if (Math.abs(paySum - 100) > 1e-9) toast.warning(`نسب الدفع (دفعة مقدمة + قبل الشحن + عند التسليم) مجموعها ${paySum}% وليس 100% — راجع الحقول في صفحة المراجعة.`);
  if (untranslated.length) {
    console.warn("Word template: English words kept (not in the Arabic glossary, src/lib/spec-ar.ts) —", untranslated.join(", "));
    toast.warning(`كلمات بقيت بالإنكليزية في مواصفات الكبين/قاعة الوصول (غير موجودة في القاموس): ${untranslated.join("، ")}`);
  }
  // Rows that were filled with "—" because no extracted spec matched — surfaced, never silent.
  if (missing.length) {
    console.warn("Word template: no matching spec for —", missing.join(", "), "| extracted but unused —", unmatchedSpecs);
    toast.warning(`لم تُطابَق هذه الحقول مع مواصفات الكوتيشن وبقيت "—": ${missing.join("، ")}`);
  }
  if (unfilledTokens.length) {
    console.warn("Word template: unmapped placeholders left blank —", unfilledTokens.join(", "));
    // Never silent: a gap in a customer-facing document must be visible to whoever generates it.
    toast.warning(`قالب Word: لا توجد بيانات للحقول التالية وتُركت "—": ${unfilledTokens.join("، ")}`);
  }
  const filename = names(proposal, project).docx;
  downloadBlob(blob, filename);
  return filename;
}
export async function generateAll(proposal: Proposal, project: Project, client: Client) {
  const xlsx = await generateExcel(proposal, project, client);
  const docx = await generateWord(proposal, project, client);
  return { xlsx, docx };
}
