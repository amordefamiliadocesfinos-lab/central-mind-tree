import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { subDays, format } from 'date-fns';

/**
 * Executes automatic internal actions when an idea's objective is set/changed.
 * - gerar_leads   → badge "Campanha ativa", create task, flag CRM contacts
 * - reativar_clientes → mark inactive contacts (no orders 30+ days) as needing contact
 * - vender_produto → fill key_message template + log WhatsApp template
 */
export function useIdeaActions() {
  const executeObjectiveActions = useCallback(async (
    ideaId: string,
    objective: string,
    ideaTitle: string,
    productId?: string | null,
  ) => {
    const results: string[] = [];

    try {
      switch (objective) {
        case 'gerar_leads': {
          // 1. Add "Campanha ativa" tag to idea
          await supabase
            .from('digital_ideas')
            .update({ action_tags: ['campanha_ativa'] } as any)
            .eq('id', ideaId);
          results.push('🏷️ Marcada como Campanha ativa');

          // 2. Create automatic task
          // Find first node to attach task
          const { data: nodes } = await supabase
            .from('nodes')
            .select('id')
            .limit(1)
            .single();

          if (nodes) {
            await supabase.from('tasks').insert({
              node_id: nodes.id,
              title: `📣 Campanha: ${ideaTitle}`,
              description: `Tarefa automática criada pela ideia digital "${ideaTitle}" com objetivo de gerar leads.`,
              status: 'pendente',
            });
            results.push('✅ Tarefa de campanha criada');
          }

          // 3. Register in CRM — flag leads without recent contact
          const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
          const { data: inactiveContacts } = await supabase
            .from('contacts')
            .select('id, name')
            .eq('is_active', true)
            .eq('type', 'lead')
            .or(`ultimo_contato.is.null,ultimo_contato.lt.${thirtyDaysAgo}`)
            .limit(50);

          if (inactiveContacts && inactiveContacts.length > 0) {
            const historyEntries = inactiveContacts.map(c => ({
              contact_id: c.id,
              interaction_type: 'sistema',
              event_type: 'campaign',
              description: `📣 Lead incluído na campanha "${ideaTitle}" (Gerar leads)`,
            }));
            await supabase.from('contact_history').insert(historyEntries);
            results.push(`📋 ${inactiveContacts.length} leads registrados na campanha`);
          }
          break;
        }

        case 'reativar_clientes': {
          // Mark inactive contacts (no orders in 30+ days) as needing contact
          await supabase
            .from('digital_ideas')
            .update({ action_tags: ['reativacao_clientes'] } as any)
            .eq('id', ideaId);

          const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
          
          // Get contacts who are clients but haven't been contacted in 30+ days
          const { data: inactiveClients } = await supabase
            .from('contacts')
            .select('id, name')
            .eq('is_active', true)
            .in('type', ['cliente', 'lead'])
            .or(`ultimo_contato.is.null,ultimo_contato.lt.${thirtyDaysAgo}`)
            .limit(100);

          if (inactiveClients && inactiveClients.length > 0) {
            // Set next_action for each
            const today = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");
            const updates = inactiveClients.map(c =>
              supabase
                .from('contacts')
                .update({
                  next_action_text: `🔄 Reativar — campanha "${ideaTitle}"`,
                  next_action_date: today,
                })
                .eq('id', c.id)
            );
            await Promise.all(updates);

            // Log in timeline
            const historyEntries = inactiveClients.map(c => ({
              contact_id: c.id,
              interaction_type: 'sistema',
              event_type: 'reactivation',
              description: `🔄 Contato marcado para reativação — ideia "${ideaTitle}"`,
            }));
            await supabase.from('contact_history').insert(historyEntries);
            results.push(`🔄 ${inactiveClients.length} contatos marcados para reativação`);
          } else {
            results.push('ℹ️ Nenhum contato inativo encontrado');
          }
          break;
        }

        case 'vender_produto': {
          await supabase
            .from('digital_ideas')
            .update({ action_tags: ['venda_ativa'] } as any)
            .eq('id', ideaId);

          // Get product name if linked
          let productName = 'nosso produto';
          if (productId) {
            const { data: product } = await supabase
              .from('products')
              .select('name')
              .eq('id', productId)
              .single();
            if (product) productName = product.name;
          }

          // Fill key_message with sales template
          const salesTemplate = `Olá! Tudo bem? 😊\nConheça ${productName} — qualidade garantida e preço especial por tempo limitado!\n\n✅ Produto original\n📦 Envio rápido\n💰 Condições especiais\n\nFale comigo para saber mais! 👇`;
          
          await supabase
            .from('digital_ideas')
            .update({ key_message: salesTemplate } as any)
            .eq('id', ideaId);
          results.push('💬 Mensagem de venda gerada');

          // Also register as WhatsApp template in contact history for future use
          // We log it as a "template" event that the CRM can reference
          const { data: activeContacts } = await supabase
            .from('contacts')
            .select('id')
            .eq('is_active', true)
            .in('funnel_status', ['orcamento', 'negociacao', 'novo_lead'])
            .limit(20);

          if (activeContacts && activeContacts.length > 0) {
            const historyEntries = activeContacts.map(c => ({
              contact_id: c.id,
              interaction_type: 'sistema',
              event_type: 'sales_template',
              description: `💰 Template de venda disponível: "${ideaTitle}" — ${productName}`,
            }));
            await supabase.from('contact_history').insert(historyEntries);
            results.push(`📱 Template WhatsApp disponível para ${activeContacts.length} contatos`);
          }
          break;
        }

        case 'engajamento': {
          await supabase
            .from('digital_ideas')
            .update({ action_tags: ['engajamento'] } as any)
            .eq('id', ideaId);
          results.push('💬 Campanha de engajamento ativada');
          break;
        }
      }

      if (results.length > 0) {
        toast.success('Ações automáticas executadas', {
          description: results.join('\n'),
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error executing objective actions:', error);
      toast.error('Erro ao executar ações automáticas');
    }

    return results;
  }, []);

  return { executeObjectiveActions };
}
