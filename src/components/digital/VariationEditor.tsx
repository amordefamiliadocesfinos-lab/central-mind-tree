import { useState } from 'react';
import { DigitalVariation, DIGITAL_STATUS } from '@/hooks/useDigital';
import { Platform } from '@/hooks/usePlatforms';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { MediaLibrary } from './MediaLibrary';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ArrowLeft, Trash2, Calendar, BarChart3, CheckSquare, FileText, X, Plus, Copy, ImagePlus, CalendarIcon, Clock } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface VariationEditorProps {
  variation: DigitalVariation;
  ideaTitle: string;
  onBack: () => void;
  onUpdate: (id: string, updates: Partial<DigitalVariation>) => void;
  onDelete: (id: string) => void;
  onToggleChecklist: (variationId: string, itemId: string) => void;
  platforms?: Platform[];
}

export function VariationEditor({
  variation,
  ideaTitle,
  onBack,
  onUpdate,
  onDelete,
  onToggleChecklist,
  platforms = [],
}: VariationEditorProps) {
  const isMobile = useIsMobile();
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  
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

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newUrls = Array.from(files).map(f => URL.createObjectURL(f));
    onUpdate(variation.id, {
      media_urls: [...(variation.media_urls || []), ...newUrls],
    });
  };

  const handleRemoveMedia = (url: string) => {
    URL.revokeObjectURL(url);
    onUpdate(variation.id, {
      media_urls: (variation.media_urls || []).filter(m => m !== url),
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack} className="h-10">
          <ArrowLeft className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Voltar</span>
        </Button>

        <div className="flex items-center gap-2">
          {/* Copy caption button */}
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
            <div>
              <h2 className="font-semibold">{platformConfig?.name || 'Plataforma'}</h2>
              <p className="text-sm text-muted-foreground">{ideaTitle}</p>
            </div>
          </div>
          {platformConfig?.aspect_ratio && (
            <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{platformConfig.aspect_ratio}</Badge>
              {platformConfig?.duration && (
                <Badge variant="outline">{platformConfig.duration}</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="content">
        <TabsList className="grid w-full grid-cols-4 h-11">
          <TabsTrigger value="content" className="text-xs px-2">
            <FileText className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="checklist" className="text-xs px-2">
            <CheckSquare className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="schedule" className="text-xs px-2">
            <Calendar className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="metrics" className="text-xs px-2">
            <BarChart3 className="h-4 w-4" />
          </TabsTrigger>
        </TabsList>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              {/* Dynamic fields based on platform */}
              {(platformConfig?.fields || ['caption', 'cta']).map((field) => {
                const value = (variation as any)[field] || '';
                const isTextarea = ['description', 'caption', 'chapters'].includes(field);

                return (
                  <div key={field} className="space-y-2">
                    <Label>{fieldLabels[field] || field}</Label>
                    {isTextarea ? (
                      <Textarea
                        value={value}
                        onChange={(e) => onUpdate(variation.id, { [field]: e.target.value })}
                        placeholder={fieldLabels[field] || field}
                        rows={3}
                      />
                    ) : (
                      <Input
                        value={value}
                        onChange={(e) => onUpdate(variation.id, { [field]: e.target.value })}
                        placeholder={fieldLabels[field] || field}
                        className="h-11"
                      />
                    )}
                  </div>
                );
              })}

              {/* Media */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Mídia</Label>
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
                <div className="flex gap-2 flex-wrap">
                  {variation.media_urls?.map((url, i) => (
                    <div key={i} className="relative">
                      <img
                        src={url}
                        alt=""
                        className="h-20 w-20 object-cover rounded"
                      />
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
                      onChange={handleMediaUpload}
                    />
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Checklist Tab */}
        <TabsContent value="checklist" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Checklist de Produção</CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Progress value={checklistProgress} className="w-16 h-2" />
                  <span className="tabular-nums">{Math.round(checklistProgress)}%</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {variation.checklist?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum item no checklist.
                </p>
              ) : (
                variation.checklist?.map((item) => (
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
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-12 justify-start text-left font-normal",
                          !variation.scheduled_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {variation.scheduled_date 
                          ? format(parseISO(variation.scheduled_date), "dd/MM/yyyy", { locale: ptBR })
                          : "dd/mm/aaaa"
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
                  <Label>Horário</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-12 justify-start text-left font-normal",
                          !variation.scheduled_time && "text-muted-foreground"
                        )}
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        {variation.scheduled_time?.slice(0, 5) || "--:--"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-4 z-50" align="start">
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Selecione o horário</Label>
                        <Input
                          type="time"
                          value={variation.scheduled_time?.slice(0, 5) || ''}
                          onChange={(e) => onUpdate(variation.id, { scheduled_time: e.target.value })}
                          className="h-12 pointer-events-auto"
                        />
                        <div className="grid grid-cols-4 gap-2">
                          {['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'].map((time) => (
                            <Button
                              key={time}
                              variant={variation.scheduled_time?.slice(0, 5) === time ? "default" : "outline"}
                              size="sm"
                              className="text-xs pointer-events-auto"
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Aspecto</Label>
                  <Input
                    value={variation.aspect_ratio || platformConfig?.aspect_ratio || ''}
                    onChange={(e) => onUpdate(variation.id, { aspect_ratio: e.target.value })}
                    placeholder="Ex: 16:9, 9:16, 1:1"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duração (segundos)</Label>
                  <Input
                    type="number"
                    value={variation.duration_seconds || ''}
                    onChange={(e) => onUpdate(variation.id, { duration_seconds: parseInt(e.target.value) || null })}
                    placeholder="Ex: 60"
                    className="h-11"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Métricas (entrada manual)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Alcance</Label>
                  <Input
                    type="number"
                    value={variation.metric_reach || ''}
                    onChange={(e) => onUpdate(variation.id, { metric_reach: parseInt(e.target.value) || null })}
                    placeholder="0"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Engajamento</Label>
                  <Input
                    type="number"
                    value={variation.metric_engagement || ''}
                    onChange={(e) => onUpdate(variation.id, { metric_engagement: parseInt(e.target.value) || null })}
                    placeholder="0"
                    className="h-11"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cliques</Label>
                  <Input
                    type="number"
                    value={variation.metric_clicks || ''}
                    onChange={(e) => onUpdate(variation.id, { metric_clicks: parseInt(e.target.value) || null })}
                    placeholder="0"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Retenção (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={variation.metric_retention || ''}
                    onChange={(e) => onUpdate(variation.id, { metric_retention: parseFloat(e.target.value) || null })}
                    placeholder="0.0"
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>CTR (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={variation.metric_ctr || ''}
                  onChange={(e) => onUpdate(variation.id, { metric_ctr: parseFloat(e.target.value) || null })}
                  placeholder="0.0"
                  className="h-11"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
                media_urls: [...(variation.media_urls || []), url],
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
