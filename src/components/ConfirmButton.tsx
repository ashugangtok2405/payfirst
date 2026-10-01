"use client";

import { useState } from "react";
import { ghostButtonClass, dangerButtonClass } from "@/components/form";

// A native window.confirm() is unreliable in some mobile/PWA contexts (it
// can silently resolve without ever showing a dialog), which made every
// "Delete" button across the app a no-op there. This renders its own
// confirmation instead, so it always works regardless of the browser shell.
export default function ConfirmButton({
  onConfirm,
  message,
  confirmLabel = "Delete",
  className = dangerButtonClass,
  disabled,
  children,
}: {
  onConfirm: () => void;
  message: string;
  confirmLabel?: string;
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} disabled={disabled} className={className}>
        {children}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-ink">{message}</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className={ghostButtonClass}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onConfirm();
                }}
                className={dangerButtonClass}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
