import type { Member, ProgramType } from '../types/domain'

export interface AssignmentHistoryRow {
  member_id: string | null
  partner_id: string | null
  program_date: string | null
  program_type_id: string | null
  /** ペアが主担当と異なる資格ルール(例: 会衆の聖書研究の朗読者)で入る場合の種別id */
  partner_program_type_id: string | null
  /** その回のプログラムに課題(教励課題)が設定されていたか */
  has_teaching_point: boolean
  /** そのプログラムの種別名(表示用) */
  program_type_name: string | null
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

export interface LastTeachingAssignment {
  date: string
  typeName: string
}

/** memberId -> 課題(教励課題)付きプログラムに最後に割り当てられた日付と種別名(会話を始める等) */
export type LastTeachingAssignmentMap = Map<string, LastTeachingAssignment>

export function buildLastTeachingAssignmentMap(rows: AssignmentHistoryRow[]): LastTeachingAssignmentMap {
  const map: LastTeachingAssignmentMap = new Map()

  function record(memberId: string | null) {
    if (!memberId) return
    const row = current
    if (!row.program_date || !row.program_type_name) return
    const existing = map.get(memberId)
    if (!existing || row.program_date > existing.date) {
      map.set(memberId, { date: row.program_date, typeName: row.program_type_name })
    }
  }

  let current: AssignmentHistoryRow
  for (const row of rows) {
    if (!row.has_teaching_point) continue
    current = row
    record(row.member_id)
    record(row.partner_id)
  }

  return map
}

/** memberId -> 過去にペアを組んだことがある相手memberIdの集合 */
export type PairingMap = Map<string, Set<string>>

export function buildPairingMap(rows: AssignmentHistoryRow[]): PairingMap {
  const map: PairingMap = new Map()

  function link(a: string, b: string) {
    let set = map.get(a)
    if (!set) {
      set = new Set()
      map.set(a, set)
    }
    set.add(b)
  }

  for (const row of rows) {
    if (row.member_id && row.partner_id) {
      link(row.member_id, row.partner_id)
      link(row.partner_id, row.member_id)
    }
  }

  return map
}

export interface Candidate {
  member: Member
  lastAssignedDate: string | null
  /** broadRecencyMapを使った場合、その最終担当のプログラム種別名 */
  lastAssignedType?: string | null
  /** 同じ日に他のプログラムへ割り当て済み(選択は可能、注意喚起のみ) */
  isDuplicateToday: boolean
  /** 指定した主担当者と過去にペアを組んだことがある(除外はせず表示のみで区別) */
  previouslyPaired: boolean
}

interface GetCandidatesParams {
  members: Member[]
  programType: ProgramType
  lastAssignedMap: LastAssignedMap
  /** 同じ日に既に他のプログラムへ割り当て済みのメンバー。除外はせず、注意喚起の表示にのみ使う */
  duplicateMemberIds?: Set<string>
  /** ペア選定時、主担当と同性に絞る場合に指定 */
  requiredGender?: Member['gender']
  /** 指定時、直近の担当履歴をこのプログラム種別に限定せず、課題付きプログラム全体から探す(ペア選定用) */
  broadRecencyMap?: LastTeachingAssignmentMap
  /** ペアの優先順位付け用: 現在の主担当者id。過去にこの人とペアだった候補は優先度を下げる(除外はしない) */
  pairingMap?: PairingMap
  currentMemberId?: string | null
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
  broadRecencyMap,
  pairingMap,
  currentMemberId,
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
    .map((member) => {
      const broad = broadRecencyMap?.get(member.id)
      return {
        member,
        lastAssignedDate: broad ? broad.date : (lastAssignedMap.get(member.id)?.get(programType.id) ?? null),
        lastAssignedType: broad ? broad.typeName : null,
        isDuplicateToday: duplicateMemberIds?.has(member.id) ?? false,
        previouslyPaired: currentMemberId ? (pairingMap?.get(member.id)?.has(currentMemberId) ?? false) : false,
      }
    })

  candidates.sort((a, b) => {
    if (a.isDuplicateToday !== b.isDuplicateToday) return a.isDuplicateToday ? 1 : -1
    if (a.previouslyPaired !== b.previouslyPaired) return a.previouslyPaired ? 1 : -1
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

export function formatLastAssigned(
  dateStr: string | null,
  typeName?: string | null,
  today: Date = new Date(),
): string {
  if (!dateStr) return '初担当'
  const last = new Date(dateStr)
  const diffDays = Math.round((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
  const diffWeeks = Math.round(diffDays / 7)
  const formatted = last.toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' })
  const period = diffWeeks <= 0 ? formatted : `${formatted}(${diffWeeks}週間前)`
  return typeName ? `前回: ${period}・${typeName}` : `前回: ${period}`
}
