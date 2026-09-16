"use client";

import { useState, useTransition } from "react";
import type { CreditCard, BankAccount, CreditCardStatement, CreditCardPayment, Transaction } from "@prisma/client";
import { createCreditCard, updateCreditCard, deleteCreditCard } from "./actions";
import { generateStatement, updateStatement } from "./statements";
import { TextField, primaryButtonClass, ghostButtonClass, dangerButtonClass } from "@/components/form";
import { formatMoney, ordinal } from "@/lib/format";
import { nextOccurrenceForDay, daysUntil, urgencyFromDays, urgencyStyles, todayInAppTimeZone } from "@/lib/dueDates";
import { remainingDueOf, paidAmountOf, statementStatusOf, statementStatusStyles, statementStatusLabels } from "@/lib/creditCardStatements";
import PayStatementButton from "./PayStatementButton";

type StatementWithPayments = CreditCardStatement & { payments: (CreditCardPayment & { transaction: Transaction })[] };

function toDateInputValue(date: Date) {
  return new Date(date).toISOString().slice(0, 10);
}

function StatementEditForm({ statement, onDone }: { statement: StatementWithPayments; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateStatement(statement.id, formData);
        onDone();
      } catch {
        setError("Could not update statement.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-lg">
      <TextField label="Statement total (₹)" name="statementTotal" type="number" step="0.01" defaultValue={statement.statementTotal} />
      <TextField label="Minimum due (₹)" name="minimumDue" type="number" step="0.01" defaultValue={statement.minimumDue} />
      <TextField label="Due date" name="dueDate" type="date" defaultValue={toDateInputValue(statement.dueDate)} />
      <div className="flex items-end gap-2">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          Save
        </button>
        <button type="button" onClick={onDone} className={ghostButtonClass}>
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-600 col-span-full">{error}</p>}
    </form>
  );
}

function StatementRow({ statement, today }: { statement: StatementWithPayments; today: Date }) {
  const [editing, setEditing] = useState(false);
  const remaining = remainingDueOf(statement);
  const paid = paidAmountOf(statement);
  const status = statementStatusOf(statement, today);
  const periodLabel = `${statement.periodStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${statement.periodEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;

  if (editing) return <StatementEditForm statement={statement} onDone={() => setEditing(false)} />;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
      <div>
        <p className="font-medium text-slate-900">{periodLabel}</p>
        <p className="text-xs text-slate-500">
          Statement {formatMoney(statement.statementTotal)} · Min due {formatMoney(statement.minimumDue)} · Paid {formatMoney(paid)} · Remaining {formatMoney(remaining)}
        </p>
        <p className="text-xs text-slate-400">Due {statement.dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium border rounded-full px-2.5 py-1 ${statementStatusStyles[status]}`}>{statementStatusLabels[status]}</span>
        <button onClick={() => setEditing(true)} className={ghostButtonClass}>
          Edit
        </button>
      </div>
    </div>
  );
}

export default function CardsManager({
  cards,
  bankAccounts,
  paidByCard,
  statementsByCard,
}: {
  cards: CreditCard[];
  bankAccounts: BankAccount[];
  paidByCard: Record<string, boolean>;
  statementsByCard: Record<string, StatementWithPayments[]>;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const today = todayInAppTimeZone();

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

  function handleGenerateStatement(cardId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await generateStatement(cardId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not generate statement.");
      }
    });
  }

  function toggleExpanded(cardId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
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
          const availableCredit = card.creditLimit - card.currentBalance;

          const statements = statementsByCard[card.id] ?? [];
          const latestStatement = statements[0];
          const unpaidStatements = statements.filter((s) => remainingDueOf(s) > 0);
          const statementOptions = unpaidStatements.map((s) => ({
            id: s.id,
            label: s.periodEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
            remainingDue: remainingDueOf(s),
          }));

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
            <div key={card.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-900">
                    {card.cardName}{" "}
                    <span className="text-slate-400 font-normal text-sm">
                      · {card.bankName}
                      {card.last4 ? ` ••${card.last4}` : ""}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Outstanding {formatMoney(card.currentBalance)} of {formatMoney(card.creditLimit)} ({utilization}%) · Available{" "}
                    {formatMoney(availableCredit)} · Statement on {ordinal(card.statementDay)}
                  </p>
                  {latestStatement ? (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Latest statement {formatMoney(latestStatement.statementTotal)} · Remaining due{" "}
                      {formatMoney(remainingDueOf(latestStatement))} · Min due {formatMoney(latestStatement.minimumDue)} · Due{" "}
                      {latestStatement.dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-0.5">No statement generated yet</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {latestStatement ? (
                    <span
                      className={`text-xs font-medium border rounded-full px-2.5 py-1 ${statementStatusStyles[statementStatusOf(latestStatement, today)]}`}
                    >
                      {statementStatusLabels[statementStatusOf(latestStatement, today)]}
                    </span>
                  ) : paidByCard[card.id] ? (
                    <span className="text-xs font-medium border rounded-full px-2.5 py-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                      Paid for this cycle
                    </span>
                  ) : (
                    <span className={`text-xs font-medium border rounded-full px-2.5 py-1 ${urgencyStyles[urgency]}`}>
                      Due {ordinal(card.dueDay)} ({days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "today" : `in ${days}d`})
                    </span>
                  )}
                  <button onClick={() => handleGenerateStatement(card.id)} disabled={pending} className={ghostButtonClass}>
                    Generate statement
                  </button>
                  <PayStatementButton
                    cardId={card.id}
                    cardLabel={card.cardName}
                    statementOptions={statementOptions}
                    bankAccounts={bankAccounts}
                    cards={cards}
                  />
                  <button onClick={() => setEditingId(card.id)} className={ghostButtonClass}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(card.id, card.cardName)} className={dangerButtonClass}>
                    Delete
                  </button>
                </div>
              </div>

              {statements.length > 0 && (
                <div className="mt-3">
                  <button onClick={() => toggleExpanded(card.id)} className="text-xs font-medium text-slate-500 hover:text-slate-900 underline">
                    {expanded.has(card.id) ? "Hide" : "View"} statement history ({statements.length})
                  </button>
                  {expanded.has(card.id) && (
                    <div className="mt-2 border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {statements.map((s) => (
                        <StatementRow key={s.id} statement={s} today={today} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
