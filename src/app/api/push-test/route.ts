import { NextResponse } from "next/server";
import { supabaseAs } from "@/lib/supabase";
import { pushAll, type PushSub } from "@/lib/server";

// Envia um aviso de teste para os aparelhos da própria pessoa.
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const { data, error } = await supabaseAs(token).from("push_subscriptions").select("user_id, endpoint, p256dh, auth");
  if (error) return NextResponse.json({ error: error.message }, { status: 401 });
  if (!data.length) return NextResponse.json({ error: "Nenhum aparelho com avisos ativos." }, { status: 400 });
  const r = await pushAll(data as PushSub[], { title: "Casa Planejada", body: "Os avisos estão funcionando neste aparelho.", url: "/" });
  return r.sent ? NextResponse.json(r) : NextResponse.json({ error: "O envio falhou. Ative os avisos de novo neste aparelho." }, { status: 502 });
}
