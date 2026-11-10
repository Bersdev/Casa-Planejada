// Testa as rotas protegidas (avisos e backup) no servidor local, sem mostrar o segredo.
import { readFileSync } from "node:fs";
const secret = readFileSync(".env.local", "utf8").match(/^CRON_SECRET=(.+)$/m)[1].trim();
const base = process.argv[2] ?? "http://localhost:3000";
const h = { authorization: `Bearer ${secret}` };
const cron = await fetch(`${base}/api/cron`, { headers: h });
console.log("cron", cron.status, JSON.stringify(await cron.json()));
const exp = await fetch(`${base}/api/export`, { headers: h });
const j = await exp.json();
console.log("export", exp.status, Object.entries(j).map(([k, v]) => `${k}:${Array.isArray(v) ? v.length : "ok"}`).join(" "));
