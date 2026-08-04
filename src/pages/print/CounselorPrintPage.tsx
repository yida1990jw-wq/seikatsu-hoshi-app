import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppData } from '../../context/AppDataContext'
import { PrintToolbar } from '../../components/PrintToolbar'
import { memberDisplayName } from '../../lib/candidates'
import { computeEndTimesMinutes, formatClockTime } from '../../lib/schedule'
import { fetchRangeData, formatDateHeading, type RangeData } from '../../lib/printData'

export function CounselorPrintPage() {
  const { from, to } = useParams<{ from: string; to: string }>()
  const { settings, teachingPoints } = useAppData()
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
      {data.dates.map((date) => {
        const items = data.programsByDate.get(date) ?? []
        const endMins = computeEndTimesMinutes(settings.meeting_start_time, items)
        const studentItems = items
          .map((item, idx) => ({ item, endMin: endMins[idx] }))
          .filter(({ item }) => item.teaching_point_id)

        if (studentItems.length === 0) return null

        return (
          <div className="print-sheet counselor-sheet" key={date}>
            <h1 className="counselor-title">助言者用紙</h1>
            <h2 className="counselor-date">{formatDateHeading(date)}</h2>
            {studentItems.map(({ item, endMin }) => {
              const assignment = data.assignmentByProgramId.get(item.id)
              const teachingPoint = item.teaching_point_id
                ? teachingPoints.find((t) => t.id === item.teaching_point_id)
                : null

              return (
                <div className="counselor-item" key={item.id}>
                  <div className="counselor-item-heading">
                    {item.title ?? item.program_types?.name}
                    {item.duration_minutes ? `(${item.duration_minutes}分)` : ''}
                  </div>
                  {teachingPoint && (
                    <div className="counselor-item-point">
                      {teachingPoint.code} {teachingPoint.title}
                      {teachingPoint.page ? `(${teachingPoint.page})` : ''}
                    </div>
                  )}
                  {item.material && <div className="counselor-item-detail">{item.material}</div>}
                  {item.content && <div className="counselor-item-detail">{item.content}</div>}
                  <div className="counselor-item-presenter">
                    {assignment?.member && <div>{memberDisplayName(assignment.member)}</div>}
                    {assignment?.partner && <div>({memberDisplayName(assignment.partner)})</div>}
                    <div className="counselor-item-endtime">〜{formatClockTime(endMin)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
