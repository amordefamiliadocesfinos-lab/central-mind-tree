import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Upload, Image, Video, File, Trash2, Plus, Search, Tag, X, Check } from 'lucide-react';

interface MediaItem {
  id: string;
  url: string;
  filename: string | null;
  file_type: string | null;
  file_size: number | null;
  tags: string[];
  idea_id: string | null;
  variation_id: string | null;
  created_at: string;
}

interface MediaLibraryProps {
  ideaId?: string;
  variationId?: string;
  onSelect?: (url: string) => void;
  mode?: 'browse' | 'select';
}

export function MediaLibrary({ ideaId, variationId, onSelect, mode = 'browse' }: MediaLibraryProps) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMedia = async () => {
    let query = supabase.from('digital_media').select('*').order('created_at', { ascending: false });
    
    if (ideaId) {
      query = query.eq('idea_id', ideaId);
    }
    if (variationId) {
      query = query.eq('variation_id', variationId);
    }

    const { data, error } = await query;
    if (!error && data) {
      setMedia(data as MediaItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMedia();
  }, [ideaId, variationId]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadPromises = Array.from(files).map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `digital/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) {
        toast.error(`Erro ao enviar ${file.name}`);
        return null;
      }

      const { data: urlData } = supabase.storage.from('media').getPublicUrl(filePath);

      const { error: dbError } = await supabase.from('digital_media').insert({
        url: urlData.publicUrl,
        filename: file.name,
        file_type: file.type,
        file_size: file.size,
        tags: [],
        idea_id: ideaId || null,
        variation_id: variationId || null,
      });

      if (dbError) {
        toast.error(`Erro ao salvar ${file.name}`);
        return null;
      }

      return urlData.publicUrl;
    });

    await Promise.all(uploadPromises);
    toast.success('Arquivos enviados!');
    setUploading(false);
    fetchMedia();
  };

  const handleDelete = async (item: MediaItem) => {
    const { error } = await supabase.from('digital_media').delete().eq('id', item.id);
    if (error) {
      toast.error('Erro ao excluir');
      return;
    }
    toast.success('Arquivo excluído');
    fetchMedia();
  };

  const handleAddTag = async (itemId: string, tag: string) => {
    const item = media.find(m => m.id === itemId);
    if (!item || !tag.trim()) return;

    const newTags = [...(item.tags || []), tag.trim()];
    await supabase.from('digital_media').update({ tags: newTags }).eq('id', itemId);
    fetchMedia();
    setNewTag('');
  };

  const handleRemoveTag = async (itemId: string, tag: string) => {
    const item = media.find(m => m.id === itemId);
    if (!item) return;

    const newTags = (item.tags || []).filter(t => t !== tag);
    await supabase.from('digital_media').update({ tags: newTags }).eq('id', itemId);
    fetchMedia();
  };

  const allTags = Array.from(new Set(media.flatMap(m => m.tags || [])));

  const filteredMedia = media.filter(item => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!item.filename?.toLowerCase().includes(query) && 
          !item.tags?.some(t => t.toLowerCase().includes(query))) {
        return false;
      }
    }
    if (selectedTags.length > 0) {
      if (!selectedTags.some(t => item.tags?.includes(t))) {
        return false;
      }
    }
    return true;
  });

  const getFileIcon = (type: string | null) => {
    if (type?.startsWith('image')) return <Image className="h-5 w-5" />;
    if (type?.startsWith('video')) return <Video className="h-5 w-5" />;
    return <File className="h-5 w-5" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar mídia..."
            className="pl-9 h-10"
          />
        </div>
        <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? 'Enviando...' : 'Upload'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {/* Tags Filter */}
      {allTags.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {allTags.map(tag => (
            <Badge
              key={tag}
              variant={selectedTags.includes(tag) ? 'default' : 'secondary'}
              className="cursor-pointer"
              onClick={() => {
                setSelectedTags(prev =>
                  prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                );
              }}
            >
              <Tag className="h-3 w-3 mr-1" />
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Media Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filteredMedia.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Nenhuma mídia encontrada</p>
          <Button className="mt-4" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Plus className="h-4 w-4 mr-2" />
            Fazer Upload
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {filteredMedia.map(item => (
            <Card
              key={item.id}
              className={cn(
                'group relative overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-primary',
                mode === 'select' && 'active:scale-95'
              )}
              onClick={() => mode === 'select' && onSelect?.(item.url)}
            >
              <div className="aspect-square relative">
                {item.file_type?.startsWith('image') ? (
                  <img
                    src={item.url}
                    alt={item.filename || ''}
                    className="w-full h-full object-cover"
                  />
                ) : item.file_type?.startsWith('video') ? (
                  <video
                    src={item.url}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    {getFileIcon(item.file_type)}
                  </div>
                )}

                {/* Overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                  <div className="text-white text-xs truncate flex-1">
                    {item.filename}
                    {item.file_size && (
                      <span className="ml-1 opacity-70">{formatFileSize(item.file_size)}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {mode === 'browse' && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingItem(item.id);
                      }}
                    >
                      <Tag className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {/* Select indicator */}
                {mode === 'select' && (
                  <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Check className="h-4 w-4" />
                  </div>
                )}
              </div>

              {/* Tags */}
              {item.tags && item.tags.length > 0 && (
                <div className="p-2 flex gap-1 flex-wrap">
                  {item.tags.slice(0, 3).map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {item.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{item.tags.length - 3}
                    </Badge>
                  )}
                </div>
              )}

              {/* Tag Editor Dialog */}
              <Dialog open={editingItem === item.id} onOpenChange={(open) => !open && setEditingItem(null)}>
                <DialogContent onClick={(e) => e.stopPropagation()}>
                  <DialogHeader>
                    <DialogTitle>Editar Tags</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="Nova tag..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddTag(item.id, newTag);
                          }
                        }}
                      />
                      <Button onClick={() => handleAddTag(item.id, newTag)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {item.tags?.map(tag => (
                        <Badge key={tag} variant="secondary" className="pr-1">
                          {tag}
                          <button
                            className="ml-1 hover:text-destructive"
                            onClick={() => handleRemoveTag(item.id, tag)}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
