import type { FormEvent } from 'react'
import { useEffect, useState, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { AgCharts } from 'ag-charts-react'
import './App.css'

const API_BASE = 'http://localhost:8000'

type Transaction = {
  id?: number
  amount: number
  category: string
  date: string // ISO string (YYYY-MM-DD)
  note?: string | null
}

// Color palette for pie chart
const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', 
  '#82CA9D', '#FFC658', '#FF7C7C', '#8DD1E1', '#D084D0'
]

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([])

  const [amount, setAmount] = useState<string>('')
  const [category, setCategory] = useState<string>('')
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState<string>('')

  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Calculate total expenses
  const totalExpense = useMemo(() => {
    return transactions
      .filter((t) => t.category.toLowerCase() === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
  }, [transactions])

  // Calculate total income
  const totalIncome = useMemo(() => {
    return transactions
      .filter((t) => t.category.toLowerCase() === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
  }, [transactions])

  // Calculate expense totals by note for pie chart
  const expenseNoteData = useMemo(() => {
    // Filter only expenses (transactions with category "expense")
    const expenses = transactions.filter((t) => 
      t.category.toLowerCase() === 'expense'
    )
    
    // Group by note value
    const noteTotals: Record<string, number> = {}
    expenses.forEach((t) => {
      const noteKey = t.note || 'No Note'
      noteTotals[noteKey] = (noteTotals[noteKey] || 0) + t.amount
    })
    
    return Object.entries(noteTotals).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2)),
    }))
  }, [transactions])

  // Calculate income totals by note for pie chart
  const incomeNoteData = useMemo(() => {
    // Filter only income (transactions with category "income")
    const income = transactions.filter((t) => 
      t.category.toLowerCase() === 'income'
    )
    
    // Group by note value
    const noteTotals: Record<string, number> = {}
    income.forEach((t) => {
      const noteKey = t.note || 'No Note'
      noteTotals[noteKey] = (noteTotals[noteKey] || 0) + t.amount
    })
    
    return Object.entries(noteTotals).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2)),
    }))
  }, [transactions])

  // Calculate daily expenses with notes
  const dailyExpenses = useMemo(() => {
    const expenses = transactions.filter((t) => 
      t.category.toLowerCase() === 'expense'
    )
    
    const dailyGroups: Record<string, Array<{ note: string; amount: number }>> = {}
    expenses.forEach((t) => {
      if (!dailyGroups[t.date]) {
        dailyGroups[t.date] = []
      }
      dailyGroups[t.date].push({
        note: t.note || 'No Note',
        amount: t.amount
      })
    })
    
    return Object.entries(dailyGroups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, items]) => ({ 
        date, 
        items: items.map(item => ({ ...item, amount: parseFloat(item.amount.toFixed(2)) }))
      }))
  }, [transactions])

  // Calculate daily income with notes
  const dailyIncome = useMemo(() => {
    const income = transactions.filter((t) => 
      t.category.toLowerCase() === 'income'
    )
    
    const dailyGroups: Record<string, Array<{ note: string; amount: number }>> = {}
    income.forEach((t) => {
      if (!dailyGroups[t.date]) {
        dailyGroups[t.date] = []
      }
      dailyGroups[t.date].push({
        note: t.note || 'No Note',
        amount: t.amount
      })
    })
    
    return Object.entries(dailyGroups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, items]) => ({ 
        date, 
        items: items.map(item => ({ ...item, amount: parseFloat(item.amount.toFixed(2)) }))
      }))
  }, [transactions])

  // Stacked expense bar chart: x = date, y = expense (multiple expenses per date stack)
  const expenseBarChartOptions = useMemo(() => {
    const expenses = transactions.filter((t) => t.category.toLowerCase() === 'expense')
    if (expenses.length === 0) return null

    const byDate: Record<string, Array<{ amount: number; note: string }>> = {}
    expenses.forEach((t) => {
      if (!byDate[t.date]) byDate[t.date] = []
      byDate[t.date].push({
        amount: parseFloat(t.amount.toFixed(2)),
        note: t.note || 'No Note'
      })
    })

    const maxBars = Math.max(...Object.values(byDate).map((arr) => arr.length))
    const sortedDates = Object.keys(byDate).sort()

    const data = sortedDates.map((date) => {
      const items = byDate[date]
      const row: Record<string, string | number> = { date }
      items.forEach((item, i) => {
        row[`amount${i}`] = item.amount
        row[`note${i}`] = item.note
      })
      for (let i = items.length; i < maxBars; i++) {
        row[`amount${i}`] = 0
        row[`note${i}`] = ''
      }
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
          const note = String(datum[noteKey] || 'No Note')
          return {
            title: note,
            data: [{ label: 'Amount', value: `$${amount.toFixed(2)}` }],
          }
        },
      },
    }))

    return {
      data,
      series,
      background: { fill: '#242424' },
      theme: {
        baseTheme: 'ag-default-dark',
        params: {
          foregroundColor: 'white',
          backgroundColor: '#242424',
          tooltipTextColor: '#242424',
          tooltipBackgroundColor: 'rgba(255, 255, 255, 0.9)',
        },
      },
      axes: [
        { type: 'category', position: 'bottom', label: { rotation: -45, color: 'white' }, line: { color: 'white' }, tick: { color: 'white' } },
        { type: 'number', position: 'left', title: { text: 'Expense ($)', color: 'white' }, label: { color: 'white' }, line: { color: 'white' }, tick: { color: 'white' } },
      ],
      legend: { enabled: true, item: { label: { color: 'white' } } },
    }
  }, [transactions])

  // Stacked income bar chart: x = date, y = income (multiple incomes per date stack)
  const incomeBarChartOptions = useMemo(() => {
    const income = transactions.filter((t) => t.category.toLowerCase() === 'income')
    if (income.length === 0) return null

    const byDate: Record<string, Array<{ amount: number; note: string }>> = {}
    income.forEach((t) => {
      if (!byDate[t.date]) byDate[t.date] = []
      byDate[t.date].push({
        amount: parseFloat(t.amount.toFixed(2)),
        note: t.note || 'No Note'
      })
    })

    const maxBars = Math.max(...Object.values(byDate).map((arr) => arr.length))
    const sortedDates = Object.keys(byDate).sort()

    const data = sortedDates.map((date) => {
      const items = byDate[date]
      const row: Record<string, string | number> = { date }
      items.forEach((item, i) => {
        row[`amount${i}`] = item.amount
        row[`note${i}`] = item.note
      })
      for (let i = items.length; i < maxBars; i++) {
        row[`amount${i}`] = 0
        row[`note${i}`] = ''
      }
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
          const note = String(datum[noteKey] || 'No Note')
          return {
            title: note,
            data: [{ label: 'Amount', value: `$${amount.toFixed(2)}` }],
          }
        },
      },
    }))

    return {
      data,
      series,
      background: { fill: '#242424' },
      theme: {
        baseTheme: 'ag-default-dark',
        params: {
          foregroundColor: 'white',
          backgroundColor: '#242424',
          tooltipTextColor: '#242424',
          tooltipBackgroundColor: 'rgba(255, 255, 255, 0.9)',
        },
      },
      axes: [
        { type: 'category', position: 'bottom', label: { rotation: -45, color: 'white' }, line: { color: 'white' }, tick: { color: 'white' } },
        { type: 'number', position: 'left', title: { text: 'Income ($)', color: 'white' }, label: { color: 'white' }, line: { color: 'white' }, tick: { color: 'white' } },
      ],
      legend: { enabled: true, item: { label: { color: 'white' } } },
    }
  }, [transactions])

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

  async function refreshAll() {
    await fetchTransactions()
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
              <span className="label-text">Amount</span>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>
            <label>
              <span className="label-text">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                <option value="">Select category...</option>
                <option value="Expense">Expense</option>
                <option value="Income">Income</option>
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              <span className="label-text">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
            <label>
              <span className="label-text">Note</span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Item"
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

        {(expenseNoteData.length > 0 || incomeNoteData.length > 0) && (
          <div className="pie-charts-wrapper">
            {expenseNoteData.length > 0 && (
              <div className="pie-chart-container">
                <div className="chart-total">
                  <strong>Total Expense:</strong> ${totalExpense.toFixed(2)}
                </div>
                <h3>Expenses by Note</h3>
                <ResponsiveContainer width="100%" height={450}>
                  <PieChart margin={{ top: 30, right: 40, bottom: 30, left: 40 }}>
                    <Pie
                      data={expenseNoteData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={75}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {expenseNoteData.map((entry, index) => (
                        <Cell key={`expense-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => `$${value.toFixed(2)}`}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {incomeNoteData.length > 0 && (
              <div className="pie-chart-container">
                <div className="chart-total">
                  <strong>Total Income:</strong> ${totalIncome.toFixed(2)}
                </div>
                <h3>Income by Note</h3>
                <ResponsiveContainer width="100%" height={450}>
                  <PieChart margin={{ top: 30, right: 40, bottom: 30, left: 40 }}>
                    <Pie
                      data={incomeNoteData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={75}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {incomeNoteData.map((entry, index) => (
                        <Cell key={`income-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => `$${value.toFixed(2)}`}
                    />
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
                {dailyExpenses.map(({ date, items }) => (
                  <li key={`expense-${date}`} className="daily-date-group">
                    <div className="daily-date-header">{date}</div>
                    {items.map((item, idx) => (
                      <div key={`${date}-${idx}`} className="daily-item">
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
                {dailyIncome.map(({ date, items }) => (
                  <li key={`income-${date}`} className="daily-date-group">
                    <div className="daily-date-header">{date}</div>
                    {items.map((item, idx) => (
                      <div key={`${date}-${idx}`} className="daily-item">
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
            <div className="ag-chart-wrapper">
              <AgCharts options={expenseBarChartOptions} />
            </div>
          </div>
        )}

        {incomeBarChartOptions && (
          <div className="income-bar-chart-container">
            <h3>Total Income by Date</h3>
            <div className="ag-chart-wrapper">
              <AgCharts options={incomeBarChartOptions} />
            </div>
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
