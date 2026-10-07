import * as XLSX from "xlsx";

// Same idea as docx-template.ts, for Excel: only fill {{TOKEN}} cells that already exist in a
// supplied template, never build the sheet layout in code. A row with a cell CONTAINING the
// marker "{{ITEMS_ROW}}" (e.g. "{{ITEMS_ROW}}{{items.name}}" — marker plus a real per-item token
// in the same cell) is treated as the repeat template for line items, cloned once per row, with
// every {{items.<field>}} cell in that row resolved against each item.

export function isPlaceholderTemplate(wb: XLSX.WorkBook): boolean {
  return wb.SheetNames.some((name: string) => {
    const ws = wb.Sheets[name];
    return Object.keys(ws).some((addr) => addr[0] !== "!" && typeof ws[addr]?.v === "string" && /\{\{[A-Za-z0-9_.]+\}\}/.test(ws[addr].v));
  });
}

export function fillXlsxTemplate(wb: XLSX.WorkBook, tokens: Record<string, string | number>, items: Record<string, string | number>[]) {
  const unfilled = new Set<string>();
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const ref = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : null;
    if (!ref) continue;

    // Find an items-repeat marker row, if this template has one.
    let markerRow: number | null = null;
    for (let r = ref.s.r; r <= ref.e.r; r++) {
      const first = ws[XLSX.utils.encode_cell({ r, c: ref.s.c })];
      if (typeof first?.v === "string" && first.v.includes("{{ITEMS_ROW}}")) { markerRow = r; break; }
    }

    if (markerRow !== null && items.length) {
      const templateCells: Record<number, string> = {};
      for (let c = ref.s.c; c <= ref.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r: markerRow, c })];
        if (typeof cell?.v === "string") templateCells[c] = cell.v;
      }
      items.forEach((item, i) => {
        const r = markerRow! + i;
        for (const [cStr, template] of Object.entries(templateCells)) {
          const c = Number(cStr);
          const filled = template.replace("{{ITEMS_ROW}}", "").replace(/\{\{items\.([a-zA-Z0-9_]+)\}\}/g, (m: string, key: string) => (item[key] !== undefined ? String(item[key]) : "—"));
          const isNumeric = /^-?\d+(\.\d+)?$/.test(filled);
          ws[XLSX.utils.encode_cell({ r, c })] = isNumeric ? { t: "n", v: Number(filled) } : { t: "s", v: filled };
        }
      });
      const newEnd = Math.max(ref.e.r, markerRow + items.length - 1);
      ws["!ref"] = XLSX.utils.encode_range({ s: ref.s, e: { r: newEnd, c: ref.e.c } });
    }

    for (const addr of Object.keys(ws)) {
      if (addr[0] === "!") continue;
      const cell = ws[addr];
      if (typeof cell?.v !== "string") continue;
      cell.v = cell.v.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m: string, key: string) => {
        if (tokens[key] === undefined) { unfilled.add(key); return "—"; }
        return String(tokens[key]);
      });
      if (/^-?\d+(\.\d+)?$/.test(cell.v)) { cell.t = "n"; (cell as XLSX.CellObject).v = Number(cell.v); }
    }
  }
  return { unfilled: Array.from(unfilled) };
}
