import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { openWhatsApp } from '@/lib/whatsapp';

export interface WhatsAppLogOptions {
  contactId: string;
  contactName: string;
  phone: string;
  message?: string;
  templateLabel?: string;
  approach?: string;
  source: 'crm_card' | 'crm_smart_attend' | 'crm_follow_up' | 'atendimento' | 'dashboard';
  /** Não abre o WhatsApp aqui — quem chamou já cuidou do envio (ex.: shareToWhatsApp com anexos). */
  skipOpen?: boolean;
}

/**
 * Abre WhatsApp e registra automaticamente em:
 * 1. contact_history (timeline do contato)
 * 2. service_conversations (módulo Atendimento Digital)
 *
 * Usar em TODO botão "WhatsApp" do sistema para garantir rastreabilidade.
 */
export function useWhatsAppWithLog() {
  const logAndOpen = useCallback(async (opts: WhatsAppLogOptions) => {
    const {
      contactId,
      contactName,
      phone,
      message,
      templateLabel,
      approach,
      source,
      skipOpen,
    } = opts;

    if (!phone) {
      toast.error('Contato sem telefone/WhatsApp cadastrado');
      return false;
    }

    const now = new Date().toISOString();
    const preview = message
      ? message.length > 120
        ? message.slice(0, 120) + '…'
        : message
      : '(sem mensagem prévia)';

    // 1. Registra no contact_history
    const historyDesc = templateLabel
      ? `📤 WhatsApp enviado · ${templateLabel} · "${preview}"`
      : approach
        ? `⚡ Atendimento inteligente · ${approach} · "${preview}"`
        : `📤 Mensagem iniciada via WhatsApp · "${preview}"`;

    const { error: historyError } = await supabase.from('contact_history').insert({
      contact_id: contactId,
      event_type: 'whatsapp',
      interaction_type: 'whatsapp',
      description: historyDesc,
      interaction_date: now,
    });

    if (historyError) {
      console.error('Erro ao registrar no histórico:', historyError);
    }

    // 2. Atualiza ultimo_contato no contato
    await supabase
      .from('contacts')
      .update({ ultimo_contato: now.split('T')[0], updated_at: now })
      .eq('id', contactId);

    // 3. Garante conversa no Atendimento Digital (service_conversations)
    // Busca conversa existente
    const { data: existingConv } = await supabase
      .from('service_conversations')
      .select('id')
      .eq('contact_id', contactId)
      .maybeSingle();

    if (existingConv?.id) {
      // Atualiza última mensagem preview
      await supabase
        .from('service_conversations')
        .update({
          last_message_preview: preview,
          last_message_at: now,
          updated_at: now,
        })
        .eq('id', existingConv.id);

      // Insere a mensagem em service_messages como "sent"
      await supabase.from('service_messages').insert({
        conversation_id: existingConv.id,
        sender: 'business',
        content: message || 'Mensagem iniciada via WhatsApp',
        message_type: 'text',
        created_at: now,
      });
    } else {
      // Cria nova conversa vinculada ao contato
      const { data: newConv } = await supabase
        .from('service_conversations')
        .insert({
          contact_id: contactId,
          contact_name: contactName,
          contact_handle: phone,
          status: 'open',
          funnel_stage: 'lead',
          last_message_preview: preview,
          last_message_at: now,
        })
        .select()
        .single();

      if (newConv?.id) {
        await supabase.from('service_messages').insert({
          conversation_id: newConv.id,
          sender: 'business',
          content: message || 'Mensagem iniciada via WhatsApp',
          message_type: 'text',
          created_at: now,
        });
      }
    }

    // 4. Abre WhatsApp
    const opened = openWhatsApp(phone, message);
    if (opened) {
      toast.success('WhatsApp aberto · Registrado no histórico e no Atendimento');
    }

    return opened;
  }, []);

  return { logAndOpen };
}
