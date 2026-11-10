export const num = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const brl = (n: number) => (n < 0 ? "− " : "") + "R$ " + num(Math.abs(n));
export const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const monthName = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1];
export const monthShort = (m: string) => `${monthName(m).slice(0, 3)} ${m.slice(2, 4)}`;
export const fmtDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
/** Data de hoje no fuso do Brasil, em AAAA-MM-DD. */
export const todayBR = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
/** Aceita "1.234,56", "1234,5" e "45.90". */
export function parseBRL(s: string): number {
  const t = s.replace(/[^\d.,-]/g, "");
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
export const pad = (n: number) => String(n).padStart(2, "0");
