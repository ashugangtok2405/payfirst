"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SidebarNav from "./SidebarNav";

type NavItem = { href: string; label: string };

const STORAGE_KEY = "payfirst.sidebarCollapsed";

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="5" x2="17" y2="5" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <line x1="3" y1="15" x2="17" y2="15" />
    </svg>
  );
}

export default function Sidebar({
  items,
  email,
  children,
}: {
  items: NavItem[];
  email?: string | null;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // ignore - localStorage unavailable (private browsing etc.)
    }
  }, []);

  function toggleDesktop() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="text-slate-600 hover:text-slate-900 -ml-1 p-1.5 rounded-lg hover:bg-slate-100"
        >
          <MenuIcon />
        </button>
        <Link href="/dashboard" className="text-lg font-semibold text-slate-900">
          PayFirst
        </Link>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileOpen(false)}>
          <aside className="h-full w-64 max-w-[80vw] bg-white flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <Link href="/dashboard" className="text-lg font-semibold text-slate-900" onClick={() => setMobileOpen(false)}>
                PayFirst
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="text-slate-400 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
            <SidebarNav
              items={items}
              className="flex-1 overflow-y-auto p-2 space-y-0.5"
              onNavigate={() => setMobileOpen(false)}
            />
            <div className="p-4 border-t border-slate-100 space-y-2">
              <p className="text-xs text-slate-500 truncate">{email}</p>
              {children}
            </div>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      {collapsed ? (
        <div className="hidden md:flex md:flex-col items-center w-12 shrink-0 border-r border-slate-200 bg-white py-4">
          <button
            onClick={toggleDesktop}
            title="Show sidebar"
            aria-label="Show sidebar"
            className="text-slate-500 hover:text-slate-900 p-2 rounded-lg hover:bg-slate-100"
          >
            »
          </button>
        </div>
      ) : (
        <aside className="hidden md:flex md:flex-col w-56 shrink-0 border-r border-slate-200 bg-white">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <Link href="/dashboard" className="text-lg font-semibold text-slate-900">
              PayFirst
            </Link>
            <button
              onClick={toggleDesktop}
              title="Hide sidebar"
              aria-label="Hide sidebar"
              className="text-slate-400 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100"
            >
              «
            </button>
          </div>
          <SidebarNav items={items} className="flex-1 overflow-y-auto p-2 space-y-0.5" />
          <div className="p-4 border-t border-slate-100 space-y-2">
            <p className="text-xs text-slate-500 truncate">{email}</p>
            {children}
          </div>
        </aside>
      )}
    </>
  );
}
