import { useRef, useState } from 'react';
import { Paperclip, X, Image as ImageIcon, FileAudio, FileVideo, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface WhatsAppAttachment {
  url: string;
  name: string;
  type: string; // mime
  size: number;
}

interface Props {
  attachments: WhatsAppAttachment[];
  onChange: (next: WhatsAppAttachment[]) => void;
  disabled?: boolean;
  compact?: boolean;
}

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

function iconFor(mime: string) {
  if (mime.startsWith('image/')) return ImageIcon;
  if (mime.startsWith('audio/')) return FileAudio;
  if (mime.startsWith('video/')) return FileVideo;
  return FileText;
}

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function WhatsAppAttachments({ attachments, onChange, disabled, compact }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handlePick = () => inputRef.current?.click();

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const uploaded: WhatsAppAttachment[] = [];
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_SIZE) {
          toast.error(`${file.name} ultrapassa 20MB`);
          continue;
        }
        const ext = file.name.split('.').pop() || 'bin';
        const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 80);
        const path = `whatsapp/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
        const { error } = await supabase.storage.from('media').upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || `application/${ext}`,
        });
        if (error) {
          toast.error(`Falha ao enviar ${file.name}`);
          continue;
        }
        const { data: publicData } = supabase.storage.from('media').getPublicUrl(path);
        const { data: signedData } = await supabase.storage.from('media').createSignedUrl(path, 60 * 60 * 24 * 7);
        uploaded.push({
          url: signedData?.signedUrl || publicData.publicUrl,
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
        });
      }
      if (uploaded.length) {
        onChange([...attachments, ...uploaded]);
        toast.success(`${uploaded.length} arquivo(s) anexado(s)`);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = (url: string) => {
    onChange(attachments.filter(a => a.url !== url));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size={compact ? 'sm' : 'default'}
          onClick={handlePick}
          disabled={disabled || uploading}
          className="gap-1.5"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          {uploading ? 'Enviando...' : 'Anexar (foto, áudio, arquivo)'}
        </Button>
        <span className="text-[11px] text-muted-foreground">até 20MB · vários</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,audio/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {attachments.length > 0 && (
        <div className={cn('flex flex-wrap gap-1.5', compact && 'gap-1')}>
          {attachments.map(att => {
            const Icon = iconFor(att.type);
            const isImage = att.type.startsWith('image/');
            return (
              <div
                key={att.url}
                className="group flex items-center gap-1.5 rounded-md border bg-muted/40 pl-1.5 pr-1 py-1 text-xs max-w-[200px]"
                title={att.name}
              >
                {isImage ? (
                  <img src={att.url} alt={att.name} className="h-6 w-6 rounded object-cover" />
                ) : (
                  <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                )}
                <span className="truncate flex-1">{att.name}</span>
                <span className="text-[10px] text-muted-foreground">{fmtSize(att.size)}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(att.url)}
                  className="rounded p-0.5 hover:bg-red-500/20 text-muted-foreground hover:text-red-600"
                  title="Remover"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Anexa as URLs públicas dos arquivos ao final do texto da mensagem para envio via wa.me. */
export function appendAttachmentsToMessage(message: string, attachments: WhatsAppAttachment[]): string {
  if (!attachments.length) return message;
  const links = attachments
    .map(a => {
      const kind = a.type.startsWith('image/')
        ? '🖼️'
        : a.type.startsWith('audio/')
          ? '🎵'
          : a.type.startsWith('video/')
            ? '🎬'
            : '📎';
      return `${kind} ${a.name}: ${a.url}`;
    })
    .join('\n\n');
  const sep = message.trim() ? '\n\n' : '';
  return `${message}${sep}${links}`;
}
