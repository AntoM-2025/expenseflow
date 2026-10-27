import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import "./App.css";

// ==========================================
// TIPI TYPESCRIPT
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
// FUNZIONI DI UTILITÀ
// ==========================================

function formatCurrency(amountCents: number): string {
  return new Intl.NumberFormat("it-IT", {
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
  return a.name.localeCompare(b.name, "it", {
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
// COMPONENTE TABELLA SPESE
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
        <h2>Spese di {payer.name}</h2>

        <span>
          {expenses.length} operazioni · {formatCurrency(subtotal)}
        </span>
      </div>

      {expenses.length === 0 ? (
        <p>Nessuna spesa registrata per {payer.name}.</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Categoria</th>
                <th>Descrizione</th>
                <th>Importo</th>
                <th>Azioni</th>
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
                      title="Elimina spesa"
                      aria-label={`Elimina spesa ${expense.description ?? expense.category}`}
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
// COMPONENTE PRINCIPALE
// ==========================================

function App() {
  // ========================================
  // DATI
  // ========================================

  const [payers, setPayers] = useState<Payer[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ========================================
  // NUOVO PAGATORE
  // ========================================

  const [newPayerName, setNewPayerName] = useState("");

  const [addingPayer, setAddingPayer] = useState(false);

  const [payerError, setPayerError] = useState<string | null>(null);

  const [payerSuccess, setPayerSuccess] = useState(false);

  // ========================================
  // CAMPI NUOVA SPESA
  // ========================================

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Alimentari");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(getTodayDate);

  // Nome libero, nessun valore predefinito
  const [payerId, setPayerId] = useState("");

  // ========================================
  // STATI SALVATAGGIO
  // ========================================

  const [saving, setSaving] = useState(false);

  const [saveError, setSaveError] = useState<string | null>(null);

  const [saveSuccess, setSaveSuccess] = useState(false);

  // ========================================
  // STATI ELIMINAZIONE
  // ========================================

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ========================================
  // CARICAMENTO DATI
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
          throw new Error("Impossibile recuperare i pagatori");
        }

        if (!expensesResponse.ok) {
          throw new Error("Impossibile recuperare le spese");
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
              : "Errore durante il caricamento",
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
  // AGGIUNTA PAGATORE
  // ========================================

  async function handleAddPayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPayerError(null);
    setPayerSuccess(false);

    const name = newPayerName.trim();

    if (!name || name.length > 100) {
      setPayerError("Inserisci un nome da 1 a 100 caratteri.");
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
          await getApiError(response, "Impossibile creare il pagatore"),
        );
      }

      const newPayer: Payer = await response.json();

      setPayers((previousPayers) =>
        [...previousPayers, newPayer].sort(sortPayers),
      );
      // Seleziona il pagatore appena creato
      setPayerId(newPayer.id);
      setNewPayerName("");
      setPayerSuccess(true);
    } catch (err) {
      setPayerError(
        err instanceof Error ? err.message : "Errore durante il salvataggio",
      );
    } finally {
      setAddingPayer(false);
    }
  }

  // ========================================
  // AGGIUNTA SPESA
  // ========================================

  async function handleAddExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaveError(null);
    setSaveSuccess(false);

    if (!payerId || !payers.some((payer) => payer.id === payerId)) {
      setSaveError("Seleziona un pagatore prima di registrare la spesa.");

      return;
    }

    const normalizedAmount = amount.trim().replace(",", ".");

    if (!/^\d+(\.\d{1,2})?$/.test(normalizedAmount)) {
      setSaveError("Inserisci un importo valido con massimo due decimali.");
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
        "L’importo deve essere maggiore di zero e non superiore a 1.000.000 €.",
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
          await getApiError(response, "Impossibile salvare la spesa"),
        );
      }

      const newExpense: Expense = await response.json();

      // Aggiorniamo le spese.
      setExpenses((previousExpenses) =>
        [newExpense, ...previousExpenses].sort((a, b) =>
          b.expenseDate.localeCompare(a.expenseDate),
        ),
      );

      // Se abbiamo digitato un nome nuovo,
      // aggiungiamolo anche all'elenco dei pagatori.
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
        err instanceof Error ? err.message : "Errore durante il salvataggio",
      );
    } finally {
      setSaving(false);
    }
  }

  // ========================================
  // ELIMINAZIONE SPESA
  // ========================================

  async function handleDeleteExpense(expense: Expense) {
    if (deletingId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `Vuoi eliminare la spesa "${expense.description ?? expense.category}" di ${expense.payer} (${formatCurrency(expense.amountCents)})?\n\nQuesta operazione è definitiva.`,
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
          await getApiError(response, "Impossibile eliminare la spesa"),
        );
      }

      setExpenses((previousExpenses) =>
        previousExpenses.filter((item) => item.id !== expense.id),
      );
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Errore durante l’eliminazione",
      );
    } finally {
      setDeletingId(null);
    }
  }

  // ========================================
  // FILTRI E TOTALI
  // ========================================

  function getPayerExpenses(payer: Payer): Expense[] {
    return expenses.filter(
      (expense) =>
        expense.payerId === payer.id ||
        (expense.payerId === null &&
          expense.payer.toLocaleLowerCase("it-IT") ===
            payer.name.toLocaleLowerCase("it-IT")),
    );
  }

  const totalExpenses = expenses.reduce(
    (total, expense) => total + expense.amountCents,
    0,
  );

  // ========================================
  // INTERFACCIA
  // ========================================

  return (
    <main className="dashboard">
      {/* HEADER */}

      <header className="dashboard-header">
        <div>
          <span className="subtitle">PERSONAL FINANCE</span>

          <h1>ExpenseFlow</h1>

          <p>Monitora e gestisci le tue spese quotidiane.</p>
        </div>
      </header>

      {/* RIEPILOGO DINAMICO */}

      <section className="stats">
        <div className="stat-card">
          <p>Totale complessivo</p>

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
              <p>Totale {payer.name}</p>

              <h2>{formatCurrency(total)}</h2>
            </div>
          );
        })}
      </section>

      {/* GESTIONE PAGATORI */}

      <section className="add-expense-section">
        <h2>I tuoi pagatori</h2>

        <p>Aggiungi le persone di cui vuoi monitorare le spese.</p>

        <form onSubmit={handleAddPayer}>
  <div className="form-grid">
    <div className="form-field">
      <label htmlFor="newPayerName">
        Nome del nuovo pagatore
      </label>

      <input
        id="newPayerName"
        type="text"
        placeholder="Es. Luca, Sofia, Giovanni..."
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
      Pagatore aggiunto correttamente!
    </p>
  )}

  <button
    type="submit"
    className="submit-button"
    disabled={addingPayer}
  >
    {addingPayer
      ? 'Salvataggio...'
      : 'Aggiungi pagatore'}
  </button>
</form>

        {!loading &&
          !error &&
          (payers.length === 0 ? (
            <p>Non hai ancora aggiunto pagatori.</p>
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

      {/* NUOVA SPESA */}

      <section className="add-expense-section">
        <h2>Aggiungi una spesa</h2>

        <p>Registra una nuova operazione.</p>

        <form onSubmit={handleAddExpense}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="amount">Importo (€)</label>

              <input
                id="amount"
                type="text"
                inputMode="decimal"
                placeholder="Es. 12,50"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="category">Categoria</label>

              <select
                id="category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="Alimentari">Alimentari</option>

                <option value="Trasporti">Trasporti</option>

                <option value="Casa">Casa</option>

                <option value="Salute">Salute</option>

                <option value="Svago">Svago</option>

                <option value="Altro">Altro</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="description">Descrizione</label>

              <input
                id="description"
                type="text"
                placeholder="Es. Pranzo al ristorante"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={500}
              />
            </div>

            <div className="form-field">
              <label htmlFor="expenseDate">Data</label>

              <input
                id="expenseDate"
                type="date"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
                required
              />
            </div>

            {/* PAGATORE LIBERO */}

            <div className="form-field">
  <label htmlFor="payer">
    Chi ha pagato?
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
      Seleziona un pagatore
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
              Spesa registrata correttamente!
            </p>
          )}

          <button
            type="submit"
            className="submit-button"
            disabled={saving || payers.length === 0}
          >
            {saving ? "Salvataggio..." : "Aggiungi spesa"}
          </button>
        </form>
      </section>

      {/* MESSAGGI */}

      {loading && <p role="status">Caricamento dei dati...</p>}

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

      {/* TABELLE DINAMICHE */}

      {!loading && !error && (
        <>
          {payers.length === 0 ? (
            <section className="expenses-section">
              <h2>Le tue spese</h2>

              <p>Aggiungi un pagatore per iniziare a monitorare le spese.</p>
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
