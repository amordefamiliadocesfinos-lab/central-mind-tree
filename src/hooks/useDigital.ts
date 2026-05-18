import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePlatforms, Platform } from './usePlatforms';

// Status hierarchy matching tasks system
export const DIGITAL_STATUS = {
  estrutural: { label: 'Estrutural', color: 'bg-purple-500', priority: 1 },
  andamento: { label: 'Em Andamento', color: 'bg-red-500', priority: 2 },
  pendente: { label: 'Pendente', color: 'bg-yellow-500', priority: 3 },
  concluido: { label: 'Concluído', color: 'bg-green-500', priority: 4 },
};

// Legacy PLATFORMS object for backwards compatibility - will be replaced by dynamic platforms
export const PLATFORMS: Record<string, {
  label: string;
  icon: string;
  group: string;
  aspectRatio?: string;
  duration?: string;
  fields: string[];
  checklist: { id: string; text: string }[];
}> = {};

export type IdeaType = 'conteudo' | 'anuncio' | 'cadastro' | 'campanha';

export interface DigitalIdea {
  id: string;
  title: string;
  serial_number: string | null;
  objective: string | null;
  target_audience: string | null;
  key_message: string | null;
  kpi: string | null;
  status: keyof typeof DIGITAL_STATUS;
  idea_type: IdeaType;
  order_index: number;
  node_id: string | null;
  product_id: string | null;
  media_urls: string[];
  custom_fields: import('./usePlatforms').CustomField[];
  custom_field_values: Record<string, string>;
  created_at: string;
  updated_at: string;
  variations?: DigitalVariation[];
}

// Compute next serial number (e.g. "001", "002") based on existing numeric serials.
export function computeNextSerial(ideas: { serial_number?: string | null }[]): string {
  let max = 0;
  for (const i of ideas) {
    const s = (i.serial_number || '').trim();
    const m = s.match(/^\d+$/);
    if (m) {
      const n = parseInt(s, 10);
      if (n > max) max = n;
    }
  }
  const next = max + 1;
  return String(next).padStart(3, '0');
}

export interface MediaTransform {
  preset?: string;
  aspect?: string;
  cover?: string;
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
  // Media inheritance fields
  hidden_inherited_media: string[];
  extra_media_ids: string[];
  media_transforms: Record<string, MediaTransform>;
  media_mode: 'inherit' | 'custom';
  // Dynamic custom field values
  custom_field_values: Record<string, string>;
  // Multi-date posting
  is_posted: boolean;
  additional_dates: { date: string; time: string; posted: boolean }[];
}

export function useDigital() {
  const [ideas, setIdeas] = useState<DigitalIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [variationFilter, setVariationFilter] = useState<string>('all');
  
  // Use dynamic platforms
  const { 
    platforms, 
    activePlatforms, 
    platformsMap, 
    loading: platformsLoading,
    createPlatform,
    updatePlatform: updatePlatformFn,
    deletePlatform,
    toggleActive,
    groupedPlatforms,
    GROUP_LABELS,
    GROUP_ICONS,
  } = usePlatforms();

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

    const parsed = (sorted || []).map(item => ({
      ...item,
      custom_fields: Array.isArray(item.custom_fields) ? item.custom_fields : [],
      custom_field_values: (item.custom_field_values && typeof item.custom_field_values === 'object' && !Array.isArray(item.custom_field_values)) ? item.custom_field_values : {},
    }));

    setIdeas(parsed as unknown as DigitalIdea[]);
    setLoading(false);
  }, []);

  const createIdea = useCallback(async (idea: Partial<DigitalIdea>) => {
    const serial = idea.serial_number ?? computeNextSerial(ideas);
    const { data, error } = await supabase
      .from('digital_ideas')
      .insert({
        title: idea.title || 'Nova Ideia',
        serial_number: serial,
        objective: idea.objective,
        target_audience: idea.target_audience,
        key_message: idea.key_message,
        kpi: idea.kpi,
        status: 'estrutural',
        idea_type: idea.idea_type || 'conteudo',
        node_id: idea.node_id,
        product_id: idea.product_id || null,
        media_urls: idea.media_urls || [],
      } as any)
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar ideia');
      return null;
    }

    toast.success('Ideia criada!');
    fetchIdeas();
    return data as unknown as DigitalIdea;
  }, [fetchIdeas, ideas]);

  const updateIdea = useCallback(async (id: string, updates: Partial<DigitalIdea>) => {
    // Convert complex fields to JSON-compatible format
    const dbUpdates: Record<string, unknown> = { ...updates };
    if (updates.custom_fields) {
      dbUpdates.custom_fields = JSON.parse(JSON.stringify(updates.custom_fields));
    }
    if (updates.custom_field_values) {
      dbUpdates.custom_field_values = JSON.parse(JSON.stringify(updates.custom_field_values));
    }

    const { error } = await supabase
      .from('digital_ideas')
      .update(dbUpdates)
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

  // Variations - now uses dynamic platforms
  const createVariation = useCallback(async (ideaId: string, platformId: string) => {
    // Find platform config from dynamic platforms
    const platform = activePlatforms.find(p => p.id === platformId);
    const defaultChecklist = platform?.checklist_template.map(item => ({
      ...item,
      done: false,
    })) || [];

    const { data, error } = await supabase
      .from('digital_variations')
      .insert({
        idea_id: ideaId,
        platform: platformId,
        status: 'pendente',
        aspect_ratio: platform?.aspect_ratio || null,
        checklist: defaultChecklist,
        media_urls: [],
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar variação');
      return null;
    }

    toast.success(`Variação ${platform?.name || 'Nova'} criada!`);
    fetchIdeas();
    return data as unknown as DigitalVariation;
  }, [fetchIdeas, activePlatforms]);

  const updateVariation = useCallback(async (id: string, updates: Partial<DigitalVariation>) => {
    const { error } = await supabase
      .from('digital_variations')
      .update(updates as any)
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

  // Duplicate an entire idea (with all its variations)
  const duplicateIdea = useCallback(async (ideaId: string) => {
    const original = ideas.find(i => i.id === ideaId);
    if (!original) {
      toast.error('Ideia não encontrada');
      return null;
    }

    const { data: newIdea, error: ideaError } = await supabase
      .from('digital_ideas')
      .insert({
        title: `${original.title} (cópia)`,
        serial_number: computeNextSerial(ideas),
        objective: original.objective,
        target_audience: original.target_audience,
        key_message: original.key_message,
        kpi: original.kpi,
        status: 'estrutural',
        idea_type: original.idea_type,
        node_id: original.node_id,
        product_id: original.product_id,
        media_urls: original.media_urls || [],
        custom_fields: JSON.parse(JSON.stringify(original.custom_fields || [])),
        custom_field_values: JSON.parse(JSON.stringify(original.custom_field_values || {})),
      } as any)
      .select()
      .single();

    if (ideaError || !newIdea) {
      toast.error('Erro ao duplicar ideia');
      return null;
    }

    // Duplicate variations
    const variations = original.variations || [];
    if (variations.length > 0) {
      const variationsToInsert = variations.map(v => ({
        idea_id: newIdea.id,
        platform: v.platform,
        status: 'pendente' as const,
        title: v.title,
        description: v.description,
        caption: v.caption,
        hashtags: v.hashtags,
        cta: v.cta,
        cover_url: v.cover_url,
        aspect_ratio: v.aspect_ratio,
        duration_seconds: v.duration_seconds,
        resolution: v.resolution,
        tags: v.tags,
        music: v.music,
        link: v.link,
        chapters: v.chapters,
        playlist: v.playlist,
        thumbnail_url: v.thumbnail_url,
        media_urls: v.media_urls || [],
        checklist: JSON.parse(JSON.stringify((v.checklist || []).map(c => ({ ...c, done: false })))),
        hidden_inherited_media: v.hidden_inherited_media || [],
        extra_media_ids: v.extra_media_ids || [],
        media_transforms: JSON.parse(JSON.stringify(v.media_transforms || {})),
        media_mode: v.media_mode || 'inherit',
        custom_field_values: JSON.parse(JSON.stringify(v.custom_field_values || {})),
      }));

      const { error: varError } = await supabase
        .from('digital_variations')
        .insert(variationsToInsert as any);

      if (varError) {
        console.error('Error duplicating variations:', varError);
        toast.error('Ideia duplicada, mas erro ao copiar variações');
      }
    }

    toast.success('Ideia duplicada com sucesso!');
    fetchIdeas();
    return newIdea.id as string;
  }, [ideas, fetchIdeas]);

  const duplicateVariation = useCallback(async (variationId: string, targetPlatformId?: string) => {
    const idea = ideas.find(i => i.variations?.some(v => v.id === variationId));
    const variation = idea?.variations?.find(v => v.id === variationId);
    if (!variation) return null;

    const platformId = targetPlatformId || variation.platform;
    const platform = activePlatforms.find(p => p.id === platformId);
    const defaultChecklist = platform?.checklist_template.map(item => ({
      ...item,
      done: false,
    })) || [];

    const { data, error } = await supabase
      .from('digital_variations')
      .insert({
        idea_id: variation.idea_id,
        platform: platformId,
        status: 'pendente',
        title: variation.title,
        description: variation.description,
        caption: variation.caption,
        hashtags: variation.hashtags,
        cta: variation.cta,
        aspect_ratio: platform?.aspect_ratio || variation.aspect_ratio,
        checklist: defaultChecklist,
        media_urls: targetPlatformId ? [] : variation.media_urls,
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao duplicar variação');
      return null;
    }

    toast.success(`Variação duplicada para ${platform?.name || 'Nova'}!`);
    fetchIdeas();
    return data as unknown as DigitalVariation;
  }, [fetchIdeas, ideas, activePlatforms]);

  // Batch create variations - now uses dynamic platforms
  const batchCreateVariations = useCallback(async (ideaId: string, platformIds: string[]) => {
    const results = await Promise.all(
      platformIds.map(platformId => createVariation(ideaId, platformId))
    );
    return results.filter(Boolean);
  }, [createVariation]);

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
      // Normalize query for serial number matching (strip # and leading zeros)
      const serialQuery = query.replace(/^#/, '').replace(/^0+/, '');
      const ideaSerial = (idea.serial_number || '').toLowerCase();
      const ideaSerialNormalized = ideaSerial.replace(/^0+/, '');
      const matchesSerial = ideaSerial.includes(query.replace(/^#/, '')) ||
        (serialQuery.length > 0 && ideaSerialNormalized === serialQuery);
      const matchesIdea = idea.title.toLowerCase().includes(query) ||
        idea.objective?.toLowerCase().includes(query) ||
        idea.key_message?.toLowerCase().includes(query);
      const matchesVariation = idea.variations?.some(v => 
        v.title?.toLowerCase().includes(query) ||
        v.caption?.toLowerCase().includes(query) ||
        Object.values(v.custom_field_values || {}).some(val =>
          typeof val === 'string' && val.toLowerCase().includes(query)
        )
      );
      if (!matchesIdea && !matchesVariation && !matchesSerial) return false;
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

    // Variation filter (by variation ID or title match)
    if (variationFilter !== 'all') {
      const hasMatchingVariation = idea.variations?.some(
        v => v.id === variationFilter || v.title === variationFilter
      );
      if (!hasMatchingVariation) return false;
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
        // Also check additional_dates
        (v.additional_dates || []).forEach(ad => {
          if (ad.date === date) {
            variations.push({ ...v, ideaTitle: idea.title });
          }
        });
      });
    });
    // Deduplicate by id
    const seen = new Set<string>();
    return variations.filter(v => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });
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

  // Get all variations with idea title for charts
  const allVariationsWithTitle = useMemo(() => {
    return ideas.flatMap(idea => 
      (idea.variations || []).map(v => ({ ...v, ideaTitle: idea.title }))
    );
  }, [ideas]);

  // Get effective media for a variation (with inheritance logic)
  const getVariationMedia = useCallback((idea: DigitalIdea, variation: DigitalVariation): string[] => {
    // If mode is custom, only use extra_media_ids
    if (variation.media_mode === 'custom') {
      return variation.extra_media_ids || [];
    }
    
    // Inherit from idea: (idea.media_urls - hidden_inherited_media) + extra_media_ids
    const ideaMedia = idea.media_urls || [];
    const hiddenMedia = variation.hidden_inherited_media || [];
    const extraMedia = variation.extra_media_ids || [];
    
    const inheritedMedia = ideaMedia.filter(url => !hiddenMedia.includes(url));
    
    // Combine inherited + extra (unique)
    const combined = [...new Set([...inheritedMedia, ...extraMedia])];
    return combined;
  }, []);

  // Update variation inherited media visibility
  const toggleInheritedMedia = useCallback(async (variationId: string, mediaUrl: string, hide: boolean) => {
    const idea = ideas.find(i => i.variations?.some(v => v.id === variationId));
    const variation = idea?.variations?.find(v => v.id === variationId);
    if (!variation) return;

    const hiddenMedia = [...(variation.hidden_inherited_media || [])];
    
    if (hide) {
      if (!hiddenMedia.includes(mediaUrl)) {
        hiddenMedia.push(mediaUrl);
      }
    } else {
      const index = hiddenMedia.indexOf(mediaUrl);
      if (index > -1) {
        hiddenMedia.splice(index, 1);
      }
    }

    await updateVariation(variationId, { hidden_inherited_media: hiddenMedia });
  }, [ideas, updateVariation]);

  // Add extra media to variation
  const addExtraMedia = useCallback(async (variationId: string, mediaUrl: string) => {
    const idea = ideas.find(i => i.variations?.some(v => v.id === variationId));
    const variation = idea?.variations?.find(v => v.id === variationId);
    if (!variation) return;

    const extraMedia = [...(variation.extra_media_ids || [])];
    if (!extraMedia.includes(mediaUrl)) {
      extraMedia.push(mediaUrl);
      await updateVariation(variationId, { extra_media_ids: extraMedia });
    }
  }, [ideas, updateVariation]);

  // Remove extra media from variation
  const removeExtraMedia = useCallback(async (variationId: string, mediaUrl: string) => {
    const idea = ideas.find(i => i.variations?.some(v => v.id === variationId));
    const variation = idea?.variations?.find(v => v.id === variationId);
    if (!variation) return;

    const extraMedia = (variation.extra_media_ids || []).filter(url => url !== mediaUrl);
    await updateVariation(variationId, { extra_media_ids: extraMedia });
  }, [ideas, updateVariation]);

  // Toggle variation media mode
  const toggleVariationMediaMode = useCallback(async (variationId: string, mode: 'inherit' | 'custom') => {
    await updateVariation(variationId, { media_mode: mode });
  }, [updateVariation]);

  // Update media transform for a specific media in a variation
  const updateMediaTransform = useCallback(async (
    variationId: string, 
    mediaUrl: string, 
    transform: MediaTransform
  ) => {
    const idea = ideas.find(i => i.variations?.some(v => v.id === variationId));
    const variation = idea?.variations?.find(v => v.id === variationId);
    if (!variation) return;

    const transforms = { ...(variation.media_transforms || {}) };
    transforms[mediaUrl] = { ...transforms[mediaUrl], ...transform };
    await updateVariation(variationId, { media_transforms: transforms });
  }, [ideas, updateVariation]);

  return {
    ideas,
    filteredIdeas,
    loading: loading || platformsLoading,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    platformFilter,
    setPlatformFilter,
    variationFilter,
    setVariationFilter,
    stats,
    createIdea,
    updateIdea,
    deleteIdea,
    duplicateIdea,
    createVariation,
    updateVariation,
    deleteVariation,
    duplicateVariation,
    batchCreateVariations,
    toggleVariationChecklist,
    getVariationsByDate,
    allVariationsWithTitle,
    refetch: fetchIdeas,
    DIGITAL_STATUS,
    PLATFORMS,
    // Dynamic platforms
    platforms,
    activePlatforms,
    platformsMap,
    groupedPlatforms,
    createPlatform,
    updatePlatform: updatePlatformFn,
    deletePlatform,
    togglePlatformActive: toggleActive,
    GROUP_LABELS,
    GROUP_ICONS,
    // Media inheritance functions
    getVariationMedia,
    toggleInheritedMedia,
    addExtraMedia,
    removeExtraMedia,
    toggleVariationMediaMode,
    updateMediaTransform,
  };
}
