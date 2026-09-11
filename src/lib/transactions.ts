export const EXPENSE_CATEGORIES = [
  "Food & Dining",
  "Groceries",
  "Transport",
  "Shopping",
  "Bills & Utilities",
  "Rent",
  "Entertainment",
  "Health",
  "Other",
];

export const INCOME_CATEGORIES = ["Salary", "Interest", "Gift", "Refund", "Other"];

export const TRANSFER_LABELS: Record<string, string> = {
  bank: "Transfer",
  card: "Credit Card Payment",
  loan: "EMI Payment",
  fund: "Investment",
};

export function deriveTransferCategory(fromType: string, toType: string): string {
  if (fromType === "card") return "Cash Advance";
  return TRANSFER_LABELS[toType] ?? "Transfer";
}

// Combines a fixed default list with any categories the user has already
// used (via a custom-typed category, or a budget set up for one), so those
// become normal selectable options from then on. "Other" always stays last.
export function mergeCategories(defaults: string[], used: string[]): string[] {
  const withoutOther = defaults.filter((c) => c !== "Other");
  const known = new Set(defaults);
  const extra = [...new Set(used.filter((c) => c && !known.has(c)))].sort((a, b) => a.localeCompare(b));
  return [...withoutOther, ...extra, "Other"];
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  bank: "Bank Account",
  card: "Credit Card",
  loan: "Loan",
  fund: "Mutual Fund",
};
