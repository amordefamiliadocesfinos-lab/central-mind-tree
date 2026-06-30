/**
 * Compartilhamento de WhatsApp com anexos REAIS (imagem/áudio/arquivo).
 *
 * wa.me / api.whatsapp.com NÃO aceitam mídia via URL — somente texto.
 * Para enviar a foto/arquivo como mídia mesmo, usamos o Web Share API
 * (navigator.share com files), que no celular abre o seletor nativo e
 * permite escolher o WhatsApp; o arquivo vai como mídia de verdade.
 *
 * Fallback (desktop sem suporte): baixa os arquivos para o computador do
 * usuário e abre o WhatsApp com SÓ o texto (sem o link feio), pedindo
 * para anexar manualmente — assim o destinatário recebe imagem como imagem.
 */
import { toast } from 'sonner';
import { openWhatsApp } from './whatsapp';
import type { WhatsAppAttachment } from '@/components/crm/WhatsAppAttachments';

async function fetchAsFile(att: WhatsAppAttachment): Promise<File | null> {
  try {
    const res = await fetch(att.url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new File([blob], att.name, { type: att.type || blob.type });
  } catch {
    return null;
  }
}

function triggerDownload(att: WhatsAppAttachment) {
  const a = document.createElement('a');
  a.href = att.url;
  a.download = att.name;
  a.rel = 'noopener';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export interface ShareToWhatsAppOptions {
  phone?: string | null;
  message: string;
  attachments: WhatsAppAttachment[];
}

/**
 * Tenta enviar mensagem + arquivos como mídia real.
 * Retorna true se o WhatsApp/seletor de compartilhamento foi aberto.
 */
export async function shareToWhatsApp({ phone, message, attachments }: ShareToWhatsAppOptions): Promise<boolean> {
  // Sem anexos: caminho normal de texto.
  if (!attachments.length) {
    return openWhatsApp(phone, message);
  }

  // 1) Web Share API com arquivos (mobile e alguns desktops)
  const nav: any = typeof navigator !== 'undefined' ? navigator : null;
  if (nav?.canShare && nav?.share) {
    try {
      const files = (await Promise.all(attachments.map(fetchAsFile))).filter((f): f is File => !!f);
      if (files.length && nav.canShare({ files })) {
        await nav.share({ files, text: message, title: 'WhatsApp' });
        toast.success('Selecione WhatsApp no compartilhamento para enviar a mídia');
        return true;
      }
    } catch (err: any) {
      // AbortError = usuário cancelou. Outros erros caem no fallback.
      if (err?.name === 'AbortError') return false;
      console.warn('navigator.share falhou, usando fallback:', err);
    }
  }

  // 2) Fallback: baixa os arquivos e abre WhatsApp só com o texto.
  attachments.forEach((att, i) => {
    // pequeno delay para o browser não bloquear múltiplos downloads
    setTimeout(() => triggerDownload(att), i * 250);
  });

  const opened = openWhatsApp(phone, message);
  if (opened) {
    toast.info(
      `${attachments.length} arquivo(s) baixados — anexe-os no WhatsApp usando o clipe 📎`,
      { duration: 6000 }
    );
  }
  return opened;
}
