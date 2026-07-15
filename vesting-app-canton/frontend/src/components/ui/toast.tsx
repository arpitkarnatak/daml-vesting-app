import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Minimal, dependency-free toast. A module-level store lets any code call
// `toast(...)` without threading a context/hook through the tree; <Toaster />
// (mounted once, near the app root) subscribes and renders the stack.

export type ToastVariant = "default" | "error" | "success";

export interface Toast {
  id: number;
  title?: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

let counter = 0;
let toasts: Toast[] = [];
const listeners = new Set<(t: Toast[]) => void>();

function emit() {
  for (const l of listeners) l(toasts);
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function toast(
  message: string,
  opts: { title?: string; variant?: ToastVariant; duration?: number } = {},
) {
  const t: Toast = {
    id: ++counter,
    message,
    title: opts.title,
    variant: opts.variant ?? "default",
    duration: opts.duration ?? 6000,
  };
  toasts = [...toasts, t];
  emit();
  return t.id;
}

const variantClasses: Record<ToastVariant, string> = {
  default: "border-border bg-background text-foreground",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  success: "border-success/30 bg-success/10 text-success",
};

export function Toaster() {
  const [items, setItems] = useState<Toast[]>(toasts);

  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {items.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast: t }: { toast: Toast }) {
  useEffect(() => {
    if (t.duration <= 0) return;
    const timer = setTimeout(() => dismiss(t.id), t.duration);
    return () => clearTimeout(timer);
  }, [t.id, t.duration]);

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg",
        variantClasses[t.variant],
      )}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        {t.title && <p className="font-semibold">{t.title}</p>}
        <p className="break-words whitespace-pre-wrap">{t.message}</p>
      </div>
      <button
        onClick={() => dismiss(t.id)}
        className="shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
