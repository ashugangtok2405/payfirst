"use client";

import { useState, useTransition } from "react";
import type { CreditCard, BankAccount, CreditCardStatement, CreditCardPayment, Transaction } from "@prisma/client";
import { createCreditCard, updateCreditCard, deleteCreditCard } from "./actions";
import { generateStatement, updateStatement } from "./statements";
import { TextField, primaryButtonClass, ghostButtonClass, dangerButtonClass } from "@/components/form";
import { formatMoney, ordinal } from "@/lib/format";
import { todayInAppTimeZone } from "@/lib/dueDates";
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
    <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-white rounded-lg border border-slate-200">
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
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm bg-white rounded-lg border border-slate-200">
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

const neutralPillClass = "bg-slate-100 text-slate-500 border-slate-200";

function CardRow({
  card,
  bankAccounts,
  cards,
  statements,
  today,
  expanded,
  onToggle,
  editing,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  pending,
}: {
  card: CreditCard;
  bankAccounts: BankAccount[];
  cards: CreditCard[];
  statements: StatementWithPayments[];
  today: Date;
  expanded: boolean;
  onToggle: () => void;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (e: React.FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [genPending, startGenTransition] = useTransition();
  const [genError, setGenError] = useState<string | null>(null);

  const latestStatement = statements[0];
  const billed = latestStatement ? remainingDueOf(latestStatement) : 0;
  const unbilled = card.currentBalance - billed;
  const utilization = card.creditLimit > 0 ? Math.round((card.currentBalance / card.creditLimit) * 100) : 0;
  const availableCredit = card.creditLimit - card.currentBalance;

  const unpaidStatements = statements.filter((s) => remainingDueOf(s) > 0);
  const statementOptions = unpaidStatements.map((s) => ({
    id: s.id,
    label: s.periodEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    remainingDue: remainingDueOf(s),
  }));

  function handleGenerate() {
    setGenError(null);
    startGenTransition(async () => {
      try {
        await generateStatement(card.id);
      } catch (err) {
        setGenError(err instanceof Error ? err.message : "Could not generate statement.");
      }
    });
  }

  const status = latestStatement ? statementStatusOf(latestStatement, today) : null;

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-4 sm:px-5 py-3.5 text-left hover:bg-slate-50"
      >
        <div>
          <p className="font-medium text-slate-900 text-sm">
            {card.cardName} <span className="text-slate-400 font-normal">· {card.bankName}{card.last4 ? ` ••${card.last4}` : ""}</span>
          </p>
          <p className="text-sm text-slate-500 mt-0.5 tabular-nums">{formatMoney(card.currentBalance)} outstanding</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`text-xs font-medium border rounded-full px-2.5 py-1 whitespace-nowrap ${
              status ? statementStatusStyles[status] : neutralPillClass
            }`}
          >
            {status ? statementStatusLabels[status] : "No statement yet"}
          </span>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 sm:px-5 pb-5 bg-slate-50 border-t border-slate-100">
          {editing ? (
            <form onSubmit={onSaveEdit} className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <button type="button" onClick={onCancelEdit} className={ghostButtonClass}>
                  Cancel
                </button>
                <button type="submit" disabled={pending} className={primaryButtonClass}>
                  Save changes
                </button>
              </div>
            </form>
          ) : (
            <div className="pt-4 space-y-4">
              <p className="text-xs text-slate-500">
                Credit limit {formatMoney(card.creditLimit)} · Available {formatMoney(availableCredit)} ({utilization}% used) · Statement on{" "}
                {ordinal(card.statementDay)} · Due on {ordinal(card.dueDay)}
              </p>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
                  <p className="text-xs text-slate-400">Billed (this statement)</p>
                  <p className="font-medium text-slate-900 tabular-nums mt-0.5">{formatMoney(billed)}</p>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
                  <p className="text-xs text-slate-400">+ Unbilled since</p>
                  <p className="font-medium text-slate-900 tabular-nums mt-0.5">{formatMoney(unbilled)}</p>
                </div>
                <div className="bg-slate-900 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-slate-300">= Total outstanding</p>
                  <p className="font-medium text-white tabular-nums mt-0.5">{formatMoney(card.currentBalance)}</p>
                </div>
              </div>

              {latestStatement ? (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">
                      Statement of {latestStatement.periodEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} —{" "}
                      {formatMoney(latestStatement.statementTotal)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Min due {formatMoney(latestStatement.minimumDue)} · Remaining {formatMoney(remainingDueOf(latestStatement))} · Due{" "}
                      {latestStatement.dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <PayStatementButton
                    cardId={card.id}
                    cardLabel={card.cardName}
                    statementOptions={statementOptions}
                    bankAccounts={bankAccounts}
                    cards={cards}
                  />
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                  <p className="text-slate-600">All {formatMoney(card.currentBalance)} is unbilled. Generate a statement to start tracking bills for this card.</p>
                  <button onClick={handleGenerate} disabled={genPending} className={primaryButtonClass}>
                    {genPending ? "Generating…" : "Generate statement"}
                  </button>
                </div>
              )}
              {genError && <p className="text-xs text-red-600">{genError}</p>}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                {latestStatement && (
                  <button onClick={handleGenerate} disabled={genPending} className="font-medium text-slate-500 hover:text-slate-900 underline">
                    {genPending ? "Generating…" : "Generate new statement"}
                  </button>
                )}
                {statements.length > 0 && (
                  <button onClick={() => setHistoryOpen((v) => !v)} className="font-medium text-slate-500 hover:text-slate-900 underline">
                    {historyOpen ? "Hide" : "View"} statement history ({statements.length})
                  </button>
                )}
                <button onClick={onStartEdit} className="font-medium text-slate-500 hover:text-slate-900 underline">
                  Edit card
                </button>
                <button onClick={onDelete} className="font-medium text-red-500 hover:text-red-700 underline">
                  Delete
                </button>
              </div>

              {historyOpen && (
                <div className="space-y-2">
                  {statements.map((s) => (
                    <StatementRow key={s.id} statement={s} today={today} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CardsManager({
  cards,
  bankAccounts,
  statementsByCard,
}: {
  cards: CreditCard[];
  bankAccounts: BankAccount[];
  statementsByCard: Record<string, StatementWithPayments[]>;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
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

  function toggleExpanded(cardId: string) {
    setExpandedId((prev) => (prev === cardId ? null : cardId));
    setEditingId(null);
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

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
        {cards.length === 0 && !adding && (
          <p className="p-6 text-sm text-slate-500 text-center">No credit cards yet. Add your first one above.</p>
        )}
        {cards.map((card) => (
          <CardRow
            key={card.id}
            card={card}
            bankAccounts={bankAccounts}
            cards={cards}
            statements={statementsByCard[card.id] ?? []}
            today={today}
            expanded={expandedId === card.id}
            onToggle={() => toggleExpanded(card.id)}
            editing={editingId === card.id}
            onStartEdit={() => setEditingId(card.id)}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={(e) => handleUpdate(card.id, e)}
            onDelete={() => handleDelete(card.id, card.cardName)}
            pending={pending}
          />
        ))}
      </div>
    </div>
  );
}
