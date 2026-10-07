import type { AppData } from "./types";

export function seedData(): AppData {
  const currencies = [
    { code: "USD", name: "US Dollar", symbol: "$", rateToUSD: 1 },
    { code: "EUR", name: "Euro", symbol: "€", rateToUSD: 1.08 },
  ];
  return {
    currencies,
    salesManager: "",
    salesManagers: [],
    clients: [],
    projects: [],
    opportunities: [],
    proposals: [],
  };
}
