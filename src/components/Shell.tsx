"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeftRight, Bell, Camera, ChevronLeft, ChevronRight, CreditCard, Home, LayoutGrid, Menu, Moon, PiggyBank, Plus, Receipt, Settings, Sun, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/lib/store";
import { addMonth, upcoming } from "@/lib/engine";
import { brl, fmtDate, monthName } from "@/lib/format";
import { Avatar, Field, Modal, Seg, useF } from "./ui";
import { BillForm, ExpenseForm, IncomeForm } from "./forms";

const NAV = [
  { href: "/", label: "Visão geral", icon: LayoutGrid },
  { href: "/fluxo", label: "Fluxo de caixa", icon: ArrowLeftRight },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/casa", label: "Nossa casa", icon: Home },
  { href: "/reserva", label: "Nossa reserva", icon: PiggyBank },
];
const NAV2 = [
  { href: "/renda", label: "Nossa renda", icon: Wallet },
  { href: "/contas", label: "Contas da casa", icon: Receipt },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/icons/app-192.png" alt="" className="h-9 w-9 rounded-xl" />
      <div className="leading-tight">
        <p className="text-sm font-bold">Casa Planejada</p>
        <p className="text-[11px] text-mut">Finanças da família</p>
      </div>
    </div>
  );
}

// O login Google está ativo no Supabase; para esconder o botão, defina NEXT_PUBLIC_GOOGLE_LOGIN=false
const GOOGLE_LOGIN = process.env.NEXT_PUBLIC_GOOGLE_LOGIN !== "false";

function Login() {
  const { toast } = useApp();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [f, set] = useF({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin } });
    if (error) toast("O login com Google ainda não está configurado. Use e-mail e senha.");
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
      if (error) toast(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message === "Email not confirmed" ? "Confirme seu e-mail pelo link que enviamos." : error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({ email: f.email, password: f.password, options: { data: { name: f.name }, emailRedirectTo: location.origin } });
      if (error) toast(error.message);
      else if (!data.session) toast("Conta criada. Confirme pelo link que enviamos ao seu e-mail e depois entre.");
    }
    setBusy(false);
  };
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="card w-full max-w-sm p-6">
        <Brand />
        <h1 className="mt-6 text-xl font-bold">{mode === "in" ? "Entrar" : "Criar conta"}</h1>
        <p className="mb-5 text-sm text-mut">Organize as rendas e os gastos da casa em um só lugar.</p>
        {GOOGLE_LOGIN && (
          <>
          <button onClick={google} className="btn w-full">
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.400 13.700 17.700 9.500 24 9.500z" /><path fill="#4285F4" d="M46.500 24.500c0-1.600-.100-3.100-.400-4.500H24v9h12.700c-.600 3-2.200 5.500-4.700 7.200l7.600 5.900c4.400-4.100 6.900-10.100 6.900-17.600z" /><path fill="#FBBC05" d="M10.500 28.600c-.500-1.500-.800-3-.800-4.600s.300-3.100.800-4.600l-7.900-6.200C.900 16.500 0 20.100 0 24s.900 7.500 2.600 10.800l7.900-6.200z" /><path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.600-5.900c-2.100 1.400-4.900 2.300-8.300 2.300-6.300 0-11.600-4.200-13.500-9.900l-7.900 6.200C6.500 42.600 14.600 48 24 48z" /></svg>
            Entrar com Google
          </button>
          <div className="my-4 flex items-center gap-3 text-xs text-mut"><span className="h-px flex-1 bg-line" />ou<span className="h-px flex-1 bg-line" /></div>
          </>
        )}
        <form onSubmit={submit} className="space-y-3">
          {mode === "up" && <Field label="Seu nome"><input className="inp" required value={f.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" /></Field>}
          <Field label="E-mail"><input className="inp" type="email" required value={f.email} onChange={(e) => set({ email: e.target.value })} autoComplete="email" /></Field>
          <Field label="Senha"><input className="inp" type="password" required minLength={6} value={f.password} onChange={(e) => set({ password: e.target.value })} autoComplete={mode === "in" ? "current-password" : "new-password"} /></Field>
          <button disabled={busy} className="btn btn-pri w-full">{mode === "in" ? "Entrar" : "Criar conta"}</button>
        </form>
        <Link href="/privacidade" className="mt-4 block text-center text-xs text-mut underline">Política de Privacidade</Link>
        <Link href="/termos" className="mt-1 block text-center text-xs text-mut underline">Termos de Serviço</Link>
        <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-3 w-full text-center text-sm font-medium text-pri">
          {mode === "in" ? "Ainda não tenho conta" : "Já tenho conta"}
        </button>
      </div>
    </main>
  );
}

export function Onboarding({ inModal }: { inModal?: boolean }) {
  const { session, toast, refreshHouses, setHouseId, close, data } = useApp();
  const meta = session?.user.user_metadata ?? {};
  const [mode, setMode] = useState<"new" | "join">(typeof localStorage !== "undefined" && localStorage.getItem("cp-invite") ? "join" : "new");
  // Quem já tem casa e fecha a janela sem confirmar descarta o convite
  useEffect(() => { if (inModal) localStorage.removeItem("cp-invite"); }, [inModal]);
  const me = data?.members.find((m) => m.user_id === session?.user.id)?.name;
  const [f, set] = useF({ name: me ?? ((meta.name ?? meta.full_name ?? "") as string).split(" ")[0], house: "", code: (typeof localStorage !== "undefined" && localStorage.getItem("cp-invite")) || "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data: id, error } = mode === "new"
      ? await supabase.rpc("create_household", { p_name: f.house, p_member_name: f.name })
      : await supabase.rpc("join_household", { p_code: f.code, p_member_name: f.name });
    setBusy(false);
    if (error) return toast(error.message);
    localStorage.removeItem("cp-invite");
    localStorage.setItem("cp-house", id);
    await refreshHouses();
    setHouseId(id);
    close();
  };
  const body = (
    <form onSubmit={submit} className="space-y-3">
      <Seg value={mode} onChange={setMode} options={[{ v: "new", l: "Criar uma casa" }, { v: "join", l: "Tenho um convite" }]} />
      <Field label="Como você quer ser chamado"><input className="inp" required value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
      {mode === "new"
        ? <Field label="Nome da casa"><input className="inp" required placeholder="Casa da mãe" value={f.house} onChange={(e) => set({ house: e.target.value })} /></Field>
        : <Field label="Código do convite"><input className="inp uppercase" required value={f.code} onChange={(e) => set({ code: e.target.value })} /></Field>}
      {mode === "join" && inModal && <p className="text-xs text-mut">Só confirme se o convite veio de alguém da sua família. Você passa a ver e editar os dados dessa casa.</p>}
      <button disabled={busy} className="btn btn-pri w-full">{mode === "new" ? "Criar casa" : "Entrar na casa"}</button>
    </form>
  );
  if (inModal) return <Modal title="Outra casa">{body}</Modal>;
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="card w-full max-w-sm p-6">
        <Brand />
        <h1 className="mb-4 mt-6 text-xl font-bold">Vamos começar</h1>
        {body}
        <button onClick={() => supabase.auth.signOut()} className="mt-4 w-full text-center text-sm text-mut">Sair</button>
      </div>
    </main>
  );
}

function NavLinks({ items, onNav }: { items: typeof NAV; onNav?: () => void }) {
  const path = usePathname();
  return (
    <>
      {items.map((n) => (
        <Link key={n.href} href={n.href} onClick={onNav}
          className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition ${path === n.href ? "bg-soft font-semibold text-ink" : "text-mut hover:bg-soft"}`}>
          <n.icon size={16} className={path === n.href ? "text-pri" : ""} />{n.label}
        </Link>
      ))}
    </>
  );
}

function ThemeSwitch() {
  const { theme, setTheme } = useApp();
  const dark = theme === "dark" || (theme === "system" && typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  return (
    <div className="flex items-center justify-between px-3 py-2 text-[13px] text-mut">
      <span className="flex items-center gap-2.5"><Sun size={16} />Tema</span>
      <div className="flex rounded-lg bg-soft p-0.5">
        <button aria-label="Tema claro" onClick={() => setTheme("light")} className={`rounded-md p-1.5 ${!dark ? "bg-card text-ink shadow-sm" : ""}`}><Sun size={13} /></button>
        <button aria-label="Tema escuro" onClick={() => setTheme("dark")} className={`rounded-md p-1.5 ${dark ? "bg-card text-ink shadow-sm" : ""}`}><Moon size={13} /></button>
      </div>
    </div>
  );
}

function HouseSwitch() {
  const { houses, houseId, setHouseId } = useApp();
  if (houses.length < 2) return null;
  return (
    <select aria-label="Casa" className="inp mt-3 !h-9 !text-[13px]" value={houseId ?? ""} onChange={(e) => setHouseId(e.target.value)}>
      {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
    </select>
  );
}

function Alerts() {
  const { data, today } = useApp();
  const list = data ? upcoming(data, today, 7) : [];
  const pend = data?.expenses.filter((e) => e.status === "pending").length ?? 0;
  return (
    <Modal title="Avisos">
      {pend > 0 && <p className="mb-3 rounded-xl bg-warn/10 px-3 py-2 text-sm font-medium text-warn">{pend} nota{pend > 1 ? "s" : ""} esperando confirmação na Visão geral.</p>}
      {!list.length && !pend && <p className="py-6 text-center text-sm text-mut">Nenhuma conta vencendo nos próximos 7 dias.</p>}
      {list.map((a) => (
        <div key={a.key} className="row">
          <span className={`h-2 w-2 rounded-full ${a.inDays < 0 ? "bg-bad" : a.inDays === 0 ? "bg-warn" : "bg-pri"}`} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{a.name}</p>
            <p className="text-xs text-mut">{a.inDays < 0 ? `Venceu dia ${fmtDate(a.date)}` : a.inDays === 0 ? "Vence hoje" : `Vence em ${a.inDays} dia${a.inDays > 1 ? "s" : ""} (${fmtDate(a.date)})`}</p>
          </div>
          <span className="font-semibold">{brl(a.amount)}</span>
        </div>
      ))}
    </Modal>
  );
}

function AddMenu() {
  const { open } = useApp();
  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-soft";
  return (
    <Modal title="Adicionar">
      <label className={item}>
        <Camera size={18} className="text-pri" />Ler nota fiscal por foto
        <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && open(<ExpenseForm file={e.target.files[0]} />)} />
      </label>
      <button className={item} onClick={() => open(<ExpenseForm />)}><Receipt size={18} className="text-pri" />Gasto (Pix, cartão, dinheiro)</button>
      <button className={item} onClick={() => open(<BillForm />)}><Home size={18} className="text-pri" />Conta a pagar</button>
      <button className={item} onClick={() => open(<IncomeForm />)}><Wallet size={18} className="text-pri" />Renda</button>
    </Modal>
  );
}

function MoreMenu() {
  const { close } = useApp();
  return (
    <Modal title="Menu">
      <nav className="space-y-0.5"><NavLinks items={[...NAV.slice(3), ...NAV2]} onNav={close} /></nav>
      <div className="mt-2 border-t border-line pt-2"><ThemeSwitch /></div>
    </Modal>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const app = useApp();
  const { ready, session, houses, data, month, setMonth, view, setView, open, today, userId } = app;
  const path = usePathname();

  useEffect(() => { navigator.serviceWorker?.register("/sw.js").catch(() => {}); }, []);
  // Link de convite aberto por quem já tem casa: pede confirmação em vez de entrar direto
  const loaded = !!data;
  useEffect(() => { if (loaded && localStorage.getItem("cp-invite")) open(<Onboarding inModal />); }, [loaded, open]);

  if (path === "/privacidade" || path === "/termos") return <>{children}</>;
  if (!ready) return <main className="grid min-h-dvh place-items-center"><img src="/icons/app-192.png" alt="Carregando" className="h-14 w-14 animate-pulse rounded-2xl" /></main>;
  if (!session) return <Login />;
  if (!houses.length) return <Onboarding />;
  if (!data) return <main className="grid min-h-dvh place-items-center"><img src="/icons/app-192.png" alt="Carregando" className="h-14 w-14 animate-pulse rounded-2xl" /></main>;

  const me = data.members.find((m) => m.user_id === userId);
  const alerts = upcoming(data, today, 7).length + data.expenses.filter((e) => e.status === "pending").length;
  const views = [{ v: "house", l: "Casa toda" }, ...data.members.map((m) => ({ v: m.user_id, l: m.user_id === userId ? "Só meus" : `Só ${m.name}` }))];
  const tab = (href: string) => `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${path === href ? "text-pri" : "text-mut"}`;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1280px] gap-4 lg:p-4">
      <aside className="card sticky top-4 hidden h-[calc(100dvh-2rem)] w-56 shrink-0 flex-col p-3 lg:flex">
        <div className="px-2 pb-3 pt-2"><Brand /><HouseSwitch /></div>
        <p className="px-3 pb-1 pt-2 text-[11px] text-mut">Menu</p>
        <nav className="space-y-0.5"><NavLinks items={NAV} /></nav>
        <p className="px-3 pb-1 pt-4 text-[11px] text-mut">Ajustes</p>
        <nav className="space-y-0.5"><NavLinks items={NAV2} /></nav>
        <div className="mt-auto border-t border-line pt-2">
          <ThemeSwitch />
          {me && (
            <Link href="/ajustes" className="mt-1 flex items-center gap-2.5 rounded-xl px-3 py-2 hover:bg-soft">
              <Avatar name={me.name} color={me.color} />
              <span className="min-w-0 leading-tight"><span className="block truncate text-[13px] font-semibold">{me.name}</span><span className="block truncate text-[11px] text-mut">{data.household.name}</span></span>
            </Link>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1 px-3 pb-28 lg:px-0 lg:pb-4">
        <header className="card safe-t sticky top-0 z-30 -mx-3 mb-3 rounded-t-none px-4 py-3 lg:top-4 lg:mx-0 lg:mb-4 lg:rounded-t-[18px]">
          <div className="flex items-center gap-2">
            <button aria-label="Mês anterior" onClick={() => setMonth(addMonth(month, -1))} className="grid h-8 w-8 place-items-center rounded-full text-mut hover:bg-soft"><ChevronLeft size={18} /></button>
            <button aria-label="Próximo mês" onClick={() => setMonth(addMonth(month, 1))} className="grid h-8 w-8 place-items-center rounded-full text-mut hover:bg-soft"><ChevronRight size={18} /></button>
            <h1 className="flex-1 truncate text-xl font-bold tracking-tight">{monthName(month)} <span className="font-medium text-mut">{month.slice(0, 4)}</span></h1>
            <Seg className="hidden md:flex" value={view} onChange={setView} options={views} />
            <button aria-label={`Avisos: ${alerts}`} onClick={() => open(<Alerts />)} className="relative grid h-10 w-10 place-items-center rounded-xl border border-line">
              <Bell size={17} />
              {alerts > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">{alerts}</span>}
            </button>
            <button onClick={() => open(<AddMenu />)} className="btn btn-pri hidden lg:inline-flex"><Plus size={16} />Adicionar</button>
          </div>
          <Seg className="mt-3 md:hidden" value={view} onChange={setView} options={views} />
        </header>
        {children}
      </div>

      <nav className="card safe-b fixed inset-x-0 bottom-0 z-40 flex items-center rounded-b-none px-2 shadow-[0_-4px_20px_rgb(0_0_0/0.06)] lg:hidden">
        <Link href="/" className={tab("/")}><LayoutGrid size={20} />Visão</Link>
        <Link href="/fluxo" className={tab("/fluxo")}><ArrowLeftRight size={20} />Fluxo</Link>
        <button aria-label="Adicionar" onClick={() => open(<AddMenu />)} className="mx-2 -mt-5 grid h-14 w-14 shrink-0 place-items-center rounded-full bg-pri text-white shadow-lg"><Plus size={26} /></button>
        <Link href="/cartoes" className={tab("/cartoes")}><CreditCard size={20} />Cartões</Link>
        <button onClick={() => open(<MoreMenu />)} className={tab("#")}><Menu size={20} />Menu</button>
      </nav>
      {app.modal}
    </div>
  );
}
