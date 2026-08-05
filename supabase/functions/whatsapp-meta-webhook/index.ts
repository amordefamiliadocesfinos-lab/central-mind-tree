import { createClient } from 'npm:@supabase/supabase-js@2';
import { normalizeBrPhone } from '../_shared/whatsapp/connector.ts';
import { getWhatsAppConnector } from '../_shared/whatsapp/meta-connector.ts';

const MAX_BODY_BYTES = 256 * 1024;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function validSignature(raw: string, signature: string | null, secret: string) {
  if (!signature?.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const expected = `sha256=${Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  return constantTimeEqual(expected, signature);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const verifyToken = Deno.env.get('META_WHATSAPP_VERIFY_TOKEN') ?? '';

  if (req.method === 'GET') {
    const valid = url.searchParams.get('hub.mode') === 'subscribe'
      && url.searchParams.get('hub.verify_token') === verifyToken
      && Boolean(verifyToken);
    return valid
      ? new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 })
      : new Response('Forbidden', { status: 403 });
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const appSecret = Deno.env.get('META_APP_SECRET') ?? '';
  if (!appSecret) return json({ error: 'Webhook não configurado' }, 503);
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'Payload muito grande' }, 413);
  if (!await validSignature(raw, req.headers.get('x-hub-signature-256'), appSecret)) return json({ error: 'Assinatura inválida' }, 401);

  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return json({ error: 'JSON inválido' }, 400); }

  const connector = getWhatsAppConnector();
  const events = connector.normalizeWebhooks(payload);
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  let processed = 0;

  for (const evt of events) {
    if (!evt.accepted || !evt.deduplicationKey) continue;
    const { error: receiptError } = await supabase.from('integration_webhook_receipts').insert({
      provider_name: evt.providerName, provider_instance_ref: evt.providerInstanceRef,
      event_type: evt.eventType, deduplication_key: evt.deduplicationKey, processing_status: 'processing',
    });
    if (receiptError?.code === '23505') continue;
    if (receiptError) { console.error('receipt failed', receiptError.message); continue; }

    const finish = async (status: string, error?: string) => {
      await supabase.from('integration_webhook_receipts').update({
        processing_status: status, error_message: error ?? null, processed_at: new Date().toISOString(),
      }).eq('deduplication_key', evt.deduplicationKey!);
    };

    try {
      await supabase.from('whatsapp_integrations').upsert({
        provider: evt.providerName, instance_reference: evt.providerInstanceRef,
        connection_status: 'connected', last_webhook_at: new Date().toISOString(), last_checked_at: new Date().toISOString(),
      }, { onConflict: 'instance_reference' });

      if (evt.eventType === 'status') {
        await supabase.from('service_messages').update({
          delivery_status: evt.content, provider_timestamp: evt.providerTimestamp,
          error_code: evt.errorCode ?? null,
        }).eq('provider_name', evt.providerName).eq('provider_instance_ref', evt.providerInstanceRef).eq('external_message_id', evt.externalMessageId);
        await finish('processed'); processed++; continue;
      }

      const phone = normalizeBrPhone(evt.contactPhoneRaw);
      if (!phone) { await finish('ignored', 'telefone inválido'); continue; }
      const { data: matches } = await supabase.from('contacts').select('id,name').eq('phone_normalized', phone).limit(2);
      let contact = matches?.length === 1 ? matches[0] : null;
      if (!contact && (!matches || matches.length === 0)) {
        const { data, error } = await supabase.from('contacts').insert({
          name: evt.contactName?.trim() || `Contato WhatsApp ${phone.slice(-4)}`,
          whatsapp: phone, origem_lead: 'WhatsApp', funnel_status: 'novo_lead', is_active: true,
        }).select('id,name').single();
        if (error) throw error; contact = data;
      }

      let conversation: { id: string; unread_count?: number | null } | null = null;
      if (contact) {
        const result = await supabase.from('service_conversations').select('id,unread_count').eq('contact_id', contact.id).order('last_message_at', { ascending: false }).limit(1).maybeSingle();
        conversation = result.data;
      }
      if (!conversation) {
        const result = await supabase.from('service_conversations').select('id,unread_count').eq('contact_handle', phone).limit(1).maybeSingle();
        conversation = result.data;
      }
      if (!conversation) {
        const result = await supabase.from('service_conversations').insert({
          contact_id: contact?.id ?? null, contact_name: contact?.name ?? evt.contactName ?? null,
          contact_handle: phone, status: 'open', funnel_stage: 'novo_lead', channel: 'whatsapp',
        }).select('id').single();
        if (result.error) throw result.error; conversation = result.data;
      }

      const now = evt.providerTimestamp ?? new Date().toISOString();
      const { error: messageError } = await supabase.from('service_messages').insert({
        conversation_id: conversation!.id, sender: 'customer', content: evt.content ?? 'Mensagem não suportada',
        is_ai_suggested: false, external_message_id: evt.externalMessageId, direction: 'inbound',
        message_type: evt.messageType ?? 'text', delivery_status: 'received', provider_timestamp: now,
        source: 'provider', provider_name: evt.providerName, provider_instance_ref: evt.providerInstanceRef,
      });
      if (messageError && messageError.code !== '23505') throw messageError;
      await supabase.from('service_conversations').update({
        last_message_at: now, last_inbound_at: now, last_message_preview: (evt.content ?? '').slice(0, 100),
        needs_reply: true, status: 'open', resolved_at: null, attendance_state: 'responder',
        unread_count: (conversation!.unread_count ?? 0) + 1,
      }).eq('id', conversation!.id);
      if (contact) {
        await supabase.from('contacts').update({
          next_action_text: 'Responder cliente no WhatsApp',
          next_action_date: now,
          next_contact_date: now,
          updated_at: new Date().toISOString(),
        }).eq('id', contact.id);
      }
      await finish('processed'); processed++;
    } catch (error) {
      console.error('meta webhook processing failed', (error as Error).message);
      await finish('error', (error as Error).message);
    }
  }
  return json({ ok: true, received: events.length, processed });
});
