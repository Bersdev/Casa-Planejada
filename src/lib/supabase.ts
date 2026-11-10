import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/** Cliente no servidor que age em nome do usuário (respeita as regras de acesso do banco). */
export const supabaseAs = (token: string) =>
  createClient(SUPABASE_URL, SUPABASE_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
