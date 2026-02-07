import { useState } from 'react';
import { DigitalIdea, DigitalVariation } from '@/hooks/useDigital';
import { Platform } from '@/hooks/usePlatforms';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Wand2, Loader2, Check, X, ChevronDown, ChevronUp, AlertTriangle, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  description?: string | null;
}

interface AIVariationsGeneratorProps {
  idea: DigitalIdea;
  platforms: Platform[];
  products?: Product[];
  onUpdateVariation: (id: string, updates: Partial<DigitalVariation>) => void;
}

interface GeneratedContent {
  [variationId: string]: Record<string, string>;
}

export function AIVariationsGenerator({
  idea,
  platforms,
  products = [],
  onUpdateVariation,
}: AIVariationsGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [expandedVariations, setExpandedVariations] = useState<Record<string, boolean>>({});
  const [editedContent, setEditedContent] = useState<GeneratedContent | null>(null);

  const variations = idea.variations || [];

  // Validation: check if idea is ready for AI generation
  const validationErrors: string[] = [];
  if (!idea.title.trim() || idea.title === 'Nova Ideia') {
    validationErrors.push('Título da ideia não definido');
  }
  if (!idea.idea_type) {
    validationErrors.push('Tipo da ideia não definido');
  }
  if (variations.length === 0) {
    validationErrors.push('Nenhuma plataforma configurada');
  }

  const isReady = validationErrors.length === 0;

  // Get linked product
  const linkedProduct = idea.product_id ? products.find(p => p.id === idea.product_id) : null;

  const handleGenerate = async () => {
    setLoading(true);
    setGeneratedContent(null);
    setEditedContent(null);

    try {
      // Build variations spec for the AI
      const variationsSpec = variations.map(v => {
        const platform = platforms.find(p => p.id === v.platform);
        if (!platform) return null;

        return {
          variationId: v.id,
          platformName: platform.name,
          platformType: platform.group_type,
          aspectRatio: platform.aspect_ratio || undefined,
          duration: platform.duration || undefined,
          customFields: (platform.custom_fields || []).map(f => ({
            id: f.id,
            label: f.label,
            type: f.type,
          })),
        };
      }).filter(Boolean);

      if (variationsSpec.length === 0) {
        toast.error('Nenhuma plataforma válida encontrada');
        return;
      }

      const { data, error } = await supabase.functions.invoke('digital-content-ai', {
        body: {
          title: idea.title,
          field: 'generate_all_variations',
          ideaContext: {
            title: idea.title,
            ideaType: idea.idea_type || 'conteudo',
            objective: idea.objective || undefined,
            targetAudience: idea.target_audience || undefined,
            keyMessage: idea.key_message || undefined,
            kpi: idea.kpi || undefined,
            productName: linkedProduct?.name || undefined,
            productDescription: linkedProduct?.description || undefined,
          },
          variations: variationsSpec,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      // data should be { variationId: { fieldId: "content" } }
      setGeneratedContent(data);
      setEditedContent(JSON.parse(JSON.stringify(data))); // Deep copy for editing
      
      // Expand all variations by default
      const expanded: Record<string, boolean> = {};
      variations.forEach(v => { expanded[v.id] = true; });
      setExpandedVariations(expanded);

      toast.success(`Conteúdo gerado para ${Object.keys(data).length} variações!`);
    } catch (err) {
      console.error('AI variations generation error:', err);
      toast.error('Erro ao gerar variações com IA');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyAll = () => {
    if (!editedContent) return;

    let count = 0;
    for (const [variationId, fields] of Object.entries(editedContent)) {
      const variation = variations.find(v => v.id === variationId);
      if (!variation) continue;

      const platform = platforms.find(p => p.id === variation.platform);
      const standardFields = ['title', 'description', 'caption', 'cta', 'hashtags'];

      const standardUpdates: Partial<DigitalVariation> = {};
      const customFieldValues = { ...(variation.custom_field_values || {}) };

      for (const [fieldId, value] of Object.entries(fields)) {
        if (standardFields.includes(fieldId)) {
          (standardUpdates as any)[fieldId] = value;
        } else {
          customFieldValues[fieldId] = value;
        }
      }

      standardUpdates.custom_field_values = customFieldValues;
      onUpdateVariation(variationId, standardUpdates);
      count++;
    }

    toast.success(`${count} variações atualizadas!`);
    setOpen(false);
    setGeneratedContent(null);
    setEditedContent(null);
  };

  const handleEditField = (variationId: string, fieldId: string, value: string) => {
    if (!editedContent) return;
    setEditedContent(prev => ({
      ...prev!,
      [variationId]: {
        ...(prev?.[variationId] || {}),
        [fieldId]: value,
      },
    }));
  };

  const toggleVariation = (variationId: string) => {
    setExpandedVariations(prev => ({
      ...prev,
      [variationId]: !prev[variationId],
    }));
  };

  return (
    <>
      {/* Trigger Button */}
      <Button
        variant="default"
        className="w-full h-12 gap-2"
        onClick={() => setOpen(true)}
        disabled={!isReady}
      >
        <Wand2 className="h-5 w-5" />
        Gerar Variações com IA
      </Button>

      {/* Validation warnings */}
      {!isReady && (
        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-yellow-500" />
          <div>
            <p className="font-medium text-foreground">Preencha antes de gerar:</p>
            <ul className="mt-1 space-y-0.5">
              {validationErrors.map((err, i) => (
                <li key={i}>• {err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Generation Dialog */}
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Gerar Variações com IA"
        description="A IA vai adaptar sua ideia para cada plataforma configurada"
      >
        <div className="space-y-4">
          {/* Idea Context Summary */}
          <Card className="bg-muted/50">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                Contexto da Ideia
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Tipo: </span>
                  <span className="font-medium">{idea.idea_type || 'Conteúdo'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Título: </span>
                  <span className="font-medium truncate">{idea.title}</span>
                </div>
                {idea.objective && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Objetivo: </span>
                    <span>{idea.objective}</span>
                  </div>
                )}
                {idea.target_audience && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Público: </span>
                    <span>{idea.target_audience}</span>
                  </div>
                )}
                {linkedProduct && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Produto: </span>
                    <span>🏷️ {linkedProduct.name}</span>
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {variations.length} plataforma{variations.length !== 1 ? 's' : ''} configurada{variations.length !== 1 ? 's' : ''}
              </div>
            </CardContent>
          </Card>

          {/* Generate Button or Results */}
          {!generatedContent ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                A IA assumirá o papel de especialista em cada tipo de plataforma e gerará conteúdo específico respeitando formato, linguagem e objetivo de cada uma.
              </p>
              
              {/* Platform list preview */}
              <div className="flex flex-wrap gap-1.5">
                {variations.map(v => {
                  const platform = platforms.find(p => p.id === v.platform);
                  return (
                    <Badge key={v.id} variant="outline" className="text-xs gap-1">
                      <span>{platform?.icon || '📱'}</span>
                      {platform?.name || 'Plataforma'}
                    </Badge>
                  );
                })}
              </div>

              <Button
                className="w-full h-11 gap-2"
                onClick={handleGenerate}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando conteúdo...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Gerar para {variations.length} plataforma{variations.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>

              {loading && (
                <div className="space-y-2">
                  <Progress className="h-1.5" />
                  <p className="text-xs text-center text-muted-foreground">
                    Analisando contexto e adaptando para cada plataforma...
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Results */}
              <ScrollArea className="max-h-[400px] pr-2">
                <div className="space-y-2">
                  {variations.map(v => {
                    const platform = platforms.find(p => p.id === v.platform);
                    const content = editedContent?.[v.id];
                    const isExpanded = expandedVariations[v.id];

                    if (!content) return null;

                    return (
                      <Collapsible key={v.id} open={isExpanded} onOpenChange={() => toggleVariation(v.id)}>
                        <Card>
                          <CollapsibleTrigger asChild>
                            <CardHeader className="py-2 px-3 cursor-pointer hover:bg-muted/50">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{platform?.icon || '📱'}</span>
                                  <CardTitle className="text-sm">{platform?.name || 'Plataforma'}</CardTitle>
                                  <Badge variant="secondary" className="text-[10px]">
                                    {platform?.group_type || 'outro'}
                                  </Badge>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <Check className="h-3.5 w-3.5 text-green-500" />
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                            </CardHeader>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <CardContent className="px-3 pb-3 pt-0 space-y-3">
                              {Object.entries(content).map(([fieldId, value]) => {
                                const customField = platform?.custom_fields?.find(f => f.id === fieldId);
                                const label = customField?.label || fieldId;
                                const isTextarea = customField?.type === 'textarea' || value.length > 100;

                                return (
                                  <div key={fieldId} className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">{label}</Label>
                                    <Textarea
                                      value={value}
                                      onChange={(e) => handleEditField(v.id, fieldId, e.target.value)}
                                      rows={isTextarea ? 3 : 1}
                                      className={cn(
                                        "text-sm resize-y",
                                        !isTextarea && "min-h-[36px]"
                                      )}
                                    />
                                  </div>
                                );
                              })}
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleGenerate}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wand2 className="h-4 w-4 mr-1" />}
                  Regenerar
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setOpen(false); setGeneratedContent(null); }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleApplyAll}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Aplicar Tudo
                </Button>
              </div>
            </div>
          )}
        </div>
      </ResponsiveDialog>
    </>
  );
}
