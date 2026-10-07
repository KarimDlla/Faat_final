import type { Client, Project, Proposal } from "./types";
import { buildElevatorTokens, buildProposalTokens, flattenTableSpecs, type SpecLike } from "./docx-template";
import { formatMoney } from "./utils";

// One place that turns a Proposal into the values a template can use. Word and Excel templates (built-in
// or uploaded) all read from here, so adding a template never needs new code: it only references names
// that this file produces.

/** Every spec the quotation really contained (project-wide + per line item). Used by {{SPEC:label}}. */
export function collectSpecs(proposal: Proposal): SpecLike[] {
  const ex = proposal.extraction;
  const general = ex?.generalSpecifications.map((s) => ({ key: s.key, label: s.key, value: s.value })) ?? proposal.specs;
  const perItem = ex?.items.flatMap((it) => it.specifications.map((s) => ({ key: s.key, label: s.key, value: s.value }))) ?? [];
  const perUnit = (proposal.units ?? []).flatMap((u) => u.specs);
  return [...general, ...perItem, ...flattenTableSpecs(ex?.dynamicTables), ...perUnit];
}

// Word is client-facing: it never shows the supplier's unit price/total (internal cost). Only descriptive fields.
export function buildGenericWordItems(proposal: Proposal): Record<string, string>[] {
  return (proposal.extraction?.items ?? []).map((x) => ({
    location: x.location ?? "", category: x.category ?? "", code: x.code ?? "", description: x.description ?? "",
    qty: String(x.quantity ?? ""), unit: x.unit ?? "",
  }));
}

/** Tokens + repeating rows for a Word template of any system type. */
export function buildWordValues(proposal: Proposal, project: Project, client: Client) {
  const generic = buildProposalTokens(proposal, project, client);
  if (proposal.systemType === "elevators") {
    const elv = buildElevatorTokens(proposal, project, client);
    return { tokens: { ...generic, ...elv.tokens }, items: elv.items, specs: collectSpecs(proposal), missing: elv.missing, unmatchedSpecs: elv.unmatchedSpecs, untranslated: elv.untranslated };
  }
  return { tokens: generic, items: buildGenericWordItems(proposal), specs: collectSpecs(proposal), missing: [] as string[], unmatchedSpecs: [] as string[], untranslated: [] as string[] };
}

/** Values for an Excel template (internal sheet): numbers stay numbers so formulas can use them. */
export function buildExcelValues(proposal: Proposal, project: Project, client: Client) {
  const { tokens, specs } = buildWordValues(proposal, project, client);
  const ex = proposal.extraction;
  const values: Record<string, string | number> = {
    ...tokens,
    SYSTEM_LABEL: ex?.systemLabel || tokens.SYSTEM_TYPE_EN || "",
    SUPPLIER: ex?.supplier ?? "",
    QUOTE_NUMBER: ex?.quoteNumber ?? "",
    QUOTE_DATE: ex?.quoteDate ?? "",
    CURRENCY: proposal.currency,
    FOB_TOTAL: proposal.fob,
    SUPPLIER_GRAND_TOTAL: ex?.commercial.grandTotal ?? proposal.fob,
    SELLING_PRICE: proposal.sellingPrice,
    TOTAL_QTY_NUM: (ex?.items ?? []).reduce((n, x) => n + Math.max(0, x.quantity), 0) || (proposal.units ?? []).reduce((n, u) => n + u.quantity, 0),
    SELLING_PRICE_FORMATTED: formatMoney(proposal.sellingPrice, proposal.currency),
  };
  const items: Record<string, string | number>[] = (ex?.items ?? []).map((x) => ({
    location: x.location, category: x.category, code: x.code, description: x.description,
    qty: x.quantity, unit: x.unit, unit_price: x.unitPrice, total: x.total,
  }));
  return { values, items, specs };
}
