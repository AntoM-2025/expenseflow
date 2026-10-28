export function monthlyTotals(
  movements: { amountCents: number; expenseDate: string; payerId: string | null; kind?: "expense" | "income" }[],
  year: number,
  payerId = "",
) {
  const months = Array.from({ length: 12 }, () => ({ expenses: 0, income: 0 }));
  for (const movement of movements) {
    const [movementYear, month] = movement.expenseDate.split("-").map(Number);
    if (movementYear !== year || month < 1 || month > 12 || (payerId && movement.payerId !== payerId)) continue;
    months[month - 1][movement.kind === "income" ? "income" : "expenses"] += movement.amountCents;
  }
  return months;
}
