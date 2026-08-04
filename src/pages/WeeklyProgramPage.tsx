import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAppData } from '../context/AppDataContext'
import { getEligibleCandidates } from '../lib/candidates'
import { AssignmentCell } from '../components/AssignmentCell'
import type { Assignment, Member, Program, ProgramType, Song, TeachingPoint, Venue } from '../types/domain'

type ProgramWithType = Program & { program_types: ProgramType | null }
type AssignmentWithRelations = Assignment & {
  member: Member | null
  partner: Member | null
  venue: Venue | null
}

interface ProgramDraft {
  section: string
  program_type_id: string
  title: string
  duration_minutes: string
  material: string
  content: string
  song_id: string
  teaching_point_id: string
}

const EMPTY_DRAFT: ProgramDraft = {
  section: '',
  program_type_id: '',
  title: '',
  duration_minutes: '',
  material: '',
  content: '',
  song_id: '',
  teaching_point_id: '',
}

const SECTION_PRESETS = [
  '開会',
  '神の言葉の宝',
  '野外奉仕に励む',
  '伝道を楽しもう',
  'クリスチャンとして生活する',
  '閉会',
]

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function WeeklyProgramPage() {
  const {
    members,
    venues,
    programTypes,
    songs,
    teachingPoints,
    lastAssignedMap,
    loading: appDataLoading,
    error: appDataError,
    refetchHistory,
  } = useAppData()

  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [programs, setPrograms] = useState<ProgramWithType[]>([])
  const [assignments, setAssignments] = useState<AssignmentWithRelations[]>([])
  const [loadingWeek, setLoadingWeek] = useState(false)
  const [savingProgramId, setSavingProgramId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [savingChairman, setSavingChairman] = useState(false)
  const [manageMode, setManageMode] = useState(false)
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ProgramDraft>(EMPTY_DRAFT)
  const [newRow, setNewRow] = useState<ProgramDraft>(EMPTY_DRAFT)

  const loadAvailableDates = useCallback(async () => {
    const { data, error } = await supabase.from('programs').select('date').order('date', { ascending: true })
    if (error) {
      setError(error.message)
      return [] as string[]
    }
    const dates = Array.from(new Set((data ?? []).map((r) => r.date))).sort()
    setAvailableDates(dates)
    return dates
  }, [])

  useEffect(() => {
    loadAvailableDates().then((dates) => {
      const today = todayStr()
      const upcoming = dates.find((d) => d >= today)
      setSelectedDate(upcoming ?? dates[dates.length - 1] ?? today)
    })
  }, [loadAvailableDates])

  const loadWeek = useCallback(async (date: string) => {
    setLoadingWeek(true)
    setError(null)
    try {
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select('*, program_types(*)')
        .eq('date', date)
        .order('order_no', { ascending: true })
        .returns<ProgramWithType[]>()

      if (programError) throw programError
      setPrograms(programData ?? [])

      const programIds = (programData ?? []).map((p) => p.id)
      if (programIds.length === 0) {
        setAssignments([])
        return
      }

      const { data: assignmentData, error: assignmentError } = await supabase
        .from('assignments')
        .select('*, member:members!member_id(*), partner:members!partner_id(*), venue:venues(*)')
        .in('program_id', programIds)
        .returns<AssignmentWithRelations[]>()

      if (assignmentError) throw assignmentError
      setAssignments(assignmentData ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '不明なエラーが発生しました')
    } finally {
      setLoadingWeek(false)
    }
  }, [])

  useEffect(() => {
    if (selectedDate) loadWeek(selectedDate)
  }, [selectedDate, loadWeek])

  function goPrev() {
    if (!selectedDate) return
    const candidates = availableDates.filter((d) => d < selectedDate)
    if (candidates.length > 0) setSelectedDate(candidates[candidates.length - 1])
  }

  function goNext() {
    if (!selectedDate) return
    const next = availableDates.find((d) => d > selectedDate)
    if (next) setSelectedDate(next)
  }

  const programTypesById = useMemo(() => new Map(programTypes.map((pt) => [pt.id, pt])), [programTypes])

  const duplicateSetFor = useMemo(() => {
    return (programId: string, slot: 'member_id' | 'partner_id') => {
      const set = new Set<string>()
      for (const a of assignments) {
        for (const field of ['member_id', 'partner_id'] as const) {
          const val = a[field]
          if (!val) continue
          if (a.program_id === programId && field === slot) continue
          set.add(val)
        }
      }
      return set
    }
  }, [assignments])

  async function upsertAssignment(
    programId: string,
    patch: Partial<Pick<Assignment, 'member_id' | 'partner_id' | 'venue_id'>>,
  ) {
    setSavingProgramId(programId)
    setError(null)
    try {
      const existing = assignments.find((a) => a.program_id === programId)
      if (existing) {
        const { error } = await supabase.from('assignments').update(patch).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('assignments').insert({ program_id: programId, ...patch })
        if (error) throw error
      }
      if (selectedDate) await loadWeek(selectedDate)
      await refetchHistory()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSavingProgramId(null)
    }
  }

  function draftToPatch(d: ProgramDraft) {
    return {
      section: d.section.trim() || null,
      program_type_id: d.program_type_id || null,
      title: d.title.trim() || null,
      duration_minutes: d.duration_minutes ? Number(d.duration_minutes) : null,
      material: d.material.trim() || null,
      content: d.content.trim() || null,
      song_id: d.song_id || null,
      teaching_point_id: d.teaching_point_id || null,
    }
  }

  function startEdit(program: ProgramWithType) {
    setEditingProgramId(program.id)
    setDraft({
      section: program.section ?? '',
      program_type_id: program.program_type_id ?? '',
      title: program.title ?? '',
      duration_minutes: program.duration_minutes?.toString() ?? '',
      material: program.material ?? '',
      content: program.content ?? '',
      song_id: program.song_id ?? '',
      teaching_point_id: program.teaching_point_id ?? '',
    })
  }

  function cancelEdit() {
    setEditingProgramId(null)
    setDraft(EMPTY_DRAFT)
  }

  async function saveEdit() {
    if (!editingProgramId) return
    setError(null)
    try {
      const { error } = await supabase.from('programs').update(draftToPatch(draft)).eq('id', editingProgramId)
      if (error) throw error
      cancelEdit()
      if (selectedDate) await loadWeek(selectedDate)
      await refetchHistory()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    }
  }

  async function handleAddProgram(e: FormEvent) {
    e.preventDefault()
    if (!selectedDate) return
    setError(null)
    try {
      const maxOrder = programs.reduce((max, p) => Math.max(max, p.order_no ?? 0), 0)
      const { data: created, error } = await supabase
        .from('programs')
        .insert({
          date: selectedDate,
          order_no: maxOrder + 1,
          ...draftToPatch(newRow),
        })
        .select()
        .single()
      if (error) throw error

      const defaultVenue = venues.find((v) => v.name === '本会場') ?? venues[0]
      if (created && defaultVenue) {
        const { error: assignmentError } = await supabase
          .from('assignments')
          .insert({ program_id: created.id, venue_id: defaultVenue.id })
        if (assignmentError) throw assignmentError
      }

      setNewRow(EMPTY_DRAFT)
      await loadWeek(selectedDate)
      await loadAvailableDates()
    } catch (e) {
      setError(e instanceof Error ? e.message : '追加に失敗しました')
    }
  }

  async function handleDeleteProgram(program: ProgramWithType) {
    if (!window.confirm(`「${program.title ?? program.program_types?.name ?? 'このプログラム'}」を削除しますか?`)) {
      return
    }
    setError(null)
    try {
      const { error: deleteAssignmentError } = await supabase
        .from('assignments')
        .delete()
        .eq('program_id', program.id)
      if (deleteAssignmentError) throw deleteAssignmentError

      const { error: deleteProgramError } = await supabase.from('programs').delete().eq('id', program.id)
      if (deleteProgramError) throw deleteProgramError

      if (selectedDate) await loadWeek(selectedDate)
      await loadAvailableDates()
      await refetchHistory()
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除に失敗しました')
    }
  }

  async function moveProgram(program: ProgramWithType, direction: -1 | 1) {
    const sorted = [...programs].sort((a, b) => (a.order_no ?? 0) - (b.order_no ?? 0))
    const index = sorted.findIndex((p) => p.id === program.id)
    const neighborIndex = index + direction
    if (neighborIndex < 0 || neighborIndex >= sorted.length) return
    const neighbor = sorted[neighborIndex]

    setError(null)
    try {
      const [{ error: e1 }, { error: e2 }] = await Promise.all([
        supabase.from('programs').update({ order_no: neighbor.order_no }).eq('id', program.id),
        supabase.from('programs').update({ order_no: program.order_no }).eq('id', neighbor.id),
      ])
      if (e1) throw e1
      if (e2) throw e2
      if (selectedDate) await loadWeek(selectedDate)
    } catch (e) {
      setError(e instanceof Error ? e.message : '並べ替えに失敗しました')
    }
  }

  if (appDataLoading) return <div className="center-message">データを読み込み中...</div>
  if (appDataError) return <div className="center-message error-text">{appDataError}</div>

  const sortedPrograms = [...programs].sort((a, b) => (a.order_no ?? 0) - (b.order_no ?? 0))

  const openingType = programTypes.find((pt) => pt.name === '開会の言葉')
  const closingType = programTypes.find((pt) => pt.name === '閉会の言葉')
  const openingProgram = openingType ? programs.find((p) => p.program_type_id === openingType.id) : undefined
  const closingProgram = closingType ? programs.find((p) => p.program_type_id === closingType.id) : undefined
  const chairman = openingProgram
    ? assignments.find((a) => a.program_id === openingProgram.id)?.member
    : undefined
  const chairmanCandidates = openingType
    ? getEligibleCandidates({
        members,
        programType: openingType,
        lastAssignedMap,
        duplicateMemberIds: openingProgram ? duplicateSetFor(openingProgram.id, 'member_id') : new Set(),
      })
    : []

  async function handleAssignChairman(memberId: string | null) {
    setSavingChairman(true)
    if (openingProgram) await upsertAssignment(openingProgram.id, { member_id: memberId })
    if (closingProgram) await upsertAssignment(closingProgram.id, { member_id: memberId })
    setSavingChairman(false)
  }

  function findSong(id: string | null): Song | undefined {
    return id ? songs.find((s) => s.id === id) : undefined
  }

  function findTeachingPoint(id: string | null): TeachingPoint | undefined {
    return id ? teachingPoints.find((t) => t.id === id) : undefined
  }

  function renderProgramDetails(program: ProgramWithType) {
    const song = findSong(program.song_id)
    const teachingPoint = findTeachingPoint(program.teaching_point_id)
    return (
      <>
        {program.material && <div className="program-detail">資料: {program.material}</div>}
        {program.content && <div className="program-detail">{program.content}</div>}
        {song && (
          <div className="program-detail">
            {song.number}番 {song.title}
          </div>
        )}
        {teachingPoint && <div className="program-detail">教励課題: {teachingPoint.title}</div>}
      </>
    )
  }

  return (
    <div className="page">
      <h1>週ごとのプログラム</h1>

      <div className="date-nav">
        <button type="button" onClick={goPrev} disabled={!availableDates.some((d) => selectedDate && d < selectedDate)}>
          ← 前週
        </button>
        <input
          type="date"
          value={selectedDate ?? ''}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
        {selectedDate && (
          <span className="date-nav-label">{formatDateLabel(selectedDate)}</span>
        )}
        <button type="button" onClick={goNext} disabled={!availableDates.some((d) => selectedDate && d > selectedDate)}>
          次週 →
        </button>

        {!manageMode && (openingProgram || closingProgram) && (
          <div className="chairman-field">
            <span className="chairman-label">司会者:</span>
            <AssignmentCell
              currentMember={chairman}
              candidates={chairmanCandidates}
              saving={savingChairman}
              placeholder="未選択"
              onAssign={handleAssignChairman}
            />
          </div>
        )}

        <button type="button" className="manage-toggle" onClick={() => setManageMode((m) => !m)}>
          {manageMode ? '割当画面に戻る' : 'プログラムを編集'}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loadingWeek ? (
        <div className="center-message">読み込み中...</div>
      ) : (
        <table className="program-table">
          <thead>
            <tr>
              <th>区分</th>
              <th>プログラム</th>
              <th>時間</th>
              {manageMode ? (
                <th>操作</th>
              ) : (
                <>
                  <th>担当者</th>
                  <th>ペア</th>
                  <th>会場</th>
                  <th>スリップ</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedPrograms.map((program, index) => {
              const programType = program.program_types
              const assignment = assignments.find((a) => a.program_id === program.id)
              const saving = savingProgramId === program.id
              const isEditing = editingProgramId === program.id

              if (manageMode) {
                if (isEditing) {
                  return (
                    <tr key={program.id}>
                      <td>
                        <input
                          list="section-options"
                          value={draft.section}
                          onChange={(e) => setDraft((d) => ({ ...d, section: e.target.value }))}
                        />
                      </td>
                      <td>
                        <select
                          value={draft.program_type_id}
                          onChange={(e) => setDraft((d) => ({ ...d, program_type_id: e.target.value }))}
                        >
                          <option value="">(種別未設定)</option>
                          {programTypes.map((pt) => (
                            <option key={pt.id} value={pt.id}>
                              {pt.name}
                            </option>
                          ))}
                        </select>
                        <input
                          placeholder="タイトル(任意)"
                          value={draft.title}
                          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                        />
                        <input
                          placeholder="資料(任意)"
                          value={draft.material}
                          onChange={(e) => setDraft((d) => ({ ...d, material: e.target.value }))}
                        />
                        <input
                          placeholder="内容(任意)"
                          value={draft.content}
                          onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
                        />
                        <select
                          value={draft.song_id}
                          onChange={(e) => setDraft((d) => ({ ...d, song_id: e.target.value }))}
                        >
                          <option value="">(歌なし)</option>
                          {songs.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.number}番 {s.title}
                            </option>
                          ))}
                        </select>
                        <select
                          value={draft.teaching_point_id}
                          onChange={(e) => setDraft((d) => ({ ...d, teaching_point_id: e.target.value }))}
                        >
                          <option value="">(教励課題なし)</option>
                          {teachingPoints.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.code} {t.title}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          value={draft.duration_minutes}
                          onChange={(e) => setDraft((d) => ({ ...d, duration_minutes: e.target.value }))}
                        />
                      </td>
                      <td className="row-actions">
                        <button type="button" onClick={saveEdit}>
                          保存
                        </button>
                        <button type="button" onClick={cancelEdit}>
                          取消
                        </button>
                      </td>
                    </tr>
                  )
                }

                return (
                  <tr key={program.id}>
                    <td>{program.section ?? ''}</td>
                    <td>
                      <div className="program-title">{program.title ?? programType?.name}</div>
                      {programType && <div className="program-type-name">{programType.name}</div>}
                      {renderProgramDetails(program)}
                    </td>
                    <td>{program.duration_minutes ? `${program.duration_minutes}分` : ''}</td>
                    <td className="row-actions">
                      <button type="button" onClick={() => moveProgram(program, -1)} disabled={index === 0}>
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveProgram(program, 1)}
                        disabled={index === sortedPrograms.length - 1}
                      >
                        ↓
                      </button>
                      <button type="button" onClick={() => startEdit(program)}>
                        編集
                      </button>
                      <button type="button" onClick={() => handleDeleteProgram(program)}>
                        削除
                      </button>
                    </td>
                  </tr>
                )
              }

              const memberDuplicateSet = programType ? duplicateSetFor(program.id, 'member_id') : new Set<string>()
              const partnerDuplicateSet = programType?.needs_partner
                ? duplicateSetFor(program.id, 'partner_id')
                : new Set<string>()

              const memberCandidates = programType
                ? getEligibleCandidates({
                    members,
                    programType,
                    lastAssignedMap,
                    duplicateMemberIds: memberDuplicateSet,
                  })
                : []

              const partnerProgramType = programType?.partner_program_type_id
                ? (programTypesById.get(programType.partner_program_type_id) ?? programType)
                : programType

              const partnerCandidates =
                programType?.needs_partner && partnerProgramType
                  ? getEligibleCandidates({
                      members,
                      programType: partnerProgramType,
                      lastAssignedMap,
                      duplicateMemberIds: partnerDuplicateSet,
                      requiredGender: programType.partner_same_gender ? assignment?.member?.gender : undefined,
                    })
                  : []

              return (
                <tr key={program.id}>
                  <td>{program.section ?? ''}</td>
                  <td>
                    <div className="program-title">{program.title ?? programType?.name}</div>
                    {programType && <div className="program-type-name">{programType.name}</div>}
                    {renderProgramDetails(program)}
                  </td>
                  <td>{program.duration_minutes ? `${program.duration_minutes}分` : ''}</td>
                  <td>
                    {programType ? (
                      <AssignmentCell
                        currentMember={assignment?.member}
                        candidates={memberCandidates}
                        saving={saving}
                        isDuplicateToday={!!assignment?.member && memberDuplicateSet.has(assignment.member.id)}
                        onAssign={(memberId) => upsertAssignment(program.id, { member_id: memberId })}
                      />
                    ) : (
                      <span className="assignment-disabled">未設定のプログラム種別</span>
                    )}
                  </td>
                  <td>
                    {programType?.needs_partner ? (
                      <AssignmentCell
                        currentMember={assignment?.partner}
                        candidates={partnerCandidates}
                        saving={saving}
                        isDuplicateToday={!!assignment?.partner && partnerDuplicateSet.has(assignment.partner.id)}
                        onAssign={(memberId) => upsertAssignment(program.id, { partner_id: memberId })}
                      />
                    ) : (
                      <span className="assignment-disabled">-</span>
                    )}
                  </td>
                  <td>
                    <select
                      value={assignment?.venue_id ?? ''}
                      disabled={saving}
                      onChange={(e) => upsertAssignment(program.id, { venue_id: e.target.value || null })}
                    >
                      <option value="">未設定</option>
                      {venues.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {assignment?.id && (
                      <Link to={`/print/slip/${assignment.id}`} target="_blank" rel="noopener noreferrer">
                        印刷
                      </Link>
                    )}
                  </td>
                </tr>
              )
            })}

            {manageMode && selectedDate && (
              <tr>
                <td>
                  <input
                    list="section-options"
                    placeholder="区分"
                    value={newRow.section}
                    onChange={(e) => setNewRow((d) => ({ ...d, section: e.target.value }))}
                  />
                </td>
                <td>
                  <select
                    value={newRow.program_type_id}
                    onChange={(e) => setNewRow((d) => ({ ...d, program_type_id: e.target.value }))}
                  >
                    <option value="">(種別未設定)</option>
                    {programTypes.map((pt) => (
                      <option key={pt.id} value={pt.id}>
                        {pt.name}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="タイトル(任意)"
                    value={newRow.title}
                    onChange={(e) => setNewRow((d) => ({ ...d, title: e.target.value }))}
                  />
                  <input
                    placeholder="資料(任意)"
                    value={newRow.material}
                    onChange={(e) => setNewRow((d) => ({ ...d, material: e.target.value }))}
                  />
                  <input
                    placeholder="内容(任意)"
                    value={newRow.content}
                    onChange={(e) => setNewRow((d) => ({ ...d, content: e.target.value }))}
                  />
                  <select
                    value={newRow.song_id}
                    onChange={(e) => setNewRow((d) => ({ ...d, song_id: e.target.value }))}
                  >
                    <option value="">(歌なし)</option>
                    {songs.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.number}番 {s.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newRow.teaching_point_id}
                    onChange={(e) => setNewRow((d) => ({ ...d, teaching_point_id: e.target.value }))}
                  >
                    <option value="">(教励課題なし)</option>
                    {teachingPoints.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} {t.title}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    placeholder="分"
                    value={newRow.duration_minutes}
                    onChange={(e) => setNewRow((d) => ({ ...d, duration_minutes: e.target.value }))}
                  />
                </td>
                <td className="row-actions">
                  <button type="button" onClick={handleAddProgram}>
                    + 追加
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {!manageMode && !loadingWeek && sortedPrograms.length === 0 && (
        <p className="center-message">
          この日のプログラムは登録されていません。「プログラムを編集」から追加できます。
        </p>
      )}

      <datalist id="section-options">
        {SECTION_PRESETS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  )
}
