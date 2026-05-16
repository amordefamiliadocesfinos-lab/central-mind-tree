import { useEffect, useState, useRef } from 'react';
import { useIdeaTypes } from '@/hooks/useIdeaTypes';
import { DigitalIdea, DigitalVariation, DIGITAL_STATUS } from '@/hooks/useDigital';
import { Platform } from '@/hooks/usePlatforms';
import { PlatformIcon } from './PlatformsManager';
import { useProductsList } from '@/hooks/useProductsList';
import { ProductSelector } from './ProductSelector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DebouncedInput, DebouncedTextarea } from '@/components/ui/debounced-input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ArrowLeft, Plus, Trash2, Settings, Calendar, Image, Copy, Layers, Link2, X, ImagePlus, Eye, EyeOff, Sparkles, Loader2, Wand2, SlidersHorizontal, List, LayoutGrid, Grid3x3 } from 'lucide-react';
import { CustomFieldsDefinition } from './CustomFieldsDefinition';
import { CustomFieldsRenderer } from './CustomFieldsRenderer';
import { AIVariationsGenerator } from './AIVariationsGenerator';
import { useIsMobile } from '@/hooks/use-mobile';
import { VariationEditor } from './VariationEditor';
import { HierarchicalPlatformSelector } from './HierarchicalPlatformSelector';
import { BatchVariationDialog } from './BatchVariationDialog';
import { ScheduleCalendar } from './ScheduleCalendar';
import { MediaLibrary } from './MediaLibrary';
import { MediaGallery } from './MediaThumbnail';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useIdeaActions } from '@/hooks/useIdeaActions';

type AIFieldType = 'objective' | 'target_audience' | 'key_message' | 'kpi' | 'all';

interface Node {
  id: string;
  title: string;
  color: string;
}

interface IdeaEditorProps {
  idea: DigitalIdea;
  onBack: () => void;
  onUpdate: (id: string, updates: Partial<DigitalIdea>) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (id: string) => void | Promise<void>;
  onCreateVariation: (ideaId: string, platformId: string) => Promise<DigitalVariation | null>;
  onUpdateVariation: (id: string, updates: Partial<DigitalVariation>) => void;
  onDeleteVariation: (id: string) => void;
  onDuplicateVariation?: (variationId: string, targetPlatformId?: string) => Promise<DigitalVariation | null>;
  onBatchCreateVariations?: (ideaId: string, platformIds: string[]) => Promise<(DigitalVariation | null)[]>;
  onToggleChecklist: (variationId: string, itemId: string) => void;
  nodes?: Node[];
  platforms?: Platform[];
  onUpdatePlatform?: (id: string, updates: Partial<Platform>) => void | Promise<void>;
}

export function IdeaEditor({
  idea,
  onBack,
  onUpdate,
  onDelete,
  onDuplicate,
  onCreateVariation,
  onUpdateVariation,
  onDeleteVariation,
  onDuplicateVariation,
  onBatchCreateVariations,
  onToggleChecklist,
  nodes = [],
  platforms = [],
  onUpdatePlatform,
}: IdeaEditorProps) {
  const isMobile = useIsMobile();
  const { products } = useProductsList();
  const { ideaTypes } = useIdeaTypes();
  const { executeObjectiveActions } = useIdeaActions();
  const prevObjectiveRef = useRef(idea.objective);
  const syncedProductRef = useRef<string | null>(null);

  // Auto-sync linked product media into idea structural media
  useEffect(() => {
    if (!idea.product_id) return;
    const product = products.find(p => p.id === idea.product_id);
    if (!product || !product.media_urls?.length) return;
    const existing = idea.media_urls || [];
    const missing = product.media_urls.filter(url => !existing.includes(url));
    const key = `${idea.product_id}:${product.media_urls.length}`;
    if (missing.length === 0) {
      syncedProductRef.current = key;
      return;
    }
    if (syncedProductRef.current === key) return;
    syncedProductRef.current = key;
    onUpdate(idea.id, { media_urls: [...existing, ...missing] });
  }, [idea.product_id, idea.id, products, idea.media_urls, onUpdate]);
  const [selectedVariation, setSelectedVariation] = useState<DigitalVariation | null>(null);
  const [showAddPlatform, setShowAddPlatform] = useState(false);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [duplicatingVariation, setDuplicatingVariation] = useState<string | null>(null);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [showDistributeDialog, setShowDistributeDialog] = useState(false);
  const [selectedMediaForDistribute, setSelectedMediaForDistribute] = useState<string | null>(null);
  const [distributeSelections, setDistributeSelections] = useState<Record<string, boolean>>({});
  const [aiLoading, setAiLoading] = useState<Record<AIFieldType, boolean>>({
    objective: false,
    target_audience: false,
    key_message: false,
    kpi: false,
    all: false,
  });
  const [platformsViewMode, setPlatformsViewMode] = useState<'list' | 'kanban' | 'grid'>('list');

  // AI Generation function
  const generateWithAI = async (field: AIFieldType) => {
    if (!idea.title.trim()) {
      toast.error('Preencha o título primeiro para gerar com IA');
      return;
    }

    setAiLoading(prev => ({ ...prev, [field]: true }));

    try {
      const response = await supabase.functions.invoke('digital-content-ai', {
        body: {
          title: idea.title,
          field,
          existingData: {
            objective: idea.objective,
            target_audience: idea.target_audience,
            key_message: idea.key_message,
            kpi: idea.kpi,
          },
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao gerar conteúdo');
      }

      const data = response.data;

      if (data.error) {
        throw new Error(data.error);
      }

      if (field === 'all') {
        // Update all fields
        onUpdate(idea.id, {
          objective: data.objective || idea.objective,
          target_audience: data.target_audience || idea.target_audience,
          key_message: data.key_message || idea.key_message,
          kpi: data.kpi || idea.kpi,
        });
        toast.success('Todos os campos gerados com IA!');
      } else {
        // Update single field
        onUpdate(idea.id, { [field]: data[field] });
        toast.success('Campo gerado com IA!');
      }
    } catch (error) {
      console.error('AI generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar conteúdo');
    } finally {
      setAiLoading(prev => ({ ...prev, [field]: false }));
    }
  };

  // Keep selected variation in sync after background refetches (e.g. after saving schedule)
  useEffect(() => {
    if (!selectedVariation) return;
    const latest = (idea.variations || []).find(v => v.id === selectedVariation.id);
    if (!latest) {
      setSelectedVariation(null);
      return;
    }
    // Avoid unnecessary state updates
    if (latest.updated_at !== selectedVariation.updated_at) {
      setSelectedVariation(latest);
    }
  }, [idea.variations, selectedVariation?.id, selectedVariation?.updated_at]);

  // Helper to get platform config
  const getPlatform = (platformId: string) => platforms.find(p => p.id === platformId);

  const statusConfig = DIGITAL_STATUS[idea.status];
  const variations = idea.variations || [];
  const completedVariations = variations.filter(v => v.status === 'concluido').length;
  const progress = variations.length > 0 ? (completedVariations / variations.length) * 100 : 0;

  // Platforms not yet added
  const availablePlatforms = platforms.filter(
    p => p.is_active && !variations.some(v => v.platform === p.id)
  );
  const existingPlatformIds = variations.map(v => v.platform);

  const handleAddPlatform = async (platformId: string) => {
    await onCreateVariation(idea.id, platformId);
    setShowAddPlatform(false);
  };

  const handleBatchCreate = async (platformIds: string[]) => {
    if (onBatchCreateVariations) {
      await onBatchCreateVariations(idea.id, platformIds);
    }
  };

  const handleDuplicate = async (variationId: string, targetPlatformId?: string) => {
    if (onDuplicateVariation) {
      await onDuplicateVariation(variationId, targetPlatformId);
      setDuplicatingVariation(null);
    }
  };

  // Handle media upload for idea
  const handleIdeaMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Upload to Supabase storage
    const uploadedUrls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const filePath = `ideas/${idea.id}/${fileName}`;
      
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
      onUpdate(idea.id, {
        media_urls: [...(idea.media_urls || []), ...uploadedUrls],
      });
      toast.success(`${uploadedUrls.length} mídia(s) adicionada(s)!`);
    }
  };

  const handleRemoveIdeaMedia = (url: string) => {
    onUpdate(idea.id, {
      media_urls: (idea.media_urls || []).filter(m => m !== url),
    });
  };

  // Open distribute dialog for a specific media
  const openDistributeDialog = (mediaUrl: string) => {
    setSelectedMediaForDistribute(mediaUrl);
    // Initialize selections - checked if not hidden
    const selections: Record<string, boolean> = {};
    variations.forEach(v => {
      const hidden = v.hidden_inherited_media || [];
      selections[v.id] = !hidden.includes(mediaUrl);
    });
    setDistributeSelections(selections);
    setShowDistributeDialog(true);
  };

  const handleDistributeSave = async () => {
    if (!selectedMediaForDistribute) return;

    // Update each variation's hidden_inherited_media
    for (const variation of variations) {
      const hidden = [...(variation.hidden_inherited_media || [])];
      const shouldBeVisible = distributeSelections[variation.id];
      const isCurrentlyHidden = hidden.includes(selectedMediaForDistribute);

      if (shouldBeVisible && isCurrentlyHidden) {
        // Remove from hidden
        const index = hidden.indexOf(selectedMediaForDistribute);
        hidden.splice(index, 1);
        onUpdateVariation(variation.id, { hidden_inherited_media: hidden });
      } else if (!shouldBeVisible && !isCurrentlyHidden) {
        // Add to hidden
        hidden.push(selectedMediaForDistribute);
        onUpdateVariation(variation.id, { hidden_inherited_media: hidden });
      }
    }

    toast.success('Disponibilidade atualizada!');
    setShowDistributeDialog(false);
    setSelectedMediaForDistribute(null);
  };

  if (selectedVariation) {
    return (
      <VariationEditor
        variation={selectedVariation}
        idea={idea}
        ideaMediaUrls={idea.media_urls || []}
        onBack={() => setSelectedVariation(null)}
        onUpdate={onUpdateVariation}
        onUpdateIdea={onUpdate}
        onDelete={onDeleteVariation}
        onToggleChecklist={onToggleChecklist}
        platforms={platforms}
        onUpdatePlatform={onUpdatePlatform}
      />
    );
  }

  // Determine preview aspect ratio from first variation's platform
  const previewAspect = (() => {
    const firstVariation = variations[0];
    if (!firstVariation) return '1:1';
    const platform = getPlatform(firstVariation.platform);
    return platform?.aspect_ratio || '1:1';
  })();

  const previewAspectClass = (() => {
    if (previewAspect.includes('9:16') || previewAspect.includes('4:5')) return 'aspect-[9/16] max-h-[420px]';
    if (previewAspect.includes('16:9') || previewAspect.includes('1.91:1')) return 'aspect-video';
    return 'aspect-square max-h-[360px]';
  })();

  const previewFormatLabel = (() => {
    if (previewAspect.includes('9:16') || previewAspect.includes('4:5')) return 'Vertical';
    if (previewAspect.includes('16:9') || previewAspect.includes('1.91:1')) return 'Horizontal';
    return 'Quadrado';
  })();

  const currentIdeaType = ideaTypes.find(t => t.key === idea.idea_type);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack} className="h-10">
          <ArrowLeft className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Voltar</span>
        </Button>
        
        <div className="flex items-center gap-2">
          <Select
            value={idea.status}
            onValueChange={(value) => onUpdate(idea.id, { status: value as keyof typeof DIGITAL_STATUS })}
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
          
          {onDuplicate && (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => onDuplicate(idea.id)}
              aria-label="Duplicar ideia"
              title="Duplicar ideia (com variações)"
            >
              <Copy className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="destructive"
            size="icon"
            className="h-9 w-9"
            onClick={() => { onDelete(idea.id); onBack(); }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ====== PREVIEW AREA (fixed top) ====== */}
      <Card className="overflow-hidden border-2 border-border/60">
        <div className="bg-muted/30 px-4 py-2 flex items-center justify-between border-b">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pré-visualização</span>
          </div>
          <div className="flex items-center gap-2">
            {currentIdeaType && (
              <Badge variant="secondary" className="text-xs" style={{ backgroundColor: currentIdeaType.color + '22', color: currentIdeaType.color }}>
                {currentIdeaType.icon} {currentIdeaType.label}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs font-normal">
              {previewFormatLabel} • {previewAspect}
            </Badge>
          </div>
        </div>
        <div className="flex justify-center bg-muted/10 p-4">
          <div className={cn('relative w-full max-w-sm bg-background rounded-lg border shadow-sm overflow-hidden', previewAspectClass)}>
            {/* Media preview */}
            {(idea.media_urls?.length || 0) > 0 ? (
              (() => {
                const firstMedia = idea.media_urls[0];
                const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(firstMedia);
                return isVideo ? (
                  <video src={firstMedia} className="absolute inset-0 w-full h-full object-cover" muted autoPlay loop playsInline />
                ) : (
                  <img src={firstMedia} alt="" className="absolute inset-0 w-full h-full object-cover" />
                );
              })()
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/40">
                <div className="text-center text-muted-foreground">
                  <Image className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">Sem mídia</p>
                </div>
              </div>
            )}
            {/* Text overlay at bottom */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12">
              <h3 className="text-white font-bold text-sm leading-tight line-clamp-2">
                {idea.title || 'Título da ideia'}
              </h3>
              {(idea.objective || idea.key_message) && (
                <p className="text-white/80 text-xs mt-1 line-clamp-2">
                  {{ gerar_leads: '🎯 Gerar leads', vender_produto: '💰 Vender produto', reativar_clientes: '🔄 Reativar clientes', engajamento: '💬 Engajamento' }[idea.objective || ''] || idea.objective || idea.key_message}
                </p>
              )}
            </div>
          </div>
        </div>
        {/* Platforms strip */}
        {variations.length > 0 && (
          <div className="px-4 py-2 border-t bg-muted/20 flex items-center gap-3 overflow-x-auto">
            <span className="text-xs text-muted-foreground shrink-0">Plataformas:</span>
            <div className="flex items-center gap-1.5">
              {variations.map(v => {
                const p = getPlatform(v.platform);
                return (
                  <span key={v.id} title={p?.name}><PlatformIcon icon={p?.icon || '📱'} size="md" /></span>
                );
              })}
            </div>
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <Progress value={progress} className="w-16 h-1.5" />
              <span className="text-xs text-muted-foreground tabular-nums">{completedVariations}/{variations.length}</span>
            </div>
          </div>
        )}
      </Card>

      {/* ====== SECONDARY CONTENT IN TABS ====== */}
      <Tabs defaultValue="idea">
        <TabsList className="grid w-full grid-cols-3 h-12">
          <TabsTrigger value="idea" className="h-10">
            <Settings className="h-4 w-4 mr-2" />
            Ideia
          </TabsTrigger>
          <TabsTrigger value="platforms" className="h-10">
            <Image className="h-4 w-4 mr-2" />
            Plataformas
          </TabsTrigger>
          <TabsTrigger value="calendar" className="h-10">
            <Calendar className="h-4 w-4 mr-2" />
            Agenda
          </TabsTrigger>
        </TabsList>

        {/* Idea Tab */}
        <TabsContent value="idea" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Informações da Ideia</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateWithAI('all')}
                  disabled={aiLoading.all || !idea.title.trim()}
                  className="gap-2"
                >
                  {aiLoading.all ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  Gerar Tudo com IA
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              {/* Idea Type Selector */}
              <div className="space-y-2">
                <Label>Tipo da Ideia</Label>
                <Select
                  value={idea.idea_type || 'conteudo'}
                  onValueChange={(v) => onUpdate(idea.id, { idea_type: v as any })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ideaTypes.map((t) => (
                      <SelectItem key={t.key} value={t.key}>
                        <div className="flex items-center gap-2">
                          <span>{t.icon}</span>
                          {t.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Título da Ideia</Label>
                <DebouncedInput
                  value={idea.title}
                  onChange={(v) => onUpdate(idea.id, { title: v })}
                  className="h-12 text-lg font-medium"
                  placeholder="Ex: IPHONE 14 ORIGINAL 128 GB PERFEITO SEM DEFEITOS"
                />
                <p className="text-xs text-muted-foreground">
                  Escreva o título e clique nos botões ✨ para gerar os campos com IA
                </p>
              </div>

              <div className="space-y-2">
                <Label>Objetivo da Ideia <span className="text-destructive">*</span></Label>
                <Select
                  value={idea.objective || ''}
                  onValueChange={async (value) => {
                    onUpdate(idea.id, { objective: value });
                    // Execute auto-actions only when objective changes
                    if (value !== prevObjectiveRef.current) {
                      prevObjectiveRef.current = value;
                      await executeObjectiveActions(idea.id, value, idea.title, idea.product_id);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o objetivo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gerar_leads">🎯 Gerar leads</SelectItem>
                    <SelectItem value="vender_produto">💰 Vender produto</SelectItem>
                    <SelectItem value="reativar_clientes">🔄 Reativar clientes</SelectItem>
                    <SelectItem value="engajamento">💬 Engajamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Público-Alvo</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => generateWithAI('target_audience')}
                    disabled={aiLoading.target_audience || !idea.title.trim()}
                    className="h-7 px-2 gap-1"
                  >
                    {aiLoading.target_audience ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    <span className="text-xs">Gerar</span>
                  </Button>
                </div>
                <DebouncedInput
                  value={idea.target_audience || ''}
                  onChange={(v) => onUpdate(idea.id, { target_audience: v })}
                  placeholder="Para quem é este conteúdo?"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Mensagem Principal</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => generateWithAI('key_message')}
                    disabled={aiLoading.key_message || !idea.title.trim()}
                    className="h-7 px-2 gap-1"
                  >
                    {aiLoading.key_message ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    <span className="text-xs">Gerar</span>
                  </Button>
                </div>
                <DebouncedTextarea
                  value={idea.key_message || ''}
                  onChange={(v) => onUpdate(idea.id, { key_message: v })}
                  placeholder="Qual a mensagem chave a transmitir?"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>KPI / Meta</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => generateWithAI('kpi')}
                    disabled={aiLoading.kpi || !idea.title.trim()}
                    className="h-7 px-2 gap-1"
                  >
                    {aiLoading.kpi ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    <span className="text-xs">Gerar</span>
                  </Button>
                </div>
                <DebouncedInput
                  value={idea.kpi || ''}
                  onChange={(v) => onUpdate(idea.id, { kpi: v })}
                  placeholder="Ex: 10k views, 500 cliques..."
                  className="h-11"
                />
              </div>

              {/* Product linking */}
              {products.length > 0 && (
                <ProductSelector
                  products={products}
                  value={idea.product_id}
                  onChange={(productId) => {
                    const updates: Partial<DigitalIdea> = { product_id: productId };
                    // Auto-fill title from product name if title is empty or matches default
                    if (productId) {
                      const product = products.find(p => p.id === productId);
                      if (product) {
                        if (!idea.title || idea.title === 'Nova Ideia') {
                          updates.title = product.name;
                        }
                        if (!idea.objective && product.description) {
                          updates.objective = product.description;
                        }
                        // Auto-sync product media into idea structural media (merge, no duplicates)
                        if (product.media_urls?.length > 0) {
                          const existing = idea.media_urls || [];
                          const merged = [...existing];
                          product.media_urls.forEach(url => {
                            if (!merged.includes(url)) merged.push(url);
                          });
                          if (merged.length !== existing.length) {
                            updates.media_urls = merged;
                          }
                        }
                      }
                    }
                    onUpdate(idea.id, updates);
                  }}
                  label="Vincular Produto (opcional)"
                />
              )}

              {/* Node linking */}
              {nodes.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Vinculado a Nó
                  </Label>
                  <Select
                    value={idea.node_id || '__none__'}
                    onValueChange={(v) => onUpdate(idea.id, { node_id: v === '__none__' ? null : v })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Nenhum nó vinculado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum</SelectItem>
                      {nodes.map(node => (
                        <SelectItem key={node.id} value={node.id}>
                          <div className="flex items-center gap-2">
                            <div className={cn('w-2 h-2 rounded-full', `bg-node-${node.color}`)} />
                            {node.title}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Custom Fields Values */}
              {(idea.custom_fields || []).length > 0 && (
                <CustomFieldsRenderer
                  fields={idea.custom_fields || []}
                  values={(idea.custom_field_values as Record<string, string>) || {}}
                  onChange={(values) => onUpdate(idea.id, { custom_field_values: values } as any)}
                />
              )}

              {/* Custom Fields Definition */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground gap-1">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Gerenciar campos personalizados ({(idea.custom_fields || []).length})
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <CustomFieldsDefinition
                    fields={idea.custom_fields || []}
                    onChange={(fields) => onUpdate(idea.id, { custom_fields: fields } as any)}
                  />
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Structural Media Section */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Mídias Estruturais
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowMediaLibrary(true)}
                >
                  <ImagePlus className="h-3.5 w-3.5 mr-1" />
                  Da Biblioteca
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Mídias da ideia são herdadas automaticamente pelas variações
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Media Gallery with Lightbox */}
              {(idea.media_urls?.length || 0) > 0 && (
                <MediaGallery
                  media={idea.media_urls || []}
                  size="lg"
                  label="Estrutural"
                  labelColor="bg-purple-500"
                  showRemove
                  showDistribute
                  showReorder
                  onDelete={handleRemoveIdeaMedia}
                  onDistribute={openDistributeDialog}
                  onReorder={(newOrder) => onUpdate(idea.id, { media_urls: newOrder })}
                />
              )}

              {/* Upload buttons */}
              <div className="flex gap-2 flex-wrap">
                <label className="h-20 w-20 border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:bg-muted touch-manipulation active:scale-95">
                  <Plus className="h-6 w-6 text-muted-foreground" />
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={handleIdeaMediaUpload}
                  />
                </label>
              </div>

              {(idea.media_urls?.length || 0) > 0 && (
                <p className="text-xs text-muted-foreground">
                  {idea.media_urls?.length} mídia(s) • Clique para ampliar com zoom
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Platforms Tab */}
        <TabsContent value="platforms" className="space-y-4 mt-4">
          {/* AI Variations Generator */}
          <AIVariationsGenerator
            idea={idea}
            platforms={platforms}
            products={products}
            onUpdateVariation={onUpdateVariation}
          />

          {/* Add Platform Buttons */}
          {availablePlatforms.length > 0 && (
            <div className="flex gap-2">
              {showAddPlatform ? (
                <HierarchicalPlatformSelector
                  platforms={platforms}
                  excludedPlatformIds={existingPlatformIds}
                  onSelect={handleAddPlatform}
                  onCancel={() => setShowAddPlatform(false)}
                />
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="flex-1 h-12"
                    onClick={() => setShowAddPlatform(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Plataforma
                  </Button>
                  {onBatchCreateVariations && availablePlatforms.length > 1 && (
                    <Button
                      variant="outline"
                      className="h-12"
                      onClick={() => setShowBatchDialog(true)}
                    >
                      <Layers className="h-4 w-4 mr-2" />
                      Lote
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

          {/* View Mode Toggle */}
          {variations.length > 0 && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {variations.length} variação(ões)
              </span>
              <div className="inline-flex rounded-md border bg-muted/30 p-0.5">
                <Button
                  variant={platformsViewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 gap-1"
                  onClick={() => setPlatformsViewMode('list')}
                >
                  <List className="h-3.5 w-3.5" />
                  <span className="text-xs hidden sm:inline">Lista</span>
                </Button>
                <Button
                  variant={platformsViewMode === 'kanban' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 gap-1"
                  onClick={() => setPlatformsViewMode('kanban')}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span className="text-xs hidden sm:inline">Kanban</span>
                </Button>
                <Button
                  variant={platformsViewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 gap-1"
                  onClick={() => setPlatformsViewMode('grid')}
                >
                  <Grid3x3 className="h-3.5 w-3.5" />
                  <span className="text-xs hidden sm:inline">Mosaico</span>
                </Button>
              </div>
            </div>
          )}

          {/* Variations List */}
          {variations.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Nenhuma variação criada ainda.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Adicione plataformas para criar variações do conteúdo.
              </p>
            </Card>
          ) : platformsViewMode === 'kanban' ? (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
              {Object.entries(DIGITAL_STATUS).map(([status, config]) => {
                const items = variations.filter(v => v.status === status);
                return (
                  <div key={status} className="flex-shrink-0 w-64">
                    <Card className="h-full">
                      <CardHeader className="py-2 px-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xs font-medium flex items-center gap-2">
                            <div className={cn('w-2 h-2 rounded-full', config.color)} />
                            {config.label}
                          </CardTitle>
                          <Badge variant="secondary" className="text-[10px] h-5">{items.length}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-2 space-y-2 min-h-[120px]">
                        {items.map((variation) => {
                          const platformConfig = getPlatform(variation.platform);
                          const checklistProgress = variation.checklist?.length
                            ? (variation.checklist.filter(c => c.done).length / variation.checklist.length) * 100
                            : 0;
                          const variationMedia = (variation.media_urls as string[] | null) || [];
                          const coverUrl = variationMedia[0] || (idea.media_urls || [])[0] || null;
                          const cfv = (variation as any).custom_field_values as Record<string, string> | undefined;
                          const platformTitle = (() => {
                            if (variation.title?.trim()) return variation.title.trim();
                            if (cfv && platformConfig?.custom_fields?.length) {
                              for (const f of platformConfig.custom_fields) {
                                const val = cfv[f.id];
                                if (val && String(val).trim()) return String(val).trim();
                              }
                            }
                            return platformConfig?.name || 'Variação';
                          })();
                          return (
                            <Card
                              key={variation.id}
                              className={cn(
                                'cursor-pointer hover:bg-muted/50 transition-all border-l-4 overflow-hidden',
                                DIGITAL_STATUS[variation.status].color.replace('bg-', 'border-l-')
                              )}
                              onClick={() => setSelectedVariation(variation)}
                            >
                              {coverUrl && (
                                <div className="relative w-full bg-muted flex items-center justify-center py-1.5">
                                  <img src={coverUrl} alt="" className="max-w-full max-h-[90px] object-contain" loading="lazy" />
                                  {platformConfig && (
                                    <div className="absolute top-1 left-1 bg-black/50 backdrop-blur-sm rounded-full px-1 py-0.5">
                                      <span className="brightness-150"><PlatformIcon icon={platformConfig.icon} size="sm" /></span>
                                    </div>
                                  )}
                                </div>
                              )}
                              <CardContent className="p-2 space-y-1">
                                <div className="flex items-start gap-1.5">
                                  {!coverUrl && platformConfig && (
                                    <PlatformIcon icon={platformConfig.icon} size="sm" />
                                  )}
                                  <h4 className="font-semibold text-xs leading-snug line-clamp-2 flex-1">
                                    {platformTitle}
                                  </h4>
                                </div>
                                {variation.scheduled_date && (
                                  <p className="text-[10px] text-muted-foreground tabular-nums">
                                    📅 {variation.scheduled_date.slice(5).replace('-', '/')}
                                    {variation.scheduled_time && ` ${variation.scheduled_time.slice(0, 5)}`}
                                  </p>
                                )}
                                {variation.checklist?.length > 0 && (
                                  <div className="flex items-center gap-1 pt-1 border-t border-border/50">
                                    <Progress value={checklistProgress} className="flex-1 h-1" />
                                    <span className="text-[9px] text-muted-foreground tabular-nums">{Math.round(checklistProgress)}%</span>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                        {items.length === 0 && (
                          <div className="text-center text-muted-foreground text-[10px] py-4">
                            Vazio
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {variations.map((variation) => {
                const platformConfig = getPlatform(variation.platform);
                const variationStatusConfig = DIGITAL_STATUS[variation.status];
                const checklistProgress = variation.checklist?.length
                  ? (variation.checklist.filter(c => c.done).length / variation.checklist.length) * 100
                  : 0;

                return (
                  <Card
                    key={variation.id}
                    className={cn(
                      'cursor-pointer hover:bg-muted/50 transition-all touch-manipulation',
                      'border-l-4',
                      variationStatusConfig.color.replace('bg-', 'border-l-')
                    )}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div 
                          className="flex items-center gap-3 min-w-0 flex-1"
                          onClick={() => setSelectedVariation(variation)}
                        >
                          <PlatformIcon icon={platformConfig?.icon || '📱'} size="lg" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">
                                {platformConfig?.name || 'Plataforma'}
                              </span>
                              <Badge
                                variant="secondary"
                                className={cn('text-xs', variationStatusConfig.color, 'text-white')}
                              >
                                {variationStatusConfig.label}
                              </Badge>
                            </div>
                            {variation.scheduled_date && (
                              <p className="text-xs text-muted-foreground">
                                📅 {variation.scheduled_date.slice(5).replace('-', '/')}
                                {variation.scheduled_time && ` às ${variation.scheduled_time.slice(0, 5)}`}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {variation.checklist?.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Progress value={checklistProgress} className="w-8 h-1.5" />
                              <span className="tabular-nums">{Math.round(checklistProgress)}%</span>
                            </div>
                          )}
                          
                          {/* Duplicate Button */}
                          {onDuplicateVariation && (
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDuplicatingVariation(
                                    duplicatingVariation === variation.id ? null : variation.id
                                  );
                                }}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              
                              {duplicatingVariation === variation.id && (
                                <Card className="absolute right-0 top-full mt-1 z-10 p-2 min-w-[160px]">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDuplicate(variation.id);
                                    }}
                                  >
                                    Duplicar mesma plataforma
                                  </Button>
                                  {availablePlatforms.slice(0, 3).map((platform) => (
                                    <Button
                                      key={platform.id}
                                      variant="ghost"
                                      size="sm"
                                      className="w-full justify-start text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDuplicate(variation.id, platform.id);
                                      }}
                                    >
                                      <span className="flex items-center gap-1"><PlatformIcon icon={platform.icon} size="sm" /> {platform.name}</span>
                                    </Button>
                                  ))}
                                </Card>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="space-y-4 mt-4">
          <ScheduleCalendar
            variations={variations}
            onSelectVariation={setSelectedVariation}
            platforms={platforms}
          />
        </TabsContent>
      </Tabs>

      {/* Batch Create Dialog */}
      <BatchVariationDialog
        open={showBatchDialog}
        onOpenChange={setShowBatchDialog}
        onConfirm={handleBatchCreate}
        existingPlatforms={existingPlatformIds}
        platforms={platforms}
      />

      {/* Media Library Dialog */}
      <ResponsiveDialog
        open={showMediaLibrary}
        onOpenChange={setShowMediaLibrary}
        title="Biblioteca de Mídia"
      >
        <MediaLibrary
          mode="select"
          onSelectMultiple={(urls) => {
            onUpdate(idea.id, {
              media_urls: [...(idea.media_urls || []), ...urls],
            });
            setShowMediaLibrary(false);
            toast.success(`${urls.length} mídia(s) adicionada(s)!`);
          }}
        />
      </ResponsiveDialog>

      {/* Distribute Media Dialog */}
      <ResponsiveDialog
        open={showDistributeDialog}
        onOpenChange={setShowDistributeDialog}
        title="Disponibilizar Mídia"
        description="Selecione em quais variações esta mídia deve aparecer"
      >
        <div className="space-y-4 py-4">
          {selectedMediaForDistribute && (
            <div className="flex justify-center mb-4">
              <img
                src={selectedMediaForDistribute}
                alt=""
                className="h-24 w-24 object-cover rounded border"
              />
            </div>
          )}
          
          {variations.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm">
              Nenhuma variação criada ainda. Crie variações para gerenciar a disponibilidade.
            </p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {variations.map((variation) => {
                const platform = platforms.find(p => p.id === variation.platform);
                return (
                  <div
                    key={variation.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => setDistributeSelections(prev => ({
                      ...prev,
                      [variation.id]: !prev[variation.id]
                    }))}
                  >
                    <Checkbox
                      checked={distributeSelections[variation.id] ?? true}
                      onCheckedChange={(checked) => 
                        setDistributeSelections(prev => ({
                          ...prev,
                          [variation.id]: !!checked
                        }))
                      }
                    />
                    <span className="text-xl">{platform?.icon || '📱'}</span>
                    <div className="flex-1">
                      <span className="text-sm font-medium">{platform?.name || 'Plataforma'}</span>
                    </div>
                    {distributeSelections[variation.id] ? (
                      <Eye className="h-4 w-4 text-green-500" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowDistributeDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleDistributeSave}>
              Salvar
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
