interface LegendItemProps {
  color: string
  label: string
  active?: boolean
  onClick?: () => void
}

export function LegendItem({ color, label, active = true, onClick }: LegendItemProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 transition-all ${active ? 'opacity-100' : 'opacity-35'}`}
    >
      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span className={`text-[11px] font-medium uppercase tracking-wide ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </button>
  )
}
