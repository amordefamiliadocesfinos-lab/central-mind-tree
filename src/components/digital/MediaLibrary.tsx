import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Upload, Image, Video, File, Trash2, Plus, Search, Tag, X, Check, MoreVertical, FolderInput, Folder, Wand2, Download, Sparkles, CheckCircle, AlertCircle, XCircle, Clock } from 'lucide-react';
import { useMediaFolders, MediaFolder } from '@/hooks/useMediaFolders';
import { MediaFolderSidebar } from './MediaFolderSidebar';
import { MediaEditor } from './MediaEditor';

interface MediaItem {
  id: string;
  url: string;
  filename: string | null;
  file_type: string | null;
  file_size: number | null;
  tags: string[];
  idea_id: string | null;
  variation_id: string | null;
  product_id: string | null;
  is_product_cover?: boolean;
  folder_id: string | null;
  created_at: string;
  quality_status?: string;
  version?: number;
  ai_enhanced?: boolean;
  parent_media_id?: string | null;
}

interface MediaLibraryProps {
  ideaId?: string;
  variationId?: string;
  onSelect?: (url: string) => void;
  onSelectMultiple?: (urls: string[]) => void;
  mode?: 'browse' | 'select';
}

export function MediaLibrary({ ideaId, variationId, onSelect, onSelectMultiple, mode = 'browse' }: MediaLibraryProps) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [qualityFilter, setQualityFilter] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [sourceFilter, setSourceFilter] = useState<'all' | 'product' | 'idea'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    folders,
    loading: foldersLoading,
    createFolder,
    updateFolder,
    deleteFolder,
    moveMediaToFolder,
    refetch: refetchFolders
  } = useMediaFolders();

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
      
      // Calculate folder counts
      const counts: Record<string, number> = { '_uncategorized': 0 };
      data.forEach((item: MediaItem) => {
        if (item.folder_id) {
          counts[item.folder_id] = (counts[item.folder_id] || 0) + 1;
        } else {
          counts['_uncategorized']++;
        }
      });
      setFolderCounts(counts);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMedia();
  }, [ideaId, variationId]);

  // Handle Enter key to confirm multi-select
  useEffect(() => {
    if (mode !== 'select' || !onSelectMultiple) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && selectedItems.size > 0) {
        e.preventDefault();
        onSelectMultiple(Array.from(selectedItems));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, onSelectMultiple, selectedItems]);

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
        folder_id: selectedFolderId,
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

  const handleMoveToFolder = async (itemId: string, folderId: string | null) => {
    const success = await moveMediaToFolder(itemId, folderId);
    if (success) {
      fetchMedia();
      toast.success('Mídia movida!');
    }
  };

  const allTags = Array.from(new Set(media.flatMap(m => m.tags || [])));

  const filteredMedia = media.filter(item => {
    // Filter by folder
    if (selectedFolderId !== null) {
      if (item.folder_id !== selectedFolderId) return false;
    }

    // Filter by source (product vs idea)
    if (sourceFilter === 'product' && !item.product_id) return false;
    if (sourceFilter === 'idea' && (!item.idea_id && !item.variation_id)) return false;

    // Filter by quality status
    if (qualityFilter) {
      if (item.quality_status !== qualityFilter) return false;
    }
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!item.filename?.toLowerCase().includes(query) && 
          !item.tags?.some(t => t.toLowerCase().includes(query))) {
        return false;
      }
    }
    
    // Filter by tags
    if (selectedTags.length > 0) {
      if (!selectedTags.some(t => item.tags?.includes(t))) {
        return false;
      }
    }
    
    return true;
  });

  const getQualityBadge = (status: string | undefined) => {
    switch (status) {
      case 'approved':
        return { icon: <CheckCircle className="h-3 w-3" />, color: 'bg-green-500', label: 'Aprovada' };
      case 'review':
        return { icon: <AlertCircle className="h-3 w-3" />, color: 'bg-yellow-500', label: 'Revisar' };
      case 'low':
        return { icon: <XCircle className="h-3 w-3" />, color: 'bg-red-500', label: 'Baixa' };
      default:
        return { icon: <Clock className="h-3 w-3" />, color: 'bg-gray-400', label: 'Pendente' };
    }
  };

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
    <div className="flex h-[calc(100vh-200px)] min-h-[400px]">
      {/* Folder Sidebar */}
      <MediaFolderSidebar
        folders={folders}
        selectedFolderId={selectedFolderId}
        onSelectFolder={setSelectedFolderId}
        onCreateFolder={createFolder}
        onUpdateFolder={updateFolder}
        onDeleteFolder={deleteFolder}
        folderCounts={folderCounts}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex items-center gap-3">
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

        {/* Quality Filter */}
        <div className="px-4 py-2 border-b flex gap-2 flex-wrap items-center">
          <span className="text-xs text-muted-foreground mr-2">Qualidade:</span>
          <Badge
            variant={qualityFilter === null ? 'default' : 'secondary'}
            className="cursor-pointer"
            onClick={() => setQualityFilter(null)}
          >
            Todas
          </Badge>
          <Badge
            variant={qualityFilter === 'approved' ? 'default' : 'outline'}
            className="cursor-pointer gap-1"
            onClick={() => setQualityFilter(qualityFilter === 'approved' ? null : 'approved')}
          >
            <div className="h-2 w-2 rounded-full bg-green-500" />
            Aprovadas
          </Badge>
          <Badge
            variant={qualityFilter === 'review' ? 'default' : 'outline'}
            className="cursor-pointer gap-1"
            onClick={() => setQualityFilter(qualityFilter === 'review' ? null : 'review')}
          >
            <div className="h-2 w-2 rounded-full bg-yellow-500" />
            Revisar
          </Badge>
          <Badge
            variant={qualityFilter === 'low' ? 'default' : 'outline'}
            className="cursor-pointer gap-1"
            onClick={() => setQualityFilter(qualityFilter === 'low' ? null : 'low')}
          >
            <div className="h-2 w-2 rounded-full bg-red-500" />
            Baixa
          </Badge>
          <Badge
            variant={qualityFilter === 'pending' ? 'default' : 'outline'}
            className="cursor-pointer gap-1"
            onClick={() => setQualityFilter(qualityFilter === 'pending' ? null : 'pending')}
          >
            <div className="h-2 w-2 rounded-full bg-gray-400" />
            Pendentes
          </Badge>
        </div>

        {/* Tags Filter */}
        {allTags.length > 0 && (
          <div className="px-4 py-2 border-b flex gap-2 flex-wrap">
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
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredMedia.length === 0 ? (
            <Card className="p-8 text-center">
              <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {selectedFolderId 
                  ? 'Nenhuma mídia nesta pasta' 
                  : 'Nenhuma mídia encontrada'}
              </p>
              <Button className="mt-4" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Plus className="h-4 w-4 mr-2" />
                Fazer Upload
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {filteredMedia.map(item => {
                const isSelected = selectedItems.has(item.url);
                return (
                <Card
                  key={item.id}
                  className={cn(
                    'group relative overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-primary',
                    mode === 'select' && 'active:scale-95',
                    mode === 'select' && isSelected && 'ring-2 ring-primary bg-primary/10'
                  )}
                  onClick={() => {
                    if (mode === 'select') {
                      if (onSelectMultiple) {
                        // Multi-select mode
                        setSelectedItems(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(item.url)) {
                            newSet.delete(item.url);
                          } else {
                            newSet.add(item.url);
                          }
                          return newSet;
                        });
                      } else if (onSelect) {
                        // Single select mode (legacy)
                        onSelect(item.url);
                      }
                    }
                  }}
                >
                  {/* Selection checkbox indicator */}
                  {mode === 'select' && onSelectMultiple && isSelected && (
                    <div className="absolute top-2 right-2 z-10">
                      <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                        <Check className="h-4 w-4" />
                      </div>
                    </div>
                  )}
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

                    {/* Quality Badge */}
                    {item.quality_status && (
                      <div className="absolute top-2 left-2">
                        <div className={cn(
                          "h-5 w-5 rounded-full flex items-center justify-center text-white",
                          getQualityBadge(item.quality_status).color
                        )}>
                          {getQualityBadge(item.quality_status).icon}
                        </div>
                      </div>
                    )}

                    {/* AI Enhanced Badge */}
                    {item.ai_enhanced && (
                      <Badge className="absolute top-2 left-8 h-5 px-1 text-[10px] bg-purple-500">
                        <Sparkles className="h-2.5 w-2.5" />
                      </Badge>
                    )}

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                      <div className="text-white text-xs truncate flex-1">
                        {item.filename}
                        {item.file_size && (
                          <span className="ml-1 opacity-70">{formatFileSize(item.file_size)}</span>
                        )}
                        {item.version && item.version > 1 && (
                          <span className="ml-1 opacity-70">v{item.version}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {mode === 'browse' && (
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-7 w-7"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="z-50 bg-popover">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              setEditingItem(item.id);
                            }}>
                              <Tag className="h-4 w-4 mr-2" />
                              Editar Tags
                            </DropdownMenuItem>
                            
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <FolderInput className="h-4 w-4 mr-2" />
                                Mover para
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="z-50 bg-popover">
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveToFolder(item.id, null);
                                  }}
                                >
                                  <Folder className="h-4 w-4 mr-2" />
                                  Sem pasta
                                </DropdownMenuItem>
                                {folders.map(folder => (
                                  <DropdownMenuItem 
                                    key={folder.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMoveToFolder(item.id, folder.id);
                                    }}
                                  >
                                    <Folder 
                                      className="h-4 w-4 mr-2" 
                                      style={{ color: folder.color || undefined }}
                                    />
                                    {folder.name}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>

                            <DropdownMenuSeparator />

                            {/* Edit with AI */}
                            {item.file_type?.startsWith('image') && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setEditingMedia(item);
                              }}>
                                <Wand2 className="h-4 w-4 mr-2 text-purple-500" />
                                Editar com IA
                              </DropdownMenuItem>
                            )}

                            {/* Download */}
                            <DropdownMenuItem onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const response = await fetch(item.url);
                                const blob = await response.blob();
                                const blobUrl = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = blobUrl;
                                a.download = item.filename || 'download';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(blobUrl);
                                toast.success('Download iniciado!');
                              } catch (error) {
                                toast.error('Erro ao baixar arquivo');
                              }
                            }}>
                              <Download className="h-4 w-4 mr-2" />
                              Baixar
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(item);
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
                );
              })}
            </div>
          )}
        </div>

        {/* Multi-select confirmation bar */}
        {mode === 'select' && onSelectMultiple && selectedItems.size > 0 && (
          <div className="sticky bottom-0 p-3 border-t bg-background flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {selectedItems.size} mídia(s) selecionada(s)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedItems(new Set())}
              >
                Limpar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onSelectMultiple(Array.from(selectedItems));
                }}
              >
                <Check className="h-4 w-4 mr-2" />
                Confirmar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Media Editor Dialog */}
      {editingMedia && (
        <MediaEditor
          open={!!editingMedia}
          onOpenChange={(open) => !open && setEditingMedia(null)}
          media={editingMedia}
          onUpdate={() => {
            fetchMedia();
            setEditingMedia(null);
          }}
        />
      )}
    </div>
  );
}
