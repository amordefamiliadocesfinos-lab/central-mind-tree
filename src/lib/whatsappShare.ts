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

async function triggerDownload(att: WhatsAppAttachment) {
  try {
    // Baixa como blob local. Não usa a URL pública diretamente no <a>, pois
    // navegadores podem ignorar `download` em URL externa e abrir outra guia.
    const response = await fetch(att.url);
    if (!response.ok) throw new Error('download_failed');
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = att.name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    toast.error(`Não foi possível baixar ${att.name} automaticamente`);
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

  // 1) Abre o WhatsApp PRIMEIRO (dentro do gesto do usuário) para evitar
  //    bloqueio de popup. Qualquer download vem depois.
  const opened = openWhatsApp(phone, finalMessage);

  if (!opened) {
    toast.error('O navegador bloqueou o WhatsApp. Libere pop-ups para este site e tente novamente.');
    return false;
  }

  if (attachments.length) {
    // Baixa os arquivos para o usuário anexar manualmente como mídia.
    // Sem target=_blank e sem setTimeout grande para não cair no bloqueador.
    attachments.forEach((att, i) => {
      setTimeout(() => { void triggerDownload(att); }, i * 200);
    });
    toast.info(
      `${attachments.length} arquivo(s) baixados — anexe no WhatsApp com o clipe 📎 para enviar como mídia`,
      { duration: 6000 }
    );
  }

  return opened;
}
