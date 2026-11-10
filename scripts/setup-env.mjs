// Cria o .env.local com chaves novas (push e cron) sem mostrá-las na tela.
// Imprime só o hash do segredo do cron, que é o que fica guardado no banco.
import { existsSync, writeFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import * as webpush from "web-push";

if (existsSync(".env.local")) {
  console.log(".env.local já existe; nada foi alterado.");
  process.exit(0);
}
const [url, key] = process.argv.slice(2);
const vapid = webpush.generateVAPIDKeys();
const cron = randomBytes(24).toString("hex");
writeFileSync(
  ".env.local",
  [
    `NEXT_PUBLIC_SUPABASE_URL=${url}`,
    `NEXT_PUBLIC_SUPABASE_KEY=${key}`,
    `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapid.publicKey}`,
    `VAPID_PRIVATE_KEY=${vapid.privateKey}`,
    `CRON_SECRET=${cron}`,
    `GROQ_VISION_MODEL=qwen/qwen3.8-27b`,
    `GROQ_API_KEY=`,
    "",
  ].join("\n"),
);
console.log("cron_hash=" + createHash("sha256").update(cron).digest("hex"));
