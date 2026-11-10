import test from "node:test";
import assert from "node:assert/strict";
import { addMonth, cardFree, cardInvoice, cashflow, dueAlerts, installmentAmounts, invoiceMonth, payables, summary, upcoming } from "./engine.ts";
import type { Data } from "./types.ts";

const H = "h1", MAE = "mae", EU = "eu";
const base = (): Data => ({
  household: { id: H, name: "Casa", daily_limit: 500, housing_ref_pct: 30, notify_days: 3 },
  members: [
    { household_id: H, user_id: MAE, name: "Mãe", color: "#f00", role: "owner" },
    { household_id: H, user_id: EU, name: "Eu", color: "#00f", role: "member" },
  ],
  categories: [], income_months: [], reserves: [], bill_months: [], cards: [], card_invoices: [], expenses: [], works: [], work_installments: [], reserve_moves: [],
  incomes: [
    { id: "i1", household_id: H, member_id: MAE, name: "Salário", amount: 6000, day: 5, kind: "recurring", start_month: "2026-01", end_month: null, contrib_mode: "full", contrib_value: 0 },
    { id: "i2", household_id: H, member_id: EU, name: "Salário", amount: 4000, day: 10, kind: "recurring", start_month: "2026-01", end_month: null, contrib_mode: "percent", contrib_value: 50 },
  ],
  bills: [
    { id: "b1", household_id: H, name: "Aluguel", amount: 2000, due_day: 5, kind: "recurring", start_month: "2026-01", end_month: null, payer_id: MAE, scope: "house", owner_id: null, is_housing: true, category_id: null, split_mode: "prop", split: {}, reserve_id: null },
    { id: "b2", household_id: H, name: "Academia", amount: 100, due_day: 31, kind: "recurring", start_month: "2026-01", end_month: null, payer_id: EU, scope: "personal", owner_id: EU, is_housing: false, category_id: null, split_mode: "prop", split: {}, reserve_id: null },
  ],
});
const card = { id: "c1", household_id: H, owner_id: EU, name: "Nu", bank: "Nubank", color: "#808", closing_day: 28, due_day: 5, credit_limit: 3000, default_scope: "personal" as const };
const exp = (o: Partial<Data["expenses"][0]>): Data["expenses"][0] => ({
  id: Math.random().toString(), household_id: H, date: "2026-11-10", amount: 0, merchant: "Loja", category_id: null, method: "pix", card_id: null,
  installments: 1, scope: "house", owner_id: null, created_by: EU, status: "confirmed", receipt_path: null, note: null, ...o,
});

test("meses e parcelas", () => {
  assert.equal(addMonth("2026-12", 1), "2027-01");
  assert.equal(addMonth("2026-01", -1), "2025-12");
  assert.deepEqual(installmentAmounts(100, 3), [33.34, 33.33, 33.33]);
  assert.equal(installmentAmounts(1000, 10).reduce((s, v) => s + v, 0), 1000);
});

test("mês da fatura respeita fechamento e vencimento", () => {
  // fecha 28, vence 5: compra dia 10/nov fecha em nov e vence em dez
  assert.equal(invoiceMonth(card, "2026-11-10"), "2026-12");
  assert.equal(invoiceMonth(card, "2026-11-29"), "2027-01");
  assert.equal(invoiceMonth(card, "2026-11-10", 2), "2027-02");
  // fecha 3, vence 10: mesma fatura vence no próprio mês
  assert.equal(invoiceMonth({ closing_day: 3, due_day: 10 }, "2026-11-02"), "2026-11");
  assert.equal(invoiceMonth({ closing_day: 3, due_day: 10 }, "2026-11-04"), "2026-12");
});

test("resumo: contribuição, divisão proporcional e gastos pessoais", () => {
  const s = summary(base(), "2026-11", "2026-11");
  assert.equal(s.houseIncome, 8000); // 6000 + 50% de 4000
  assert.equal(s.houseTotal, 2500); // aluguel + limite do dia a dia
  assert.equal(s.houseLeft, 5500);
  assert.equal(s.shareBy[MAE], 1875); // 75% de 2500
  assert.equal(s.shareBy[EU], 625);
  assert.equal(s.personalBy[EU], 100);
  assert.equal(s.leftBy[EU], 4000 - 625 - 100);
  assert.equal(s.housing, 2000);
});

test("divisão ajustável por conta e dia a dia real acima do limite", () => {
  const d = base();
  d.bills[0].split_mode = "custom";
  d.bills[0].split = { [MAE]: 100, [EU]: 0 };
  d.expenses.push(exp({ amount: 700 }), exp({ amount: 50, scope: "personal", owner_id: MAE }), exp({ amount: 999, status: "pending" }));
  const s = summary(d, "2026-11", "2026-11");
  assert.equal(s.dailyForecast, 700);
  assert.equal(s.shareBy[MAE], 2000 + 525);
  assert.equal(s.shareBy[EU], 175);
  assert.equal(s.personalBy[MAE], 50);
  assert.equal(s.pending.length, 1);
  // mês passado usa o gasto real, não o limite
  assert.equal(summary(base(), "2026-10", "2026-11").dailyForecast, 0);
});

test("contas: valor só deste mês, pular mês, fim da recorrência e dia 31", () => {
  const d = base();
  d.bill_months.push({ bill_id: "b1", household_id: H, month: "2026-11", amount: 2100, due_day: null, paid: true, skipped: false });
  d.bill_months.push({ bill_id: "b2", household_id: H, month: "2026-11", amount: null, due_day: null, paid: false, skipped: true });
  d.bills[0].end_month = "2026-12";
  const nov = payables(d, "2026-11");
  assert.equal(nov.length, 1);
  assert.equal(nov[0].amount, 2100);
  assert.equal(nov[0].paid, true);
  assert.equal(payables(d, "2026-12").find((p) => p.id === "b1")?.amount, 2000);
  assert.equal(payables(d, "2027-01").some((p) => p.id === "b1"), false);
  assert.equal(payables(d, "2027-02").find((p) => p.id === "b2")?.date, "2027-02-28");
});

test("cartão: fatura parcelada, parte da casa e limite livre", () => {
  const d = base();
  d.cards.push(card);
  d.expenses.push(exp({ method: "card", card_id: "c1", amount: 300, installments: 3, scope: "personal", owner_id: EU }));
  d.expenses.push(exp({ method: "card", card_id: "c1", amount: 80, scope: "house" }));
  const dez = cardInvoice(d, card, "2026-12");
  assert.equal(dez.total, 180);
  assert.equal(dez.house, 80);
  assert.equal(dez.personal[EU], 100);
  assert.equal(cardInvoice(d, card, "2027-02").total, 100);
  assert.equal(cardInvoice(d, card, "2027-03").total, 0);
  assert.equal(cardFree(d, card), 3000 - 380);
  d.card_invoices.push({ card_id: "c1", household_id: H, month: "2026-12", paid: true });
  assert.equal(cardFree(d, card), 3000 - 200);
  const p = payables(d, "2026-12").find((x) => x.kind === "invoice");
  assert.equal(p?.paid, true);
  assert.equal(summary(d, "2026-12", "2026-11").personalBy[EU], 200); // academia + fatura pessoal
});

test("obras entram nas contas do mês", () => {
  const d = base();
  d.works.push({ id: "w1", household_id: H, name: "Casa nova", total_cost: 10000 });
  d.work_installments.push({ id: "wi1", work_id: "w1", household_id: H, due_date: "2026-11-20", amount: 1500, description: "Pedreiro", paid: false, payer_id: MAE });
  const s = summary(d, "2026-11", "2026-11");
  assert.equal(s.houseBills, 3500);
  assert.equal(s.payables.find((p) => p.kind === "work")?.day, 20);
});

test("fluxo de caixa e avisos", () => {
  const d = base();
  const s = summary(d, "2026-11", "2026-11");
  const flow = cashflow(d, s, "house");
  assert.equal(flow.at(-1)?.balance, 8000 - 2000);
  const mine = cashflow(d, s, EU);
  assert.equal(mine.at(-1)?.balance, 4000 - 625 - 100);
  // dia 2: aluguel vence em 3 dias; dia 5: vence hoje; dia 6: vencido aparece no sino, mas não gera push
  assert.deepEqual(dueAlerts(d, "2026-11-02", 3).map((a) => a.name), ["Aluguel"]);
  assert.equal(dueAlerts(d, "2026-11-05", 3)[0].inDays, 0);
  assert.equal(dueAlerts(d, "2026-11-06", 3).length, 0);
  assert.equal(upcoming(d, "2026-11-06", 7)[0].inDays, -1);
  // virada de mês: dia 29/nov enxerga a conta do dia 5/dez só com horizonte suficiente
  assert.equal(upcoming(d, "2026-11-29", 7).some((a) => a.date === "2026-12-05"), true);
});
