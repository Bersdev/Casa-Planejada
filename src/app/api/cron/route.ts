import { NextResponse } from "next/server";
import { dueAlerts } from "@/lib/engine";
import { brl, todayBR } from "@/lib/format";
import { cronAuthorized, houseData, loadDump, pushAll, type PushSub } from "@/lib/server";
import type { Household } from "@/lib/types";

export const dynamic = "force-dynamic";

// Roda todo dia às 9h (Brasília): avisa as contas a vencer e mantém o banco ativo.
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const dump = await loadDump();
    const today = todayBR();
    let sent = 0, failed = 0;
    for (const h of dump.households as unknown as Household[]) {
      const data = houseData(dump, h);
      const alerts = dueAlerts(data, today, h.notify_days);
      if (!alerts.length) continue;
      const users = data.members.map((m) => m.user_id);
      const subs = (dump.push_subscriptions as unknown as PushSub[]).filter((s) => users.includes(s.user_id));
      const body = alerts.map((a) => `${a.inDays === 0 ? "Hoje" : `Em ${a.inDays} dia${a.inDays > 1 ? "s" : ""}`}: ${a.name} · ${brl(a.amount)}`).join("\n");
      const r = await pushAll(subs, { title: `${h.name}: contas a vencer`, body, url: "/" });
      sent += r.sent;
      failed += r.failed;
    }
    return NextResponse.json({ ok: true, today, households: dump.households.length, sent, failed });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
