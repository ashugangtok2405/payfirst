"use client";

import { useState, useTransition } from "react";
import { setCardDueDate } from "./actions";
import { TextField, primaryButtonClass, ghostButtonClass } from "@/components/form";

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export default function SetDueDateButton({ cardId, cardLabel, currentDueDate }: { cardId: string; cardLabel: string; currentDueDate: Date | null }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const date = String(new FormData(e.currentTarget).get("dueDate") ?? "");
    startTransition(async () => {
      try {
        await setCardDueDate(cardId, date);
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save date.");
      }
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={ghostButtonClass}>
        Set payment date
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-ink">Next payment date for {cardLabel}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <TextField label="Due date" name="dueDate" type="date" defaultValue={toDateInputValue(currentDueDate)} required />
              {error && <p className="text-sm text-coral">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className={ghostButtonClass}>
                  Cancel
                </button>
                <button type="submit" disabled={pending} className={primaryButtonClass}>
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
