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

type DateRangePreset = 'all' | 'month' | 'last30' | 'custom'
type SortField = 'date' | 'amount' | 'category'

function getDateRangeBounds(preset: DateRangePreset, customFrom: string, customTo: string): { from: string; to: string } | null {
  const today = new Date().toISOString().slice(0, 10)
  if (preset === 'all') return null
  if (preset === 'month') {
    const d = new Date()
    const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
    return { from, to: today }
  }
  if (preset === 'last30') {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return { from: d.toISOString().slice(0, 10), to: today }
  }
  if (preset === 'custom' && customFrom && customTo) return { from: customFrom, to: customTo }
  return null
}

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
  const [dateRange, setDateRange] = useState<DateRangePreset>('all')
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [sortBy, setSortBy] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editNote, setEditNote] = useState('')

  const authHeaders = useCallback(() => {
    if (!token) return {}
    return { Authorization: `Bearer ${token}` }
  }, [token])

  const filteredTransactions = useMemo(() => {
    let list = transactions
    const bounds = getDateRangeBounds(dateRange, customDateFrom, customDateTo)
    if (bounds) {
      list = list.filter((t) => t.date >= bounds.from && t.date <= bounds.to)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter((t) => (t.note ?? '').toLowerCase().includes(q))
    }
    if (categoryFilter) {
      list = list.filter((t) => t.category.toLowerCase() === categoryFilter.toLowerCase())
    }
    return list
  }, [transactions, dateRange, customDateFrom, customDateTo, searchQuery, categoryFilter])

  const sortedTransactions = useMemo(() => {
    const list = [...filteredTransactions]
    const mult = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sortBy === 'date') return mult * (a.date.localeCompare(b.date) || 0)
      if (sortBy === 'amount') return mult * (a.amount - b.amount)
      if (sortBy === 'category') return mult * a.category.localeCompare(b.category)
      return 0
    })
    return list
  }, [filteredTransactions, sortBy, sortDir])

  const totalExpense = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.category.toLowerCase() === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
  }, [filteredTransactions])

  const totalIncome = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.category.toLowerCase() === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
  }, [filteredTransactions])

  const netBalance = useMemo(() => totalIncome - totalExpense, [totalIncome, totalExpense])

  const expenseNoteData = useMemo(() => {
    const expenses = filteredTransactions.filter((t) => t.category.toLowerCase() === 'expense')
    const noteTotals: Record<string, number> = {}
    expenses.forEach((t) => {
      const noteKey = t.note || 'No Note'
      noteTotals[noteKey] = (noteTotals[noteKey] || 0) + t.amount
    })
    return Object.entries(noteTotals)
      .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
  }, [filteredTransactions])

  const incomeNoteData = useMemo(() => {
    const income = filteredTransactions.filter((t) => t.category.toLowerCase() === 'income')
    const noteTotals: Record<string, number> = {}
    income.forEach((t) => {
      const noteKey = t.note || 'No Note'
      noteTotals[noteKey] = (noteTotals[noteKey] || 0) + t.amount
    })
    return Object.entries(noteTotals)
      .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
  }, [filteredTransactions])

  const dailyExpenses = useMemo(() => {
    const expenses = filteredTransactions.filter((t) => t.category.toLowerCase() === 'expense')
    const dailyGroups: Record<string, Array<{ note: string; amount: number }>> = {}
    expenses.forEach((t) => {
      if (!dailyGroups[t.date]) dailyGroups[t.date] = []
      dailyGroups[t.date].push({ note: t.note || 'No Note', amount: t.amount })
    })
    return Object.entries(dailyGroups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, items]) => ({ date, items: items.map((item) => ({ ...item, amount: parseFloat(item.amount.toFixed(2)) })) }))
  }, [filteredTransactions])

  const dailyIncome = useMemo(() => {
    const income = filteredTransactions.filter((t) => t.category.toLowerCase() === 'income')
    const dailyGroups: Record<string, Array<{ note: string; amount: number }>> = {}
    income.forEach((t) => {
      if (!dailyGroups[t.date]) dailyGroups[t.date] = []
      dailyGroups[t.date].push({ note: t.note || 'No Note', amount: t.amount })
    })
    return Object.entries(dailyGroups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, items]) => ({ date, items: items.map((item) => ({ ...item, amount: parseFloat(item.amount.toFixed(2)) })) }))
  }, [filteredTransactions])

  const expenseBarChartOptions = useMemo(() => {
    const expenses = filteredTransactions.filter((t) => t.category.toLowerCase() === 'expense')
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
  }, [filteredTransactions])

  const incomeBarChartOptions = useMemo(() => {
    const income = filteredTransactions.filter((t) => t.category.toLowerCase() === 'income')
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
  }, [filteredTransactions])

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

  const updateTransaction = useCallback(
    async (id: number, payload: { amount?: number; category?: string; date?: string; note?: string | null }) => {
      if (!token) return
      try {
        setError(null)
        const res = await fetch(`${API_BASE}/transactions/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          let msg = 'Could not update transaction.'
          if (typeof data?.detail === 'string') msg = data.detail
          else if (Array.isArray(data?.detail)) msg = data.detail.map((x: { msg?: string }) => x?.msg).filter(Boolean).join(' ') || msg
          throw new Error(msg)
        }
        const updated: Transaction = await res.json()
        setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)))
        setEditingTransaction(null)
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : 'Could not update transaction.')
      }
    },
    [token, authHeaders]
  )

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

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
  }

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
        <div className="summary-totals">
          <div className={`chart-total net-balance ${netBalance >= 0 ? 'net-positive' : 'net-negative'}`}>
            <strong>Net:</strong> ${netBalance.toFixed(2)}
          </div>
        </div>
        {(expenseNoteData.length > 0 || incomeNoteData.length > 0) && (
          <div className="pie-charts-wrapper">
            {expenseNoteData.length > 0 && (
              <div className="pie-chart-container">
                <div className="chart-total pie-only"><strong>Total Expense:</strong> ${totalExpense.toFixed(2)}</div>
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
                <div className="note-totals-dashboard note-totals-below-pie">
                  <h4>Expense totals by note</h4>
                  <ul className="note-totals-list">
                    {expenseNoteData.map((entry, index) => (
                      <li key={`exp-note-${entry.name}-${index}`} className="note-totals-item">
                        <span className="note-totals-label">{entry.name}</span>
                        <span className="note-totals-amount expense-amount">${entry.value.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {incomeNoteData.length > 0 && (
              <div className="pie-chart-container">
                <div className="chart-total pie-only"><strong>Total Income:</strong> ${totalIncome.toFixed(2)}</div>
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
                <div className="note-totals-dashboard note-totals-below-pie">
                  <h4>Income totals by note</h4>
                  <ul className="note-totals-list">
                    {incomeNoteData.map((entry, index) => (
                      <li key={`inc-note-${entry.name}-${index}`} className="note-totals-item">
                        <span className="note-totals-label">{entry.name}</span>
                        <span className="note-totals-amount income-amount">${entry.value.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
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
      </section>
      <section className="card">
        <h2>All Transactions</h2>
        <div className="filters-row">
          <label className="filter-group">
            <span className="filter-label">Date range</span>
            <select value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRangePreset)} className="filter-select">
              <option value="all">All time</option>
              <option value="month">This month</option>
              <option value="last30">Last 30 days</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          {dateRange === 'custom' && (
            <>
              <label className="filter-group">
                <span className="filter-label">From</span>
                <input type="date" value={customDateFrom} onChange={(e) => setCustomDateFrom(e.target.value)} className="filter-input" />
              </label>
              <label className="filter-group">
                <span className="filter-label">To</span>
                <input type="date" value={customDateTo} onChange={(e) => setCustomDateTo(e.target.value)} className="filter-input" />
              </label>
            </>
          )}
          <label className="filter-group">
            <span className="filter-label">Category</span>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="filter-select">
              <option value="">All</option>
              <option value="Expense">Expense</option>
              <option value="Income">Income</option>
            </select>
          </label>
          <label className="filter-group filter-search">
            <span className="filter-label">Search note</span>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Filter by note…" className="filter-input" />
          </label>
        </div>
        {sortedTransactions.length === 0 ? (
          <p>{transactions.length === 0 ? 'No transactions yet.' : 'No transactions match the current filters.'}</p>
        ) : (
          <table className="transactions-table">
            <thead>
              <tr>
                <th>
                  <button type="button" className="th-sort-btn" onClick={() => handleSort('date')}>
                    Date {sortBy === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th>
                  <button type="button" className="th-sort-btn" onClick={() => handleSort('category')}>
                    Category {sortBy === 'category' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th>
                  <button type="button" className="th-sort-btn" onClick={() => handleSort('amount')}>
                    Amount {sortBy === 'amount' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th>Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedTransactions.map((t) => (
                <tr key={t.id ?? `${t.date}-${t.category}-${t.amount}-${t.note}`}>
                  <td>{t.date}</td>
                  <td>{t.category}</td>
                  <td>{t.amount.toFixed(2)}</td>
                  <td>{t.note}</td>
                  <td className="actions-cell">
                    {t.id != null && (
                      <>
                        <button
                        type="button"
                        className="edit-transaction-btn"
                        onClick={() => {
                          setEditingTransaction({ ...t })
                          setEditAmount(String(t.amount))
                          setEditCategory(t.category)
                          setEditDate(t.date)
                          setEditNote(t.note ?? '')
                        }}
                        title="Edit"
                      >
                        Edit
                      </button>
                        <button type="button" className="delete-transaction-btn" onClick={() => deleteTransaction(t.id!)} title="Remove" aria-label={`Remove ${t.category} ${t.amount} ${t.note ?? ''}`}>Remove</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {editingTransaction && editingTransaction.id != null && (
        <div className="modal-overlay" onClick={() => setEditingTransaction(null)} role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 id="edit-modal-title">Edit Transaction</h2>
            <div className="form">
              <div className="form-row">
                <label><span className="label-text">Amount</span><input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} required /></label>
                <label><span className="label-text">Category</span><select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} required><option value="Expense">Expense</option><option value="Income">Income</option></select></label>
              </div>
              <div className="form-row">
                <label><span className="label-text">Date</span><input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} required /></label>
                <label><span className="label-text">Note</span><input type="text" value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Item" /></label>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setEditingTransaction(null)}>Cancel</button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!editAmount.trim() || !editCategory.trim() || !editDate.trim()) {
                      setError('Amount, category, and date are required.')
                      return
                    }
                    const numAmount = parseFloat(editAmount)
                    if (Number.isNaN(numAmount)) {
                      setError('Amount must be a number.')
                      return
                    }
                    setError(null)
                    await updateTransaction(editingTransaction.id, {
                      amount: numAmount,
                      category: editCategory.trim(),
                      date: editDate.trim(),
                      note: editNote.trim() || null,
                    })
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
