// Pure calculations shared between the statement-generation server actions
// and the UI. paidAmount/remainingDue/status are always derived from the
// linked payments rather than stored, so they can't drift out of sync.

export type StatementWithPayments = {
  statementTotal: number;
  dueDate: Date;
  payments: { transaction: { amount: number } }[];
};

export function paidAmountOf(statement: StatementWithPayments): number {
  return statement.payments.reduce((sum, p) => sum + p.transaction.amount, 0);
}

export function remainingDueOf(statement: StatementWithPayments): number {
  return Math.max(0, statement.statementTotal - paidAmountOf(statement));
}

export type StatementStatus = "paid" | "overdue" | "partial" | "unpaid";

export function statementStatusOf(statement: StatementWithPayments, today: Date): StatementStatus {
  const remaining = remainingDueOf(statement);
  if (remaining <= 0) return "paid";
  if (today > statement.dueDate) return "overdue";
  return paidAmountOf(statement) > 0 ? "partial" : "unpaid";
}

export const statementStatusStyles: Record<StatementStatus, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
  partial: "bg-amber-50 text-amber-700 border-amber-200",
  unpaid: "bg-slate-100 text-slate-700 border-slate-300",
};

export const statementStatusLabels: Record<StatementStatus, string> = {
  paid: "Paid",
  overdue: "Overdue",
  partial: "Partially Paid",
  unpaid: "Unpaid",
};
