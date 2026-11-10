export type Scope = "house" | "personal";
export type ContribMode = "full" | "fixed" | "percent";
export type SplitMode = "prop" | "equal" | "custom";
export type Method = "pix" | "card" | "cash" | "debit";
export type Kind = "recurring" | "oneoff";

export interface Household { id: string; name: string; daily_limit: number; housing_ref_pct: number; notify_days: number }
export interface Member { household_id: string; user_id: string; name: string; color: string; role: string }
export interface Category { id: string; household_id: string; name: string; emoji: string; sort: number }
export interface Income {
  id: string; household_id: string; member_id: string; name: string; amount: number; day: number; kind: Kind;
  start_month: string; end_month: string | null; contrib_mode: ContribMode; contrib_value: number;
}
export interface IncomeMonth { income_id: string; household_id: string; month: string; amount: number | null; contrib_mode: ContribMode | null; contrib_value: number | null }
export interface Reserve { id: string; household_id: string; name: string; goal: number | null; emoji: string }
export interface Bill {
  id: string; household_id: string; name: string; amount: number; due_day: number; kind: Kind; start_month: string; end_month: string | null;
  payer_id: string | null; scope: Scope; owner_id: string | null; is_housing: boolean; category_id: string | null;
  split_mode: SplitMode; split: Record<string, number>; reserve_id: string | null;
}
export interface BillMonth { bill_id: string; household_id: string; month: string; amount: number | null; due_day: number | null; paid: boolean; skipped: boolean }
export interface Card {
  id: string; household_id: string; owner_id: string; name: string; bank: string; color: string;
  closing_day: number; due_day: number; credit_limit: number; default_scope: Scope;
}
export interface CardInvoice { card_id: string; household_id: string; month: string; paid: boolean }
export interface Expense {
  id: string; household_id: string; date: string; amount: number; merchant: string; category_id: string | null; method: Method;
  card_id: string | null; installments: number; scope: Scope; owner_id: string | null; created_by: string | null;
  status: "pending" | "confirmed"; receipt_path: string | null; note: string | null;
}
export interface Work { id: string; household_id: string; name: string; total_cost: number | null }
export interface WorkInstallment { id: string; work_id: string; household_id: string; due_date: string; amount: number; description: string; paid: boolean; payer_id: string | null }
export interface ReserveMove { id: string; reserve_id: string; household_id: string; date: string; amount: number; note: string; bill_id: string | null; month: string | null }

export interface Data {
  household: Household;
  members: Member[];
  categories: Category[];
  incomes: Income[];
  income_months: IncomeMonth[];
  reserves: Reserve[];
  bills: Bill[];
  bill_months: BillMonth[];
  cards: Card[];
  card_invoices: CardInvoice[];
  expenses: Expense[];
  works: Work[];
  work_installments: WorkInstallment[];
  reserve_moves: ReserveMove[];
}
