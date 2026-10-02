"use client";

import { Fragment, useEffect, useState, useSyncExternalStore } from "react";
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

function SidebarContent({ email, credits, pathname, onNavigate, onSignOut, onCollapse, report, recents }) {
  const [casesOpen, setCasesOpen] = useState(true);
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
            className="grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-bg hover:text-navy"
          >
            <PanelIcon />
          </button>
        )}
      </div>

      <nav aria-label="Main" className="space-y-1 px-3">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Fragment key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm transition-colors ${
                active ? "bg-bg font-semibold text-navy" : "text-muted hover:bg-bg hover:text-navy"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
            {item.href === "/app" && report && (
              <button
                type="button"
                disabled={report.state === "none"}
                onClick={() => {
                  report.onOpen();
                  onNavigate();
                }}
                className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-muted transition-colors hover:bg-bg hover:text-navy disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-muted"
              >
                <Icon>
                  <path d="M7 3h7l5 5v13H7z" />
                  <path d="M14 3v5h5M10 13h6M10 17h6" />
                </Icon>
                <span className="flex-1">Report</span>
                {report.state === "ready" && <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800">Ready</span>}
                {report.state === "busy" && <span className="rounded-md bg-line px-1.5 py-0.5 text-[11px] text-muted">Working</span>}
              </button>
            )}
            </Fragment>
          );
        })}
      </nav>

      <div className="mt-5 flex min-h-0 flex-1 flex-col px-3">
        {recents ? (
          <>
            <button
              type="button"
              onClick={() => setCasesOpen((o) => !o)}
              aria-expanded={casesOpen}
              aria-controls="recent-cases-list"
              className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-muted transition-colors hover:bg-bg hover:text-navy"
            >
              <Icon>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </Icon>
              <span className="flex-1">Recent cases</span>
              {recents.items.length > 0 && <span className="rounded-md bg-line px-1.5 py-0.5 text-[11px] text-muted">{recents.items.length}</span>}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform ${casesOpen ? "rotate-180" : ""}`}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {!casesOpen ? null : recents.items.length === 0 ? (
              <p id="recent-cases-list" className="px-3 pt-1 text-sm text-muted">No saved cases yet.</p>
            ) : (
              <ul id="recent-cases-list" className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto pb-2">
                {recents.items.map((c) => (
                  <li key={c.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => {
                        recents.onOpen(c.id);
                        onNavigate();
                      }}
                      title={c.title}
                      className="block w-full rounded-xl px-3 py-2 pr-9 text-left transition-colors hover:bg-bg"
                    >
                      <span className="block truncate text-sm text-navy">{c.title}</span>
                      <span className="block truncate text-xs text-muted">
                        {c.when} · {c.hasReport ? "Report ready" : "No report yet"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => recents.onDelete(c.id)}
                      aria-label={`Delete ${c.title}`}
                      className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted opacity-0 transition-opacity hover:text-red-700 focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                    >
                      <Icon>
                        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                      </Icon>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </div>

      <div className="space-y-3 px-3 pb-4">
        {credits !== null && (
          <Link
            href="/app/billing"
            onClick={onNavigate}
            className={`block rounded-xl px-4 py-3 transition-colors ${credits > 0 ? "bg-bg hover:bg-bg/70" : "border border-red-300 bg-red-50"}`}
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
export default function AppShell({ email, credits = null, report = null, recents = null, children }) {
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

  const content = { email, credits, pathname, report, recents, onNavigate: () => setOpen(false), onSignOut: signOut };

  return (
    <div className={`min-h-screen bg-white transition-[padding] duration-200 ${collapsed ? "lg:pl-0 lg:pt-12" : "lg:pl-60"}`}>
      {/* Desktop sidebar */}
      <aside
        inert={collapsed}
        className={`fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-white transition-transform duration-200 lg:block ${collapsed ? "-translate-x-full" : ""}`}
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
          className="fixed left-4 top-3 z-30 hidden h-9 w-9 place-items-center rounded-lg bg-white text-muted shadow-[0_1px_2px_rgba(31,53,86,0.1)] transition-colors hover:text-navy lg:grid"
        >
          <PanelIcon />
        </button>
      )}

      {/* Phone top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/95 px-4 py-2 backdrop-blur lg:hidden">
        <Link href="/app" aria-label="neatx-ray home" className="inline-flex min-h-[44px] items-center">
          <Logo size={30} />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="grid h-11 w-11 place-items-center rounded-full text-navy hover:bg-bg"
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
          <aside className="motion-sheet absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-[0_0_40px_rgba(31,53,86,0.25)]">
            <SidebarContent {...content} />
          </aside>
        </div>
      )}

      {children}
    </div>
  );
}
