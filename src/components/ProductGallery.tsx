import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, X, Star, Image as ImageIcon, Loader2, FolderOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { MediaLibrary } from '@/components/digital/MediaLibrary';

interface ProductGalleryProps {
  productId: string;
  mediaUrls: string[];
  coverImageUrl: string | null;
  onUpdate: (mediaUrls: string[], coverUrl: string | null) => void;
  editable?: boolean;
}

export function ProductGallery({
  productId,
  mediaUrls,
  coverImageUrl,
  onUpdate,
  editable = true,
}: ProductGalleryProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      const fileExt = file.name.split('.').pop();
      const filePath = `products/${productId}/${crypto.randomUUID()}.${fileExt}`;

      const { error } = await supabase.storage
        .from('media')
        .upload(filePath, file, { upsert: true });

      if (error) {
        console.error('Upload error:', error);
        toast.error(`Erro ao enviar ${file.name}`);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      newUrls.push(urlData.publicUrl);
    }

    if (newUrls.length > 0) {
      const updatedUrls = [...mediaUrls, ...newUrls];
      // Set first image as cover if none exists
      const newCover = coverImageUrl || newUrls[0];
      onUpdate(updatedUrls, newCover);
      toast.success(`${newUrls.length} imagem(ns) adicionada(s)`);
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = async (url: string) => {
    // Extract path from URL
    const match = url.match(/\/media\/(.+)$/);
    if (match) {
      await supabase.storage.from('media').remove([match[1]]);
    }

    const updatedUrls = mediaUrls.filter(u => u !== url);
    const newCover = coverImageUrl === url 
      ? (updatedUrls[0] || null) 
      : coverImageUrl;
    
    onUpdate(updatedUrls, newCover);
    toast.success('Imagem removida');
  };

  const handleSetCover = (url: string) => {
    onUpdate(mediaUrls, url);
    toast.success('Capa definida');
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />

      {editable && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="gap-2"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Adicionar Imagem
        </Button>
      )}

      {mediaUrls.length === 0 ? (
        <div className="flex items-center justify-center h-32 bg-muted rounded-lg border-2 border-dashed">
          <div className="text-center text-muted-foreground">
            <ImageIcon className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Nenhuma imagem</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {mediaUrls.map((url, index) => (
            <div
              key={url}
              className={cn(
                "relative aspect-square rounded-lg border overflow-hidden group",
                coverImageUrl === url && "ring-2 ring-primary"
              )}
            >
              <img
                src={url}
                alt={`Produto ${index + 1}`}
                className="w-full h-full object-cover"
              />
              
              {coverImageUrl === url && (
                <div className="absolute top-1 left-1 bg-primary text-primary-foreground rounded px-1.5 py-0.5 text-xs flex items-center gap-1">
                  <Star className="h-3 w-3 fill-current" />
                  Capa
                </div>
              )}

              {editable && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {coverImageUrl !== url && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSetCover(url)}
                      className="h-7 px-2 text-xs"
                    >
                      <Star className="h-3 w-3 mr-1" />
                      Capa
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleRemove(url)}
                    className="h-7 w-7 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
