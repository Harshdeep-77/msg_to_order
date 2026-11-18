export type AllocOrder = { id: number; quantity: number };

export type Decision = {
  id: number;
  accepted: boolean;
  // Only set when rejected:
  //  TOO_BIG   – order is larger than the total stock we started with
  //  ALLOCATED – stock was used up by larger orders
  reason?: "TOO_BIG" | "ALLOCATED";
};

/**
 * Option A: biggest order that fits first. Orders that don't fit in full are rejected.
 * Ties (same quantity) go to the older order (lower id).
 * Pure function: no DB, no side effects.
 */
export function allocate(orders: AllocOrder[], stock: number): Decision[] {
  const sorted = [...orders].sort((a, b) => b.quantity - a.quantity || a.id - b.id);
  let remaining = stock;
  return sorted.map((o) => {
    if (o.quantity > stock) return { id: o.id, accepted: false, reason: "TOO_BIG" };
    if (o.quantity > remaining) return { id: o.id, accepted: false, reason: "ALLOCATED" };
    remaining -= o.quantity;
    return { id: o.id, accepted: true };
  });
}
