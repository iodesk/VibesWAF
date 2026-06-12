import * as React from "react"

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (message: string, type: ToastType) => void
  removeToast: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const addToast = React.useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts(prev => [...prev, { id, message, type }])
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(toast => {
          const styles = {
            success: 'toast-success hover:opacity-90 shadow-none',
            error: 'toast-error hover:opacity-90 shadow-none',
            info: 'toast-info hover:opacity-90 shadow-none'
          }
          
          return (
            <div
              key={toast.id}
              className={`px-4 py-3 rounded text-sm font-medium animate-in ${styles[toast.type]}`}
            >
              {toast.message}
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
