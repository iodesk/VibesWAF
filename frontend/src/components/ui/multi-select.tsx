import { useState } from 'react'
import { X } from 'lucide-react'

interface MultiSelectProps {
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  type?: 'text' | 'number'
}

export function MultiSelect({ values, onChange, type = 'text' }: MultiSelectProps) {
  const [inputValue, setInputValue] = useState('')

  const handleAdd = () => {
    const trimmed = inputValue.trim()
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed])
      setInputValue('')
    }
  }

  const handleRemove = (value: string) => {
    onChange(values.filter((v) => v !== value))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
    // Backspace on empty input removes last value
    if (e.key === 'Backspace' && !inputValue && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 min-h-[36px] w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      {/* Selected Values as inline badges */}
      {values.map((value) => (
        <span
          key={value}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-xs"
        >
          {value}
          <button
            type="button"
            onClick={() => handleRemove(value)}
            className="hover:text-red-600 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      {/* Inline Input */}
      <input
        type={type}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={values.length === 0 ? 'Type value and press Enter...' : 'Add more...'}
        className="flex-1 min-w-[120px] outline-none bg-transparent text-sm"
      />
    </div>
  )
}
