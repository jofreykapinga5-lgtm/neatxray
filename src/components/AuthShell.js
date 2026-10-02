import Link from "next/link";
import Logo from "./Logo";

// Shared frame for the sign-in, create-account and password pages: logo at the top left,
// the form centred below it.
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
        <Link href="/" aria-label="neatx-ray home" className="inline-flex min-h-[44px] items-center">
          <Logo size={34} />
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center sm:pt-0">
        {/* No outline: the soft shadow alone lifts the card off the page. */}
        <div className="card w-full max-w-md space-y-6 p-6 sm:p-8" style={{ border: "none", boxShadow: "0 2px 4px rgba(31, 53, 86, 0.04), 0 16px 40px rgba(31, 53, 86, 0.10)" }}>
          <div className="space-y-1 text-center">
            <h1 className="font-serif text-3xl text-navy">{title}</h1>
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          {children}
          {footer && <div className="pt-1 text-center text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
