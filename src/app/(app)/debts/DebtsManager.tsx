"use client";

import { useState, useTransition } from "react";
import type { Debt } from "@prisma/client";
import { createDebt, updateDebt, deleteDebt, toggleDebtSettled } from "./actions";
import { TextField, SelectField, primaryButtonClass, ghostButtonClass, dangerButtonClass } from "@/components/form";
import { formatMoney } from "@/lib/format";
import { daysUntil, urgencyFromDays, urgencyStyles } from "@/lib/dueDates";

const DIRECTIONS = [
  { value: "owed_by_me", label: "I owe them" },
  { value: "owed_to_me", label: "They owe me" },
];

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export default function DebtsManager({ debts }: { debts: Debt[] }) {
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
        await createDebt(formData);
        setAdding(false);
      } catch {
        setError("Could not save debt.");
      }
    });
  }

  function handleUpdate(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateDebt(id, formData);
        setEditingId(null);
      } catch {
        setError("Could not save debt.");
      }
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete debt with "${name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteDebt(id);
    });
  }

  const iOwe = debts.filter((d) => d.direction === "owed_by_me" && !d.settled).reduce((s, d) => s + d.amount, 0);
  const owedToMe = debts.filter((d) => d.direction === "owed_to_me" && !d.settled).reduce((s, d) => s + d.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Other Debts</h1>
          <p className="text-sm text-slate-500">
            Informal loans · I owe {formatMoney(iOwe)} · Owed to me {formatMoney(owedToMe)}
          </p>
        </div>
        <button onClick={() => setAdding((v) => !v)} className={primaryButtonClass}>
          {adding ? "Cancel" : "+ Add debt"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {adding && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="Person / party" name="personName" required placeholder="e.g. Rahul" />
          <SelectField label="Direction" name="direction" options={DIRECTIONS} defaultValue="owed_by_me" />
          <TextField label="Amount (₹)" name="amount" type="number" step="0.01" required />
          <TextField label="Due date (optional)" name="dueDate" type="date" />
          <TextField label="Notes" name="notes" placeholder="Optional" />
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="submit" disabled={pending} className={primaryButtonClass}>
              Save debt
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {debts.length === 0 && !adding && (
          <p className="p-6 text-sm text-slate-500 text-center">No debts tracked yet.</p>
        )}
        {debts.map((debt) => {
          const days = debt.dueDate ? daysUntil(new Date(debt.dueDate)) : null;
          const urgency = days != null && !debt.settled ? urgencyFromDays(days) : null;

          return editingId === debt.id ? (
            <form
              key={debt.id}
              onSubmit={(e) => handleUpdate(debt.id, e)}
              className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <TextField label="Person / party" name="personName" required defaultValue={debt.personName} />
              <SelectField label="Direction" name="direction" options={DIRECTIONS} defaultValue={debt.direction} />
              <TextField label="Amount (₹)" name="amount" type="number" step="0.01" required defaultValue={debt.amount} />
              <TextField label="Due date (optional)" name="dueDate" type="date" defaultValue={toDateInputValue(debt.dueDate)} />
              <TextField label="Notes" name="notes" defaultValue={debt.notes} />
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
            <div key={debt.id} className={`p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 ${debt.settled ? "opacity-50" : ""}`}>
              <div>
                <p className="font-medium text-slate-900">
                  {debt.personName}{" "}
                  <span className="text-slate-400 font-normal text-sm">
                    · {debt.direction === "owed_by_me" ? "I owe them" : "They owe me"}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  {formatMoney(debt.amount)}
                  {debt.dueDate ? ` · due ${new Date(debt.dueDate).toLocaleDateString("en-IN")}` : ""}
                  {debt.settled ? " · Settled" : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {urgency && days != null && (
                  <span className={`text-xs font-medium border rounded-full px-2.5 py-1 ${urgencyStyles[urgency]}`}>
                    {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "due today" : `due in ${days}d`}
                  </span>
                )}
                <button
                  onClick={() => startTransition(() => toggleDebtSettled(debt.id, !debt.settled))}
                  className={ghostButtonClass}
                >
                  {debt.settled ? "Mark unsettled" : "Mark settled"}
                </button>
                <button onClick={() => setEditingId(debt.id)} className={ghostButtonClass}>
                  Edit
                </button>
                <button onClick={() => handleDelete(debt.id, debt.personName)} className={dangerButtonClass}>
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
