"use client";
import { CalendarPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useHouse } from "@/lib/store";
import { reserveBalance } from "@/lib/engine";
import { brl, fmtDate, pct } from "@/lib/format";
import { Card, Empty, Money, Stack } from "@/components/ui";
import { BillForm, MoveForm, ReserveForm } from "@/components/forms";

export default function Reserva() {
  const { data, open, run } = useHouse();
  const total = data.reserves.reduce((s, r) => s + reserveBalance(data, r.id), 0);
  const del = (id: string) => confirm("Excluir este lançamento da reserva?") && run(supabase.from("reserve_moves").delete().eq("id", id));

  return (
    <div className="space-y-4">
      <Card title="Nossa reserva" icon="reserva" right={<button onClick={() => open(<ReserveForm />)} className="btn btn-sm btn-pri"><Plus size={14} />Reserva</button>}>
        <p className="text-xs text-mut">Total guardado</p>
        <Money v={total} size="xl" />
      </Card>
      {!data.reserves.length && <Empty>Crie uma reserva (emergência, viagem...) e planeje um depósito mensal. O depósito aparece nas contas do mês e entra no saldo quando você marca como feito.</Empty>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.reserves.map((r) => {
          const bal = reserveBalance(data, r.id);
          const moves = data.reserve_moves.filter((m) => m.reserve_id === r.id).sort((a, b) => b.date.localeCompare(a.date));
          const plan = data.bills.find((b) => b.reserve_id === r.id && !b.end_month);
          return (
            <Card key={r.id} title={<span className="text-base">{r.emoji} {r.name}</span>} right={<button onClick={() => open(<ReserveForm reserve={r} />)} aria-label="Editar reserva" className="btn btn-sm"><Pencil size={13} /></button>}>
              <Money v={bal} />
              {r.goal ? (
                <>
                  <div className="mt-3"><Stack parts={[{ v: Math.min(bal, Number(r.goal)), color: "var(--ok)" }]} total={Number(r.goal)} /></div>
                  <p className="mt-1 text-xs text-mut">{pct(bal, Number(r.goal))}% da meta de {brl(Number(r.goal))}</p>
                </>
              ) : <p className="mt-1 text-xs text-mut">Sem meta definida</p>}
              <div className="mt-3 flex gap-2">
                <button onClick={() => open(<MoveForm reserve={r} balance={bal} />)} className="btn btn-sm flex-1"><Plus size={14} />Guardar ou retirar</button>
                <button onClick={() => open(plan ? <BillForm bill={plan} /> : <BillForm preset={{ name: `Guardar em ${r.name}`, reserve_id: r.id, kind: "recurring" }} />)} className="btn btn-sm flex-1">
                  <CalendarPlus size={14} />{plan ? `${brl(Number(plan.amount))}/mês` : "Depósito mensal"}
                </button>
              </div>
              <div className="mt-3">
                {moves.slice(0, 8).map((m) => (
                  <div key={m.id} className="row !py-2.5">
                    <span className="w-11 text-xs text-mut">{fmtDate(m.date)}</span>
                    <span className="min-w-0 flex-1 truncate">{m.note || (m.amount > 0 ? "Depósito" : "Retirada")}</span>
                    <span className={`font-semibold ${m.amount > 0 ? "text-ok" : "text-bad"}`}>{m.amount > 0 ? "+ " : ""}{brl(Number(m.amount))}</span>
                    {!m.bill_id && <button onClick={() => del(m.id)} aria-label="Excluir lançamento" className="text-mut"><Trash2 size={14} /></button>}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
