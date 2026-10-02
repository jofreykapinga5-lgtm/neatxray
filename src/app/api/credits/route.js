import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { COMPARE_COST, CREDITS_ENABLED, SCAN_COST, getBalance } from "@/lib/credits";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!CREDITS_ENABLED) return NextResponse.json({ enabled: false });
  try {
    return NextResponse.json({ enabled: true, balance: await getBalance(supabase), scanCost: SCAN_COST, compareCost: COMPARE_COST });
  } catch (err) {
    console.error("credits: could not read balance:", err?.message || err);
    return NextResponse.json({ error: "Could not read your credits." }, { status: 503 });
  }
}
