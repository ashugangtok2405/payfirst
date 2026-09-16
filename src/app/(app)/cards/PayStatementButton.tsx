"use client";

import { useState, useTransition } from "react";
import type { BankAccount, CreditCard } from "@prisma/client";
import { payStatement } from "./statements";
import { TextField, primaryButtonClass, ghostButtonClass } from "@/components/form";
import { formatMoney } from "@/lib/format";

type StatementOption = { id: string; label: string; remainingDue: number };

type Props = {
  cardId: string;
  cardLabel: string;
  statementOptions: StatementOption[];
  bankAccounts: BankAccount[];
  cards: CreditCard[];
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export default function PayStatementButton({ cardId, cardLabel, statementOptions, bankAccounts, cards }: Props) {
  const [open, setOpen] = useState(false);
  const [statementId, setStatementId] = useState(statementOptions[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sourceOptions = [
    ...bankAccounts.map((a) => ({ value: `bank:${a.id}`, label: `${a.accountName} (${a.bankName})` })),
    ...cards.filter((c) => c.id !== cardId).map((c) => ({ value: `card:${c.id}`, label: `${c.cardName} (cash advance)` })),
  ];

  const selectedDefault = statementOptions.find((s) => s.id === statementId)?.remainingDue;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("cardId", cardId);
    startTransition(async () => {
      try {
        await payStatement(formData);
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
        Pay statement
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-900">Pay {cardLabel}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Statement</label>
                <select
                  name="statementId"
                  value={statementId}
                  onChange={(e) => setStatementId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {statementOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} — {formatMoney(s.remainingDue)} due
                    </option>
                  ))}
                  <option value="">No statement (general payment)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pay from</label>
                <select
                  name="from"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {sourceOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <TextField
                key={statementId}
                label="Amount (₹)"
                name="amount"
                type="number"
                step="0.01"
                required
                defaultValue={selectedDefault}
              />
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
