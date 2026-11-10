"use client";
import { Plus } from "lucide-react";
import { useHouse } from "@/lib/store";
import { brl, monthName, pad, pct } from "@/lib/format";
import { Avatar, Card, Empty, Money, Stack } from "@/components/ui";
import { IncomeForm } from "@/components/forms";

export default function Renda() {
  const { data, sum, month, open } = useHouse();
  const all = Object.values(sum.incomeBy).reduce((s, v) => s + v, 0);
  return (
    <div className="space-y-4">
      <Card title="Nossa renda" sub={`· ${monthName(month).toLowerCase()}`} icon="renda" right={<button onClick={() => open(<IncomeForm />)} className="btn btn-sm btn-pri"><Plus size={14} />Renda</button>}>
        <p className="text-xs text-mut">Entra na casa</p>
        <Money v={sum.houseIncome} size="xl" />
        <p className="mt-1 text-xs text-mut">de {brl(all)} de renda total da família · {pct(sum.houseIncome, all)}%</p>
        <div className="mt-4"><Stack h={12} parts={data.members.map((m) => ({ v: sum.contribBy[m.user_id] ?? 0, color: m.color }))} /></div>
      </Card>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.members.map((m) => {
          const lines = sum.incomes.filter((l) => l.income.member_id === m.user_id);
          return (
            <Card key={m.user_id} title={<span className="flex items-center gap-2"><Avatar name={m.name} color={m.color} size={24} />{m.name}</span>}>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <Money v={sum.incomeBy[m.user_id] ?? 0} />
                <p className="text-xs text-mut">contribui com <b className="text-ink">{brl(sum.contribBy[m.user_id] ?? 0)}</b> para a casa</p>
              </div>
              <div className="mt-3">
                {lines.map((l) => (
                  <button key={l.income.id} className="row w-full text-left" onClick={() => open(<IncomeForm income={l.income} />)}>
                    <span className="w-12 text-xs text-mut">dia {pad(l.income.day)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{l.income.name}{l.income.kind === "oneoff" && <span className="ml-1.5 rounded-full bg-soft px-1.5 py-0.5 text-[10px] text-mut">só este mês</span>}</span>
                      <span className="block text-xs text-mut">{l.contribution >= l.amount ? "Tudo entra na casa" : `${brl(l.contribution)} entram na casa`}{l.overridden ? " · ajustado neste mês" : ""}</span>
                    </span>
                    <span className="font-semibold">{brl(l.amount)}</span>
                  </button>
                ))}
                {!lines.length && <Empty>Nenhuma renda em {monthName(month).toLowerCase()}.</Empty>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
