// Toast — non-blocking feedback (per Navigation Map/components/Toast.dc.html).
// Never punishing, never a red alarm. Slides up; dismissed on tap or auto after
// a timeout (handled by ToastHost). This file is the presentational piece;
// ToastHost owns the queue + the useToast() hook.

import Icon from "./Icon";

export type ToastVariant = "success" | "info" | "live" | "notice";

export interface ToastData {
  id: number;
  variant: ToastVariant;
  message: string;
}

const VARIANTS: Record<
  ToastVariant,
  { className: string; icon: string }
> = {
  success: {
    className: "bg-[rgba(76,195,138,0.12)] border-[rgba(76,195,138,0.32)] text-[#79d4a6]",
    icon: "check_circle",
  },
  info: {
    className: "bg-[rgba(47,109,246,0.12)] border-[rgba(47,109,246,0.3)] text-[#8fb2ff]",
    icon: "info",
  },
  live: {
    className: "bg-[rgba(14,149,148,0.12)] border-[rgba(14,149,148,0.32)] text-[#5fd6d2]",
    icon: "sensors",
  },
  notice: {
    className: "bg-[rgba(216,182,92,0.12)] border-[rgba(216,182,92,0.3)] text-[#e0c878]",
    icon: "schedule",
  },
};

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: number) => void;
  dismissLabel: string;
}

export default function Toast({ toast, onDismiss, dismissLabel }: ToastProps) {
  const v = VARIANTS[toast.variant];
  return (
    <div
      role="status"
      className={
        "pointer-events-auto flex items-center gap-3 rounded-[13px] border px-4 py-3.5 " +
        "shadow-wp-md backdrop-blur-md [animation:wpSlide_0.25s_ease_both] " +
        v.className
      }
    >
      <Icon name={v.icon} size={20} fill />
      <span className="flex-1 text-sm font-medium">{toast.message}</span>
      <button
        type="button"
        aria-label={dismissLabel}
        onClick={() => onDismiss(toast.id)}
        className="opacity-60 transition hover:opacity-100"
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
