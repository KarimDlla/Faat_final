// ─────────────────────────────────────────────────────────────────────────────────────────────
// One elevator = one group.
//
// The supplier quotation often lists "2 units, same model, same price" on a single line, and the
// extraction returns ONE group (L1, quantity 2). The CCS pricing workbook, however, has one cost
// sheet per physical elevator (L1, L2, …) so every elevator can be priced on its own — even when
// they share the same specs and the same FOB.
//
// This helper expands every elevator group (code L#) with quantity N into N groups with quantity 1,
// copying the specs / FOB / technical data, and renumbers them L1, L2, L3… in order.
//   • Only elevators (L) are split. Escalators (E) and moving walks (M) are left untouched.
//   • Nothing is calculated or invented — values are only copied.
//   • Already-split input is returned unchanged (safe to call more than once).
//   • If the split would need more sheets than the workbook has, nothing is split and
//     `overflow` is true so the caller can warn the user (data is never silently dropped).
// ─────────────────────────────────────────────────────────────────────────────────────────────

type GroupLike = { code: string; quantity: number; id?: string };

const isElevatorCode = (code: string) => /^\s*L\s*[-_ ]?\s*\d*\s*$/i.test(code ?? "");

export function splitElevatorGroups<T extends GroupLike>(
  groups: T[],
  opts: { /** Max elevator sheets the workbook has (CCS_CAPACITY.L). */ max: number; /** Creates the id of each new group, when groups carry ids. */ newId?: () => string },
): { groups: T[]; overflow: boolean; split: boolean } {
  const qtyOf = (g: T) => (Number.isInteger(g.quantity) && g.quantity > 0 ? g.quantity : 1);
  const elevators = groups.filter((g) => isElevatorCode(g.code));
  const totalUnits = elevators.reduce((n, g) => n + qtyOf(g), 0);

  const nothingToSplit = elevators.every((g) => qtyOf(g) === 1);
  if (nothingToSplit) return { groups, overflow: false, split: false };
  if (totalUnits > opts.max) return { groups, overflow: true, split: false };

  const out: T[] = [];
  let n = 0;
  let firstOfGroup: boolean;
  for (const g of groups) {
    if (!isElevatorCode(g.code)) { out.push(g); continue; }
    firstOfGroup = true;
    for (let i = 0; i < qtyOf(g); i++) {
      n += 1;
      const copy: T = { ...g, code: `L${n}`, quantity: 1 };
      // Deep-copy arrays (e.g. specs) so editing one elevator never changes the other.
      for (const [k, v] of Object.entries(copy)) if (Array.isArray(v)) (copy as Record<string, unknown>)[k] = v.map((x) => (x && typeof x === "object" ? { ...x } : x));
      if (!firstOfGroup && opts.newId && "id" in g) (copy as GroupLike).id = opts.newId();
      firstOfGroup = false;
      out.push(copy);
    }
  }
  return { groups: out, overflow: false, split: true };
}
