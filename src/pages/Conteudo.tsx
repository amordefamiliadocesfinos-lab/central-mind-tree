import { useState } from 'react';
import { usePosts, Post, AVAILABLE_CHANNELS } from '@/hooks/usePosts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, ArrowLeft, Calendar, Trash2, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Conteudo() {
  const {
    posts,
    loading,
    createPost,
    updatePost,
    deletePost,
    toggleChannel,
    updateChannelData,
    toggleChecklistItem,
    addMedia,
    removeMedia,
    postStatus,
  } = usePosts();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    scheduled_date: '',
    scheduled_time: '',
  });
  const [previewMedia, setPreviewMedia] = useState<string[]>([]);
  const isMobile = useIsMobile();

  const handleCreatePost = async () => {
    await createPost(newPost);
    setShowCreateDialog(false);
    setNewPost({ title: '', content: '', scheduled_date: '', scheduled_time: '' });
    setPreviewMedia([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, postId?: string) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const url = URL.createObjectURL(file);
      if (postId) {
        await addMedia(postId, url);
      } else {
        setPreviewMedia(prev => [...prev, url]);
      }
    }
  };

  const handleRemovePreviewMedia = (url: string) => {
    URL.revokeObjectURL(url);
    setPreviewMedia(prev => prev.filter(m => m !== url));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse space-y-4 w-full max-w-sm px-4">
          <div className="h-8 bg-muted rounded w-1/2 mx-auto" />
          <div className="h-24 bg-muted rounded" />
          <div className="h-24 bg-muted rounded" />
          <div className="h-24 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b safe-area-pt">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-lg font-bold truncate">
              {isMobile ? "Conteúdo" : "Conteúdo Omnicanal"}
            </h1>
          </div>
          
          <Button
            onClick={() => setShowCreateDialog(true)}
            size={isMobile ? "icon" : "default"}
            className="h-10 shrink-0"
          >
            <Plus className="h-5 w-5" />
            {!isMobile && <span className="ml-2">Novo Post</span>}
          </Button>
        </div>
      </header>

      <main className="px-4 py-4 pb-8 space-y-3">
        {/* Posts List */}
        {selectedPost ? (
          <PostEditor
            post={selectedPost}
            onBack={() => setSelectedPost(null)}
            onUpdate={updatePost}
            onDelete={deletePost}
            onToggleChannel={toggleChannel}
            onUpdateChannelData={updateChannelData}
            onToggleChecklist={toggleChecklistItem}
            onAddMedia={addMedia}
            onRemoveMedia={removeMedia}
            postStatus={postStatus}
          />
        ) : (
          <>
            {posts.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Nenhum post criado ainda.</p>
                <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Post
                </Button>
              </Card>
            ) : (
              posts.map((post) => (
                <Card
                  key={post.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors touch-manipulation active:scale-[0.99]"
                  onClick={() => setSelectedPost(post)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium truncate">{post.title}</h3>
                          <Badge
                            className={cn(
                              'text-white shrink-0',
                              postStatus[post.status as keyof typeof postStatus]?.color
                            )}
                          >
                            {postStatus[post.status as keyof typeof postStatus]?.label}
                          </Badge>
                        </div>
                        {post.content && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {post.content}
                          </p>
                        )}
                        <div className="flex gap-1 mt-2">
                          {post.channels?.map((ch) => (
                            <span key={ch} className="text-lg" title={AVAILABLE_CHANNELS[ch as keyof typeof AVAILABLE_CHANNELS]?.label}>
                              {AVAILABLE_CHANNELS[ch as keyof typeof AVAILABLE_CHANNELS]?.icon}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right text-sm text-muted-foreground shrink-0">
                        {post.scheduled_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span className="tabular-nums">{post.scheduled_date.slice(5).replace('-', '/')}</span>
                          </div>
                        )}
                        {post.scheduled_time && <p className="tabular-nums">{post.scheduled_time}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}
      </main>

      {/* Create Post Dialog */}
      <ResponsiveDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        title="Novo Post"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={newPost.title}
              onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
              placeholder="Título do post"
              className="h-12"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Conteúdo Base</Label>
            <Textarea
              value={newPost.content}
              onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
              rows={4}
              placeholder="Conteúdo principal..."
              className="min-h-[100px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={newPost.scheduled_date}
                onChange={(e) => setNewPost({ ...newPost, scheduled_date: e.target.value })}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label>Horário</Label>
              <Input
                type="time"
                value={newPost.scheduled_time}
                onChange={(e) => setNewPost({ ...newPost, scheduled_time: e.target.value })}
                className="h-12"
              />
            </div>
          </div>

          {/* Preview media */}
          {previewMedia.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {previewMedia.map((url, i) => (
                <div key={i} className="relative">
                  <img src={url} alt="" className="h-16 w-16 object-cover rounded" />
                  <button
                    className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5"
                    onClick={() => handleRemovePreviewMedia(url)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>Mídia</Label>
            <Input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(e) => handleFileUpload(e)}
              className="h-12"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-12"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreatePost} className="flex-1 h-12">
              Criar Post
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}

interface PostEditorProps {
  post: Post;
  onBack: () => void;
  onUpdate: (id: string, updates: Partial<Post>) => void;
  onDelete: (id: string) => void;
  onToggleChannel: (postId: string, channelId: string) => void;
  onUpdateChannelData: (postId: string, channelId: string, field: string, value: string) => void;
  onToggleChecklist: (postId: string, itemId: string) => void;
  onAddMedia: (postId: string, url: string) => void;
  onRemoveMedia: (postId: string, url: string) => void;
  postStatus: Record<string, { label: string; color: string }>;
}

function PostEditor({
  post,
  onBack,
  onUpdate,
  onDelete,
  onToggleChannel,
  onUpdateChannelData,
  onToggleChecklist,
  onAddMedia,
  onRemoveMedia,
  postStatus,
}: PostEditorProps) {
  const isMobile = useIsMobile();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const url = URL.createObjectURL(file);
      onAddMedia(post.id, url);
    }
  };

  const handleRemoveMedia = (url: string) => {
    URL.revokeObjectURL(url);
    onRemoveMedia(post.id, url);
  };

  return (
    <div className="space-y-4">
      {/* Editor Header */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack} className="h-10">
          <ArrowLeft className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Voltar</span>
        </Button>
        <Badge
          className={cn(
            'text-white',
            postStatus[post.status as keyof typeof postStatus]?.color
          )}
        >
          {postStatus[post.status as keyof typeof postStatus]?.label}
        </Badge>
        <Button 
          variant="destructive" 
          size={isMobile ? "icon" : "sm"}
          className="h-10"
          onClick={() => { onDelete(post.id); onBack(); }}
        >
          <Trash2 className="h-4 w-4" />
          {!isMobile && <span className="ml-1">Excluir</span>}
        </Button>
      </div>

      <Tabs defaultValue="content">
        <TabsList className="grid w-full grid-cols-3 h-12">
          <TabsTrigger value="content" className="h-10">Conteúdo</TabsTrigger>
          <TabsTrigger value="channels" className="h-10">Canais</TabsTrigger>
          <TabsTrigger value="checklist" className="h-10">Checklist</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={post.title}
                  onChange={(e) => onUpdate(post.id, { title: e.target.value })}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label>Conteúdo Base</Label>
                <Textarea
                  value={post.content || ''}
                  onChange={(e) => onUpdate(post.id, { content: e.target.value })}
                  rows={6}
                  className="min-h-[120px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={post.scheduled_date || ''}
                    onChange={(e) => onUpdate(post.id, { scheduled_date: e.target.value })}
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Horário</Label>
                  <Input
                    type="time"
                    value={post.scheduled_time || ''}
                    onChange={(e) => onUpdate(post.id, { scheduled_time: e.target.value })}
                    className="h-12"
                  />
                </div>
              </div>

              {/* Media */}
              <div className="space-y-2">
                <Label>Mídia</Label>
                <div className="flex gap-2 flex-wrap mt-2">
                  {post.media_urls?.map((url, i) => (
                    <div key={i} className="relative">
                      <img src={url} alt="" className="h-20 w-20 object-cover rounded" />
                      <button
                        className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-1"
                        onClick={() => handleRemoveMedia(url)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <label className="h-20 w-20 border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:bg-muted touch-manipulation active:scale-95">
                    <Plus className="h-6 w-6 text-muted-foreground" />
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Selecione os Canais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(AVAILABLE_CHANNELS).map(([id, channel]) => {
                const isEnabled = post.channels?.includes(id);
                const channelData = post.channel_data?.[id] || {};

                return (
                  <div key={id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{channel.icon}</span>
                        <span className="font-medium">{channel.label}</span>
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => onToggleChannel(post.id, id)}
                      />
                    </div>

                    {isEnabled && (
                      <div className="space-y-3 mt-3 pt-3 border-t">
                        {channel.fields.map((field) => (
                          <div key={field} className="space-y-1">
                            <Label className="text-xs capitalize">{field}</Label>
                            <Input
                              value={channelData[field] || ''}
                              onChange={(e) => onUpdateChannelData(post.id, id, field, e.target.value)}
                              placeholder={field}
                              className="h-10"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checklist" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Checklist de Publicação</CardTitle>
            </CardHeader>
            <CardContent>
              {post.checklist?.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6">
                  Habilite canais para ver o checklist.
                </p>
              ) : (
                <div className="space-y-1">
                  {post.checklist?.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 cursor-pointer hover:bg-muted p-3 rounded-lg touch-manipulation active:scale-[0.99]"
                      onClick={() => onToggleChecklist(post.id, item.id)}
                    >
                      <Checkbox checked={item.done} className="h-5 w-5" />
                      <span className={cn(
                        "flex-1",
                        item.done && 'line-through text-muted-foreground'
                      )}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {post.checklist && post.checklist.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>
                      {post.checklist.filter(c => c.done).length}/{post.checklist.length} concluídos
                    </span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
