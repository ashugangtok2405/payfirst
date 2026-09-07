"use client";

import { useState, useTransition } from "react";
import type { Loan } from "@prisma/client";
import { createLoan, updateLoan, deleteLoan } from "./actions";
import { TextField, SelectField, primaryButtonClass, ghostButtonClass, dangerButtonClass } from "@/components/form";
import { formatMoney, ordinal } from "@/lib/format";
import { nextOccurrenceForDay, daysUntil, urgencyFromDays, urgencyStyles } from "@/lib/dueDates";

const LOAN_TYPES = [
  { value: "home", label: "Home Loan" },
  { value: "car", label: "Car Loan" },
  { value: "personal", label: "Personal Loan" },
  { value: "education", label: "Education Loan" },
  { value: "gold", label: "Gold Loan" },
  { value: "other", label: "Other" },
];

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export default function LoansManager({ loans }: { loans: Loan[] }) {
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
        await createLoan(formData);
        setAdding(false);
      } catch {
        setError("Could not save loan.");
      }
    });
  }

  function handleUpdate(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateLoan(id, formData);
        setEditingId(null);
      } catch {
        setError("Could not save loan.");
      }
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteLoan(id);
    });
  }

  const totalOutstanding = loans.reduce((sum, l) => sum + l.outstanding, 0);
  const totalEmi = loans.reduce((sum, l) => sum + (l.emiAmount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Loans</h1>
          <p className="text-sm text-slate-500">
            {loans.length} loan{loans.length !== 1 ? "s" : ""} · Outstanding {formatMoney(totalOutstanding)} · Monthly EMI {formatMoney(totalEmi)}
          </p>
        </div>
        <button onClick={() => setAdding((v) => !v)} className={primaryButtonClass}>
          {adding ? "Cancel" : "+ Add loan"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {adding && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="Loan name" name="loanName" required placeholder="e.g. Home Loan - Flat" />
          <TextField label="Lender" name="lender" required placeholder="e.g. SBI" />
          <SelectField label="Loan type" name="loanType" options={LOAN_TYPES} defaultValue="personal" />
          <TextField label="Original principal (₹)" name="principal" type="number" step="0.01" required />
          <TextField label="Current outstanding (₹)" name="outstanding" type="number" step="0.01" required />
          <TextField label="Interest rate (%)" name="interestRate" type="number" step="0.01" />
          <TextField label="EMI amount (₹)" name="emiAmount" type="number" step="0.01" />
          <TextField label="EMI due date (day of month)" name="emiDueDay" type="number" min={1} max={31} defaultValue={5} required />
          <TextField label="Start date" name="startDate" type="date" />
          <TextField label="Tenure (months)" name="tenureMonths" type="number" />
          <TextField label="Notes" name="notes" placeholder="Optional" />
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="submit" disabled={pending} className={primaryButtonClass}>
              Save loan
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {loans.length === 0 && !adding && (
          <p className="p-6 text-sm text-slate-500 text-center">No loans yet. Add your first one above.</p>
        )}
        {loans.map((loan) => {
          const nextDue = nextOccurrenceForDay(loan.emiDueDay);
          const days = daysUntil(nextDue);
          const urgency = urgencyFromDays(days);
          const paidOffPct = loan.principal > 0 ? Math.round((1 - loan.outstanding / loan.principal) * 100) : 0;

          return editingId === loan.id ? (
            <form
              key={loan.id}
              onSubmit={(e) => handleUpdate(loan.id, e)}
              className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <TextField label="Loan name" name="loanName" required defaultValue={loan.loanName} />
              <TextField label="Lender" name="lender" required defaultValue={loan.lender} />
              <SelectField label="Loan type" name="loanType" options={LOAN_TYPES} defaultValue={loan.loanType} />
              <TextField label="Original principal (₹)" name="principal" type="number" step="0.01" required defaultValue={loan.principal} />
              <TextField label="Current outstanding (₹)" name="outstanding" type="number" step="0.01" required defaultValue={loan.outstanding} />
              <TextField label="Interest rate (%)" name="interestRate" type="number" step="0.01" defaultValue={loan.interestRate} />
              <TextField label="EMI amount (₹)" name="emiAmount" type="number" step="0.01" defaultValue={loan.emiAmount} />
              <TextField label="EMI due date (day of month)" name="emiDueDay" type="number" min={1} max={31} required defaultValue={loan.emiDueDay} />
              <TextField label="Start date" name="startDate" type="date" defaultValue={toDateInputValue(loan.startDate)} />
              <TextField label="Tenure (months)" name="tenureMonths" type="number" defaultValue={loan.tenureMonths} />
              <TextField label="Notes" name="notes" defaultValue={loan.notes} />
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
            <div key={loan.id} className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-medium text-slate-900">
                  {loan.loanName} <span className="text-slate-400 font-normal text-sm">· {loan.lender}</span>
                </p>
                <p className="text-xs text-slate-500">
                  {formatMoney(loan.outstanding)} outstanding of {formatMoney(loan.principal)} ({paidOffPct}% paid off)
                  {loan.emiAmount ? ` · EMI ${formatMoney(loan.emiAmount)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium border rounded-full px-2.5 py-1 ${urgencyStyles[urgency]}`}>
                  EMI due {ordinal(loan.emiDueDay)} ({days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "today" : `in ${days}d`})
                </span>
                <button onClick={() => setEditingId(loan.id)} className={ghostButtonClass}>
                  Edit
                </button>
                <button onClick={() => handleDelete(loan.id, loan.loanName)} className={dangerButtonClass}>
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
