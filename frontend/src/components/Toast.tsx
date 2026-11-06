import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'info'
type ToastFn = (message: string, type?: ToastType) => void

const ToastContext = createContext<ToastFn>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; type: ToastType; id: number } | null>(null)
  const show = useCallback<ToastFn>((message, type = 'success') => setToast({ message, type, id: Date.now() }), [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.type === 'error' ? 6000 : 3500)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && <div role="status" className={`toast toast-${toast.type}`} onClick={() => setToast(null)}>{toast.message}</div>}
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext)
