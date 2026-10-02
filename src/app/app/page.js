import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Workspace from "@/components/Workspace";
import { CREDITS_ENABLED, getBalance } from "@/lib/credits";

export default async function Home() {
  const supabase = await createClient();
  // The proxy has already verified the sign-in; read the token locally instead of a second network call.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  if (!user) redirect("/login");
  let credits = null;
  if (CREDITS_ENABLED) {
    try {
      credits = await getBalance(supabase);
    } catch (err) {
      console.error("app: could not read credits:", err?.message || err);
    }
  }
  return <Workspace email={user.email} initialCredits={credits} />;
}
