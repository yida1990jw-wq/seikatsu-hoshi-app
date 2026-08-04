import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppData } from '../../context/AppDataContext'
import { PrintToolbar } from '../../components/PrintToolbar'
import { memberDisplayName } from '../../lib/candidates'
import { computeEndTimesMinutes, formatClockTime } from '../../lib/schedule'
import {
  fetchRangeData,
  formatDateHeading,
  sectionColor,
  sectionTextColor,
  type AssignmentWithRelations,
  type ProgramWithType,
  type RangeData,
} from '../../lib/printData'

function groupBySection(items: ProgramWithType[]): { section: string | null; items: ProgramWithType[] }[] {
  const groups: { section: string | null; items: ProgramWithType[] }[] = []
  for (const item of items) {
    const last = groups[groups.length - 1]
    if (last && last.section === item.section) {
      last.items.push(item)
    } else {
      groups.push({ section: item.section, items: [item] })
    }
  }
  return groups
}

function presenterLine(assignment: AssignmentWithRelations | undefined): string {
  if (!assignment?.member) return ''
  const main = memberDisplayName(assignment.member)
  return assignment.partner ? `${main}(${memberDisplayName(assignment.partner)})` : main
}

export function ChairmanPrintPage() {
  const { from, to } = useParams<{ from: string; to: string }>()
  const { settings } = useAppData()
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
        const groups = groupBySection(items)

        return (
          <div className="print-sheet chair-sheet" key={date}>
            <h1>プログラム司会進行用紙</h1>
            <h2 className="chair-date">{formatDateHeading(date)}</h2>
            {groups.map((group, gi) => (
              <div className="chair-section" key={gi}>
                {group.section && (
                  <div
                    className="chair-section-header"
                    style={{ background: sectionColor(group.section), color: sectionTextColor(group.section) }}
                  >
                    {group.section}
                  </div>
                )}
                {group.items.map((item) => {
                  const idx = items.indexOf(item)
                  const assignment = data.assignmentByProgramId.get(item.id)
                  const detail = [item.material, item.content].filter(Boolean).join(' ')
                  return (
                    <div className="chair-item" key={item.id}>
                      <div className="chair-item-row">
                        <span className="chair-item-title">{item.title ?? item.program_types?.name}</span>
                        <span className="chair-item-time">
                          {item.duration_minutes ? `${item.duration_minutes}分` : ''}
                          {' (〜'}
                          {formatClockTime(endMins[idx])}
                          {')'}
                        </span>
                      </div>
                      {detail && <div className="chair-item-detail">{detail}</div>}
                      {presenterLine(assignment) && (
                        <div className="chair-item-presenter">{presenterLine(assignment)}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )
      })}
      {data.dates.length === 0 && <p className="center-message">対象期間にプログラムがありません。</p>}
    </div>
  )
}
