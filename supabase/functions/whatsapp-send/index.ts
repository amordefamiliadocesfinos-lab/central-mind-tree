import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { normalizeBrPhone } from '../_shared/whatsapp/connector.ts';
import { getWhatsAppConnector } from '../_shared/whatsapp/meta-connector.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Não autenticado' }, 401);

  const authClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(
    authHeader.replace('Bearer ', ''),
  );
  if (claimsError || !claimsData?.claims) return json({ error: 'Não autenticado' }, 401);

  let body: { conversation_id?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const conversationId = String(body.conversation_id ?? '').trim();
  const message = String(body.message ?? '').trim();
  if (!conversationId) return json({ error: 'Conversa não informada' }, 400);
  if (!message) return json({ error: 'Mensagem vazia' }, 400);
  if (message.length > 4096) return json({ error: 'Mensagem muito longa' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data: conv } = await supabase
    .from('service_conversations')
    .select('id, contact_id, contact_handle, last_inbound_at')
    .eq('id', conversationId)
    .maybeSingle();
  if (!conv) return json({ error: 'Conversa não encontrada' }, 404);

  let phone = normalizeBrPhone(conv.contact_handle);
  if (!phone && conv.contact_id) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('phone_normalized')
      .eq('id', conv.contact_id)
      .maybeSingle();
    phone = contact?.phone_normalized ?? null;
  }
  if (!phone) return json({ error: 'Contato sem telefone de WhatsApp válido' }, 400);

  // Texto livre só pode ser enviado dentro da janela de atendimento da Meta.
  const lastInboundAt = conv.last_inbound_at ? Date.parse(conv.last_inbound_at) : 0;
  if (!lastInboundAt || Date.now() - lastInboundAt > 24 * 60 * 60 * 1000) {
    return json({
      error: 'A janela de atendimento de 24 horas está encerrada. Use um template aprovado pela Meta para reiniciar a conversa.',
      code: 'template_required',
    }, 409);
  }

  const connector = getWhatsAppConnector();
  if (!connector.isConfigured) {
    return json({ error: 'Integração de WhatsApp ainda não configurada' }, 503);
  }

  const { data: integration } = await supabase
    .from('whatsapp_integrations')
    .select('is_enabled, connection_status')
    .eq('instance_reference', connector.instanceReference)
    .maybeSingle();

  if (integration && integration.is_enabled === false) {
    return json({ error: 'Envio de WhatsApp está desativado' }, 409);
  }
  if (integration && ['disconnected', 'not_configured'].includes(integration.connection_status)) {
    return json({ error: 'WhatsApp desconectado — reconecte a integração' }, 409);
  }

  const nowIso = new Date().toISOString();
  const { data: pending, error: pendingErr } = await supabase
    .from('service_messages')
    .insert({
      conversation_id: conversationId,
      sender: 'agent',
      content: message,
      is_ai_suggested: false,
      direction: 'outbound',
      message_type: 'text',
      delivery_status: 'pending',
      source: 'crm',
      provider_name: connector.providerName,
      provider_instance_ref: connector.instanceReference,
    })
    .select('id')
    .single();
  if (pendingErr) return json({ error: 'Falha ao registrar mensagem' }, 500);

  const result = await connector.sendTextMessage(phone, message);

  if (!result.ok) {
    await supabase
      .from('service_messages')
      .update({ delivery_status: 'failed', error_code: result.errorCode ?? 'unknown' })
      .eq('id', pending.id);
    return json({ error: result.errorMessage ?? 'Falha ao enviar mensagem' }, 502);
  }

  await supabase
    .from('service_messages')
    .update({
      delivery_status: 'sent',
      external_message_id: result.externalMessageId ?? null,
      provider_timestamp: nowIso,
    })
    .eq('id', pending.id);

  await supabase
    .from('service_conversations')
    .update({
      last_message_at: nowIso,
      last_outbound_at: nowIso,
      last_message_preview: message.slice(0, 100),
      needs_reply: false,
    })
    .eq('id', conversationId);

  return json({ ok: true, message_id: pending.id, external_message_id: result.externalMessageId ?? null });
});
