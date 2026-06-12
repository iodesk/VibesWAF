interface SegmentedControlProps {
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
  className?: string
}

export function SegmentedControl({ value, onValueChange, options, className }: SegmentedControlProps) {
  return (
    <div className={`inline-flex items-center rounded-lg bg-muted p-1 gap-1 ${className || ''}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onValueChange(option.value)}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
            value === option.value
              ? 'btn-primary text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

