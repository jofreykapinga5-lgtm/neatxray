import Link from "next/link";
import Logo from "./Logo";

// Shared frame for the sign-in, create-account and password pages: logo at the top left,
// the form centred below it.
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
        <Link href="/" aria-label="neatx-ray home" className="inline-flex min-h-[44px] items-center">
          <Logo size={34} />
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center sm:pt-0">
        {/* No card: the form sits straight on the page. */}
        <div className="w-full max-w-[22rem] space-y-5">
          <div className="space-y-1 text-center">
            <h1 className="font-serif text-3xl text-navy sm:text-4xl">{title}</h1>
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          {children}
          {footer && <div className="pt-1 text-center text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
