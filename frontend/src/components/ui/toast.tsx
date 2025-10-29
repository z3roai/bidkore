"use client"

import * as React from "react"
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ToastProps {
  id: string
  title?: string
  description?: string
  variant?: "default" | "success" | "error" | "warning" | "info"
  duration?: number
  onClose?: () => void
}

interface ToastContextValue {
  toasts: ToastProps[]
  addToast: (toast: Omit<ToastProps, "id">) => void
  removeToast: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([])

  const addToast = React.useCallback((toast: Omit<ToastProps, "id">) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast = { ...toast, id }
    
    setToasts((prev) => [...prev, newToast])

    // Auto remove after duration
    const duration = toast.duration ?? 5000
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    }
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

function ToastContainer({ 
  toasts, 
  onClose 
}: { 
  toasts: ToastProps[]
  onClose: (id: string) => void 
}) {
  return (
    <div className="fixed top-0 right-0 z-50 flex flex-col gap-2 p-4 w-full max-w-md pointer-events-none">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={() => onClose(toast.id)} />
      ))}
    </div>
  )
}

function Toast({ title, description, variant = "default", onClose }: ToastProps) {
  const variants = {
    default: {
      container: "bg-card border-border",
      icon: <Info className="size-5 text-primary" />
    },
    success: {
      container: "bg-card border-border",
      icon: <CheckCircle className="size-5 text-green-500" />
    },
    error: {
      container: "bg-card border-border",
      icon: <AlertCircle className="size-5 text-red-500" />
    },
    warning: {
      container: "bg-card border-border",
      icon: <AlertTriangle className="size-5 text-yellow-500" />
    },
    info: {
      container: "bg-card border-border",
      icon: <Info className="size-5 text-primary" />
    }
  }

  const config = variants[variant]

  return (
    <div
      className={cn(
        "pointer-events-auto w-full rounded-lg border p-4 shadow-lg transition-all",
        "animate-in slide-in-from-top-full duration-300",
        config.container
      )}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
        <div className="flex-1 space-y-1">
          {title && (
            <div className="text-sm font-semibold text-foreground">
              {title}
            </div>
          )}
          {description && (
            <div className="text-sm text-muted-foreground">
              {description}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close notification"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}

