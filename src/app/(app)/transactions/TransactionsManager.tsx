"use client";

import { useMemo, useState, useTransition } from "react";
import type { BankAccount, CreditCard, Loan, MutualFund, Transaction } from "@prisma/client";
import { createTransaction, deleteTransaction } from "./actions";
import { TextField, SelectField, primaryButtonClass, ghostButtonClass, dangerButtonClass } from "@/components/form";
import { formatMoney } from "@/lib/format";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/transactions";

type Props = {
  transactions: Transaction[];
  bankAccounts: BankAccount[];
  cards: CreditCard[];
  loans: Loan[];
  funds: MutualFund[];
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export default function TransactionsManager({ transactions, bankAccounts, cards, loans, funds }: Props) {
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<"expense" | "income" | "transfer">("expense");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const accountLabel = useMemo(() => {
    const map = new Map<string, string>();
    bankAccounts.forEach((a) => map.set(`bank-${a.id}`, `${a.accountName} (${a.bankName})`));
    cards.forEach((c) => map.set(`card-${c.id}`, `${c.cardName} (${c.bankName})`));
    loans.forEach((l) => map.set(`loan-${l.id}`, `${l.loanName} (${l.lender})`));
    funds.forEach((f) => map.set(`fund-${f.id}`, f.fundName));
    return map;
  }, [bankAccounts, cards, loans, funds]);

  function describe(txn: Transaction) {
    if (txn.type === "expense") {
      return `${txn.category ?? "Expense"} · ${accountLabel.get(`bank-${txn.fromAccountId}`) ?? "Bank"}`;
    }
    if (txn.type === "income") {
      return `${txn.category ?? "Income"} · ${accountLabel.get(`bank-${txn.toAccountId}`) ?? "Bank"}`;
    }
    const from = accountLabel.get(`bank-${txn.fromAccountId}`) ?? "Bank";
    const to = accountLabel.get(`${txn.toAccountType}-${txn.toAccountId}`) ?? "?";
    return `${txn.category ?? "Transfer"} · ${from} → ${to}`;
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createTransaction(formData);
        setAdding(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save transaction.");
      }
    });
  }

  function handleDelete(id: string, label: string) {
    if (!confirm(`Delete "${label}"? This will reverse its effect on your balances.`)) return;
    startTransition(async () => {
      await deleteTransaction(id);
    });
  }

  const toOptions = [
    ...cards.map((c) => ({ value: `card:${c.id}`, label: `Credit Card · ${c.cardName}` })),
    ...loans.map((l) => ({ value: `loan:${l.id}`, label: `Loan · ${l.loanName}` })),
    ...funds.map((f) => ({ value: `fund:${f.id}`, label: `Mutual Fund · ${f.fundName}` })),
    ...bankAccounts.map((a) => ({ value: `bank:${a.id}`, label: `Bank Account · ${a.accountName}` })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Transactions</h1>
          <p className="text-sm text-slate-500">Log day-to-day spending, income, and payments between your accounts.</p>
        </div>
        <button onClick={() => setAdding((v) => !v)} className={primaryButtonClass}>
          {adding ? "Cancel" : "+ Add transaction"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {bankAccounts.length === 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Add a bank account first — every transaction needs one as the source or destination.
        </p>
      )}

      {adding && bankAccounts.length > 0 && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex gap-2">
            {(["expense", "income", "transfer"] as const).map((t) => (
              <label
                key={t}
                className={`flex-1 text-center capitalize rounded-lg border px-3 py-2 text-sm font-medium cursor-pointer ${
                  type === t ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600"
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={type === t}
                  onChange={() => setType(t)}
                  className="sr-only"
                />
                {t}
              </label>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(type === "expense" || type === "income") && (
              <>
                <SelectField
                  label={type === "expense" ? "Pay from" : "Deposit to"}
                  name="bankAccountId"
                  options={bankAccounts.map((a) => ({ value: a.id, label: `${a.accountName} (${a.bankName})` }))}
                />
                <SelectField
                  label="Category"
                  name="category"
                  options={(type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((c) => ({ value: c, label: c }))}
                />
              </>
            )}

            {type === "transfer" && (
              <>
                <SelectField
                  label="From (bank account)"
                  name="fromAccountId"
                  options={bankAccounts.map((a) => ({ value: a.id, label: `${a.accountName} (${a.bankName})` }))}
                />
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    name="to"
                  >
                    {toOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <TextField label="Amount (₹)" name="amount" type="number" step="0.01" required />
            <TextField label="Date" name="date" type="date" defaultValue={todayInputValue()} required />
            <TextField label="Note" name="note" placeholder="Optional" />
          </div>

          <div className="flex justify-end gap-2">
            <button type="submit" disabled={pending} className={primaryButtonClass}>
              Save transaction
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {transactions.length === 0 && (
          <p className="p-6 text-sm text-slate-500 text-center">No transactions logged yet.</p>
        )}
        {transactions.map((txn) => {
          const isOutflow = txn.type === "expense" || (txn.type === "transfer" && txn.fromAccountId);
          return (
            <div key={txn.id} className="p-4 sm:p-5 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-slate-900 text-sm">{describe(txn)}</p>
                <p className="text-xs text-slate-500">
                  {new Date(txn.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  {txn.note ? ` · ${txn.note}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-semibold tabular-nums text-sm ${txn.type === "income" ? "text-emerald-600" : "text-slate-900"}`}>
                  {txn.type === "income" ? "+" : "−"}
                  {formatMoney(txn.amount)}
                </span>
                <button onClick={() => handleDelete(txn.id, describe(txn))} className={dangerButtonClass}>
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
