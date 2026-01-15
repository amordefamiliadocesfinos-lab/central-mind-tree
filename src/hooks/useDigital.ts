import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Status hierarchy matching tasks system
export const DIGITAL_STATUS = {
  estrutural: { label: 'Estrutural', color: 'bg-purple-500', priority: 1 },
  andamento: { label: 'Em Andamento', color: 'bg-red-500', priority: 2 },
  pendente: { label: 'Pendente', color: 'bg-yellow-500', priority: 3 },
  concluido: { label: 'Concluído', color: 'bg-green-500', priority: 4 },
};

interface PlatformConfig {
  label: string;
  icon: string;
  group: string;
  aspectRatio?: string;
  duration?: string;
  fields: string[];
  checklist: { id: string; text: string }[];
}

export const PLATFORMS: Record<string, PlatformConfig> = {
  instagram_feed: {
    label: 'Instagram Feed',
    icon: '📷',
    group: 'instagram',
    aspectRatio: '1:1 / 4:5',
    fields: ['caption', 'hashtags', 'cta', 'cover_url'],
    checklist: [
      { id: 'img-size', text: 'Imagem 1080x1080 ou 1080x1350?' },
      { id: 'caption', text: 'Legenda otimizada?' },
      { id: 'hashtags', text: 'Hashtags relevantes (max 30)?' },
      { id: 'cta', text: 'CTA incluído?' },
    ],
  },
  instagram_reels: {
    label: 'Instagram Reels',
    icon: '🎬',
    group: 'instagram',
    aspectRatio: '9:16',
    duration: '15-90s',
    fields: ['caption', 'hashtags', 'cta', 'cover_url', 'music'],
    checklist: [
      { id: 'vertical', text: 'Vídeo vertical 9:16?' },
      { id: 'duration', text: 'Duração entre 15-90s?' },
      { id: 'cover', text: 'Capa personalizada?' },
      { id: 'music', text: 'Música adicionada?' },
    ],
  },
  instagram_stories: {
    label: 'Instagram Stories',
    icon: '📱',
    group: 'instagram',
    aspectRatio: '9:16',
    duration: '15s',
    fields: ['caption', 'cta', 'link'],
    checklist: [
      { id: 'vertical', text: 'Formato vertical 9:16?' },
      { id: 'cta', text: 'Sticker de CTA?' },
      { id: 'link', text: 'Link adicionado?' },
    ],
  },
  youtube_long: {
    label: 'YouTube Long',
    icon: '📺',
    group: 'youtube',
    aspectRatio: '16:9',
    fields: ['title', 'description', 'tags', 'thumbnail_url', 'cta', 'chapters', 'playlist'],
    checklist: [
      { id: 'thumb', text: 'Thumbnail atrativa (1280x720)?' },
      { id: 'title', text: 'Título otimizado (max 60 chars)?' },
      { id: 'desc', text: 'Descrição com links e capítulos?' },
      { id: 'tags', text: 'Tags relevantes?' },
      { id: 'cta', text: 'CTA no final?' },
      { id: 'end-screen', text: 'End screen configurado?' },
    ],
  },
  youtube_shorts: {
    label: 'YouTube Shorts',
    icon: '⚡',
    group: 'youtube',
    aspectRatio: '9:16',
    duration: '60s max',
    fields: ['title', 'description', 'tags', 'cta'],
    checklist: [
      { id: 'vertical', text: 'Vídeo vertical 9:16?' },
      { id: 'duration', text: 'Máximo 60 segundos?' },
      { id: 'hook', text: 'Hook nos primeiros 3s?' },
      { id: 'title', text: 'Título com #shorts?' },
    ],
  },
  tiktok: {
    label: 'TikTok',
    icon: '🎵',
    group: 'tiktok',
    aspectRatio: '9:16',
    fields: ['caption', 'hashtags', 'music', 'cta', 'cover_url'],
    checklist: [
      { id: 'vertical', text: 'Vídeo vertical 9:16?' },
      { id: 'hook', text: 'Hook nos primeiros 2s?' },
      { id: 'music', text: 'Música viral adicionada?' },
      { id: 'hashtags', text: 'Hashtags virais?' },
      { id: 'cta', text: 'CTA no final?' },
    ],
  },
  facebook_post: {
    label: 'Facebook Post',
    icon: '📘',
    group: 'facebook',
    fields: ['caption', 'link', 'cta'],
    checklist: [
      { id: 'text', text: 'Texto envolvente?' },
      { id: 'link', text: 'Link preview ok?' },
      { id: 'cta', text: 'CTA claro?' },
    ],
  },
  facebook_video: {
    label: 'Facebook Vídeo',
    icon: '🎥',
    group: 'facebook',
    aspectRatio: '16:9 / 9:16',
    fields: ['title', 'description', 'cta'],
    checklist: [
      { id: 'thumb', text: 'Thumbnail atrativa?' },
      { id: 'captions', text: 'Legendas automáticas?' },
      { id: 'cta', text: 'CTA no vídeo?' },
    ],
  },
  facebook_carousel: {
    label: 'Facebook Carrossel',
    icon: '🎠',
    group: 'facebook',
    fields: ['caption', 'link', 'cta'],
    checklist: [
      { id: 'cards', text: 'Mínimo 2 cards?' },
      { id: 'cta', text: 'CTA por card?' },
    ],
  },
};

export interface DigitalIdea {
  id: string;
  title: string;
  objective: string | null;
  target_audience: string | null;
  key_message: string | null;
  kpi: string | null;
  status: keyof typeof DIGITAL_STATUS;
  order_index: number;
  node_id: string | null;
  media_urls: string[];
  created_at: string;
  updated_at: string;
  variations?: DigitalVariation[];
}

export interface DigitalVariation {
  id: string;
  idea_id: string;
  platform: keyof typeof PLATFORMS;
  status: keyof typeof DIGITAL_STATUS;
  title: string | null;
  description: string | null;
  caption: string | null;
  hashtags: string | null;
  cta: string | null;
  cover_url: string | null;
  aspect_ratio: string | null;
  duration_seconds: number | null;
  resolution: string | null;
  tags: string | null;
  music: string | null;
  link: string | null;
  chapters: string | null;
  playlist: string | null;
  thumbnail_url: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  metric_reach: number | null;
  metric_engagement: number | null;
  metric_clicks: number | null;
  metric_retention: number | null;
  metric_ctr: number | null;
  media_urls: string[];
  checklist: { id: string; text: string; done: boolean }[];
  is_template: boolean;
  template_name: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export function useDigital() {
  const [ideas, setIdeas] = useState<DigitalIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');

  const fetchIdeas = useCallback(async () => {
    const { data, error } = await supabase
      .from('digital_ideas')
      .select(`
        *,
        variations:digital_variations(*)
      `)
      .order('status', { ascending: true })
      .order('order_index', { ascending: true });

    if (error) {
      console.error('Error fetching digital ideas:', error);
      setLoading(false);
      return;
    }

    // Sort by status priority
    const sorted = (data || []).sort((a, b) => {
      const priorityA = DIGITAL_STATUS[a.status as keyof typeof DIGITAL_STATUS]?.priority || 99;
      const priorityB = DIGITAL_STATUS[b.status as keyof typeof DIGITAL_STATUS]?.priority || 99;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return a.order_index - b.order_index;
    });

    setIdeas(sorted as DigitalIdea[]);
    setLoading(false);
  }, []);

  const createIdea = useCallback(async (idea: Partial<DigitalIdea>) => {
    const { data, error } = await supabase
      .from('digital_ideas')
      .insert({
        title: idea.title || 'Nova Ideia',
        objective: idea.objective,
        target_audience: idea.target_audience,
        key_message: idea.key_message,
        kpi: idea.kpi,
        status: 'estrutural',
        node_id: idea.node_id,
        media_urls: idea.media_urls || [],
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar ideia');
      return null;
    }

    toast.success('Ideia criada!');
    fetchIdeas();
    return data as DigitalIdea;
  }, [fetchIdeas]);

  const updateIdea = useCallback(async (id: string, updates: Partial<DigitalIdea>) => {
    const { error } = await supabase
      .from('digital_ideas')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar ideia');
      return;
    }

    fetchIdeas();
  }, [fetchIdeas]);

  const deleteIdea = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('digital_ideas')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir ideia');
      return;
    }

    toast.success('Ideia excluída!');
    fetchIdeas();
  }, [fetchIdeas]);

  // Variations
  const createVariation = useCallback(async (ideaId: string, platform: keyof typeof PLATFORMS) => {
    const platformConfig = PLATFORMS[platform];
    const defaultChecklist = platformConfig.checklist.map(item => ({
      ...item,
      done: false,
    }));

    const { data, error } = await supabase
      .from('digital_variations')
      .insert({
        idea_id: ideaId,
        platform,
        status: 'pendente',
        aspect_ratio: platformConfig.aspectRatio || null,
        checklist: defaultChecklist,
        media_urls: [],
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar variação');
      return null;
    }

    toast.success(`Variação ${platformConfig.label} criada!`);
    fetchIdeas();
    return data as DigitalVariation;
  }, [fetchIdeas]);

  const updateVariation = useCallback(async (id: string, updates: Partial<DigitalVariation>) => {
    const { error } = await supabase
      .from('digital_variations')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar variação');
      return;
    }

    fetchIdeas();
  }, [fetchIdeas]);

  const deleteVariation = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('digital_variations')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir variação');
      return;
    }

    toast.success('Variação excluída!');
    fetchIdeas();
  }, [fetchIdeas]);

  const toggleVariationChecklist = useCallback(async (variationId: string, itemId: string) => {
    const idea = ideas.find(i => i.variations?.some(v => v.id === variationId));
    const variation = idea?.variations?.find(v => v.id === variationId);
    if (!variation) return;

    const checklist = [...(variation.checklist || [])];
    const item = checklist.find(c => c.id === itemId);
    if (item) {
      item.done = !item.done;
    }

    await updateVariation(variationId, { checklist });
  }, [ideas, updateVariation]);

  // Filters
  const filteredIdeas = ideas.filter(idea => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesIdea = idea.title.toLowerCase().includes(query) ||
        idea.objective?.toLowerCase().includes(query) ||
        idea.key_message?.toLowerCase().includes(query);
      const matchesVariation = idea.variations?.some(v => 
        v.title?.toLowerCase().includes(query) ||
        v.caption?.toLowerCase().includes(query)
      );
      if (!matchesIdea && !matchesVariation) return false;
    }

    // Status filter
    if (statusFilter !== 'all') {
      const ideaMatches = idea.status === statusFilter;
      const variationMatches = idea.variations?.some(v => v.status === statusFilter);
      if (!ideaMatches && !variationMatches) return false;
    }

    // Platform filter
    if (platformFilter !== 'all') {
      if (!idea.variations?.some(v => v.platform === platformFilter)) return false;
    }

    return true;
  });

  // Stats
  const stats = {
    total: ideas.length,
    byStatus: Object.keys(DIGITAL_STATUS).reduce((acc, status) => {
      acc[status] = ideas.filter(i => i.status === status).length;
      return acc;
    }, {} as Record<string, number>),
    totalVariations: ideas.reduce((acc, i) => acc + (i.variations?.length || 0), 0),
  };

  // Get variations by date for calendar
  const getVariationsByDate = useCallback((date: string) => {
    const variations: (DigitalVariation & { ideaTitle: string })[] = [];
    ideas.forEach(idea => {
      idea.variations?.forEach(v => {
        if (v.scheduled_date === date) {
          variations.push({ ...v, ideaTitle: idea.title });
        }
      });
    });
    return variations;
  }, [ideas]);

  useEffect(() => {
    fetchIdeas();

    const channel = supabase
      .channel('digital-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'digital_ideas',
      }, fetchIdeas)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'digital_variations',
      }, fetchIdeas)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchIdeas]);

  return {
    ideas,
    filteredIdeas,
    loading,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    platformFilter,
    setPlatformFilter,
    stats,
    createIdea,
    updateIdea,
    deleteIdea,
    createVariation,
    updateVariation,
    deleteVariation,
    toggleVariationChecklist,
    getVariationsByDate,
    refetch: fetchIdeas,
    DIGITAL_STATUS,
    PLATFORMS,
  };
}
