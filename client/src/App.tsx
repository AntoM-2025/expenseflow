import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import "./App.css";
import MonthlyChart from "./MonthlyChart";
import { loadSection } from "./loadSection";

// ==========================================
// TYPESCRIPT TYPES
// ==========================================

type Payer = {
  id: string;
  name: string;
};

type Income = Omit<Expense, "expenseDate"> & { incomeDate: string };

type Expense = {
  kind?: "expense" | "income";
  id: string;
  amountCents: number;
  category: string;
  description: string | null;
  expenseDate: string;
  payerId: string | null;
  payer: string;
  createdAt: string;
};

type ExpenseTableProps = {
  payer: Payer;
  expenses: Expense[];
  deletingId: string | null;
  onDelete: (expense: Expense) => Promise<void>;
  complete: boolean;
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function formatCurrency(amountCents: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(amountCents / 100);
}

function formatDate(date: string): string {
  const [year, month, day] = date.split("-");

  return `${day}/${month}/${year}`;
}

function getTodayDate(): string {
  const today = new Date();

  const year = today.getFullYear();

  const month = String(today.getMonth() + 1).padStart(2, "0");

  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function sortPayers(a: Payer, b: Payer): number {
  return a.name.localeCompare(b.name, "en", {
    sensitivity: "base",
  });
}

async function getApiError(
  response: Response,
  fallback: string,
): Promise<string> {
  const data: unknown = await response.json().catch(() => null);

  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "string"
  ) {
    return data.error;
  }

  return fallback;
}

// ==========================================
// EXPENSE TABLE COMPONENT
// ==========================================

function ExpenseTable({
  payer,
  expenses,
  deletingId,
  onDelete,
  complete,
}: ExpenseTableProps) {
  const subtotal = expenses.reduce(
    (total, expense) => total + (expense.kind === "income" ? expense.amountCents : -expense.amountCents),
    0,
  );

  return (
    <section className="expenses-section">
      <div className="section-header">
        <h2><span className="avatar" aria-hidden="true">{payer.name.slice(0, 1).toUpperCase()}</span>{payer.name}</h2>

        <span>
          {expenses.length} movements · {complete ? `Balance ${formatCurrency(subtotal)}` : "Partial data — balance unavailable"}
        </span>
      </div>

      {expenses.length === 0 ? (
        <p className="empty-state">{complete ? `No movements yet. The next transaction for ${payer.name} will appear here.` : "Some transactions are unavailable."}</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type / Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {expenses.map((expense) => (
                <tr key={`${expense.kind ?? "expense"}-${expense.id}`}>
                  <td>{formatDate(expense.expenseDate)}</td>

                  <td><span className={`category-badge ${expense.kind === "income" ? "income-badge" : ""}`}>{expense.kind === "income" ? "Income" : "Expense"} · {expense.category}</span></td>

                  <td>{expense.description ?? "—"}</td>

                  <td className={`amount ${expense.kind === "income" ? "income-amount" : ""}`}>
                    {expense.kind === "income" ? "+" : "−"}{formatCurrency(expense.amountCents)}
                  </td>

                  <td>
                    <button
                      type="button"
                      className="delete-button"
                      title="Delete movement"
                      aria-label={`Delete ${expense.kind ?? "expense"} ${expense.description ?? expense.category}`}
                      disabled={deletingId !== null}
                      onClick={() => void onDelete(expense)}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 10v7" />
                        <path d="M14 10v7" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================

function App() {
  // ========================================
  // DATA
  // ========================================

  const [payers, setPayers] = useState<Payer[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Expense[]>([]);
  const [movementType, setMovementType] = useState<"expense" | "income">("expense");
  const [deletingPayerId, setDeletingPayerId] = useState<string | null>(null);

  const [loadingSections, setLoadingSections] = useState({ expenses: true, payers: true, incomes: true });
  const [loadErrors, setLoadErrors] = useState<Record<"expenses" | "payers" | "incomes", string | null>>({ expenses: null, payers: null, incomes: null });
  const loading = Object.values(loadingSections).some(Boolean);
  const expensesReady = !loadingSections.expenses && !loadErrors.expenses;
  const incomesReady = !loadingSections.incomes && !loadErrors.incomes;
  const payersReady = !loadingSections.payers && !loadErrors.payers;
  const movementsReady = expensesReady && incomesReady;

  // ========================================
  // NEW PAYER
  // ========================================

  const [newPayerName, setNewPayerName] = useState("");

  const [addingPayer, setAddingPayer] = useState(false);

  const [payerError, setPayerError] = useState<string | null>(null);

  const [payerSuccess, setPayerSuccess] = useState(false);

  // ========================================
  // NEW EXPENSE FIELDS
  // ========================================

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Groceries");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(getTodayDate);

  // Free choice of name, no default value
  const [payerId, setPayerId] = useState("");

  // ========================================
  // SAVE STATES
  // ========================================

  const [saving, setSaving] = useState(false);

  const [saveError, setSaveError] = useState<string | null>(null);

  const [saveSuccess, setSaveSuccess] = useState(false);

  // ========================================
  // DELETE STATES
  // ========================================

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ========================================
  // DATA LOADING
  // ========================================

  useEffect(() => {
    const controller = new AbortController();

    function load<T>(section: "expenses" | "payers" | "incomes", onData: (data: T[]) => void) {
      void loadSection<T>(section, controller.signal, onData,
        message => setLoadErrors(current => ({ ...current, [section]: message })),
        () => setLoadingSections(current => ({ ...current, [section]: false })),
      );
    }
    load<Payer>("payers", data => setPayers(data.sort(sortPayers)));
    load<Expense>("expenses", setExpenses);
    load<Income>("incomes", data => setIncomes(data.map(item => ({ ...item, expenseDate: item.incomeDate, kind: "income" }))));

    return () => controller.abort();
  }, []);

  // ========================================
  // ADD PAYER
  // ========================================

  async function handleAddPayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPayerError(null);
    setPayerSuccess(false);

    const name = newPayerName.trim();

    if (!name || name.length > 100) {
      setPayerError("Enter a name between 1 and 100 characters.");
      return;
    }

    setAddingPayer(true);

    try {
      const response = await fetch("/api/payers", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          name,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await getApiError(response, "Unable to create the payer"),
        );
      }

      const newPayer: Payer = await response.json();

      setPayers((previousPayers) =>
        [...previousPayers, newPayer].sort(sortPayers),
      );
      // Select the newly created payer
      setPayerId(newPayer.id);
      setNewPayerName("");
      setPayerSuccess(true);
    } catch (err) {
      setPayerError(
        err instanceof Error ? err.message : "Error saving",
      );
    } finally {
      setAddingPayer(false);
    }
  }

  async function handleDeletePayer(payer: Payer) {
    if (deletingPayerId || saving || addingPayer || deletingId) return;
    if (!window.confirm(`Delete ${payer.name}? All expenses and income belonging to this payer will also be permanently deleted. This cannot be undone.`)) return;
    setDeletingPayerId(payer.id);
    setPayerError(null);
    setPayerSuccess(false);
    try {
      const response = await fetch(`/api/payers/${encodeURIComponent(payer.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await getApiError(response, "Unable to delete payer"));
      setPayers(items => items.filter(item => item.id !== payer.id));
      setExpenses(items => items.filter(item => item.payerId !== payer.id));
      setIncomes(items => items.filter(item => item.payerId !== payer.id));
      if (payerId === payer.id) setPayerId("");
    } catch (err) {
      setPayerError(err instanceof Error ? err.message : "Unable to delete payer");
    } finally {
      setDeletingPayerId(null);
    }
  }

  // ========================================
  // ADD EXPENSE
  // ========================================

  async function handleAddExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaveError(null);
    setSaveSuccess(false);

    if (!payerId || !payers.some((payer) => payer.id === payerId)) {
      setSaveError("Select a payer before recording the movement.");

      return;
    }

    const normalizedAmount = amount.trim().replace(",", ".");

    if (!/^\d+(\.\d{1,2})?$/.test(normalizedAmount)) {
      setSaveError("Enter a valid amount with up to two decimal places.");
      return;
    }

    const [euros, cents = ""] = normalizedAmount.split(".");

    const amountCents = Number(euros) * 100 + Number(cents.padEnd(2, "0"));

    if (
      !Number.isSafeInteger(amountCents) ||
      amountCents <= 0 ||
      amountCents > 100_000_000
    ) {
      setSaveError(
        "The amount must be greater than zero and no more than €1,000,000.",
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(movementType === "income" ? "/api/incomes" : "/api/expenses", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          amountCents,
          category,
          description: description.trim() || undefined,
          ...(movementType === "income" ? { incomeDate: expenseDate } : { expenseDate }),
          payerId,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await getApiError(response, "Unable to save the movement"),
        );
      }

      if (movementType === "income") {
        const income: Income = await response.json();
        setIncomes(items => [{ ...income, expenseDate: income.incomeDate, kind: "income" }, ...items]);
      } else {
        const expense: Expense = await response.json();
        setExpenses(items => [expense, ...items]);
      }

      setAmount("");
      setDescription("");
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Error saving",
      );
    } finally {
      setSaving(false);
    }
  }

  // ========================================
  // DELETE EXPENSE
  // ========================================

  async function handleDeleteExpense(expense: Expense) {
    if (deletingId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `Do you want to delete this ${expense.kind ?? "expense"} "${expense.description ?? expense.category}" for ${expense.payer} (${formatCurrency(expense.amountCents)})?\n\nThis action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeleteError(null);
    setDeletingId(`${expense.kind ?? "expense"}-${expense.id}`);

    try {
      const response = await fetch(
        `/api/${expense.kind === "income" ? "incomes" : "expenses"}/${encodeURIComponent(expense.id)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(
          await getApiError(response, "Unable to delete the movement"),
        );
      }

      const update = expense.kind === "income" ? setIncomes : setExpenses;
      update(items => items.filter(item => item.id !== expense.id));
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Error deleting",
      );
    } finally {
      setDeletingId(null);
    }
  }

  // ========================================
  // FILTERS AND TOTALS
  // ========================================

  function getPayerExpenses(payer: Payer): Expense[] {
    return expenses.filter(
      (expense) =>
        expense.payerId === payer.id ||
        (expense.payerId === null &&
          expense.payer.toLocaleLowerCase("en-GB") ===
            payer.name.toLocaleLowerCase("en-GB")),
    );
  }

  const totalExpenses = expenses.reduce(
    (total, expense) => total + expense.amountCents,
    0,
  );

  const totalIncome = incomes.reduce((sum, item) => sum + item.amountCents, 0);
  const movements = [...expenses, ...incomes].sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));

  // API movement rows include payer names, so transactions remain visible even
  // when the payer endpoint is unavailable.
  const displayPayers = [...payers];
  for (const item of movements) {
    if (item.payerId && !displayPayers.some(payer => payer.id === item.payerId)) {
      displayPayers.push({ id: item.payerId, name: item.payer });
    }
  }

  // ========================================
  // USER INTERFACE
  // ========================================

  return (
    <main className="dashboard">
      {/* HEADER */}

      <header className="dashboard-header">
        <div>
          <span className="subtitle">YOUR MONEY, AT A GLANCE</span>

          <h1>A little clarity.<br /><span>A better everyday.</span></h1>

          <p>All your expenses, together in one calm space.</p>
        </div>
        <a className="header-action" href="#new-expense">+ Add an expense</a>
      </header>

      {/* DYNAMIC SUMMARY */}

      <section className="stats">
        <div className="stat-card stat-card-total">
          <p><span className="stat-symbol" aria-hidden="true">€</span>Total expenses</p>
          <h2>{expensesReady ? formatCurrency(totalExpenses) : "Unavailable"}</h2>
          <span className="stat-caption">All recorded transactions</span>
        </div>
        <div className="stat-card">
          <p><span className="stat-symbol" aria-hidden="true">↗</span>Total income</p>
          <h2>{!incomesReady ? "—" : formatCurrency(totalIncome)}</h2>
          <span className="stat-caption">All recorded income</span>
        </div>
        <div className="stat-card">
          <p><span className="stat-symbol" aria-hidden="true">◎</span>Balance</p>
          <h2>{!movementsReady ? "—" : formatCurrency(totalIncome - totalExpenses)}</h2>
          <span className="stat-caption">Income minus expenses</span>
        </div>
      </section>

      {movementsReady && payers.length > 0 && <section className="payer-summaries" aria-label="Totals by payer">

        {payers.map((payer) => {
          const payerExpenses = getPayerExpenses(payer);

          const total = payerExpenses.reduce(
            (sum, expense) => sum + expense.amountCents,
            0,
          );

          return (
            <div className="stat-card" key={payer.id}>
              <p><span className="avatar" aria-hidden="true">{payer.name.slice(0, 1).toUpperCase()}</span>{payer.name}</p>

              <h2>{formatCurrency(incomes.filter(i => i.payerId === payer.id).reduce((sum, i) => sum + i.amountCents, 0) - total)}</h2>
              <span className="stat-caption">Balance · Expenses {formatCurrency(total)} · Income {formatCurrency(incomes.filter(i => i.payerId === payer.id).reduce((sum, i) => sum + i.amountCents, 0))}</span>
            </div>
          );
        })}
      </section>}

      {movementsReady && <MonthlyChart movements={movements} payers={displayPayers} />}

      <div className="entry-layout">
      {/* PAYER MANAGEMENT */}

      <section className="add-expense-section payer-panel">
        <span className="eyebrow">BETTER TOGETHER</span>
        <h2>Your people</h2>

        <p>Add the people whose expenses you want to track.</p>

        <form onSubmit={handleAddPayer}>
  <div className="form-grid">
    <div className="form-field">
      <label htmlFor="newPayerName">
        New payer name
      </label>

      <input
        id="newPayerName"
        type="text"
        placeholder="E.g. Luca, Sofia, Giovanni..."
        value={newPayerName}
        onChange={(event) =>
          setNewPayerName(event.target.value)
        }
        maxLength={100}
        required
      />
    </div>
  </div>

  {payerError && (
    <p className="error-message" role="alert">
      {payerError}
    </p>
  )}

  {payerSuccess && (
    <p className="success-message" role="status">
      Payer added successfully!
    </p>
  )}

  <button
    type="submit"
    className="submit-button"
    disabled={addingPayer || deletingPayerId !== null || !payersReady}
  >
    {addingPayer
      ? 'Saving...'
      : 'Add payer'}
  </button>
</form>

        {payersReady &&
          (payers.length === 0 ? (
            <p>You have not added any payers yet.</p>
          ) : (
            <ul className="payer-list">
              {payers.map((payer) => (
                <li className="payer-chip" key={payer.id}>
                  {payer.name}
                  <button type="button" className="delete-button" aria-label={`Delete payer ${payer.name}`} disabled={deletingPayerId !== null || saving || addingPayer || deletingId !== null} onClick={() => void handleDeletePayer(payer)}>{deletingPayerId === payer.id ? "…" : "×"}</button>
                </li>
              ))}
            </ul>
          ))}
      </section>

      {/* NEW EXPENSE */}

      <section className="add-expense-section expense-panel" id="new-expense">
        <span className="eyebrow">THE EVERYDAY DETAILS</span>
        <h2>{movementType === "income" ? "Add income" : "Add an expense"}</h2>

        <p>Record a new transaction.</p>

        <div className="movement-switch" role="group" aria-label="Movement type">
          {(["expense", "income"] as const).map(type => <button key={type} type="button" aria-pressed={movementType === type} disabled={saving} onClick={() => { setMovementType(type); setCategory(type === "income" ? "Salary" : "Groceries"); setSaveError(null); setSaveSuccess(false); }}>{type === "income" ? "↗ Income" : "↘ Expense"}</button>)}
        </div>
        <form onSubmit={handleAddExpense}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="amount">Amount (€)</label>

              <input
                id="amount"
                type="text"
                inputMode="decimal"
                placeholder="E.g. 12.50"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="category">Category</label>

              <select
                id="category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {movementType === "income" ? <>
                  {["Salary", "Freelance", "Refund", "Gift", "Other"].map(c => <option key={c} value={c}>{c}</option>)}
                </> : <>
                <option value="Groceries">🛒 Groceries</option>

                <option value="Transport">🚌 Transport</option>

                <option value="Home">🏠 Home</option>

                <option value="Health">🩺 Health</option>

                <option value="Leisure">🎮 Leisure</option>

                <option value="Dining Out">🍽️ Dining Out</option>

                <option value="Shopping">🛍️ Shopping</option>

                <option value="Bills & Utilities">💡 Bills &amp; Utilities</option>

                <option value="Subscriptions">📱 Subscriptions</option>

                <option value="Travel">✈️ Travel</option>

                <option value="Education">📚 Education</option>

                <option value="Gifts & Donations">🎁 Gifts &amp; Donations</option>

                <option value="Personal Care">💇 Personal Care</option>

                <option value="Pets">🐾 Pets</option>

                <option value="Financial Fees">🏦 Financial Fees</option>

                <option value="Other">📦 Other</option>
                </>}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="description">Description</label>

              <input
                id="description"
                type="text"
                placeholder="E.g. Lunch at a restaurant"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={500}
              />
            </div>

            <div className="form-field">
              <label htmlFor="expenseDate">Date</label>

              <input
                id="expenseDate"
                type="date"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
                required
              />
            </div>

            {/* PAYER SELECTION */}

            <div className="form-field">
  <label htmlFor="payer">
    {movementType === "income" ? "Who received it?" : "Who paid?"}
  </label>

  <select
    id="payer"
    value={payerId}
    onChange={(event) =>
      setPayerId(event.target.value)
    }
    disabled={payers.length === 0}
    required
  >
    <option value="" disabled>
      Select a payer
    </option>

    {payers.map((payer) => (
      <option
        key={payer.id}
        value={payer.id}
      >
        {payer.name}
      </option>
    ))}
  </select>
</div>
          </div>

          {saveError && (
            <p className="error-message" role="alert">
              {saveError}
            </p>
          )}

          {saveSuccess && (
            <p className="success-message" role="status">
              Movement recorded successfully!
            </p>
          )}

          <button
            type="submit"
            className="submit-button"
            disabled={saving || payers.length === 0 || deletingPayerId !== null || !payersReady || !(movementType === "income" ? incomesReady : expensesReady)}
          >
            {saving ? "Saving..." : movementType === "income" ? "Add income" : "Add expense"}
          </button>
        </form>
      </section>

      </div>

      <div className="activity-heading"><div><span className="eyebrow">YOUR SPENDING STORY</span><h2>Transaction history</h2></div><span>All time</span></div>

      {/* MESSAGES */}

      {loading && <p role="status">Loading data...</p>}

      {Object.entries(loadErrors).map(([section, message]) => message && (
        <p key={section} className="error-message" role="alert">{message}</p>
      ))}
      {!movementsReady && <p role="status">Transactions may be incomplete. Balances and charts are unavailable until expenses and income have loaded.</p>}

      {deleteError && (
        <p className="error-message" role="alert">
          {deleteError}
        </p>
      )}

      {/* DYNAMIC TABLES */}

      {(expensesReady || incomesReady) && (
        <>
          {displayPayers.length === 0 ? (
            <section className="expenses-section">
              <h2>Your expenses</h2>

              <p>{payersReady && movementsReady ? "Add a payer to start tracking expenses." : "Some data is unavailable. Reload to retry."}</p>
            </section>
          ) : (
            displayPayers.map((payer) => (
              <ExpenseTable
                key={payer.id}
                payer={payer}
                expenses={movements.filter(item => item.payerId === payer.id)}
                deletingId={deletingPayerId ?? deletingId}
                complete={movementsReady}
                onDelete={handleDeleteExpense}
              />
            ))
          )}
        </>
      )}
    </main>
  );
}

export default App;
