import type { Client, Project, Proposal } from "./types";
import { buildElevatorTokens, buildProposalTokens } from "./docx-template";

// The token names a template may use, DERIVED from the real builders (so this list can never drift from
// what the code actually fills). Used at upload time to flag unknown tokens, and by the UI reference panel.

const stubProposal = {
  id: "", number: "", revision: 0, projectId: "", clientId: "", systemType: "elevators", status: "draft",
  currency: "USD", validityDays: 30, date: "2026-01-01", validUntil: "2026-01-31", owner: "", quotationSource: "",
  specs: [], units: [{ id: "u1", code: "L1", description: "", quantity: 1, specs: [] }], notes: "", fob: 0, costLines: [],
  sellingPrice: 0, payment: { advance: 0, shipping: 0, handover: 0 },
  schedule: { supplyMin: 0, supplyMax: 0, installMin: 0, installMax: 0, testMin: 0, testMax: 0, warrantyMonths: 0, freeMaintenanceMonths: 0 },
  files: [], createdAt: "", updatedAt: "",
} as unknown as Proposal;
const stubProject = { name: "", nameAr: "", location: "" } as unknown as Project;
const stubClient = { name: "", nameAr: "" } as unknown as Client;

// Extra names that only Excel templates get (see buildExcelValues).
const EXCEL_ONLY_TOKENS = ["SYSTEM_LABEL", "SUPPLIER", "QUOTE_NUMBER", "QUOTE_DATE", "CURRENCY", "FOB_TOTAL", "SUPPLIER_GRAND_TOTAL", "SELLING_PRICE", "TOTAL_QTY_NUM", "SELLING_PRICE_FORMATTED"];

export type TokenCatalog = {
  common: string[];
  elevator: string[];
  excelOnly: string[];
  /** {{items.<field>}} fields usable in a repeating row. */
  wordItemFields: string[];
  elevatorItemFields: string[];
  excelItemFields: string[];
};

let cached: TokenCatalog | null = null;
export function getTokenCatalog(): TokenCatalog {
  if (cached) return cached;
  const common = Object.keys(buildProposalTokens(stubProposal, stubProject, stubClient));
  const elvAll = Object.keys(buildElevatorTokens(stubProposal, stubProject, stubClient).tokens);
  const commonSet = new Set(common);
  cached = {
    common,
    elevator: elvAll.filter((k) => !commonSet.has(k)),
    excelOnly: EXCEL_ONLY_TOKENS,
    wordItemFields: ["location", "category", "code", "description", "qty", "unit"],
    elevatorItemFields: Object.keys(buildElevatorTokens(stubProposal, stubProject, stubClient).items[0] ?? {}),
    excelItemFields: ["location", "category", "code", "description", "qty", "unit", "unit_price", "total"],
  };
  return cached;
}

export function knownTokenSet(kind: "docx" | "xlsx"): Set<string> {
  const c = getTokenCatalog();
  return new Set([...c.common, ...c.elevator, ...(kind === "xlsx" ? c.excelOnly : [])]);
}
export function knownItemFieldSet(kind: "docx" | "xlsx"): Set<string> {
  const c = getTokenCatalog();
  return new Set(kind === "xlsx" ? c.excelItemFields : [...c.wordItemFields, ...c.elevatorItemFields]);
}
