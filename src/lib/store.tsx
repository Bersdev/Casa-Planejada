"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { monthOf, summary, type Payable, type Summary } from "./engine";
import { todayBR } from "./format";
import type { Data, Member } from "./types";

const TABLES = ["members", "categories", "incomes", "income_months", "reserves", "bills", "bill_months", "cards", "card_invoices", "expenses", "works", "work_installments", "reserve_moves"] as const;
type Q = PromiseLike<{ error: { message: string } | null }>;
export type Theme = "light" | "dark" | "system";

interface Ctx {
  ready: boolean; session: Session | null; userId: string;
  houses: { id: string; name: string }[]; houseId: string | null; setHouseId: (id: string) => void; refreshHouses: () => Promise<void>;
  data: Data | null; sum: Summary | null; reload: () => Promise<void>;
  month: string; setMonth: (m: string) => void; view: string; setView: (v: string) => void; today: string; currentMonth: string;
  theme: Theme; setTheme: (t: Theme) => void;
  toast: (msg: string) => void; run: (...qs: Q[]) => Promise<boolean>;
  open: (node: ReactNode) => void; close: () => void; modal: ReactNode;
  togglePaid: (p: Payable) => Promise<boolean>; member: (id: string | null | undefined) => Member | undefined;
}
const AppCtx = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(AppCtx);
/** Para telas que só aparecem com a casa carregada. */
export const useHouse = () => {
  const c = useContext(AppCtx);
  return { ...c, data: c.data!, sum: c.sum!, houseId: c.houseId! };
};

async function all(table: string, houseId: string) {
  const out: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select("*").eq("household_id", houseId).range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}
async function fetchData(id: string): Promise<Data> {
  const [h, ...rest] = await Promise.all([supabase.from("households").select("*").eq("id", id).single(), ...TABLES.map((t) => all(t, id))]);
  if (h.error) throw h.error;
  const d = { household: h.data } as Record<string, unknown>;
  TABLES.forEach((t, i) => (d[t] = rest[i]));
  const data = d as unknown as Data;
  data.categories.sort((a, b) => a.sort - b.sort);
  data.members.sort((a, b) => a.name.localeCompare(b.name));
  return data;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [houses, setHouses] = useState<{ id: string; name: string }[]>([]);
  const [houseId, setHouse] = useState<string | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [today, setToday] = useState(todayBR);
  const [month, setMonth] = useState(() => monthOf(todayBR()));
  const [view, setView] = useState("house");
  const [theme, setThemeState] = useState<Theme>("system");
  const [modal, setModal] = useState<ReactNode>(null);
  const [toastMsg, setToastMsg] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const uid = useRef("");
  const userId = session?.user.id ?? "";

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastMsg(""), 4000);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("cp-theme", t);
    const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  useEffect(() => {
    setThemeState((localStorage.getItem("cp-theme") as Theme) ?? "system");
    const code = new URLSearchParams(location.search).get("convite");
    if (code) localStorage.setItem("cp-invite", code);
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      // Ao trocar de usuário, volta para "carregando" até as casas dele chegarem
      if (s && s.user.id !== uid.current) setReady(false);
      uid.current = s?.user.id ?? "";
      setSession(s);
      if (!s) { setHouses([]); setData(null); setHouse(null); setReady(true); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshHouses = useCallback(async () => {
    if (!userId) return;
    // Um link de convite nunca entra sozinho numa casa: a tela pede confirmação (ver Shell)
    const { data: rows, error } = await supabase.from("members").select("name, households(id, name)").eq("user_id", userId);
    if (error) { toast(error.message); setReady(true); return; }
    const list = (rows ?? []).map((r) => r.households as unknown as { id: string; name: string }).filter(Boolean);
    setHouses(list);
    const saved = localStorage.getItem("cp-house");
    setHouse(list.find((h) => h.id === saved)?.id ?? list[0]?.id ?? null);
    if (!list.length) setReady(true);
  }, [userId, toast]);

  useEffect(() => { refreshHouses(); }, [refreshHouses]);

  const reload = useCallback(async () => {
    if (!houseId) return;
    try { setData(await fetchData(houseId)); } catch (e) { toast((e as Error).message); }
    setReady(true);
  }, [houseId, toast]);

  useEffect(() => { setData(null); reload(); }, [reload]);

  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") { setToday(todayBR()); reload(); } };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [reload]);

  const setHouseId = useCallback((id: string) => { localStorage.setItem("cp-house", id); setView("house"); setHouse(id); }, []);

  const run = useCallback(async (...qs: Q[]) => {
    const res = await Promise.all(qs);
    const err = res.find((r) => r.error)?.error;
    if (err) toast(err.message);
    await reload();
    return !err;
  }, [reload, toast]);

  const currentMonth = monthOf(today);
  const sum = useMemo(() => (data ? summary(data, month, currentMonth) : null), [data, month, currentMonth]);

  const togglePaid = useCallback(async (p: Payable) => {
    if (!houseId) return false;
    const paid = !p.paid, paid_at = paid ? new Date().toISOString() : null;
    if (p.kind === "invoice") return run(supabase.from("card_invoices").upsert({ card_id: p.id, household_id: houseId, month, paid, paid_at }));
    if (p.kind === "work") return run(supabase.from("work_installments").update({ paid, paid_at }).eq("id", p.id));
    const qs: Q[] = [supabase.from("bill_months").upsert({ bill_id: p.id, household_id: houseId, month, paid, paid_at })];
    if (p.bill?.reserve_id) {
      qs.push(paid
        ? supabase.from("reserve_moves").insert({ reserve_id: p.bill.reserve_id, household_id: houseId, date: today, amount: p.amount, note: p.name, bill_id: p.id, month, created_by: userId })
        : supabase.from("reserve_moves").delete().eq("bill_id", p.id).eq("month", month));
    }
    return run(...qs);
  }, [houseId, month, run, today, userId]);

  const member = useCallback((id: string | null | undefined) => data?.members.find((m) => m.user_id === id), [data]);
  const open = useCallback((node: ReactNode) => setModal(node), []);
  const close = useCallback(() => setModal(null), []);

  const value: Ctx = {
    ready, session, userId, houses, houseId, setHouseId, refreshHouses, data, sum, reload, month, setMonth, view, setView, today, currentMonth,
    theme, setTheme, toast, run, open, close, modal, togglePaid, member,
  };
  return (
    <AppCtx.Provider value={value}>
      {children}
      {toastMsg && (
        <div className="fixed left-1/2 bottom-24 lg:bottom-8 -translate-x-1/2 z-[70] max-w-[90vw] rounded-xl bg-ink text-bg px-4 py-3 text-sm font-medium shadow-lg">{toastMsg}</div>
      )}
    </AppCtx.Provider>
  );
}
