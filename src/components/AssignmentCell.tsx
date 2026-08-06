import { useState } from 'react'
import type { Candidate } from '../lib/candidates'
import { memberDisplayName } from '../lib/candidates'
import type { Member } from '../types/domain'
import { CandidateCombobox } from './CandidateCombobox'

interface AssignmentCellProps {
  currentMember: Member | null | undefined
  candidates: Candidate[]
  onAssign: (memberId: string | null) => void
  saving?: boolean
  placeholder?: string
  isDuplicateToday?: boolean
  nearOneWeek?: boolean
  nearTwoWeeks?: boolean
  proximityLabel?: string
}

export function AssignmentCell({
  currentMember,
  candidates,
  onAssign,
  saving,
  placeholder = '未割当',
  isDuplicateToday,
  nearOneWeek,
  nearTwoWeeks,
  proximityLabel,
}: AssignmentCellProps) {
  const [open, setOpen] = useState(false)

  if (open) {
    return (
      <CandidateCombobox
        candidates={candidates}
        onClose={() => setOpen(false)}
        onSelect={(memberId) => {
          onAssign(memberId)
          setOpen(false)
        }}
      />
    )
  }

  // 優先度: 同日重複 > 前後1週 > 前後2週
  const proximityClass = !currentMember
    ? ''
    : isDuplicateToday
      ? 'assignment-duplicate'
      : nearOneWeek
        ? 'assignment-near-1w'
        : nearTwoWeeks
          ? 'assignment-near-2w'
          : ''

  // ラベルは色帯と同じ優先度でのみ表示する(同日重複の時は表示しない)
  const showLabel = !isDuplicateToday && (nearOneWeek || nearTwoWeeks) && !!proximityLabel

  return (
    <button
      type="button"
      className={`assignment-value ${currentMember ? '' : 'assignment-empty'} ${proximityClass}`}
      onClick={() => setOpen(true)}
      disabled={saving}
    >
      {saving
        ? '保存中...'
        : currentMember
          ? `${memberDisplayName(currentMember)}${showLabel ? ` ${proximityLabel}` : ''}`
          : placeholder}
    </button>
  )
}
