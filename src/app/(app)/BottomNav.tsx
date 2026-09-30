"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

const ICONS: Record<string, React.ReactNode> = {
  "/dashboard": (
    <path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
  ),
  "/transactions": <path d="M4 7h13M13 3l4 4-4 4M20 17H7M11 21l-4-4 4-4" />,
  "/cards": <><rect x="2.5" y="5" width="19" height="14" rx="2.2" /><path d="M2.5 9.5h19" /></>,
  "/goals": <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" /></>,
};

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function BottomNav({
  primaryItems,
  moreItems,
  email,
  signOutSlot,
}: {
  primaryItems: NavItem[];
  moreItems: NavItem[];
  email?: string | null;
  signOutSlot: React.ReactNode;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // Belt-and-suspenders: whatever triggered the navigation (a Link inside
  // the sheet, sign-out, browser back/forward), never leave the full-screen
  // backdrop mounted on the new page - it would block every tap and all
  // scrolling behind it.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    return pathname === href || (pathname?.startsWith(href + "/") ?? false);
  }

  const moreActive = moreItems.some((item) => isActive(item.href));

  return (
    <>
      <nav
        className="fixed left-1/2 -translate-x-1/2 z-40 w-[calc(100%-32px)] max-w-[368px] bg-surface rounded-[20px] shadow-card flex justify-around px-1.5"
        style={{ bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", paddingTop: "10px", paddingBottom: "10px" }}
      >
        {primaryItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-2 ${active ? "text-accent" : "text-muted"}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="w-5 h-5">
                {ICONS[item.href]}
              </svg>
              <span className="text-[9.5px] font-medium">{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className={`flex flex-col items-center gap-0.5 px-2 ${moreActive ? "text-accent" : "text-muted"}`}
        >
          <MoreIcon />
          <span className="text-[9.5px] font-medium">More</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={() => setMoreOpen(false)}>
          <div
            className="w-full max-w-md bg-surface rounded-t-[24px] p-4 pb-[calc(20px+env(safe-area-inset-bottom,0px))] space-y-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-3" />
            {moreItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={`block px-4 py-3 rounded-xl text-sm font-medium ${
                  isActive(item.href) ? "bg-accent-soft text-accent" : "text-ink hover:bg-bg"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="border-t border-border mt-2 pt-3 px-4 space-y-2">
              {email && <p className="text-xs text-muted truncate">{email}</p>}
              {signOutSlot}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
