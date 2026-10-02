import AppShell from "@/components/AppShell";

// Shown the instant Billing is clicked, while the real page loads.
export default function Loading() {
  return (
    <AppShell email="" credits={null}>
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-8" aria-busy="true">
        <div className="mb-6 h-9 w-40 animate-pulse rounded-lg bg-bg" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-bg" />
          ))}
        </div>
        <div className="mt-6 h-24 animate-pulse rounded-2xl bg-bg" />
        <p className="sr-only" role="status">Loading billing</p>
      </main>
    </AppShell>
  );
}
