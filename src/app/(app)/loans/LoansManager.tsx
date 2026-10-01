"use client";

import { useState, useTransition } from "react";
import type { Loan, BankAccount, CreditCard } from "@prisma/client";
import { createLoan, updateLoan, deleteLoan } from "./actions";
import { TextField, SelectField, primaryButtonClass, ghostButtonClass } from "@/components/form";
import ConfirmButton from "@/components/ConfirmButton";
import { formatMoney, ordinal } from "@/lib/format";
import { nextOccurrenceForDay, daysUntil, urgencyFromDays, urgencyStyles } from "@/lib/dueDates";
import MakePaymentButton from "@/components/MakePaymentButton";

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

export default function LoansManager({
  loans,
  bankAccounts,
  cards,
  paidByLoan,
}: {
  loans: Loan[];
  bankAccounts: BankAccount[];
  cards: CreditCard[];
  paidByLoan: Record<string, boolean>;
}) {
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

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteLoan(id);
    });
  }

  const totalOutstanding = loans.reduce((sum, l) => sum + l.outstanding, 0);
  const totalEmi = loans.reduce((sum, l) => sum + (l.emiAmount ?? 0), 0);

  const autoDebitOptions = [
    { value: "", label: "None - I'll pay manually" },
    ...bankAccounts.map((a) => ({ value: a.id, label: `${a.accountName} (${a.bankName})` })),
  ];
  const accountLabel = (id: string | null) => {
    const account = bankAccounts.find((a) => a.id === id);
    return account ? `${account.accountName} (${account.bankName})` : null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Loans</h1>
          <p className="text-sm text-muted">
            {loans.length} loan{loans.length !== 1 ? "s" : ""} · Outstanding {formatMoney(totalOutstanding)} · Monthly EMI {formatMoney(totalEmi)}
          </p>
        </div>
        <button onClick={() => setAdding((v) => !v)} className={primaryButtonClass}>
          {adding ? "Cancel" : "+ Add loan"}
        </button>
      </div>

      {error && <p className="text-sm text-coral">{error}</p>}

      {adding && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <SelectField label="Auto-debit EMI from" name="autoDebitAccountId" options={autoDebitOptions} defaultValue="" />
          <TextField label="Notes" name="notes" placeholder="Optional" />
          <p className="sm:col-span-2 text-xs text-muted -mt-2">
            When set, the EMI is debited from this account automatically on the due date. If the balance is too low, you'll get a reminder instead.
          </p>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="submit" disabled={pending} className={primaryButtonClass}>
              Save loan
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">
        {loans.length === 0 && !adding && (
          <p className="bg-white rounded-2xl shadow-card p-6 text-sm text-muted text-center">No loans yet. Add your first one above.</p>
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
              className="lg:col-span-2 bg-white rounded-2xl shadow-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4"
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
              <SelectField
                label="Auto-debit EMI from"
                name="autoDebitAccountId"
                options={autoDebitOptions}
                defaultValue={loan.autoDebitAccountId ?? ""}
              />
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
            <div key={loan.id} className="bg-white rounded-2xl shadow-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-medium text-ink">
                  {loan.loanName} <span className="text-muted font-normal text-sm">· {loan.lender}</span>
                </p>
                <p className="text-xs text-muted">
                  {formatMoney(loan.outstanding)} outstanding of {formatMoney(loan.principal)} ({paidOffPct}% paid off)
                  {loan.emiAmount ? ` · EMI ${formatMoney(loan.emiAmount)}` : ""}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {accountLabel(loan.autoDebitAccountId) ? (
                    <>Auto-debit from {accountLabel(loan.autoDebitAccountId)}</>
                  ) : (
                    "No auto-debit set — paid manually"
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {paidByLoan[loan.id] ? (
                  <span className="text-xs font-medium border rounded-full px-2.5 py-1 bg-mint-soft text-mint border-mint/30">
                    Paid for this cycle
                  </span>
                ) : (
                  <span className={`text-xs font-medium border rounded-full px-2.5 py-1 ${urgencyStyles[urgency]}`}>
                    EMI due {ordinal(loan.emiDueDay)} ({days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "today" : `in ${days}d`})
                  </span>
                )}
                <MakePaymentButton
                  toType="loan"
                  toId={loan.id}
                  toLabel={loan.loanName}
                  defaultAmount={loan.emiAmount ?? undefined}
                  bankAccounts={bankAccounts}
                  cards={cards}
                />
                <button onClick={() => setEditingId(loan.id)} className={ghostButtonClass}>
                  Edit
                </button>
                <ConfirmButton message={`Delete "${loan.loanName}"? This cannot be undone.`} onConfirm={() => handleDelete(loan.id)}>
                  Delete
                </ConfirmButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
