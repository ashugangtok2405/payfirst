"use client";

import { useState, useTransition } from "react";
import type { BankAccount } from "@prisma/client";
import { createGoal, updateGoal, deleteGoal, contributeToGoal } from "./actions";
import { TextField, SelectField, primaryButtonClass, ghostButtonClass, dangerButtonClass, inputClass, labelClass } from "@/components/form";
import { formatMoney } from "@/lib/format";
import { todayInAppTimeZone, daysUntil } from "@/lib/dueDates";

type GoalRow = {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: Date | null;
  bankAccountId: string;
  bankAccountLabel: string;
  notes: string | null;
  saved: number;
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

function ContributeModal({
  goal,
  bankAccounts,
  onClose,
}: {
  goal: GoalRow;
  bankAccounts: BankAccount[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const sourceOptions = bankAccounts
    .filter((a) => a.id !== goal.bankAccountId)
    .map((a) => ({ value: a.id, label: `${a.accountName} (${a.bankName})` }));

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await contributeToGoal(goal.id, formData);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save contribution.");
      }
    });
  }

  if (sourceOptions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl p-5 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-slate-600">
            You need another bank account to contribute from — {goal.bankAccountLabel} is where this goal's money already lives.
          </p>
          <button onClick={onClose} className={ghostButtonClass}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-5 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-slate-900">Pay for {goal.name}</h3>
        <p className="text-xs text-slate-500 -mt-2">Moves money into {goal.bankAccountLabel}.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>From</label>
            <select name="from" className={inputClass}>
              {sourceOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <TextField label="Amount (₹)" name="amount" type="number" step="0.01" required />
          <TextField label="Date" name="date" type="date" defaultValue={todayInputValue()} required />
          <TextField label="Note" name="note" placeholder="Optional" />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={ghostButtonClass}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className={primaryButtonClass}>
              {pending ? "Paying…" : "Pay"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GoalFormFields({ bankAccounts, goal }: { bankAccounts: BankAccount[]; goal?: GoalRow }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <TextField label="Goal name" name="name" required placeholder="e.g. Car" defaultValue={goal?.name} />
      <TextField label="Target amount (₹)" name="targetAmount" type="number" step="0.01" required defaultValue={goal?.targetAmount} />
      <SelectField
        label="Savings account"
        name="bankAccountId"
        defaultValue={goal?.bankAccountId}
        options={bankAccounts.map((a) => ({ value: a.id, label: `${a.accountName} (${a.bankName})` }))}
      />
      <TextField label="Target date" name="targetDate" type="date" defaultValue={toDateInputValue(goal?.targetDate ?? null)} />
      <TextField label="Notes" name="notes" placeholder="Optional" defaultValue={goal?.notes ?? undefined} />
    </div>
  );
}

export default function GoalsManager({ goals, bankAccounts }: { goals: GoalRow[]; bankAccounts: BankAccount[] }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payingGoal, setPayingGoal] = useState<GoalRow | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createGoal(formData);
        setAdding(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save goal.");
      }
    });
  }

  function handleUpdate(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateGoal(id, formData);
        setEditingId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save goal.");
      }
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? Past contributions stay in your Transactions, just unlinked from this goal.`)) return;
    startTransition(async () => {
      await deleteGoal(id);
    });
  }

  const today = todayInAppTimeZone();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Goals</h1>
          <p className="text-sm text-slate-500">Save toward something specific, tracked separately from day-to-day spending.</p>
        </div>
        <button
          onClick={() => {
            setAdding((v) => !v);
            setEditingId(null);
          }}
          className={primaryButtonClass}
        >
          {adding ? "Cancel" : "+ Add goal"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {bankAccounts.length === 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Add a bank account first — every goal needs one to hold its savings.
        </p>
      )}

      {adding && bankAccounts.length > 0 && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <GoalFormFields bankAccounts={bankAccounts} />
          <div className="flex justify-end gap-2">
            <button type="submit" disabled={pending} className={primaryButtonClass}>
              Save goal
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {goals.length === 0 && !adding && (
          <p className="p-6 text-sm text-slate-500 text-center">No goals yet. Add your first one above.</p>
        )}
        {goals.map((goal) => {
          const pct = goal.targetAmount > 0 ? Math.round((goal.saved / goal.targetAmount) * 100) : 0;
          const complete = goal.saved >= goal.targetAmount;
          const days = goal.targetDate ? daysUntil(new Date(goal.targetDate), today) : null;
          const barColor = complete ? "bg-emerald-500" : days != null && days < 0 ? "bg-red-500" : "bg-slate-900";

          return editingId === goal.id ? (
            <form key={goal.id} onSubmit={(e) => handleUpdate(goal.id, e)} className="p-5 space-y-4">
              <GoalFormFields bankAccounts={bankAccounts} goal={goal} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingId(null)} className={ghostButtonClass}>
                  Cancel
                </button>
                <button type="submit" disabled={pending} className={primaryButtonClass}>
                  Save changes
                </button>
              </div>
            </form>
          ) : (
            <div key={goal.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-900">
                    {goal.name}
                    {complete && <span className="ml-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">Complete</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatMoney(goal.saved)} of {formatMoney(goal.targetAmount)} ({pct}%) · {goal.bankAccountLabel}
                    {goal.targetDate && days != null && (
                      <> · {days < 0 ? `${Math.abs(days)}d past target` : days === 0 ? "target date today" : `${days}d left`}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setPayingGoal(goal)} className={primaryButtonClass}>
                    Pay for goal
                  </button>
                  <button onClick={() => setEditingId(goal.id)} className={ghostButtonClass}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(goal.id, goal.name)} className={dangerButtonClass}>
                    Delete
                  </button>
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {payingGoal && <ContributeModal goal={payingGoal} bankAccounts={bankAccounts} onClose={() => setPayingGoal(null)} />}
    </div>
  );
}
