import { useEffect, useState } from 'react';
import { DigitalVariation, DigitalIdea, DIGITAL_STATUS } from '@/hooks/useDigital';
import { CustomField, Platform, PlatformReplica, ReplicaField, ReplicaSection } from '@/hooks/usePlatforms';
import { PlatformIcon } from './PlatformsManager';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { MediaLibrary } from './MediaLibrary';
import { PlatformReplicaRenderer } from './PlatformReplicaRenderer';
import { HierarchicalPlatformSelector } from './HierarchicalPlatformSelector';
import { MediaGallery } from './MediaThumbnail';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { ArrowLeft, Trash2, Calendar, CheckSquare, X, Plus, Copy, ImagePlus, CalendarIcon, Clock, Eye, EyeOff, Link2, Sparkles, Loader2, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type AIFieldType = 'title' | 'description' | 'caption' | 'cta' | 'hashtags' | 'custom_field';

interface VariationEditorProps {
  variation: DigitalVariation;
  idea: DigitalIdea; // Full idea data for context display
  ideaMediaUrls?: string[];
  onBack: () => void;
  onUpdate: (id: string, updates: Partial<DigitalVariation>) => void;
  onUpdateIdea?: (id: string, updates: Partial<DigitalIdea>) => void;
  onDelete: (id: string) => void;
  onToggleChecklist: (variationId: string, itemId: string) => void;
  platforms?: Platform[];
}

const REPLICA_SECTION_CONFIG: Array<{
  id: string;
  title: string;
  icon: string;
  matcher: (field: ReplicaField) => boolean;
}> = [
  {
    id: 'midia',
    title: 'Mídia do Produto',
    icon: '🖼️',
    matcher: (field) => field.type === 'media' || /imagem|foto|vídeo|video|capa|thumbnail/i.test(field.label),
  },
  {
    id: 'informacoes_basicas',
    title: 'Informações Básicas',
    icon: '📝',
    matcher: (field) => /nome|t[ií]tulo|descri|categoria|marca|condiç|condicao/i.test(field.label),
  },
  {
    id: 'atributos',
    title: 'Especificações',
    icon: '🏷️',
    matcher: (field) => /atributo|sabor|origem|pacote|unidade|tamanho|abr[oó]gano|alimento/i.test(field.label),
  },
  {
    id: 'vendas',
    title: 'Vendas e Estoque',
    icon: '💰',
    matcher: (field) => /preço|preco|valor|estoque|sku|gtin|variaç|variacao|opç|opcao/i.test(field.label),
  },
  {
    id: 'fiscal',
    title: 'Dados Fiscais',
    icon: '🧾',
    matcher: (field) => /ncm|cfop|csosn|pis|cofins|cest|fiscal|tipi|fci|recopi|tribut/i.test(field.label),
  },
  {
    id: 'logistica',
    title: 'Envio e Logística',
    icon: '📦',
    matcher: (field) => /peso|largura|altura|comprimento|frete|retirada|xpress|pacote/i.test(field.label),
  },
  {
    id: 'publicacao',
    title: 'Publicação',
    icon: '📅',
    matcher: (field) => /agenda|publica/i.test(field.label),
  },
];

function sanitizeReplicaFieldId(value: string, fallback: string) {
  const normalized = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  return normalized || fallback;
}

function normalizeReplicaField(rawField: Partial<ReplicaField & CustomField>, index: number): ReplicaField {
  const rawLabel = String(rawField.label || 'Campo').trim();
  const label = rawLabel.replace(/^\*\s*/, '').trim() || 'Campo';
  const baseType = rawField.type || 'input';

  let type: ReplicaField['type'] = ['input', 'textarea', 'number', 'select', 'media', 'switch', 'price', 'tags', 'date'].includes(baseType)
    ? (baseType as ReplicaField['type'])
    : 'input';

  let prefix = rawField.prefix;
  let suffix = rawField.suffix;

  if (type === 'input' && /preço|preco|valor/i.test(label)) {
    type = 'price';
    prefix ||= 'R$';
  }

  if (type === 'input' && /data/i.test(label)) {
    type = 'date';
  }

  if ((type === 'number' || type === 'input') && !suffix) {
    if (/peso/i.test(label)) suffix = 'kg';
    else if (/largura|altura|comprimento|dimens/i.test(label)) suffix = 'cm';
    else if (/percentual|tribut|^%/i.test(label)) suffix = '%';
  }

  return {
    id: sanitizeReplicaFieldId(String(rawField.id || label), `campo_${index + 1}`),
    label,
    type,
    placeholder: rawField.placeholder,
    hint: rawField.hint,
    required: Boolean(rawField.required ?? rawLabel.startsWith('*')),
    options: rawField.options || rawField.select_options,
    prefix,
    suffix,
    max_length: rawField.max_length,
  };
}

function buildSectionsFromFields(fields: Array<Partial<ReplicaField & CustomField>>): ReplicaSection[] {
  const buckets = new Map<string, ReplicaSection>();

  for (const config of REPLICA_SECTION_CONFIG) {
    buckets.set(config.id, { id: config.id, title: config.title, icon: config.icon, fields: [] });
  }
  buckets.set('outros', { id: 'outros', title: 'Outros Campos', icon: '⚙️', fields: [] });

  fields.forEach((rawField, index) => {
    const field = normalizeReplicaField(rawField, index);
    const matched = REPLICA_SECTION_CONFIG.find((config) => config.matcher(field));
    (buckets.get(matched?.id || 'outros')?.fields || []).push(field);
  });

  return Array.from(buckets.values()).filter((section) => section.fields.length > 0);
}

function buildReplicaFromResponse(data: any, platformConfig: Platform): PlatformReplica {
  const sectionsFromAi = Array.isArray(data?.sections)
    ? data.sections.map((section: any, index: number) => ({
        id: sanitizeReplicaFieldId(section?.id || section?.title || `secao_${index + 1}`, `secao_${index + 1}`),
        title: section?.title || `Seção ${index + 1}`,
        icon: section?.icon,
        fields: Array.isArray(section?.fields)
          ? section.fields.map((field: any, fieldIndex: number) => normalizeReplicaField(field, fieldIndex))
          : [],
      })).filter((section: ReplicaSection) => section.fields.length > 0)
    : [];

  const fallbackFields = Array.isArray(data?.custom_fields) && data.custom_fields.length > 0
    ? data.custom_fields
    : platformConfig.custom_fields || [];

  return {
    brand_color: data?.brand_color,
    brand_name: data?.brand_name || platformConfig.name,
    sections: sectionsFromAi.length > 0 ? sectionsFromAi : buildSectionsFromFields(fallbackFields),
  };
}

export function VariationEditor({
  variation,
  idea,
  ideaMediaUrls = [],
  onBack,
  onUpdate,
  onUpdateIdea,
  onDelete,
  onToggleChecklist,
  platforms = [],
}: VariationEditorProps) {
  const isMobile = useIsMobile();
  const platformConfig = platforms.find(p => p.id === variation.platform);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [showIdea, setShowIdea] = useState(true);
  const [showChecklist, setShowChecklist] = useState(true);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showRealStructure, setShowRealStructure] = useState(true);
  const [generatingReplica, setGeneratingReplica] = useState(false);
  const [liveReplica, setLiveReplica] = useState<PlatformReplica | null>(
    (platformConfig?.platform_replica?.sections?.length ?? 0) > 0 ? platformConfig!.platform_replica : null
  );

  useEffect(() => {
    setLiveReplica((platformConfig?.platform_replica?.sections?.length ?? 0) > 0 ? platformConfig!.platform_replica : null);
  }, [platformConfig?.id, platformConfig?.updated_at]);

  const effectiveReplica = liveReplica || platformConfig?.platform_replica || { sections: [] };

  const handleGenerateReplica = async (useFreeModel = false) => {
    if (!platformConfig) return;
    const urls = platformConfig.structure_media_urls || [];
    if (urls.length === 0) {
      toast.error('Adicione prints da plataforma primeiro (editar plataforma).');
      return;
    }
    setGeneratingReplica(true);
    try {
      const { data, error } = await supabase.functions.invoke('digital-content-ai', {
        body: {
          title: platformConfig.name,
          field: 'platform_structure_from_media',
          mediaUrls: urls,
          model: useFreeModel ? 'google/gemini-2.5-flash' : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      console.log('[Réplica IA] resposta:', data);

      const replica = buildReplicaFromResponse(data, platformConfig);

      if ((replica.sections?.length ?? 0) === 0) {
        toast.error('Não foi possível extrair estrutura. Adicione mais prints nítidos da tela de cadastro.');
        return;
      }

      setLiveReplica(replica);
      setShowRealStructure(true);

      if ((data?.sections?.length ?? 0) === 0) {
        toast.message('Estrutura montada a partir dos campos reconhecidos nos prints.');
      }

      const { error: updErr } = await supabase
        .from('digital_platforms')
        .update({ platform_replica: replica as any })
        .eq('id', platformConfig.id);
      if (updErr) {
        console.error(updErr);
        toast.success(`Réplica gerada localmente: ${replica.sections.length} seções`);
        return;
      }
      toast.success(`Réplica gerada: ${replica.sections.length} seções`);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar réplica visual');
    } finally {
      setGeneratingReplica(false);
    }
  };
  const statusConfig = DIGITAL_STATUS[variation.status];

  const checklistProgress = variation.checklist?.length
    ? (variation.checklist.filter(c => c.done).length / variation.checklist.length) * 100
    : 0;

  const handleCopyCaption = () => {
    const parts: string[] = [];
    if (variation.caption) parts.push(variation.caption);
    if (variation.hashtags) parts.push('\n\n' + variation.hashtags);
    
    if (parts.length === 0) {
      toast.error('Nenhum conteúdo para copiar');
      return;
    }
    
    navigator.clipboard.writeText(parts.join(''));
    toast.success('Legenda copiada!');
  };

  // Media inheritance logic
  const hiddenInherited = variation.hidden_inherited_media || [];
  const extraMedia = variation.extra_media_ids || [];
  const mediaMode = variation.media_mode || 'inherit';
  
  // Get inherited media (from idea, minus hidden)
  const inheritedMedia = mediaMode === 'inherit' 
    ? ideaMediaUrls.filter(url => !hiddenInherited.includes(url))
    : [];

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const uploadedUrls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const filePath = `variations/${variation.id}/${fileName}`;
      
      const { error } = await supabase.storage
        .from('media')
        .upload(filePath, file);
      
      if (error) {
        console.error('Upload error:', error);
        toast.error(`Erro ao fazer upload: ${file.name}`);
        continue;
      }
      
      const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);
      
      uploadedUrls.push(urlData.publicUrl);
    }

    if (uploadedUrls.length > 0) {
      onUpdate(variation.id, {
        extra_media_ids: [...extraMedia, ...uploadedUrls],
      });
      toast.success(`${uploadedUrls.length} mídia(s) adicionada(s)!`);
    }
  };

  const handleRemoveExtraMedia = (url: string) => {
    onUpdate(variation.id, {
      extra_media_ids: extraMedia.filter(m => m !== url),
    });
  };

  const handleToggleInheritedVisibility = (url: string) => {
    const isHidden = hiddenInherited.includes(url);
    if (isHidden) {
      onUpdate(variation.id, {
        hidden_inherited_media: hiddenInherited.filter(u => u !== url),
      });
    } else {
      onUpdate(variation.id, {
        hidden_inherited_media: [...hiddenInherited, url],
      });
    }
  };

  const handleToggleMediaMode = (inherit: boolean) => {
    onUpdate(variation.id, {
      media_mode: inherit ? 'inherit' : 'custom',
    });
  };

  // Field labels in Portuguese
  const fieldLabels: Record<string, string> = {
    title: 'Título',
    description: 'Descrição',
    caption: 'Legenda',
    hashtags: 'Hashtags',
    cta: 'Call to Action',
    cover_url: 'URL da Capa',
    music: 'Música',
    link: 'Link',
    tags: 'Tags',
    chapters: 'Capítulos',
    playlist: 'Playlist',
    thumbnail_url: 'URL da Thumbnail',
  };

  // AI generation for variation fields
  const generateFieldWithAI = async (fieldId: string, fieldLabel?: string) => {
    setAiLoading(prev => ({ ...prev, [fieldId]: true }));
    try {
      const standardFields = ['title', 'description', 'caption', 'cta', 'hashtags'];
      const isCustomField = !standardFields.includes(fieldId);
      
      const customFieldValues = variation.custom_field_values || {};
      
      const { data, error } = await supabase.functions.invoke('digital-content-ai', {
        body: {
          title: idea.title,
          field: isCustomField ? 'custom_field' : fieldId,
          platform: platformConfig?.name,
          platformType: platformConfig?.group_type,
          customFieldLabel: isCustomField ? fieldLabel : undefined,
          existingData: {
            title: variation.title,
            description: variation.description,
            caption: variation.caption,
            cta: variation.cta,
            objective: idea.objective,
            target_audience: idea.target_audience,
            ...customFieldValues,
          },
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const resultKey = isCustomField ? 'custom_field' : fieldId;
      if (data?.[resultKey]) {
        if (isCustomField) {
          // Update custom_field_values JSONB
          const newCustomValues = { ...customFieldValues, [fieldId]: data[resultKey] };
          onUpdate(variation.id, { custom_field_values: newCustomValues });
        } else {
          // Standard field
          onUpdate(variation.id, { [fieldId]: data[resultKey] });
        }
        toast.success(`${fieldLabel || fieldId} gerado com IA!`);
      }
    } catch (err) {
      console.error('AI generation error:', err);
      toast.error('Erro ao gerar conteúdo com IA');
    } finally {
      setAiLoading(prev => ({ ...prev, [fieldId]: false }));
    }
  };

  // Generate all custom fields at once
  const generateAllFieldsWithAI = async () => {
    const customFields = platformConfig?.custom_fields || [];
    if (customFields.length === 0) {
      toast.error('Nenhum campo definido para gerar');
      return;
    }

    setAiLoading(prev => ({ ...prev, all: true }));
    try {
      const { data, error } = await supabase.functions.invoke('digital-content-ai', {
        body: {
          title: idea.title,
          field: 'all_variation_fields',
          platform: platformConfig?.name,
          platformType: platformConfig?.group_type,
          customFields: customFields.map(f => ({ id: f.id, label: f.label, type: f.type })),
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      // Update all fields that were generated - store in custom_field_values
      const customFieldValues = variation.custom_field_values || {};
      const newCustomValues = { ...customFieldValues };
      let count = 0;
      
      for (const field of customFields) {
        if (data[field.id]) {
          newCustomValues[field.id] = data[field.id];
          count++;
        }
      }

      if (count > 0) {
        onUpdate(variation.id, { custom_field_values: newCustomValues });
        toast.success(`${count} campos gerados com IA!`);
      }
    } catch (err) {
      console.error('AI generation error:', err);
      toast.error('Erro ao gerar conteúdo com IA');
    } finally {
      setAiLoading(prev => ({ ...prev, all: false }));
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack} className="h-10">
          <ArrowLeft className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Voltar</span>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={handleCopyCaption}
            title="Copiar legenda e hashtags"
          >
            <Copy className="h-4 w-4" />
          </Button>

          <Select
            value={variation.status}
            onValueChange={(value) => onUpdate(variation.id, { status: value as keyof typeof DIGITAL_STATUS })}
          >
            <SelectTrigger className={cn('w-auto h-9', statusConfig.color, 'text-white border-0')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DIGITAL_STATUS).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2 h-2 rounded-full', config.color)} />
                    {config.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="destructive"
            size="icon"
            className="h-9 w-9"
            onClick={() => { onDelete(variation.id); onBack(); }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Platform Header (hierarchical picker) */}
      <Popover>
        <PopoverTrigger asChild>
          <Card className="bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <PlatformIcon icon={platformConfig?.icon || '📱'} size="xl" />
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold flex items-center gap-1">
                    {platformConfig?.name || 'Plataforma'}
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </h2>
                  <p className="text-sm text-muted-foreground truncate">{idea.title}</p>
                </div>
                {platformConfig?.aspect_ratio && (
                  <div className="flex gap-1 text-xs shrink-0">
                    <Badge variant="outline" className="text-[10px]">{platformConfig.aspect_ratio}</Badge>
                    {platformConfig?.duration && (
                      <Badge variant="outline" className="text-[10px]">{platformConfig.duration}</Badge>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[340px]" align="start">
          <HierarchicalPlatformSelector
            platforms={platforms}
            onSelect={(id) => {
              if (id && id !== variation.platform) {
                onUpdate(variation.id, { platform: id });
              }
            }}
            onCancel={() => {}}
          />
        </PopoverContent>
      </Popover>

      {/* Preview Section */}
      {(() => {
        const aspectRatio = platformConfig?.aspect_ratio || variation.aspect_ratio || '1:1';
        const previewAspectClass = (() => {
          if (aspectRatio.includes('9:16') || aspectRatio.includes('4:5')) return 'aspect-[9/16] max-h-[420px]';
          if (aspectRatio.includes('16:9') || aspectRatio.includes('1.91:1')) return 'aspect-video';
          return 'aspect-square max-h-[360px]';
        })();

        // Collect all visible media
        const allMedia = [...inheritedMedia, ...extraMedia];
        const firstMedia = allMedia[0] || null;
        const isVideo = firstMedia && /\.(mp4|webm|mov)(\?|$)/i.test(firstMedia);

        // Gather text content from custom fields
        const customFields = platformConfig?.custom_fields || [];
        const customFieldValues = variation.custom_field_values || {};
        const mainText = customFields.length > 0
          ? customFieldValues[customFields[0].id] || variation.caption || variation.title || ''
          : variation.caption || variation.title || '';

        return (
          <Card className="overflow-hidden">
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Pré-visualização
                </CardTitle>
                <Badge variant="outline" className="text-[10px]">{aspectRatio}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className={cn(
                'relative w-full mx-auto rounded-lg overflow-hidden border bg-muted/30',
                previewAspectClass
              )}>
                {firstMedia ? (
                  isVideo ? (
                    <video
                      src={firstMedia}
                      className="absolute inset-0 w-full h-full object-cover"
                      muted
                      loop
                      playsInline
                      autoPlay
                    />
                  ) : (
                    <img
                      src={firstMedia}
                      alt="Preview"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-muted-foreground space-y-1">
                      <ImagePlus className="h-8 w-8 mx-auto opacity-40" />
                      <p className="text-xs">Sem mídia</p>
                    </div>
                  </div>
                )}

                {/* Text overlay */}
                {mainText && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12">
                    <p className="text-white text-sm font-medium line-clamp-3 drop-shadow-md">
                      {mainText}
                    </p>
                    {variation.cta && (
                      <span className="inline-block mt-1.5 text-[11px] bg-white/20 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">
                        {variation.cta}
                      </span>
                    )}
                  </div>
                )}

                {/* Platform badge */}
                <div className="absolute top-2 left-2">
                  <Badge variant="secondary" className="text-[10px] bg-black/40 text-white border-0 backdrop-blur-sm gap-1">
                    <PlatformIcon icon={platformConfig?.icon || '📱'} size="sm" />
                    {platformConfig?.name}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Idea Context - Collapsible */}
      <Collapsible open={showIdea} onOpenChange={setShowIdea}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="py-3 cursor-pointer hover:bg-muted/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  📋 Contexto da Ideia
                </CardTitle>
                {showIdea ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Objetivo</Label>
                  <p className="text-sm">{idea.objective || '—'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Público-Alvo</Label>
                  <p className="text-sm">{idea.target_audience || '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Mensagem Principal</Label>
                  <p className="text-sm">{idea.key_message || '—'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">KPI/Meta</Label>
                  <p className="text-sm">{idea.kpi || '—'}</p>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Main Content */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">✏️ Conteúdo</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={generateAllFieldsWithAI}
              disabled={aiLoading.all}
            >
              {aiLoading.all ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1" />
              )}
              Gerar Tudo com IA
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {/* Dynamic fields based on platform custom_fields */}
          {(platformConfig?.custom_fields || [{ id: 'caption', label: 'Legenda', type: 'textarea' as const }, { id: 'cta', label: 'Call to Action', type: 'input' as const }]).map((field) => {
            // Get value from custom_field_values JSONB for custom fields, or from variation for standard fields
            const standardFields = ['title', 'description', 'caption', 'cta', 'hashtags'];
            const isStandardField = standardFields.includes(field.id);
            const customFieldValues = variation.custom_field_values || {};
            const value = isStandardField 
              ? (variation as any)[field.id] || ''
              : customFieldValues[field.id] || '';
            const isTextarea = field.type === 'textarea';

            const handleFieldChange = (newValue: string) => {
              if (isStandardField) {
                onUpdate(variation.id, { [field.id]: newValue });
              } else {
                const newCustomValues = { ...customFieldValues, [field.id]: newValue };
                onUpdate(variation.id, { custom_field_values: newCustomValues });
              }
            };

            return (
              <div key={field.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{field.label}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-primary hover:text-primary"
                    onClick={() => generateFieldWithAI(field.id, field.label)}
                    disabled={aiLoading[field.id]}
                  >
                    {aiLoading[field.id] ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    <span className="ml-1">Gerar</span>
                  </Button>
                </div>
                <Textarea
                  value={value}
                  onChange={(e) => handleFieldChange(e.target.value)}
                  placeholder={field.label}
                  rows={isTextarea ? 3 : 1}
                  className={cn(
                    "resize-y",
                    !isTextarea && "min-h-[44px]"
                  )}
                />
              </div>
            );
          })}

          {/* Media with Inheritance */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Mídia
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Herdar</span>
                <Switch
                  checked={mediaMode === 'inherit'}
                  onCheckedChange={(checked) => handleToggleMediaMode(checked)}
                />
              </div>
            </div>

            {/* Inherited Media (from Idea) */}
            {mediaMode === 'inherit' && ideaMediaUrls.length > 0 && (
              <MediaGallery
                media={ideaMediaUrls}
                size="md"
                label="Ideia"
                labelColor="bg-purple-500"
                showVisibilityToggle
                hiddenMedia={hiddenInherited}
                onToggleVisibility={handleToggleInheritedVisibility}
              />
            )}

            {/* Specific Media (variation only) */}
            <div className="flex gap-2 flex-wrap items-start">
              {extraMedia.length > 0 && (
                <MediaGallery
                  media={extraMedia}
                  size="md"
                  showRemove
                  onDelete={handleRemoveExtraMedia}
                />
              )}
              <label className="h-14 w-14 border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:bg-muted touch-manipulation active:scale-95">
                <Plus className="h-5 w-5 text-muted-foreground" />
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={handleMediaUpload}
                />
              </label>
              <Button
                variant="ghost"
                size="icon"
                className="h-14 w-14 border-2 border-dashed"
                onClick={() => setShowMediaLibrary(true)}
                title="Biblioteca de Mídia"
              >
                <ImagePlus className="h-5 w-5 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule & Technical Info */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Agendamento & Técnico
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {/* Primary date */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Datas de Postagem</Label>
            <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
              <Checkbox
                checked={variation.is_posted || false}
                onCheckedChange={(checked) => onUpdate(variation.id, { is_posted: !!checked })}
                className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 h-9 justify-start text-left font-normal text-sm",
                      !variation.scheduled_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {variation.scheduled_date 
                      ? format(parseISO(variation.scheduled_date), "dd/MM/yy", { locale: ptBR })
                      : "Selecionar data"
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={variation.scheduled_date ? parseISO(variation.scheduled_date) : undefined}
                    onSelect={(date) => onUpdate(variation.id, { 
                      scheduled_date: date ? format(date, 'yyyy-MM-dd') : null 
                    })}
                    initialFocus
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-20 h-9 justify-center text-sm font-normal",
                      !variation.scheduled_time && "text-muted-foreground"
                    )}
                  >
                    <Clock className="mr-1 h-3 w-3" />
                    {variation.scheduled_time?.slice(0, 5) || "--:--"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4 z-50" align="start">
                  <div className="space-y-3">
                    <Input
                      type="time"
                      value={variation.scheduled_time?.slice(0, 5) || ''}
                      onChange={(e) => onUpdate(variation.id, { scheduled_time: e.target.value })}
                      className="h-10 pointer-events-auto"
                    />
                    <div className="grid grid-cols-4 gap-1">
                      {['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'].map((time) => (
                        <Button
                          key={time}
                          variant={variation.scheduled_time?.slice(0, 5) === time ? "default" : "outline"}
                          size="sm"
                          className="text-xs pointer-events-auto h-8"
                          onClick={() => onUpdate(variation.id, { scheduled_time: time })}
                        >
                          {time}
                        </Button>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              {variation.is_posted && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] shrink-0">
                  <Check className="h-3 w-3 mr-0.5" />
                  Postado
                </Badge>
              )}
            </div>

            {/* Additional dates */}
            {(variation.additional_dates || []).map((entry, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
                <Checkbox
                  checked={entry.posted}
                  onCheckedChange={(checked) => {
                    const dates = [...(variation.additional_dates || [])];
                    dates[idx] = { ...dates[idx], posted: !!checked };
                    onUpdate(variation.id, { additional_dates: dates });
                  }}
                  className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex-1 h-9 justify-start text-left font-normal text-sm"
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {entry.date 
                        ? format(parseISO(entry.date), "dd/MM/yy", { locale: ptBR })
                        : "Selecionar data"
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={entry.date ? parseISO(entry.date) : undefined}
                      onSelect={(date) => {
                        const dates = [...(variation.additional_dates || [])];
                        dates[idx] = { ...dates[idx], date: date ? format(date, 'yyyy-MM-dd') : '' };
                        onUpdate(variation.id, { additional_dates: dates });
                      }}
                      initialFocus
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-20 h-9 justify-center text-sm font-normal",
                        !entry.time && "text-muted-foreground"
                      )}
                    >
                      <Clock className="mr-1 h-3 w-3" />
                      {entry.time?.slice(0, 5) || "--:--"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4 z-50" align="start">
                    <div className="space-y-3">
                      <Input
                        type="time"
                        value={entry.time?.slice(0, 5) || ''}
                        onChange={(e) => {
                          const dates = [...(variation.additional_dates || [])];
                          dates[idx] = { ...dates[idx], time: e.target.value };
                          onUpdate(variation.id, { additional_dates: dates });
                        }}
                        className="h-10 pointer-events-auto"
                      />
                    </div>
                  </PopoverContent>
                </Popover>
                {entry.posted && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] shrink-0">
                    <Check className="h-3 w-3 mr-0.5" />
                    Postado
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    const dates = (variation.additional_dates || []).filter((_, i) => i !== idx);
                    onUpdate(variation.id, { additional_dates: dates });
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs border-dashed"
              onClick={() => {
                const dates = [...(variation.additional_dates || []), { date: '', time: '', posted: false }];
                onUpdate(variation.id, { additional_dates: dates });
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Adicionar data de postagem
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Aspecto</Label>
              <Input
                value={variation.aspect_ratio || platformConfig?.aspect_ratio || ''}
                onChange={(e) => onUpdate(variation.id, { aspect_ratio: e.target.value })}
                placeholder="16:9, 9:16..."
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Duração (seg)</Label>
              <Input
                type="number"
                value={variation.duration_seconds || ''}
                onChange={(e) => onUpdate(variation.id, { duration_seconds: parseInt(e.target.value) || null })}
                placeholder="60"
                className="h-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checklist - Collapsible */}
      <Collapsible open={showChecklist} onOpenChange={setShowChecklist}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="py-3 cursor-pointer hover:bg-muted/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  Checklist de Produção
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Progress value={checklistProgress} className="w-12 h-2" />
                  <span className="text-xs text-muted-foreground tabular-nums">{Math.round(checklistProgress)}%</span>
                  {showChecklist ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-3">
              {variation.checklist?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Nenhum item no checklist.
                </p>
              ) : (
                <div className="space-y-1">
                  {variation.checklist?.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => onToggleChecklist(variation.id, item.id)}
                    >
                      <Checkbox checked={item.done} />
                      <span className={cn(
                        'text-sm flex-1',
                        item.done && 'line-through text-muted-foreground'
                      )}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Metrics - Collapsible */}
      <Collapsible open={showMetrics} onOpenChange={setShowMetrics}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="py-3 cursor-pointer hover:bg-muted/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  📊 Métricas
                </CardTitle>
                {showMetrics ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Alcance</Label>
                  <Input
                    type="number"
                    value={variation.metric_reach || ''}
                    onChange={(e) => onUpdate(variation.id, { metric_reach: parseInt(e.target.value) || null })}
                    placeholder="0"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Engajamento</Label>
                  <Input
                    type="number"
                    value={variation.metric_engagement || ''}
                    onChange={(e) => onUpdate(variation.id, { metric_engagement: parseInt(e.target.value) || null })}
                    placeholder="0"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cliques</Label>
                  <Input
                    type="number"
                    value={variation.metric_clicks || ''}
                    onChange={(e) => onUpdate(variation.id, { metric_clicks: parseInt(e.target.value) || null })}
                    placeholder="0"
                    className="h-9"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Retenção (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={variation.metric_retention || ''}
                    onChange={(e) => onUpdate(variation.id, { metric_retention: parseFloat(e.target.value) || null })}
                    placeholder="0"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CTR (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={variation.metric_ctr || ''}
                    onChange={(e) => onUpdate(variation.id, { metric_ctr: parseFloat(e.target.value) || null })}
                    placeholder="0"
                    className="h-9"
                  />
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Réplica Visual da Plataforma — interface idêntica ao app real, com campos editáveis */}
      {(effectiveReplica?.sections?.length ?? 0) > 0 && (
        <Collapsible open={showRealStructure} onOpenChange={setShowRealStructure}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="py-3 cursor-pointer hover:bg-muted/50">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-sm flex items-center gap-2">
                    🧩 Réplica da Plataforma
                    <Badge variant="secondary" className="text-[10px]">
                      {effectiveReplica?.sections?.length} seções
                    </Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateReplica(true);
                      }}
                      disabled={generatingReplica}
                      title="Usa modelo gratuito (qualidade menor)"
                    >
                      {generatingReplica ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Gratuito
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateReplica(false);
                      }}
                      disabled={generatingReplica}
                    >
                      {generatingReplica ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Gerar novamente
                    </Button>
                    {showRealStructure ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-4">
                <p className="text-xs text-muted-foreground mb-3">
                  Reprodução fiel de <strong>{platformConfig?.name}</strong>. Edite aqui exatamente como faria no app real — os dados serão usados para integrar via API.
                </p>
                <PlatformReplicaRenderer
                  replica={effectiveReplica}
                  values={variation.custom_field_values || {}}
                  onChange={(vals) => onUpdate(variation.id, { custom_field_values: vals })}
                />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Fallback — se não houver réplica visual ainda mas há prints, mostrar galeria + botão de geração */}
      {(effectiveReplica?.sections?.length ?? 0) === 0 &&
        (platformConfig?.structure_media_urls?.length ?? 0) > 0 && (
          <Card className="border-dashed border-primary/40 bg-primary/5">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-sm flex items-center gap-2">
                  🧩 Estrutura Real (Prints)
                  <Badge variant="outline" className="text-[10px]">
                    Ainda não há réplica editável
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleGenerateReplica(true)}
                    disabled={generatingReplica}
                    className="gap-2"
                    title="Usa modelo gratuito (qualidade menor)"
                  >
                    {generatingReplica ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Gratuito
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleGenerateReplica(false)}
                    disabled={generatingReplica}
                    className="gap-2"
                  >
                    {generatingReplica ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Gerar app editável a partir dos prints
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <p className="text-xs text-muted-foreground mb-3">
                A IA vai analisar os prints abaixo e reproduzir a interface real ({platformConfig?.name}) com campos editáveis (foto, vídeo, título, peso, valor, etc).
              </p>
              <div className="grid grid-cols-2 gap-2">
                {platformConfig?.structure_media_urls?.map((url, idx) => {
                  const isVideo = /\.(mp4|webm|mov|avi)(\?|$)/i.test(url);
                  return isVideo ? (
                    <video key={idx} src={url} controls className="w-full rounded border" />
                  ) : (
                    <img
                      key={idx}
                      src={url}
                      alt={`Print ${idx + 1}`}
                      className="w-full rounded border cursor-zoom-in"
                      onClick={() => window.open(url, '_blank')}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}


      <ResponsiveDialog
        open={showMediaLibrary}
        onOpenChange={setShowMediaLibrary}
        title="Selecionar da Biblioteca"
      >
        <div className="max-h-[60vh] overflow-auto">
          <MediaLibrary
            variationId={variation.id}
            mode="select"
            onSelect={(url) => {
              onUpdate(variation.id, {
                extra_media_ids: [...extraMedia, url],
              });
              setShowMediaLibrary(false);
              toast.success('Mídia adicionada!');
            }}
          />
        </div>
      </ResponsiveDialog>
    </div>
  );
}
