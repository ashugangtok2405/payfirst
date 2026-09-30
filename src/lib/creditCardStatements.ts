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
  paid: "bg-mint-soft text-mint border-mint/30",
  overdue: "bg-coral-soft text-coral border-coral/30",
  partial: "bg-amber-soft text-amber border-amber/30",
  unpaid: "bg-bg text-muted border-border",
};

export const statementStatusLabels: Record<StatementStatus, string> = {
  paid: "Paid",
  overdue: "Overdue",
  partial: "Partially Paid",
  unpaid: "Unpaid",
};
