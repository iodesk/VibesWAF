import { useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface Tab {
  value: string
  label: string
  icon?: React.ReactNode
  disabled?: boolean
  disabledTooltip?: string
}

interface TabsProps {
  value: string
  onValueChange: (value: string) => void
  tabs: Tab[]
  className?: string
  orientation?: 'horizontal' | 'vertical'
}

export function Tabs({ value, onValueChange, tabs, className, orientation = 'horizontal' }: TabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      ro.disconnect()
    }
  }, [tabs])

  if (orientation === 'vertical') {
    return (
      <div
        className={cn("flex flex-col gap-0.5 p-1 bg-muted rounded-lg border border-border", className)}
      >
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => !tab.disabled && onValueChange(tab.value)}
            disabled={tab.disabled}
            title={tab.disabled && tab.disabledTooltip ? tab.disabledTooltip : undefined}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded text-xs font-semibold transition-all duration-150 whitespace-nowrap text-left w-full",
              value === tab.value
                ? "btn-primary hover:opacity-90 shadow-none text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50",
              tab.disabled && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="relative">
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-6 z-10 pointer-events-none bg-gradient-to-r from-muted to-transparent rounded-l" />
      )}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 w-6 z-10 pointer-events-none bg-gradient-to-l from-muted to-transparent rounded-r" />
      )}
      <div
        ref={scrollRef}
        className={cn("flex gap-0.5 p-1 bg-muted rounded-lg overflow-x-auto border border-border", className)}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => !tab.disabled && onValueChange(tab.value)}
            disabled={tab.disabled}
            title={tab.disabled && tab.disabledTooltip ? tab.disabledTooltip : undefined}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all duration-150 flex-shrink-0 whitespace-nowrap",
              value === tab.value
                ? "btn-primary hover:opacity-90 shadow-none text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50",
              tab.disabled && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
