import type { CostLine } from "./types";

export const defaultCostLines = (): CostLine[] => [
  { id: "freight", labelAr: "الشحن والجمارك", labelEn: "Freight & Customs", mode: "fixed", base: "none", value: 0 },
  { id: "overhead", labelAr: "المصاريف الإدارية", labelEn: "Overhead", mode: "percent", base: "fob", value: 5 },
  { id: "maintenance", labelAr: "احتياطي الصيانة المجانية", labelEn: "Free maintenance reserve", mode: "percent", base: "fob", value: 3.5 },
  { id: "local", labelAr: "مواد محلية", labelEn: "Local materials", mode: "fixed", base: "none", value: 250 },
  { id: "scaffold", labelAr: "سقالات", labelEn: "Scaffolding", mode: "fixed", base: "none", value: 400 },
  { id: "install", labelAr: "التركيب المحلي", labelEn: "Local installation", mode: "fixed", base: "none", value: 0 },
  { id: "design", labelAr: "دراسة وتصميم", labelEn: "Design & study", mode: "percent", base: "fob", value: 3 },
  { id: "margin", labelAr: "هامش الربح", labelEn: "Margin", mode: "percent", base: "subtotal", value: 18 },
];

export type PricingResult = {
  fob: number;
  lineAmounts: { id: string; amount: number }[];
  operating: number;
  marginAmount: number;
  selling: number;
};

export function computePricing(fob: number, lines: CostLine[], sellingOverride?: number): PricingResult {
  const safeFob = Math.max(0, fob || 0);
  const beforeMargin = lines.filter((l) => l.id !== "margin");
  const margin = lines.find((l) => l.id === "margin");

  const lineAmounts: { id: string; amount: number }[] = [];
  let operating = safeFob;
  for (const line of beforeMargin) {
    const amount =
      line.mode === "percent"
        ? ((line.base === "fob" ? safeFob : operating) * (line.value || 0)) / 100
        : line.value || 0;
    lineAmounts.push({ id: line.id, amount });
    operating += amount;
  }

  const marginAmount = margin
    ? margin.mode === "percent"
      ? (operating * (margin.value || 0)) / 100
      : margin.value || 0
    : 0;
  if (margin) lineAmounts.push({ id: margin.id, amount: marginAmount });

  const computed = Math.round(operating + marginAmount);
  const selling = sellingOverride && sellingOverride > 0 ? Math.round(sellingOverride) : computed;
  return { fob: safeFob, lineAmounts, operating: Math.round(operating), marginAmount: Math.round(marginAmount), selling };
}
