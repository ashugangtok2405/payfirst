"use client";

import { useState, useTransition } from "react";
import type { BankAccount, CreditCard } from "@prisma/client";
import { payCard } from "./actions";
import { TextField, primaryButtonClass, ghostButtonClass } from "@/components/form";

type Props = {
  cardId: string;
  cardLabel: string;
  defaultAmount?: number;
  bankAccounts: BankAccount[];
  cards: CreditCard[];
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export default function PayCardButton({ cardId, cardLabel, defaultAmount, bankAccounts, cards }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sourceOptions = [
    ...bankAccounts.map((a) => ({ value: `bank:${a.id}`, label: `${a.accountName} (${a.bankName})` })),
    ...cards.filter((c) => c.id !== cardId).map((c) => ({ value: `card:${c.id}`, label: `${c.cardName} (cash advance)` })),
  ];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await payCard(cardId, formData);
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Payment failed.");
      }
    });
  }

  if (sourceOptions.length === 0) return null;

  return (
    <>
      <button onClick={() => setOpen(true)} className={primaryButtonClass}>
        Pay
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-ink">Pay {cardLabel}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Pay from</label>
                <select
                  name="from"
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {sourceOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <TextField label="Amount (₹)" name="amount" type="number" step="0.01" required defaultValue={defaultAmount} />
              <TextField label="Date" name="date" type="date" defaultValue={todayInputValue()} required />
              <TextField label="Note" name="note" placeholder="Optional" />

              {error && <p className="text-sm text-coral">{error}</p>}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className={ghostButtonClass}>
                  Cancel
                </button>
                <button type="submit" disabled={pending} className={primaryButtonClass}>
                  {pending ? "Paying…" : "Pay"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
