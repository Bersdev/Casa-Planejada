import { NextResponse } from "next/server";
import { cronAuthorized, loadDump } from "@/lib/server";

export const dynamic = "force-dynamic";

// Backup completo em JSON, chamado uma vez por mês pelo GitHub Actions.
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const dump = await loadDump();
    delete dump.push_subscriptions;
    return NextResponse.json({ exported_at: new Date().toISOString(), ...dump });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
