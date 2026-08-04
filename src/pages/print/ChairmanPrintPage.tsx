import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppData } from '../../context/AppDataContext'
import { PrintToolbar } from '../../components/PrintToolbar'
import { memberDisplayName } from '../../lib/candidates'
import { computeEndTimesMinutes, formatClockTime } from '../../lib/schedule'
import {
  fetchRangeData,
  formatDateHeading,
  hasSectionBand,
  sectionColor,
  sectionTextColor,
  type AssignmentWithRelations,
  type ProgramWithType,
  type RangeData,
} from '../../lib/printData'
import type { Song } from '../../types/domain'

interface ItemRow {
  item: ProgramWithType
  endMin: number
}

function groupBySection(rows: ItemRow[]): { section: string | null; rows: ItemRow[] }[] {
  const groups: { section: string | null; rows: ItemRow[] }[] = []
  for (const row of rows) {
    const last = groups[groups.length - 1]
    if (last && last.section === row.item.section) {
      last.rows.push(row)
    } else {
      groups.push({ section: row.item.section, rows: [row] })
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
  const { settings, songs } = useAppData()
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

  function findSong(item: ProgramWithType): Song | undefined {
    return item.song_id ? songs.find((s) => s.id === item.song_id) : undefined
  }

  return (
    <div>
      <PrintToolbar backTo="/reports" />
      {data.dates.map((date) => {
        const items = data.programsByDate.get(date) ?? []
        const endMins = computeEndTimesMinutes(settings.meeting_start_time, items)
        const rows: ItemRow[] = items.map((item, idx) => ({ item, endMin: endMins[idx] }))
        const groups = groupBySection(rows)
        let rowIndex = 0

        return (
          <div className="print-sheet chair-sheet" key={date}>
            <h1>プログラム司会進行用紙</h1>
            <h2 className="chair-date">{formatDateHeading(date)}</h2>
            {groups.map((group, gi) => (
              <div className="chair-section" key={gi}>
                {hasSectionBand(group.section) && (
                  <div
                    className="chair-section-header"
                    style={{ background: sectionColor(group.section), color: sectionTextColor(group.section) }}
                  >
                    {group.section}
                  </div>
                )}
                {group.rows.map(({ item, endMin }) => {
                  const assignment = data.assignmentByProgramId.get(item.id)
                  const song = findSong(item)
                  const title = song
                    ? `${song.number}番の${item.title ?? item.program_types?.name}`
                    : (item.title ?? item.program_types?.name)
                  const songDetail = song ? `${song.title}${song.scripture ?? ''}` : null
                  const detail = [item.material, item.content].filter(Boolean).join(' ')
                  const isStripe = rowIndex % 2 === 1
                  rowIndex += 1
                  return (
                    <div className={`chair-item ${isStripe ? 'chair-item-stripe' : ''}`} key={item.id}>
                      <div className="chair-item-row">
                        <span className="chair-item-title">{title}</span>
                        <span className="chair-item-time">
                          {item.duration_minutes ? `${item.duration_minutes}分` : ''}
                          {' (〜'}
                          {formatClockTime(endMin)}
                          {')'}
                        </span>
                      </div>
                      {songDetail && <div className="chair-item-detail">{songDetail}</div>}
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
