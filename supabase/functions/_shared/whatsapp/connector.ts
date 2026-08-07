/**
 * Contrato universal de conector WhatsApp.
 * Nenhum módulo/componente fora desta pasta deve conhecer URLs, tokens
 * ou formato específico de provedor.
 */

export type NormalizedDirection = 'inbound' | 'outbound';
export type NormalizedSource = 'mobile' | 'crm' | 'provider' | 'legacy';
export type ConnectionStatus =
  | 'connected'
  | 'degraded'
  | 'disconnected'
  | 'not_configured'
  | 'unknown';

export interface NormalizedWebhookEvent {
  /** Evento aceito e relevante para o MVP */
  accepted: boolean;
  /** Motivo quando accepted = false (grupo, newsletter, tipo ignorado...) */
  ignoredReason?: string;
  providerName: string;
  providerInstanceRef: string;
  eventType: string;
  externalMessageId?: string;
  direction?: NormalizedDirection;
  source?: NormalizedSource;
  /** Telefone bruto do contato (sem normalização brasileira aplicada) */
  contactPhoneRaw?: string;
  contactName?: string;
  messageType?: string;
  /** Texto a persistir (placeholder legível quando mídia) */
  content?: string;
  providerTimestamp?: string;
  deduplicationKey?: string;
  errorCode?: string;
  mediaId?: string;
  mediaMimeType?: string;
  mediaFilename?: string;
  mediaCaption?: string;
}

export interface DownloadedMedia {
  bytes: ArrayBuffer;
  mimeType: string;
  filename?: string;
}

export interface SendTextResult {
  ok: boolean;
  externalMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface SendMediaInput {
  type: 'image' | 'audio' | 'video' | 'document';
  url: string;
  caption?: string;
  filename?: string;
}

export interface ConnectionStatusResult {
  status: ConnectionStatus;
  instanceReference: string;
  providerName: string;
  error?: string;
}

export interface ProfilePictureResult {
  ok: boolean;
  /** Link temporário do provedor. Nunca deve ser persistido. */
  temporaryUrl?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface ConnectorActionResult {
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface WhatsAppConnector {
  readonly providerName: string;
  readonly instanceReference: string;
  readonly isConfigured: boolean;
  normalizeWebhook(payload: unknown): NormalizedWebhookEvent;
  sendTextMessage(phone: string, message: string): Promise<SendTextResult>;
  sendMediaMessage?(phone: string, media: SendMediaInput): Promise<SendTextResult>;
  enableSentByMeNotifications(): Promise<ConnectorActionResult>;
  getConnectionStatus(): Promise<ConnectionStatusResult>;
  getProfilePictureUrl(phone: string): Promise<ProfilePictureResult>;
  downloadMedia?(mediaId: string): Promise<DownloadedMedia>;
}

/** Normalização de telefone BR: 55 + DDD + número. Inválido => null. */
export function normalizeBrPhone(raw?: string | null): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, '').replace(/^0+/, '');
  if (!d) return null;
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return d;
  return null;
}
