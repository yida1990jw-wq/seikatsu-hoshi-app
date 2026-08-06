import { useEffect, useMemo, useRef, useState } from 'react'
import type { Candidate } from '../lib/candidates'
import { formatLastAssigned, memberDisplayName } from '../lib/candidates'

interface CandidateComboboxProps {
  candidates: Candidate[]
  referenceDate: string
  onSelect: (memberId: string | null) => void
  onClose: () => void
  allowClear?: boolean
}

export function CandidateCombobox({
  candidates,
  referenceDate,
  onSelect,
  onClose,
  allowClear = true,
}: CandidateComboboxProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return candidates
    return candidates.filter(({ member }) => {
      const haystack = `${member.last_name}${member.first_name}${member.last_name_kana ?? ''}${member.first_name_kana ?? ''}${member.honorific}`
      return haystack.includes(q)
    })
  }, [candidates, query])

  return (
    <div className="candidate-combobox" ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        placeholder="名前で検索..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
      />
      <ul className="candidate-list">
        {allowClear && (
          <li>
            <button type="button" className="candidate-clear" onClick={() => onSelect(null)}>
              未割当にする
            </button>
          </li>
        )}
        {filtered.length === 0 && <li className="candidate-empty">該当する候補者がいません</li>}
        {filtered.map((c) => (
          <li key={c.member.id}>
            <button
              type="button"
              className={c.isDuplicateToday ? 'candidate-duplicate' : ''}
              onClick={() => onSelect(c.member.id)}
            >
              <span className={`candidate-name ${c.previouslyPaired ? 'candidate-name-paired' : ''}`}>
                {memberDisplayName(c.member)}
              </span>
              <span className="candidate-meta">
                {c.isDuplicateToday && <span className="candidate-warning">⚠ 本日他の担当あり</span>}
                {formatLastAssigned(c.lastAssignedDate, c.lastAssignedType, referenceDate)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
