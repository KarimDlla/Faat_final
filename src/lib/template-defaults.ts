import type { SystemType } from "./types";

export type TemplateKind = "docx" | "xlsx";

/** Template-driven system types, in the order they are shown in the UI. */
export const TEMPLATE_SYSTEM_TYPES: SystemType[] = ["elevators", "escalators", "chiller", "hvac", "vrf", "bms", "smoke", "other"];

// Built-in templates that ship with the app (public/templates). A custom template uploaded through the
// template manager takes priority; when none is active the built-in one below is used, exactly as before.
export const DEFAULT_WORD_TEMPLATE_PATH = "/templates/FAAT Proposal Master Template.docx";
export const DEFAULT_ELEVATOR_WORD_TEMPLATE_PATH = "/templates/FAAT Elevator Offer Template.docx";
export const DEFAULT_CCS_TEMPLATE_PATH = "/templates/FAAT CCS Pricing Workbook.xlsx";
// Optional placeholder-based Excel template for non-elevator types. Not shipped; if absent, a plain dynamic workbook is built.
export const DEFAULT_EXCEL_TEMPLATE_PATH = "/templates/FAAT Excel Template.xlsx";

/**
 * Escalators share the elevators' CCS workbook (E1/E2 groups live in the same file), so the Excel slot
 * of "escalators" is the elevators' slot.
 */
export function excelSlotType(systemType: SystemType): SystemType {
  return systemType === "escalators" ? "elevators" : systemType;
}

/** "ccs" = the pricing workbook with fixed input cells. "tokens" = {{TOKEN}} placeholders (Word or Excel). */
export function templateModeFor(systemType: SystemType, kind: TemplateKind): "ccs" | "tokens" {
  return kind === "xlsx" && excelSlotType(systemType) === "elevators" ? "ccs" : "tokens";
}

export function defaultTemplateInfo(systemType: SystemType, kind: TemplateKind): { path: string | null; label: string } {
  if (kind === "docx") {
    return systemType === "elevators"
      ? { path: DEFAULT_ELEVATOR_WORD_TEMPLATE_PATH, label: "FAAT Elevator Offer Template.docx" }
      : { path: DEFAULT_WORD_TEMPLATE_PATH, label: "FAAT Proposal Master Template.docx" };
  }
  return excelSlotType(systemType) === "elevators"
    ? { path: DEFAULT_CCS_TEMPLATE_PATH, label: "FAAT CCS Pricing Workbook.xlsx" }
    : { path: null, label: "ملف يُبنى تلقائياً (لا يوجد قالب)" };
}
