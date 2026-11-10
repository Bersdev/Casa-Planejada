"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Image as ImageIcon, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useHouse } from "@/lib/store";
import { addMonth, pad } from "@/lib/engine";
import { num, parseBRL } from "@/lib/format";
import type { Bill, Card, ContribMode, Expense, Income, Kind, Member, Method, Reserve, SplitMode, Work, WorkInstallment } from "@/lib/types";
import { Field, Modal, Seg, Toggle, useF } from "./ui";

type Apply = "next" | "only";
const money = (v?: number | null) => (v ? num(Number(v)) : "");
const day = (v: string) => Math.min(31, Math.max(1, Number(v) || 1));
/** Sugere quem pagou da última vez (nesta casa), senão a própria pessoa. */
const defaultPayer = (members: Member[], userId: string) => {
  const last = localStorage.getItem("cp-payer");
  return members.some((m) => m.user_id === last) ? last! : userId;
};
const CARD_COLORS =["#1f2937", "#7c3aed", "#ea580c", "#dc2626", "#2563eb", "#059669", "#db2777", "#0f766e"];

function Actions({ busy, onDelete, label = "Salvar" }: { busy?: boolean; onDelete?: () => void; label?: string }) {
  return (
    <div className="flex gap-2 pt-2">
      {onDelete && <button type="button" onClick={onDelete} aria-label="Excluir" className="btn btn-bad"><Trash2 size={16} /></button>}
      <button disabled={busy} className="btn btn-pri flex-1">{busy && <Loader2 size={16} className="animate-spin" />}{label}</button>
    </div>
  );
}
function Who({ value, onChange, members, label = "De quem é" }: { value: string; onChange: (v: string) => void; members: Member[]; label?: string }) {
  return (
    <Field label={label}>
      <select className="inp" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="house">Da casa</option>
        {members.map((m) => <option key={m.user_id} value={m.user_id}>Pessoal · {m.name}</option>)}
      </select>
    </Field>
  );
}
function People({ value, onChange, members, label }: { value: string; onChange: (v: string) => void; members: Member[]; label: string }) {
  return (
    <Field label={label}>
      <select className="inp" value={value} onChange={(e) => onChange(e.target.value)}>
        {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
      </select>
    </Field>
  );
}
const ApplySeg = ({ value, onChange }: { value: Apply; onChange: (v: Apply) => void }) => (
  <Seg value={value} onChange={onChange} options={[{ v: "next", l: "Este mês e os próximos" }, { v: "only", l: "Só este mês" }]} />
);
const scopeOf = (who: string) => ({ scope: who === "house" ? "house" : "personal", owner_id: who === "house" ? null : who }) as const;

/** Reduz a foto para caber no envio e no armazenamento. */
function compress(file: File, max = 1400): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => reject(new Error("Não consegui abrir a foto."));
    img.src = url;
  });
}

// ---------- Gasto (com leitura de nota fiscal) ----------
export function ExpenseForm({ expense, file, cardId }: { expense?: Expense; file?: File; cardId?: string }) {
  const { data, houseId, userId, today, run, reload, close, toast } = useHouse();
  const presetCard = data.cards.find((c) => c.id === cardId);
  const [f, set] = useF({
    id: expense?.id ?? "", amount: money(expense?.amount), merchant: expense?.merchant ?? "", date: expense?.date ?? today,
    category_id: expense?.category_id ?? "", method: (expense?.method ?? (presetCard ? "card" : "pix")) as Method, card_id: expense?.card_id ?? presetCard?.id ?? "",
    installments: String(expense?.installments ?? 1), who: expense ? (expense.scope === "house" ? "house" : (expense.owner_id ?? "house")) : presetCard?.default_scope === "personal" ? presetCard.owner_id : "house",
    note: expense?.note ?? "", receipt_path: expense?.receipt_path ?? "", pending: expense?.status === "pending",
  });
  const [busy, setBusy] = useState("");
  const started = useRef(false);

  const scan = async (photo: File) => {
    setBusy("Lendo a nota...");
    try {
      const image = await compress(photo);
      const path = `${houseId}/${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage.from("receipts").upload(path, await (await fetch(image)).blob(), { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const { data: s } = await supabase.auth.getSession();
      const res = await fetch("/api/receipt", {
        method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${s.session?.access_token}` },
        body: JSON.stringify({ image, categories: data.categories.map((c) => c.name), today }),
      });
      const ai = await res.json().catch(() => ({}));
      if (!res.ok) toast(ai.error ?? "Não consegui ler a nota. Preencha à mão.");
      const cat = data.categories.find((c) => c.name.toLowerCase() === String(ai.category ?? "").toLowerCase());
      const row = {
        merchant: (ai.merchant as string) ?? "", amount: Number(ai.amount) || 0, date: (ai.date as string) ?? today, category_id: cat?.id ?? null,
        method: (["pix", "cash", "debit"].includes(ai.method) ? ai.method : "pix") as Method,
      };
      const ins = await supabase.from("expenses").insert({ ...row, household_id: houseId, scope: "house", created_by: userId, status: "pending", receipt_path: path }).select().single();
      if (ins.error) throw ins.error;
      set({ id: ins.data.id, merchant: row.merchant, amount: money(row.amount), date: row.date, category_id: row.category_id ?? "", method: row.method, receipt_path: path, pending: true });
      reload();
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy("");
  };
  useEffect(() => {
    if (file && !started.current) { started.current = true; scan(file); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const card = data.cards.find((c) => c.id === f.card_id);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseBRL(f.amount);
    if (amount <= 0) return toast("Informe o valor.");
    if (f.method === "card" && !card) return toast("Escolha o cartão.");
    const row = {
      amount, merchant: f.merchant.trim(), date: f.date, category_id: f.category_id || null, method: f.method, card_id: f.method === "card" ? f.card_id : null,
      installments: f.method === "card" ? Math.min(48, Math.max(1, Number(f.installments) || 1)) : 1, ...scopeOf(f.who), note: f.note || null,
      receipt_path: f.receipt_path || null, status: "confirmed",
    };
    setBusy("Salvando...");
    const ok = await run(f.id ? supabase.from("expenses").update(row).eq("id", f.id) : supabase.from("expenses").insert({ ...row, household_id: houseId, created_by: userId }));
    setBusy("");
    if (ok) close();
  };
  const remove = async () => {
    if (!confirm("Excluir este gasto?")) return;
    if (f.receipt_path) await supabase.storage.from("receipts").remove([f.receipt_path]);
    if (await run(supabase.from("expenses").delete().eq("id", f.id))) close();
  };
  const seePhoto = async () => {
    const { data: u } = await supabase.storage.from("receipts").createSignedUrl(f.receipt_path, 300);
    if (u) window.open(u.signedUrl, "_blank");
  };

  return (
    <Modal title={f.pending ? "Confirmar gasto lido da nota" : f.id ? "Editar gasto" : "Novo gasto"}>
      <form onSubmit={save} className="space-y-3">
        {busy === "Lendo a nota..." ? (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-soft py-6 text-sm font-medium text-mut"><Loader2 size={18} className="animate-spin" />Lendo a nota fiscal...</div>
        ) : f.receipt_path ? (
          <button type="button" onClick={seePhoto} className="btn w-full"><ImageIcon size={16} />Ver foto da nota</button>
        ) : !f.id && (
          <label className="btn w-full">
            <Camera size={16} />Ler nota fiscal por foto
            <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && scan(e.target.files[0])} />
          </label>
        )}
        {f.pending && <p className="rounded-xl bg-warn/10 px-3 py-2 text-xs font-medium text-warn">Confira os dados lidos pela IA antes de confirmar.</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor (R$)"><input className="inp" inputMode="decimal" placeholder="0,00" value={f.amount} onChange={(e) => set({ amount: e.target.value })} /></Field>
          <Field label="Data"><input className="inp" type="date" required value={f.date} onChange={(e) => set({ date: e.target.value })} /></Field>
        </div>
        <Field label="Estabelecimento"><input className="inp" placeholder="Mercado, farmácia..." value={f.merchant} onChange={(e) => set({ merchant: e.target.value })} /></Field>
        <Field label="Categoria">
          <select className="inp" value={f.category_id} onChange={(e) => set({ category_id: e.target.value })}>
            <option value="">Sem categoria</option>
            {data.categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </Field>
        <Field label="Forma de pagamento">
          <Seg value={f.method} onChange={(method) => set({ method })} options={[{ v: "pix", l: "Pix" }, { v: "card", l: "Cartão" }, { v: "debit", l: "Débito" }, { v: "cash", l: "Dinheiro" }]} />
        </Field>
        {f.method === "card" && (
          <div className="grid grid-cols-[1fr_96px] gap-3">
            <Field label="Cartão">
              <select className="inp" value={f.card_id} onChange={(e) => { const c = data.cards.find((x) => x.id === e.target.value); set({ card_id: e.target.value, who: c ? (c.default_scope === "house" ? "house" : c.owner_id) : f.who }); }}>
                <option value="">{data.cards.length ? "Escolha" : "Cadastre um cartão"}</option>
                {data.cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Parcelas"><input className="inp" inputMode="numeric" value={f.installments} onChange={(e) => set({ installments: e.target.value })} /></Field>
          </div>
        )}
        <Who value={f.who} onChange={(who) => set({ who })} members={data.members} />
        <Actions busy={!!busy} onDelete={f.id ? remove : undefined} label={f.pending ? "Confirmar gasto" : "Salvar"} />
      </form>
    </Modal>
  );
}

// ---------- Conta a pagar ----------
export function BillForm({ bill, preset }: { bill?: Bill; preset?: Partial<Bill> }) {
  const { data, sum, houseId, month, userId, run, close, toast } = useHouse();
  const cur = bill && sum.payables.find((p) => p.key === `bill:${bill.id}`);
  const src = bill ?? preset;
  const [f, set] = useF({
    name: src?.name ?? "", amount: money(cur?.amount ?? src?.amount), due_day: String(cur?.day ?? src?.due_day ?? 5), kind: (src?.kind ?? "recurring") as Kind,
    payer_id: src?.payer_id ?? defaultPayer(data.members, userId),
    who: src?.scope === "personal" ? (src.owner_id ?? "house") : "house", is_housing: src?.is_housing ?? false, split_mode: (src?.split_mode ?? "prop") as SplitMode,
    split: Object.fromEntries(data.members.map((m) => [m.user_id, String(src?.split?.[m.user_id] ?? "")])) as Record<string, string>,
    reserve_id: src?.reserve_id ?? "", apply: "next" as Apply,
  });
  const [busy, setBusy] = useState(false);
  const recurringEdit = !!bill && bill.kind === "recurring";

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseBRL(f.amount);
    if (!f.name.trim() || amount <= 0) return toast("Informe o nome e o valor.");
    const split = Object.fromEntries(Object.entries(f.split).map(([k, v]) => [k, parseBRL(v)]));
    if (f.who === "house" && f.split_mode === "custom" && Math.round(Object.values(split).reduce((s, v) => s + v, 0)) !== 100) return toast("A divisão personalizada precisa somar 100%.");
    const row = {
      name: f.name.trim(), amount, due_day: day(f.due_day), kind: f.kind, payer_id: f.payer_id || null, ...scopeOf(f.who), is_housing: f.is_housing,
      split_mode: f.split_mode, split, reserve_id: f.reserve_id || null,
    };
    localStorage.setItem("cp-payer", f.payer_id);
    setBusy(true);
    let ok: boolean;
    if (!bill) ok = await run(supabase.from("bills").insert({ ...row, household_id: houseId, start_month: month }));
    else if (recurringEdit && f.apply === "only") ok = await run(supabase.from("bill_months").upsert({ bill_id: bill.id, household_id: houseId, month, amount, due_day: row.due_day }));
    else if (recurringEdit && bill.start_month < month) {
      // Mantém o histórico: encerra a conta antiga no mês anterior e cria a nova a partir deste mês
      const ins = await supabase.from("bills").insert({ ...row, household_id: houseId, start_month: month, end_month: bill.end_month }).select().single();
      if (ins.error) { setBusy(false); return toast(ins.error.message); }
      await supabase.from("bill_months").update({ bill_id: ins.data.id, amount: null, due_day: null }).eq("bill_id", bill.id).gte("month", month);
      ok = await run(supabase.from("bills").update({ end_month: addMonth(month, -1) }).eq("id", bill.id));
    } else ok = await run(supabase.from("bills").update(row).eq("id", bill.id), supabase.from("bill_months").update({ amount: null, due_day: null }).eq("bill_id", bill.id).eq("month", month));
    setBusy(false);
    if (ok) close();
  };
  const remove = async () => {
    if (!bill) return;
    const only = recurringEdit && f.apply === "only";
    if (!confirm(only ? "Tirar esta conta só deste mês?" : recurringEdit ? "Encerrar esta conta a partir deste mês?" : "Excluir esta conta?")) return;
    const q = only ? supabase.from("bill_months").upsert({ bill_id: bill.id, household_id: houseId, month, skipped: true })
      : recurringEdit && bill.start_month < month ? supabase.from("bills").update({ end_month: addMonth(month, -1) }).eq("id", bill.id)
      : supabase.from("bills").delete().eq("id", bill.id);
    if (await run(q)) close();
  };
  const onlyMonth = recurringEdit && f.apply === "only";

  return (
    <Modal title={bill ? "Editar conta" : "Nova conta"}>
      <form onSubmit={save} className="space-y-3">
        {recurringEdit && <ApplySeg value={f.apply} onChange={(apply) => set({ apply })} />}
        {onlyMonth && <p className="text-xs text-mut">Só o valor e o vencimento deste mês mudam. Os outros meses ficam como estão.</p>}
        {!onlyMonth && <Field label="Nome"><input className="inp" placeholder="Aluguel, luz, internet..." value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor (R$)"><input className="inp" inputMode="decimal" placeholder="0,00" value={f.amount} onChange={(e) => set({ amount: e.target.value })} /></Field>
          <Field label="Dia do vencimento"><input className="inp" inputMode="numeric" value={f.due_day} onChange={(e) => set({ due_day: e.target.value })} /></Field>
        </div>
        {!onlyMonth && (
          <>
            {!bill && <Seg value={f.kind} onChange={(kind) => set({ kind })} options={[{ v: "recurring", l: "Todo mês" }, { v: "oneoff", l: "Só neste mês" }]} />}
            <div className="grid grid-cols-2 gap-3">
              <People label="Quem paga" value={f.payer_id} onChange={(payer_id) => set({ payer_id })} members={data.members} />
              <Who value={f.who} onChange={(who) => set({ who })} members={data.members} />
            </div>
            {f.who === "house" && (
              <>
                <Field label="Como divide entre as rendas">
                  <Seg value={f.split_mode} onChange={(split_mode) => set({ split_mode })} options={[{ v: "prop", l: "Proporcional" }, { v: "equal", l: "Igual" }, { v: "custom", l: "Personalizada" }]} />
                </Field>
                {f.split_mode === "custom" && (
                  <div className="grid grid-cols-2 gap-3">
                    {data.members.map((m) => (
                      <Field key={m.user_id} label={`${m.name} (%)`}><input className="inp" inputMode="decimal" value={f.split[m.user_id] ?? ""} onChange={(e) => set({ split: { ...f.split, [m.user_id]: e.target.value } })} /></Field>
                    ))}
                  </div>
                )}
                <Toggle label="Conta de moradia" on={f.is_housing} onChange={(is_housing) => set({ is_housing })} />
                {data.reserves.length > 0 && (
                  <Field label="Depósito em reserva (entra no saldo ao pagar)">
                    <select className="inp" value={f.reserve_id} onChange={(e) => set({ reserve_id: e.target.value })}>
                      <option value="">Não é depósito</option>
                      {data.reserves.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.name}</option>)}
                    </select>
                  </Field>
                )}
              </>
            )}
          </>
        )}
        <Actions busy={busy} onDelete={bill ? remove : undefined} />
      </form>
    </Modal>
  );
}

// ---------- Renda ----------
export function IncomeForm({ income }: { income?: Income }) {
  const { data, sum, houseId, month, userId, run, close, toast } = useHouse();
  const cur = income && sum.incomes.find((l) => l.income.id === income.id);
  const o = income && data.income_months.find((x) => x.income_id === income.id && x.month === month);
  const [f, set] = useF({
    name: income?.name ?? "", amount: money(cur?.amount ?? income?.amount), day: String(income?.day ?? 5), kind: (income?.kind ?? "recurring") as Kind,
    member_id: income?.member_id ?? userId, contrib_mode: (o?.contrib_mode ?? income?.contrib_mode ?? "full") as ContribMode,
    contrib_value: money(o?.contrib_value ?? income?.contrib_value), apply: "next" as Apply,
  });
  const [busy, setBusy] = useState(false);
  const recurringEdit = !!income && income.kind === "recurring";
  const onlyMonth = recurringEdit && f.apply === "only";

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseBRL(f.amount), contrib_value = f.contrib_mode === "full" ? 0 : parseBRL(f.contrib_value);
    if (!f.name.trim() || amount <= 0) return toast("Informe o nome e o valor.");
    if (f.contrib_mode === "percent" && contrib_value > 100) return toast("A porcentagem vai até 100.");
    const row = { name: f.name.trim(), amount, day: day(f.day), kind: f.kind, member_id: f.member_id, contrib_mode: f.contrib_mode, contrib_value };
    setBusy(true);
    let ok: boolean;
    if (!income) ok = await run(supabase.from("incomes").insert({ ...row, household_id: houseId, start_month: month }));
    else if (onlyMonth) ok = await run(supabase.from("income_months").upsert({ income_id: income.id, household_id: houseId, month, amount, contrib_mode: f.contrib_mode, contrib_value }));
    else if (recurringEdit && income.start_month < month) {
      const ins = await supabase.from("incomes").insert({ ...row, household_id: houseId, start_month: month, end_month: income.end_month });
      if (ins.error) { setBusy(false); return toast(ins.error.message); }
      ok = await run(supabase.from("incomes").update({ end_month: addMonth(month, -1) }).eq("id", income.id), supabase.from("income_months").delete().eq("income_id", income.id).gte("month", month));
    } else ok = await run(supabase.from("incomes").update(row).eq("id", income.id), supabase.from("income_months").delete().eq("income_id", income.id).eq("month", month));
    setBusy(false);
    if (ok) close();
  };
  const remove = async () => {
    if (!income || !confirm(recurringEdit ? "Encerrar esta renda a partir deste mês?" : "Excluir esta renda?")) return;
    const q = recurringEdit && income.start_month < month ? supabase.from("incomes").update({ end_month: addMonth(month, -1) }).eq("id", income.id) : supabase.from("incomes").delete().eq("id", income.id);
    if (await run(q)) close();
  };

  return (
    <Modal title={income ? "Editar renda" : "Nova renda"}>
      <form onSubmit={save} className="space-y-3">
        {recurringEdit && <ApplySeg value={f.apply} onChange={(apply) => set({ apply })} />}
        {!onlyMonth && <Field label="Nome"><input className="inp" placeholder="Salário, aposentadoria, bônus..." value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor (R$)"><input className="inp" inputMode="decimal" placeholder="0,00" value={f.amount} onChange={(e) => set({ amount: e.target.value })} /></Field>
          {!onlyMonth && <Field label="Dia que recebe"><input className="inp" inputMode="numeric" value={f.day} onChange={(e) => set({ day: e.target.value })} /></Field>}
        </div>
        {!onlyMonth && (
          <>
            {!income && <Seg value={f.kind} onChange={(kind) => set({ kind })} options={[{ v: "recurring", l: "Todo mês" }, { v: "oneoff", l: "Só neste mês" }]} />}
            <People label="De quem é a renda" value={f.member_id} onChange={(member_id) => set({ member_id })} members={data.members} />
          </>
        )}
        <Field label="Quanto entra na casa">
          <Seg value={f.contrib_mode} onChange={(contrib_mode) => set({ contrib_mode })} options={[{ v: "full", l: "Tudo" }, { v: "fixed", l: "Valor fixo" }, { v: "percent", l: "Porcentagem" }]} />
        </Field>
        {f.contrib_mode !== "full" && (
          <Field label={f.contrib_mode === "fixed" ? "Valor que entra na casa (R$)" : "Porcentagem que entra na casa (%)"}>
            <input className="inp" inputMode="decimal" value={f.contrib_value} onChange={(e) => set({ contrib_value: e.target.value })} />
          </Field>
        )}
        <Actions busy={busy} onDelete={income ? remove : undefined} />
      </form>
    </Modal>
  );
}

// ---------- Cartão ----------
export function CardForm({ card }: { card?: Card }) {
  const { data, houseId, userId, run, close, toast } = useHouse();
  const [f, set] = useF({
    name: card?.name ?? "", bank: card?.bank ?? "", color: card?.color ?? CARD_COLORS[0], closing_day: String(card?.closing_day ?? 28), due_day: String(card?.due_day ?? 5),
    credit_limit: money(card?.credit_limit), owner_id: card?.owner_id ?? userId, default_scope: card?.default_scope ?? "personal",
  });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return toast("Dê um apelido ao cartão.");
    const row = { name: f.name.trim(), bank: f.bank.trim(), color: f.color, closing_day: day(f.closing_day), due_day: day(f.due_day), credit_limit: parseBRL(f.credit_limit), owner_id: f.owner_id, default_scope: f.default_scope };
    if (await run(card ? supabase.from("cards").update(row).eq("id", card.id) : supabase.from("cards").insert({ ...row, household_id: houseId }))) close();
  };
  const remove = async () => {
    if (card && confirm("Excluir este cartão? As compras dele ficam sem cartão.") && (await run(supabase.from("cards").delete().eq("id", card.id)))) close();
  };
  return (
    <Modal title={card ? "Editar cartão" : "Novo cartão"}>
      <form onSubmit={save} className="space-y-3">
        <p className="text-xs text-mut">Não pedimos número nem dados do cartão. O desenho é só uma ilustração.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Apelido"><input className="inp" placeholder="Nubank da mãe" value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Banco"><input className="inp" placeholder="Nubank" value={f.bank} onChange={(e) => set({ bank: e.target.value })} /></Field>
          <Field label="Dia do fechamento"><input className="inp" inputMode="numeric" value={f.closing_day} onChange={(e) => set({ closing_day: e.target.value })} /></Field>
          <Field label="Dia do vencimento"><input className="inp" inputMode="numeric" value={f.due_day} onChange={(e) => set({ due_day: e.target.value })} /></Field>
        </div>
        <Field label="Limite (R$)"><input className="inp" inputMode="decimal" placeholder="0,00" value={f.credit_limit} onChange={(e) => set({ credit_limit: e.target.value })} /></Field>
        <Field label="Cor">
          <div className="flex flex-wrap gap-2">
            {CARD_COLORS.map((c) => <button key={c} type="button" aria-label={`Cor ${c}`} onClick={() => set({ color: c })} className={`h-8 w-8 rounded-full ${f.color === c ? "ring-2 ring-pri ring-offset-2 ring-offset-card" : ""}`} style={{ background: c }} />)}
          </div>
        </Field>
        <People label="Dono do cartão" value={f.owner_id} onChange={(owner_id) => set({ owner_id })} members={data.members} />
        <Field label="As compras neste cartão costumam ser">
          <Seg value={f.default_scope} onChange={(default_scope) => set({ default_scope })} options={[{ v: "personal", l: "Pessoais do dono" }, { v: "house", l: "Da casa" }]} />
        </Field>
        <Actions onDelete={card ? remove : undefined} />
      </form>
    </Modal>
  );
}

// ---------- Obra e parcelas ----------
export function WorkForm({ work }: { work?: Work }) {
  const { houseId, run, close, toast } = useHouse();
  const [f, set] = useF({ name: work?.name ?? "", total_cost: money(work?.total_cost) });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return toast("Dê um nome à obra.");
    const row = { name: f.name.trim(), total_cost: parseBRL(f.total_cost) || null };
    if (await run(work ? supabase.from("works").update(row).eq("id", work.id) : supabase.from("works").insert({ ...row, household_id: houseId }))) close();
  };
  const remove = async () => {
    if (work && confirm("Excluir esta obra e todas as parcelas dela?") && (await run(supabase.from("works").delete().eq("id", work.id)))) close();
  };
  return (
    <Modal title={work ? "Editar obra" : "Nova obra"}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Nome da obra"><input className="inp" placeholder="Casa nova, reforma da cozinha..." value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Custo total previsto (R$, opcional)"><input className="inp" inputMode="decimal" value={f.total_cost} onChange={(e) => set({ total_cost: e.target.value })} /></Field>
        <Actions onDelete={work ? remove : undefined} />
      </form>
    </Modal>
  );
}

export function InstallmentForm({ work, item }: { work: Work; item?: WorkInstallment }) {
  const { data, houseId, today, userId, run, close, toast } = useHouse();
  const [f, set] = useF({
    due_date: item?.due_date ?? today, amount: money(item?.amount), description: item?.description ?? "", count: "1",
    payer_id: item?.payer_id ?? defaultPayer(data.members, userId),
  });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseBRL(f.amount), n = Math.min(120, Math.max(1, Number(f.count) || 1));
    if (amount <= 0) return toast("Informe o valor da parcela.");
    const base = { amount, description: f.description.trim(), payer_id: f.payer_id || null };
    if (item) return (await run(supabase.from("work_installments").update({ ...base, due_date: f.due_date }).eq("id", item.id))) && close();
    // Gera n parcelas mensais iguais a partir da primeira data
    const d = Number(f.due_date.slice(8, 10));
    const rows = Array.from({ length: n }, (_, i) => {
      const m = addMonth(f.due_date.slice(0, 7), i);
      const last = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate();
      return { ...base, work_id: work.id, household_id: houseId, due_date: `${m}-${pad(Math.min(d, last))}`, description: n > 1 ? `${base.description} ${i + 1}/${n}`.trim() : base.description };
    });
    if (await run(supabase.from("work_installments").insert(rows))) close();
  };
  const remove = async () => {
    if (item && confirm("Excluir esta parcela?") && (await run(supabase.from("work_installments").delete().eq("id", item.id)))) close();
  };
  return (
    <Modal title={item ? "Editar parcela" : `Parcelas de ${work.name}`}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor da parcela (R$)"><input className="inp" inputMode="decimal" placeholder="0,00" value={f.amount} onChange={(e) => set({ amount: e.target.value })} /></Field>
          <Field label={item ? "Vencimento" : "Primeiro vencimento"}><input className="inp" type="date" required value={f.due_date} onChange={(e) => set({ due_date: e.target.value })} /></Field>
        </div>
        {!item && <Field label="Quantas parcelas mensais iguais"><input className="inp" inputMode="numeric" value={f.count} onChange={(e) => set({ count: e.target.value })} /></Field>}
        <Field label="Descrição (opcional)"><input className="inp" placeholder="Pedreiro, material..." value={f.description} onChange={(e) => set({ description: e.target.value })} /></Field>
        <People label="Quem paga" value={f.payer_id} onChange={(payer_id) => set({ payer_id })} members={data.members} />
        <Actions onDelete={item ? remove : undefined} />
      </form>
    </Modal>
  );
}

// ---------- Reserva ----------
export function ReserveForm({ reserve }: { reserve?: Reserve }) {
  const { houseId, run, close, toast } = useHouse();
  const [f, set] = useF({ name: reserve?.name ?? "", goal: money(reserve?.goal), emoji: reserve?.emoji ?? "🐷" });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return toast("Dê um nome à reserva.");
    const row = { name: f.name.trim(), goal: parseBRL(f.goal) || null, emoji: f.emoji };
    if (await run(reserve ? supabase.from("reserves").update(row).eq("id", reserve.id) : supabase.from("reserves").insert({ ...row, household_id: houseId }))) close();
  };
  const remove = async () => {
    if (reserve && confirm("Excluir esta reserva e o histórico dela?") && (await run(supabase.from("reserves").delete().eq("id", reserve.id)))) close();
  };
  return (
    <Modal title={reserve ? "Editar reserva" : "Nova reserva"}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Nome"><input className="inp" placeholder="Emergência, viagem..." value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Meta (R$, opcional)"><input className="inp" inputMode="decimal" value={f.goal} onChange={(e) => set({ goal: e.target.value })} /></Field>
        <Field label="Símbolo">
          <div className="flex flex-wrap gap-2">
            {["🐷", "🛟", "✈️", "🏠", "🚗", "🎓", "🎁", "💍"].map((x) => <button key={x} type="button" onClick={() => set({ emoji: x })} className={`h-10 w-10 rounded-xl text-xl ${f.emoji === x ? "bg-pri/15 ring-2 ring-pri" : "bg-soft"}`}>{x}</button>)}
          </div>
        </Field>
        <Actions onDelete={reserve ? remove : undefined} />
      </form>
    </Modal>
  );
}

export function MoveForm({ reserve, balance }: { reserve: Reserve; balance: number }) {
  const { houseId, today, userId, run, close, toast } = useHouse();
  const [f, set] = useF({ dir: "in" as "in" | "out", amount: "", date: today, note: "" });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseBRL(f.amount);
    if (amount <= 0) return toast("Informe o valor.");
    if (f.dir === "out" && amount > balance) return toast("O saque é maior que o saldo da reserva.");
    if (await run(supabase.from("reserve_moves").insert({ reserve_id: reserve.id, household_id: houseId, date: f.date, amount: f.dir === "in" ? amount : -amount, note: f.note.trim(), created_by: userId }))) close();
  };
  return (
    <Modal title={`${reserve.emoji} ${reserve.name}`}>
      <form onSubmit={save} className="space-y-3">
        <Seg value={f.dir} onChange={(dir) => set({ dir })} options={[{ v: "in", l: "Guardar" }, { v: "out", l: "Retirar" }]} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor (R$)"><input className="inp" inputMode="decimal" placeholder="0,00" value={f.amount} onChange={(e) => set({ amount: e.target.value })} /></Field>
          <Field label="Data"><input className="inp" type="date" required value={f.date} onChange={(e) => set({ date: e.target.value })} /></Field>
        </div>
        <Field label="Anotação (opcional)"><input className="inp" value={f.note} onChange={(e) => set({ note: e.target.value })} /></Field>
        <Actions />
      </form>
    </Modal>
  );
}
