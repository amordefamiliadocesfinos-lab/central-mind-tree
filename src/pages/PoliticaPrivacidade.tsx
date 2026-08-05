import { ShieldCheck } from 'lucide-react';

const sections = [
  {
    title: '1. Quem controla os dados',
    content: 'A Amor de Família Doces Finos e Artesanais Ltda. é responsável pelo tratamento dos dados pessoais utilizados em seus canais de atendimento, vendas e relacionamento com clientes.',
  },
  {
    title: '2. Dados que podemos tratar',
    content: 'Podemos tratar nome, telefone, identificadores do WhatsApp, conteúdo e horário das mensagens, informações fornecidas durante o atendimento, histórico comercial, pedidos, preferências, registros de consentimento e dados técnicos necessários para segurança e funcionamento da integração.',
  },
  {
    title: '3. Como usamos os dados',
    content: 'Os dados são usados para responder solicitações, elaborar propostas, registrar e acompanhar pedidos, organizar retornos comerciais, prestar suporte, manter o histórico do relacionamento, melhorar o atendimento, prevenir fraudes e cumprir obrigações legais.',
  },
  {
    title: '4. WhatsApp e CRM',
    content: 'As conversas do WhatsApp Business podem ser integradas ao CRM da Amor de Família para centralizar o atendimento e permitir continuidade pela equipe autorizada. Mensagens iniciadas pela empresa observarão as regras, modelos aprovados e opções de cancelamento aplicáveis do WhatsApp.',
  },
  {
    title: '5. Bases legais',
    content: 'O tratamento pode ocorrer para execução de contrato ou procedimentos preliminares, atendimento de obrigação legal, exercício regular de direitos, legítimo interesse na gestão do relacionamento comercial e, quando necessário, mediante consentimento.',
  },
  {
    title: '6. Compartilhamento',
    content: 'Os dados podem ser processados por fornecedores essenciais de tecnologia, hospedagem, banco de dados e comunicação, incluindo Meta e WhatsApp, exclusivamente para viabilizar as finalidades descritas. Não vendemos dados pessoais.',
  },
  {
    title: '7. Armazenamento e segurança',
    content: 'Mantemos os dados pelo período necessário às finalidades do atendimento, relacionamento comercial e obrigações legais. Aplicamos controles de acesso, autenticação, registro de operações e outras medidas razoáveis para reduzir riscos de acesso, alteração ou divulgação indevida.',
  },
  {
    title: '8. Direitos do titular',
    content: 'O titular pode solicitar confirmação e acesso, correção, anonimização, bloqueio ou eliminação quando aplicável, portabilidade, informação sobre compartilhamentos, revisão de consentimento e oposição ao tratamento, conforme a Lei Geral de Proteção de Dados.',
  },
  {
    title: '9. Solicitações e contato',
    content: 'Para exercer seus direitos ou esclarecer dúvidas sobre privacidade, entre em contato pelo WhatsApp comercial +55 51 8120-4596. Poderemos solicitar informações para confirmar a identidade e proteger os dados do titular.',
  },
  {
    title: '10. Atualizações',
    content: 'Esta política poderá ser atualizada para refletir mudanças legais, operacionais ou tecnológicas. A versão vigente permanecerá disponível neste endereço.',
  },
];

export default function PoliticaPrivacidade() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6">
      <article className="mx-auto max-w-3xl rounded-2xl border bg-card p-6 shadow-sm sm:p-10">
        <header className="mb-8 border-b pb-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Política de Privacidade</h1>
          <p className="mt-2 text-sm text-muted-foreground">Amor de Família Doces Finos e Artesanais</p>
          <p className="mt-1 text-xs text-muted-foreground">Vigente desde 5 de agosto de 2026</p>
        </header>

        <p className="mb-8 leading-7 text-muted-foreground">
          Esta política explica como tratamos dados pessoais no atendimento comercial, inclusive nas conversas realizadas pelo WhatsApp Business e integradas ao nosso sistema de CRM.
        </p>

        <div className="space-y-7">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-2 text-lg font-semibold">{section.title}</h2>
              <p className="leading-7 text-muted-foreground">{section.content}</p>
            </section>
          ))}
        </div>

        <footer className="mt-10 border-t pt-6 text-sm text-muted-foreground">
          Amor de Família Doces Finos e Artesanais Ltda. · Brasil
        </footer>
      </article>
    </main>
  );
}
