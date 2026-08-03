import type { Member, ProgramType } from '../types/domain'

export interface AssignmentHistoryRow {
  member_id: string | null
  partner_id: string | null
  program_date: string | null
  program_type_id: string | null
  /** ペアが主担当と異なる資格ルール(例: 会衆の聖書研究の朗読者)で入る場合の種別id */
  partner_program_type_id: string | null
}

/** memberId -> (programTypeId -> 直近の担当日) */
export type LastAssignedMap = Map<string, Map<string, string>>

export function buildLastAssignedMap(rows: AssignmentHistoryRow[]): LastAssignedMap {
  const map: LastAssignedMap = new Map()

  function record(memberId: string | null, typeId: string | null, date: string) {
    if (!memberId || !typeId) return
    let typeMap = map.get(memberId)
    if (!typeMap) {
      typeMap = new Map()
      map.set(memberId, typeMap)
    }
    const existing = typeMap.get(typeId)
    if (!existing || date > existing) {
      typeMap.set(typeId, date)
    }
  }

  for (const row of rows) {
    if (!row.program_date) continue
    record(row.member_id, row.program_type_id, row.program_date)
    record(row.partner_id, row.partner_program_type_id ?? row.program_type_id, row.program_date)
  }

  return map
}

export interface Candidate {
  member: Member
  lastAssignedDate: string | null
  /** 同じ日に他のプログラムへ割り当て済み(選択は可能、注意喚起のみ) */
  isDuplicateToday: boolean
}

interface GetCandidatesParams {
  members: Member[]
  programType: ProgramType
  lastAssignedMap: LastAssignedMap
  /** 同じ日に既に他のプログラムへ割り当て済みのメンバー。除外はせず、注意喚起の表示にのみ使う */
  duplicateMemberIds?: Set<string>
  /** ペア選定時、主担当と同性に絞る場合に指定 */
  requiredGender?: Member['gender']
}

/**
 * program_type の条件(立場・性別・特別承認)を満たし、かつ status=現役 のメンバーを候補として返す。
 * 直近このプログラム種別を担当していない順(未実施を最優先)に並べ、同日の重複がある候補は末尾に回す。
 */
export function getEligibleCandidates({
  members,
  programType,
  lastAssignedMap,
  duplicateMemberIds,
  requiredGender,
}: GetCandidatesParams): Candidate[] {
  const requiredPositions = programType.required_position ?? []
  const requiredQualification = programType.required_qualification

  const candidates = members
    .filter((m) => m.status === '現役')
    .filter((m) => requiredPositions.length === 0 || requiredPositions.includes(m.position))
    .filter((m) => !programType.required_gender || m.gender === programType.required_gender)
    .filter((m) => !requiredGender || m.gender === requiredGender)
    .filter(
      (m) =>
        !requiredQualification || (m.qualifications ?? []).includes(requiredQualification),
    )
    .map((member) => ({
      member,
      lastAssignedDate: lastAssignedMap.get(member.id)?.get(programType.id) ?? null,
      isDuplicateToday: duplicateMemberIds?.has(member.id) ?? false,
    }))

  candidates.sort((a, b) => {
    if (a.isDuplicateToday !== b.isDuplicateToday) return a.isDuplicateToday ? 1 : -1
    if (a.lastAssignedDate === b.lastAssignedDate) {
      return memberSortKey(a.member).localeCompare(memberSortKey(b.member), 'ja')
    }
    if (!a.lastAssignedDate) return -1
    if (!b.lastAssignedDate) return 1
    return a.lastAssignedDate.localeCompare(b.lastAssignedDate)
  })

  return candidates
}

function memberSortKey(member: Member): string {
  return `${member.last_name_kana ?? member.last_name}${member.first_name_kana ?? member.first_name}`
}

export function memberDisplayName(member: Member): string {
  return `${member.last_name} ${member.first_name}${member.honorific}`
}

export function formatLastAssigned(dateStr: string | null, today: Date = new Date()): string {
  if (!dateStr) return '初担当'
  const last = new Date(dateStr)
  const diffDays = Math.round((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
  const diffWeeks = Math.round(diffDays / 7)
  const formatted = last.toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' })
  if (diffWeeks <= 0) return `前回: ${formatted}`
  return `前回: ${formatted}(${diffWeeks}週間前)`
}
