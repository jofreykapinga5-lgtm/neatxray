import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Workspace from "@/components/Workspace";
import { CREDITS_ENABLED, getBalance } from "@/lib/credits";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
