"use client";
import { useMemo } from "react";
import { Plus } from "lucide-react";
import { useHouse } from "@/lib/store";
import { addMonth, cashflow, summary } from "@/lib/engine";
import { brl, monthName, monthShort, pad, pct } from "@/lib/format";
import { Card, Dot, Empty, Money, Stack } from "@/components/ui";
import { ExpenseRow } from "@/components/widgets";
import { ExpenseForm } from "@/components/forms";

export default function Fluxo() {
  const { data, sum, view, month, currentMonth, open } = useHouse();
  const house = view === "house";

  const history = useMemo(() => [-5, -4, -3, -2, -1, 0].map((i) => {
    const m = addMonth(month, i);
    const s = i === 0 ? sum : summary(data, m, currentMonth);
    return house ? { m, inn: s.houseIncome, out: s.houseTotal } : { m, inn: s.incomeBy[view] ?? 0, out: (s.shareBy[view] ?? 0) + (s.personalBy[view] ?? 0) };
  }), [data, sum, month, currentMonth, house, view]);
  const max = Math.max(1, ...history.flatMap((h) => [h.inn, h.out]));
  const cur = history[5];

  const flow = cashflow(data, sum, view);
  const expenses = data.expenses
    .filter((e) => e.date.startsWith(month) && (house ? e.scope === "house" : e.scope === "personal" && (e.owner_id ?? e.created_by) === view))
    .sort((a, b) => b.date.localeCompare(a.date));
  const confirmed = expenses.filter((e) => e.status === "confirmed");
  const total = confirmed.reduce((s, e) => s + Number(e.amount), 0);
  const byCat = data.categories
    .map((c) => ({ c, v: confirmed.filter((e) => e.category_id === c.id).reduce((s, e) => s + Number(e.amount), 0) }))
    .concat([{ c: { id: "", household_id: "", name: "Sem categoria", emoji: "🧾", sort: 99 }, v: confirmed.filter((e) => !e.category_id).reduce((s, e) => s + Number(e.amount), 0) }])
    .filter((x) => x.v > 0).sort((a, b) => b.v - a.v);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
      <div className="space-y-4 lg:col-span-2">
        <Card title="Fluxo de caixa" sub="· últimos 6 meses" icon="fluxo">
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <div><p className="flex items-center gap-1.5 text-xs text-mut"><Dot color="var(--ok)" />Entrou</p><Money v={cur.inn} size="md" /></div>
            <div><p className="flex items-center gap-1.5 text-xs text-mut"><Dot color="var(--navy)" />Saiu</p><Money v={cur.out} size="md" /></div>
            <div><p className="text-xs text-mut">Sobra</p><Money v={cur.inn - cur.out} size="md" className={cur.inn - cur.out < 0 ? "text-bad" : "text-ok"} /></div>
          </div>
          <div className="mt-5 grid h-44 grid-cols-6 gap-2">
            {history.map((h) => (
              <div key={h.m} className="flex flex-col items-center justify-end gap-1.5">
                <div className="flex w-full flex-1 items-end justify-center gap-1">
                  <div title={`Entrou ${brl(h.inn)}`} className="w-1/3 max-w-5 rounded-t-md bg-ok" style={{ height: `${(h.inn / max) * 100}%`, minHeight: 2 }} />
                  <div title={`Saiu ${brl(h.out)}`} className="w-1/3 max-w-5 rounded-t-md bg-navy" style={{ height: `${(h.out / max) * 100}%`, minHeight: 2 }} />
                </div>
                <span className={`text-[11px] ${h.m === month ? "font-bold text-ink" : "text-mut"}`}>{monthShort(h.m)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title={`Extrato de ${monthName(month).toLowerCase()}`} sub="· entradas e saídas previstas, dia a dia">
          {flow.map((r, i) => (
            <div key={i} className="row">
              <span className="w-7 text-xs font-semibold text-mut">{pad(r.day)}</span>
              <span className={`min-w-0 flex-1 truncate ${r.kind === "bill" && !r.paid ? "" : r.kind === "income" ? "" : "text-mut"}`}>{r.label}</span>
              <span className={`font-semibold ${r.amount > 0 ? "text-ok" : ""}`}>{r.amount > 0 ? "+ " : ""}{brl(r.amount)}</span>
              <span className={`hidden w-28 text-right text-xs sm:block ${r.balance < 0 ? "text-bad" : "text-mut"}`}>{brl(r.balance)}</span>
            </div>
          ))}
          {!flow.length && <Empty>Nada lançado neste mês ainda.</Empty>}
        </Card>
      </div>

      <div className="space-y-4">
        <Card title="Gastos do mês" icon="nota" right={<button onClick={() => open(<ExpenseForm />)} className="btn btn-sm"><Plus size={14} />Gasto</button>}>
          <Money v={total} />
          <p className="mt-1 text-xs text-mut">{confirmed.length} lançamento{confirmed.length === 1 ? "" : "s"} · inclui compras no cartão</p>
          {byCat.length > 0 && (
            <div className="mt-4 space-y-2.5">
              {byCat.map(({ c, v }) => (
                <div key={c.id}>
                  <div className="mb-1 flex justify-between text-xs"><span>{c.emoji} {c.name}</span><span className="font-semibold">{brl(v)} <span className="font-normal text-mut">· {pct(v, total)}%</span></span></div>
                  <Stack h={6} parts={[{ v, color: "var(--pri)" }]} total={byCat[0].v} />
                </div>
              ))}
            </div>
          )}
          <div className="mt-3">{expenses.map((e) => <ExpenseRow key={e.id} e={e} />)}</div>
          {!expenses.length && <Empty>Nenhum gasto lançado neste mês.</Empty>}
        </Card>
      </div>
    </div>
  );
}
