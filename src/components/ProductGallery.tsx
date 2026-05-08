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
  const [showLibrary, setShowLibrary] = useState(false);
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

      const url = urlData.publicUrl;
      newUrls.push(url);

      // Mirror into central media library
      const willBeCover = !coverImageUrl && newUrls.length === 1;
      await supabase.from('digital_media').insert({
        url,
        filename: file.name,
        file_type: file.type,
        file_size: file.size,
        product_id: productId,
        is_product_cover: willBeCover,
      });
    }

    if (newUrls.length > 0) {
      const updatedUrls = [...mediaUrls, ...newUrls];
      const newCover = coverImageUrl || newUrls[0];
      onUpdate(updatedUrls, newCover);
      toast.success(`${newUrls.length} imagem(ns) adicionada(s)`);
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handlePickFromLibrary = (urls: string[]) => {
    const fresh = urls.filter(u => !mediaUrls.includes(u));
    if (fresh.length === 0) {
      setShowLibrary(false);
      return;
    }
    // Link selected library items to this product (do not delete originals)
    fresh.forEach(async (url) => {
      // If a row for this product+url already exists, skip; otherwise upsert link
      const { data: existing } = await supabase
        .from('digital_media')
        .select('id')
        .eq('url', url)
        .eq('product_id', productId)
        .maybeSingle();
      if (!existing) {
        // Find any digital_media row with this url (idea-only) and link it to product as well by inserting a new row
        await supabase.from('digital_media').insert({
          url,
          product_id: productId,
          is_product_cover: false,
        });
      }
    });
    const updatedUrls = [...mediaUrls, ...fresh];
    const newCover = coverImageUrl || fresh[0];
    onUpdate(updatedUrls, newCover);
    setShowLibrary(false);
    toast.success(`${fresh.length} mídia(s) vinculada(s) ao produto`);
  };

  const handleRemove = async (url: string) => {
    // Unlink from central library for this product (do not delete shared media)
    await supabase
      .from('digital_media')
      .delete()
      .eq('product_id', productId)
      .eq('url', url);

    const updatedUrls = mediaUrls.filter(u => u !== url);
    const newCover = coverImageUrl === url 
      ? (updatedUrls[0] || null) 
      : coverImageUrl;
    
    onUpdate(updatedUrls, newCover);
    toast.success('Imagem removida');
  };

  const handleSetCover = async (url: string) => {
    // Reset previous cover for this product, then mark new one
    await supabase
      .from('digital_media')
      .update({ is_product_cover: false })
      .eq('product_id', productId);
    await supabase
      .from('digital_media')
      .update({ is_product_cover: true })
      .eq('product_id', productId)
      .eq('url', url);

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
        <div className="flex flex-wrap gap-2">
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowLibrary(true)}
            className="gap-2"
          >
            <FolderOpen className="h-4 w-4" />
            Escolher da Biblioteca
          </Button>
        </div>
      )}

      <ResponsiveDialog open={showLibrary} onOpenChange={setShowLibrary} title="Biblioteca de Mídia">
        <div className="-mx-6 -mb-6">
          <MediaLibrary
            mode="select"
            onSelectMultiple={handlePickFromLibrary}
          />
        </div>
      </ResponsiveDialog>

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
