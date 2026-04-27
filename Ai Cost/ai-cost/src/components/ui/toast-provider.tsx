"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

function ToastItem({ id, message, type, onClose }: Toast & { onClose: (id: string) => void }) {
  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="w-4 h-4 text-[#10B981] shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-[#F43F5E] shrink-0" />,
    info: <Info className="w-4 h-4 text-[#38BDF8] shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0" />,
  };

  const borders: Record<ToastType, string> = {
    success: "border-[#10B981]/30",
    error: "border-[#F43F5E]/30",
    info: "border-[#38BDF8]/30",
    warning: "border-[#F59E0B]/30",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.92, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 340, damping: 28 }}
      className={`flex items-center gap-3 px-4 py-3 bg-[#111827]/95 backdrop-blur-md border ${borders[type]} rounded-xl shadow-2xl min-w-[280px] max-w-[380px]`}
    >
      {icons[type]}
      <p className="flex-1 text-sm text-[#F9FAFB] leading-snug">{message}</p>
      <button
        onClick={() => onClose(id)}
        className="text-[#6B7280] hover:text-[#D1D5DB] transition-colors ml-1"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 3500);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map(t => (
            <ToastItem key={t.id} {...t} onClose={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
