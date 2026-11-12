# Casa Planejada

App da família para planejar rendas, contas, cartões, obras e reservas da casa. Funciona no navegador e instalado na tela inicial do iPhone (PWA).

## O que usa (tudo em plano grátis)

- **Next.js** na Vercel: telas e rotas do servidor.
- **Supabase**: banco de dados, login e fotos das notas. O esquema completo está em `supabase/schema.sql`.
- **Groq**: leitura da foto da nota fiscal (rota `/api/receipt`).

## Variáveis de ambiente

Ficam no arquivo `.env.local` (que não vai para o GitHub) e em Settings → Environment Variables na Vercel. A lista está em `.env.example`.

| Variável | Para que serve |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY` | Endereço e chave pública do Supabase |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Par de chaves dos avisos push |
| `CRON_SECRET` | Protege as rotas `/api/cron` e `/api/export`. O banco guarda só o hash dele |
| `GROQ_API_KEY`, `GROQ_VISION_MODEL` | Chave e modelo de visão da Groq |

`node scripts/setup-env.mjs <url> <chave>` cria um `.env.local` novo e imprime o hash que vai na tabela `app_secrets` (chave `cron_hash`).

## Rodar no computador

```bash
npm install
npm run dev
```

Testes do motor de cálculo: `npm test`. Teste das rotas protegidas com o servidor ligado: `node scripts/check-cron.mjs`.

## Tarefas automáticas

- **Avisos de vencimento**: a Vercel chama `/api/cron` todo dia às 9h de Brasília (`vercel.json`). A mesma chamada mantém o banco do Supabase ativo.
- **Backup mensal**: o GitHub Actions (`.github/workflows/backup.yml`) baixa `/api/export` no dia 1 e salva em `backups/` **cifrado** (`.json.enc`, AES-256), para que quem tiver acesso ao repositório não leia os dados financeiros. Precisa dos segredos `APP_URL`, `CRON_SECRET` e `BACKUP_PASSPHRASE` (uma frase longa só sua; guarde-a num gerenciador de senhas). Para abrir: `openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in backups/AAAA-MM.json.enc -out backup.json`.

## Onde fica cada coisa

- `src/lib/engine.ts`: todos os cálculos (saldo, divisão, faturas, avisos), com testes em `engine.test.ts`.
- `src/lib/store.tsx`: estado do app e carga dos dados da casa.
- `src/components/forms.tsx`: formulários (gasto com leitura de nota, contas, rendas, cartões, obras, reservas).
- `src/app/*/page.tsx`: uma pasta por tela.

## Segurança

- Repositório privado; dê acesso só em Settings → Collaborators. Nunca coloque chaves no código: elas ficam em `.env.local` e nos segredos da Vercel/GitHub.
- `supabase/migrations/` guarda os ajustes de segurança do banco; aplique-os no SQL Editor do Supabase.
