"use client";

import { useState, useTransition } from "react";
import type { MutualFund } from "@prisma/client";
import { createMutualFund, updateMutualFund, deleteMutualFund } from "./actions";
import { TextField, primaryButtonClass, ghostButtonClass, dangerButtonClass } from "@/components/form";
import { formatMoney, ordinal } from "@/lib/format";
import { nextOccurrenceForDay, daysUntil, urgencyFromDays, urgencyStyles } from "@/lib/dueDates";

export default function FundsManager({ funds }: { funds: MutualFund[] }) {
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
        await createMutualFund(formData);
        setAdding(false);
      } catch {
        setError("Could not save fund.");
      }
    });
  }

  function handleUpdate(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateMutualFund(id, formData);
        setEditingId(null);
      } catch {
        setError("Could not save fund.");
      }
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteMutualFund(id);
    });
  }

  const totalInvested = funds.reduce((sum, f) => sum + f.investedValue, 0);
  const totalCurrent = funds.reduce((sum, f) => sum + f.currentValue, 0);
  const gainLoss = totalCurrent - totalInvested;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Mutual Funds</h1>
          <p className="text-sm text-slate-500">
            {funds.length} fund{funds.length !== 1 ? "s" : ""} · Current value {formatMoney(totalCurrent)} ·{" "}
            <span className={gainLoss >= 0 ? "text-emerald-600" : "text-red-600"}>
              {gainLoss >= 0 ? "+" : ""}
              {formatMoney(gainLoss)}
            </span>
          </p>
        </div>
        <button onClick={() => setAdding((v) => !v)} className={primaryButtonClass}>
          {adding ? "Cancel" : "+ Add fund"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {adding && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="Fund name" name="fundName" required placeholder="e.g. Parag Parikh Flexi Cap" />
          <TextField label="Fund house" name="fundHouse" placeholder="e.g. PPFAS" />
          <TextField label="Folio number" name="folioNumber" />
          <TextField label="Category" name="category" placeholder="e.g. equity, debt, hybrid" />
          <TextField label="Units held" name="units" type="number" step="0.0001" />
          <TextField label="Total invested (₹)" name="investedValue" type="number" step="0.01" required />
          <TextField label="Current value (₹)" name="currentValue" type="number" step="0.01" required />
          <TextField label="Monthly SIP amount (₹)" name="sipAmount" type="number" step="0.01" />
          <TextField label="SIP due date (day of month, blank if none)" name="sipDueDay" type="number" min={1} max={31} />
          <TextField label="Notes" name="notes" placeholder="Optional" />
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="submit" disabled={pending} className={primaryButtonClass}>
              Save fund
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {funds.length === 0 && !adding && (
          <p className="p-6 text-sm text-slate-500 text-center">No mutual funds yet. Add your first one above.</p>
        )}
        {funds.map((fund) => {
          const gl = fund.currentValue - fund.investedValue;
          const hasSip = fund.sipDueDay != null;
          const nextDue = hasSip ? nextOccurrenceForDay(fund.sipDueDay!) : null;
          const days = nextDue ? daysUntil(nextDue) : null;
          const urgency = days != null ? urgencyFromDays(days) : null;

          return editingId === fund.id ? (
            <form
              key={fund.id}
              onSubmit={(e) => handleUpdate(fund.id, e)}
              className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <TextField label="Fund name" name="fundName" required defaultValue={fund.fundName} />
              <TextField label="Fund house" name="fundHouse" defaultValue={fund.fundHouse} />
              <TextField label="Folio number" name="folioNumber" defaultValue={fund.folioNumber} />
              <TextField label="Category" name="category" defaultValue={fund.category} />
              <TextField label="Units held" name="units" type="number" step="0.0001" defaultValue={fund.units} />
              <TextField label="Total invested (₹)" name="investedValue" type="number" step="0.01" required defaultValue={fund.investedValue} />
              <TextField label="Current value (₹)" name="currentValue" type="number" step="0.01" required defaultValue={fund.currentValue} />
              <TextField label="Monthly SIP amount (₹)" name="sipAmount" type="number" step="0.01" defaultValue={fund.sipAmount} />
              <TextField label="SIP due date (day of month, blank if none)" name="sipDueDay" type="number" min={1} max={31} defaultValue={fund.sipDueDay} />
              <TextField label="Notes" name="notes" defaultValue={fund.notes} />
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
            <div key={fund.id} className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-medium text-slate-900">
                  {fund.fundName}{" "}
                  {fund.fundHouse && <span className="text-slate-400 font-normal text-sm">· {fund.fundHouse}</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {formatMoney(fund.currentValue)} current ·{" "}
                  <span className={gl >= 0 ? "text-emerald-600" : "text-red-600"}>
                    {gl >= 0 ? "+" : ""}
                    {formatMoney(gl)}
                  </span>
                  {fund.sipAmount ? ` · SIP ${formatMoney(fund.sipAmount)}/mo` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {hasSip && urgency && days != null && (
                  <span className={`text-xs font-medium border rounded-full px-2.5 py-1 ${urgencyStyles[urgency]}`}>
                    SIP {ordinal(fund.sipDueDay!)} ({days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "today" : `in ${days}d`})
                  </span>
                )}
                <button onClick={() => setEditingId(fund.id)} className={ghostButtonClass}>
                  Edit
                </button>
                <button onClick={() => handleDelete(fund.id, fund.fundName)} className={dangerButtonClass}>
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
