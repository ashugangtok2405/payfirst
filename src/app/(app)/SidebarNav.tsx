"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

export default function SidebarNav({
  items,
  className = "",
  onNavigate,
}: {
  items: NavItem[];
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className={className}>
      {items.map((item) => {
        const active = pathname === item.href || (pathname?.startsWith(item.href + "/") ?? false);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              active ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
