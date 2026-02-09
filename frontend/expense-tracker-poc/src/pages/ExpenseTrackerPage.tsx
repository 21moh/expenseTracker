import type { FormEvent } from 'react'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { AgCharts } from 'ag-charts-react'
import { useAuth } from '../context/AuthContext'
import '../App.css'

const API_BASE = 'http://localhost:8000'

type Transaction = {
  id?: number
  amount: number
  category: string
  date: string
  note?: string | null
}

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8',
  '#82CA9D', '#FFC658', '#FF7C7C', '#8DD1E1', '#D084D0'
]

export default function ExpenseTrackerPage() {
  const { token, logout } = useAuth()
  const navigate = useNavigate()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authHeaders = useCallback(() => {
    if (!token) return {}
    return { Authorization: `Bearer ${token}` }
  }, [token])

  const totalExpense = useMemo(() => {
    return transactions
      .filter((t) => t.category.toLowerCase() === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
  }, [transactions])

  const totalIncome = useMemo(() => {
    return transactions
      .filter((t) => t.category.toLowerCase() === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
  }, [transactions])

  const expenseNoteData = useMemo(() => {
    const expenses = transactions.filter((t) => t.category.toLowerCase() === 'expense')
    const noteTotals: Record<string, number> = {}
    expenses.forEach((t) => {
      const noteKey = t.note || 'No Note'
      noteTotals[noteKey] = (noteTotals[noteKey] || 0) + t.amount
    })
    return Object.entries(noteTotals).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
  }, [transactions])

  const incomeNoteData = useMemo(() => {
    const income = transactions.filter((t) => t.category.toLowerCase() === 'income')
    const noteTotals: Record<string, number> = {}
    income.forEach((t) => {
      const noteKey = t.note || 'No Note'
      noteTotals[noteKey] = (noteTotals[noteKey] || 0) + t.amount
    })
    return Object.entries(noteTotals).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
  }, [transactions])

  const dailyExpenses = useMemo(() => {
    const expenses = transactions.filter((t) => t.category.toLowerCase() === 'expense')
    const dailyGroups: Record<string, Array<{ note: string; amount: number }>> = {}
    expenses.forEach((t) => {
      if (!dailyGroups[t.date]) dailyGroups[t.date] = []
      dailyGroups[t.date].push({ note: t.note || 'No Note', amount: t.amount })
    })
    return Object.entries(dailyGroups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, items]) => ({ date, items: items.map((item) => ({ ...item, amount: parseFloat(item.amount.toFixed(2)) })) }))
  }, [transactions])

  const dailyIncome = useMemo(() => {
    const income = transactions.filter((t) => t.category.toLowerCase() === 'income')
    const dailyGroups: Record<string, Array<{ note: string; amount: number }>> = {}
    income.forEach((t) => {
      if (!dailyGroups[t.date]) dailyGroups[t.date] = []
      dailyGroups[t.date].push({ note: t.note || 'No Note', amount: t.amount })
    })
    return Object.entries(dailyGroups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, items]) => ({ date, items: items.map((item) => ({ ...item, amount: parseFloat(item.amount.toFixed(2)) })) }))
  }, [transactions])

  const expenseBarChartOptions = useMemo(() => {
    const expenses = transactions.filter((t) => t.category.toLowerCase() === 'expense')
    if (expenses.length === 0) return null
    const byDate: Record<string, Array<{ amount: number; note: string }>> = {}
    expenses.forEach((t) => {
      if (!byDate[t.date]) byDate[t.date] = []
      byDate[t.date].push({ amount: parseFloat(t.amount.toFixed(2)), note: t.note || 'No Note' })
    })
    const maxBars = Math.max(...Object.values(byDate).map((arr) => arr.length))
    const sortedDates = Object.keys(byDate).sort()
    const data = sortedDates.map((date) => {
      const items = byDate[date]
      const row: Record<string, string | number> = { date }
      items.forEach((item, i) => { row[`amount${i}`] = item.amount; row[`note${i}`] = item.note })
      for (let i = items.length; i < maxBars; i++) { row[`amount${i}`] = 0; row[`note${i}`] = '' }
      return row
    })
    const series = Array.from({ length: maxBars }, (_, i) => ({
      type: 'bar' as const,
      xKey: 'date',
      yKey: `amount${i}`,
      yName: 'Expense',
      legendItemName: 'Expense',
      stacked: true,
      fill: COLORS[i % COLORS.length],
      tooltip: {
        renderer: ({ datum, yKey }: { datum: Record<string, string | number>; yKey: string }) => {
          const amount = Number(datum[yKey])
          if (amount === 0) return {}
          const noteKey = `note${yKey.replace('amount', '')}`
          return { title: String(datum[noteKey] || 'No Note'), data: [{ label: 'Amount', value: `$${amount.toFixed(2)}` }] }
        },
      },
    }))
    return {
      data,
      series,
      background: { fill: '#242424' },
      theme: { baseTheme: 'ag-default-dark', params: { foregroundColor: 'white', backgroundColor: '#242424', tooltipTextColor: '#242424', tooltipBackgroundColor: 'rgba(255, 255, 255, 0.9)' } },
      axes: [
        { type: 'category', position: 'bottom', label: { rotation: -45, color: 'white' }, line: { color: 'white' }, tick: { color: 'white' } },
        { type: 'number', position: 'left', title: { text: 'Expense ($)', color: 'white' }, label: { color: 'white' }, line: { color: 'white' }, tick: { color: 'white' } },
      ],
      legend: { enabled: true, item: { label: { color: 'white' } } },
    }
  }, [transactions])

  const incomeBarChartOptions = useMemo(() => {
    const income = transactions.filter((t) => t.category.toLowerCase() === 'income')
    if (income.length === 0) return null
    const byDate: Record<string, Array<{ amount: number; note: string }>> = {}
    income.forEach((t) => {
      if (!byDate[t.date]) byDate[t.date] = []
      byDate[t.date].push({ amount: parseFloat(t.amount.toFixed(2)), note: t.note || 'No Note' })
    })
    const maxBars = Math.max(...Object.values(byDate).map((arr) => arr.length))
    const sortedDates = Object.keys(byDate).sort()
    const data = sortedDates.map((date) => {
      const items = byDate[date]
      const row: Record<string, string | number> = { date }
      items.forEach((item, i) => { row[`amount${i}`] = item.amount; row[`note${i}`] = item.note })
      for (let i = items.length; i < maxBars; i++) { row[`amount${i}`] = 0; row[`note${i}`] = '' }
      return row
    })
    const series = Array.from({ length: maxBars }, (_, i) => ({
      type: 'bar' as const,
      xKey: 'date',
      yKey: `amount${i}`,
      yName: 'Income',
      legendItemName: 'Income',
      stacked: true,
      fill: COLORS[i % COLORS.length],
      tooltip: {
        renderer: ({ datum, yKey }: { datum: Record<string, string | number>; yKey: string }) => {
          const amount = Number(datum[yKey])
          if (amount === 0) return {}
          const noteKey = `note${yKey.replace('amount', '')}`
          return { title: String(datum[noteKey] || 'No Note'), data: [{ label: 'Amount', value: `$${amount.toFixed(2)}` }] }
        },
      },
    }))
    return {
      data,
      series,
      background: { fill: '#242424' },
      theme: { baseTheme: 'ag-default-dark', params: { foregroundColor: 'white', backgroundColor: '#242424', tooltipTextColor: '#242424', tooltipBackgroundColor: 'rgba(255, 255, 255, 0.9)' } },
      axes: [
        { type: 'category', position: 'bottom', label: { rotation: -45, color: 'white' }, line: { color: 'white' }, tick: { color: 'white' } },
        { type: 'number', position: 'left', title: { text: 'Income ($)', color: 'white' }, label: { color: 'white' }, line: { color: 'white' }, tick: { color: 'white' } },
      ],
      legend: { enabled: true, item: { label: { color: 'white' } } },
    }
  }, [transactions])

  const fetchTransactions = useCallback(async () => {
    if (!token) return
    try {
      setError(null)
      const res = await fetch(`${API_BASE}/transactions/`, { headers: authHeaders() })
      if (!res.ok) throw new Error('Failed to load transactions')
      const data: Transaction[] = await res.json()
      setTransactions(data)
    } catch (err) {
      console.error(err)
      setError('Could not load transactions.')
    }
  }, [token, authHeaders])

  const deleteTransaction = useCallback(
    async (id: number) => {
      if (!token) return
      try {
        setError(null)
        const res = await fetch(`${API_BASE}/transactions/${id}`, {
          method: 'DELETE',
          headers: authHeaders(),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          const msg = typeof data?.detail === 'string' ? data.detail : 'Could not delete transaction.'
          throw new Error(msg)
        }
        setTransactions((prev) => prev.filter((t) => t.id !== id))
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : 'Could not delete transaction.')
      }
    },
    [token, authHeaders]
  )

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!token) {
      setError('Please log in again.')
      return
    }
    if (!amount || !category || !date) {
      setError('Amount, category, and date are required.')
      return
    }
    const numAmount = parseFloat(amount)
    if (Number.isNaN(numAmount)) {
      setError('Amount must be a number.')
      return
    }
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`${API_BASE}/transactions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ amount: numAmount, category, date, note: note || null }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = typeof data?.detail === 'string' ? data.detail : Array.isArray(data?.detail) ? data.detail.map((x: { msg?: string }) => x?.msg).filter(Boolean).join(', ') : data?.detail ?? 'Could not save transaction.'
        if (res.status === 401) {
          setError('Session expired or invalid. Please log in again.')
          return
        }
        throw new Error(msg || 'Could not save transaction.')
      }
      setAmount('')
      setCategory('')
      setNote('')
      await fetchTransactions()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not save transaction.')
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app">
      <header className="app-header-row">
        <h1>Expense Tracker</h1>
        <button type="button" onClick={handleLogout} className="logout-btn">
          Log out
        </button>
      </header>
      {error && <div className="error">{error}</div>}
      <section className="card">
        <h2>Add Transaction</h2>
        <form onSubmit={handleSubmit} className="form">
          <div className="form-row">
            <label>
              <span className="label-text">Amount</span>
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </label>
            <label>
              <span className="label-text">Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} required>
                <option value="">Select category...</option>
                <option value="Expense">Expense</option>
                <option value="Income">Income</option>
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              <span className="label-text">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label>
              <span className="label-text">Note</span>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Item" />
            </label>
          </div>
          <button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Add Transaction'}</button>
        </form>
      </section>
      <section className="card">
        <h2>Summary</h2>
        {(expenseNoteData.length > 0 || incomeNoteData.length > 0) && (
          <div className="pie-charts-wrapper">
            {expenseNoteData.length > 0 && (
              <div className="pie-chart-container">
                <div className="chart-total"><strong>Total Expense:</strong> ${totalExpense.toFixed(2)}</div>
                <h3>Expenses by Note</h3>
                <ResponsiveContainer width="100%" height={450}>
                  <PieChart margin={{ top: 30, right: 40, bottom: 30, left: 40 }}>
                    <Pie data={expenseNoteData} cx="50%" cy="50%" labelLine label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={75} fill="#8884d8" dataKey="value">
                      {expenseNoteData.map((entry, index) => <Cell key={`expense-cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            {incomeNoteData.length > 0 && (
              <div className="pie-chart-container">
                <div className="chart-total"><strong>Total Income:</strong> ${totalIncome.toFixed(2)}</div>
                <h3>Income by Note</h3>
                <ResponsiveContainer width="100%" height={450}>
                  <PieChart margin={{ top: 30, right: 40, bottom: 30, left: 40 }}>
                    <Pie data={incomeNoteData} cx="50%" cy="50%" labelLine label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={75} fill="#8884d8" dataKey="value">
                      {incomeNoteData.map((entry, index) => <Cell key={`income-cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
        <div className="daily-totals-wrapper">
          {dailyExpenses.length > 0 && (
            <div className="daily-section">
              <h3>Daily Expenses</h3>
              <ul className="daily-list">
                {dailyExpenses.map(({ date: d, items }) => (
                  <li key={`expense-${d}`} className="daily-date-group">
                    <div className="daily-date-header">{d}</div>
                    {items.map((item, idx) => (
                      <div key={`${d}-${idx}`} className="daily-item">
                        <span className="daily-note">{item.note}</span>
                        <span className="daily-amount">${item.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {dailyIncome.length > 0 && (
            <div className="daily-section">
              <h3>Daily Income</h3>
              <ul className="daily-list">
                {dailyIncome.map(({ date: d, items }) => (
                  <li key={`income-${d}`} className="daily-date-group">
                    <div className="daily-date-header">{d}</div>
                    {items.map((item, idx) => (
                      <div key={`${d}-${idx}`} className="daily-item">
                        <span className="daily-note">{item.note}</span>
                        <span className="daily-amount">${item.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {expenseBarChartOptions && (
          <div className="income-bar-chart-container">
            <h3>Total Expense by Date</h3>
            <div className="ag-chart-wrapper"><AgCharts options={expenseBarChartOptions} /></div>
          </div>
        )}
        {incomeBarChartOptions && (
          <div className="income-bar-chart-container">
            <h3>Total Income by Date</h3>
            <div className="ag-chart-wrapper"><AgCharts options={incomeBarChartOptions} /></div>
          </div>
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id ?? `${t.date}-${t.category}-${t.amount}-${t.note}`}>
                  <td>{t.date}</td>
                  <td>{t.category}</td>
                  <td>{t.amount.toFixed(2)}</td>
                  <td>{t.note}</td>
                  <td>
                    {t.id != null && (
                      <button
                        type="button"
                        className="delete-transaction-btn"
                        onClick={() => deleteTransaction(t.id!)}
                        title="Remove"
                        aria-label={`Remove ${t.category} ${t.amount} ${t.note ?? ''}`}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
