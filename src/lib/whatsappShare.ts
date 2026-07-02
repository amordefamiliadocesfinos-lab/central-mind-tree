/**
 * Envio para WhatsApp com anexos.
 *
 * Estratégia:
 * 1) Sempre abre o WhatsApp/Web pelo mesmo caminho da mensagem de texto.
 * 2) Com imagens: tenta copiar a primeira imagem para o clipboard para colar
 *    no WhatsApp Web como mídia nativa.
 * 3) Baixa os anexos localmente para o usuário arrastar/anexar manualmente.
 *
 * Nunca mais acrescentamos as URLs dos anexos ao texto — isso poluía a
 * mensagem com links de storage (ex.: xkskyu...supabase.co).
 */
import { toast } from 'sonner';
import { openWhatsApp } from './whatsapp';
import type { WhatsAppAttachment } from '@/components/crm/WhatsAppAttachments';

async function fetchAsFile(att: WhatsAppAttachment): Promise<File | null> {
  try {
    const res = await fetch(att.url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new File([blob], att.name, { type: att.type || blob.type || 'application/octet-stream' });
  } catch {
    return null;
  }
}

async function triggerDownloadFile(file: File) {
  const blobUrl = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
}

async function copyImageToClipboard(file: File): Promise<boolean> {
  try {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;
    // Alguns browsers só aceitam image/png no clipboard — converte se preciso.
    let outBlob: Blob = file;
    if (file.type !== 'image/png') {
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = reject;
          i.src = url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no-ctx');
        ctx.drawImage(img, 0, 0);
        outBlob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(b => (b ? resolve(b) : reject()), 'image/png')
        );
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': outBlob })]);
    return true;
  } catch {
    return false;
  }
}

export interface ShareToWhatsAppOptions {
  phone?: string | null;
  message: string;
  attachments: WhatsAppAttachment[];
}

export async function shareToWhatsApp({ phone, message, attachments }: ShareToWhatsAppOptions): Promise<boolean> {
  // Abre o WhatsApp com o TEXTO PURO, exatamente como no envio sem anexos.
  // Não usamos navigator.share porque no desktop ele abre o painel do sistema
  // com vários apps, em vez de levar direto ao WhatsApp Web.
  const opened = openWhatsApp(phone, message);
  if (!opened) {
    toast.error('O navegador bloqueou o WhatsApp. Libere pop-ups para este site e tente novamente.');
    return false;
  }

  if (!attachments.length) return true;

  // Prepara arquivos localmente uma única vez para clipboard/download.
  const files = (await Promise.all(attachments.map(fetchAsFile))).filter((f): f is File => !!f);

  // Caminho 2: Desktop com pelo menos uma imagem — copia p/ clipboard.
  const firstImage = files.find(f => f.type.startsWith('image/'));
  let clipboardOk = false;
  if (firstImage) {
    clipboardOk = await copyImageToClipboard(firstImage);
  }

  // Baixa os arquivos para o usuário arrastar/anexar manualmente.
  files.forEach((f, i) => {
    setTimeout(() => { void triggerDownloadFile(f); }, i * 200);
  });

  if (clipboardOk) {
    toast.success(
      'Imagem copiada! No WhatsApp, cole com Ctrl+V (ou ⌘+V) para enviar como foto.',
      { duration: 8000 }
    );
  } else {
    toast.info(
      `${attachments.length} arquivo(s) baixados — arraste para dentro da conversa do WhatsApp (ou clique no clipe 📎).`,
      { duration: 7000 }
    );
  }

  return true;
}
