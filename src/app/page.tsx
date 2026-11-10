"use client";
import Link from "next/link";
import { useState } from "react";
import { Pencil, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { useHouse } from "@/lib/store";
import { addMonth, cardFree, cardInvoice, payableIn } from "@/lib/engine";
import { brl, monthName, monthShort, pad, pct } from "@/lib/format";
import { Card, Dot, Empty, Money, Seg, Stack } from "@/components/ui";
import { CardArt, ExpenseRow, PayRow } from "@/components/widgets";
import { ExpenseForm } from "@/components/forms";

export default function Overview() {
  const { data, sum, view, month, open, member, userId } = useHouse();
  const [selDay, setSelDay] = useState<number | null>(null);
  const [who, setWho] = useState("all");
  const house = view === "house";

  // Saldo previsto
  const income = house ? sum.houseIncome : (sum.incomeBy[view] ?? 0);
  const invHouse = sum.payables.filter((p) => p.kind === "invoice").reduce((s, p) => s + p.house, 0);
  const parts = house
    ? [{ l: "Contas da casa", v: sum.houseBills - invHouse, color: "var(--navy)" }, { l: "Cartões", v: invHouse, color: "var(--pri)" }, { l: "Dia a dia", v: sum.dailyForecast, color: "#cbd5e1" }]
    : [{ l: "Parte nas contas da casa", v: sum.shareBy[view] ?? 0, color: "var(--navy)" }, { l: "Gastos pessoais", v: sum.personalBy[view] ?? 0, color: "var(--pri)" }];
  const left = house ? sum.houseLeft : (sum.leftBy[view] ?? 0);
  const spent = parts.reduce((s, p) => s + p.v, 0);

  // Contas a pagar
  const pays = sum.payables.filter((p) => payableIn(p, view) > 0);
  const days = [...new Set(pays.map((p) => p.day))];
  const shown = selDay && days.includes(selDay) ? pays.filter((p) => p.day === selDay) : pays;
  const payTotal = pays.reduce((s, p) => s + payableIn(p, view), 0);

  // Cartões
  const cards = data.cards.filter((c) => house || c.owner_id === view);
  const invOf = (m: string) => cards.reduce((s, c) => { const i = cardInvoice(data, c, m); return s + (house ? i.house : (i.personal[view] ?? 0)); }, 0);
  const next = [0, 1, 2].map((i) => ({ m: addMonth(month, i), v: invOf(addMonth(month, i)) }));
  const maxInv = Math.max(1, ...next.map((n) => n.v));

  // Moradia
  const base = who === "all" ? sum.houseIncome : (sum.incomeBy[who] ?? 0);
  const housePct = pct(sum.housing, base);
  const ref = Number(data.household.housing_ref_pct);

  // Obras e dia a dia
  const workPays = sum.payables.filter((p) => p.kind === "work");
  const workTotal = workPays.reduce((s, p) => s + p.amount, 0);
  const monthExp = data.expenses
    .filter((e) => e.date.startsWith(month) && e.status === "confirmed" && (house ? e.scope === "house" : e.scope === "personal" && (e.owner_id ?? e.created_by) === view))
    .sort((a, b) => b.date.localeCompare(a.date));
  const dayUse = pct(sum.dailySpent, sum.dailyLimit);

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:items-start">
      <div className="contents lg:col-span-2 lg:flex lg:flex-col lg:gap-4">
        <Card title="Saldo previsto" icon="saldo" className="order-1">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
            <Money v={left} size="xl" className={left < 0 ? "text-bad" : ""} />
            <div className="border-l border-line pl-4 text-xs text-mut">
              <p className={`flex items-center gap-1 font-semibold ${left < 0 ? "text-bad" : "text-ok"}`}>
                {left < 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}{pct(Math.abs(left), income)}% da renda {left < 0 ? "faltando" : "livre"}
              </p>
              <p>valor estimado após pagar todas as contas de {monthName(month).toLowerCase()}</p>
            </div>
          </div>
          <div className="mt-6"><Stack parts={[...parts, { v: Math.max(0, left), color: "var(--ok)" }]} total={Math.max(income, spent)} /></div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-5">
            <div>
              <p className="text-mut">{house ? "Renda da casa" : "Renda"}</p>
              <Link href="/renda" className="flex items-center gap-1 text-sm font-bold">{brl(income)}<Pencil size={11} className="text-mut" /></Link>
            </div>
            {parts.map((p) => (
              <div key={p.l}>
                <p className="flex items-center gap-1.5 text-mut"><Dot color={p.color} />{p.l}</p>
                <p className="text-sm font-bold">− {brl(p.v)}</p><p className="text-[11px] text-mut">{pct(p.v, income)}% da renda</p>
              </div>
            ))}
            <div>
              <p className="flex items-center gap-1.5 text-mut"><Dot color="var(--ok)" />= Sobra</p>
              <p className={`text-sm font-bold ${left < 0 ? "text-bad" : "text-ok"}`}>{brl(left)}</p><p className="text-[11px] text-mut">{pct(left, income)}% da renda</p>
            </div>
          </div>
        </Card>

        <div className="contents md:order-4 md:grid md:grid-cols-2 md:gap-4">
          <Card title="Divisão da casa" icon="divisao" className="order-4">
            <p className="text-xs text-mut">Total das contas</p>
            <Money v={sum.houseTotal} />
            <div className="mt-4 flex justify-between gap-3 text-xs">
              {data.members.map((m, i) => (
                <div key={m.user_id} className={i % 2 ? "text-right" : ""}>
                  <p className="flex items-center gap-1.5 text-mut"><Dot color={m.color} />{m.user_id === userId ? "Sua renda cobre" : `${m.name} cobre`}</p>
                  <p className="text-sm font-bold">{brl(sum.shareBy[m.user_id] ?? 0)}</p>
                </div>
              ))}
            </div>
            <div className="mt-2"><Stack h={14} parts={data.members.map((m) => ({ v: sum.shareBy[m.user_id] ?? 0, color: m.color }))} /></div>
            <div className="mt-1 flex justify-between text-[11px] font-semibold text-mut">
              {data.members.map((m) => <span key={m.user_id}>{pct(sum.shareBy[m.user_id] ?? 0, sum.houseTotal)}%</span>)}
            </div>
            <p className="mb-1 mt-4 text-xs font-semibold">Quem paga cada conta</p>
            {sum.payables.filter((p) => p.house > 0).map((p) => (
              <div key={p.key} className="row !py-2.5"><Dot color={member(p.payer_id)?.color} /><span className="min-w-0 flex-1 truncate">{p.name}</span><span className="font-semibold">{brl(p.house)}</span></div>
            ))}
            {!sum.payables.some((p) => p.house > 0) && <Empty>Nenhuma conta da casa neste mês.</Empty>}
          </Card>

          <Card title="Cartões" icon="cartao" className="order-5">
            <p className="text-xs text-mut">Fatura de {monthName(month).toLowerCase()}</p>
            <Money v={next[0].v} />
            <Link href="/cartoes" className="btn btn-sm mt-3">Ver faturas</Link>
            {cards.length ? (
              <div className="no-bar -mx-5 mt-4 flex gap-3 overflow-x-auto px-5">
                {cards.map((c) => <CardArt key={c.id} card={c} free={cardFree(data, c)} due={`${pad(c.due_day)}/${month.slice(5)}`} />)}
              </div>
            ) : <div className="mt-4"><Empty>Nenhum cartão cadastrado. <Link href="/cartoes" className="font-semibold text-pri">Cadastrar</Link></Empty></div>}
            <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wider text-mut">Próximas faturas</p>
            <div className="grid grid-cols-3 gap-2">
              {next.map((n, i) => (
                <div key={n.m} className={`flex h-32 flex-col justify-between rounded-xl p-2.5 text-center ${i === 0 ? "border-2 border-pri bg-pri/5" : "bg-soft"}`}>
                  <p className="text-xs font-semibold">{monthShort(n.m)}</p>
                  <div className="mx-auto flex w-full flex-1 items-end px-3 py-2"><div className="w-full rounded-md bg-pri/60" style={{ height: `${Math.max(4, (n.v / maxInv) * 100)}%` }} /></div>
                  <p className={`text-xs font-bold ${i === 0 ? "text-pri" : "text-mut"}`}>{brl(n.v)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card title="Obras" icon="obra" className="order-7" right={<Link href="/casa" className="btn btn-sm">Ver obras</Link>}>
          <Money v={workTotal} />
          <p className="mt-1 text-xs text-mut">parcelas de obra que vencem em {monthName(month).toLowerCase()}</p>
          <div className="mt-3">{workPays.map((p) => <PayRow key={p.key} p={p} showDay />)}</div>
        </Card>
      </div>

      <div className="contents lg:flex lg:flex-col lg:gap-4">
        <Card title="Contas a pagar" icon="contas" className="order-2">
          <Money v={payTotal} />
          <p className="mt-1 text-xs text-mut">{pays.filter((p) => p.paid).length} de {pays.length} pagas</p>
          {days.length > 1 && (
            <div className="no-bar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
              {days.map((d) => (
                <button key={d} onClick={() => setSelDay(selDay === d ? null : d)}
                  className={`h-10 min-w-12 rounded-xl px-3 text-sm font-bold ${selDay === d ? "bg-pri text-white" : "border border-line"}`}>{pad(d)}</button>
              ))}
            </div>
          )}
          <div className="mt-3">{shown.map((p) => <PayRow key={p.key} p={p} showDay={!selDay} />)}</div>
          {!pays.length && <Empty>Nenhuma conta neste mês. <Link href="/contas" className="font-semibold text-pri">Cadastrar contas</Link></Empty>}
        </Card>

        <Card title="Dia a dia" icon="diaadia" className="order-3">
          <p className="text-xs text-mut">Gasto de {monthName(month).toLowerCase()}{house ? ` · limite ${brl(sum.dailyLimit)}` : ""}</p>
          <Money v={house ? sum.dailySpent : monthExp.filter((e) => e.method !== "card").reduce((s, e) => s + Number(e.amount), 0)} />
          {house && (
            <>
              <div className="mt-3"><Stack parts={[{ v: Math.min(sum.dailySpent, sum.dailyLimit), color: dayUse > 100 ? "var(--bad)" : dayUse > 80 ? "var(--warn)" : "var(--ok)" }]} total={sum.dailyLimit} /></div>
              <p className={`mt-1 text-xs font-semibold ${dayUse > 100 ? "text-bad" : "text-mut"}`}>{dayUse > 100 ? `${brl(sum.dailySpent - sum.dailyLimit)} acima do limite` : `${brl(sum.dailyLimit - sum.dailySpent)} disponíveis`}</p>
            </>
          )}
          {sum.pending.length > 0 && (
            <div className="mt-3 rounded-xl bg-warn/10 px-3">
              <p className="pt-2 text-xs font-semibold text-warn">Notas esperando confirmação</p>
              {sum.pending.map((e) => <ExpenseRow key={e.id} e={e} />)}
            </div>
          )}
          <div className="mt-2">{monthExp.slice(0, 4).map((e) => <ExpenseRow key={e.id} e={e} />)}</div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => open(<ExpenseForm />)} className="btn btn-sm flex-1"><Plus size={14} />Gasto</button>
            <Link href="/fluxo" className="btn btn-sm flex-1">Ver todos</Link>
          </div>
        </Card>

        <Card title="Moradia" icon="moradia" className="order-6">
          <p className="text-xs text-mut">Quanto a casa gasta para morar</p>
          <Money v={sum.housing} />
          <p className={`mt-1 text-xs font-semibold ${housePct > ref ? "text-bad" : "text-ok"}`}>{housePct}% da renda <span className="font-normal text-mut">· referência: até {ref}%</span></p>
          <Seg className="mt-3" value={who} onChange={setWho} options={[{ v: "all", l: "Renda de todos" }, ...data.members.map((m) => ({ v: m.user_id, l: `Só ${m.name}` }))]} />
          <div className="relative mt-4">
            <Stack h={10} parts={[{ v: Math.min(housePct, 60), color: housePct > ref ? "var(--bad)" : "var(--ok)" }]} total={60} />
            <span className="absolute -top-1 h-[18px] w-0.5 bg-ink" style={{ left: `${(Math.min(ref, 60) / 60) * 100}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-mut"><span>0%</span><span>60% da renda</span></div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {sum.payables.filter((p) => p.is_housing && p.house > 0).map((p) => (
              <div key={p.key} className="rounded-xl bg-soft px-3 py-2"><p className="truncate text-xs text-mut">{p.name}</p><p className="text-sm font-bold">{brl(p.house)}</p></div>
            ))}
          </div>
          {!sum.housing && <Empty>Marque &quot;Conta de moradia&quot; nas contas de aluguel, luz, internet etc.</Empty>}
        </Card>
      </div>
    </div>
  );
}
