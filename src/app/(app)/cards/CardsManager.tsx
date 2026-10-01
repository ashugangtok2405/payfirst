"use client";

import { useState, useTransition } from "react";
import type { CreditCard, BankAccount, CreditCardStatement, CreditCardPayment, Transaction } from "@prisma/client";
import { createCreditCard, updateCreditCard, deleteCreditCard } from "./actions";
import { generateStatement, updateStatement, deleteStatement } from "./statements";
import { TextField, primaryButtonClass, ghostButtonClass, dangerButtonClass } from "@/components/form";
import { formatMoney, ordinal } from "@/lib/format";
import { todayInAppTimeZone, daysUntil, urgencyFromDays, urgencyStyles, urgencyLabels } from "@/lib/dueDates";
import { remainingDueOf, paidAmountOf, statementStatusOf, statementStatusStyles, statementStatusLabels } from "@/lib/creditCardStatements";
import PayCardButton from "./PayCardButton";
import SetDueDateButton from "./SetDueDateButton";

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
    <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-white rounded-xl border border-border">
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
      {error && <p className="text-xs text-coral col-span-full">{error}</p>}
    </form>
  );
}

function StatementRow({ statement, today }: { statement: StatementWithPayments; today: Date }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const remaining = remainingDueOf(statement);
  const paid = paidAmountOf(statement);
  const status = statementStatusOf(statement, today);
  const periodLabel = `${statement.periodStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${statement.periodEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;

  if (editing) return <StatementEditForm statement={statement} onDone={() => setEditing(false)} />;

  function handleDelete() {
    if (!confirm(`Delete the ${periodLabel} statement? Any linked payments become unlinked, not deleted.`)) return;
    startTransition(async () => {
      await deleteStatement(statement.id);
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm bg-white rounded-xl border border-border">
      <div>
        <p className="font-medium text-ink">{periodLabel}</p>
        <p className="text-xs text-muted">
          Statement {formatMoney(statement.statementTotal)} · Min due {formatMoney(statement.minimumDue)} · Paid {formatMoney(paid)} · Remaining {formatMoney(remaining)}
        </p>
        <p className="text-xs text-muted">Due {statement.dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium border rounded-full px-2.5 py-1 ${statementStatusStyles[status]}`}>{statementStatusLabels[status]}</span>
        <button onClick={() => setEditing(true)} className={ghostButtonClass}>
          Edit
        </button>
        <button onClick={handleDelete} disabled={pending} className={dangerButtonClass}>
          Delete
        </button>
      </div>
    </div>
  );
}

const neutralPillClass = "bg-bg text-muted border-border";

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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [genPending, startGenTransition] = useTransition();
  const [genError, setGenError] = useState<string | null>(null);

  const latestStatement = statements[0];
  const billed = latestStatement ? remainingDueOf(latestStatement) : 0;
  const unbilled = card.currentBalance - billed;
  const utilization = card.creditLimit > 0 ? Math.round((card.currentBalance / card.creditLimit) * 100) : 0;
  const availableCredit = card.creditLimit - card.currentBalance;

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

  const days = card.nextDueDate ? daysUntil(card.nextDueDate, today) : null;
  const urgency = days != null ? urgencyFromDays(days) : null;
  const statementStatus = latestStatement ? statementStatusOf(latestStatement, today) : null;

  return (
    <div className={`bg-white rounded-2xl shadow-card overflow-hidden ${expanded ? "lg:col-span-2" : ""}`}>
      <button onClick={onToggle} className="w-full px-4 sm:px-5 py-3.5 text-left hover:bg-bg">
        <p className="font-medium text-ink text-sm truncate">
          {card.cardName} · {card.bankName}
          {card.last4 ? ` ••${card.last4}` : ""}
        </p>
        <div className="flex items-center justify-between gap-3 mt-1">
          <div>
            <p className="text-sm text-muted tabular-nums">{formatMoney(card.currentBalance)} outstanding</p>
            <p className="text-xs text-muted tabular-nums mt-0.5">
              {formatMoney(card.creditLimit)} limit · {utilization}% used
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {card.currentBalance <= 0 ? (
              <span className="text-xs font-medium border rounded-full px-2.5 py-1 whitespace-nowrap bg-mint-soft text-mint border-mint/30">
                Paid off
              </span>
            ) : urgency ? (
              <span className={`text-xs font-medium border rounded-full px-2.5 py-1 whitespace-nowrap ${urgencyStyles[urgency]}`}>
                {urgency === "later" ? card.nextDueDate!.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : urgencyLabels[urgency]}
              </span>
            ) : (
              <span className={`text-xs font-medium border rounded-full px-2.5 py-1 whitespace-nowrap ${neutralPillClass}`}>No date set</span>
            )}
            <svg
              className={`w-4 h-4 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 sm:px-5 pb-5 bg-bg border-t border-border">
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
              <p className="text-xs text-muted">
                Credit limit {formatMoney(card.creditLimit)} · Available {formatMoney(availableCredit)} ({utilization}% used) · Statement on{" "}
                {ordinal(card.statementDay)} · Due on {ordinal(card.dueDay)}
              </p>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-white rounded-xl border border-border px-3 py-2.5">
                  <p className="text-xs text-muted">Billed (this statement)</p>
                  <p className="font-medium text-ink tabular-nums mt-0.5">{formatMoney(billed)}</p>
                </div>
                <div className="bg-white rounded-xl border border-border px-3 py-2.5">
                  <p className="text-xs text-muted">+ Unbilled since</p>
                  <p className="font-medium text-ink tabular-nums mt-0.5">{formatMoney(unbilled)}</p>
                </div>
                <div className="bg-accent rounded-xl px-3 py-2.5">
                  <p className="text-xs text-white/70">= Total outstanding</p>
                  <p className="font-medium text-white tabular-nums mt-0.5">{formatMoney(card.currentBalance)}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-border px-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-ink">
                    {card.nextDueDate
                      ? `Next payment due ${card.nextDueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                      : "No payment date set"}
                  </p>
                  {urgency && (
                    <p className="text-xs text-muted mt-0.5">
                      {days! < 0 ? `${Math.abs(days!)}d overdue` : days === 0 ? "Due today" : `In ${days}d`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <SetDueDateButton cardId={card.id} cardLabel={card.cardName} currentDueDate={card.nextDueDate} />
                  <PayCardButton
                    cardId={card.id}
                    cardLabel={card.cardName}
                    defaultAmount={card.currentBalance}
                    bankAccounts={bankAccounts}
                    cards={cards}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                <button onClick={onStartEdit} className="font-medium text-muted hover:text-ink underline">
                  Edit card
                </button>
                <button onClick={onDelete} className="font-medium text-coral hover:text-coral underline">
                  Delete
                </button>
                <button onClick={() => setAdvancedOpen((v) => !v)} className="font-medium text-muted hover:text-ink underline ml-auto">
                  {advancedOpen ? "Hide" : "Show"} statement tracking (advanced)
                </button>
              </div>

              {advancedOpen && (
                <div className="space-y-3 pt-1 border-t border-border">
                  <p className="text-xs text-muted pt-3">
                    Optional itemized billing based on logged transactions - {statementStatus ? statementStatusLabels[statementStatus] : "no statement yet"}
                    {latestStatement && `, remaining ${formatMoney(remainingDueOf(latestStatement))}`}.
                  </p>
                  <button onClick={handleGenerate} disabled={genPending} className={ghostButtonClass}>
                    {genPending ? "Generating…" : latestStatement ? "Generate new statement" : "Generate statement"}
                  </button>
                  {genError && <p className="text-xs text-coral">{genError}</p>}
                  {statements.length > 0 && (
                    <button onClick={() => setHistoryOpen((v) => !v)} className="block font-medium text-xs text-muted hover:text-ink underline">
                      {historyOpen ? "Hide" : "View"} statement history ({statements.length})
                    </button>
                  )}
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
          <h1 className="text-xl font-semibold text-ink">Credit Cards</h1>
          <p className="text-sm text-muted">
            {cards.length} card{cards.length !== 1 ? "s" : ""} · Outstanding {formatMoney(totalOutstanding)} of {formatMoney(totalLimit)} limit
          </p>
        </div>
        <button onClick={() => setAdding((v) => !v)} className={primaryButtonClass}>
          {adding ? "Cancel" : "+ Add card"}
        </button>
      </div>

      {error && <p className="text-sm text-coral">{error}</p>}

      {adding && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">
        {cards.length === 0 && !adding && (
          <p className="bg-white rounded-2xl shadow-card p-6 text-sm text-muted text-center">No credit cards yet. Add your first one above.</p>
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
