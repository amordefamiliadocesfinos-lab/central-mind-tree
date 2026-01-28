import { useState } from 'react';
import { DigitalVariation, DigitalIdea, DIGITAL_STATUS } from '@/hooks/useDigital';
import { Platform } from '@/hooks/usePlatforms';
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
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { ArrowLeft, Trash2, Calendar, CheckSquare, X, Plus, Copy, ImagePlus, CalendarIcon, Clock, Eye, EyeOff, Link2, Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type AIFieldType = 'title' | 'description' | 'caption' | 'cta' | 'hashtags';

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
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [showIdea, setShowIdea] = useState(true);
  const [showChecklist, setShowChecklist] = useState(true);
  const [showMetrics, setShowMetrics] = useState(false);
  
  // Find the platform from dynamic platforms list
  const platformConfig = platforms.find(p => p.id === variation.platform);
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
  const generateFieldWithAI = async (field: AIFieldType) => {
    setAiLoading(prev => ({ ...prev, [field]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('digital-content-ai', {
        body: {
          title: idea.title,
          field,
          platform: platformConfig?.name,
          platformType: platformConfig?.group_type,
          existingData: {
            title: variation.title,
            description: variation.description,
            caption: variation.caption,
            cta: variation.cta,
            objective: idea.objective,
            target_audience: idea.target_audience,
          },
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.[field]) {
        onUpdate(variation.id, { [field]: data[field] });
        toast.success(`${fieldLabels[field] || field} gerado com IA!`);
      }
    } catch (err) {
      console.error('AI generation error:', err);
      toast.error('Erro ao gerar conteúdo com IA');
    } finally {
      setAiLoading(prev => ({ ...prev, [field]: false }));
    }
  };

  const aiSupportedFields = ['title', 'description', 'caption', 'cta', 'hashtags'];

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

      {/* Platform Header */}
      <Card className="bg-muted/50">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{platformConfig?.icon || '📱'}</span>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold">{platformConfig?.name || 'Plataforma'}</h2>
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
          <CardTitle className="text-sm">✏️ Conteúdo</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {/* Dynamic fields based on platform custom_fields */}
          {(platformConfig?.custom_fields || [{ id: 'caption', label: 'Legenda', type: 'textarea' as const }, { id: 'cta', label: 'Call to Action', type: 'input' as const }]).map((field) => {
            const value = (variation as any)[field.id] || '';
            const isTextarea = field.type === 'textarea';
            const canGenerateWithAI = aiSupportedFields.includes(field.id);

            return (
              <div key={field.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{field.label}</Label>
                  {canGenerateWithAI && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-primary hover:text-primary"
                      onClick={() => generateFieldWithAI(field.id as AIFieldType)}
                      disabled={aiLoading[field.id]}
                    >
                      {aiLoading[field.id] ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      <span className="ml-1">Gerar</span>
                    </Button>
                  )}
                </div>
                {isTextarea ? (
                  <Textarea
                    value={value}
                    onChange={(e) => onUpdate(variation.id, { [field.id]: e.target.value })}
                    placeholder={field.label}
                    rows={3}
                  />
                ) : (
                  <Input
                    value={value}
                    onChange={(e) => onUpdate(variation.id, { [field.id]: e.target.value })}
                    placeholder={field.label}
                    className="h-11"
                  />
                )}
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
              <div className="flex gap-2 flex-wrap">
                {ideaMediaUrls.map((url, i) => {
                  const isHidden = hiddenInherited.includes(url);
                  return (
                    <div key={i} className={cn("relative group", isHidden && "opacity-40")}>
                      <img
                        src={url}
                        alt=""
                        className="h-14 w-14 object-cover rounded border"
                      />
                      <Badge 
                        variant="secondary" 
                        className="absolute -top-2 -left-2 text-[8px] px-1 py-0 bg-purple-500 text-white"
                      >
                        Ideia
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute -top-1 -right-1 h-5 w-5 bg-background border shadow-sm"
                        onClick={() => handleToggleInheritedVisibility(url)}
                        title={isHidden ? "Exibir" : "Ocultar"}
                      >
                        {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Specific Media (variation only) */}
            <div className="flex gap-2 flex-wrap">
              {extraMedia.map((url, i) => (
                <div key={i} className="relative group">
                  <img
                    src={url}
                    alt=""
                    className="h-14 w-14 object-cover rounded border"
                  />
                  <button
                    className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemoveExtraMedia(url)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-10 justify-start text-left font-normal text-sm",
                      !variation.scheduled_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {variation.scheduled_date 
                      ? format(parseISO(variation.scheduled_date), "dd/MM/yy", { locale: ptBR })
                      : "Selecionar"
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
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Horário</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-10 justify-start text-left font-normal text-sm",
                      !variation.scheduled_time && "text-muted-foreground"
                    )}
                  >
                    <Clock className="mr-2 h-3.5 w-3.5" />
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
            </div>
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

      {/* Media Library Dialog */}
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
