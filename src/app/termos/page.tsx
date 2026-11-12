import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Termos de Serviço · Casa Planejada" };

export default function Termos() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-[15px] leading-relaxed">
      <Link href="/" className="text-sm font-semibold text-pri">← Casa Planejada</Link>
      <h1 className="mb-1 mt-4 text-2xl font-bold">Termos de Serviço</h1>
      <p className="mb-6 text-sm text-mut">Atualizados em 12 de novembro de 2026</p>

      <p className="mb-4">
        O Casa Planejada é um aplicativo gratuito, de uso familiar, para organizar rendas, contas, cartões, obras e reservas da casa. Ao criar uma conta ou entrar, você concorda com estes termos.
      </p>

      <h2 className="mb-1 mt-6 text-lg font-bold">Uso do aplicativo</h2>
      <ul className="mb-4 list-disc space-y-1 pl-5">
        <li>Use o aplicativo apenas para organizar as finanças da sua família, com informações que você tem direito de registrar.</li>
        <li>Quem cria uma casa pode convidar outras pessoas. Todas as pessoas da casa veem e editam os dados dela, então convide só quem você confia.</li>
        <li>Você é responsável por manter sua senha e o acesso à sua conta em segurança.</li>
        <li>Não use o aplicativo para atividades ilegais, nem tente acessar dados de outras casas ou prejudicar o funcionamento do serviço.</li>
      </ul>

      <h2 className="mb-1 mt-6 text-lg font-bold">Natureza das informações</h2>
      <p className="mb-4">
        Os valores e previsões mostrados são calculados a partir do que você lança e servem apenas como organização pessoal. O aplicativo não é consultoria financeira, não movimenta dinheiro e não se conecta a bancos. A leitura de notas fiscais por inteligência artificial pode errar, por isso cada leitura pede a sua confirmação antes de entrar nos totais.
      </p>

      <h2 className="mb-1 mt-6 text-lg font-bold">Disponibilidade</h2>
      <p className="mb-4">
        O serviço é oferecido como está, sem garantia de funcionamento contínuo ou livre de erros, e pode depender de limites de serviços gratuitos de terceiros. Faça exportações periódicas dos seus dados em Ajustes.
      </p>

      <h2 className="mb-1 mt-6 text-lg font-bold">Limitação de responsabilidade</h2>
      <p className="mb-4">
        Na medida permitida pela lei, o responsável pelo aplicativo não responde por perdas decorrentes de erros de cálculo, indisponibilidade, perda de dados ou decisões tomadas com base nas informações exibidas.
      </p>

      <h2 className="mb-1 mt-6 text-lg font-bold">Encerramento</h2>
      <p className="mb-4">
        Você pode parar de usar o aplicativo e pedir a exclusão dos seus dados a qualquer momento, conforme descrito na <Link href="/privacidade" className="font-semibold text-pri">Política de Privacidade</Link>. O acesso pode ser suspenso em caso de uso que viole estes termos.
      </p>

      <h2 className="mb-1 mt-6 text-lg font-bold">Mudanças</h2>
      <p>Se estes termos mudarem, a data no topo desta página será atualizada.</p>
    </main>
  );
}
