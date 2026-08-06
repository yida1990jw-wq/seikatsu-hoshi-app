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
}

export function AssignmentCell({
  currentMember,
  candidates,
  onAssign,
  saving,
  placeholder = '未割当',
  isDuplicateToday,
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

  const showDuplicate = !!currentMember && !!isDuplicateToday

  return (
    <button
      type="button"
      className={`assignment-value ${currentMember ? '' : 'assignment-empty'} ${showDuplicate ? 'assignment-duplicate' : ''}`}
      onClick={() => setOpen(true)}
      disabled={saving}
    >
      {saving ? '保存中...' : currentMember ? memberDisplayName(currentMember) : placeholder}
    </button>
  )
}
