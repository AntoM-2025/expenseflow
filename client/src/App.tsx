import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import "./App.css";

// ==========================================
// TYPESCRIPT TYPES
// ==========================================

type Payer = {
  id: string;
  name: string;
};

type Expense = {
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
}: ExpenseTableProps) {
  const subtotal = expenses.reduce(
    (total, expense) => total + expense.amountCents,
    0,
  );

  return (
    <section className="expenses-section">
      <div className="section-header">
        <h2>Expenses for {payer.name}</h2>

        <span>
          {expenses.length} transactions · {formatCurrency(subtotal)}
        </span>
      </div>

      {expenses.length === 0 ? (
        <p>No expenses recorded for {payer.name}.</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{formatDate(expense.expenseDate)}</td>

                  <td>{expense.category}</td>

                  <td>{expense.description ?? "—"}</td>

                  <td className="amount">
                    {formatCurrency(expense.amountCents)}
                  </td>

                  <td>
                    <button
                      type="button"
                      className="delete-button"
                      title="Delete expense"
                      aria-label={`Delete expense ${expense.description ?? expense.category}`}
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    async function loadData() {
      try {
        const [payersResponse, expensesResponse] = await Promise.all([
          fetch("/api/payers", {
            signal: controller.signal,
          }),

          fetch("/api/expenses", {
            signal: controller.signal,
          }),
        ]);

        if (!payersResponse.ok) {
          throw new Error("Unable to retrieve payers");
        }

        if (!expensesResponse.ok) {
          throw new Error("Unable to retrieve expenses");
        }

        const [payersData, expensesData] = await Promise.all([
          payersResponse.json() as Promise<Payer[]>,
          expensesResponse.json() as Promise<Expense[]>,
        ]);

        if (!controller.signal.aborted) {
          setPayers(payersData.sort(sortPayers));
          setExpenses(expensesData);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Error loading data",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadData();

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

  // ========================================
  // ADD EXPENSE
  // ========================================

  async function handleAddExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaveError(null);
    setSaveSuccess(false);

    if (!payerId || !payers.some((payer) => payer.id === payerId)) {
      setSaveError("Select a payer before recording the expense.");

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
      const response = await fetch("/api/expenses", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          amountCents,
          category,
          description: description.trim() || undefined,
          expenseDate,
          payerId,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await getApiError(response, "Unable to save the expense"),
        );
      }

      const newExpense: Expense = await response.json();

      // Update expenses.
      setExpenses((previousExpenses) =>
        [newExpense, ...previousExpenses].sort((a, b) =>
          b.expenseDate.localeCompare(a.expenseDate),
        ),
      );

      // If a new name was entered,
      // also add them to the list of payers.
      if (newExpense.payerId) {
        setPayers((previousPayers) => {
          const alreadyExists = previousPayers.some(
            (payer) => payer.id === newExpense.payerId,
          );

          if (alreadyExists) {
            return previousPayers;
          }

          const newPayer: Payer = {
            id: newExpense.payerId!,
            name: newExpense.payer,
          };

          return [...previousPayers, newPayer].sort(sortPayers);
        });
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
      `Do you want to delete the expense "${expense.description ?? expense.category}" for ${expense.payer} (${formatCurrency(expense.amountCents)})?\n\nThis action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeleteError(null);
    setDeletingId(expense.id);

    try {
      const response = await fetch(
        `/api/expenses/${encodeURIComponent(expense.id)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(
          await getApiError(response, "Unable to delete the expense"),
        );
      }

      setExpenses((previousExpenses) =>
        previousExpenses.filter((item) => item.id !== expense.id),
      );
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

  // ========================================
  // USER INTERFACE
  // ========================================

  return (
    <main className="dashboard">
      {/* HEADER */}

      <header className="dashboard-header">
        <div>
          <span className="subtitle">PERSONAL FINANCE</span>

          <h1>ExpenseFlow</h1>

          <p>Track and manage your daily expenses.</p>
        </div>
      </header>

      {/* DYNAMIC SUMMARY */}

      <section className="stats">
        <div className="stat-card">
          <p>Overall total</p>

          <h2>{formatCurrency(totalExpenses)}</h2>
        </div>

        {payers.map((payer) => {
          const payerExpenses = getPayerExpenses(payer);

          const total = payerExpenses.reduce(
            (sum, expense) => sum + expense.amountCents,
            0,
          );

          return (
            <div className="stat-card" key={payer.id}>
              <p>Total for {payer.name}</p>

              <h2>{formatCurrency(total)}</h2>
            </div>
          );
        })}
      </section>

      {/* PAYER MANAGEMENT */}

      <section className="add-expense-section">
        <h2>Your payers</h2>

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
    disabled={addingPayer}
  >
    {addingPayer
      ? 'Saving...'
      : 'Add payer'}
  </button>
</form>

        {!loading &&
          !error &&
          (payers.length === 0 ? (
            <p>You have not added any payers yet.</p>
          ) : (
            <ul className="payer-list">
              {payers.map((payer) => (
                <li className="payer-chip" key={payer.id}>
                  {payer.name}
                </li>
              ))}
            </ul>
          ))}
      </section>

      {/* NEW EXPENSE */}

      <section className="add-expense-section">
        <h2>Add an expense</h2>

        <p>Record a new transaction.</p>

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
                <option value="Groceries">Groceries</option>

                <option value="Transport">Transport</option>

                <option value="Home">Home</option>

                <option value="Health">Health</option>

                <option value="Leisure">Leisure</option>

                <option value="Other">Other</option>
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
    Who paid?
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
              Expense recorded successfully!
            </p>
          )}

          <button
            type="submit"
            className="submit-button"
            disabled={saving || payers.length === 0}
          >
            {saving ? "Saving..." : "Add expense"}
          </button>
        </form>
      </section>

      {/* MESSAGES */}

      {loading && <p role="status">Loading data...</p>}

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {deleteError && (
        <p className="error-message" role="alert">
          {deleteError}
        </p>
      )}

      {/* DYNAMIC TABLES */}

      {!loading && !error && (
        <>
          {payers.length === 0 ? (
            <section className="expenses-section">
              <h2>Your expenses</h2>

              <p>Add a payer to start tracking expenses.</p>
            </section>
          ) : (
            payers.map((payer) => (
              <ExpenseTable
                key={payer.id}
                payer={payer}
                expenses={getPayerExpenses(payer)}
                deletingId={deletingId}
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
