import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de Privacidade · Casa Planejada" };

export default function Privacidade() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-[15px] leading-relaxed">
      <Link href="/" className="text-sm font-semibold text-pri">← Casa Planejada</Link>
      <h1 className="mb-1 mt-4 text-2xl font-bold">Política de Privacidade</h1>
      <p className="mb-6 text-sm text-mut">Atualizada em 12 de novembro de 2026</p>

      <p className="mb-4">
        O Casa Planejada é um aplicativo de uso familiar para organizar rendas, contas, cartões, obras e reservas da casa. Esta página explica quais dados ele usa e como são tratados.
      </p>

      <h2 className="mb-1 mt-6 text-lg font-bold">Quais dados são coletados</h2>
      <ul className="mb-4 list-disc space-y-1 pl-5">
        <li><b>Conta:</b> seu nome e e-mail, informados no cadastro ou recebidos do Google quando você entra com a conta Google (apenas e-mail e nome básico do perfil).</li>
        <li><b>Dados que você lança:</b> rendas, contas, gastos, cartões (apelido, banco, datas e limite, sem número do cartão), obras, reservas e fotos de notas fiscais.</li>
        <li><b>Avisos:</b> se você ativar, o endereço técnico do seu aparelho para enviar notificações de vencimento.</li>
      </ul>

      <h2 className="mb-1 mt-6 text-lg font-bold">Para que são usados</h2>
      <p className="mb-4">
        Apenas para o funcionamento do aplicativo: mostrar os totais e as contas da sua casa, ler os dados de notas fiscais fotografadas e avisar sobre vencimentos. Não usamos os dados para publicidade e não os vendemos.
      </p>

      <h2 className="mb-1 mt-6 text-lg font-bold">Quem vê seus dados</h2>
      <p className="mb-4">
        Somente as pessoas que você convida para a mesma casa. Cada casa é isolada das outras por regras de acesso no banco de dados.
      </p>

      <h2 className="mb-1 mt-6 text-lg font-bold">Serviços de terceiros</h2>
      <ul className="mb-4 list-disc space-y-1 pl-5">
        <li><b>Supabase</b>: armazena a conta, os dados e as fotos das notas.</li>
        <li><b>Vercel</b>: hospeda o aplicativo.</li>
        <li><b>Groq</b>: recebe a foto de uma nota fiscal apenas no momento em que você pede a leitura, para extrair estabelecimento, valor e data.</li>
        <li><b>Google</b>: autentica o login quando você escolhe entrar com a conta Google.</li>
      </ul>

      <h2 className="mb-1 mt-6 text-lg font-bold">Seus direitos</h2>
      <p className="mb-4">
        Você pode editar ou excluir qualquer lançamento no próprio aplicativo e exportar todos os dados em Ajustes. Para excluir sua conta e seus dados, peça à pessoa que administra a casa ou entre em contato pelo e-mail de suporte informado na tela de login do Google.
      </p>

      <h2 className="mb-1 mt-6 text-lg font-bold">Mudanças</h2>
      <p>Se esta política mudar, a data no topo desta página será atualizada.</p>
    </main>
  );
}
