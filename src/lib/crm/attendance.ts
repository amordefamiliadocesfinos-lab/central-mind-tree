import { supabase } from '@/integrations/supabase/client';
import { clearCrmNextAction, setCrmNextAction } from '@/lib/crm/nextAction';
import { CRM_EVENT_CODES, normalizeCrmStage } from '@/lib/crm/model';

export type AttendanceOutcome =
  | 'awaiting_response' | 'proposal_sent' | 'negotiation' | 'sale_closed'
  | 'post_sale_done' | 'client_replied' | 'invalid_phone' | 'waiting_internal_quote'
  | 'no_interest' | 'record_only';

export const ATTENDANCE_OUTCOMES: Array<{ key: AttendanceOutcome; label: string }> = [
  { key: 'awaiting_response', label: 'Aguardando resposta' }, { key: 'proposal_sent', label: 'Proposta enviada' },
  { key: 'negotiation', label: 'Em negociaÃ§Ã£o' }, { key: 'client_replied', label: 'Cliente respondeu' },
  { key: 'waiting_internal_quote', label: 'Aguardando orÃ§amento interno' }, { key: 'sale_closed', label: 'Venda fechada' },
  { key: 'post_sale_done', label: 'PÃ³s-venda realizado' }, { key: 'invalid_phone', label: 'Telefone invÃ¡lido' },
  { key: 'no_interest', label: 'Sem interesse' }, { key: 'record_only', label: 'Apenas registrar' },
];

export const ATTENDANCE_STATE_LABELS: Record<string, string> = {
  responder: 'Responder', em_atendimento: 'Em atendimento', aguardando_cliente: 'Aguardando resposta',
  retornar_em: 'Retomar emâ€¦', concluido: 'ConcluÃ­do', resolvido: 'ConcluÃ­do',
};

const CONFIG: Record<AttendanceOutcome, {
  label: string; stage?: string; action?: string | null; days?: number;
  attendanceState: 'aguardando_cliente' | 'retornar_em' | 'concluido' | 'em_atendimento';
  eventCode: string; resolved?: boolean; conversationReturn?: boolean;
}> = {
  awaiting_response: { label: 'Atendimento realizado â€” aguardando resposta', stage: 'contato_realizado', action: 'Verificar resposta do cliente', days: 2, attendanceState: 'aguardando_cliente', eventCode: CRM_EVENT_CODES.CONTACT_ATTEMPTED, conversationReturn: true },
  proposal_sent: { label: 'Proposta enviada', stage: 'proposta_enviada', action: 'Fazer follow-up da proposta', days: 2, attendanceState: 'aguardando_cliente', eventCode: CRM_EVENT_CODES.PROPOSAL_SENT, conversationReturn: true },
  negotiation: { label: 'Cliente em negociaÃ§Ã£o', stage: 'negociacao', action: 'Retomar negociaÃ§Ã£o', days: 1, attendanceState: 'aguardando_cliente', eventCode: CRM_EVENT_CODES.NEGOTIATION_STARTED, conversationReturn: true },
  sale_closed: { label: 'Venda fechada', stage: 'fechado', action: 'Realizar pÃ³s-venda', days: 3, attendanceState: 'concluido', eventCode: CRM_EVENT_CODES.SALE_WON, resolved: true },
  post_sale_done: { label: 'PÃ³s-venda realizado', stage: 'cadencia', action: 'Reativar relacionamento com o cliente', days: 30, attendanceState: 'concluido', eventCode: CRM_EVENT_CODES.POST_SALE_COMPLETED, resolved: true },
  client_replied: { label: 'Cliente respondeu', stage: 'contato_realizado', action: 'Definir prÃ³ximo passo comercial', days: 1, attendanceState: 'em_atendimento', eventCode: CRM_EVENT_CODES.CUSTOMER_REPLIED },
  invalid_phone: { label: 'Telefone invÃ¡lido ou ausente', action: 'Corrigir telefone do contato', days: 1, attendanceState: 'retornar_em', eventCode: CRM_EVENT_CODES.CONTACT_ATTEMPTED },
  waiting_internal_quote: { label: 'Aguardando orÃ§amento interno', stage: 'contato_realizado', action: 'Concluir orÃ§amento interno', days: 1, attendanceState: 'retornar_em', eventCode: CRM_EVENT_CODES.FOLLOW_UP_SCHEDULED },
  no_interest: { label: 'Sem interesse', stage: 'perdido', action: null, attendanceState: 'concluido', eventCode: CRM_EVENT_CODES.SALE_LOST, resolved: true },
  record_only: { label: 'Atendimento registrado', action: null, attendanceState: 'concluido', eventCode: CRM_EVENT_CODES.CONTACT_ATTEMPTED, resolved: true },
};

function dueInDays(days?: number) {
  if (days == null) return null;
  const due = new Date(); due.setDate(due.getDate() + days); due.setHours(9, 0, 0, 0);
  return due.toISOString();
}

export async function applyAttendanceOutcome(input: { contactId: string; conversationId?: string | null; outcome: AttendanceOutcome; saleAlreadyRecorded?: boolean }) {
  const now = new Date().toISOString();
  const config = CONFIG[input.outcome];
  const { data: contact, error: contactError } = await supabase.from('contacts').select('funnel_status').eq('id', input.contactId).maybeSingle();
  if (contactError || !contact) throw contactError || new Error('Contato nÃ£o encontrado');

  const currentStage = normalizeCrmStage(contact.funnel_status);
  const requestedStage = config.stage ? normalizeCrmStage(config.stage) : currentStage;
  const nextStage = requestedStage === 'contato_realizado' && ['novo_lead', 'cadencia'].includes(currentStage) ? 'contato_realizado' : requestedStage;
  const returnAt = dueInDays(config.days);
  const { error: updateError } = await supabase.from('contacts').update({ ultimo_contato: now.slice(0, 10), funnel_status: nextStage, updated_at: now }).eq('id', input.contactId);
  if (updateError) throw updateError;

  if (!(input.outcome === 'sale_closed' && input.saleAlreadyRecorded)) {
    const { error: historyError } = await supabase.from('contact_history').insert({
      contact_id: input.contactId, event_type: 'contact', interaction_type: 'contact', event_code: config.eventCode,
      event_metadata: { source: 'unified_inbox', outcome: input.outcome, next_stage: nextStage, return_at: returnAt }, description: config.label, interaction_date: now,
    });
    if (historyError) throw historyError;
  }

  let conversationId = input.conversationId ?? null;
  if (!conversationId) {
    const { data } = await supabase.from('service_conversations').select('id').eq('contact_id', input.contactId).order('last_message_at', { ascending: false }).limit(1).maybeSingle();
    conversationId = data?.id ?? null;
  }

  if (config.action && returnAt) {
    await setCrmNextAction({ contactId: input.contactId, title: config.action, dueAt: returnAt, conversationId, syncConversationReturn: config.conversationReturn });
  } else {
    await clearCrmNextAction(input.contactId);
  }

  if (conversationId) {
    const { error } = await supabase.from('service_conversations').update({
      attendance_state: config.attendanceState, status: config.resolved ? 'resolved' : 'open', resolved_at: config.resolved ? now : null,
      needs_reply: false, unread_count: 0, ...(config.conversationReturn ? {} : { return_at: null }), funnel_stage: nextStage,
    }).eq('id', conversationId);
    if (error) throw error;
  }
  return { label: config.label, nextStage, returnAt, attendanceState: config.attendanceState };
}

export async function snoozeAttendance(input: { contactId: string; conversationId?: string | null; when: number | string }) {
  const target = typeof input.when === 'number' ? new Date() : new Date(`${input.when}T09:00:00`);
  if (typeof input.when === 'number') { target.setDate(target.getDate() + input.when); target.setHours(9, 0, 0, 0); }
  if (Number.isNaN(target.getTime())) throw new Error('Data invÃ¡lida');
  const returnAt = target.toISOString();
  await setCrmNextAction({ contactId: input.contactId, title: 'Retomar atendimento', dueAt: returnAt, conversationId: input.conversationId, syncConversationReturn: true });
  if (input.conversationId) {
    const { error } = await supabase.from('service_conversations').update({ attendance_state: 'retornar_em', return_at: returnAt, needs_reply: false }).eq('id', input.conversationId);
    if (error) throw error;
  }
  const { error: historyError } = await supabase.from('contact_history').insert({
    contact_id: input.contactId, event_type: 'follow_up', interaction_type: 'follow_up', event_code: CRM_EVENT_CODES.FOLLOW_UP_SCHEDULED,
    event_metadata: { source: 'unified_inbox', return_at: returnAt }, description: `Atendimento adiado para ${target.toLocaleString('pt-BR')}`, interaction_date: new Date().toISOString(),
  });
  if (historyError) throw historyError;
  return returnAt;
}
