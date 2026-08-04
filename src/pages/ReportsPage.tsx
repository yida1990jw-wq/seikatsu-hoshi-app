import { useState } from 'react'
import { Link } from 'react-router-dom'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function endOfNextMonthStr(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 2, 0)
  return d.toISOString().slice(0, 10)
}

const REPORTS = [
  { key: 'schedule', label: '集会予定表' },
  { key: 'assignments', label: '割当予定表' },
  { key: 'chairman', label: '司会進行用紙' },
  { key: 'counselor', label: '助言者用紙' },
  { key: 'slips', label: 'スリップ(一括)' },
]

export function ReportsPage() {
  const [from, setFrom] = useState(todayStr())
  const [to, setTo] = useState(endOfNextMonthStr())

  return (
    <div className="page">
      <h1>帳票印刷</h1>
      <p className="reports-hint">
        期間を指定して、各帳票を新しいタブで開きます。開いた画面の「印刷 / PDFに保存」からPDF化できます。
      </p>
      <div className="reports-range">
        <label>
          開始日
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          終了日
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <ul className="reports-list">
        {REPORTS.map((r) => (
          <li key={r.key}>
            <Link to={`/print/${r.key}/${from}/${to}`} target="_blank" rel="noopener noreferrer">
              {r.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
