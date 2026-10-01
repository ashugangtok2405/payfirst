"use client";

import { useState, useTransition } from "react";
import type { BankAccount } from "@prisma/client";
import { createBankAccount, updateBankAccount, deleteBankAccount } from "./actions";
import { TextField, SelectField, primaryButtonClass, ghostButtonClass } from "@/components/form";
import ConfirmButton from "@/components/ConfirmButton";
import { formatMoney } from "@/lib/format";

const ACCOUNT_TYPES = [
  { value: "savings", label: "Savings" },
  { value: "current", label: "Current" },
  { value: "salary", label: "Salary" },
  { value: "nri", label: "NRI" },
  { value: "other", label: "Other" },
];

export default function AccountsManager({ accounts }: { accounts: BankAccount[] }) {
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
        await createBankAccount(formData);
        setAdding(false);
      } catch {
        setError("Could not save account.");
      }
    });
  }

  function handleUpdate(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateBankAccount(id, formData);
        setEditingId(null);
      } catch {
        setError("Could not save account.");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteBankAccount(id);
    });
  }

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Bank Accounts</h1>
          <p className="text-sm text-muted">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""} · Total balance {formatMoney(totalBalance)}
          </p>
        </div>
        <button onClick={() => setAdding((v) => !v)} className={primaryButtonClass}>
          {adding ? "Cancel" : "+ Add account"}
        </button>
      </div>

      {error && <p className="text-sm text-coral">{error}</p>}

      {adding && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="Account name" name="accountName" required placeholder="e.g. Primary Savings" />
          <TextField label="Bank name" name="bankName" required placeholder="e.g. HDFC Bank" />
          <SelectField label="Account type" name="accountType" options={ACCOUNT_TYPES} defaultValue="savings" />
          <TextField label="Last 4 digits" name="last4" placeholder="1234" />
          <TextField label="Current balance (₹)" name="balance" type="number" step="0.01" defaultValue={0} />
          <TextField label="Notes" name="notes" placeholder="Optional" />
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="submit" disabled={pending} className={primaryButtonClass}>
              Save account
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">
        {accounts.length === 0 && !adding && (
          <p className="bg-white rounded-2xl shadow-card p-6 text-sm text-muted text-center">No bank accounts yet. Add your first one above.</p>
        )}
        {accounts.map((account) =>
          editingId === account.id ? (
            <form
              key={account.id}
              onSubmit={(e) => handleUpdate(account.id, e)}
              className="lg:col-span-2 bg-white rounded-2xl shadow-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <TextField label="Account name" name="accountName" required defaultValue={account.accountName} />
              <TextField label="Bank name" name="bankName" required defaultValue={account.bankName} />
              <SelectField label="Account type" name="accountType" options={ACCOUNT_TYPES} defaultValue={account.accountType} />
              <TextField label="Last 4 digits" name="last4" defaultValue={account.last4} />
              <TextField label="Current balance (₹)" name="balance" type="number" step="0.01" defaultValue={account.balance} />
              <TextField label="Notes" name="notes" defaultValue={account.notes} />
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
            <div key={account.id} className="bg-white rounded-2xl shadow-card p-4 sm:p-5">
              <p className="font-medium text-ink text-sm truncate">
                {account.accountName} · {account.bankName}
                {account.last4 ? ` ••${account.last4}` : ""}{" "}
                <span className="text-muted font-normal capitalize">({account.accountType} Account)</span>
              </p>
              <div className="flex items-center justify-between gap-3 mt-2">
                <p className="font-semibold text-ink tabular-nums">{formatMoney(account.balance)}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setEditingId(account.id)} className={ghostButtonClass}>
                    Edit
                  </button>
                  <ConfirmButton
                    message={`Delete "${account.accountName}"? This cannot be undone.`}
                    onConfirm={() => handleDelete(account.id)}
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
