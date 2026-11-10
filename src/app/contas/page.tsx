"use client";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useHouse } from "@/lib/store";
import { brl, monthName, num, parseBRL } from "@/lib/format";
import { Card, Empty, Field, Money, useF } from "@/components/ui";
import { PayRow } from "@/components/widgets";
import { BillForm } from "@/components/forms";

export default function Contas() {
  const { data, sum, month, houseId, open, run, toast } = useHouse();
  const [f, set] = useF({ limit: num(Number(data.household.daily_limit)), cat: "", emoji: "📦" });
  const bills = sum.payables.filter((p) => p.kind === "bill");
  const houseBills = bills.filter((p) => p.house > 0), personal = bills.filter((p) => !p.house);
  const others = sum.payables.filter((p) => p.kind !== "bill");

  const saveLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await run(supabase.from("households").update({ daily_limit: parseBRL(f.limit) }).eq("id", houseId))) toast("Limite atualizado.");
  };
  const addCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.cat.trim()) return;
    if (await run(supabase.from("categories").insert({ household_id: houseId, name: f.cat.trim(), emoji: f.emoji || "📦", sort: data.categories.length + 1 }))) set({ cat: "" });
  };
  const delCat = (id: string, name: string) => confirm(`Excluir a categoria ${name}? Os gastos dela ficam sem categoria.`) && run(supabase.from("categories").delete().eq("id", id));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
      <div className="space-y-4 lg:col-span-2">
        <Card title="Contas da casa" sub={`· ${monthName(month).toLowerCase()}`} icon="contas" right={<button onClick={() => open(<BillForm />)} className="btn btn-sm btn-pri"><Plus size={14} />Conta</button>}>
          <Money v={houseBills.reduce((s, p) => s + p.amount, 0)} />
          <p className="mt-1 text-xs text-mut">{houseBills.length} conta{houseBills.length === 1 ? "" : "s"} · toque no nome para editar o valor, o vencimento ou a divisão</p>
          <div className="mt-3">{houseBills.map((p) => <PayRow key={p.key} p={p} showDay showPayer />)}</div>
          {!houseBills.length && <Empty>Cadastre aluguel, luz, internet e as outras contas que se repetem todo mês.</Empty>}
        </Card>
        <Card title="Contas pessoais" sub="· ficam fora das contas da casa">
          {personal.map((p) => <PayRow key={p.key} p={p} showDay showPayer />)}
          {!personal.length && <Empty>Nenhuma conta pessoal neste mês.</Empty>}
        </Card>
        {others.length > 0 && (
          <Card title="Também vencem neste mês" sub="· faturas e obras">
            {others.map((p) => <PayRow key={p.key} p={p} showDay showPayer />)}
          </Card>
        )}
      </div>
      <div className="space-y-4">
        <Card title="Limite do dia a dia" icon="diaadia">
          <p className="mb-3 text-xs text-mut">Quanto a casa pode gastar por mês com mercado, padaria, farmácia e outros gastos pequenos. Usado: {brl(sum.dailySpent)}.</p>
          <form onSubmit={saveLimit} className="flex items-end gap-2">
            <Field label="Limite mensal (R$)" className="flex-1"><input className="inp" inputMode="decimal" value={f.limit} onChange={(e) => set({ limit: e.target.value })} /></Field>
            <button className="btn h-11">Salvar</button>
          </form>
        </Card>
        <Card title="Categorias de gastos">
          {data.categories.map((c) => (
            <div key={c.id} className="row !py-2">
              <span className="w-6 text-center">{c.emoji}</span><span className="flex-1">{c.name}</span>
              <button onClick={() => delCat(c.id, c.name)} aria-label={`Excluir ${c.name}`} className="text-mut"><Trash2 size={14} /></button>
            </div>
          ))}
          <form onSubmit={addCat} className="mt-3 flex gap-2">
            <input aria-label="Símbolo" className="inp !w-14 text-center" value={f.emoji} onChange={(e) => set({ emoji: e.target.value })} />
            <input aria-label="Nova categoria" className="inp" placeholder="Nova categoria" value={f.cat} onChange={(e) => set({ cat: e.target.value })} />
            <button aria-label="Adicionar categoria" className="btn h-11"><Plus size={16} /></button>
          </form>
        </Card>
      </div>
    </div>
  );
}
