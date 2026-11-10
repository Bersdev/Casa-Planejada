// Funções usadas só pelas rotas do servidor (avisos e backup).
import { createClient } from "@supabase/supabase-js";
import { sendNotification, setVapidDetails } from "web-push";
import type { Data, Household } from "./types";

export type Dump = Record<string, Record<string, unknown>[]>;
export interface PushSub { user_id: string; endpoint: string; p256dh: string; auth: string }

export const cronAuthorized = (req: Request) => {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
};

/** Lê todas as casas pelo banco. O banco só responde se o segredo bater com o hash guardado. */
export async function loadDump(): Promise<Dump> {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_KEY!, { auth: { persistSession: false } });
  const { data, error } = await db.rpc("cron_dump", { p_secret: process.env.CRON_SECRET });
  if (error) throw new Error(error.message);
  return data as Dump;
}

export function houseData(dump: Dump, household: Household): Data {
  const d: Record<string, unknown> = { household };
  for (const [table, rows] of Object.entries(dump)) {
    if (table !== "households" && table !== "push_subscriptions") d[table] = rows.filter((r) => r.household_id === household.id);
  }
  return d as unknown as Data;
}

/** Envia um aviso para cada aparelho; devolve quantos chegaram e quantos falharam. */
export async function pushAll(subs: PushSub[], payload: { title: string; body: string; url?: string }) {
  setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:avisos@casaplanejada.app", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const res = await Promise.allSettled(subs.map((s) => sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload))));
  const sent = res.filter((r) => r.status === "fulfilled").length;
  return { sent, failed: res.length - sent };
}
