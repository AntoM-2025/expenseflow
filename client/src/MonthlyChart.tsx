import { useState } from "react";
import { monthlyTotals } from "./monthlyTotals";

type Movement = { amountCents: number; expenseDate: string; payerId: string | null; kind?: "income" | "expense" };
const currency = (cents: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(cents / 100);

export default function MonthlyChart({ movements, payers }: {
  movements: Movement[]; payers: { id: string; name: string }[];
}) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [selectedPayer, setSelectedPayer] = useState("");
  const payerId = payers.some(p => p.id === selectedPayer) ? selectedPayer : "";
  const years = [...new Set([currentYear, year, ...movements.map(m => Number(m.expenseDate.slice(0, 4)))])].sort((a, b) => b - a);
  const months = monthlyTotals(movements, year, payerId);
  const max = Math.max(1, ...months.flatMap(m => [m.expenses, m.income]));
  const hasData = months.some(m => m.expenses || m.income);

  return <section className="monthly-section" aria-labelledby="monthly-title">
    <div className="section-header">
      <div><span className="eyebrow">MONTH BY MONTH</span><h2 id="monthly-title">Your money over time</h2></div>
      <div className="chart-filters">
        <div className="form-field"><label htmlFor="chart-payer">Payer</label><select id="chart-payer" value={payerId} onChange={e => setSelectedPayer(e.target.value)}><option value="">All payers</option>{payers.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></div>
        <div className="form-field"><label htmlFor="chart-year">Year</label><select id="chart-year" value={year} onChange={e => setYear(Number(e.target.value))}>{years.map(y => <option key={y}>{y}</option>)}</select></div>
      </div>
    </div>
    <p className="chart-legend"><span><i className="expense-key" />Expenses</span><span><i className="income-key" />Income</span><span>Scale: {currency(max === 1 && !hasData ? 0 : max)}</span></p>
    {!hasData && <p className="empty-state">No movements for this selection. Add an expense or income to see your monthly overview.</p>}
    <div className="chart-scroll">
      <div className="monthly-chart" role="list" aria-label={`Monthly expenses and income for ${year}`}>
        {months.map((month, index) => {
          const label = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(new Date(year, index, 1));
          const detail = `${label}: expenses ${currency(month.expenses)}, income ${currency(month.income)}`;
          return <div className="month-column" role="listitem" key={index} tabIndex={0} aria-label={detail}>
            <div className="month-tooltip" aria-hidden="true">{label}<br />Expenses {currency(month.expenses)}<br />Income {currency(month.income)}</div>
            <div className="month-bars" aria-hidden="true"><div className="expense-bar" style={{ height: `${month.expenses / max * 100}%` }} /><div className="income-bar" style={{ height: `${month.income / max * 100}%` }} /></div>
            <span>{label}</span>
          </div>;
        })}
      </div>
    </div>
    <details className="monthly-details"><summary>View monthly amounts</summary><div className="table-container"><table><thead><tr><th>Month</th><th>Expenses</th><th>Income</th><th>Balance</th></tr></thead><tbody>{months.map((m, i) => <tr key={i}><td>{new Intl.DateTimeFormat("en-GB", { month: "long" }).format(new Date(year, i, 1))}</td><td>{currency(m.expenses)}</td><td>{currency(m.income)}</td><td>{currency(m.income - m.expenses)}</td></tr>)}</tbody></table></div></details>
  </section>;
}
