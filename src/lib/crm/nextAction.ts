import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

const CRM_ROOT_NODE_ID = 'd7c76db8-b7e0-4ce1-87ca-21275c346326';
const CRM_TASK_SOURCE = 'crm_next_action';

export interface CrmNextAction {
  title: string | null | undefined;
  dueAt: string | null | undefined;
}

/**
 * Mantém uma única tarefa operacional pendente como fonte da próxima ação.
 * Os campos do contato continuam como resumo compatível com telas antigas.
 */
export async function syncCrmNextActionTask(contactId: string, action: CrmNextAction) {
  const { data: existing, error: findError } = await supabase
    .from('tasks')
    .select('id')
    .eq('contact_id', contactId)
    .eq('source', CRM_TASK_SOURCE)
    .is('deleted_at', null)
    .neq('status', 'concluído')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;

  if (!action.title || !action.dueAt) {
    if (existing?.id) {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'concluído', updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
    }
    return;
  }

  const due = new Date(action.dueAt);
  if (Number.isNaN(due.getTime())) {
    throw new Error('Data inválida para a próxima ação do CRM');
  }
  const payload = {
    title: action.title,
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
