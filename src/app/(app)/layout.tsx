import { auth, signOut } from "@/lib/auth";
import BottomNav from "./BottomNav";
import { ghostButtonClass } from "@/components/form";

const PRIMARY_ITEMS = [
  { href: "/dashboard", label: "Home" },
  { href: "/transactions", label: "Activity" },
  { href: "/cards", label: "Cards" },
  { href: "/goals", label: "Goals" },
];

const MORE_ITEMS = [
  { href: "/calendar", label: "Bill Calendar" },
  { href: "/budgets", label: "Budgets" },
  { href: "/accounts", label: "Bank Accounts" },
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
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-5 pb-28 min-w-0">{children}</main>

      <BottomNav
        primaryItems={PRIMARY_ITEMS}
        moreItems={MORE_ITEMS}
        email={session?.user?.email}
        signOutSlot={
          <form action={signOutAction}>
            <button className={`w-full ${ghostButtonClass}`}>Sign out</button>
          </form>
        }
      />
    </div>
  );
}
