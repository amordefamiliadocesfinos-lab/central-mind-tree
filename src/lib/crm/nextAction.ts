import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

const CRM_ROOT_NODE_ID = 'd7c76db8-b7e0-4ce1-87ca-21275c346326';
export const CRM_TASK_SOURCE = 'crm_next_action';

export interface CrmNextAction {
  title: string | null | undefined;
  dueAt: string | null | undefined;
}

export interface SetCrmNextActionInput {
  contactId: string;
  title: string;
  dueAt: string;
  /** Use somente quando a aÃ§Ã£o Ã© um retorno operacional desta conversa. */
  conversationId?: string | null;
  syncConversationReturn?: boolean;
}

function requireValidAction(action: CrmNextAction) {
  const title = action.title?.trim();
  if (!title || !action.dueAt) throw new Error('PrÃ³xima aÃ§Ã£o e data sÃ£o obrigatÃ³rias');
  const due = new Date(action.dueAt);
  if (Number.isNaN(due.getTime())) throw new Error('Data invÃ¡lida para a prÃ³xima aÃ§Ã£o do CRM');
  return { title, dueAt: action.dueAt, due };
}

/** MantÃ©m no mÃ¡ximo uma tarefa oficial pendente por contato. */
export async function syncCrmNextActionTask(contactId: string, action: CrmNextAction) {
  const { data: pending, error: findError } = await supabase
    .from('tasks')
    .select('id')
    .eq('contact_id', contactId)
    .eq('source', CRM_TASK_SOURCE)
    .is('deleted_at', null)
    .neq('status', 'concluÃ­do')
    .order('created_at', { ascending: false });
  if (findError) throw findError;

  const [existing, ...duplicates] = pending || [];
  if (duplicates.length > 0) {
    const { error } = await supabase.from('tasks')
      .update({ status: 'concluÃ­do', updated_at: new Date().toISOString() })
      .in('id', duplicates.map(task => task.id));
    if (error) throw error;
  }

  if (!action.title || !action.dueAt) {
    if (existing?.id) {
      const { error } = await supabase.from('tasks')
        .update({ status: 'concluÃ­do', updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
    }
    return;
  }

  const { title, dueAt, due } = requireValidAction(action);
  const payload = {
    title,
    contact_id: contactId,
    node_id: CRM_ROOT_NODE_ID,
    source: CRM_TASK_SOURCE,
    status: 'pendente',
    scheduled_date: format(due, 'yyyy-MM-dd'),
    due_date: format(due, 'yyyy-MM-dd'),
    scheduled_time: format(due, 'HH:mm'),
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await supabase.from('tasks').update(payload).eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('tasks').insert(payload);
  if (error) throw error;
}

/** Define a intenÃ§Ã£o comercial canÃ´nica e sua representaÃ§Ã£o executÃ¡vel. */
export async function setCrmNextAction(input: SetCrmNextActionInput) {
  const { title, dueAt } = requireValidAction(input);
  const { error: contactError } = await supabase.from('contacts').update({
    next_action_text: title,
    next_action_date: dueAt,
    // Compatibilidade temporÃ¡ria com os filtros e cartÃµes legados.
    next_contact_date: dueAt,
    updated_at: new Date().toISOString(),
  }).eq('id', input.contactId);
  if (contactError) throw contactError;

  await syncCrmNextActionTask(input.contactId, { title, dueAt });

  if (input.syncConversationReturn && input.conversationId) {
    const { error } = await supabase.from('service_conversations').update({ return_at: dueAt }).eq('id', input.conversationId);
    if (error) throw error;
  }
}

/** Limpa apenas a prÃ³xima aÃ§Ã£o oficial; histÃ³rico e tarefas manuais permanecem. */
export async function clearCrmNextAction(contactId: string) {
  const { error: contactError } = await supabase.from('contacts').update({
    next_action_text: null,
    next_action_date: null,
    next_contact_date: null,
    updated_at: new Date().toISOString(),
  }).eq('id', contactId);
  if (contactError) throw contactError;
  await syncCrmNextActionTask(contactId, { title: null, dueAt: null });
}

/** A conclusÃ£o da tarefa oficial encerra tambÃ©m a intenÃ§Ã£o que ela representa. */
export async function completeCrmNextAction(contactId: string) {
  await clearCrmNextAction(contactId);
}
