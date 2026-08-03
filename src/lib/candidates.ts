import type { Member, ProgramType } from '../types/domain'

export interface AssignmentHistoryRow {
  member_id: string | null
  partner_id: string | null
  program_date: string | null
  program_type_id: string | null
}

/** memberId -> (programTypeId -> 直近の担当日) */
export type LastAssignedMap = Map<string, Map<string, string>>

export function buildLastAssignedMap(rows: AssignmentHistoryRow[]): LastAssignedMap {
  const map: LastAssignedMap = new Map()

  for (const row of rows) {
    if (!row.program_date || !row.program_type_id) continue
    for (const memberId of [row.member_id, row.partner_id]) {
      if (!memberId) continue
      let typeMap = map.get(memberId)
      if (!typeMap) {
        typeMap = new Map()
        map.set(memberId, typeMap)
      }
      const existing = typeMap.get(row.program_type_id)
      if (!existing || row.program_date > existing) {
        typeMap.set(row.program_type_id, row.program_date)
      }
    }
  }

  return map
}

export interface Candidate {
  member: Member
  lastAssignedDate: string | null
}

interface GetCandidatesParams {
  members: Member[]
  programType: ProgramType
  lastAssignedMap: LastAssignedMap
  /** 同じ週内で既に他のプログラムに割り当て済みのメンバー(二重登板を避ける) */
  excludeMemberIds?: Set<string>
  /** ペア選定時、主担当と同性に絞る場合に指定 */
  requiredGender?: Member['gender']
}

/**
 * program_type の条件(立場・性別・特別承認)を満たし、かつ status=現役 のメンバーから
 * 同週の重複を除外した候補を返す。直近このプログラム種別を担当していない順(未実施を最優先)に並べる。
 */
export function getEligibleCandidates({
  members,
  programType,
  lastAssignedMap,
  excludeMemberIds,
  requiredGender,
}: GetCandidatesParams): Candidate[] {
  const requiredPositions = programType.required_position ?? []
  const requiredQualification = programType.required_qualification

  const candidates = members
    .filter((m) => m.status === '現役')
    .filter((m) => !excludeMemberIds?.has(m.id))
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
    }))

  candidates.sort((a, b) => {
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
