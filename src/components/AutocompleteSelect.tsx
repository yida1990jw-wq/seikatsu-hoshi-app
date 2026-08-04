import { useEffect, useId, useState } from 'react'

interface Option {
  id: string
  label: string
}

interface AutocompleteSelectProps {
  options: Option[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
}

/**
 * 候補が多いselectの代わりに、入力しながら絞り込めるdatalist入力。
 * 表示ラベルが候補内で一意であることを前提に、入力テキストからidを解決する。
 */
export function AutocompleteSelect({ options, value, onChange, placeholder }: AutocompleteSelectProps) {
  const listId = useId()
  const [text, setText] = useState('')

  useEffect(() => {
    if (!value) {
      setText('')
      return
    }
    const opt = options.find((o) => o.id === value)
    setText(opt ? opt.label : '')
  }, [value, options])

  function handleChange(next: string) {
    setText(next)
    if (next.trim() === '') {
      onChange('')
      return
    }
    const match = options.find((o) => o.label === next)
    if (match) onChange(match.id)
  }

  return (
    <>
      <input list={listId} value={text} placeholder={placeholder} onChange={(e) => handleChange(e.target.value)} />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.id} value={o.label} />
        ))}
      </datalist>
    </>
  )
}
