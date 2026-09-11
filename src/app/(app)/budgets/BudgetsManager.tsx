"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { setBudget } from "./actions";
import { formatMoney } from "@/lib/format";
import { inputClass, labelClass, primaryButtonClass, ghostButtonClass } from "@/components/form";

type Row = { category: string; budget: number | null; spent: number };

function BudgetRow({ row, editable }: { row: Row; editable: boolean }) {
  const [amount, setAmount] = useState(row.budget ?? 0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hasBudget = row.budget != null && row.budget > 0;
  const pct = hasBudget ? Math.round((row.spent / row.budget!) * 100) : 0;
  const over = hasBudget && row.spent > row.budget!;

  const barColor = !hasBudget ? "bg-slate-300" : over ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";

  function save(next: number) {
    setAmount(next);
    setError(null);
    startTransition(async () => {
      try {
        await setBudget(row.category, next);
      } catch {
        setError("Could not save budget.");
      }
    });
  }

  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="font-medium text-slate-900 text-sm">{row.category}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {formatMoney(row.spent)} spent
            {hasBudget && (
              <>
                {" "}
                of {formatMoney(row.budget!)}
                {over && <span className="text-red-600 font-medium"> · over by {formatMoney(row.spent - row.budget!)}</span>}
              </>
            )}
          </p>
        </div>
        {editable ? (
          <label className="flex items-center gap-2 text-sm text-slate-600 shrink-0">
            Budget ₹
            <input
              type="number"
              min={0}
              step="1"
              value={amount || ""}
              placeholder="none"
              onChange={(e) => save(Number(e.target.value))}
              disabled={pending}
              className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            / month
          </label>
        ) : (
          <p className="text-sm text-slate-400 shrink-0">{hasBudget ? `Budget ${formatMoney(row.budget!)}` : "No budget"}</p>
        )}
      </div>

      {hasBudget && (
        <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function AddCategoryForm({ existing, onDone }: { existing: string[]; onDone: () => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a category name.");
      return;
    }
    if (existing.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setError("That category already exists.");
      return;
    }
    const amt = Number(amount);
    if (!(amt > 0)) {
      setError("Enter a budget amount greater than zero.");
      return;
    }
    startTransition(async () => {
      try {
        await setBudget(trimmed, amt);
        onDone();
      } catch {
        setError("Could not add category.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[10rem]">
        <label className={labelClass}>New category</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pet Care" className={inputClass} autoFocus />
      </div>
      <div>
        <label className={labelClass}>Budget ₹ / month</label>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="5000"
          className={`${inputClass} w-32`}
        />
      </div>
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        Add category
      </button>
      {error && <p className="text-sm text-red-600 basis-full">{error}</p>}
    </form>
  );
}

export default function BudgetsManager({
  rows,
  allCategories,
  monthLabel,
  isCurrentMonth,
  prevHref,
  nextHref,
  currentHref,
}: {
  rows: Row[];
  allCategories: string[];
  monthLabel: string;
  isCurrentMonth: boolean;
  prevHref: string;
  nextHref: string;
  currentHref: string;
}) {
  const [adding, setAdding] = useState(false);
  const totalBudget = rows.reduce((s, r) => s + (r.budget ?? 0), 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Budgets</h1>
          <p className="text-sm text-slate-500">
            {formatMoney(totalSpent)} spent
            {totalBudget > 0 ? ` of ${formatMoney(totalBudget)} budgeted` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={prevHref} className={ghostButtonClass} aria-label="Previous month">
            ← Prev
          </Link>
          <span className="text-sm font-medium text-slate-900 min-w-[9rem] text-center">{monthLabel}</span>
          <Link href={nextHref} className={ghostButtonClass} aria-label="Next month">
            Next →
          </Link>
          {!isCurrentMonth && (
            <Link href={currentHref} className={ghostButtonClass}>
              Today
            </Link>
          )}
          {isCurrentMonth && (
            <button onClick={() => setAdding((v) => !v)} className={primaryButtonClass}>
              {adding ? "Cancel" : "+ Add category"}
            </button>
          )}
        </div>
      </div>

      {!isCurrentMonth && (
        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          Viewing a past/future month — budget caps apply every month and can only be changed from the current month.
        </p>
      )}

      {adding && <AddCategoryForm existing={allCategories} onDone={() => setAdding(false)} />}

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {rows.map((row) => (
          <BudgetRow key={row.category} row={row} editable={isCurrentMonth} />
        ))}
      </div>
    </div>
  );
}
