import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

// ==========================================
// TIPI TYPESCRIPT
// ==========================================

type Payer = 'Antonio' | 'Marta'

type Expense = {
  id: string
  amountCents: number
  category: string
  description: string | null
  expenseDate: string
  payer: Payer
}

// Proprietà del componente ExpenseTable
type ExpenseTableProps = {
  payer: Payer
  expenses: Expense[]
  deletingId: string | null
  onDelete: (expense: Expense) => Promise<void>
}

// ==========================================
// FUNZIONI DI UTILITÀ
// ==========================================

function formatCurrency(amountCents: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amountCents / 100)
}

function formatDate(date: string): string {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

function getTodayDate(): string {
  const today = new Date()

  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
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
    0
  )

  return (
    <section className="expenses-section">
      <div className="section-header">
        <h2>Spese di {payer}</h2>

        <span>
          {expenses.length} operazioni · {formatCurrency(subtotal)}
        </span>
      </div>

      {expenses.length === 0 ? (
        <p>Nessuna spesa registrata per {payer}.</p>
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

                  <td>{expense.description ?? '—'}</td>

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
  )
}

// ==========================================
// COMPONENTE PRINCIPALE
// ==========================================

function App() {
  // Elenco delle spese
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Campi del modulo
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Alimentari')
  const [description, setDescription] = useState('')
  const [expenseDate, setExpenseDate] = useState(getTodayDate)

  // Nuovo campo pagatore
  const [payer, setPayer] = useState<Payer>('Antonio')

  // Stato del salvataggio
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Stato dell'eliminazione
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // ==========================================
  // CARICAMENTO DELLE SPESE
  // ==========================================

  useEffect(() => {
    const controller = new AbortController()

    async function loadExpenses() {
      try {
        const response = await fetch('/api/expenses', {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Impossibile recuperare le spese')
        }

        const data: Expense[] = await response.json()

        if (!controller.signal.aborted) {
          setExpenses(data)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Si è verificato un errore'
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadExpenses()

    return () => controller.abort()
  }, [])

  // ==========================================
  // AGGIUNTA DI UNA SPESA
  // ==========================================

  async function handleAddExpense(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setSaveError(null)
    setSaveSuccess(false)

    const normalizedAmount = amount.trim().replace(',', '.')

    if (!/^\d+(\.\d{1,2})?$/.test(normalizedAmount)) {
      setSaveError(
        'Inserisci un importo valido, con massimo due decimali.'
      )
      return
    }

    const [euros, cents = ''] = normalizedAmount.split('.')

    const amountCents =
      Number(euros) * 100 + Number(cents.padEnd(2, '0'))

    if (
      !Number.isSafeInteger(amountCents) ||
      amountCents <= 0 ||
      amountCents > 100_000_000
    ) {
      setSaveError(
        'Inserisci un importo maggiore di zero e non superiore a 1.000.000 €.'
      )
      return
    }

    setSaving(true)

    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amountCents,
          category,
          description: description.trim() || undefined,
          expenseDate,
          payer,
        }),
      })

      if (!response.ok) {
        throw new Error('Impossibile salvare la spesa')
      }

      const newExpense: Expense = await response.json()

      setExpenses((previousExpenses) =>
        [newExpense, ...previousExpenses].sort((a, b) =>
          b.expenseDate.localeCompare(a.expenseDate)
        )
      )

      setAmount('')
      setDescription('')
      setSaveSuccess(true)
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Si è verificato un errore'
      )
    } finally {
      setSaving(false)
    }
  }

  // ==========================================
  // ELIMINAZIONE DI UNA SPESA
  // ==========================================

  async function handleDeleteExpense(expense: Expense) {
    if (deletingId !== null) {
      return
    }

    const confirmed = window.confirm(
      `Vuoi eliminare la spesa "${expense.description ?? expense.category}" di ${expense.payer} (${formatCurrency(expense.amountCents)})?\n\nQuesta operazione è definitiva.`
    )

    if (!confirmed) {
      return
    }

    setDeleteError(null)
    setDeletingId(expense.id)

    try {
      const response = await fetch(
        `/api/expenses/${encodeURIComponent(expense.id)}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            'Spesa non trovata. Aggiorna la pagina e riprova.'
          )
        }

        throw new Error('Impossibile eliminare la spesa')
      }

      // Rimuoviamo la spesa dalla dashboard
      // solo dopo la conferma del server
      setExpenses((previousExpenses) =>
        previousExpenses.filter(
          (item) => item.id !== expense.id
        )
      )
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : 'Si è verificato un errore'
      )
    } finally {
      setDeletingId(null)
    }
  }

  // ==========================================
  // FILTRI PER PAGATORE
  // ==========================================

  const antonioExpenses = expenses.filter(
    (expense) => expense.payer === 'Antonio'
  )

  const martaExpenses = expenses.filter(
    (expense) => expense.payer === 'Marta'
  )

  // ==========================================
  // CALCOLO TOTALI
  // ==========================================

  const totalExpenses = expenses.reduce(
    (total, expense) => total + expense.amountCents,
    0
  )

  const totalAntonio = antonioExpenses.reduce(
    (total, expense) => total + expense.amountCents,
    0
  )

  const totalMarta = martaExpenses.reduce(
    (total, expense) => total + expense.amountCents,
    0
  )

  // ==========================================
  // INTERFACCIA REACT
  // ==========================================

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <span className="subtitle">PERSONAL FINANCE</span>
          <h1>ExpenseFlow</h1>
          <p>Monitora e gestisci le tue spese quotidiane.</p>
        </div>
      </header>

      {/* Riepilogo */}
      <section className="stats">
        <div className="stat-card">
          <p>Totale complessivo</p>
          <h2>{formatCurrency(totalExpenses)}</h2>
        </div>

        <div className="stat-card">
          <p>Totale Antonio</p>
          <h2>{formatCurrency(totalAntonio)}</h2>
        </div>

        <div className="stat-card">
          <p>Totale Marta</p>
          <h2>{formatCurrency(totalMarta)}</h2>
        </div>
      </section>

      {/* Modulo */}
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
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="category">Categoria</label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
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
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
              />
            </div>

            <div className="form-field">
              <label htmlFor="expenseDate">Data</label>
              <input
                id="expenseDate"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
              />
            </div>

            {/* Nuovo campo pagatore */}
            <div className="form-field">
              <label htmlFor="payer">Chi ha pagato?</label>
              <select
                id="payer"
                value={payer}
                onChange={(e) =>
                  setPayer(e.target.value as Payer)
                }
              >
                <option value="Antonio">Antonio</option>
                <option value="Marta">Marta</option>
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
            disabled={saving}
          >
            {saving ? 'Salvataggio...' : 'Aggiungi spesa'}
          </button>
        </form>
      </section>

      {/* Errori */}
      {loading && (
        <p role="status">Caricamento delle spese...</p>
      )}

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

      {/* Le due tabelle */}
      {!loading && !error && (
        <>
          <ExpenseTable
            payer="Antonio"
            expenses={antonioExpenses}
            deletingId={deletingId}
            onDelete={handleDeleteExpense}
          />

          <ExpenseTable
            payer="Marta"
            expenses={martaExpenses}
            deletingId={deletingId}
            onDelete={handleDeleteExpense}
          />
        </>
      )}
    </main>
  )
}

export default App