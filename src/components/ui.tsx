"use client";
import { useState, type ReactNode } from "react";
import { Check as CheckIcon, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { num } from "@/lib/format";

export function useF<T>(init: T) {
  const [f, setF] = useState(init);
  return [f, (p: Partial<T>) => setF((o) => ({ ...o, ...p }))] as const;
}

const SIZES = { xl: "text-[44px] leading-none", lg: "text-[32px] leading-none", md: "text-xl", sm: "text-base" };
export function Money({ v, size = "lg", approx, className = "" }: { v: number; size?: keyof typeof SIZES; approx?: boolean; className?: string }) {
  const [int, cents] = num(Math.abs(v)).split(",");
  return (
    <span className={`font-bold tracking-tight whitespace-nowrap ${SIZES[size]} ${className}`}>
      <span className="text-mut font-semibold">{approx ? "≈ " : ""}{v < 0 ? "− " : ""}R$ </span>
      {int}
      <span className="text-[0.45em] text-mut font-semibold">,{cents}</span>
    </span>
  );
}

export function Card({ title, sub, icon, right, children, className = "" }: { title?: ReactNode; sub?: ReactNode; icon?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card relative p-5 ${className}`}>
      {icon && <img src={`/icons/${icon}.png`} alt="" className="absolute right-4 top-3 h-16 w-16 object-contain drop-shadow-md pointer-events-none" />}
      {(title || right) && (
        <header className={`mb-3 flex items-center justify-between gap-2 ${icon ? "pr-20" : ""}`}>
          <h2 className="text-sm font-semibold">{title} {sub && <span className="font-normal text-mut">{sub}</span>}</h2>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Modal({ title, children }: { title: string; children: ReactNode }) {
  const { close } = useApp();
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="card w-full sm:max-w-md max-h-[92dvh] overflow-y-auto rounded-b-none sm:rounded-b-[18px] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold">{title}</h2>
          <button onClick={close} aria-label="Fechar" className="grid h-8 w-8 place-items-center rounded-full bg-soft text-mut"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-mut">{label}</span>
      {children}
    </label>
  );
}

export function Seg<T extends string>({ value, onChange, options, className = "" }: { value: T; onChange: (v: T) => void; options: { v: T; l: ReactNode }[]; className?: string }) {
  return (
    <div className={`flex gap-1 rounded-xl bg-soft p-1 overflow-x-auto no-bar ${className}`}>
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-semibold transition ${value === o.v ? "bg-card text-ink shadow-sm" : "text-mut"}`}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function Check({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={on}
      className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 transition ${on ? "border-ok bg-ok text-white" : "border-mut/40"}`}>
      {on && <CheckIcon size={13} strokeWidth={3.5} />}
    </button>
  );
}

export const Dot = ({ color }: { color?: string }) => <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color ?? "var(--mut)" }} />;

/** Barra empilhada: cada segmento ocupa a sua fração do total. */
export function Stack({ parts, total, h = 8 }: { parts: { v: number; color: string }[]; total?: number; h?: number }) {
  const sum = total ?? parts.reduce((s, p) => s + Math.max(0, p.v), 0);
  return (
    <div className="flex w-full gap-[3px] overflow-hidden rounded-full bg-soft" style={{ height: h }}>
      {parts.filter((p) => p.v > 0).map((p, i) => (
        <div key={i} className="h-full rounded-full" style={{ width: `${sum ? (p.v / sum) * 100 : 0}%`, background: p.color }} />
      ))}
    </div>
  );
}

export const Empty = ({ children }: { children: ReactNode }) => <p className="rounded-xl bg-soft px-4 py-5 text-center text-sm text-mut">{children}</p>;

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} aria-pressed={on} className="flex w-full items-center justify-between gap-3 py-1 text-sm">
      <span>{label}</span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-pri" : "bg-mut/30"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

export function Avatar({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-bold text-white" style={{ background: color, width: size, height: size, fontSize: size * 0.42 }}>
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
