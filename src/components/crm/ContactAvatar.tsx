import { useState, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Camera, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ContactAvatarProps {
  photoUrl?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  editable?: boolean;
  onPhotoChange?: (url: string | null) => void;
}

const SIZE_MAP = {
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-12 w-12 text-sm',
  lg: 'h-20 w-20 text-xl',
};

function getInitials(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

export function ContactAvatar({ photoUrl, name, size = 'md', editable = false, onPhotoChange }: ContactAvatarProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem válida');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 5MB');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('contact-avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('contact-avatars')
        .getPublicUrl(fileName);

      onPhotoChange?.(publicUrl);
      toast.success('Foto atualizada');
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error('Erro ao enviar foto');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onPhotoChange?.(null);
  };

  return (
    <div className="relative group inline-flex">
      <Avatar className={cn(SIZE_MAP[size], 'border-2 border-border')}>
        <AvatarImage src={photoUrl || undefined} alt={name} className="object-cover" />
        <AvatarFallback className="bg-muted font-semibold text-muted-foreground">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>

      {editable && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              'absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer',
              uploading && 'opacity-100'
            )}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 text-white animate-spin" />
            ) : (
              <Camera className="h-4 w-4 text-white" />
            )}
          </button>
          {photoUrl && !uploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
