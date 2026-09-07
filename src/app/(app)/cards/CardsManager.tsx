"use client";

import { useState, useTransition } from "react";
import type { CreditCard } from "@prisma/client";
import { createCreditCard, updateCreditCard, deleteCreditCard } from "./actions";
import { TextField, primaryButtonClass, ghostButtonClass, dangerButtonClass } from "@/components/form";
import { formatMoney, ordinal } from "@/lib/format";
import { nextOccurrenceForDay, daysUntil, urgencyFromDays, urgencyStyles } from "@/lib/dueDates";

export default function CardsManager({ cards }: { cards: CreditCard[] }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createCreditCard(formData);
        setAdding(false);
      } catch {
        setError("Could not save card.");
      }
    });
  }

  function handleUpdate(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateCreditCard(id, formData);
        setEditingId(null);
      } catch {
        setError("Could not save card.");
      }
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteCreditCard(id);
    });
  }

  const totalOutstanding = cards.reduce((sum, c) => sum + c.currentBalance, 0);
  const totalLimit = cards.reduce((sum, c) => sum + c.creditLimit, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Credit Cards</h1>
          <p className="text-sm text-slate-500">
            {cards.length} card{cards.length !== 1 ? "s" : ""} · Outstanding {formatMoney(totalOutstanding)} of {formatMoney(totalLimit)} limit
          </p>
        </div>
        <button onClick={() => setAdding((v) => !v)} className={primaryButtonClass}>
          {adding ? "Cancel" : "+ Add card"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {adding && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="Card name" name="cardName" required placeholder="e.g. Regalia Gold" />
          <TextField label="Bank name" name="bankName" required placeholder="e.g. HDFC Bank" />
          <TextField label="Last 4 digits" name="last4" placeholder="1234" />
          <TextField label="Credit limit (₹)" name="creditLimit" type="number" step="0.01" required />
          <TextField label="Current outstanding (₹)" name="currentBalance" type="number" step="0.01" defaultValue={0} />
          <TextField label="Minimum payment (₹)" name="minPayment" type="number" step="0.01" />
          <TextField label="Statement date (day of month)" name="statementDay" type="number" min={1} max={31} defaultValue={1} required />
          <TextField label="Payment due date (day of month)" name="dueDay" type="number" min={1} max={31} defaultValue={15} required />
          <TextField label="APR / interest rate (%)" name="apr" type="number" step="0.01" />
          <TextField label="Notes" name="notes" placeholder="Optional" />
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="submit" disabled={pending} className={primaryButtonClass}>
              Save card
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {cards.length === 0 && !adding && (
          <p className="p-6 text-sm text-slate-500 text-center">No credit cards yet. Add your first one above.</p>
        )}
        {cards.map((card) => {
          const nextDue = nextOccurrenceForDay(card.dueDay);
          const days = daysUntil(nextDue);
          const urgency = urgencyFromDays(days);
          const utilization = card.creditLimit > 0 ? Math.round((card.currentBalance / card.creditLimit) * 100) : 0;

          return editingId === card.id ? (
            <form
              key={card.id}
              onSubmit={(e) => handleUpdate(card.id, e)}
              className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <TextField label="Card name" name="cardName" required defaultValue={card.cardName} />
              <TextField label="Bank name" name="bankName" required defaultValue={card.bankName} />
              <TextField label="Last 4 digits" name="last4" defaultValue={card.last4} />
              <TextField label="Credit limit (₹)" name="creditLimit" type="number" step="0.01" required defaultValue={card.creditLimit} />
              <TextField label="Current outstanding (₹)" name="currentBalance" type="number" step="0.01" defaultValue={card.currentBalance} />
              <TextField label="Minimum payment (₹)" name="minPayment" type="number" step="0.01" defaultValue={card.minPayment} />
              <TextField label="Statement date (day of month)" name="statementDay" type="number" min={1} max={31} required defaultValue={card.statementDay} />
              <TextField label="Payment due date (day of month)" name="dueDay" type="number" min={1} max={31} required defaultValue={card.dueDay} />
              <TextField label="APR / interest rate (%)" name="apr" type="number" step="0.01" defaultValue={card.apr} />
              <TextField label="Notes" name="notes" defaultValue={card.notes} />
              <div className="sm:col-span-2 flex justify-end gap-2">
                <button type="button" onClick={() => setEditingId(null)} className={ghostButtonClass}>
                  Cancel
                </button>
                <button type="submit" disabled={pending} className={primaryButtonClass}>
                  Save changes
                </button>
              </div>
            </form>
          ) : (
            <div key={card.id} className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-medium text-slate-900">
                  {card.cardName}{" "}
                  <span className="text-slate-400 font-normal text-sm">
                    · {card.bankName}
                    {card.last4 ? ` ••${card.last4}` : ""}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  {formatMoney(card.currentBalance)} of {formatMoney(card.creditLimit)} used ({utilization}%) · Statement on {ordinal(card.statementDay)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium border rounded-full px-2.5 py-1 ${urgencyStyles[urgency]}`}>
                  Due {ordinal(card.dueDay)} ({days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "today" : `in ${days}d`})
                </span>
                <button onClick={() => setEditingId(card.id)} className={ghostButtonClass}>
                  Edit
                </button>
                <button onClick={() => handleDelete(card.id, card.cardName)} className={dangerButtonClass}>
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
