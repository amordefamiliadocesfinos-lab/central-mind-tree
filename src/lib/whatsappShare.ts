/**
 * Envio para WhatsApp com anexos.
 *
 * Comportamento (restaurado ao que funcionava antes):
 * - SEMPRE abre o WhatsApp Web/app com a mensagem pré-preenchida.
 * - Quando há anexos, os links públicos das mídias são acrescentados ao final
 *   da mensagem (o WhatsApp gera preview automático para imagens/vídeos via URL).
 * - Adicionalmente, baixa as mídias localmente para o usuário poder anexá-las
 *   como arquivo real (clipe 📎) caso queira enviar como mídia nativa.
 *
 * Observação: wa.me não aceita upload de mídia via URL — só texto. Por isso
 * combinamos as duas estratégias: link no texto + download local opcional.
 */
import { toast } from 'sonner';
import { openWhatsApp } from './whatsapp';
import { appendAttachmentsToMessage, type WhatsAppAttachment } from '@/components/crm/WhatsAppAttachments';

function triggerDownload(att: WhatsAppAttachment) {
  try {
    // NÃO usar target=_blank — o navegador bloqueia como popup quando vários
    // são disparados. O atributo `download` é suficiente para baixar local.
    const a = document.createElement('a');
    a.href = att.url;
    a.download = att.name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    /* ignore */
  }
}

export interface ShareToWhatsAppOptions {
  phone?: string | null;
  message: string;
  attachments: WhatsAppAttachment[];
}

/**
 * Abre o WhatsApp com a mensagem (+ links dos anexos) e dispara downloads
 * locais das mídias para anexo manual opcional.
 * Retorna true se o WhatsApp foi aberto.
 */
export async function shareToWhatsApp({ phone, message, attachments }: ShareToWhatsAppOptions): Promise<boolean> {
  const finalMessage = attachments.length
    ? appendAttachmentsToMessage(message, attachments)
    : message;

  const opened = openWhatsApp(phone, finalMessage);

  if (opened && attachments.length) {
    // baixa em segundo plano para o usuário poder anexar manualmente se quiser
    attachments.forEach((att, i) => setTimeout(() => triggerDownload(att), 300 + i * 250));
    toast.info(
      `${attachments.length} arquivo(s) baixados — anexe no WhatsApp com o clipe 📎 se quiser enviar como mídia`,
      { duration: 5000 }
    );
  }

  return opened;
}
