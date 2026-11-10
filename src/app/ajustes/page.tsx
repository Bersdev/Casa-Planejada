"use client";
import { useEffect, useState } from "react";
import { BellRing, Download, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useHouse, type Theme } from "@/lib/store";
import type { Data } from "@/lib/types";
import { Card, Field, Seg, useF } from "@/components/ui";

const METHOD = { pix: "Pix", card: "Cartão", debit: "Débito", cash: "Dinheiro" };

function toBytes(base64url: string) {
  const b = atob(base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64url.length / 4) * 4, "="));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

/** Tabelas legíveis (nomes em vez de códigos), separadas por ";" para abrir direto no Excel. */
function buildCsv(d: Data) {
  const who = (id: string | null) => d.members.find((m) => m.user_id === id)?.name ?? "";
  const scope = (x: { scope: string; owner_id: string | null }) => (x.scope === "house" ? "Casa" : who(x.owner_id));
  const cat = (id: string | null) => d.categories.find((c) => c.id === id)?.name ?? "";
  const tables: Record<string, Record<string, unknown>[]> = {
    Gastos: d.expenses.map((e) => ({ data: e.date, valor: e.amount, estabelecimento: e.merchant, categoria: cat(e.category_id), forma: METHOD[e.method], cartao: d.cards.find((c) => c.id === e.card_id)?.name ?? "", parcelas: e.installments, de_quem: scope(e), situacao: e.status === "pending" ? "pendente" : "confirmado" })),
    Contas: d.bills.map((b) => ({ nome: b.name, valor: b.amount, dia: b.due_day, tipo: b.kind === "recurring" ? "todo mês" : "avulsa", inicio: b.start_month, fim: b.end_month ?? "", quem_paga: who(b.payer_id), de_quem: scope(b), moradia: b.is_housing ? "sim" : "não" })),
    "Contas por mês": d.bill_months.map((m) => ({ conta: d.bills.find((b) => b.id === m.bill_id)?.name ?? "", mes: m.month, valor_do_mes: m.amount ?? "", paga: m.paid ? "sim" : "não", pulada: m.skipped ? "sim" : "não" })),
    Rendas: d.incomes.map((i) => ({ nome: i.name, de_quem: who(i.member_id), valor: i.amount, dia: i.day, tipo: i.kind === "recurring" ? "todo mês" : "avulsa", inicio: i.start_month, fim: i.end_month ?? "", entra_na_casa: i.contrib_mode === "full" ? "tudo" : i.contrib_mode === "fixed" ? i.contrib_value : `${i.contrib_value}%` })),
    Cartões: d.cards.map((c) => ({ apelido: c.name, banco: c.bank, dono: who(c.owner_id), fechamento: c.closing_day, vencimento: c.due_day, limite: c.credit_limit })),
    Obras: d.work_installments.map((w) => ({ obra: d.works.find((x) => x.id === w.work_id)?.name ?? "", vencimento: w.due_date, valor: w.amount, descricao: w.description, paga: w.paid ? "sim" : "não", quem_paga: who(w.payer_id) })),
    Reservas: d.reserve_moves.map((m) => ({ reserva: d.reserves.find((r) => r.id === m.reserve_id)?.name ?? "", data: m.date, valor: m.amount, anotacao: m.note })),
  };
  const cell = (v: unknown) => {
    const s = typeof v === "number" ? String(v).replace(".", ",") : String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return Object.entries(tables).map(([name, rows]) => [name, rows.length ? Object.keys(rows[0]).join(";") : "(vazio)", ...rows.map((r) => Object.values(r).map(cell).join(";"))].join("\n")).join("\n\n");
}

export default function Ajustes() {
  const { data, houseId, userId, session, theme, setTheme, run, toast, today } = useHouse();
  const [f, set] = useF({ days: String(data.household.notify_days) });
  const [push, setPush] = useState<"on" | "off" | "unsupported">("off");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setPush("unsupported");
    navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then((s) => setPush(s && Notification.permission === "granted" ? "on" : "off"));
  }, []);

  const enable = async () => {
    if (push === "unsupported") return toast("No iPhone, os avisos só funcionam com o app instalado: Compartilhar → Adicionar à Tela de Início.");
    if ((await Notification.requestPermission()) !== "granted") return toast("Permissão de avisos negada. Libere nas configurações do aparelho.");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) }));
      const j = sub.toJSON();
      const { error } = await supabase.from("push_subscriptions").upsert({ user_id: userId, endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth }, { onConflict: "endpoint" });
      if (error) throw error;
      setPush("on");
      toast("Avisos ativados neste aparelho.");
    } catch (e) { toast(`Não consegui ativar os avisos: ${(e as Error).message}`); }
  };
  const test = async () => {
    const res = await fetch("/api/push-test", { method: "POST", headers: { authorization: `Bearer ${session?.access_token}` } });
    const j = await res.json().catch(() => ({}));
    toast(res.ok ? `Aviso de teste enviado para ${j.sent} aparelho(s).` : (j.error ?? "Falha ao enviar o teste."));
  };
  const saveDays = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await run(supabase.from("households").update({ notify_days: Math.min(15, Math.max(0, Number(f.days) || 0)) }).eq("id", houseId))) toast("Antecedência atualizada.");
  };
  const exportCsv = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + buildCsv(data)], { type: "text/csv;charset=utf-8" }));
    a.download = `casa-planejada-${today}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
      <Card title="Avisos de vencimento">
        <p className="mb-3 text-xs text-mut">Todo dia às 9h o app avisa as contas que vencem hoje e as que vencem daqui a alguns dias. Cada pessoa ativa no próprio aparelho.</p>
        <div className="flex gap-2">
          <button onClick={enable} className={`btn flex-1 ${push === "on" ? "" : "btn-pri"}`}><BellRing size={16} />{push === "on" ? "Avisos ativos" : "Ativar neste aparelho"}</button>
          {push === "on" && <button onClick={test} className="btn">Testar</button>}
        </div>
        <form onSubmit={saveDays} className="mt-3 flex items-end gap-2">
          <Field label="Avisar quantos dias antes" className="flex-1"><input className="inp" inputMode="numeric" value={f.days} onChange={(e) => set({ days: e.target.value })} /></Field>
          <button className="btn h-11">Salvar</button>
        </form>
      </Card>
      <Card title="Tema">
        <Seg value={theme} onChange={(t: Theme) => setTheme(t)} options={[{ v: "light", l: "Claro" }, { v: "dark", l: "Escuro" }, { v: "system", l: "Do aparelho" }]} />
      </Card>
      <Card title="Backup">
        <p className="mb-3 text-xs text-mut">Baixe todos os dados da casa em um arquivo que abre no Excel. Uma cópia completa também é salva todo mês no seu GitHub.</p>
        <button onClick={exportCsv} className="btn w-full"><Download size={16} />Exportar tudo (CSV)</button>
      </Card>
      <Card title="Conta">
        <p className="mb-3 truncate text-sm text-mut">{session?.user.email}</p>
        <button onClick={() => supabase.auth.signOut()} className="btn btn-bad w-full"><LogOut size={16} />Sair</button>
      </Card>
    </div>
  );
}
