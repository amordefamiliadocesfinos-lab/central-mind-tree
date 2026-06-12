import { useMemo } from 'react';
import { Sparkles, Send, Phone, Calendar, AlertCircle, Trophy, Heart, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { differenceInDays, parseISO } from 'date-fns';
import type { Contact } from '@/hooks/useContacts';

interface Props {
  contact: Contact;
  onAction?: (actionId: string) => void;
}

type Suggestion = {
  id: string;
  title: string;
  reason: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'urgent' | 'warm' | 'cool' | 'success';
};

const toneClasses: Record<Suggestion['tone'], string> = {
  urgent: 'from-red-500/10 to-orange-500/10 border-red-500/30 text-red-700 dark:text-red-300',
  warm: 'from-amber-500/10 to-yellow-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
  cool: 'from-blue-500/10 to-cyan-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300',
  success: 'from-emerald-500/10 to-teal-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
};

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  try { return differenceInDays(new Date(), parseISO(iso)); } catch { return null; }
}

function computeSuggestion(c: Contact): Suggestion {
  const stage = c.funnel_status || 'novo_lead';
  const sinceContact = daysSince(c.ultimo_contato) ?? daysSince(c.created_at);
  const sinceCreated = daysSince(c.created_at);

  // Pós-venda / clientes
  if (stage === 'cliente_ativo' || stage === 'vip') {
    const sincePurchase = daysSince(c.last_purchase_date);
    if (sincePurchase != null && sincePurchase > 60) {
      return { id: 'reativar', title: 'Reativar cliente', reason: `Sem compras há ${sincePurchase} dias. Envie uma oferta de retorno.`, icon: Heart, tone: 'warm' };
    }
    return { id: 'pos_venda', title: 'Mover para Pós-venda', reason: 'Cliente fechou. Programe acompanhamento de satisfação e fidelização.', icon: Trophy, tone: 'success' };
  }

  if (stage === 'perdido') {
    return { id: 'reengajar', title: 'Tentar reengajar', reason: 'Lead marcado como perdido. Vale uma última tentativa em 30-60 dias.', icon: Heart, tone: 'cool' };
  }

  // Negociação / Proposta
  if (stage === 'negociacao' || stage === 'proposta') {
    if (sinceContact != null && sinceContact >= 2) {
      return { id: 'cobrar', title: 'Cobrar resposta', reason: `Proposta enviada e ${sinceContact} dias sem retorno. Faça follow-up agora.`, icon: AlertCircle, tone: 'urgent' };
    }
    return { id: 'fechar', title: 'Encaminhar para fechamento', reason: 'Lead está quente em negociação. Tente fechar hoje com gatilho de urgência.', icon: Trophy, tone: 'success' };
  }

  // Qualificado
  if (stage === 'qualificado') {
    if (!c.valor_estimado) {
      return { id: 'orcamento', title: 'Enviar orçamento', reason: 'Lead qualificado sem valor estimado. Monte e envie a proposta comercial.', icon: Send, tone: 'warm' };
    }
    return { id: 'visita', title: 'Agendar visita ou reunião', reason: 'Lead qualificado com valor definido. Avance para reunião de fechamento.', icon: Calendar, tone: 'warm' };
  }

  // Novo lead
  if (stage === 'novo_lead' || !stage) {
    if (sinceCreated != null && sinceCreated >= 1) {
      return { id: 'retorno', title: 'Fazer contato de retorno', reason: `Lead criado há ${sinceCreated} dia(s) sem primeiro contato. Aja agora — leads esfriam rápido.`, icon: Phone, tone: 'urgent' };
    }
    return { id: 'primeiro_contato', title: 'Fazer primeiro contato', reason: 'Lead novo. Envie mensagem de boas-vindas e descubra a necessidade.', icon: MessageCircle, tone: 'warm' };
  }

  return { id: 'contato', title: 'Fazer contato de retorno', reason: 'Mantenha o relacionamento ativo com um toque rápido.', icon: Phone, tone: 'cool' };
}

export function NextBestAction({ contact, onAction }: Props) {
  const suggestion = useMemo(() => computeSuggestion(contact), [contact]);
  const Icon = suggestion.icon;

  return (
    <div className={`rounded-lg border bg-gradient-to-br p-3 ${toneClasses[suggestion.tone]}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-80 mb-2">
        <Sparkles className="h-3 w-3" />
        Próxima melhor ação
      </div>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-md bg-background/60 shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{suggestion.title}</p>
          <p className="text-xs opacity-80 mt-1 leading-snug">{suggestion.reason}</p>
        </div>
      </div>
      {onAction && (
        <div className="flex justify-end mt-2">
          <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => onAction(suggestion.id)}>
            Executar
          </Button>
        </div>
      )}
    </div>
  );
}
