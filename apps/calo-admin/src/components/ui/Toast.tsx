'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error'
interface Toast { id: number; message: string; type: ToastType }

const ToastContext = createContext<{ toast: (msg: string, type?: ToastType) => void }>({
  toast: () => {},
})

export function useToast() { return useContext(ToastContext) }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium',
            'animate-in slide-in-from-bottom-2 duration-200',
            t.type === 'success'
              ? 'bg-green-950 border-green-500/30 text-green-300'
              : 'bg-red-950 border-red-500/30 text-red-300'
          )}>
            {t.type === 'success'
              ? <CheckCircle size={16} />
              : <XCircle size={16} />}
            {t.message}
            <button onClick={() => setToasts(x => x.filter(i => i.id !== t.id))}>
              <X size={14} className="opacity-60 hover:opacity-100" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
