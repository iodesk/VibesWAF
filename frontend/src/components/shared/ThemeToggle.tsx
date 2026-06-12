import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const opposite = theme === 'light' ? 'dark' : 'light'

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${opposite} mode`}
      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs rounded transition-colors text-[hsl(var(--color-sidebar-foreground))] sidebar-hover hover:text-[hsl(var(--color-sidebar-text))]"
    >
      {theme === 'light'
        ? <Sun size={14} data-icon="sun" className="shrink-0" />
        : <Moon size={14} data-icon="moon" className="shrink-0" />
      }
      <span>{theme === 'light' ? 'Light' : 'Dark'}</span>
    </button>
  )
}
