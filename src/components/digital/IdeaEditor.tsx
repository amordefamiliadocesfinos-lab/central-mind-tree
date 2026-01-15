import { useState } from 'react';
import { DigitalIdea, DigitalVariation, DIGITAL_STATUS, PLATFORMS, useDigital } from '@/hooks/useDigital';
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
import { ArrowLeft, Plus, Trash2, Settings, BarChart3, Calendar, Image } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { VariationEditor } from './VariationEditor';

interface IdeaEditorProps {
  idea: DigitalIdea;
  onBack: () => void;
  onUpdate: (id: string, updates: Partial<DigitalIdea>) => void;
  onDelete: (id: string) => void;
  onCreateVariation: (ideaId: string, platform: keyof typeof PLATFORMS) => Promise<DigitalVariation | null>;
  onUpdateVariation: (id: string, updates: Partial<DigitalVariation>) => void;
  onDeleteVariation: (id: string) => void;
  onToggleChecklist: (variationId: string, itemId: string) => void;
}

export function IdeaEditor({
  idea,
  onBack,
  onUpdate,
  onDelete,
  onCreateVariation,
  onUpdateVariation,
  onDeleteVariation,
  onToggleChecklist,
}: IdeaEditorProps) {
  const isMobile = useIsMobile();
  const [selectedVariation, setSelectedVariation] = useState<DigitalVariation | null>(null);
  const [showAddPlatform, setShowAddPlatform] = useState(false);

  const statusConfig = DIGITAL_STATUS[idea.status];
  const variations = idea.variations || [];
  const completedVariations = variations.filter(v => v.status === 'concluido').length;
  const progress = variations.length > 0 ? (completedVariations / variations.length) * 100 : 0;

  // Platforms not yet added
  const availablePlatforms = Object.entries(PLATFORMS).filter(
    ([key]) => !variations.some(v => v.platform === key)
  );

  const handleAddPlatform = async (platform: keyof typeof PLATFORMS) => {
    await onCreateVariation(idea.id, platform);
    setShowAddPlatform(false);
  };

  if (selectedVariation) {
    return (
      <VariationEditor
        variation={selectedVariation}
        ideaTitle={idea.title}
        onBack={() => setSelectedVariation(null)}
        onUpdate={onUpdateVariation}
        onDelete={onDeleteVariation}
        onToggleChecklist={onToggleChecklist}
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
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <Label>Título da Ideia</Label>
                <Input
                  value={idea.title}
                  onChange={(e) => onUpdate(idea.id, { title: e.target.value })}
                  className="h-12 text-lg font-medium"
                />
              </div>

              <div className="space-y-2">
                <Label>Objetivo</Label>
                <Textarea
                  value={idea.objective || ''}
                  onChange={(e) => onUpdate(idea.id, { objective: e.target.value })}
                  placeholder="Qual o objetivo deste conteúdo?"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Público-Alvo</Label>
                <Input
                  value={idea.target_audience || ''}
                  onChange={(e) => onUpdate(idea.id, { target_audience: e.target.value })}
                  placeholder="Para quem é este conteúdo?"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label>Mensagem Principal</Label>
                <Textarea
                  value={idea.key_message || ''}
                  onChange={(e) => onUpdate(idea.id, { key_message: e.target.value })}
                  placeholder="Qual a mensagem chave a transmitir?"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>KPI / Meta</Label>
                <Input
                  value={idea.kpi || ''}
                  onChange={(e) => onUpdate(idea.id, { kpi: e.target.value })}
                  placeholder="Ex: 10k views, 500 cliques..."
                  className="h-11"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Platforms Tab */}
        <TabsContent value="platforms" className="space-y-4 mt-4">
          {/* Add Platform Button */}
          {availablePlatforms.length > 0 && (
            <div className="space-y-2">
              {showAddPlatform ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Selecione a Plataforma</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {availablePlatforms.map(([key, platform]) => (
                      <Button
                        key={key}
                        variant="outline"
                        className="h-auto py-3 flex-col gap-1"
                        onClick={() => handleAddPlatform(key as keyof typeof PLATFORMS)}
                      >
                        <span className="text-xl">{platform.icon}</span>
                        <span className="text-xs">{platform.label}</span>
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
                <Button
                  variant="outline"
                  className="w-full h-12"
                  onClick={() => setShowAddPlatform(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Plataforma
                </Button>
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
                const platformConfig = PLATFORMS[variation.platform];
                const variationStatusConfig = DIGITAL_STATUS[variation.status];
                const checklistProgress = variation.checklist?.length
                  ? (variation.checklist.filter(c => c.done).length / variation.checklist.length) * 100
                  : 0;

                return (
                  <Card
                    key={variation.id}
                    className={cn(
                      'cursor-pointer hover:bg-muted/50 transition-all touch-manipulation active:scale-[0.99]',
                      'border-l-4',
                      variationStatusConfig.color.replace('bg-', 'border-l-')
                    )}
                    onClick={() => setSelectedVariation(variation)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-2xl">{platformConfig?.icon}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">
                                {platformConfig?.label}
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
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Variações Agendadas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {variations.filter(v => v.scheduled_date).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma variação agendada ainda.
                </p>
              ) : (
                variations
                  .filter(v => v.scheduled_date)
                  .sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''))
                  .map(v => {
                    const platformConfig = PLATFORMS[v.platform];
                    return (
                      <div
                        key={v.id}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted"
                        onClick={() => setSelectedVariation(v)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{platformConfig?.icon}</span>
                          <span className="text-sm">{platformConfig?.label}</span>
                        </div>
                        <div className="text-sm text-muted-foreground tabular-nums">
                          {v.scheduled_date?.slice(5).replace('-', '/')}
                          {v.scheduled_time && ` ${v.scheduled_time.slice(0, 5)}`}
                        </div>
                      </div>
                    );
                  })
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
