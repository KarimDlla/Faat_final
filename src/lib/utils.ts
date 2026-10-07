import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function nextProposalNumber(existing: string[]) {
  const years = new Date().getFullYear().toString().slice(-2);
  const nums = existing
    .map((n) => {
      const m = n.match(/FAAT-(\d+)-(\d+)/);
      return m ? Number(m[2]) : 0;
    })
    .filter(Boolean);
  const next = (Math.max(0, ...nums) + 1).toString().padStart(4, "0");
  return `FAAT-${years}-${next}`;
}
