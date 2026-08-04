import type {
  ConnectionStatusResult, ConnectorActionResult, NormalizedWebhookEvent,
  ProfilePictureResult, SendTextResult, WhatsAppConnector,
} from './connector.ts';

const PROVIDER = 'meta_cloud_api';

function renderMessage(message: Record<string, any>) {
  const type = String(message.type ?? 'unsupported');
  if (type === 'text') return { type, content: String(message.text?.body ?? '') };
  if (type === 'button') return { type, content: String(message.button?.text ?? 'Botão respondido') };
  if (type === 'interactive') {
    const value = message.interactive ?? {};
    return { type, content: String(value.button_reply?.title ?? value.list_reply?.title ?? 'Resposta interativa') };
  }
  const labels: Record<string, string> = {
    audio: 'Áudio recebido', image: 'Imagem recebida', video: 'Vídeo recebido', document: 'Documento recebido',
    sticker: 'Figurinha recebida', location: 'Localização recebida', contacts: 'Contato recebido', reaction: 'Reação recebida',
  };
  return { type, content: labels[type] ?? 'Mensagem não suportada' };
}

export class MetaWhatsAppConnector implements WhatsAppConnector {
  readonly providerName = PROVIDER;
  readonly instanceReference = Deno.env.get('META_WHATSAPP_PHONE_NUMBER_ID') ?? '';
  private readonly accessToken = Deno.env.get('META_WHATSAPP_ACCESS_TOKEN') ?? '';
  private readonly graphVersion = Deno.env.get('META_GRAPH_API_VERSION') ?? '';

  get isConfigured() { return Boolean(this.instanceReference && this.accessToken && this.graphVersion); }
  private get baseUrl() { return `https://graph.facebook.com/${this.graphVersion}/${this.instanceReference}`; }

  normalizeWebhook(payload: unknown): NormalizedWebhookEvent {
    return this.normalizeWebhooks(payload)[0] ?? {
      accepted: false, providerName: PROVIDER, providerInstanceRef: this.instanceReference,
      eventType: 'unknown', ignoredReason: 'evento sem mensagem ou status',
    };
  }

  normalizeWebhooks(payload: unknown): NormalizedWebhookEvent[] {
    const root = (payload ?? {}) as Record<string, any>;
    const events: NormalizedWebhookEvent[] = [];
    for (const entry of root.entry ?? []) for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue;
      const value = change.value ?? {};
      const phoneNumberId = String(value.metadata?.phone_number_id ?? this.instanceReference);
      const contacts = new Map<string, any>((value.contacts ?? []).map((c: any) => [String(c.wa_id), c]));
      for (const message of value.messages ?? []) {
        const id = String(message.id ?? ''); const from = String(message.from ?? '');
        if (!id || !from) continue;
        const rendered = renderMessage(message); const contact = contacts.get(from);
        events.push({
          accepted: true, providerName: PROVIDER, providerInstanceRef: phoneNumberId, eventType: 'message',
          externalMessageId: id, direction: 'inbound', source: 'provider', contactPhoneRaw: from,
          contactName: contact?.profile?.name, messageType: rendered.type, content: rendered.content,
          providerTimestamp: message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : new Date().toISOString(),
          deduplicationKey: `${PROVIDER}:${phoneNumberId}:message:${id}`,
        });
      }
      for (const status of value.statuses ?? []) {
        const id = String(status.id ?? ''); if (!id) continue;
        events.push({
          accepted: true, providerName: PROVIDER, providerInstanceRef: phoneNumberId, eventType: 'status',
          externalMessageId: id, direction: 'outbound', source: 'provider', messageType: 'status',
          content: String(status.status ?? 'unknown'),
          providerTimestamp: status.timestamp ? new Date(Number(status.timestamp) * 1000).toISOString() : new Date().toISOString(),
          errorCode: status.errors?.[0]?.code ? String(status.errors[0].code) : undefined,
          deduplicationKey: `${PROVIDER}:${phoneNumberId}:status:${id}:${status.status ?? 'unknown'}`,
        });
      }
    }
    return events;
  }

  async sendTextMessage(phone: string, message: string): Promise<SendTextResult> {
    if (!this.isConfigured) return { ok: false, errorCode: 'not_configured', errorMessage: 'Meta WhatsApp Cloud API não configurada' };
    try {
      const res = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST', headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: phone, type: 'text', text: { preview_url: false, body: message } }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return {
        ok: false, errorCode: body?.error?.code ? String(body.error.code) : `http_${res.status}`,
        errorMessage: String(body?.error?.error_user_msg ?? body?.error?.message ?? 'Falha no envio pela Meta'),
      };
      return { ok: true, externalMessageId: body?.messages?.[0]?.id ? String(body.messages[0].id) : undefined };
    } catch (error) { return { ok: false, errorCode: 'network_error', errorMessage: (error as Error).message }; }
  }

  async enableSentByMeNotifications(): Promise<ConnectorActionResult> { return { ok: true }; }
  async getConnectionStatus(): Promise<ConnectionStatusResult> {
    if (!this.isConfigured) return { status: 'not_configured', instanceReference: this.instanceReference, providerName: PROVIDER };
    try {
      const res = await fetch(`${this.baseUrl}?fields=id,display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${this.accessToken}` } });
      return { status: res.ok ? 'connected' : 'degraded', instanceReference: this.instanceReference, providerName: PROVIDER, error: res.ok ? undefined : `http_${res.status}` };
    } catch (error) { return { status: 'unknown', instanceReference: this.instanceReference, providerName: PROVIDER, error: (error as Error).message }; }
  }
  async getProfilePictureUrl(_phone: string): Promise<ProfilePictureResult> {
    return { ok: false, errorCode: 'unsupported', errorMessage: 'A Cloud API não expõe foto de perfil do cliente' };
  }
}

export function getWhatsAppConnector() { return new MetaWhatsAppConnector(); }
