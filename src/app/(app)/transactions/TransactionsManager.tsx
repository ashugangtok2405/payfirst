"use client";

import { Suspense, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { BankAccount, CreditCard, Loan, MutualFund, Transaction } from "@prisma/client";
import { createTransaction, updateTransaction, deleteTransaction } from "./actions";
import { TextField, SelectField, inputClass, labelClass, primaryButtonClass, ghostButtonClass } from "@/components/form";
import ConfirmButton from "@/components/ConfirmButton";
import { formatMoney } from "@/lib/format";

type MonthSummary = {
  monthLabel: string;
  isCurrentMonth: boolean;
  prevHref: string;
  nextHref: string;
  currentHref: string;
  totalExpense: number;
  totalIncome: number;
  categoryBreakdown: { category: string; amount: number }[];
  incomeBreakdown: { category: string; amount: number }[];
};

type Props = {
  transactions: Transaction[];
  bankAccounts: BankAccount[];
  cards: CreditCard[];
  loans: Loan[];
  funds: MutualFund[];
  expenseCategories: string[];
  incomeCategories: string[];
  monthSummary: MonthSummary;
};

type TxnFilter = "all" | "expense" | "income";

function MonthlySummaryCard({
  summary,
  filter,
  onFilterChange,
}: {
  summary: MonthSummary;
  filter: TxnFilter;
  onFilterChange: (f: TxnFilter) => void;
}) {
  const net = summary.totalIncome - summary.totalExpense;
  // The breakdown bars always show expense categories unless Income is the
  // active filter - "All" (Net) has no single category breakdown, so it
  // falls back to the same "Where it went" default the card always had.
  const breakdownView = filter === "income" ? "income" : "expense";
  const breakdown = breakdownView === "expense" ? summary.categoryBreakdown : summary.incomeBreakdown;
  const topCategories = breakdown.slice(0, 6);
  const maxAmount = topCategories[0]?.amount ?? 0;

  return (
    <div className="bg-white rounded-2xl shadow-card p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-semibold text-ink">Monthly summary</h2>
        <div className="flex items-center gap-2">
          <Link href={summary.prevHref} className={ghostButtonClass} aria-label="Previous month">
            ← Prev
          </Link>
          <span className="text-sm font-medium text-ink min-w-[8rem] text-center">{summary.monthLabel}</span>
          <Link href={summary.nextHref} className={ghostButtonClass} aria-label="Next month">
            Next →
          </Link>
          {!summary.isCurrentMonth && (
            <Link href={summary.currentHref} className={ghostButtonClass}>
              Today
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => onFilterChange("expense")}
          className={`text-left rounded-xl px-3 py-2.5 bg-coral-soft transition-shadow ${
            filter === "expense" ? "ring-2 ring-coral" : ""
          }`}
        >
          <p className="text-xs text-coral">Spent</p>
          <p className="font-semibold text-coral tabular-nums mt-0.5">{formatMoney(summary.totalExpense)}</p>
        </button>
        <button
          type="button"
          onClick={() => onFilterChange("income")}
          className={`text-left rounded-xl px-3 py-2.5 bg-mint-soft transition-shadow ${
            filter === "income" ? "ring-2 ring-mint" : ""
          }`}
        >
          <p className="text-xs text-mint">Income</p>
          <p className="font-semibold text-mint tabular-nums mt-0.5">{formatMoney(summary.totalIncome)}</p>
        </button>
        <button
          type="button"
          onClick={() => onFilterChange("all")}
          className={`text-left rounded-xl px-3 py-2.5 ${net >= 0 ? "bg-mint-soft" : "bg-coral-soft"} transition-shadow ${
            filter === "all" ? `ring-2 ${net >= 0 ? "ring-mint" : "ring-coral"}` : ""
          }`}
        >
          <p className={`text-xs ${net >= 0 ? "text-mint" : "text-coral"}`}>Net</p>
          <p className={`font-semibold tabular-nums mt-0.5 ${net >= 0 ? "text-mint" : "text-coral"}`}>{formatMoney(net)}</p>
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted">{breakdownView === "expense" ? "Where it went" : "Where it came from"}</p>
        {topCategories.length === 0 && (
          <p className="text-xs text-muted">{breakdownView === "expense" ? "Nothing spent this month yet." : "No income logged this month yet."}</p>
        )}
        {topCategories.map((c) => (
          <div key={c.category} className="flex items-center gap-3">
            <span className="text-xs text-ink w-24 shrink-0 truncate">{c.category}</span>
            <div className={`flex-1 h-2 rounded-full ${breakdownView === "expense" ? "bg-coral-soft" : "bg-mint-soft"} overflow-hidden`}>
              <div
                className={`h-full rounded-full ${breakdownView === "expense" ? "bg-coral" : "bg-mint"}`}
                style={{ width: `${maxAmount > 0 ? Math.max((c.amount / maxAmount) * 100, 4) : 0}%` }}
              />
            </div>
            <span className="text-xs text-muted tabular-nums w-20 shrink-0 text-right">{formatMoney(c.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const NEW_CATEGORY_VALUE = "__new__";

function CategoryField({ categories, defaultValue }: { categories: string[]; defaultValue?: string | null }) {
  const initialIsCustom = !!defaultValue && !categories.includes(defaultValue);
  const [choice, setChoice] = useState(initialIsCustom ? NEW_CATEGORY_VALUE : (defaultValue ?? categories[0]));
  const [customValue, setCustomValue] = useState(initialIsCustom ? (defaultValue ?? "") : "");

  return (
    <div>
      <label className={labelClass}>Category</label>
      <select className={inputClass} value={choice} onChange={(e) => setChoice(e.target.value)}>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value={NEW_CATEGORY_VALUE}>+ Add new category…</option>
      </select>
      {choice === NEW_CATEGORY_VALUE ? (
        <input
          name="category"
          required
          autoFocus
          placeholder="New category name"
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          className={`${inputClass} mt-2`}
        />
      ) : (
        <input type="hidden" name="category" value={choice} />
      )}
    </div>
  );
}

type TxnType = "expense" | "income" | "transfer";

// All date/time inputs are read and written in Asia/Kolkata explicitly,
// never the browser's or server's own clock - this app has one user, in
// India, and a server that may run in UTC (Vercel), so "today" or "now"
// read off a bare `new Date()` would drift by the UTC offset for part of
// the day otherwise.
const APP_TIMEZONE = "Asia/Kolkata";

function istParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

function todayInputValue() {
  const { year, month, day } = istParts(new Date());
  return `${year}-${month}-${day}`;
}

function toDateInputValue(date: Date) {
  const { year, month, day } = istParts(new Date(date));
  return `${year}-${month}-${day}`;
}

// Combines a "YYYY-MM-DD" date input (which day the user says this happened)
// with the current moment's IST time (when they're actually logging/editing
// it) into the exact UTC instant they represent, with an explicit +05:30
// offset so the result doesn't depend on the server's own timezone.
function combineDateWithNow(dateStr: string) {
  const { hour, minute } = istParts(new Date());
  return new Date(`${dateStr}T${hour}:${minute}:00+05:30`);
}

function TransactionFields({
  type,
  setType,
  bankAccounts,
  cards,
  loans,
  funds,
  expenseCategories,
  incomeCategories,
  txn,
}: {
  type: TxnType;
  setType: (t: TxnType) => void;
  bankAccounts: BankAccount[];
  cards: CreditCard[];
  loans: Loan[];
  funds: MutualFund[];
  expenseCategories: string[];
  incomeCategories: string[];
  txn?: Transaction;
}) {
  const fromOptions = [
    ...bankAccounts.map((a) => ({ value: `bank:${a.id}`, label: `Bank Account · ${a.accountName} (${a.bankName})` })),
    ...cards.map((c) => ({ value: `card:${c.id}`, label: `Credit Card · ${c.cardName}` })),
  ];

  const accountOptions = [
    ...bankAccounts.map((a) => ({ value: `bank:${a.id}`, label: `${a.accountName} (${a.bankName})` })),
    ...cards.map((c) => ({ value: `card:${c.id}`, label: `${c.cardName} (${c.bankName})` })),
  ];
  const accountDefault =
    type === "expense"
      ? txn?.fromAccountType && txn?.fromAccountId
        ? `${txn.fromAccountType}:${txn.fromAccountId}`
        : undefined
      : txn?.toAccountType && txn?.toAccountId
        ? `${txn.toAccountType}:${txn.toAccountId}`
        : undefined;

  const initialFrom =
    txn?.type === "transfer" && txn.fromAccountType && txn.fromAccountId
      ? `${txn.fromAccountType}:${txn.fromAccountId}`
      : (fromOptions[0]?.value ?? "");
  const [fromValue, setFromValue] = useState(initialFrom);
  const fromType = fromValue.split(":")[0];

  const toOptions = [
    ...cards.map((c) => ({ value: `card:${c.id}`, label: `Credit Card · ${c.cardName}` })),
    ...loans.map((l) => ({ value: `loan:${l.id}`, label: `Loan · ${l.loanName}` })),
    ...funds.map((f) => ({ value: `fund:${f.id}`, label: `Mutual Fund · ${f.fundName}` })),
    ...bankAccounts.map((a) => ({ value: `bank:${a.id}`, label: `Bank Account · ${a.accountName} (${a.bankName})` })),
  ].filter((opt) => opt.value !== fromValue);

  const toDefault = txn?.toAccountType && txn?.toAccountId ? `${txn.toAccountType}:${txn.toAccountId}` : undefined;

  return (
    <>
      <div className="flex gap-2">
        {(["expense", "income", "transfer"] as const).map((t) => (
          <label
            key={t}
            className={`flex-1 text-center capitalize rounded-xl border px-3 py-2 text-sm font-medium cursor-pointer ${
              type === t ? "bg-accent text-white border-accent" : "border-border text-muted"
            }`}
          >
            <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
            {t}
          </label>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(type === "expense" || type === "income") && (
          <>
            <SelectField
              label={type === "expense" ? "Pay from" : "Deposit to"}
              name="account"
              defaultValue={accountDefault}
              options={accountOptions}
            />
            <CategoryField categories={type === "expense" ? expenseCategories : incomeCategories} defaultValue={txn?.category} />
          </>
        )}

        {type === "transfer" && (
          <>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">From</label>
              <select
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                name="from"
                value={fromValue}
                onChange={(e) => setFromValue(e.target.value)}
              >
                {fromOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {fromType === "card" && <p className="text-xs text-muted mt-1">Cash advance — increases what you owe on the card.</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">To</label>
              <select
                key={fromValue}
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                name="to"
                defaultValue={toDefault}
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

        <TextField label="Amount (₹)" name="amount" type="number" step="0.01" required defaultValue={txn?.amount} />
        <TextField
          label="Date"
          name="date"
          type="date"
          defaultValue={txn ? toDateInputValue(txn.date) : todayInputValue()}
          required
        />
        <TextField label="Note" name="note" placeholder="Optional" defaultValue={txn?.note ?? undefined} />
      </div>
    </>
  );
}

function TransactionsManagerInner({
  transactions,
  bankAccounts,
  cards,
  loans,
  funds,
  expenseCategories,
  incomeCategories,
  monthSummary,
}: Props) {
  const searchParams = useSearchParams();
  const requestedType = searchParams.get("add");
  const validRequestedType = requestedType === "expense" || requestedType === "income" || requestedType === "transfer" ? requestedType : null;

  const [adding, setAdding] = useState(validRequestedType != null);
  const [addType, setAddType] = useState<TxnType>(validRequestedType ?? "expense");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<TxnType>("expense");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TxnFilter>("all");

  const visibleTransactions = useMemo(
    () => (filter === "all" ? transactions : transactions.filter((t) => t.type === filter)),
    [transactions, filter]
  );

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
      return `${txn.category ?? "Expense"} · ${accountLabel.get(`${txn.fromAccountType}-${txn.fromAccountId}`) ?? "Account"}`;
    }
    if (txn.type === "income") {
      return `${txn.category ?? "Income"} · ${accountLabel.get(`${txn.toAccountType}-${txn.toAccountId}`) ?? "Account"}`;
    }
    const from = accountLabel.get(`${txn.fromAccountType}-${txn.fromAccountId}`) ?? "?";
    const to = accountLabel.get(`${txn.toAccountType}-${txn.toAccountId}`) ?? "?";
    return `${txn.category ?? "Transfer"} · ${from} → ${to}`;
  }

  function withLoggedAtNow(formData: FormData) {
    const dateStr = String(formData.get("date") ?? "");
    formData.set("date", combineDateWithNow(dateStr).toISOString());
    return formData;
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = withLoggedAtNow(new FormData(e.currentTarget));
    startTransition(async () => {
      try {
        await createTransaction(formData);
        setAdding(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save transaction.");
      }
    });
  }

  function handleUpdate(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = withLoggedAtNow(new FormData(e.currentTarget));
    startTransition(async () => {
      try {
        await updateTransaction(id, formData);
        setEditingId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save transaction.");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteTransaction(id);
    });
  }

  function startEdit(txn: Transaction) {
    setEditType(txn.type as TxnType);
    setEditingId(txn.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Transactions</h1>
          <p className="text-sm text-muted">Log day-to-day spending, income, and payments between your accounts.</p>
        </div>
        <button
          onClick={() => {
            setAdding((v) => !v);
            setEditingId(null);
          }}
          className={primaryButtonClass}
        >
          {adding ? "Cancel" : "+ Add transaction"}
        </button>
      </div>

      <MonthlySummaryCard summary={monthSummary} filter={filter} onFilterChange={setFilter} />

      {error && <p className="text-sm text-coral">{error}</p>}

      {bankAccounts.length === 0 && (
        <p className="text-sm text-amber bg-amber-soft border border-amber rounded-xl px-3 py-2">
          Add a bank account first — every transaction needs one as the source or destination.
        </p>
      )}

      {adding && bankAccounts.length > 0 && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow-card p-5 space-y-4">
          <TransactionFields
            type={addType}
            setType={setAddType}
            bankAccounts={bankAccounts}
            cards={cards}
            loans={loans}
            funds={funds}
            expenseCategories={expenseCategories}
            incomeCategories={incomeCategories}
          />
          <div className="flex justify-end gap-2">
            <button type="submit" disabled={pending} className={primaryButtonClass}>
              Save transaction
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl shadow-card divide-y divide-border">
        {visibleTransactions.length === 0 && (
          <p className="p-6 text-sm text-muted text-center">
            {filter === "all"
              ? "No transactions logged yet."
              : filter === "expense"
                ? "No expenses this month."
                : "No income this month."}
          </p>
        )}
        {visibleTransactions.map((txn) =>
          editingId === txn.id ? (
            <form
              key={txn.id}
              onSubmit={(e) => handleUpdate(txn.id, e)}
              className="p-5 space-y-4"
            >
              <TransactionFields
                type={editType}
                setType={setEditType}
                bankAccounts={bankAccounts}
                cards={cards}
                loans={loans}
                funds={funds}
                expenseCategories={expenseCategories}
                incomeCategories={incomeCategories}
                txn={txn}
              />
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
            <div key={txn.id} className="p-4 sm:p-5">
              <p className="font-medium text-ink text-sm">{describe(txn)}</p>
              <p className="text-xs text-muted mt-0.5">
                {new Date(txn.date).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
                {txn.note ? ` · ${txn.note}` : ""}
              </p>
              <div className="flex items-center justify-between gap-3 mt-2">
                <span className={`font-semibold tabular-nums text-sm ${txn.type === "income" ? "text-mint" : "text-ink"}`}>
                  {txn.type === "income" ? "+" : "−"}
                  {formatMoney(txn.amount)}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setAdding(false);
                      startEdit(txn);
                    }}
                    className={ghostButtonClass}
                  >
                    Edit
                  </button>
                  <ConfirmButton
                    message={`Delete "${describe(txn)}"? This will reverse its effect on your balances.`}
                    onConfirm={() => handleDelete(txn.id)}
                  >
                    Delete
                  </ConfirmButton>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function TransactionsManager(props: Props) {
  return (
    <Suspense>
      <TransactionsManagerInner {...props} />
    </Suspense>
  );
}
