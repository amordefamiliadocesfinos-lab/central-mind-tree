import { useState } from 'react';
import { usePosts, Post, AVAILABLE_CHANNELS } from '@/hooks/usePosts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, ArrowLeft, Calendar, Trash2, Image, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

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

  const handleCreatePost = async () => {
    await createPost(newPost);
    setShowCreateDialog(false);
    setNewPost({ title: '', content: '', scheduled_date: '', scheduled_time: '' });
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
        <p className="text-muted-foreground">Carregando conteúdo...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Conteúdo Omnicanal</h1>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Post
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Post</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                  placeholder="Título do post"
                />
              </div>
              <div>
                <Label>Conteúdo Base</Label>
                <Textarea
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                  rows={4}
                  placeholder="Conteúdo principal..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={newPost.scheduled_date}
                    onChange={(e) => setNewPost({ ...newPost, scheduled_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Horário</Label>
                  <Input
                    type="time"
                    value={newPost.scheduled_time}
                    onChange={(e) => setNewPost({ ...newPost, scheduled_time: e.target.value })}
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
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <Label>Mídia</Label>
                <Input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => handleFileUpload(e)}
                />
              </div>

              <Button onClick={handleCreatePost} className="w-full">
                Criar Post
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
        />
      ) : (
        <div className="space-y-3">
          {posts.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Nenhum post criado ainda.</p>
            </Card>
          ) : (
            posts.map((post) => (
              <Card
                key={post.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedPost(post)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{post.title}</h3>
                        <Badge
                          className={cn(
                            'text-white',
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
                    <div className="text-right text-sm text-muted-foreground">
                      {post.scheduled_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {post.scheduled_date}
                        </div>
                      )}
                      {post.scheduled_time && <p>{post.scheduled_time}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
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
}: PostEditorProps) {
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
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Button variant="destructive" size="sm" onClick={() => { onDelete(post.id); onBack(); }}>
          <Trash2 className="h-4 w-4 mr-1" />
          Excluir
        </Button>
      </div>

      <Tabs defaultValue="content">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="content">Conteúdo</TabsTrigger>
          <TabsTrigger value="channels">Canais</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <Label>Título</Label>
                <Input
                  value={post.title}
                  onChange={(e) => onUpdate(post.id, { title: e.target.value })}
                />
              </div>
              <div>
                <Label>Conteúdo Base</Label>
                <Textarea
                  value={post.content || ''}
                  onChange={(e) => onUpdate(post.id, { content: e.target.value })}
                  rows={6}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={post.scheduled_date || ''}
                    onChange={(e) => onUpdate(post.id, { scheduled_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Horário</Label>
                  <Input
                    type="time"
                    value={post.scheduled_time || ''}
                    onChange={(e) => onUpdate(post.id, { scheduled_time: e.target.value })}
                  />
                </div>
              </div>

              {/* Media */}
              <div>
                <Label>Mídia</Label>
                <div className="flex gap-2 flex-wrap mt-2">
                  {post.media_urls?.map((url, i) => (
                    <div key={i} className="relative">
                      <img src={url} alt="" className="h-20 w-20 object-cover rounded" />
                      <button
                        className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5"
                        onClick={() => handleRemoveMedia(url)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <label className="h-20 w-20 border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:bg-muted">
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

        <TabsContent value="channels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Selecione os Canais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(AVAILABLE_CHANNELS).map(([id, channel]) => {
                const isEnabled = post.channels?.includes(id);
                const channelData = post.channel_data?.[id] || {};

                return (
                  <div key={id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
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
                      <div className="space-y-2 mt-3 pl-8">
                        {channel.fields.map((field) => (
                          <div key={field}>
                            <Label className="text-xs capitalize">{field}</Label>
                            <Input
                              value={channelData[field] || ''}
                              onChange={(e) => onUpdateChannelData(post.id, id, field, e.target.value)}
                              placeholder={field}
                              className="h-8 text-sm"
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

        <TabsContent value="checklist">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Checklist de Publicação</CardTitle>
            </CardHeader>
            <CardContent>
              {post.checklist?.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
                  Habilite canais para ver o checklist.
                </p>
              ) : (
                <div className="space-y-2">
                  {post.checklist?.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-muted p-2 rounded"
                      onClick={() => onToggleChecklist(post.id, item.id)}
                    >
                      <Checkbox checked={item.done} />
                      <span className={item.done ? 'line-through text-muted-foreground' : ''}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {post.checklist && post.checklist.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm">
                    <Check className="h-4 w-4 inline mr-1 text-green-500" />
                    {post.checklist.filter(c => c.done).length}/{post.checklist.length} concluídos
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
