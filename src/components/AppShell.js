"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "./Logo";

const Icon = ({ children }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

// Whether the desktop sidebar is collapsed. Remembered in the browser; falls back to memory if storage is blocked.
const SIDEBAR_KEY = "neatx-sidebar";
const listeners = new Set();
let memoryCollapsed = false;
function subscribeSidebar(callback) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}
function readCollapsed() {
  try {
    const saved = localStorage.getItem(SIDEBAR_KEY);
    if (saved) return saved === "collapsed";
  } catch {}
  return memoryCollapsed;
}
function writeCollapsed(value) {
  memoryCollapsed = value;
  try {
    localStorage.setItem(SIDEBAR_KEY, value ? "collapsed" : "open");
  } catch {}
  listeners.forEach((l) => l());
}

const PanelIcon = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
  </Icon>
);

const NAV = [
  {
    href: "/app",
    label: "Scan",
    icon: (
      <Icon>
        <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
        <path d="M8 12h8" />
      </Icon>
    ),
  },
  {
    href: "/app/billing",
    label: "Billing",
    icon: (
      <Icon>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18" />
      </Icon>
    ),
  },
];

function SidebarContent({ email, credits, pathname, onNavigate, onSignOut, onCollapse }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-5 py-5">
        <Link href="/app" aria-label="neatx-ray home" onClick={onNavigate} className="inline-flex min-h-[44px] items-center">
          <Logo size={32} />
        </Link>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-white/70 hover:text-navy"
          >
            <PanelIcon />
          </button>
        )}
      </div>

      <nav aria-label="Main" className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm transition-colors ${
                active ? "bg-white font-semibold text-navy shadow-[0_1px_2px_rgba(31,53,86,0.08)]" : "text-muted hover:bg-white/60 hover:text-navy"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 px-3 pb-4">
        {credits !== null && (
          <Link
            href="/app/billing"
            onClick={onNavigate}
            className={`block rounded-xl px-4 py-3 transition-colors ${credits > 0 ? "bg-white hover:bg-white/80" : "border border-red-300 bg-red-50"}`}
          >
            <span className="block text-xs text-muted">Credits</span>
            <span className={`block text-2xl font-bold tracking-tight ${credits > 0 ? "text-navy" : "text-red-900"}`}>{credits}</span>
            <span className="block text-xs text-muted">{credits > 0 ? "1 credit = 1 scan" : "Add credits to keep scanning"}</span>
          </Link>
        )}
        <div className="px-2">
          <p className="truncate text-xs text-muted" title={email}>
            {email}
          </p>
          <button type="button" onClick={onSignOut} className="mt-1 flex min-h-[44px] w-full items-center gap-3 rounded-xl px-1 text-left text-sm text-muted transition-colors hover:text-navy">
            <Icon>
              <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M16 8l4 4-4 4M20 12H9" />
            </Icon>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

// The signed-in frame: a left sidebar on desktop, a top bar with a menu button on phones.
export default function AppShell({ email, credits = null, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeSidebar, readCollapsed, () => false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const content = { email, credits, pathname, onNavigate: () => setOpen(false), onSignOut: signOut };

  return (
    <div className={`min-h-screen transition-[padding] duration-200 ${collapsed ? "lg:pl-0 lg:pt-12" : "lg:pl-60"}`}>
      {/* Desktop sidebar */}
      <aside
        inert={collapsed}
        className={`fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-white/50 transition-transform duration-200 lg:block ${collapsed ? "-translate-x-full" : ""}`}
      >
        <SidebarContent {...content} onCollapse={() => writeCollapsed(true)} />
      </aside>

      {/* Reopen button while the sidebar is collapsed */}
      {collapsed && (
        <button
          type="button"
          onClick={() => writeCollapsed(false)}
          aria-label="Open sidebar"
          title="Open sidebar"
          className="fixed left-4 top-3 z-30 hidden h-9 w-9 place-items-center rounded-lg bg-white/80 text-muted shadow-[0_1px_2px_rgba(31,53,86,0.1)] transition-colors hover:text-navy lg:grid"
        >
          <PanelIcon />
        </button>
      )}

      {/* Phone top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/95 px-4 py-2 backdrop-blur lg:hidden">
        <Link href="/app" aria-label="neatx-ray home" className="inline-flex min-h-[44px] items-center">
          <Logo size={30} />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="grid h-11 w-11 place-items-center rounded-full text-navy hover:bg-white/60"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>

      {/* Phone menu */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-navy/50" />
          <aside className="motion-sheet absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-bg shadow-[0_0_40px_rgba(31,53,86,0.25)]">
            <SidebarContent {...content} />
          </aside>
        </div>
      )}

      {children}
    </div>
  );
}
