import { useState } from 'react';
import { usePlatforms, Platform, GROUP_LABELS, GROUP_ICONS, CustomField } from '@/hooks/usePlatforms';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, Settings2, Sparkles, Loader2, GripVertical, Type, AlignLeft } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const EMOJI_OPTIONS = ['📱', '📷', '🎬', '📺', '⚡', '🎵', '📘', '🎥', '🎠', '🛒', '🟡', '🧡', '🟢', '🔵', '🟣', '📦', '🏪', '💼', '🌐', '📧'];

interface PlatformFormData {
  name: string;
  icon: string;
  group_type: 'social' | 'ecommerce' | 'marketplace' | 'other';
  aspect_ratio: string;
  duration: string;
  custom_fields: CustomField[];
  checklist_items: string;
}

const DEFAULT_FIELDS: CustomField[] = [
  { id: 'caption', label: 'Legenda', type: 'textarea' },
  { id: 'cta', label: 'Call to Action', type: 'input' },
];

const initialFormData: PlatformFormData = {
  name: '',
  icon: '📱',
  group_type: 'social',
  aspect_ratio: '',
  duration: '',
  custom_fields: [...DEFAULT_FIELDS],
  checklist_items: '',
};

export function PlatformsManager() {
  const { 
    platforms, 
    groupedPlatforms, 
    loading, 
    createPlatform, 
    updatePlatform, 
    deletePlatform, 
    toggleActive 
  } = usePlatforms();

  const [showDialog, setShowDialog] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null);
  const [formData, setFormData] = useState<PlatformFormData>(initialFormData);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    social: true,
    ecommerce: true,
    marketplace: true,
    other: true,
  });

  // AI checklist suggestion
  const generateChecklistWithAI = async () => {
    if (!formData.name.trim()) {
      toast.error('Preencha o nome da plataforma primeiro');
      return;
    }
    
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('digital-content-ai', {
        body: {
          title: formData.name,
          field: 'checklist_suggestion',
          platform: formData.name,
          platformType: formData.group_type,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (data?.checklist) {
        setFormData(prev => ({ ...prev, checklist_items: data.checklist }));
        toast.success('Checklist sugerido pela IA!');
      }
    } catch (err) {
      console.error('AI generation error:', err);
      toast.error('Erro ao gerar checklist com IA');
    } finally {
      setAiLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingPlatform(null);
    setFormData(initialFormData);
    setShowDialog(true);
  };

  const handleOpenEdit = (platform: Platform) => {
    setEditingPlatform(platform);
    setFormData({
      name: platform.name,
      icon: platform.icon,
      group_type: platform.group_type,
      aspect_ratio: platform.aspect_ratio || '',
      duration: platform.duration || '',
      custom_fields: platform.custom_fields.length > 0 ? platform.custom_fields : [...DEFAULT_FIELDS],
      checklist_items: platform.checklist_template.map(c => c.text).join('\n'),
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    // Parse checklist items from text
    const checklistLines = formData.checklist_items.split('\n').filter(l => l.trim());
    const checklist_template = checklistLines.map((text, i) => ({
      id: `item-${i}`,
      text: text.trim(),
    }));

    // Convert custom_fields to fields array for backwards compatibility
    const fields = formData.custom_fields.map(f => f.id);

    const platformData = {
      name: formData.name,
      icon: formData.icon,
      group_type: formData.group_type,
      aspect_ratio: formData.aspect_ratio || null,
      duration: formData.duration || null,
      fields,
      custom_fields: formData.custom_fields,
      checklist_template,
    };

    if (editingPlatform) {
      await updatePlatform(editingPlatform.id, platformData);
    } else {
      await createPlatform(platformData);
    }

    setShowDialog(false);
  };

  const handleDelete = async (id: string) => {
    const success = await deletePlatform(id);
    if (success) {
      setDeleteConfirm(null);
    }
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  // Field CRUD operations
  const addField = () => {
    const newId = `field_${Date.now()}`;
    setFormData(prev => ({
      ...prev,
      custom_fields: [...prev.custom_fields, { id: newId, label: '', type: 'input' }],
    }));
  };

  const updateField = (index: number, updates: Partial<CustomField>) => {
    setFormData(prev => ({
      ...prev,
      custom_fields: prev.custom_fields.map((f, i) => 
        i === index ? { ...f, ...updates } : f
      ),
    }));
  };

  const removeField = (index: number) => {
    setFormData(prev => ({
      ...prev,
      custom_fields: prev.custom_fields.filter((_, i) => i !== index),
    }));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const groupOrder = ['social', 'ecommerce', 'marketplace', 'other'];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Gerenciar Plataformas
          </h2>
          <p className="text-sm text-muted-foreground">
            {platforms.length} plataformas configuradas
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Plataforma
        </Button>
      </div>

      {/* Groups */}
      {groupOrder.map(groupKey => {
        const groupPlatforms = groupedPlatforms[groupKey] || [];
        if (groupPlatforms.length === 0) return null;

        return (
          <Collapsible
            key={groupKey}
            open={expandedGroups[groupKey]}
            onOpenChange={() => toggleGroup(groupKey)}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="text-lg">{GROUP_ICONS[groupKey]}</span>
                      {GROUP_LABELS[groupKey]}
                      <Badge variant="secondary" className="ml-2">
                        {groupPlatforms.length}
                      </Badge>
                    </CardTitle>
                    {expandedGroups[groupKey] ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-2">
                  {groupPlatforms.map(platform => (
                    <div
                      key={platform.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border',
                        !platform.is_active && 'opacity-50 bg-muted/30'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{platform.icon}</span>
                        <div>
                          <div className="font-medium">{platform.name}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {platform.custom_fields.length > 0 && (
                              <span>{platform.custom_fields.length} campos</span>
                            )}
                            {platform.aspect_ratio && (
                              <span>• {platform.aspect_ratio}</span>
                            )}
                            {platform.checklist_template.length > 0 && (
                              <span>• {platform.checklist_template.length} itens</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={platform.is_active}
                          onCheckedChange={(checked) => toggleActive(platform.id, checked)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenEdit(platform)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteConfirm(platform.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

      {/* Empty State */}
      {platforms.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Nenhuma plataforma configurada.</p>
          <Button className="mt-4" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Primeira Plataforma
          </Button>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <ResponsiveDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        title={editingPlatform ? 'Editar Plataforma' : 'Nova Plataforma'}
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Icon and Name */}
          <div className="flex gap-3">
            <div className="space-y-2">
              <Label>Ícone</Label>
              <Select
                value={formData.icon}
                onValueChange={(v) => setFormData({ ...formData, icon: v })}
              >
                <SelectTrigger className="w-16 h-12 text-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <div className="grid grid-cols-5 gap-1 p-2">
                    {EMOJI_OPTIONS.map(emoji => (
                      <SelectItem
                        key={emoji}
                        value={emoji}
                        className="text-xl justify-center p-2"
                      >
                        {emoji}
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-2">
              <Label>Nome da Plataforma</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Instagram Feed"
                className="h-12"
              />
            </div>
          </div>

          {/* Group Type */}
          <div className="space-y-2">
            <Label>Tipo/Grupo</Label>
            <Select
              value={formData.group_type}
              onValueChange={(v) => setFormData({ ...formData, group_type: v as any })}
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(GROUP_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <span>{GROUP_ICONS[key]}</span>
                      {label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Aspect Ratio and Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Proporção (opcional)</Label>
              <Input
                value={formData.aspect_ratio}
                onChange={(e) => setFormData({ ...formData, aspect_ratio: e.target.value })}
                placeholder="Ex: 9:16, 1:1"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Duração (opcional)</Label>
              <Input
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="Ex: 15-60s"
                className="h-11"
              />
            </div>
          </div>

          {/* Custom Fields Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Campos Personalizados</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={addField}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Adicionar Campo
              </Button>
            </div>
            
            <div className="space-y-2">
              {formData.custom_fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  
                  <Input
                    value={field.label}
                    onChange={(e) => updateField(index, { 
                      label: e.target.value,
                      // Auto-generate id from label
                      id: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || field.id
                    })}
                    placeholder="Nome do campo"
                    className="h-9 flex-1"
                  />
                  
                  <Select
                    value={field.type}
                    onValueChange={(v) => updateField(index, { type: v as 'input' | 'textarea' })}
                  >
                    <SelectTrigger className="w-28 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="input">
                        <div className="flex items-center gap-2">
                          <Type className="h-3.5 w-3.5" />
                          Linha
                        </div>
                      </SelectItem>
                      <SelectItem value="textarea">
                        <div className="flex items-center gap-2">
                          <AlignLeft className="h-3.5 w-3.5" />
                          Texto
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive shrink-0"
                    onClick={() => removeField(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              {formData.custom_fields.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
                  Nenhum campo definido. Clique em "Adicionar Campo" acima.
                </p>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground">
              Defina os campos que aparecerão ao criar conteúdo para esta plataforma. Ex: Título, Descrição, Legenda...
            </p>
          </div>

          {/* Checklist Template */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Checklist Padrão (um item por linha)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-primary hover:text-primary"
                onClick={generateChecklistWithAI}
                disabled={aiLoading || !formData.name.trim()}
              >
                {aiLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span className="ml-1">Sugerir com IA</span>
              </Button>
            </div>
            <Textarea
              value={formData.checklist_items}
              onChange={(e) => setFormData({ ...formData, checklist_items: e.target.value })}
              placeholder="Imagem em alta resolução?&#10;Legenda otimizada?&#10;CTA incluído?"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Cada linha será um item do checklist nas variações desta plataforma.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 sticky bottom-0 bg-background">
            <Button 
              variant="outline" 
              className="flex-1 h-12" 
              onClick={() => setShowDialog(false)}
            >
              Cancelar
            </Button>
            <Button 
              className="flex-1 h-12" 
              onClick={handleSave}
              disabled={!formData.name.trim()}
            >
              {editingPlatform ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Plataforma?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A plataforma será removida permanentemente.
              Se existirem variações usando esta plataforma, a exclusão não será permitida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}