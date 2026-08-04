import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppData } from '../../context/AppDataContext'
import { PrintToolbar } from '../../components/PrintToolbar'
import { memberDisplayName } from '../../lib/candidates'
import { computeEndTimesMinutes, formatClockTime } from '../../lib/schedule'
import { fetchRangeData, findChairmanName, formatDateHeading, type RangeData } from '../../lib/printData'

export function SchedulePrintPage() {
  const { from, to } = useParams<{ from: string; to: string }>()
  const { settings, programTypes } = useAppData()
  const [data, setData] = useState<RangeData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!from || !to) return
    fetchRangeData(from, to)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : '不明なエラーが発生しました'))
      .finally(() => setLoading(false))
  }, [from, to])

  if (loading) return <div className="center-message">読み込み中...</div>
  if (error) return <div className="center-message error-text">{error}</div>
  if (!data) return null

  return (
    <div>
      <PrintToolbar backTo="/reports" />
      <div className="print-sheet schedule-sheet">
        <h1>クリスチャンとしての生活と奉仕の集会 ー 予定表</h1>
        {data.dates.map((date) => {
          const items = data.programsByDate.get(date) ?? []
          const endMins = computeEndTimesMinutes(settings.meeting_start_time, items)
          const chairman = findChairmanName(items, data.assignmentByProgramId, programTypes)

          return (
            <div className="schedule-week" key={date}>
              <div className="schedule-week-header">
                <span>{formatDateHeading(date)}</span>
                {chairman && <span>司会者: {chairman}</span>}
              </div>
              {items.map((item, idx) => {
                const assignment = data.assignmentByProgramId.get(item.id)
                return (
                  <div className="schedule-row" key={item.id}>
                    <div className="schedule-row-main">
                      <span>{item.title ?? item.program_types?.name}</span>
                      <span className="schedule-row-time">
                        {item.duration_minutes ? `${item.duration_minutes}分` : ''}
                        {' (〜'}
                        {formatClockTime(endMins[idx])}
                        {')'}
                      </span>
                    </div>
                    {item.material && <div className="schedule-row-material">{item.material}</div>}
                    {assignment?.member && (
                      <div className="schedule-row-presenter">
                        {memberDisplayName(assignment.member)}
                        {assignment.partner ? `(${memberDisplayName(assignment.partner)})` : ''}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
        {data.dates.length === 0 && <p className="center-message">対象期間にプログラムがありません。</p>}
      </div>
    </div>
  )
}
