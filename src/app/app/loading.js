import AppShell from "@/components/AppShell";

// Shown while the scan page loads.
export default function Loading() {
  return (
    <AppShell email="" credits={null}>
      <main className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-2" aria-busy="true">
        <div className="h-[22rem] animate-pulse rounded-2xl bg-bg" />
        <div className="h-[22rem] animate-pulse rounded-2xl bg-bg" />
        <p className="sr-only" role="status">Loading</p>
      </main>
    </AppShell>
  );
}
