import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import './App.css'

const API_BASE = 'http://localhost:8000'

type Transaction = {
  id?: number
  amount: number
  category: string
  date: string // ISO string (YYYY-MM-DD)
  note?: string | null
}

type DailySum = Record<string, number>

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [totalAmount, setTotalAmount] = useState<number>(0)
  const [dailySums, setDailySums] = useState<DailySum>({})

  const [amount, setAmount] = useState<string>('')
  const [category, setCategory] = useState<string>('')
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState<string>('')

  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchTransactions() {
    try {
      setError(null)
      const res = await fetch(`${API_BASE}/transactions/`)
      if (!res.ok) throw new Error('Failed to load transactions')
      const data: Transaction[] = await res.json()
      setTransactions(data)
    } catch (err) {
      console.error(err)
      setError('Could not load transactions.')
    }
  }

  async function fetchTotals() {
    try {
      setError(null)

      const [sumRes, dailyRes] = await Promise.all([
        fetch(`${API_BASE}/transactions/sum`),
        fetch(`${API_BASE}/transactions/daily-sum`),
      ])

      if (!sumRes.ok) throw new Error('Failed to load total sum')
      if (!dailyRes.ok) throw new Error('Failed to load daily sums')

      const sumData: { total_amount: number } = await sumRes.json()
      const dailyData: DailySum = await dailyRes.json()

      setTotalAmount(sumData.total_amount ?? 0)
      setDailySums(dailyData)
    } catch (err) {
      console.error(err)
      setError('Could not load totals.')
    }
  }

  async function refreshAll() {
    await Promise.all([fetchTransactions(), fetchTotals()])
  }

  useEffect(() => {
    refreshAll()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!amount || !category || !date) {
      setError('Amount, category, and date are required.')
      return
    }

    const payload: Transaction = {
      amount: parseFloat(amount),
      category,
      date,
      note: note || null,
    }

    if (Number.isNaN(payload.amount)) {
      setError('Amount must be a number.')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`${API_BASE}/transactions/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error('Failed to create transaction')
      }

      // Clear form (keep date)
      setAmount('')
      setCategory('')
      setNote('')

      // Reload data
      await refreshAll()
    } catch (err) {
      console.error(err)
      setError('Could not save transaction.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <h1>Expense Tracker</h1>

      {error && <div className="error">{error}</div>}

      <section className="card">
        <h2>Add Transaction</h2>
        <form onSubmit={handleSubmit} className="form">
          <div className="form-row">
            <label>
              Amount
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>
            <label>
              Category
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
            <label>
              Note
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Add Transaction'}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Summary</h2>
        <p>
          <strong>Total spent:</strong> {totalAmount.toFixed(2)}
        </p>

        {Object.keys(dailySums).length > 0 && (
          <>
            <h3>Daily totals</h3>
            <ul className="daily-list">
              {Object.entries(dailySums).map(([d, value]) => (
                <li key={d}>
                  <span>{d}</span>
                  <span>{value.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card">
        <h2>All Transactions</h2>
        {transactions.length === 0 ? (
          <p>No transactions yet.</p>
        ) : (
          <table className="transactions-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id ?? `${t.date}-${t.category}-${t.amount}-${t.note}`}>
                  <td>{t.date}</td>
                  <td>{t.category}</td>
                  <td>{t.amount.toFixed(2)}</td>
                  <td>{t.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

export default App
