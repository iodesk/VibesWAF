import * as React from "react"
import { createPortal } from "react-dom"

interface DialogContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue | undefined>(undefined)

export function Dialog({
  children,
  open,
  onOpenChange
}: {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen

  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen)
    }
    if (!isControlled) {
      setInternalOpen(newOpen)
    }
  }, [onOpenChange, isControlled])

  return (
    <DialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

export function DialogTrigger({
  children,
  asChild
}: {
  children: React.ReactNode
  asChild?: boolean
}) {
  const context = React.useContext(DialogContext)
  if (!context) throw new Error('DialogTrigger must be used within Dialog')

  const child = React.Children.only(children) as React.ReactElement<any>

  if (asChild) {
    const existingOnClick = child.props.onClick
    return React.cloneElement(child, {
      onClick: (e: React.MouseEvent) => {
        existingOnClick?.(e)
        context.onOpenChange(true)
      }
    })
  }

  return (
    <button onClick={() => context.onOpenChange(true)}>
      {children}
    </button>
  )
}

export function DialogContent({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) {
  const context = React.useContext(DialogContext)
  if (!context) throw new Error('DialogContent must be used within Dialog')

  if (!context.open) return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={() => context.onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0 pointer-events-none">
        <div
          className={`text-card-foreground rounded-lg max-h-[90vh] flex flex-col pointer-events-auto ${className || 'w-full max-w-xl'}`}
          style={{ backgroundColor: 'hsl(var(--color-card))', border: '1px solid hsl(var(--color-border))' }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </>,
    document.body
  )
}

export function DialogHeader({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`px-6 py-4 border-b border-border ${className || ''}`}>
      {children}
    </div>
  )
}

export function DialogTitle({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <h2 className={`text-lg font-semibold ${className || ''}`}>
      {children}
    </h2>
  )
}

export function DialogDescription({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p className={`text-sm text-muted-foreground mt-1 ${className || ''}`}>
      {children}
    </p>
  )
}

export function DialogFooter({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`px-6 py-4 border-t border-border flex items-center justify-end gap-2 ${className || ''}`}>
      {children}
    </div>
  )
}
