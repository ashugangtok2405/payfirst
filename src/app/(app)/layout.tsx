import { auth, signOut } from "@/lib/auth";
import Sidebar from "./Sidebar";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/transactions", label: "Transactions" },
  { href: "/budgets", label: "Budgets" },
  { href: "/goals", label: "Goals" },
  { href: "/accounts", label: "Bank Accounts" },
  { href: "/cards", label: "Credit Cards" },
  { href: "/loans", label: "Loans" },
  { href: "/mutual-funds", label: "Mutual Funds" },
  { href: "/debts", label: "Other Debts" },
];

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar items={NAV_ITEMS} email={session?.user?.email}>
        <form action={signOutAction}>
          <button className="w-full text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-100">
            Sign out
          </button>
        </form>
      </Sidebar>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 min-w-0">{children}</main>
    </div>
  );
}
