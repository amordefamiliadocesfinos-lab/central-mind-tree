import { useEffect, useState } from 'react';
import { DigitalIdea, DigitalVariation, DIGITAL_STATUS } from '@/hooks/useDigital';
import { Platform } from '@/hooks/usePlatforms';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ArrowLeft, Plus, Trash2, Settings, Calendar, Image, Copy, Layers, Link2, X, ImagePlus, Eye, EyeOff, Sparkles, Loader2, Wand2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { VariationEditor } from './VariationEditor';
import { BatchVariationDialog } from './BatchVariationDialog';
import { ScheduleCalendar } from './ScheduleCalendar';
import { MediaLibrary } from './MediaLibrary';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  onCreateVariation: (ideaId: string, platformId: string) => Promise<DigitalVariation | null>;
  onUpdateVariation: (id: string, updates: Partial<DigitalVariation>) => void;
  onDeleteVariation: (id: string) => void;
  onDuplicateVariation?: (variationId: string, targetPlatformId?: string) => Promise<DigitalVariation | null>;
  onBatchCreateVariations?: (ideaId: string, platformIds: string[]) => Promise<(DigitalVariation | null)[]>;
  onToggleChecklist: (variationId: string, itemId: string) => void;
  nodes?: Node[];
  platforms?: Platform[];
}

export function IdeaEditor({
  idea,
  onBack,
  onUpdate,
  onDelete,
  onCreateVariation,
  onUpdateVariation,
  onDeleteVariation,
  onDuplicateVariation,
  onBatchCreateVariations,
  onToggleChecklist,
  nodes = [],
  platforms = [],
}: IdeaEditorProps) {
  const isMobile = useIsMobile();
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
      />
    );
  }

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

      {/* Progress Bar */}
      {variations.length > 0 && (
        <Card className="bg-muted/50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium tabular-nums">{completedVariations}/{variations.length}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>
      )}

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
              <div className="space-y-2">
                <Label>Título da Ideia</Label>
                <Input
                  value={idea.title}
                  onChange={(e) => onUpdate(idea.id, { title: e.target.value })}
                  className="h-12 text-lg font-medium"
                  placeholder="Ex: IPHONE 14 ORIGINAL 128 GB PERFEITO SEM DEFEITOS"
                />
                <p className="text-xs text-muted-foreground">
                  Escreva o título e clique nos botões ✨ para gerar os campos com IA
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Objetivo</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => generateWithAI('objective')}
                    disabled={aiLoading.objective || !idea.title.trim()}
                    className="h-7 px-2 gap-1"
                  >
                    {aiLoading.objective ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    <span className="text-xs">Gerar</span>
                  </Button>
                </div>
                <Textarea
                  value={idea.objective || ''}
                  onChange={(e) => onUpdate(idea.id, { objective: e.target.value })}
                  placeholder="Qual o objetivo deste conteúdo?"
                  rows={2}
                />
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
                <Input
                  value={idea.target_audience || ''}
                  onChange={(e) => onUpdate(idea.id, { target_audience: e.target.value })}
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
                <Textarea
                  value={idea.key_message || ''}
                  onChange={(e) => onUpdate(idea.id, { key_message: e.target.value })}
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
                <Input
                  value={idea.kpi || ''}
                  onChange={(e) => onUpdate(idea.id, { kpi: e.target.value })}
                  placeholder="Ex: 10k views, 500 cliques..."
                  className="h-11"
                />
              </div>

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
              <div className="flex gap-2 flex-wrap">
                {idea.media_urls?.map((url, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={url}
                      alt=""
                      className="h-20 w-20 object-cover rounded border"
                    />
                    <Badge 
                      variant="secondary" 
                      className="absolute -top-2 -left-2 text-[10px] px-1.5 py-0 bg-purple-500 text-white"
                    >
                      Estrutural
                    </Badge>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 rounded">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-white hover:bg-white/20"
                        onClick={() => openDistributeDialog(url)}
                        title="Disponibilizar em..."
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-white hover:bg-destructive/80"
                        onClick={() => handleRemoveIdeaMedia(url)}
                        title="Remover"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
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
                  {idea.media_urls?.length} mídia(s) • Clique em 👁 para gerenciar disponibilidade nas variações
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Platforms Tab */}
        <TabsContent value="platforms" className="space-y-4 mt-4">
          {/* Add Platform Buttons */}
          {availablePlatforms.length > 0 && (
            <div className="flex gap-2">
              {showAddPlatform ? (
                <Card className="flex-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Selecione a Plataforma</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {availablePlatforms.map((platform) => (
                      <Button
                        key={platform.id}
                        variant="outline"
                        className="h-auto py-3 flex-col gap-1"
                        onClick={() => handleAddPlatform(platform.id)}
                      >
                        <span className="text-xl">{platform.icon}</span>
                        <span className="text-xs">{platform.name}</span>
                      </Button>
                    ))}
                    <Button
                      variant="ghost"
                      className="h-auto py-3"
                      onClick={() => setShowAddPlatform(false)}
                    >
                      Cancelar
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="flex-1 h-12"
                    onClick={() => setShowAddPlatform(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
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
                          <span className="text-2xl">{platformConfig?.icon || '📱'}</span>
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
                                      {platform.icon} {platform.name}
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
          onSelect={(url) => {
            onUpdate(idea.id, {
              media_urls: [...(idea.media_urls || []), url],
            });
            setShowMediaLibrary(false);
            toast.success('Mídia adicionada!');
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
