import { NextResponse } from "next/server";
import { supabaseAs } from "@/lib/supabase";

export const maxDuration = 30;
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

// Lê uma foto de nota fiscal com o modelo de visão da Groq e devolve os campos do gasto.
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return fail("Entre na sua conta.", 401);
  const db = supabaseAs(token);
  const member = await db.from("members").select("user_id").limit(1);
  if (member.error || !member.data.length) return fail("Entre na sua conta.", 401);

  const key = process.env.GROQ_API_KEY;
  if (!key) return fail("A leitura de notas ainda não está configurada (falta a chave da Groq). Preencha à mão.", 503);

  // Limite diário por pessoa, contado no banco (a pessoa não consegue zerar o contador)
  const quota = await db.rpc("use_receipt_quota");
  if (quota.error || quota.data !== true) return fail("Limite diário de leituras de nota atingido. Preencha à mão ou tente amanhã.", 429);

  const { image, categories, today } = (await req.json()) as { image?: string; categories?: string[]; today?: string };
  if (typeof image !== "string" || !image.startsWith("data:image/") || image.length > 4_000_000) return fail("Foto inválida ou grande demais.", 400);
  const cats = (categories ?? []).filter((c) => typeof c === "string").slice(0, 40);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(today ?? "") ? today! : new Date().toISOString().slice(0, 10);

  const prompt = `Você lê notas e cupons fiscais brasileiros. Hoje é ${day}. Responda somente com um objeto JSON com as chaves:
"merchant": nome curto do estabelecimento (nome fantasia, sem CNPJ nem endereço);
"amount": valor total pago, como número com ponto decimal (use o VALOR TOTAL ou VALOR A PAGAR, nunca subtotal, troco ou valor recebido);
"date": data da compra no formato AAAA-MM-DD, ou null se não aparecer;
"category": a que melhor descreve a compra entre ${JSON.stringify(cats)}, ou null;
"method": "pix", "debit", "cash" ou "card" conforme a forma de pagamento impressa, ou null.
Se a imagem não for uma nota legível, devolva "amount": 0.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b",
      temperature: 0,
      max_completion_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: image } }] }],
    }),
  });
  if (!res.ok) {
    console.error("groq", res.status, (await res.text()).slice(0, 500));
    return fail(res.status === 429 ? "Limite gratuito de leituras atingido. Tente daqui a pouco ou preencha à mão." : "Não consegui ler a nota. Preencha à mão.", 502);
  }
  const text: string = (await res.json()).choices?.[0]?.message?.content ?? "";
  let out: Record<string, unknown> = {};
  try {
    out = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  } catch {
    return fail("Não consegui entender a nota. Preencha à mão.", 502);
  }

  const amount = Math.round((Number(out.amount) || 0) * 100) / 100;
  const date = typeof out.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(out.date) && out.date <= day ? out.date : day;
  return NextResponse.json({
    merchant: typeof out.merchant === "string" ? out.merchant.slice(0, 80) : "",
    amount: amount > 0 && amount < 1_000_000 ? amount : 0,
    date,
    category: typeof out.category === "string" && cats.includes(out.category) ? out.category : null,
    method: ["pix", "debit", "cash", "card"].includes(out.method as string) ? out.method : null,
  });
}
