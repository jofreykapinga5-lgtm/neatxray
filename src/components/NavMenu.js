"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#safety", label: "Safety" },
  { href: "#faq", label: "FAQ" },
];

export default function NavMenu({ cta }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="flex items-center gap-8">
      <nav className="hidden md:flex items-center gap-7 text-sm text-navy" aria-label="Main">
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} className="py-2.5 hover:text-navy hover:underline underline-offset-4">
            {l.label}
          </a>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <Link href={cta.href} className="btn-primary hidden md:inline-flex items-center">
          {cta.label}
        </Link>
        <button
          type="button"
          className="md:hidden btn-ghost !px-3 inline-flex items-center justify-center bg-white/60"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>
      </div>

      {open && (
        <div id="mobile-menu" className="motion-pop md:hidden absolute left-4 right-4 top-full z-20 card p-2">
          <ul>
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-4 py-3 text-navy hover:bg-bg"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
