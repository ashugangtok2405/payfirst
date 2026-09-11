"use client";

import { useState, useTransition } from "react";
import type { BankAccount, CreditCard } from "@prisma/client";
import { createTransaction } from "@/app/(app)/transactions/actions";
import { TextField, primaryButtonClass, ghostButtonClass } from "@/components/form";

type Props = {
  toType: "loan" | "card";
  toId: string;
  toLabel: string;
  defaultAmount?: number;
  bankAccounts: BankAccount[];
  cards: CreditCard[];
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export default function MakePaymentButton({ toType, toId, toLabel, defaultAmount, bankAccounts, cards }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sourceOptions = [
    ...bankAccounts.map((a) => ({ value: `bank:${a.id}`, label: `${a.accountName} (${a.bankName})` })),
    ...cards.filter((c) => !(toType === "card" && c.id === toId)).map((c) => ({ value: `card:${c.id}`, label: `${c.cardName} (cash advance)` })),
  ];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formEl = e.currentTarget;
    const source = String(new FormData(formEl).get("source") ?? "");
    const amount = String(new FormData(formEl).get("amount") ?? "");
    const date = String(new FormData(formEl).get("date") ?? "");
    const note = String(new FormData(formEl).get("note") ?? "");

    const payload = new FormData();
    payload.set("type", "transfer");
    payload.set("from", source);
    payload.set("to", `${toType}:${toId}`);
    payload.set("amount", amount);
    payload.set("date", date);
    payload.set("note", note);

    startTransition(async () => {
      try {
        await createTransaction(payload);
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Payment failed.");
      }
    });
  }

  if (sourceOptions.length === 0) {
    return null;
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={primaryButtonClass}>
        Make payment
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="bg-white rounded-xl p-5 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-900">Pay {toLabel}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pay from</label>
                <select
                  name="source"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
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

              {error && <p className="text-sm text-red-600">{error}</p>}

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
