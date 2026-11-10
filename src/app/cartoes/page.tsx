"use client";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useHouse } from "@/lib/store";
import { addMonth, cardFree, cardInvoice } from "@/lib/engine";
import { brl, fmtDate, monthName, monthShort, pad, pct } from "@/lib/format";
import { Card, Check, Empty, Money, Stack } from "@/components/ui";
import { CardArt } from "@/components/widgets";
import { CardForm, ExpenseForm } from "@/components/forms";

export default function Cartoes() {
  const { data, month, setMonth, houseId, open, run, member } = useHouse();
  const [sel, setSel] = useState("");
  const card = data.cards.find((c) => c.id === sel) ?? data.cards[0];

  if (!card) {
    return (
      <Card title="Cartões" icon="cartao">
        <Empty>Cadastre um cartão para acompanhar as faturas e as compras parceladas. Não pedimos número nem dados do cartão.</Empty>
        <button onClick={() => open(<CardForm />)} className="btn btn-pri mt-4"><Plus size={16} />Novo cartão</button>
      </Card>
    );
  }
  const inv = cardInvoice(data, card, month);
  const free = cardFree(data, card);
  const limit = Number(card.credit_limit);
  const next = [0, 1, 2, 3, 4, 5].map((i) => cardInvoice(data, card, addMonth(month, i)));
  const max = Math.max(1, ...next.map((n) => n.total));
  const setPaid = () => run(supabase.from("card_invoices").upsert({ card_id: card.id, household_id: houseId, month, paid: !inv.paid, paid_at: inv.paid ? null : new Date().toISOString() }));

  return (
    <div className="space-y-4">
      <div className="no-bar -mx-3 flex gap-3 overflow-x-auto px-3 lg:mx-0 lg:px-0">
        {data.cards.map((c) => (
          <CardArt key={c.id} card={c} free={cardFree(data, c)} due={`${pad(c.due_day)}/${month.slice(5)}`} onClick={() => setSel(c.id)}
            className={c.id === card.id ? "ring-2 ring-pri ring-offset-2 ring-offset-bg" : "opacity-60"} />
        ))}
        <button onClick={() => open(<CardForm />)} className="grid aspect-[1.6] w-40 shrink-0 place-items-center rounded-2xl border-2 border-dashed border-line text-sm font-semibold text-mut">
          <span className="flex flex-col items-center gap-1"><Plus size={20} />Novo cartão</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
        <Card className="lg:col-span-2" title={`Fatura de ${monthName(month).toLowerCase()}`} sub={`· ${card.name}`}
          right={<button onClick={() => open(<ExpenseForm cardId={card.id} />)} className="btn btn-sm btn-pri"><Plus size={14} />Compra</button>}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Money v={inv.total} />
              <p className="mt-1 text-xs text-mut">vence dia {pad(card.due_day)} · fecha dia {pad(card.closing_day)} · da casa {brl(inv.house)}</p>
            </div>
            {inv.total > 0 && (
              <label className="flex items-center gap-2 text-sm font-medium">
                <Check on={inv.paid} onClick={setPaid} label="Marcar fatura como paga" />{inv.paid ? "Fatura paga" : "Marcar como paga"}
              </label>
            )}
          </div>
          <div className="mt-4">
            {inv.items.sort((a, b) => b.expense.date.localeCompare(a.expense.date)).map((it) => {
              const cat = data.categories.find((c) => c.id === it.expense.category_id);
              return (
                <button key={it.expense.id} className="row w-full text-left" onClick={() => open(<ExpenseForm expense={it.expense} />)}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-soft">{cat?.emoji ?? "🧾"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{it.expense.merchant || cat?.name || "Compra"}</span>
                    <span className="block text-xs text-mut">{fmtDate(it.expense.date)}{it.of > 1 ? ` · parcela ${it.n}/${it.of}` : ""} · {it.expense.scope === "house" ? "Casa" : (member(it.expense.owner_id)?.name ?? "Pessoal")}</span>
                  </span>
                  <span className="font-semibold">{brl(it.amount)}</span>
                </button>
              );
            })}
            {!inv.items.length && <Empty>Nenhuma compra nesta fatura.</Empty>}
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Limite" icon="cartao" right={<button onClick={() => open(<CardForm card={card} />)} className="btn btn-sm"><Pencil size={13} />Editar</button>}>
            <p className="text-xs text-mut">Limite livre</p>
            <Money v={free} className={free < 0 ? "text-bad" : ""} />
            <div className="mt-3"><Stack parts={[{ v: Math.max(0, limit - free), color: "var(--pri)" }]} total={limit || 1} /></div>
            <p className="mt-1 text-xs text-mut">{pct(limit - free, limit)}% usado de {brl(limit)} · dono: {member(card.owner_id)?.name}</p>
          </Card>
          <Card title="Próximas faturas">
            <div className="grid grid-cols-6 gap-1.5">
              {next.map((n) => (
                <button key={n.month} onClick={() => setMonth(n.month)} className="flex h-36 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] font-semibold text-mut">{n.total ? Math.round(n.total) : ""}</span>
                  <span className={`w-full rounded-md ${n.month === month ? "bg-pri" : "bg-pri/35"}`} style={{ height: `${Math.max(3, (n.total / max) * 70)}%` }} />
                  <span className={`text-[10px] ${n.month === month ? "font-bold" : "text-mut"}`}>{monthShort(n.month).slice(0, 3)}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
