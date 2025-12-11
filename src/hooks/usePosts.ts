import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PostChannel {
  id: string;
  enabled: boolean;
  data: Record<string, string>;
  checklist: { id: string; text: string; done: boolean }[];
}

export interface Post {
  id: string;
  title: string;
  content: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: string;
  node_id: string | null;
  channels: string[];
  channel_data: Record<string, Record<string, string>>;
  checklist: { id: string; text: string; done: boolean }[];
  media_urls: string[];
  created_at: string;
  updated_at: string;
}

export const AVAILABLE_CHANNELS = {
  youtube: {
    label: 'YouTube',
    icon: '📺',
    fields: ['title', 'description', 'tags'],
    checklist: ['Thumbnail criada?', 'Tags otimizadas?', 'Descrição com links?'],
  },
  instagram: {
    label: 'Instagram',
    icon: '📷',
    fields: ['caption', 'hashtags', 'location'],
    checklist: ['Imagem 1080x1080?', 'Hashtags relevantes?', 'Marcações feitas?'],
  },
  tiktok: {
    label: 'TikTok',
    icon: '🎵',
    fields: ['caption', 'hashtags', 'sounds'],
    checklist: ['Vídeo vertical?', 'Som adicionado?', 'Hashtags virais?'],
  },
  shopee: {
    label: 'Shopee',
    icon: '🛒',
    fields: ['title', 'shortDescription', 'keywords'],
    checklist: ['Fotos do produto?', 'Preço definido?', 'Descrição completa?'],
  },
  twitter: {
    label: 'Twitter/X',
    icon: '🐦',
    fields: ['text', 'hashtags'],
    checklist: ['Texto até 280 chars?', 'Imagem anexada?'],
  },
  facebook: {
    label: 'Facebook',
    icon: '📘',
    fields: ['text', 'link'],
    checklist: ['Preview do link ok?', 'Público definido?'],
  },
  linkedin: {
    label: 'LinkedIn',
    icon: '💼',
    fields: ['text', 'hashtags'],
    checklist: ['Conteúdo profissional?', 'CTA incluído?'],
  },
};

const POST_STATUS = {
  rascunho: { label: 'Rascunho', color: 'bg-gray-500' },
  agendado: { label: 'Agendado', color: 'bg-yellow-500' },
  publicado: { label: 'Publicado', color: 'bg-green-500' },
};

export function usePosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('scheduled_date', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('Error fetching posts:', error);
      setLoading(false);
      return;
    }

    setPosts((data as unknown as Post[]) || []);
    setLoading(false);
  }, []);

  const createPost = useCallback(async (post: Partial<Post>) => {
    const { data, error } = await supabase
      .from('posts')
      .insert({
        title: post.title || 'Novo Post',
        content: post.content,
        scheduled_date: post.scheduled_date,
        scheduled_time: post.scheduled_time,
        status: post.status || 'rascunho',
        node_id: post.node_id,
        channels: post.channels || [],
        channel_data: post.channel_data || {},
        checklist: post.checklist || [],
        media_urls: post.media_urls || [],
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar post');
      return null;
    }

    toast.success('Post criado!');
    fetchPosts();
    return data as unknown as Post;
  }, [fetchPosts]);

  const updatePost = useCallback(async (id: string, updates: Partial<Post>) => {
    const { error } = await supabase
      .from('posts')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar post');
      return;
    }

    toast.success('Post atualizado!');
    fetchPosts();
  }, [fetchPosts]);

  const deletePost = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir post');
      return;
    }

    toast.success('Post excluído!');
    fetchPosts();
  }, [fetchPosts]);

  const toggleChannel = useCallback(async (postId: string, channelId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const channels = [...(post.channels || [])];
    const channelData = { ...(post.channel_data || {}) };
    const checklist = [...(post.checklist || [])];

    const idx = channels.indexOf(channelId);
    if (idx >= 0) {
      channels.splice(idx, 1);
      delete channelData[channelId];
      // Remove channel-specific checklist items
    } else {
      channels.push(channelId);
      // Initialize channel data with empty fields
      const channelConfig = AVAILABLE_CHANNELS[channelId as keyof typeof AVAILABLE_CHANNELS];
      if (channelConfig) {
        channelData[channelId] = {};
        channelConfig.fields.forEach(f => {
          channelData[channelId][f] = '';
        });
        // Add channel-specific checklist items
        channelConfig.checklist.forEach((text, i) => {
          checklist.push({
            id: `${channelId}-${i}`,
            text: `[${channelConfig.label}] ${text}`,
            done: false,
          });
        });
      }
    }

    await updatePost(postId, { channels, channel_data: channelData, checklist });
  }, [posts, updatePost]);

  const updateChannelData = useCallback(async (
    postId: string, 
    channelId: string, 
    field: string, 
    value: string
  ) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const channelData = { ...(post.channel_data || {}) };
    if (!channelData[channelId]) channelData[channelId] = {};
    channelData[channelId][field] = value;

    await updatePost(postId, { channel_data: channelData });
  }, [posts, updatePost]);

  const toggleChecklistItem = useCallback(async (postId: string, itemId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const checklist = [...(post.checklist || [])];
    const item = checklist.find(c => c.id === itemId);
    if (item) {
      item.done = !item.done;
    }

    await updatePost(postId, { checklist });
  }, [posts, updatePost]);

  const addMedia = useCallback(async (postId: string, url: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const media_urls = [...(post.media_urls || []), url];
    await updatePost(postId, { media_urls });
  }, [posts, updatePost]);

  const removeMedia = useCallback(async (postId: string, url: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const media_urls = (post.media_urls || []).filter(m => m !== url);
    await updatePost(postId, { media_urls });
  }, [posts, updatePost]);

  // Get posts for calendar
  const getPostsByDate = useCallback((date: string) => {
    return posts.filter(p => p.scheduled_date === date);
  }, [posts]);

  useEffect(() => {
    fetchPosts();

    const channel = supabase
      .channel('posts-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'posts',
      }, fetchPosts)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPosts]);

  return {
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
    getPostsByDate,
    availableChannels: AVAILABLE_CHANNELS,
    postStatus: POST_STATUS,
    refetch: fetchPosts,
  };
}
