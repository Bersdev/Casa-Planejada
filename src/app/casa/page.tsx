"use client";
import { useState } from "react";
import { Copy, Pencil, Plus, Share2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useHouse } from "@/lib/store";
import { brl, fmtDate, parseBRL, pct } from "@/lib/format";
import type { Member } from "@/lib/types";
import { Avatar, Card, Check, Dot, Empty, Field, Modal, Money, Stack, useF } from "@/components/ui";
import { InstallmentForm, WorkForm } from "@/components/forms";
import { Onboarding } from "@/components/Shell";

const COLORS = ["#2563eb", "#f43f5e", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"];

function MemberForm({ m }: { m: Member }) {
  const { run, close } = useHouse();
  const [f, set] = useF({ name: m.name, color: m.color });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.name.trim() && (await run(supabase.from("members").update({ name: f.name.trim(), color: f.color }).eq("household_id", m.household_id).eq("user_id", m.user_id)))) close();
  };
  return (
    <Modal title="Editar pessoa">
      <form onSubmit={save} className="space-y-3">
        <Field label="Nome"><input className="inp" value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Cor">
          <div className="flex gap-2">{COLORS.map((c) => <button key={c} type="button" aria-label={`Cor ${c}`} onClick={() => set({ color: c })} className={`h-8 w-8 rounded-full ${f.color === c ? "ring-2 ring-pri ring-offset-2 ring-offset-card" : ""}`} style={{ background: c }} />)}</div>
        </Field>
        <button className="btn btn-pri w-full">Salvar</button>
      </form>
    </Modal>
  );
}

export default function Casa() {
  const { data, sum, houseId, userId, open, run, toast, refreshHouses, member } = useHouse();
  const [link, setLink] = useState("");
  const [f, set] = useF({ name: data.household.name, ref: String(Number(data.household.housing_ref_pct)) });

  const invite = async () => {
    const { data: code, error } = await supabase.rpc("create_invite", { p_household: houseId });
    if (error) return toast(error.message);
    setLink(`${location.origin}/?convite=${code}`);
  };
  const share = async () => {
    if (navigator.share) await navigator.share({ title: "Casa Planejada", text: `Entre na nossa casa no Casa Planejada: ${link}` }).catch(() => {});
    else { await navigator.clipboard.writeText(link); toast("Link copiado."); }
  };
  const saveHouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await run(supabase.from("households").update({ name: f.name.trim() || data.household.name, housing_ref_pct: Math.min(100, Math.max(1, parseBRL(f.ref) || 30)) }).eq("id", houseId))) { await refreshHouses(); toast("Casa atualizada."); }
  };
  const togglePart = (id: string, paid: boolean) => run(supabase.from("work_installments").update({ paid: !paid, paid_at: paid ? null : new Date().toISOString() }).eq("id", id));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
      <div className="space-y-4 lg:col-span-2">
        <Card title="Obras" icon="obra" right={<button onClick={() => open(<WorkForm />)} className="btn btn-sm btn-pri"><Plus size={14} />Obra</button>}>
          <p className="mb-3 text-xs text-mut">Parcelas sem juros. Cada parcela entra nas contas do mês em que vence.</p>
          {!data.works.length && <Empty>Nenhuma obra cadastrada.</Empty>}
          <div className="space-y-4">
            {data.works.map((w) => {
              const parts = data.work_installments.filter((x) => x.work_id === w.id).sort((a, b) => a.due_date.localeCompare(b.due_date));
              const planned = parts.reduce((s, x) => s + Number(x.amount), 0);
              const paid = parts.filter((x) => x.paid).reduce((s, x) => s + Number(x.amount), 0);
              const total = Number(w.total_cost) || planned;
              return (
                <div key={w.id} className="rounded-2xl border border-line p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate font-bold">{w.name}</h3>
                    <div className="flex gap-2">
                      <button onClick={() => open(<WorkForm work={w} />)} aria-label="Editar obra" className="btn btn-sm"><Pencil size={13} /></button>
                      <button onClick={() => open(<InstallmentForm work={w} />)} className="btn btn-sm"><Plus size={14} />Parcelas</button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                    <Money v={paid} size="md" />
                    <p className="text-xs text-mut">pago de {brl(total)} · {pct(paid, total)}%{w.total_cost && planned < total ? ` · falta parcelar ${brl(total - planned)}` : ""}</p>
                  </div>
                  <div className="mt-2"><Stack parts={[{ v: paid, color: "var(--ok)" }, { v: Math.max(0, planned - paid), color: "var(--pri)" }]} total={total || 1} /></div>
                  <div className="mt-3">
                    {parts.map((x) => (
                      <div key={x.id} className="row !py-2.5">
                        <Check on={x.paid} onClick={() => togglePart(x.id, x.paid)} label="Marcar parcela como paga" />
                        <button className={`min-w-0 flex-1 truncate text-left ${x.paid ? "text-mut line-through" : ""}`} onClick={() => open(<InstallmentForm work={w} item={x} />)}>
                          {fmtDate(x.due_date)}/{x.due_date.slice(2, 4)} {x.description && <span className="text-mut">· {x.description}</span>}
                        </button>
                        {x.payer_id && <Dot color={member(x.payer_id)?.color} />}
                        <span className="font-semibold">{brl(Number(x.amount))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Divisão da casa" icon="divisao">
          <p className="text-xs text-mut">Quanto das contas da casa cada renda cobre neste mês (só informativo, sem cobrança entre vocês).</p>
          <div className="mt-3"><Stack h={14} parts={data.members.map((m) => ({ v: sum.shareBy[m.user_id] ?? 0, color: m.color }))} /></div>
          <div className="mt-3">
            {data.members.map((m) => (
              <div key={m.user_id} className="row">
                <Dot color={m.color} /><span className="flex-1">{m.name}</span>
                <span className="text-xs text-mut">contribui com {brl(sum.contribBy[m.user_id] ?? 0)}</span>
                <span className="font-semibold">{brl(sum.shareBy[m.user_id] ?? 0)} · {pct(sum.shareBy[m.user_id] ?? 0, sum.houseTotal)}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card title="Quem mora aqui" icon="casa">
          <p className="mb-2 text-xs text-mut">{data.household.name}</p>
          {data.members.map((m) => (
            <button key={m.user_id} className="row w-full text-left" onClick={() => open(<MemberForm m={m} />)}>
              <Avatar name={m.name} color={m.color} /><span className="flex-1 font-medium">{m.name}{m.user_id === userId && <span className="font-normal text-mut"> (você)</span>}</span><Pencil size={13} className="text-mut" />
            </button>
          ))}
          {link ? (
            <div className="mt-3 space-y-2">
              <p className="break-all rounded-xl bg-soft px-3 py-2 text-xs">{link}</p>
              <div className="flex gap-2">
                <button onClick={share} className="btn btn-sm btn-pri flex-1"><Share2 size={14} />Enviar</button>
                <button onClick={async () => { await navigator.clipboard.writeText(link); toast("Link copiado."); }} className="btn btn-sm flex-1"><Copy size={14} />Copiar</button>
              </div>
              <p className="text-[11px] text-mut">O convite vale por 7 dias. Quem abrir o link cria a conta e entra nesta casa.</p>
            </div>
          ) : <button onClick={invite} className="btn mt-3 w-full"><Plus size={16} />Convidar alguém da família</button>}
        </Card>

        <Card title="Dados da casa">
          <form onSubmit={saveHouse} className="space-y-3">
            <Field label="Nome da casa"><input className="inp" value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
            <Field label="Referência de moradia (% da renda)"><input className="inp" inputMode="decimal" value={f.ref} onChange={(e) => set({ ref: e.target.value })} /></Field>
            <button className="btn w-full">Salvar</button>
          </form>
          <button onClick={() => open(<Onboarding inModal />)} className="mt-3 w-full text-center text-sm font-medium text-pri">Criar ou entrar em outra casa</button>
        </Card>
      </div>
    </div>
  );
}
