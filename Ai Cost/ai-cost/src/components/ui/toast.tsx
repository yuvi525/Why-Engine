"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";
import { useEffect } from "react";

export type ToastType = "success" | "error" | "info";

export interface ToastProps {
  id: string;
  message: string;
  type?: ToastType;
  onClose: (id: string) => void;
}

export function Toast({ id, message, type = "info", onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, 3000);
    return () => clearTimeout(timer);
  }, [id, onClose]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-[#10B981]" />,
    error: <AlertCircle className="w-5 h-5 text-[#F43F5E]" />,
    info: <Info className="w-5 h-5 text-[#38BDF8]" />
  };

  const borderColors = {
    success: "border-[#10B981]/30",
    error: "border-[#F43F5E]/30",
    info: "border-[#38BDF8]/30"
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className={`flex items-center gap-3 px-4 py-3 bg-[#111827] border ${borderColors[type]} rounded-xl shadow-lg backdrop-blur-md min-w-[300px] max-w-md`}
    >
      {icons[type]}
      <p className="flex-1 text-sm text-[#F9FAFB]">{message}</p>
      <button onClick={() => onClose(id)} className="text-[#9CA3AF] hover:text-white transition-colors">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

// Simple toast provider/manager would wrap app, but we export a standalone component
// For Prompt 11, users typically manage an array of toasts in the page state
