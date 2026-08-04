import { Fragment, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppData } from '../../context/AppDataContext'
import { PrintToolbar } from '../../components/PrintToolbar'
import { memberDisplayName } from '../../lib/candidates'
import { fetchRangeData, findChairmanName, formatDateHeading, type RangeData } from '../../lib/printData'

export function AssignmentsRangePrintPage() {
  const { from, to } = useParams<{ from: string; to: string }>()
  const { programTypes, teachingPoints } = useAppData()
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
      <div className="print-sheet assignments-sheet">
        <h1>クリスチャンとしての生活と奉仕の集会の割り当て予定表</h1>
        <table className="assignments-table">
          <thead>
            <tr>
              <th>担当</th>
              <th>時間</th>
              <th>課題</th>
              <th>生徒</th>
              <th>相手</th>
            </tr>
          </thead>
          <tbody>
            {data.dates.map((date) => {
              const items = (data.programsByDate.get(date) ?? []).filter((item) => item.teaching_point_id)
              if (items.length === 0) return null
              const chairman = findChairmanName(data.programsByDate.get(date) ?? [], data.assignmentByProgramId, programTypes)

              return (
                <Fragment key={date}>
                  <tr className="assignments-week-header">
                    <td colSpan={4}>{formatDateHeading(date)}</td>
                    <td>{chairman ? `助言者: ${chairman}` : ''}</td>
                  </tr>
                  {items.map((item) => {
                    const assignment = data.assignmentByProgramId.get(item.id)
                    const teachingPoint = item.teaching_point_id
                      ? teachingPoints.find((t) => t.id === item.teaching_point_id)
                      : null
                    return (
                      <tr key={item.id}>
                        <td>{item.title ?? item.program_types?.name}</td>
                        <td>{item.duration_minutes ? `${item.duration_minutes}分` : ''}</td>
                        <td>{teachingPoint ? `${teachingPoint.code} ${teachingPoint.title}` : ''}</td>
                        <td>{assignment?.member ? memberDisplayName(assignment.member) : ''}</td>
                        <td>{assignment?.partner ? `(${memberDisplayName(assignment.partner)})` : ''}</td>
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
