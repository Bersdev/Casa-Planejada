"use client";
import { Wifi } from "lucide-react";
import { useHouse } from "@/lib/store";
import { payableIn, type Payable } from "@/lib/engine";
import { brl, fmtDate, pad } from "@/lib/format";
import type { Card as CardT, Expense } from "@/lib/types";
import { BillForm, ExpenseForm } from "./forms";
import { Check, Dot } from "./ui";

const METHOD = { pix: "Pix", card: "Cartão", debit: "Débito", cash: "Dinheiro" };

/** Linha de uma conta do mês, com o círculo de "paga". */
export function PayRow({ p, showPayer, showDay }: { p: Payable; showPayer?: boolean; showDay?: boolean }) {
  const { view, togglePaid, open, member } = useHouse();
  const v = payableIn(p, view) || p.amount;
  return (
    <div className="row">
      <Check on={p.paid} onClick={() => togglePaid(p)} label={`${p.paid ? "Desmarcar" : "Marcar"} ${p.name} como paga`} />
      <button className={`min-w-0 flex-1 truncate text-left ${p.paid ? "text-mut line-through" : ""}`} onClick={() => p.bill && open(<BillForm bill={p.bill} />)}>
        {p.name}
        {showDay && <span className="ml-1.5 text-xs text-mut">dia {pad(p.day)}</span>}
      </button>
      {showPayer && p.payer_id && <span className="flex items-center gap-1 text-xs text-mut"><Dot color={member(p.payer_id)?.color} />{member(p.payer_id)?.name}</span>}
      <span className="font-semibold">{brl(v)}</span>
    </div>
  );
}

export function ExpenseRow({ e }: { e: Expense }) {
  const { data, open, member } = useHouse();
  const cat = data.categories.find((c) => c.id === e.category_id);
  const who = e.scope === "house" ? "Casa" : (member(e.owner_id)?.name ?? "Pessoal");
  return (
    <button className="row w-full text-left" onClick={() => open(<ExpenseForm expense={e} />)}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-soft text-base">{cat?.emoji ?? "🧾"}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{e.merchant || cat?.name || "Gasto"}</span>
        <span className="block truncate text-xs text-mut">{fmtDate(e.date)} · {METHOD[e.method]}{e.installments > 1 ? ` ${e.installments}x` : ""} · {who}</span>
      </span>
      {e.status === "pending" && <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn">Confirmar</span>}
      <span className="font-semibold">{brl(Number(e.amount))}</span>
    </button>
  );
}

/** Ilustração do cartão: sem número nem dados reais. */
export function CardArt({ card, free, due, onClick, className = "" }: { card: CardT; free: number; due: string; onClick?: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`relative flex aspect-[1.6] w-64 shrink-0 flex-col justify-between overflow-hidden rounded-2xl p-4 text-left text-white shadow-md ${className}`}
      style={{ background: `linear-gradient(135deg, ${card.color}, color-mix(in srgb, ${card.color} 70%, #000))` }}>
      <span className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
      <span className="flex items-center justify-between text-sm font-bold tracking-wide">{card.bank || card.name}<Wifi size={16} className="rotate-90 opacity-70" /></span>
      <span>
        <span className="mb-2 block h-6 w-9 rounded-md bg-gradient-to-br from-yellow-200 to-yellow-500 opacity-90" />
        <span className="block truncate text-sm font-semibold uppercase tracking-[0.2em] opacity-90">{card.name}</span>
      </span>
      <span className="flex items-end justify-between text-[10px] uppercase tracking-wider opacity-80">
        <span>Vence<b className="block text-xs">{due}</b></span>
        <span className="text-right">Limite livre<b className="block text-xs">{brl(free)}</b></span>
      </span>
    </button>
  );
}
