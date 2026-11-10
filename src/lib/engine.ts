// Motor de cálculo: funções puras que transformam os dados da casa nos números de cada tela.
import type { Bill, Card, Data, Expense, Income, SplitMode } from "./types.ts";

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const monthOf = (date: string) => date.slice(0, 7);
export const pad = (n: number) => String(n).padStart(2, "0");

export function addMonth(m: string, n: number): string {
  const [y, mo] = m.split("-").map(Number);
  const t = y * 12 + (mo - 1) + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
}
export function daysIn(m: string): number {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo, 0).getDate();
}
export const clampDay = (m: string, day: number) => Math.min(Math.max(1, day), daysIn(m));
export function addDays(date: string, n: number): string {
  const [y, mo, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
const active = (x: { kind: string; start_month: string; end_month: string | null }, m: string) =>
  x.kind === "oneoff" ? x.start_month === m : x.start_month <= m && (!x.end_month || x.end_month >= m);

// ---------- Rendas ----------
export interface IncomeLine { income: Income; amount: number; contribution: number; overridden: boolean }

export function incomeLines(d: Data, m: string): IncomeLine[] {
  return d.incomes.filter((i) => active(i, m)).map((income) => {
    const o = d.income_months.find((x) => x.income_id === income.id && x.month === m);
    const amount = Number(o?.amount ?? income.amount);
    const mode = o?.contrib_mode ?? income.contrib_mode;
    const value = Number(o?.contrib_value ?? income.contrib_value);
    const contribution = mode === "full" ? amount : mode === "fixed" ? Math.min(value, amount) : r2((amount * value) / 100);
    return { income, amount, contribution, overridden: !!o };
  });
}

// ---------- Cartões ----------
/** Mês de vencimento da fatura em que cai a parcela i (0 = primeira) de uma compra. */
export function invoiceMonth(card: Pick<Card, "closing_day" | "due_day">, date: string, i = 0): string {
  let close = monthOf(date);
  if (Number(date.slice(8, 10)) > card.closing_day) close = addMonth(close, 1);
  const due = card.due_day > card.closing_day ? close : addMonth(close, 1);
  return addMonth(due, i);
}
/** Divide o total em n parcelas em centavos; a sobra do arredondamento vai na primeira. */
export function installmentAmounts(total: number, n: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  return Array.from({ length: n }, (_, i) => (base + (i === 0 ? cents - base * n : 0)) / 100);
}
export interface InvoiceItem { expense: Expense; n: number; of: number; amount: number }
export interface Invoice { card: Card; month: string; items: InvoiceItem[]; total: number; house: number; personal: Record<string, number>; paid: boolean }

const cardExpenses = (d: Data, cardId: string) =>
  d.expenses.filter((e) => e.method === "card" && e.card_id === cardId && e.status === "confirmed");

export function cardInvoice(d: Data, card: Card, m: string): Invoice {
  const items: InvoiceItem[] = [];
  const personal: Record<string, number> = {};
  let house = 0;
  for (const e of cardExpenses(d, card.id)) {
    const parts = installmentAmounts(Number(e.amount), e.installments);
    for (let i = 0; i < parts.length; i++) {
      if (invoiceMonth(card, e.date, i) !== m) continue;
      items.push({ expense: e, n: i + 1, of: parts.length, amount: parts[i] });
      if (e.scope === "house") house += parts[i];
      else {
        const who = e.owner_id ?? card.owner_id;
        personal[who] = r2((personal[who] ?? 0) + parts[i]);
      }
    }
  }
  const total = r2(items.reduce((s, x) => s + x.amount, 0));
  const paid = !!d.card_invoices.find((x) => x.card_id === card.id && x.month === m)?.paid;
  return { card, month: m, items, total, house: r2(house), personal, paid };
}
/** Limite livre: limite menos tudo que ainda está em faturas não pagas. */
export function cardFree(d: Data, card: Card): number {
  let open = 0;
  for (const e of cardExpenses(d, card.id)) {
    installmentAmounts(Number(e.amount), e.installments).forEach((v, i) => {
      const m = invoiceMonth(card, e.date, i);
      if (!d.card_invoices.find((x) => x.card_id === card.id && x.month === m)?.paid) open += v;
    });
  }
  return r2(Number(card.credit_limit) - open);
}

// ---------- Contas do mês ----------
export interface Payable {
  key: string; kind: "bill" | "invoice" | "work"; id: string; name: string; amount: number; day: number; date: string; paid: boolean;
  payer_id: string | null; house: number; personal: Record<string, number>; is_housing: boolean;
  split_mode: SplitMode; split: Record<string, number>; bill?: Bill; overridden?: boolean;
}

export function payables(d: Data, m: string): Payable[] {
  const out: Payable[] = [];
  const mk = (p: Omit<Payable, "date">): Payable => ({ ...p, day: clampDay(m, p.day), date: `${m}-${pad(clampDay(m, p.day))}` });
  for (const b of d.bills.filter((x) => active(x, m))) {
    const o = d.bill_months.find((x) => x.bill_id === b.id && x.month === m);
    if (o?.skipped) continue;
    const amount = Number(o?.amount ?? b.amount);
    out.push(mk({
      key: `bill:${b.id}`, kind: "bill", id: b.id, name: b.name, amount, day: o?.due_day ?? b.due_day, paid: !!o?.paid, payer_id: b.payer_id,
      house: b.scope === "house" ? amount : 0, personal: b.scope === "personal" && b.owner_id ? { [b.owner_id]: amount } : {},
      is_housing: b.is_housing, split_mode: b.split_mode, split: b.split ?? {}, bill: b, overridden: o?.amount != null,
    }));
  }
  for (const c of d.cards) {
    const inv = cardInvoice(d, c, m);
    if (inv.total <= 0) continue;
    out.push(mk({
      key: `invoice:${c.id}`, kind: "invoice", id: c.id, name: `Fatura ${c.name}`, amount: inv.total, day: c.due_day, paid: inv.paid, payer_id: c.owner_id,
      house: inv.house, personal: inv.personal, is_housing: false, split_mode: "prop", split: {},
    }));
  }
  for (const w of d.work_installments.filter((x) => monthOf(x.due_date) === m)) {
    const work = d.works.find((x) => x.id === w.work_id);
    out.push(mk({
      key: `work:${w.id}`, kind: "work", id: w.id, name: `Obra ${work?.name ?? ""}${w.description ? ` · ${w.description}` : ""}`, amount: Number(w.amount),
      day: Number(w.due_date.slice(8, 10)), paid: w.paid, payer_id: w.payer_id, house: Number(w.amount), personal: {}, is_housing: false, split_mode: "prop", split: {},
    }));
  }
  return out.sort((a, b) => a.day - b.day || a.name.localeCompare(b.name));
}

// ---------- Resumo do mês ----------
export interface Summary {
  month: string; incomes: IncomeLine[]; payables: Payable[];
  incomeBy: Record<string, number>; contribBy: Record<string, number>; houseIncome: number;
  houseBills: number; dailyLimit: number; dailySpent: number; dailyForecast: number; houseTotal: number; houseLeft: number;
  shareBy: Record<string, number>; personalBy: Record<string, number>; leftBy: Record<string, number>;
  housing: number; payTotal: number; payPaid: number; paidCount: number; pending: Expense[];
}

function splitAmount(amount: number, mode: SplitMode, custom: Record<string, number>, ids: string[], weights: Record<string, number>): Record<string, number> {
  let w: Record<string, number> = {};
  if (mode === "custom") for (const id of ids) w[id] = Number(custom[id] ?? 0);
  if (mode === "prop" || Object.values(w).every((v) => !v)) w = mode === "equal" ? {} : { ...weights };
  let sum = ids.reduce((s, id) => s + (w[id] ?? 0), 0);
  if (mode === "equal" || sum <= 0) { for (const id of ids) w[id] = 1; sum = ids.length; }
  const out: Record<string, number> = {};
  for (const id of ids) out[id] = sum ? (amount * (w[id] ?? 0)) / sum : 0;
  return out;
}

export function summary(d: Data, m: string, currentMonth: string): Summary {
  const ids = d.members.map((x) => x.user_id);
  const zero = () => Object.fromEntries(ids.map((id) => [id, 0])) as Record<string, number>;
  const incomes = incomeLines(d, m);
  const incomeBy = zero(), contribBy = zero(), shareBy = zero(), personalBy = zero(), leftBy = zero();
  for (const l of incomes) {
    incomeBy[l.income.member_id] = (incomeBy[l.income.member_id] ?? 0) + l.amount;
    contribBy[l.income.member_id] = (contribBy[l.income.member_id] ?? 0) + l.contribution;
  }
  const houseIncome = r2(Object.values(contribBy).reduce((s, v) => s + v, 0));
  const pays = payables(d, m);
  const monthExp = d.expenses.filter((e) => monthOf(e.date) === m);
  const cash = monthExp.filter((e) => e.status === "confirmed" && e.method !== "card");
  const dailySpent = r2(cash.filter((e) => e.scope === "house").reduce((s, e) => s + Number(e.amount), 0));
  const dailyLimit = Number(d.household.daily_limit);
  const dailyForecast = m < currentMonth ? dailySpent : Math.max(dailyLimit, dailySpent);

  let houseBills = 0, housing = 0;
  const addShare = (amount: number, mode: SplitMode, custom: Record<string, number>) => {
    const parts = splitAmount(amount, mode, custom, ids, contribBy);
    for (const id of ids) shareBy[id] += parts[id];
  };
  for (const p of pays) {
    houseBills += p.house;
    if (p.is_housing) housing += p.house;
    if (p.house) addShare(p.house, p.split_mode, p.split);
    for (const [id, v] of Object.entries(p.personal)) personalBy[id] = (personalBy[id] ?? 0) + v;
  }
  addShare(dailyForecast, "prop", {});
  for (const e of cash.filter((x) => x.scope === "personal")) {
    const who = e.owner_id ?? e.created_by ?? "";
    personalBy[who] = (personalBy[who] ?? 0) + Number(e.amount);
  }
  for (const id of ids) {
    shareBy[id] = r2(shareBy[id]); personalBy[id] = r2(personalBy[id]);
    leftBy[id] = r2(incomeBy[id] - shareBy[id] - personalBy[id]);
  }
  const houseTotal = r2(houseBills + dailyForecast);
  return {
    month: m, incomes, payables: pays, incomeBy, contribBy, houseIncome, houseBills: r2(houseBills), dailyLimit, dailySpent, dailyForecast,
    houseTotal, houseLeft: r2(houseIncome - houseTotal), shareBy, personalBy, leftBy, housing: r2(housing),
    payTotal: r2(pays.reduce((s, p) => s + p.amount, 0)), payPaid: r2(pays.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0)),
    paidCount: pays.filter((p) => p.paid).length, pending: d.expenses.filter((e) => e.status === "pending"),
  };
}

/** Valor de uma conta no filtro escolhido: "house" (casa toda) ou o id de uma pessoa. */
export const payableIn = (p: Payable, view: string) => (view === "house" ? p.house : (p.personal[view] ?? 0));

// ---------- Fluxo de caixa ----------
export interface FlowEntry { day: number; label: string; amount: number; kind: "income" | "bill" | "expense"; paid?: boolean; balance: number }

export function cashflow(d: Data, s: Summary, view: string): FlowEntry[] {
  const m = s.month;
  const rows: Omit<FlowEntry, "balance">[] = [];
  for (const l of s.incomes) {
    const v = view === "house" ? l.contribution : l.income.member_id === view ? l.amount : 0;
    if (v) rows.push({ day: clampDay(m, l.income.day), label: l.income.name, amount: v, kind: "income" });
  }
  for (const p of s.payables) {
    const v = payableIn(p, view);
    if (v) rows.push({ day: p.day, label: p.name, amount: -v, kind: "bill", paid: p.paid });
  }
  if (view !== "house" && s.shareBy[view]) rows.push({ day: 1, label: "Sua parte nas contas da casa", amount: -s.shareBy[view], kind: "bill" });
  for (const e of d.expenses) {
    if (monthOf(e.date) !== m || e.status !== "confirmed" || e.method === "card") continue;
    const mine = view === "house" ? e.scope === "house" : e.scope === "personal" && (e.owner_id ?? e.created_by) === view;
    if (mine) rows.push({ day: Number(e.date.slice(8, 10)), label: e.merchant || "Gasto", amount: -Number(e.amount), kind: "expense", paid: true });
  }
  rows.sort((a, b) => a.day - b.day || b.amount - a.amount);
  let balance = 0;
  return rows.map((r) => ({ ...r, balance: (balance = r2(balance + r.amount)) }));
}

// ---------- Avisos ----------
export interface Alert { name: string; amount: number; date: string; inDays: number; key: string }

/** Contas não pagas: vencidas neste mês, ou vencendo em até `horizon` dias. */
export function upcoming(d: Data, today: string, horizon: number): Alert[] {
  const out: Alert[] = [];
  const last = addDays(today, horizon);
  for (const m of new Set([monthOf(today), monthOf(last)])) {
    for (const p of payables(d, m)) {
      if (p.paid || p.date > last) continue;
      const inDays = Math.round((Date.parse(p.date) - Date.parse(today)) / 86400000);
      out.push({ name: p.name, amount: p.amount, date: p.date, inDays, key: `${p.key}:${m}` });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
/** Avisos do dia para o push: o que vence hoje e o que vence em `daysBefore` dias. */
export const dueAlerts = (d: Data, today: string, daysBefore: number) =>
  upcoming(d, today, daysBefore).filter((a) => a.inDays === 0 || a.inDays === daysBefore);

export const reserveBalance = (d: Data, id: string) =>
  r2(d.reserve_moves.filter((x) => x.reserve_id === id).reduce((s, x) => s + Number(x.amount), 0));
