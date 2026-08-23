import * as React from "react";
import { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = "success", duration = 3000) => {
    // Normalize message/type to avoid duplicate toasts
    const normalizedMessage = (message || '').toString().trim();
    const normalizedType = (type || 'success').toString();

    // If an identical toast (same message & type) already exists, don't add a duplicate
    let existing = null;
    setToasts((prev) => {
      existing = prev.find((t) => t.message === normalizedMessage && t.type === normalizedType);
      if (existing) return prev;
      const id = Math.random().toString(36).substring(2, 9);
      // schedule removal
      setTimeout(() => {
        setToasts((p) => p.filter((tt) => tt.id !== id));
      }, duration);
      return [...prev, { id, message: normalizedMessage, type: normalizedType, duration }];
    });

    // return existing id if present, otherwise return newly created id by reading current toasts
    if (existing) return existing.id;
    // best-effort: find the newly added toast id
    const latest = toasts.find((t) => t.message === normalizedMessage && t.type === normalizedType);
    return latest ? latest.id : null;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-400" />,
    error: <XCircle className="w-5 h-5 text-rose-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
  };

  const borders = {
    success: "border-emerald-500/20 bg-slate-950/80 shadow-[0_0_15px_rgba(16,185,129,0.1)]",
    error: "border-rose-500/20 bg-slate-950/80 shadow-[0_0_15px_rgba(239,68,68,0.1)]",
    info: "border-blue-500/20 bg-slate-950/80 shadow-[0_0_15px_rgba(59,130,246,0.1)]",
    warning: "border-amber-500/20 bg-slate-950/80 shadow-[0_0_15px_rgba(245,158,11,0.1)]",
  };

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      
      {/* Toast Portal Container */}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -20, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, x: 50, transition: { duration: 0.2 } }}
              className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border backdrop-blur-xl transition-all ${borders[t.type]}`}
            >
              <div className="flex items-center gap-3">
                <div className="shrink-0">{icons[t.type]}</div>
                <p className="text-sm font-semibold text-slate-200 tracking-wide">{t.message}</p>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context.toast;
}

export function useToastApi() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToastApi must be used within a ToastProvider");
  }
  return { removeToast: context.removeToast };
}
